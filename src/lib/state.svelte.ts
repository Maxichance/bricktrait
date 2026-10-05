import { STANDARD_LEGS, type Figure, type Part } from './ldraw';
import type { View } from './scene';
import { defaultStyle, type Style } from './compose';

export interface Portrait {
	figure: Figure;
	view: View;
	style: Style;
}

export const initial: Portrait = {
	figure: {
		head: { id: '3626cp01', color: 14 },
		headgear: { id: '3901', color: 6 },
		neck: { id: null, color: 6 },
		back: { id: null, color: 4 },
		torso: { id: '973p01', color: 15, arms: 4, hands: 14 },
		legs: { id: STANDARD_LEGS, color: 1, hips: 1 }
	},
	view: { yaw: 0, pitch: 0, zoom: 1 },
	style: { ...defaultStyle }
};

export const portrait: Portrait = $state(structuredClone(initial));

// Colours that make sense on a minifig, most common first
export const COMMON_COLORS = [
	14, 78, 84, 92, 70, 308, 15, 0, 72, 71, 4, 320, 1, 272, 73, 321, 322, 2, 288, 378, 27, 19, 28, 6,
	25, 484, 191, 226, 29, 26, 85, 379, 330, 297, 179, 383, 334, 47
];

// --- share links ----------------------------------------------------------

export function toHash(p: Portrait) {
	const json = JSON.stringify([p.figure, p.view, p.style]);
	return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

export function fromHash(hash: string): Portrait | null {
	try {
		const b64 = hash.replace(/^#/, '').replaceAll('-', '+').replaceAll('_', '/');
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const [figure, view, style] = JSON.parse(new TextDecoder().decode(bytes));
		if (!figure?.head || !figure?.torso) return null;
		return {
			// Links made before some slots existed get them empty
			figure: {
				...structuredClone(initial.figure),
				neck: { id: null, color: 6 },
				back: { id: null, color: 4 },
				legs: { ...initial.figure.legs },
				...figure
			},
			view: { ...initial.view, ...view },
			style: { ...initial.style, ...style }
		};
	} catch {
		return null;
	}
}

// --- random figure --------------------------------------------------------

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function randomize(catalog: Part[]) {
	const of = (cat: string) => catalog.filter((p) => p.cat === cat);
	const skin = [14, 14, 14, 78, 84, 92, 70];
	const torso = pick(of('torso'));
	// Printed heads have faces, plain ones would look empty
	const head = pick(of('head').filter((p) => /pattern/i.test(p.name)));
	// Moulded heads are complete on their own
	const wear = head.moulded === undefined && Math.random() < 0.9 ? pick(of('headgear')) : null;
	const colors = COMMON_COLORS.slice(6, 30);
	portrait.figure = {
		head: { id: head.id, color: pick(skin) },
		headgear: { id: wear?.id ?? null, color: pick(colors) },
		neck: { id: Math.random() < 0.2 ? pick(of('neck')).id : null, color: pick(colors) },
		back: { id: Math.random() < 0.2 ? pick(of('back')).id : null, color: pick(colors) },
		torso: { id: torso.id, color: pick(colors), arms: pick(colors), hands: pick(skin) },
		legs:
			Math.random() < 0.6
				? { id: STANDARD_LEGS, color: pick(colors), hips: pick(colors) }
				: { id: pick(of('legs')).id, color: pick(colors), hips: pick(colors) }
	};
}
