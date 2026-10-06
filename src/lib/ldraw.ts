import { Group, LineSegments, Mesh } from 'three';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';

export type Category = 'head' | 'headgear' | 'neck' | 'back' | 'torso' | 'legs' | 'hand' | 'body';

export interface Part {
	id: string;
	name: string;
	cat: Category;
	/** filter group: Hair, Hat, Helmet, Beard, Cape... */
	kind?: string;
	/** torso only: arms are part of the torso */
	arms?: boolean;
	/** guessed from the name and LDraw keywords: Star Wars, Castle, City... */
	theme?: string;
	/** year the part was added to or last updated in the LDraw library */
	year?: number;
	/** head only: moulded head (origin at the neck), the value is its top (y) */
	moulded?: number;
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

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

class Library {
	/** URL of the generated parts folder, set by the app before the first use */
	base = '/ldraw/';
	private loader = new LDrawLoader();
	private packs = new Map<string, Promise<string>>();
	private ready: Promise<void> | null = null;
	catalog: Part[] = [];
	colors: Color[] = [];

	/** Called as the library files arrive: (done, total) */
	onprogress: ((done: number, total: number) => void) | null = null;

	/** Loads the catalogue, colours and shared files once; can be called again after a failure. */
	init() {
		this.ready ??= (async () => {
			this.loader.setPartsLibraryPath(this.base);
			this.loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
			const total = 5;
			let done = 0;
			const tick = <T>(p: Promise<T>) => p.then((v) => (this.onprogress?.(++done, total), v));
			const get = (file: string) =>
				fetch(this.base + file).then((r) => {
					if (!r.ok) throw new Error(`${file}: ${r.status}`);
					return r;
				});
			const [catalog, colors, core] = await Promise.all([
				tick(get('catalog.json').then((r) => r.json())),
				tick(get('colors.json').then((r) => r.json())),
				tick(get('core.ldr').then((r) => r.text())),
				tick(this.loader.preloadMaterials(`${this.base}LDConfig.ldr`))
			]);
			this.catalog = catalog;
			this.colors = colors;
			// Parsing the core pack puts its files in the loader cache
			await tick(this.parse(core));
		})();
		this.ready.catch(() => (this.ready = null));
		return this.ready;
	}

	private parse(text: string) {
		return new Promise<Group>((resolve, reject) => this.loader.parse(text, resolve, reject));
	}

