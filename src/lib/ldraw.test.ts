import { describe, expect, it } from 'vitest';
import { placements, shortName, STANDARD_LEGS, STANDING, type Figure, type Part } from './ldraw';

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
