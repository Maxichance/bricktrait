// Builds the minifig parts used by the app from the LDraw library.
//
// Output (static/ldraw/, git-ignored):
//   core.ldr        files shared by many parts (primitives), loaded once
//   p/<id>.ldr      one pack per part with the rest of its dependencies
//   catalog.json    parts list for the UI
//   colors.json     LDraw colours
//   CREDITS.txt     authors of every file shipped, plus the library licences
import fs from 'node:fs';
import path from 'node:path';

const LDRAW = path.resolve(process.env.LDRAW_DIR ?? '.ldraw');
const OUT = path.resolve('static/ldraw');
// A file referenced by at least this many parts goes in core.ldr
const CORE_MIN_USES = Number(process.env.CORE_MIN_USES ?? 10);

const GROUPS = [
	{ cat: 'head', re: /^Minifig Head\b(?! ?(Modified|Cover))/ },
	{ cat: 'headgear', re: /^Minifig (Hair|Hat|Helmet|Headdress|Cap|Hood)\b/ },
	{ cat: 'torso', re: /^Minifig Torso\b/ },
	// Complete lower bodies: hips and legs, skirts, ghost hips...
	{ cat: 'legs', re: /^Minifig Hips\b/ }
];
// Plain arms, hands, hips and legs, used to assemble a standard minifig
const BODY = ['3818.dat', '3819.dat', '3820.dat', '3815.dat', '3816.dat', '3817.dat'];

// --- library access -------------------------------------------------------

const texts = new Map();
function read(key) {
	if (!texts.has(key)) texts.set(key, fs.readFileSync(path.join(LDRAW, key), 'utf8'));
	return texts.get(key);
}

// "S\Foo.DAT" -> { key: "parts/s/foo.dat", name: "parts/s/foo.dat" }
// `name` is what LDrawLoader turns the reference into, and therefore its cache key:
// "s/" becomes "parts/s/", "48/" becomes "p/48/", anything else is left as is.
const resolved = new Map();
function resolve(ref) {
	const rel = ref.toLowerCase().replaceAll('\\', '/');
	if (resolved.has(rel)) return resolved.get(rel);
	let hit = null;
	for (const dir of ['parts', 'p']) {
		if (fs.existsSync(path.join(LDRAW, dir, rel))) {
			const name = rel.startsWith('s/') ? `parts/${rel}` : rel.startsWith('48/') ? `p/${rel}` : rel;
			hit = { key: `${dir}/${rel}`, name };
			break;
		}
	}
	resolved.set(rel, hit);
	return hit;
}

// Vertical extent of a part (LDraw y points down)
function heightOf(name) {
	let top = Infinity;
	let bottom = -Infinity;
	(function walk(ref, m, t) {
		const r = resolve(ref);
		if (!r) return;
		for (const line of read(r.key).split('\n')) {
			const v = line.trim().split(/\s+/);
			if (v[0] === '1' && v.length >= 15) {
				const n = v.slice(2, 14).map(Number);
				const at = [
					m[0] * n[0] + m[1] * n[1] + m[2] * n[2] + t[0],
					m[3] * n[0] + m[4] * n[1] + m[5] * n[2] + t[1],
					m[6] * n[0] + m[7] * n[1] + m[8] * n[2] + t[2]
				];
				const r3 = n.slice(3);
				const mm = [0, 1, 2].flatMap((i) =>
					[0, 1, 2].map(
						(j) => m[i * 3] * r3[j] + m[i * 3 + 1] * r3[3 + j] + m[i * 3 + 2] * r3[6 + j]
					)
				);
				walk(v.slice(14).join(' '), mm, at);
			} else if (v[0] === '3' || v[0] === '4') {
				for (let i = 0; i < Number(v[0]); i++) {
					const [x, y, z] = v.slice(2 + i * 3, 5 + i * 3).map(Number);
					const Y = m[3] * x + m[4] * y + m[5] * z + t[1];
					top = Math.min(top, Y);
					bottom = Math.max(bottom, Y);
				}
			}
		}
	})(name, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0]);
	return { top, bottom };
}

