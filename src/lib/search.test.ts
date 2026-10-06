import { describe, expect, it } from 'vitest';
import type { Part } from './ldraw';
import { normalize, search } from './search';

const part = (id: string, name: string, extra: Partial<Part> = {}): Part => ({
	id,
	name,
	cat: 'head',
	...extra
});
const parts = [
	part('a', 'Head with Standard Grin Pattern'),
	part('b', 'Hair Beard Long', { cat: 'neck', kind: 'Beard' }),
	part('c', 'Moustache Curly', { cat: 'neck', kind: 'Beard' }),
	part('d', 'Torso with Pirate Vest', { cat: 'torso', theme: 'Pirates' }),
	part('e', 'Cap with Long Flat Peak', { cat: 'headgear', kind: 'Cap' }),
	part('3626cp01', 'Head with Smile')
];
const ids = (q: string) => search(parts, q).map((p) => p.id);

describe('search', () => {
	it('returns everything for an empty query', () => {
		expect(ids('  ')).toEqual(['a', 'b', 'c', 'd', 'e', '3626cp01']);
	});
	it('ignores case and accents', () => {
		expect(normalize('Tête Élégante')).toBe('tete elegante');
		// "grin" also finds "smile", ranked after the exact match
		expect(ids('GRIN')).toEqual(['a', '3626cp01']);
	});
	it('matches plurals', () => {
		expect(ids('pirates')).toEqual(['d']);
	});
	it('matches synonyms', () => {
		expect(ids('beard')).toEqual(['b', 'c']);
		expect(ids('smile')).toEqual(['3626cp01', 'a']);
	});
	it('forgives one typo', () => {
		expect(ids('moustach')).toEqual(['c']);
		expect(ids('pirtae')).toEqual(['d']);
	});
	it('needs every word', () => {
		expect(ids('long cap')).toEqual(['e']);
	});
	it('finds part numbers and themes', () => {
		expect(ids('3626cp01')).toEqual(['3626cp01']);
		expect(ids('pirate')).toEqual(['d']);
	});
});
