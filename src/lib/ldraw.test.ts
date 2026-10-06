import { describe, expect, it } from 'vitest';
import {
	placements,
	shortName,
	STANDARD_LEGS,
	STANDING,
	type Figure,
	type Part,
	type Placement
} from './ldraw';

const figure = (): Figure => ({
	head: { id: '3626cp01', color: 14 },
	headgear: { id: '3901', color: 6 },
	neck: { id: null, color: 6 },
	back: { id: null, color: 4 },
	torso: { id: '973p01', color: 15, arms: 4, hands: 14 },
	legs: { id: STANDARD_LEGS, color: 1, hips: 1 },
	handR: { id: null, color: 71, spin: 0 },
	handL: { id: null, color: 71, spin: 0 },
	pose: { ...STANDING }
});
const ids = (list: ReturnType<typeof placements>) => list.map((p) => p.id);
const at = (list: ReturnType<typeof placements>, id: string) => list.find((p) => p.id === id)?.at;

describe('minifig assembly', () => {
	it('builds a standard figure', () => {
		const list = placements(figure());
		expect(ids(list)).toEqual([
			'973p01',
			'3626cp01',
			'3901',
			'3815',
			'3816',
			'3817',
			'3818',
			'3820',
			'3819',
			'3820'
		]);
		// Head and headgear 24 LDU above the torso, hips 32 below
		expect(at(list, '3626cp01')).toEqual([0, -24, 0]);
		expect(at(list, '3901')).toEqual([0, -24, 0]);
		expect(at(list, '3815')).toEqual([0, 32, 0]);
	});

	it('puts neck and back accessories on the torso top', () => {
		const f = figure();
		f.neck.id = '6132';
		f.back.id = '20551c01';
		const list = placements(f);
		expect(at(list, '6132') ?? [0, 0, 0]).toEqual([0, 0, 0]);
		expect(at(list, '20551c01') ?? [0, 0, 0]).toEqual([0, 0, 0]);
	});

	it('sits moulded heads on the neck and their headgear on top', () => {
		const head: Part = { id: '26051p01', name: 'Head Sonic', cat: 'head', moulded: -44 };
		const f = figure();
		f.head.id = head.id;
		const list = placements(f, undefined, head);
		expect(at(list, '26051p01')).toEqual([0, 0, 0]);
		expect(at(list, '3901')).toEqual([0, -44, 0]);
	});

	it('skips arms when the torso has its own', () => {
		const torso: Part = { id: '76382p01', name: 'Torso with Arms', cat: 'torso', arms: true };
		const f = figure();
		f.torso.id = torso.id;
		expect(ids(placements(f, torso))).not.toContain('3818');
	});

	it('puts held accessories in the hand grip, bar on the grip axis', () => {
		const f = figure();
		f.handR.id = '10050';
		const sword = placements(f).find((p) => p.id === '10050')!;
		const hand = placements(f).find((p) => p.id === '3820')!;
		// The grip is about 10 LDU in front of the hand origin
		const d = sword.at!.map((v, i) => v - hand.at![i]);
		expect(Math.hypot(...d)).toBeCloseTo(9.93, 1);
		// Its Y axis (the bar) stays a unit vector, give or take the rounded LDraw matrices
		const m = sword.m!;
		expect(Math.hypot(m[1], m[4], m[7])).toBeCloseTo(1, 3);
	});

	it('turns accessories around the grip', () => {
		const f = figure();
		f.handR.id = '10050';
		const straight = placements(f).find((p) => p.id === '10050')!;
		f.handR.spin = 90;
		const turned = placements(f).find((p) => p.id === '10050')!;
		expect(turned.at).toEqual(straight.at);
		// Spinning keeps the bar axis (Y column) where it was
		expect([turned.m![1], turned.m![4], turned.m![7]].map((v) => v.toFixed(5))).toEqual(
			[straight.m![1], straight.m![4], straight.m![7]].map((v) => v.toFixed(5))
		);
	});

	it('swinging an arm carries the hand and what it holds', () => {
		const f = figure();
		f.handR.id = '10050';
		const rest = placements(f);
		f.pose.armR = 60;
		const raised = placements(f);
		const at = (l: typeof rest, id: string) => l.filter((p) => p.id === id)[0].at!;
		// The shoulder stays put, the hand and the sword move
		expect(at(raised, '3818')).toEqual(at(rest, '3818'));
		expect(at(raised, '3820')).not.toEqual(at(rest, '3820'));
		expect(at(raised, '10050')).not.toEqual(at(rest, '10050'));
		// The left side does not move
		expect(raised.filter((p) => p.id === '3820')[1].at).toEqual(
			rest.filter((p) => p.id === '3820')[1].at
		);
	});

	it('moves the arms of torsos that come with their own', () => {
		const torso: Part = { id: '76382p01', name: 'Torso with Arms', cat: 'torso', arms: true };
		const f = figure();
		f.torso.id = torso.id;
		f.pose.armR = 60;
		const rig = placements(f, torso)[0].rig!;
		// What the 76382p01 shortcut is made of
		const parts: Placement[] = [
			{ id: '973p01', color: 15, at: [0, 0, 0] },
			{ id: '3818', color: 15, at: [-15.552, 9, 0], m: [0.985, -0.17, 0, 0.17, 0.985, 0, 0, 0, 1] },
			{ id: '3819', color: 15, at: [15.552, 9, 0], m: [0.985, 0.17, 0, -0.17, 0.985, 0, 0, 0, 1] },
			{ id: '3820', color: 14, at: [-23.69, 26.774, -9.898], m: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
			{ id: '3820', color: 14, at: [23.69, 26.774, -9.898], m: [1, 0, 0, 0, 1, 0, 0, 0, 1] }
		];
		const moved = rig(parts)!;
		// The torso and the shoulder stay, the right hand goes up, the left one stays
		expect(moved[0]).toEqual(parts[0]);
		expect(moved[1].at![1]).toBeCloseTo(9, 3);
		expect(moved[1].m).not.toEqual(parts[1].m);
		expect(moved[3].at![1]).toBeLessThan(parts[3].at![1] - 5);
		expect(moved[4].at![1]).toBeCloseTo(parts[4].at![1], 1);
	});

	it('moves the legs of hips and legs shortcuts, right one first', () => {
		const legs: Part = { id: '87857', name: 'Hips and Legs Long', cat: 'legs' };
		const f = figure();
		f.legs.id = legs.id;
		f.pose.legR = 45;
		const placed = placements(f, undefined, undefined, legs).find((p) => p.id === '87857')!;
		const moved = placed.rig!([
			{ id: '3815b', color: 1, at: [0, 32, 0] },
			{ id: '87775', color: 1, at: [0, 44, 0] },
			{ id: '87776', color: 1, at: [0, 44, 0] }
		])!;
		expect(moved[0].at).toEqual([0, 32, 0]);
		expect(moved[1].m).not.toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
		expect(moved[2].m!.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
	});

	it('puts standard legs under hips that come alone', () => {
		const hips: Part = { id: '3815bpx2', name: 'Hips with Belt Pattern', cat: 'legs' };
		const f = figure();
		f.legs = { id: hips.id, color: 1, hips: 0 };
		const list = placements(f, undefined, undefined, hips);
		expect(ids(list)).toEqual(expect.arrayContaining(['3815bpx2', '3816', '3817']));
		expect(list.find((p) => p.id === '3815bpx2')!.color).toBe(0);
		const tail: Part = { id: '87749', name: 'Hips with Tentacles', cat: 'legs' };
		f.legs.id = tail.id;
		expect(ids(placements(f, undefined, undefined, tail))).not.toContain('3816');
	});

	it('slips skirts over standard hips and legs', () => {
		const skirt: Part = { id: '24087', name: 'Skirt Ruffled', cat: 'legs' };
		const f = figure();
		f.legs = { id: skirt.id, color: 1, hips: 4 };
		const list = placements(f, undefined, undefined, skirt);
		expect(ids(list)).toEqual(expect.arrayContaining(['3815', '24087', '3816', '3817']));
		expect(list.find((p) => p.id === '24087')!.color).toBe(4);
	});

	it('raises arms and spreads legs sideways', () => {
		const f = figure();
		const rest = placements(f);
		f.pose.raiseR = 90;
		f.pose.spreadL = 45;
		const out = placements(f);
		const hand = (l: typeof rest) => l.filter((p) => p.id === '3820')[0].at!;
		// The right hand goes outwards (-x) and up (-y)
		expect(hand(out)[0]).toBeLessThan(hand(rest)[0] - 5);
		expect(hand(out)[1]).toBeLessThan(hand(rest)[1] - 10);
		// The left leg turns outwards
		const leg = out.find((p) => p.id === '3817')!;
		expect(leg.m![3]).toBeLessThan(0);
	});

	it('leaves out empty slots', () => {
		const f = figure();
		f.head.id = f.headgear.id = f.torso.id = f.legs.id = null;
		expect(placements(f)).toEqual([]);
	});
});

describe('short names', () => {
	it('drops the category, "Pattern" and stud notes', () => {
		expect(shortName('Head with Standard Grin Pattern (Hollow Stud)')).toBe('Standard Grin');
		expect(shortName('Torso with Vertical Striped Red/Blue Pattern')).toBe(
			'Vertical Striped Red/Blue'
		);
		expect(shortName('Hair Male')).toBe('Hair Male');
	});
	it('keeps the name when nothing would be left', () => {
		expect(shortName('Torso')).toBe('Torso');
	});
});
