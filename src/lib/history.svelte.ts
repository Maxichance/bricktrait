// Undo / redo for the portrait. Changes are grouped: a drag or a slider move
// is recorded once it settles, not at every step.
import { portrait, type Portrait } from './state.svelte';

const SETTLE_MS = 400;
const LIMIT = 200;

let past: string[] = [];
let future: string[] = [];
let current = '';
let timer: ReturnType<typeof setTimeout> | undefined;

export const history = $state({ canUndo: false, canRedo: false });

function sync() {
	history.canUndo = past.length > 0;
	history.canRedo = future.length > 0;
}

function apply(json: string) {
	current = json;
	const p: Portrait = JSON.parse(json);
	portrait.figure = p.figure;
	portrait.view = p.view;
	portrait.style = p.style;
}

/** Call from an effect that reads the whole portrait. */
export function track(snapshot: Portrait) {
	const json = JSON.stringify(snapshot);
	if (!current) current = json;
	if (json === current) return;
	clearTimeout(timer);
	timer = setTimeout(() => {
		timer = undefined;
		past.push(current);
		if (past.length > LIMIT) past.shift();
		future = [];
		current = json;
		sync();
	}, SETTLE_MS);
}

/** Records pending changes right away (before an undo, for instance). */
function flush() {
	if (timer === undefined) return;
	clearTimeout(timer);
	timer = undefined;
	const json = JSON.stringify($state.snapshot(portrait));
	if (json !== current) {
		past.push(current);
		future = [];
		current = json;
	}
}

export function undo() {
	flush();
	const prev = past.pop();
	if (prev === undefined) return;
	future.push(current);
	apply(prev);
	sync();
}

export function redo() {
	flush();
	const next = future.pop();
	if (next === undefined) return;
	past.push(current);
	apply(next);
	sync();
}
