// Downloads the LDraw parts library into .ldraw/, and the parts still in
// review on the Parts Tracker into .ldraw-unofficial/ (each skipped if already there).
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';

const LIBRARIES = [
	{
		url: 'https://library.ldraw.org/library/updates/complete.zip',
		dest: path.resolve(process.env.LDRAW_DIR ?? '.ldraw')
	},
	{
		url: 'https://library.ldraw.org/library/unofficial/ldrawunf.zip',
		dest: path.resolve(process.env.LDRAW_UNOFFICIAL_DIR ?? '.ldraw-unofficial')
	}
];

for (const { url, dest } of LIBRARIES) {
	if (fs.existsSync(path.join(dest, 'parts'))) {
		console.log(`Already present in ${dest}`);
		continue;
	}
	console.log(`Downloading ${url}...`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Download failed: ${res.status}`);
	const zip = new Uint8Array(await res.arrayBuffer());

	console.log('Extracting...');
	const files = unzipSync(zip);
	for (const [name, data] of Object.entries(files)) {
		if (name.endsWith('/')) continue;
		// The official archive has an "ldraw/" root folder, the unofficial one none
		const out = path.join(dest, name.replace(/^ldraw\//, ''));
		fs.mkdirSync(path.dirname(out), { recursive: true });
		fs.writeFileSync(out, data);
	}
	console.log(`Done: ${Object.keys(files).length} files in ${dest}`);
}
