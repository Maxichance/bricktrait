import { Group, LineSegments, Mesh } from 'three';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { asset } from '$app/paths';

export type Category = 'head' | 'headgear' | 'torso' | 'legs' | 'body';

export interface Part {
	id: string;
	name: string;
	cat: Category;
	/** headgear only: Hair, Hat, Helmet... */
	kind?: string;
	/** torso only: arms are part of the torso */
	arms?: boolean;
	/** head only: moulded head with its origin at the neck; value is its top (y) */
	neck?: number;
}

export interface Color {
	code: number;
	name: string;
	hex: string;
	alpha?: boolean;
	finish?: string;
}

/** Where a part goes on the minifig, in LDraw units (y points down). */
export interface Placement {
	id: string;
	color: number;
	at?: [number, number, number];
	/** 3x3 rotation matrix, row major */
	m?: number[];
}

const LIB = asset('ldraw/catalog.json').replace(/catalog\.json$/, '');
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

class Library {
	private loader = new LDrawLoader();
	private packs = new Map<string, Promise<string>>();
	private ready: Promise<void> | null = null;
	catalog: Part[] = [];
	colors: Color[] = [];

	init() {
		this.ready ??= (async () => {
			this.loader.setPartsLibraryPath(LIB);
			this.loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
			const [catalog, colors, core] = await Promise.all([
				fetch(`${LIB}catalog.json`).then((r) => r.json()),
				fetch(`${LIB}colors.json`).then((r) => r.json()),
				fetch(`${LIB}core.ldr`).then((r) => r.text()),
				this.loader.preloadMaterials(`${LIB}LDConfig.ldr`)
			]);
			this.catalog = catalog;
			this.colors = colors;
			// Parsing the core pack puts its files in the loader cache
			await this.parse(core);
		})();
		return this.ready;
	}

	private parse(text: string) {
		return new Promise<Group>((resolve, reject) => this.loader.parse(text, resolve, reject));
	}

	private pack(id: string) {
		let text = this.packs.get(id);
		if (!text) {
			text = fetch(`${LIB}p/${encodeURIComponent(id)}.ldr`).then((r) => {
				if (!r.ok) throw new Error(`Part ${id} not found`);
				return r.text();
			});
			text.catch(() => this.packs.delete(id));
			this.packs.set(id, text);
		}
		return text;
	}

	/** Builds a model from placed parts. Edge lines are dropped, they look wrong at portrait size. */
	async build(placements: Placement[]) {
		await this.init();
		const packs = await Promise.all(placements.map((p) => this.pack(p.id)));
		const lines = placements.map(({ id, color, at = [0, 0, 0], m = IDENTITY }) =>
			['1', color, ...at, ...m, `${id}.dat`].join(' ')
		);
		const text = `0 FILE model.ldr\n${lines.join('\n')}\n${packs.join('')}`;
		const group = await this.parse(text);
		group.traverse((o) => {
			if (o instanceof LineSegments) o.visible = false;
			if (o instanceof Mesh) {
				o.castShadow = o.receiveShadow = true;
				// LDraw materials are very glossy; the look we want is closer to matte
				for (const m of [o.material].flat())
					if ('roughness' in m) m.roughness = Math.max(m.roughness, 0.72);
			}
		});
		// LDraw is y-down
		group.rotation.x = Math.PI;
		return group;
	}
}

export const library = new Library();

// Standard minifig assembly, from the LDraw torso shortcuts (e.g. 12896.dat)
const ARM_RIGHT = { at: [-15.552, 9, 0], m: [0.985, -0.17, 0, 0.17, 0.985, 0, 0, 0, 1] } as const;
const ARM_LEFT = { at: [15.552, 9, 0], m: [0.985, 0.17, 0, -0.17, 0.985, 0, 0, 0, 1] } as const;
const HAND_RIGHT = {
	at: [-23.6904, 26.774, -9.8982],
	m: [0.985, -0.1202, 0.1202, 0.17, 0.6964, -0.6964, 0, 0.707, 0.707]
} as const;
const HAND_LEFT = {
	at: [23.6904, 26.774, -9.8982],
	m: [0.985, 0.1202, -0.1202, -0.17, 0.6964, -0.6964, 0, 0.707, 0.707]
} as const;
const HEAD = [0, -24, 0] as [number, number, number];
const HIPS = [0, 32, 0] as [number, number, number];
const LEGS = [0, 44, 0] as [number, number, number];

/** Legs id for plain hips and legs with their own colours */
export const STANDARD_LEGS = 'standard';

export interface Figure {
	head: { id: string; color: number };
	headgear: { id: string | null; color: number };
	torso: { id: string; color: number; arms: number; hands: number };
	/** `color` is the legs colour, `hips` only applies to STANDARD_LEGS */
	legs: { id: string | null; color: number; hips: number };
}

export function placements(fig: Figure, torso?: Part, head?: Part): Placement[] {
	// Moulded heads sit on the torso as is, headgear goes on their top
	const moulded = head?.neck !== undefined;
	const list: Placement[] = [
		{ id: fig.torso.id, color: fig.torso.color },
		{ id: fig.head.id, color: fig.head.color, at: moulded ? [0, 0, 0] : [...HEAD] }
	];
	if (fig.headgear.id) {
		const at: [number, number, number] = moulded ? [0, head!.neck!, 0] : [...HEAD];
		list.push({ id: fig.headgear.id, color: fig.headgear.color, at });
	}
	if (fig.legs.id === STANDARD_LEGS) {
		list.push(...standardLegs(fig.legs.hips, fig.legs.color));
	} else if (fig.legs.id) {
		list.push({ id: fig.legs.id, color: fig.legs.color, at: HIPS });
	}
	if (!torso?.arms) {
		list.push(
			{ id: '3818', color: fig.torso.arms, ...copy(ARM_RIGHT) },
			{ id: '3819', color: fig.torso.arms, ...copy(ARM_LEFT) },
			{ id: '3820', color: fig.torso.hands, ...copy(HAND_RIGHT) },
			{ id: '3820', color: fig.torso.hands, ...copy(HAND_LEFT) }
		);
	}
	return list;
}

export function standardLegs(hips: number, legs: number): Placement[] {
	return [
		{ id: '3815', color: hips, at: [...HIPS] },
		{ id: '3816', color: legs, at: [...LEGS] },
		{ id: '3817', color: legs, at: [...LEGS] }
	];
}

function copy(p: { at: readonly number[]; m: readonly number[] }) {
	return { at: [...p.at] as [number, number, number], m: [...p.m] };
}
