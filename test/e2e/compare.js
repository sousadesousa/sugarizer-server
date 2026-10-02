// Compares the screenshots of the last run with the committed baseline (npm run test:e2e:compare).
// For each page: the percentage of pixels that differ, and a side by side image (baseline | current | diff) in
// test-results/compare/, with an HTML index sorted by difference. It reports, it never fails because of a difference:
// the migration review reads it. The exit code is 0 unless the folders are missing.
//
// node test/e2e/compare.js [--baseline <dir>] [--current <dir>] [--out <dir>] [--threshold <0..1>]
// Other folders are used to check that two runs give the same screenshots.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PNG } = require('pngjs');
const paths = require('./paths');

function option(name, fallback) {
	const index = process.argv.indexOf('--' + name);
	return index > 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const baselineDir = path.resolve(option('baseline', paths.baselineDir));
const currentDir = path.resolve(option('current', path.join(paths.root, 'test-results/screenshots')));
const outDir = path.resolve(option('out', path.join(paths.root, 'test-results/compare')));
// pixelmatch color distance (0 strict, 1 loose): 0.1 ignores invisible antialiasing noise
const threshold = Number(option('threshold', '0.1'));

function pngFiles(dir) {
	return fs.readdirSync(dir).filter((name) => path.extname(name) == '.png').sort();
}

function sha(file) {
	return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}

// Copy an image on a white canvas of the given size
function pad(image, width, height) {
	if (image.width == width && image.height == height) {
		return image;
	}
	const canvas = new PNG({ width, height });
	canvas.data.fill(255);
	PNG.bitblt(image, canvas, 0, 0, image.width, image.height, 0, 0);
	return canvas;
}

function sideBySide(images, gap) {
	const width = images.reduce((sum, image) => sum + image.width, 0) + gap * (images.length - 1);
	const height = Math.max(...images.map((image) => image.height));
	const canvas = new PNG({ width, height });
	canvas.data.fill(200);
	let x = 0;
	for (const image of images) {
		PNG.bitblt(image, canvas, 0, 0, image.width, image.height, x, 0);
		x += image.width + gap;
	}
	return canvas;
}

function escapeHtml(text) {
	return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function main() {
	for (const dir of [baselineDir, currentDir]) {
		if (!fs.existsSync(dir)) {
			console.error('Folder not found: ' + dir + (dir == currentDir ? ' (run npm run test:e2e first)' : ''));
			process.exit(2);
		}
	}
	const { default: pixelmatch } = await import('pixelmatch');

	fs.rmSync(outDir, { recursive: true, force: true });
	fs.mkdirSync(outDir, { recursive: true });

	const baselineNames = pngFiles(baselineDir);
	const currentNames = pngFiles(currentDir);
	const names = Array.from(new Set(baselineNames.concat(currentNames))).sort();
	const rows = [];

	for (const name of names) {
		const slug = path.basename(name, '.png');
		const row = { name: slug, status: '', percent: 0, pixels: 0, note: '', image: null };
		if (!baselineNames.includes(name)) {
			row.status = 'new';
			row.percent = 100;
			row.note = 'not in the baseline';
		} else if (!currentNames.includes(name)) {
			row.status = 'missing';
			row.percent = 100;
			row.note = 'no screenshot in this run';
		} else if (sha(path.join(baselineDir, name)) == sha(path.join(currentDir, name))) {
			row.status = 'identical';
		} else {
			const before = PNG.sync.read(fs.readFileSync(path.join(baselineDir, name)));
			const after = PNG.sync.read(fs.readFileSync(path.join(currentDir, name)));
			const width = Math.max(before.width, after.width);
			const height = Math.max(before.height, after.height);
			const a = pad(before, width, height);
			const b = pad(after, width, height);
			const diff = new PNG({ width, height });
			row.pixels = pixelmatch(a.data, b.data, diff.data, width, height, { threshold });
			row.percent = (100 * row.pixels) / (width * height);
			if (before.width != after.width || before.height != after.height) {
				row.note = 'size ' + before.width + 'x' + before.height + ' -> ' + after.width + 'x' + after.height;
			}
			row.status = row.pixels == 0 ? (row.note ? 'size' : 'same pixels') : 'different';
			if (row.pixels > 0 || row.note) {
				row.image = slug + '.png';
				fs.writeFileSync(path.join(outDir, row.image), PNG.sync.write(sideBySide([a, b, diff], 12)));
			}
		}
		rows.push(row);
	}

	rows.sort((x, y) => y.percent - x.percent || x.name.localeCompare(y.name));
	const count = (status) => rows.filter((row) => row.status == status).length;
	const summary = {
		baseline: baselineDir,
		current: currentDir,
		threshold: threshold,
		pages: rows.length,
		identical: count('identical'),
		samePixels: count('same pixels'),
		different: count('different') + count('size'),
		new: count('new'),
		missing: count('missing'),
		rows: rows
	};
	fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, '\t') + '\n');

	const html = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Dashboard screenshots: comparison</title>',
		'<style>body{font:14px system-ui,sans-serif;margin:24px;color:#222}table{border-collapse:collapse;width:100%}',
		'th,td{border-bottom:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top}',
		'.bad{color:#b00020;font-weight:600}.ok{color:#2e7d32}img{max-width:100%;border:1px solid #ccc;margin-top:6px}</style></head><body>',
		'<h1>Dashboard screenshots: comparison</h1>',
		'<p>Baseline <code>' + escapeHtml(baselineDir) + '</code> against <code>' + escapeHtml(currentDir) + '</code>, threshold ' + threshold + '.</p>',
		'<p><b>' + summary.pages + '</b> screenshots: <b>' + summary.identical + '</b> identical, <b>' + summary.samePixels + '</b> same pixels, <b class="bad">' +
			summary.different + '</b> different, <b>' + summary.new + '</b> new, <b>' + summary.missing + '</b> missing. Left to right in the images: baseline, current, diff.</p>',
		'<table><thead><tr><th>Page</th><th>Status</th><th>Different pixels</th><th>Note</th></tr></thead><tbody>'];
	for (const row of rows) {
		const bad = row.status != 'identical' && row.status != 'same pixels';
		html.push('<tr><td>' + escapeHtml(row.name) + '</td><td class="' + (bad ? 'bad' : 'ok') + '">' + escapeHtml(row.status) + '</td><td>' +
			(row.pixels ? row.percent.toFixed(2) + ' % (' + row.pixels + ')' : bad ? '' : '0 %') + '</td><td>' + escapeHtml(row.note) +
			(row.image ? '<br><a href="' + row.image + '"><img src="' + row.image + '" alt="' + escapeHtml(row.name) + '" loading="lazy"></a>' : '') + '</td></tr>');
	}
	html.push('</tbody></table></body></html>');
	fs.writeFileSync(path.join(outDir, 'index.html'), html.join('\n') + '\n');

	console.log('Compared ' + summary.pages + ' screenshots (threshold ' + threshold + '): ' + summary.identical + ' identical, ' +
		summary.samePixels + ' same pixels, ' + summary.different + ' different, ' + summary.new + ' new, ' + summary.missing + ' missing');
	for (const row of rows.filter((r) => r.status != 'identical')) {
		console.log('  ' + row.name.padEnd(48) + row.status.padEnd(13) + (row.pixels ? row.percent.toFixed(2) + ' %' : '') + (row.note ? '  ' + row.note : ''));
	}
	console.log('Report: ' + path.join(outDir, 'index.html'));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
