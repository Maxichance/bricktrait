import { describe, expect, it } from 'vitest';
import { fromHash, initial, toHash } from './state.svelte';

const legacy = (value: unknown) =>
	btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

describe('share links', () => {
	it('round-trips a portrait', () => {
		const p = structuredClone(initial);
		p.figure.head.id = '26051p01';
		p.view.yaw = -20;
		p.style.ringColor = '#ff0000';
		expect(fromHash(`#${toHash(p)}`)).toEqual(p);
	});

	it('is much shorter than the plain JSON', () => {
		const plain = legacy([initial.figure, initial.view, initial.style]);
		expect(toHash(initial).length).toBeLessThan(plain.length * 0.75);
	});

	it('still opens links made before compression', () => {
		const old = legacy([initial.figure, initial.view, initial.style]);
		expect(fromHash(`#${old}`)?.figure.head.id).toBe(initial.figure.head.id);
	});

	it('fills slots that did not exist in older links', () => {
		const { neck, back, legs, ...rest } = initial.figure;
		(void neck, back, legs);
		const p = fromHash(`#${legacy([rest, initial.view, initial.style])}`);
		expect(p?.figure.neck.id).toBeNull();
		expect(p?.figure.back.id).toBeNull();
		expect(p?.figure.legs).toEqual(initial.figure.legs);
	});

	it('rejects garbage', () => {
		expect(fromHash('#not-a-portrait')).toBeNull();
		expect(fromHash('')).toBeNull();
	});
});
