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

// Each slot of the figure and the kinds shown as filters, first match wins.
// Neck and back accessories hang from the torso top, headgear from the head top.
const GROUPS = [
	{ cat: 'head', kinds: [[/^Minifig Head\b(?! ?(Modified|Cover))/]] },
	{
		cat: 'neck',
		kinds: [
			[/^Minifig (Hair )?(Beard|Moustache)\b/, 'Beard'],
			[/^Minifig (Neckwear|Neck|Bandana|Collar|Scarf|Bowtie)\b/, 'Neckwear'],
			[/^Minifig (Armour|Breastplate|Epaulette|Shoulder)\b/, 'Armour'],
			[/^Minifig (Vest|Lifevest|Life Jacket|Lifeguard)\b/, 'Vest']
		]
	},
	{
		cat: 'back',
		kinds: [
			// Flat cloth capes are sewn sheets, only their formed versions look right
			[/^Minifig Cape\b(?!.*Cloth(?!.*Formed))/, 'Cape'],
			[/^Minifig (Backpack|Airtanks|Jet-Pack|Scuba)\b/, 'Pack'],
			[/^Minifig Wings\b/, 'Wings']
		]
	},
	{ cat: 'torso', kinds: [[/^Minifig Torso\b/]] },
	// Complete lower bodies: hips and legs, skirts, ghost hips...
	{ cat: 'legs', kinds: [[/^Minifig Hips\b/]] },
	{
		// Up to two words before the noun ("Minifig Police Hat"), but not "... with Hat"
		cat: 'headgear',
		kinds: [
			[/^Minifig ((?!with\b)\S+ ){0,2}Hair\b/, 'Hair'],
			[/^Minifig ((?!with\b)\S+ ){0,2}Cap\b/, 'Cap'],
			[/^Minifig ((?!with\b)\S+ ){0,2}Helmet\b/, 'Helmet'],
			[/^Minifig ((?!with\b)\S+ ){0,2}Hood\b/, 'Hood'],
			[/^Minifig ((?!with\b)\S+ ){0,2}(Hat|Crown|Tiara|Turban|Bonnet|Beret)\b/, 'Hat'],
			[/^Minifig ((?!with\b)\S+ ){0,2}(Headdress|Headphones|Headset)\b/, 'Headdress']
		]
	},
	{
		// Held in the hand grip: their bar runs along Y through the origin
		cat: 'hand',
		kinds: [
			[
				/^Minifig (Sword|Axe|Battleaxe|Weapon|Gun|Spear|Pike|Lance|Polearm|Dagger|Knife|Knifes|Bow|Crossbow|Whip|Flail|Scythe|Blade|Bladed|Lightsaber|Harpoon|Speargun|Machete|Tomahawk|Chakram|Boomerang|Slingshot|Kendo)\b/,
				'Weapon'
			],
			[/^Minifig Shield\b/, 'Shield'],
			[
				/^Minifig (Tool|Shovel|Pickaxe|Jackhammer|Hose|Broom|Mop|Pushbroom|Brush|Paint|Welding|Chainsaw|Sledgehammer|Pitchfork|Oar|Ladle|Frypan|Saucepan|Utensil|Cutlery|Whisk|Plunger|Spray|Watering|Syringe|Keys?|Handcuffs|Comb|Hairbrush|Fishing|Hockey|Baseball Bat|Bat|Tennis|Ski Pole|Crutch|Lasso)\b/,
				'Tool'
			],
			[
				/^Minifig (Food|Cup|Mug|Goblet|Bottle|Wine|Teapot|Steak|Candy|Sundae|Carrot|Rice|Serving|Tray|Saucer|Pot|Dinner|Chopsticks|Ice Cream|Cauldron)\b/,
				'Food'
			],
			[
				/^Minifig (Acoustic|Electric|Saxophone|Violin|Banjo|Lute|Maracas|Bugle|Microphone|Boombox|Guitar)\b/,
				'Music'
			],
			[
				/^Minifig (Camera|Radio|Binoculars|Telescope|Megaphone|Loudhailer|Lantern|Torch|Umbrella|Book|Sextant|Compass|Signal|Video|Computer|Game|Balloon|Trophy|Statuette|Coins?|Candle|Candelabra|Magic|Wand|Staff|Ball|Basketball|Soccer|Suitcase|Satchel|Shopping|Toy|Teddy|Pen|Lightning|Flame|Fire|Dynamite|Telephone|Phone|Headset|Ring)\b/,
				'Gear'
			]
		]
	}
];
// Themes, guessed from the part name and its !KEYWORDS (first match wins).
// Licensed themes come first: "Imperial" means Star Wars before it means Pirates.
const THEMES = [
	[
		'Star Wars',
		/\b(SW|Star Wars|Jedi|Sith|Stormtrooper|Clone|Mandalorian|Darth|Wookiee|Ewok|Gungan|Toydarian|Nautolan|Twi'lek|Rebel Pilot|Imperial Officer|Lightsaber)\b/i
	],
	[
		'Harry Potter',
		/\b(HP|Harry Potter|Hogwarts|Gryffindor|Slytherin|Hufflepuff|Ravenclaw|Dumbledore|Voldemort|Hagrid|Hermione|Weasley)\b/i
	],
	[
		'Super Heroes',
		/\b(Marvel|DC|Batman|Superman|Spider-?Man|Iron Man|Avengers|Joker|Wonder Woman|Hulk|Thor|Captain America|Black Panther|X-Men|Deadpool|Groot|Harley Quinn|Robin|Catwoman|Poison Ivy|Venom|Loki)\b/i
	],
	[
		'Lord of the Rings',
		/\b(LOTR|Hobbit|Rohan|Gondor|Uruk|Mordor|Gandalf|Gollum|Aragorn|Legolas|Gimli|Frodo|Theoden)\b/i
	],
	['Ninjago', /\b(Ninjago|Ninja|Sensei|Serpentine)\b/i],
	[
		'Pirates',
		/\b(Pirates?|Redbeard|Islanders?|Imperial Soldier|Imperial Guard|Buccaneer|Corsair)\b/i
	],
	[
		'Castle',
		/\b(Castle|Knights?|Kingdoms|Black Falcon|Forest ?m[ae]n|Wolfpack|Crusader|Viking|Medieval|Jester|Dragon Masters|Royal)\b/i
	],
	[
		'Space',
		/\b(Space|Futuron|Blacktron|M-Tron|Ice Planet|Spyrius|Unitron|Exploriens|Insectoids|UFO|Mars|Martian|Astronaut|Galaxy Squad|Alien Conquest)\b/i
	],
	[
		'City',
		/\b(Police|Fire(fighter|man)?|Construction|Hospital|Doctor|Nurse|Coast Guard|Town|City|Airport|Pilot|Chef|Cook|Paramedic|EMT|Postman|Farmer|Train|Racer|Race)\b/i
	],
	['Western', /\b(Western|Cowboy|Sheriff|Bandit)\b/i],
	['Adventurers', /\b(Adventurers|Pharaoh|Mummy|Egypt|Indiana Jones|Johnny Thunder)\b/i],
	['Disney', /\b(Disney|Mickey|Minnie|Frozen|Elsa|Toy Story|Pixar|Moana|Aladdin|Muppets?)\b/i],
	[
		'Games & TV',
		/\b(Minecraft|Sonic|Simpsons|SpongeBob|Minions?|Animal Crossing|Mario|Nintendo|Overwatch|Powerpuff|Scooby|Ghostbusters|Stranger Things|Ninja Turtles?|TMNT|Jurassic|Looney Tunes|Wednesday)\b/i
	],
	['Monsters', /\b(Zombie|Skeleton|Vampire|Werewolf|Ghost|Monster|Witch|Pumpkin)\b/i],
	[
		'Sports',
		/\b(Soccer|Football|Hockey|Basketball|Baseball|Skater?|Surf(er)?|Ski(er)?|Cheerleader|Sports?)\b/i
	]
];
const keywordsOf = (text) =>
	[...text.matchAll(/^0 !KEYWORDS (.*)$/gm)]
		.map((m) => m[1])
		.join(', ')
		// Shop references (BrickLink 3626pb0063, Set 7785...) are noise here
		.replace(/\b(BrickLink|Rebrickable|Brickowl|Set) [\w-]+/gi, '');
const themeOf = (text) => THEMES.find(([, re]) => re.test(text))?.[0];

function classify(desc) {
	for (const g of GROUPS)
		for (const [re, kind] of g.kinds) if (re.test(desc)) return { cat: g.cat, kind };
	return null;
}
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
	const group = classify(desc);
	if (!group) continue;
	const deps = closure(file);
	// LDrawLoader does not support textures
	if ([...deps.values()].some((k) => /!TEXMAP|!DATA/.test(read(k)))) continue;
	parts.push({ file, desc, cat: group.cat, kind: group.kind, deps });
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
	if (p.kind) entry.kind = p.kind;
	const source = read(`parts/${p.file}`);
	const theme = themeOf(`${p.desc} ${keywordsOf(source)}`);
	if (theme) entry.theme = theme;
	const year = source.match(/^0 !LDRAW_ORG \S+ UPDATE (\d{4})/m)?.[1];
	if (year) entry.year = Number(year);
	if (p.cat === 'head') {
		// Standard heads have their origin on top (stud base) and go down to y=24.
		// Moulded heads (Sonic, E.T., animals...) have it at the neck instead:
		// they are placed on the torso as is, and headgear sits on their top.
		const { top, bottom } = heightOf(p.file);
		if (bottom <= 10) entry.moulded = Math.round(top);
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
	`${count('head')} heads, ${count('headgear')} headgear, ${count('torso')} torsos, ${count('legs')} legs, ${count('neck')} neck, ${count('back')} back, ${count('hand')} hand` +
		` | core ${core.length} files ${(coreSize / 1e6).toFixed(1)} MB` +
		` | shared ${shared.length} files ${(sharedBytes / 1e6).toFixed(1)} MB` +
		` | packs ${(bytes / 1e6).toFixed(1)} MB (avg ${(bytes / parts.length / 1e3).toFixed(0)} kB,` +
		` ${(requests / parts.length).toFixed(1)} shared files per part)`
);
