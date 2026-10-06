// Interface strings in English and French. Part names stay in English: they are
// the LDraw names, and search understands them.
import { prefs, setLang } from './prefs.svelte';

export const LANGS = { en: 'English', fr: 'Français' } as const;
export type Lang = keyof typeof LANGS;

const en = {
	tagline: 'Minifig portraits from real parts',
	undo: 'Undo',
	redo: 'Redo',
	star: 'Star it on GitHub',
	download: 'Download',
	size: 'Image size',
	random: 'Random',
	share: 'Share',
	copied: 'Copied',
	camera: 'Camera',
	turn: 'Turn',
	tilt: 'Tilt',
	zoom: 'Zoom',
	scene: 'Scene',
	background: 'Background',
	space: 'Space',
	solid: 'Solid',
	transparent: 'Transparent',
	disc: 'Disc',
	fill: 'Fill',
	ring: 'Ring',
	showRing: 'Show ring',
	retro: 'Retro blur',
	keys: '{slots} slots · {del} remove · {undo} undo · drag the portrait to turn it',
	startOver: 'start over',
	credits:
		'Parts from the {ldraw} library by its contributors, {ccby} · {credits}. LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this site.',
	creditsLink: 'credits',
	loading: 'Loading the parts library…',
	loadFailed: 'Could not load the parts library ({error}).',
	retry: 'Retry',
	partsFailed: 'Some parts did not load: {error}',
	noWebgl:
		'Your browser cannot draw 3D (WebGL is off or not supported). Try another browser, or turn on hardware acceleration in its settings.',
	legsHint: 'Legs show when you zoom out.',
	empty: 'Empty',
	remove: 'Remove {slot}',
	// slots
	headgear: 'Headgear',
	head: 'Head',
	neck: 'Neck',
	back: 'Back',
	torso: 'Torso',
	legs: 'Legs',
	handR: 'Right hand',
	handL: 'Left hand',
	spin: 'Turn in hand',
	// colours
	colour: 'Colour',
	skin: 'Skin',
	arms: 'Arms',
	hands: 'Hands',
	hips: 'Hips',
	allColours: 'All {n}',
	commonColours: 'Common colours',
	colourOf: 'Colour of',
	// picker
	search: 'Name, theme or part number',
	searchLabel: 'Search parts',
	all: 'All',
	favourites: 'Favourites',
	recent: 'Recent',
	allThemes: 'All themes',
	theme: 'Theme',
	type: 'Type',
	sort: 'Sort',
	sortClassic: 'Classic first',
	sortName: 'A to Z',
	sortNew: 'Newest',
	printed: 'Printed only',
	withArms: 'With own arms',
	nothing: 'Nothing matches.',
	noFavourites: 'No favourites yet: hover a part and click its star.',
	noRecent: 'Parts you pick show up here.',
	favourite: 'Add to favourites',
	unfavourite: 'Remove from favourites',
	standardLegs: 'Standard hips and legs',
	preview:
		'Portrait preview. Drag or use the arrow keys to turn, scroll or pinch to zoom, double click to reset.',
	language: 'Language',
	pose: 'Pose',
	poseHead: 'Head',
	poseArmR: 'Right arm',
	poseArmL: 'Left arm',
	poseWristR: 'Right wrist',
	poseWristL: 'Left wrist',
	poseLegR: 'Right leg',
	poseLegL: 'Left leg',
	presetStand: 'Stand',
	presetWave: 'Wave',
	presetWalk: 'Walk',
	presetSit: 'Sit',
	presetCheer: 'Cheer',
	poseAdvanced: 'Advanced settings',
	poseAdvancedHint: 'Moves a real minifig cannot make.',
	poseRaiseR: 'Raise right arm',
	poseRaiseL: 'Raise left arm',
	poseSpreadR: 'Spread right leg',
	poseSpreadL: 'Spread left leg',
	gradient: 'Gradient',
	image: 'Image',
	top: 'Top',
	bottom: 'Bottom',
	importImage: 'Import an image',
	imageNote: 'Imported images stay on your device and are not part of share links.',
	shape: 'Shape',
	round: 'Round',
	square: 'Square',
	outline: 'Sticker outline',
	format: 'Format',
	copyImage: 'Copy image',
	imageCopied: 'Image copied',
	copyFailed: 'Copy is not allowed here, use Download.',
	exportOptions: 'Export options',
	ringPreset: 'Ring colour'
};