function refsOf(text) {
	const refs = [];
	for (const line of text.split('\n')) {
		const t = line.trim().split(/\s+/);
		if (t[0] === '1' && t.length >= 15) refs.push(t.slice(14).join(' '));
	}
	return refs;
}

// Every file a part needs, by canonical name
function closure(name) {
	const seen = new Map();
	const stack = [name];
	while (stack.length) {
		const r = resolve(stack.pop());
		if (!r || seen.has(r.name)) continue;
		seen.set(r.name, r.key);
		stack.push(...refsOf(read(r.key)));
	}
	return seen;
}

// Drops blank lines and rewrites references to their canonical name so the
// loader always finds them in its cache.
function normalize(text) {
	return text
		.split(/\r?\n/)
		.filter((l) => l.trim())
		.map((l) => {
			const t = l.trim().split(/\s+/);
			if (t[0] !== '1' || t.length < 15) return l.trimEnd();
			const r = resolve(t.slice(14).join(' '));
			return r ? [...t.slice(0, 14), r.name].join(' ') : l.trimEnd();
		})
		.join('\n');
}

const header = (text) => text.slice(0, text.indexOf('\n')).replace(/^0\s+/, '').trim();
const pack = (names, closures) =>
	names.map((n) => `0 FILE ${n}\n${normalize(read(closures.get(n)))}\n`).join('');

// --- select parts ---------------------------------------------------------

const parts = [];
for (const file of fs.readdirSync(path.join(LDRAW, 'parts'))) {
	if (!file.endsWith('.dat')) continue;
	const desc = header(read(`parts/${file}`));
	if (/^[~=_|]/.test(desc) || /obsolete|moved to/i.test(desc)) continue;
	const group = GROUPS.find((g) => g.re.test(desc));
	if (!group) continue;
	const deps = closure(file);
	// LDrawLoader does not support textures
	if ([...deps.values()].some((k) => /!TEXMAP|!DATA/.test(read(k)))) continue;
	parts.push({ file, desc, cat: group.cat, deps });
}
for (const file of BODY)
	parts.push({ file, desc: header(read(`parts/${file}`)), cat: 'body', deps: closure(file) });

const uses = new Map();
for (const p of parts) for (const n of p.deps.keys()) uses.set(n, (uses.get(n) ?? 0) + 1);
const keys = new Map(parts.flatMap((p) => [...p.deps]));
const core = [...uses].filter(([, c]) => c >= CORE_MIN_USES).map(([n]) => n);
const coreSet = new Set(core);
// Used by a few parts only: served one by one, where LDrawLoader looks first
// (<library>/parts/<name>), so a part pack only carries what is its own.
const shared = [...uses].filter(([, c]) => c > 1 && c < CORE_MIN_USES).map(([n]) => n);
const sharedSet = new Set(shared);

// --- write output ---------------------------------------------------------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'p'), { recursive: true });

fs.writeFileSync(path.join(OUT, 'core.ldr'), `0 FILE core.ldr\n${pack(core, keys)}`);

let sharedBytes = 0;
for (const n of shared) {
	const out = path.join(OUT, 'parts', n);
	fs.mkdirSync(path.dirname(out), { recursive: true });
	const text = normalize(read(keys.get(n)));
	sharedBytes += text.length;
	fs.writeFileSync(out, text);
}

