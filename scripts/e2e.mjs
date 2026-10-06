// End-to-end checks in a real (headless) Chrome: clicks, shortcuts, undo, share links.
// Needs `npm run parts`. Usage: npm run e2e
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inflateSync, strFromU8 } from 'fflate';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const CHROME =
	process.env.CHROME_PATH ??
	[
		'C:/Program Files/Google/Chrome/Application/chrome.exe',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium-browser',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
	].find((p) => fs.existsSync(p));

const server = await createServer({ logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: true,
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--lang=en-US']
});

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let page;

/** Portrait state, decoded from the address bar */
async function state() {
	await pause(700); // hash and history settle after 300 and 400 ms
	const hash = await page.evaluate(() => location.hash.slice(2));
	const bytes = Buffer.from(hash, 'base64url');
	return JSON.parse(strFromU8(inflateSync(bytes)))[0];
}
async function view() {
	await pause(700);
	const hash = await page.evaluate(() => location.hash.slice(2));
	return JSON.parse(strFromU8(inflateSync(Buffer.from(hash, 'base64url'))))[1];
}
const key = (k, mods = []) =>
	(async () => {
		for (const m of mods) await page.keyboard.down(m);
		await page.keyboard.press(k);
		for (const m of mods.reverse()) await page.keyboard.up(m);
	})();

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('loads the catalogue', async () => {
	await page.waitForSelector('.picker .item', { timeout: 60000 });
	const fig = await state();
	assert.equal(fig.head.id, '3626cp01');
});

check('picking a part changes the figure', async () => {
	await page.click('.picker .pick[aria-pressed="false"]');
	assert.notEqual((await state()).head.id, '3626cp01');
});

check('Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo', async () => {
	const picked = (await state()).head.id;
	await page.evaluate(() => document.activeElement?.blur?.());
	await key('z', ['Control']);
	assert.equal((await state()).head.id, '3626cp01');
	await key('z', ['Control', 'Shift']);
	assert.equal((await state()).head.id, picked);
	await key('z', ['Control']);
	await key('y', ['Control']);
	assert.equal((await state()).head.id, picked);
});

check('number keys switch slots, Delete empties the active one', async () => {
	await page.evaluate(() => document.activeElement?.blur?.());
	await key('1');
	const pressed = await page.$$eval('.slot .pick', (bs) =>
		bs.findIndex((b) => b.getAttribute('aria-pressed') === 'true')
	);
	assert.equal(pressed, 0);
	await key('Delete');
	assert.equal((await state()).headgear.id, null);
	await key('z', ['Control']);
	assert.equal((await state()).headgear.id, '3901');
});

check('the × button removes a part', async () => {
	const legs = (await page.$$('.slot'))[5];
	await (await legs.$('.remove')).click();
	assert.equal((await state()).legs.id, null);
});

check('dragging the portrait turns it, as one undo step', async () => {
	const before = (await state()).yaw;
	const box = await (await page.$('.preview canvas')).boundingBox();
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	// Slower than the 400 ms grouping delay, like a slow machine: still one undo step
	for (let i = 1; i <= 5; i++) {
		await page.mouse.move(x + i * 16, y);
		await pause(450);
	}
	await page.mouse.up();
	const turned = await view();
	assert.ok(Math.abs(turned.yaw) > 10, `yaw is ${turned.yaw}`);
	await page.evaluate(() => document.activeElement?.blur?.());
	await key('z', ['Control']);
	const after = await view();
	assert.equal(
		after.yaw,
		before ?? 0,
		JSON.stringify({ before, turned: turned.yaw, after: after.yaw })
	);
});

check('a share link reopens the same figure', async () => {
	await page.click('.picker .item:nth-child(5) .pick');
	const fig = await state();
	const link = await page.evaluate(() => location.href);
	const other = await browser.newPage();
	await other.goto(link, { waitUntil: 'domcontentloaded', timeout: 120000 });
	await other.waitForSelector('.picker .item', { timeout: 60000 });
	const reopened = await other.evaluate(() => location.hash);
	await other.close();
	assert.equal(reopened, link.slice(link.indexOf('#')));
	assert.ok(fig.head.id);
});

check('the star adds a favourite, listed under Favourites', async () => {
	const first = await page.$('.picker .item');
	await first.hover();
	await (await first.$('.star')).click();
	const id = await first.$eval('.pick', (b) => b.title);
	await page.click('.views button:nth-child(2)');
	await pause(200);
	const listed = await page.$$eval('.picker .pick', (bs) => bs.map((b) => b.title));
	assert.deepEqual(listed, [id]);
	await page.click('.views button:nth-child(1)');
});

