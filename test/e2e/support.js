// Helpers shared by the e2e specs: server info, login, error watching, steady screenshots, API calls.
const path = require('path');
const paths = require('./paths');

const info = JSON.parse(process.env.E2E_INFO);

const VIEWPORTS = {
	desktop: { width: 1280, height: 800 },
	mobile: { width: 390, height: 844 }
};

// Tutorials are launched by the first visit of a page: mark them as finished, except in the tutorial test
const TOURS = ['home', 'users', 'editUser', 'classroom', 'editClassroom', 'activities', 'journal1', 'journal2', 'assignment',
	'editAssignment', 'deliveries', 'stats', 'listCharts', 'editChart'];

// Runs in the browser, before the scripts of each page
function skipTours(names) {
	for (const name of names) {
		for (const suffix of ['', '_add', '_edit']) {
			localStorage.setItem(name + suffix + '_end', 'yes');
		}
	}
}

// Runs in the browser, before the scripts of each page: the same "random" numbers on every load (mulberry32)
function seedRandom(seed) {
	let state = seed >>> 0;
	Math.random = function() {
		state = (state + 0x6D2B79F5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// A browser context where every page loads the same way: tutorials off, same random numbers, and the clock at the
// time the server started at (it then runs normally)
async function prepareContext(context) {
	await context.clock.install({ time: new Date(info.clockStart) });
	await context.addInitScript(skipTours, TOURS);
	await context.addInitScript(seedRandom, 1);
}

async function serverReady() {
	const end = Date.now() + 30000;
	while (Date.now() < end) {
		try {
			if ((await fetch(info.baseURL + '/api')).ok) {
				return;
			}
		} catch (e) {
			// not listening yet
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error('server not answering on ' + info.baseURL);
}

async function login(page, user) {
	await page.goto('/dashboard/login');
	await page.fill('input[name="username"]', user.name);
	await page.fill('input[name="password"]', info.password);
	await page.click('button[type="submit"]');
}

const DASHBOARD_URL = /\/dashboard(\?.*)?$/;

// Errors of the page: uncaught exceptions are asserted, failed local requests are only reported
function watch(page) {
	const watched = { errors: [], failed: [] };
	page.on('pageerror', (e) => watched.errors.push(e.message));
	page.on('response', (r) => {
		if (r.status() >= 400 && r.url().startsWith(info.baseURL) && !r.url().endsWith('/favicon.ico')) {
			watched.failed.push(r.status() + ' ' + r.url().replace(info.baseURL, ''));
		}
	});
	return watched;
}

// Wait until the page stopped changing: requests done, charts (animated canvases) drawn
async function settle(page) {
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(400);
	const sample = () => page.evaluate(() => Array.from(document.querySelectorAll('canvas')).map((c) => {
		try {
			const data = c.toDataURL();
			return data.length + ':' + data.slice(-64);
		} catch (e) {
			return 'unreadable';
		}
	}).join('|'));
	let previous = await sample();
	let steady = 0;
	for (let i = 0; i < 40 && steady < 2; i++) {
		await page.waitForTimeout(250);
		const current = await sample();
		steady = current === previous ? steady + 1 : 0;
		previous = current;
	}
}

// Notifications (flash messages) are timed and move: hidden in screenshots, their text is asserted by the tests
// The page that enables two-factor authentication shows a new secret and QR code at each visit: hidden as well
// (the secret is removed, not only hidden: its width changes with the secret and moves the text around it)
const HIDE_VARIABLE = '[data-notify="container"], .tfa-box form img, .tfa-box form svg, .tfa-box form canvas { visibility: hidden !important; } .tfa-box form .text-center p:nth-child(2) { display: none !important; }';

async function shot(page, name) {
	await page.screenshot({
		path: path.join(paths.screenshotsDir, name + '.png'),
		fullPage: true,
		animations: 'disabled',
		caret: 'hide',
		style: HIDE_VARIABLE
	});
}

// Calls of the API, to prepare or check what the dashboard did
async function apiLogin(user, role) {
	return apiCall('POST', '/auth/login', { user: JSON.stringify({ name: user.name, password: info.password, role: role }) });
}

async function apiCall(method, url, body, auth) {
	const headers = { 'Content-Type': 'application/json' };
	if (auth) {
		headers['x-key'] = auth.user._id;
		headers['x-access-token'] = auth.token;
	}
	const res = await fetch(info.baseURL + url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	let data = text;
	try {
		data = JSON.parse(text);
	} catch (e) {
		// not JSON
	}
	if (!res.ok) {
		throw new Error(method + ' ' + url + ' -> ' + res.status + ' ' + text);
	}
	return data;
}

module.exports = { info, VIEWPORTS, TOURS, DASHBOARD_URL, prepareContext, serverReady, login, watch, settle, shot, apiLogin, apiCall };
