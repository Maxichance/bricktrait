// Undo / redo for the portrait. Changes are grouped: while a pointer holds the
// portrait or a slider, nothing is recorded; the whole gesture becomes one step
// when it is released, however slow the machine renders. Other changes are
// recorded once they settle.
import { portrait, type Portrait } from './state.svelte';

const SETTLE_MS = 400;
const LIMIT = 200;

let past: string[] = [];
let future: string[] = [];
let current = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let held = 0;

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

function commit() {
	clearTimeout(timer);
	timer = undefined;
	const json = JSON.stringify($state.snapshot(portrait));
	if (json === current) return;
	past.push(current);
	if (past.length > LIMIT) past.shift();
	future = [];
	current = json;
	sync();
}

/** Call from an effect that reads the whole portrait. */
export function track(snapshot: Portrait) {
	const json = JSON.stringify(snapshot);
	if (!current) current = json;
	if (json === current || held) return;
	clearTimeout(timer);
	timer = setTimeout(commit, SETTLE_MS);
}

/** A gesture starts (pointer down on the portrait or a slider): hold the recording. */
export function hold() {
	held++;
	clearTimeout(timer);
}

/** The gesture ends: what it changed becomes a single step. */
export function release() {
	if (!held) return;
	held--;
	if (!held) commit();
}

export function undo() {
	if (!held) commit();
	const prev = past.pop();
	if (prev === undefined) return;
	future.push(current);
	apply(prev);
	sync();
}

export function redo() {
	if (!held) commit();
	const next = future.pop();
	if (next === undefined) return;
	past.push(current);
	apply(next);
	sync();
}
