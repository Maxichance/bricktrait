// Pre-renders every part thumbnail into static/thumbs/<id>.webp, so the
// catalogue shows up at once instead of rendering in the visitor's browser.
//
// Uses the app's own rendering code through a small Vite page
// (scripts/thumbs/) driven by a headless Chrome. Existing thumbnails are kept
// unless the rendering code changed, so reruns only add what is missing.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const OUT = path.resolve('static/thumbs');
const BATCH = 40;
// Files that change how a thumbnail looks (new parts are simply added).
// Other changes that matter bump THUMB_VERSION in thumbs.ts.
const INPUTS = ['src/lib/scene.ts', 'src/lib/thumbs.ts'];

const CHROME =
	process.env.CHROME_PATH ??
	[
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium-browser',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
	].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('Chrome not found, set CHROME_PATH');
if (!fs.existsSync('static/ldraw/catalog.json')) throw new Error('Run `npm run parts` first');

// Start over when the rendering changed
const stamp = crypto.createHash('sha1');
for (const f of INPUTS) stamp.update(fs.readFileSync(f));
const version = stamp.digest('hex');
const versionFile = path.join(OUT, '.version');
if (fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf8') !== version) {
	console.log('Rendering changed, rebuilding every thumbnail');
	fs.rmSync(OUT, { recursive: true, force: true });
}
fs.mkdirSync(OUT, { recursive: true });

const server = await createServer({
	configFile: false,
	root: path.resolve('scripts/thumbs'),
	publicDir: path.resolve('static'),
	logLevel: 'warn',
	server: { port: 0 }
});
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: true,
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
});

try {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.error('page:', e.message));
	await page.goto(url);
	const items = await page.evaluate(() => window.thumbsReady);
	const todo = items.filter(({ id }) => !fs.existsSync(path.join(OUT, `${id}.webp`)));
	console.log(`${items.length} thumbnails, ${todo.length} to render`);

	let failed = 0;
	const start = Date.now();
	for (let i = 0; i < todo.length; i += BATCH) {
		const batch = todo.slice(i, i + BATCH);
		const urls = await page.evaluate((b) => window.renderThumbs(b), batch);
		batch.forEach(({ id }, j) => {
			if (!urls[j]) return failed++;
			fs.writeFileSync(path.join(OUT, `${id}.webp`), Buffer.from(urls[j].split(',')[1], 'base64'));
		});
		const done = Math.min(i + BATCH, todo.length);
		process.stdout.write(`\r${done}/${todo.length} (${Math.round((Date.now() - start) / 1000)} s)`);
	}
	if (todo.length) process.stdout.write('\n');
	if (failed) console.warn(`${failed} thumbnails failed, the app renders them live`);
	fs.writeFileSync(versionFile, version);
} finally {
	await browser.close();
	await server.close();
}
