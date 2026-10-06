// Forgiving part search: accents and case are ignored, plurals and close
// synonyms match, and one typo is allowed in words of 4 letters or more.
import type { Part } from './ldraw';

const SYNONYMS: Record<string, string[]> = {
	beard: ['moustache', 'mustache', 'goatee'],
	moustache: ['beard', 'mustache'],
	hat: ['cap', 'helmet', 'crown', 'hood'],
	cap: ['hat'],
	helmet: ['hat'],
	hair: ['hairstyle', 'ponytail', 'bun'],
	girl: ['female'],
	woman: ['female'],
	boy: ['male'],
	man: ['male'],
	face: ['head'],
	smile: ['grin', 'smiling'],
	grin: ['smile'],
	angry: ['scowl', 'frown'],
	glasses: ['goggles', 'sunglasses', 'spectacles'],
	shirt: ['torso', 'jacket'],
	jacket: ['coat', 'vest'],
	pants: ['legs', 'hips'],
	trousers: ['legs'],
	knight: ['armour', 'armor', 'castle'],
	armor: ['armour'],
	color: ['colour'],
	gray: ['grey'],
	cape: ['cloak'],
	robot: ['droid', 'android'],
	droid: ['robot']
};

export function normalize(text: string) {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** "pirates" -> "pirate", "glasses" stays "glasses" */
const stem = (word: string) =>
	word.length > 4 && word.endsWith('es') && !word.endsWith('sses')
		? word.slice(0, -2)
		: word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
			? word.slice(0, -1)
			: word;

/** At most one insertion, deletion, substitution or swap between a and b */
function close(a: string, b: string) {
	if (Math.abs(a.length - b.length) > 1) return false;
	let i = 0;
	while (i < a.length && a[i] === b[i]) i++;
	if (i === a.length && i === b.length) return true;
	if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return true;
	return (
		a.slice(i + 1) === b.slice(i + 1) ||
		a.slice(i) === b.slice(i + 1) ||
		a.slice(i + 1) === b.slice(i)
	);
}

const words = new WeakMap<Part, string[]>();
function wordsOf(part: Part) {
	let list = words.get(part);
	if (!list) {
		const text = [part.name, part.id, part.kind, part.theme].filter(Boolean).join(' ');
		list = normalize(text).split(' ').map(stem);
		words.set(part, list);
	}
	return list;
}

/** 3 exact word, 2 word start, 1 synonym or typo, 0 no match */
function score(query: string, part: Part) {
	const ws = wordsOf(part);
	if (ws.includes(query)) return 3;
	if (ws.some((w) => w.startsWith(query))) return 2;
	const syn = SYNONYMS[query]?.map(stem) ?? [];
	if (ws.some((w) => syn.includes(w))) return 1;
	if (
		query.length >= 4 &&
		ws.some((w) => close(query, w) || close(query, w.slice(0, query.length)))
	)
		return 1;
	return 0;
}

/**
 * Parts matching every word of the query, best matches first; ties keep
 * the catalogue order. An empty query returns the list unchanged.
 */
export function search(parts: Part[], query: string) {
	const terms = normalize(query).split(' ').filter(Boolean).map(stem);
	if (!terms.length) return parts;
	const scored: { part: Part; score: number; index: number }[] = [];
	parts.forEach((part, index) => {
		let total = 0;
		for (const term of terms) {
			const s = score(term, part);
			if (!s) return;
			total += s;
		}
		scored.push({ part, score: total, index });
	});
	return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.part);
}
