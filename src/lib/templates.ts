// Ready-made figures to start from. Generic characters only: no licensed names.
import { STANDARD_LEGS, STANDING, type Figure, type Pose } from './ldraw';

type Slot = { id: string | null; color: number };
const none = (color = 71): Slot => ({ id: null, color });

const figure = (f: {
	head: Slot;
	headgear?: Slot;
	neck?: Slot;
	back?: Slot;
	torso: Slot & { arms?: number; hands?: number };
	legs: { color: number; hips?: number; id?: string };
	handR?: Slot;
	handL?: Slot;
	pose?: Partial<Pose>;
}): Figure => ({
	head: f.head,
	headgear: f.headgear ?? none(),
	neck: f.neck ?? none(6),
	back: f.back ?? none(4),
	torso: { arms: f.torso.color, hands: 14, ...f.torso },
	legs: { id: f.legs.id ?? STANDARD_LEGS, color: f.legs.color, hips: f.legs.hips ?? f.legs.color },
	handR: { spin: 0, ...(f.handR ?? none()) },
	handL: { spin: 0, ...(f.handL ?? none()) },
	pose: { ...STANDING, ...f.pose }
});

export const TEMPLATES: { id: string; en: string; fr: string; figure: Figure }[] = [
	{
		id: 'knight',
		en: 'Knight',
		fr: 'Chevalier',
		figure: figure({
			head: { id: '3626cpq0', color: 14 },
			headgear: { id: '89520', color: 71 },
			torso: { id: '973p41', color: 71 },
			legs: { color: 72 },
			handR: { id: '3847', color: 71 },
			handL: { id: '2586', color: 4 },
			pose: { armR: 25 }
		})
	},
	{
		id: 'astronaut',
		en: 'Astronaut',
		fr: 'Astronaute',
		figure: figure({
			head: { id: '3626cp01', color: 14 },
			headgear: { id: '3842b', color: 4 },
			back: { id: '3838', color: 72 },
			torso: { id: '973p90', color: 4 },
			legs: { color: 4 }
		})
	},
	{
		id: 'pirate',
		en: 'Pirate',
		fr: 'Pirate',
		figure: figure({
			head: { id: '3626cp72', color: 14 },
			headgear: { id: '2528a', color: 0 },
			torso: { id: '76382p3c', color: 15 },
			legs: { color: 70, hips: 0 },
			handR: { id: '2530', color: 71 },
			pose: { armR: 35 }
		})
	},
	{
		id: 'wizard',
		en: 'Wizard',
		fr: 'Sorcier',
		figure: figure({
			head: { id: '3626cpbb', color: 78 },
			headgear: { id: '6131', color: 272 },
			neck: { id: '60750', color: 15 },
			torso: { id: '973', color: 272 },
			legs: { color: 272 },
			handR: { id: '95049', color: 70 },
			pose: { armR: 15 }
		})
	},
	{
		id: 'chef',
		en: 'Chef',
		fr: 'Chef cuisinier',
		figure: figure({
			head: { id: '3626bp7g', color: 14 },
			headgear: { id: '3898', color: 15 },
			torso: { id: '973p8t', color: 15 },
			legs: { color: 0 },
			handR: { id: '4528', color: 0 },
			pose: { armR: 40 }
		})
	},
	{
		id: 'police',
		en: 'Police officer',
		fr: 'Policier',
		figure: figure({
			head: { id: '3626cp01', color: 14 },
			headgear: { id: '3624', color: 0 },
			torso: { id: '76382p76', color: 0 },
			legs: { color: 0 },
			handL: { id: '3962b', color: 0 }
		})
	},
	{
		id: 'explorer',
		en: 'Explorer',
		fr: 'Explorateur',
		figure: figure({
			head: { id: '3626cp72', color: 14 },
			headgear: { id: '3629', color: 19 },
			torso: { id: '76382pa6', color: 19 },
			legs: { color: 28 },
			handR: { id: '3959', color: 70 },
			pose: { armR: 60 }
		})
	},
	{
		id: 'robot',
		en: 'Robot',
		fr: 'Robot',
		figure: figure({
			head: { id: '3626cp8p', color: 71 },
			torso: { id: '973pc67', color: 71, arms: 72, hands: 71 },
			legs: { color: 72 }
		})
	}
];
