// Per-visitor conveniences kept in the browser: favourite parts, recently used
// parts, interface language. Storage can be missing (private mode, blocked
// site data): everything then works for the session only.

const KEY = 'bricktrait:prefs';
const RECENT_MAX = 30;

interface Stored {
	favourites: string[];
	recent: string[];
	lang?: string;
}

function load(): Stored {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		return {
			favourites: Array.isArray(raw.favourites) ? raw.favourites : [],
			recent: Array.isArray(raw.recent) ? raw.recent : [],
			lang: typeof raw.lang === 'string' ? raw.lang : undefined
		};
	} catch {
		return { favourites: [], recent: [] };
	}
}

export const prefs: Stored = $state(
	typeof localStorage === 'undefined' ? { favourites: [], recent: [] } : load()
);

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(prefs));
	} catch {
		// Storage unavailable: keep the in-memory value
	}
}

export const isFavourite = (id: string) => prefs.favourites.includes(id);

export function toggleFavourite(id: string) {
	prefs.favourites = isFavourite(id)
		? prefs.favourites.filter((f) => f !== id)
		: [id, ...prefs.favourites];
	save();
}

/** Most recent first, without duplicates */
export function used(id: string) {
	prefs.recent = [id, ...prefs.recent.filter((r) => r !== id)].slice(0, RECENT_MAX);
	save();
}

export function setLang(lang: string) {
	prefs.lang = lang;
	save();
}
