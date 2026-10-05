// Downloads the official LDraw parts library into .ldraw/ (skipped if already there).
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';

const URL = 'https://library.ldraw.org/library/updates/complete.zip';
const dest = path.resolve(process.env.LDRAW_DIR ?? '.ldraw');

if (fs.existsSync(path.join(dest, 'parts'))) {
	console.log(`LDraw library already present in ${dest}`);
	process.exit(0);
}

console.log(`Downloading ${URL}...`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const zip = new Uint8Array(await res.arrayBuffer());

console.log('Extracting...');
const files = unzipSync(zip);
for (const [name, data] of Object.entries(files)) {
	if (name.endsWith('/')) continue;
	// The archive root is "ldraw/"
	const out = path.join(dest, name.replace(/^ldraw\//, ''));
	fs.mkdirSync(path.dirname(out), { recursive: true });
	fs.writeFileSync(out, data);
}
console.log(`Done: ${Object.keys(files).length} files in ${dest}`);