type Key = keyof typeof en;

const fr: Record<Key, string> = {
	tagline: 'Des portraits de minifig avec de vraies pièces',
	undo: 'Annuler',
	redo: 'Rétablir',
	star: 'Mettre une étoile sur GitHub',
	download: 'Télécharger',
	size: "Taille de l'image",
	random: 'Au hasard',
	share: 'Partager',
	copied: 'Copié',
	camera: 'Caméra',
	turn: 'Rotation',
	tilt: 'Inclinaison',
	zoom: 'Zoom',
	scene: 'Scène',
	background: 'Fond',
	space: 'Espace',
	solid: 'Uni',
	transparent: 'Transparent',
	disc: 'Disque',
	fill: 'Fond',
	ring: 'Anneau',
	showRing: "Afficher l'anneau",
	retro: 'Flou rétro',
	keys: '{slots} emplacements · {del} retirer · {undo} annuler · faites glisser le portrait pour le tourner',
	startOver: 'tout recommencer',
	credits:
		"Pièces de la bibliothèque {ldraw}, par ses contributeurs, {ccby} · {credits}. LEGO® est une marque du groupe LEGO, qui ne parraine, n'autorise ni ne soutient ce site.",
	creditsLink: 'crédits',
	loading: 'Chargement de la bibliothèque de pièces…',
	loadFailed: 'Impossible de charger la bibliothèque de pièces ({error}).',
	retry: 'Réessayer',
	partsFailed: 'Certaines pièces ne se sont pas chargées : {error}',
	noWebgl:
		"Votre navigateur ne peut pas afficher la 3D (WebGL désactivé ou non pris en charge). Essayez un autre navigateur, ou activez l'accélération matérielle dans ses réglages.",
	legsHint: 'Les jambes apparaissent quand on dézoome.',
	empty: 'Vide',
	remove: 'Retirer : {slot}',
	headgear: 'Coiffe',
	head: 'Tête',
	neck: 'Cou',
	back: 'Dos',
	torso: 'Torse',
	legs: 'Jambes',
	handR: 'Main droite',
	handL: 'Main gauche',
	spin: 'Rotation dans la main',
	colour: 'Couleur',
	skin: 'Peau',
	arms: 'Bras',
	hands: 'Mains',
	hips: 'Hanches',
	allColours: 'Les {n}',
	commonColours: 'Couleurs courantes',
	colourOf: 'Couleur de',
	search: 'Nom, thème ou numéro de pièce',
	searchLabel: 'Chercher une pièce',
	all: 'Tout',
	favourites: 'Favoris',
	recent: 'Récents',
	allThemes: 'Tous les thèmes',
	theme: 'Thème',
	type: 'Type',
	sort: 'Tri',
	sortClassic: "Classiques d'abord",
	sortName: 'De A à Z',
	sortNew: 'Plus récentes',
	printed: 'Imprimées seulement',
	withArms: 'Avec leurs bras',
	nothing: 'Aucune pièce ne correspond.',
	noFavourites: "Pas encore de favoris : survolez une pièce et cliquez sur l'étoile.",
	noRecent: 'Les pièces que vous choisissez apparaissent ici.',
	favourite: 'Ajouter aux favoris',
	unfavourite: 'Retirer des favoris',
	standardLegs: 'Hanches et jambes standard',
	preview:
		'Aperçu du portrait. Faites glisser ou utilisez les flèches pour tourner, la molette ou deux doigts pour zoomer, double-clic pour réinitialiser.',
	language: 'Langue',
	pose: 'Pose',
	poseHead: 'Tête',
	poseArmR: 'Bras droit',
	poseArmL: 'Bras gauche',
	poseWristR: 'Poignet droit',
	poseWristL: 'Poignet gauche',
	poseLegR: 'Jambe droite',
	poseLegL: 'Jambe gauche',
	presetStand: 'Debout',
	presetWave: 'Salut',
	presetWalk: 'Marche',
	presetSit: 'Assis',
	presetCheer: 'Victoire',
	poseAdvanced: 'Réglages avancés',
	poseAdvancedHint: 'Des mouvements impossibles pour une vraie figurine.',
	poseRaiseR: 'Lever le bras droit',
	poseRaiseL: 'Lever le bras gauche',
	poseSpreadR: 'Écarter la jambe droite',
	poseSpreadL: 'Écarter la jambe gauche',
	gradient: 'Dégradé',
	image: 'Image',
	top: 'Haut',
	bottom: 'Bas',
	importImage: 'Importer une image',
	imageNote:
		'Les images importées restent sur votre appareil et ne sont pas dans les liens partagés.',
	shape: 'Forme',
	round: 'Ronde',
	square: 'Carrée',
	outline: 'Contour autocollant',
	format: 'Format',
	copyImage: "Copier l'image",
	imageCopied: 'Image copiée',
	copyFailed: 'Copie impossible ici, utilisez Télécharger.',
	exportOptions: "Options d'export",
	ringPreset: "Couleur de l'anneau"
};