check('search forgives plurals and typos', async () => {
	await page.keyboard.press('3'); // neck slot
	await pause(300);
	await page.type('.picker input[type=search]', 'beards');
	await pause(300);
	const plural = await page.$$eval('.picker .pick', (bs) => bs.length);
	await page.$eval('.picker input[type=search]', (i) => (i.value = ''));
	await page.type('.picker input[type=search]', 'moustahce');
	await pause(300);
	const typo = await page.$$eval('.picker .pick', (bs) => bs.length);
	assert.ok(plural > 0 && typo > 0, `beards: ${plural}, moustahce: ${typo}`);
	await page.evaluate(() => document.activeElement?.blur?.());
	await page.keyboard.press('2'); // back to heads
	await pause(300);
});

check('arrow keys move through the grid, Enter picks', async () => {
	await page.focus('.picker .pick[tabindex="0"]');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await pause(100);
	const focused = await page.evaluate(() => document.activeElement?.getAttribute('title'));
	await page.keyboard.press('Enter');
	const fig = await state();
	assert.ok(focused);
	assert.notEqual(fig.head.id, '3626cp01');
});

check('the Pose tab moves an arm, its value button puts it back', async () => {
	await page.click('.modes [role=tab]:nth-child(2)');
	await page.waitForSelector('.group input[type=range]');
	// Arms group: right arm
	await page.$$eval('.group', (groups) => {
		const input = groups[1].querySelector('input[type=range]');
		input.value = '60';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	assert.equal((await state()).pose.armR, 60);
	await page.$$eval('.group', (groups) => groups[1].querySelector('.val').click());
	assert.equal((await state()).pose.armR, 0);
});

check('arrow keys move between the tabs', async () => {
	await page.focus('.modes [role=tab][aria-selected=true]');
	await page.keyboard.press('ArrowRight');
	await pause(100);
	const tab = await page.evaluate(() => document.activeElement?.textContent?.trim());
	assert.equal(tab, 'Camera');
	await page.keyboard.press('Home');
	await pause(100);
	assert.ok(await page.$('.picker'));
});

check('/ jumps to the parts search', async () => {
	await page.click('.modes [role=tab]:nth-child(4)');
	await page.evaluate(() => document.activeElement?.blur?.());
	await key('/');
	await pause(200);
	const focused = await page.evaluate(() => document.activeElement?.type);
	assert.equal(focused, 'search');
	await page.evaluate(() => document.activeElement?.blur?.());
});

check('the full palette unfolds and finds a colour by name', async () => {
	await page.click('.bar .more');
	await page.type('.palette input[type=search]', 'dark red');
	await pause(200);
	const found = await page.$$eval('.palette .swatch', (s) => s.map((b) => b.title));
	assert.ok(found.length > 0 && found.every((t) => /dark red/i.test(t)), found.join());
	await page.click('.palette .swatch');
	assert.match(found[0], new RegExp(`\\(${(await state()).head.color}\\)`));
	await page.click('.bar .more');
	assert.ok(await page.$('.bar .strip'));
	await key('z', ['Control']);
});

check('on a phone the tabs stay in reach and nothing overflows', async () => {
	const phone = await browser.newPage();
	await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
	await phone.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
	await phone.waitForSelector('.picker .item', { timeout: 60000 });
	await phone.evaluate(() => window.scrollTo(0, 2000));
	await pause(500);
	const tabs = await (await phone.$('.modes')).boundingBox();
	const slots = await (await phone.$('.slots')).boundingBox();
	assert.ok(tabs.y >= 0 && tabs.y < 400, `tabs at ${tabs.y}`);
	assert.ok(slots.y > tabs.y && slots.y < 460, `slots at ${slots.y}`);
	await phone.tap('.modes [role=tab]:nth-child(4)');
	await phone.waitForSelector('.group .seg');
	const width = await phone.evaluate(() => document.documentElement.scrollWidth);
	await phone.close();
	assert.ok(width <= 390, `page is ${width}px wide`);
});

check('the interface switches to French', async () => {
	await page.click('.modes [role=tab]:nth-child(1)');
	await page.select('.lang select', 'fr');
	await pause(200);
	const label = await page.$eval('.slot .label', (l) => l.textContent);
	assert.equal(label, 'Coiffe');
	await page.select('.lang select', 'en');
});

let failed = 0;
try {
	page = await browser.newPage();
	await page.setViewport({ width: 1366, height: 860 });
	page.on('pageerror', (e) => console.error('  page error:', e.message));
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
	for (const { name, fn } of checks) {
		try {
			await fn();
			console.log(`✓ ${name}`);
		} catch (e) {
			failed++;
			console.log(`✗ ${name}\n  ${e.message.split('\n')[0]}`);
		}
	}
} finally {
	await browser.close();
	await server.close();
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