const armNames = new Set(['3818.dat', '3819.dat']);
const catalog = [];
let bytes = 0;
let requests = 0;
for (const p of parts) {
	const id = p.file.replace(/\.dat$/, '');
	const deps = [...p.deps.keys()].filter((n) => n !== p.file);
	const own = [p.file, ...deps.filter((n) => !coreSet.has(n) && !sharedSet.has(n))];
	requests += deps.filter((n) => sharedSet.has(n)).length;
	const text = pack(own, keys);
	bytes += text.length;
	fs.writeFileSync(path.join(OUT, 'p', `${id}.ldr`), text);
	const entry = { id, name: p.desc.replace(/^Minifig /, ''), cat: p.cat };
	if (p.cat === 'headgear') entry.kind = p.desc.split(' ')[1];
	if (p.cat === 'head') {
		// Standard heads have their origin on top (stud base) and go down to y=24.
		// Moulded heads (Sonic, E.T., animals...) have it at the neck instead:
		// they are placed on the torso as is, and headgear sits on their top.
		const { top, bottom } = heightOf(p.file);
		if (bottom <= 10) entry.neck = Math.round(top);
	}
	if (p.cat === 'torso') {
		// Torsos that already come with arms (wings, dual mould, ...)
		entry.arms = [...p.deps.keys()].some(
			(n) => armNames.has(n) || /^Minifig Arm/.test(header(read(keys.get(n))))
		);
	}
	catalog.push(entry);
}
// Classic minifig parts first: printed standard heads, standard torsos, then the rest
const rank = (p) =>
	/^3626/.test(p.id)
		? /pattern/i.test(p.name)
			? 0
			: 1
		: /^(973|76382|73200|970)/.test(p.id)
			? 0
			: 2;
catalog.sort(
	(a, b) => a.cat.localeCompare(b.cat) || rank(a) - rank(b) || a.name.localeCompare(b.name)
);
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog));

// Colours, from LDConfig.ldr
const config = fs.readFileSync(path.join(LDRAW, 'LDConfig.ldr'), 'utf8');
fs.copyFileSync(path.join(LDRAW, 'LDConfig.ldr'), path.join(OUT, 'LDConfig.ldr'));
const colors = [];
for (const line of config.split(/\r?\n/)) {
	const m = line.match(/^0 !COLOUR (\S+)\s+CODE\s+(\d+)\s+VALUE\s+#([0-9A-Fa-f]{6})(.*)$/);
	if (!m) continue;
	const [, name, code, hex, rest] = m;
	if (code === '16' || code === '24') continue;
	const finish = rest.match(/\b(CHROME|PEARLESCENT|RUBBER|MATTE_METALLIC|METAL|MATERIAL)\b/)?.[1];
	const color = {
		code: Number(code),
		name: name.replaceAll('_', ' '),
		hex: `#${hex.toLowerCase()}`
	};
	if (/\bALPHA\b/.test(rest)) color.alpha = true;
	if (finish) color.finish = finish.toLowerCase();
	colors.push(color);
}
fs.writeFileSync(path.join(OUT, 'colors.json'), JSON.stringify(colors));

// Attribution: every shipped file with its authors
const shipped = new Set([...core, ...parts.flatMap((p) => [...p.deps.keys()])]);
const credits = [...shipped].sort().map((n) => {
	const text = read(keys.get(n));
	const author = text.match(/^0 Author:\s*(.+)$/m)?.[1].trim() ?? 'unknown';
	const license = text.match(/^0 !LICENSE\s*(.+)$/m)?.[1].trim() ?? '';
	return `${n}\t${author}\t${license}`;
});
fs.writeFileSync(
	path.join(OUT, 'CREDITS.txt'),
	[
		'Parts from the LDraw.org Parts Library (https://library.ldraw.org).',
		'Licensed under CC BY 2.0 and/or CC BY 4.0, see CAreadme.txt.',
		'Files are repackaged: blank lines removed and file references lower-cased.',
		'Geometry is not modified.',
		'',
		'file\tauthor\tlicense',
		...credits
	].join('\n')
);
for (const f of ['CAreadme.txt', 'CAlicense.txt', 'CAlicense4.txt'])
	fs.copyFileSync(path.join(LDRAW, f), path.join(OUT, f));

const count = (cat) => catalog.filter((c) => c.cat === cat).length;
const coreSize = fs.statSync(path.join(OUT, 'core.ldr')).size;
console.log(
	`${count('head')} heads, ${count('headgear')} headgear, ${count('torso')} torsos, ${count('legs')} legs` +
		` | core ${core.length} files ${(coreSize / 1e6).toFixed(1)} MB` +
		` | shared ${shared.length} files ${(sharedBytes / 1e6).toFixed(1)} MB` +
		` | packs ${(bytes / 1e6).toFixed(1)} MB (avg ${(bytes / parts.length / 1e3).toFixed(0)} kB,` +
		` ${(requests / parts.length).toFixed(1)} shared files per part)`
);