// Filter groups and themes, as found in the catalogue
const NAMES_FR: Record<string, string> = {
	Hair: 'Cheveux',
	Cap: 'Casquettes',
	Helmet: 'Casques',
	Hood: 'Capuches',
	Hat: 'Chapeaux',
	Headdress: 'Coiffes',
	Beard: 'Barbes',
	Neckwear: 'Foulards',
	Armour: 'Armures',
	Vest: 'Gilets',
	Cape: 'Capes',
	Pack: 'Sacs',
	Wings: 'Ailes',
	Weapon: 'Armes',
	Shield: 'Boucliers',
	Tool: 'Outils',
	Food: 'Nourriture',
	Music: 'Musique',
	Gear: 'Objets',
	'Super Heroes': 'Super-héros',
	'Games & TV': 'Jeux et séries',
	Monsters: 'Monstres',
	'Lord of the Rings': 'Le Seigneur des anneaux',
	Castle: 'Château',
	Pirates: 'Pirates',
	Space: 'Espace',
	City: 'Ville',
	Western: 'Far West',
	Adventurers: 'Aventuriers',
	Sports: 'Sports'
};

const browserLang = (): Lang =>
	typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')
		? 'fr'
		: 'en';

export const i18n = $state({
	lang: (prefs.lang && prefs.lang in LANGS ? prefs.lang : browserLang()) as Lang
});

export function changeLang(lang: Lang) {
	i18n.lang = lang;
	setLang(lang);
	if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Translated string, with {name} placeholders filled from `params` */
export function t(key: Key, params: Record<string, string | number> = {}) {
	const text = (i18n.lang === 'fr' ? fr : en)[key];
	return text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/** Kind and theme names */
export const tn = (name: string) => (i18n.lang === 'fr' ? (NAMES_FR[name] ?? name) : name);

/** A translated string cut around its {placeholders}, to render them as markup */
export function pieces(key: Key): { text?: string; slot?: string }[] {
	const text = (i18n.lang === 'fr' ? fr : en)[key];
	return text
		.split(/(\{\w+\})/)
		.filter(Boolean)
		.map((p) => (p.startsWith('{') ? { slot: p.slice(1, -1) } : { text: p }));
}