	private pack(id: string) {
		let text = this.packs.get(id);
		if (!text) {
			text = fetch(`${this.base}p/${encodeURIComponent(id)}.ldr`).then((r) => {
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

/**
 * Short display name: "Head with Standard Grin Pattern (Hollow Stud)" -> "Standard Grin".
 * The full LDraw name stays available as a tooltip.
 */
export function shortName(name: string) {
	const short = name
		.replace(/\s*\((Hollow Stud|Solid Stud|Complete|Formed|Needs Work)\)/gi, '')
		.replace(/ Pattern\b/g, '')
		.replace(/^(Head|Torso|Hips and Legs|Hips) (with )?/, '')
		.trim();
	return short ? short[0].toUpperCase() + short.slice(1) : name;
}

// --- minifig assembly ------------------------------------------------------
// Standard offsets from the LDraw torso shortcuts (e.g. 12896.dat, 973c01.dat)

type Vec = [number, number, number];
type Mat = number[];
interface Pose3 {
	at: Vec;
	m: Mat;
}

const mul = (a: Mat, b: Mat): Mat =>
	[0, 1, 2].flatMap((i) =>
		[0, 1, 2].map((j) => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j])
	);
const apply = (m: Mat, v: readonly number[]): Vec => [
	m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
	m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
	m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
];
const transpose = (m: Mat): Mat => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const add = (a: readonly number[], b: readonly number[]): Vec => [
	a[0] + b[0],
	a[1] + b[1],
	a[2] + b[2]
];
const sub = (a: readonly number[], b: readonly number[]): Vec => [
	a[0] - b[0],
	a[1] - b[1],
	a[2] - b[2]
];
const rad = (deg: number) => (deg * Math.PI) / 180;
const rotX = (deg: number): Mat => {
	const [c, s] = [Math.cos(rad(deg)), Math.sin(rad(deg))];
	return [1, 0, 0, 0, c, -s, 0, s, c];
};
const rotY = (deg: number): Mat => {
	const [c, s] = [Math.cos(rad(deg)), Math.sin(rad(deg))];
	return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const rotZ = (deg: number): Mat => {
	const [c, s] = [Math.cos(rad(deg)), Math.sin(rad(deg))];
	return [c, -s, 0, s, c, 0, 0, 0, 1];
};
/** `child` expressed in `parent`'s frame, so it can follow the parent when it moves */
const relative = (parent: Pose3, child: Pose3): Pose3 => ({
	at: apply(transpose(parent.m), sub(child.at, parent.at)),
	m: mul(transpose(parent.m), child.m)
});
const compose = (parent: Pose3, local: Pose3): Pose3 => ({
	at: add(parent.at, apply(parent.m, local.at)),
	m: mul(parent.m, local.m)
});

const ARM_RIGHT: Pose3 = { at: [-15.552, 9, 0], m: [0.985, -0.17, 0, 0.17, 0.985, 0, 0, 0, 1] };
const ARM_LEFT: Pose3 = { at: [15.552, 9, 0], m: [0.985, 0.17, 0, -0.17, 0.985, 0, 0, 0, 1] };
const HAND_RIGHT: Pose3 = {
	at: [-23.6904, 26.774, -9.8982],
	m: [0.985, -0.1202, 0.1202, 0.17, 0.6964, -0.6964, 0, 0.707, 0.707]
};
const HAND_LEFT: Pose3 = {
	at: [23.6904, 26.774, -9.8982],
	m: [0.985, 0.1202, -0.1202, -0.17, 0.6964, -0.6964, 0, 0.707, 0.707]
};
// Hands in their arm's frame: they follow the arm when it swings
const HAND_IN_ARM = { right: relative(ARM_RIGHT, HAND_RIGHT), left: relative(ARM_LEFT, HAND_LEFT) };
const HEAD: Vec = [0, -24, 0];
const HIPS: Vec = [0, 32, 0];
const LEGS: Vec = [0, 44, 0];

// The grip of 3820.dat is the axis through its two ring primitives; held
// accessories have their bar along Y through their origin.
const RING_A = [0, 4.502, -8.518];
const RING_B = [0, -6.1478, -11.2716];
const GRIP: Vec = [0, (RING_A[1] + RING_B[1]) / 2, (RING_A[2] + RING_B[2]) / 2];
const AXIS = (() => {
	const d = sub(RING_B, RING_A);
	const n = Math.hypot(...d);
	return d.map((v) => v / n);
})();
// Columns: X stays X, Y against the ring A to B direction (so a sword's blade,
// along -Y, points forward out of the fist), Z = X × Y
const TO_GRIP: Mat = [1, 0, 0, 0, -AXIS[1], AXIS[2], 0, -AXIS[2], -AXIS[1]];

/** Legs id for plain hips and legs with their own colours */
export const STANDARD_LEGS = 'standard';

/** Joint angles in degrees, all 0 for the standard standing pose */
export interface Pose {
	/** turns the head (and headgear) left or right */
	head: number;
	/** swings an arm forward (positive) or back at the shoulder */
	armR: number;
	armL: number;
	/** turns a hand around the wrist */
	wristR: number;
	wristL: number;
	/** swings a standard leg at the hip, forward is positive */
	legR: number;
	legL: number;
}

export const STANDING: Pose = { head: 0, armR: 0, armL: 0, wristR: 0, wristL: 0, legR: 0, legL: 0 };

/** Every slot can be emptied: `id: null` */
export interface Figure {
	head: { id: string | null; color: number };
	headgear: { id: string | null; color: number };
	/** beards, neckwear, armour, vests: clipped on the torso top */
	neck: { id: string | null; color: number };
	/** capes, backpacks, airtanks, wings: clipped on the torso top too */
	back: { id: string | null; color: number };
	/** arms and hands are added when the torso has none of its own */
	torso: { id: string | null; color: number; arms: number; hands: number };
	/** `color` is the legs colour, `hips` only applies to STANDARD_LEGS */
	legs: { id: string | null; color: number; hips: number };
	/** held accessories; `spin` turns them around the grip, in degrees */
	handR: { id: string | null; color: number; spin: number };
	handL: { id: string | null; color: number; spin: number };
	pose: Pose;
}

const place = (id: string, color: number, p: Pose3): Placement => ({
	id,
	color,
	at: [...p.at],
	m: [...p.m]
});

export function placements(fig: Figure, torso?: Part, head?: Part): Placement[] {
	const pose = { ...STANDING, ...fig.pose };
	const list: Placement[] = [];
	// Moulded heads sit on the torso as is, headgear goes on their top
	const moulded = head?.moulded !== undefined;
	const turn = rotY(pose.head);
	if (fig.torso.id) list.push({ id: fig.torso.id, color: fig.torso.color });
	if (fig.head.id) {
		list.push(place(fig.head.id, fig.head.color, { at: moulded ? [0, 0, 0] : HEAD, m: turn }));
	}
	if (fig.headgear.id) {
		const at: Vec = moulded ? [0, head!.moulded!, 0] : HEAD;
		list.push(place(fig.headgear.id, fig.headgear.color, { at, m: turn }));
	}
	for (const slot of [fig.neck, fig.back])
		if (slot.id) list.push({ id: slot.id, color: slot.color });
	if (fig.legs.id === STANDARD_LEGS) {
		list.push(...standardLegs(fig.legs.hips, fig.legs.color, pose.legR, pose.legL));
	} else if (fig.legs.id) {
		list.push({ id: fig.legs.id, color: fig.legs.color, at: [...HIPS] });
	}
	if (!fig.torso.id) return list;

	// Arms swing around the shoulder pin (their X axis); hands and what they hold
	// follow. Torsos that come with their own arms keep the standard hands.
	const own = !!torso?.arms;
	for (const side of ['right', 'left'] as const) {
		const R = side === 'right';
		const armRest = R ? ARM_RIGHT : ARM_LEFT;
		const arm: Pose3 = own
			? armRest
			: { at: armRest.at, m: mul(armRest.m, rotX(-(R ? pose.armR : pose.armL))) };
		const hand0 = own ? (R ? HAND_RIGHT : HAND_LEFT) : compose(arm, HAND_IN_ARM[side]);
		// The wrist peg runs along the hand's Z axis
		const hand: Pose3 = own
			? hand0
			: { at: hand0.at, m: mul(hand0.m, rotZ(R ? pose.wristR : pose.wristL)) };
		if (!own) {
			list.push(place(R ? '3818' : '3819', fig.torso.arms, arm));
			list.push(place('3820', fig.torso.hands, hand));
		}
		const item = R ? fig.handR : fig.handL;
		if (item.id) {
			const grip = compose(hand, { at: GRIP, m: mul(TO_GRIP, rotY(item.spin)) });
			list.push(place(item.id, item.color, grip));
		}
	}
	return list;
}

export function standardLegs(hips: number, legs: number, legR = 0, legL = 0): Placement[] {
	// Legs swing around the hip pin, along X through their origin
	return [
		{ id: '3815', color: hips, at: [...HIPS] },
		{ id: '3816', color: legs, at: [...LEGS], m: rotX(-legR) },
		{ id: '3817', color: legs, at: [...LEGS], m: rotX(-legL) }
	];
}
