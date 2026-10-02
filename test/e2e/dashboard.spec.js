// Baseline of the dashboard before the Bootstrap 5 migration: every page, as admin and as teacher,
// at desktop and phone size, with a full-page screenshot in test/e2e/baseline/ and the behaviors
// that depend on Bootstrap/jQuery plugins (select2, datetimepicker, Chart.js, QR modal, tutorial).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const info = JSON.parse(process.env.E2E_INFO);
const ids = info.ids;
const shots = path.join(__dirname, 'baseline');
fs.mkdirSync(shots, { recursive: true });

// the server is started by the global setup, which passes its address in E2E_INFO
test.use({ baseURL: info.baseURL });

const VIEWPORTS = {
	desktop: { width: 1280, height: 800 },
	mobile: { width: 390, height: 844 }
};

// Pages of the dashboard. admin: only reachable as admin. sidebar: false for pages without sidebar.
// select2: selector of a select that must become a select2 widget.
const PAGES = [
	{ slug: 'home', path: '/dashboard' },
	{ slug: 'users', path: '/dashboard/users', select2: '#user-form [name="role"]' },
	{ slug: 'users-add', path: '/dashboard/users/add' },
	{ slug: 'users-edit', path: '/dashboard/users/edit/' + ids.student1 },
	{ slug: 'classrooms', path: '/dashboard/classrooms' },
	{ slug: 'classrooms-add', path: '/dashboard/classrooms/add', admin: true, select2: '#select-students-select2' },
	{ slug: 'classrooms-edit', path: '/dashboard/classrooms/edit/' + ids.classroom, admin: true, select2: '#select-students-select2' },
	{ slug: 'activities', path: '/dashboard/activities' },
	{ slug: 'journal', path: '/dashboard/journal' },
	{ slug: 'journal-entries', path: '/dashboard/journal/' + ids.teacherJournal },
	{ slug: 'assignments', path: '/dashboard/assignments' },
	// An admin has no private journal: the page redirects to the journals with "Invalid journal" (state recorded as is)
	{ slug: 'assignments-add', path: '/dashboard/assignments/add', select2: '#select2-activity', select2Roles: ['teacher'] },
	{ slug: 'assignments-edit', path: '/dashboard/assignments/edit/' + ids.assignment },
	{ slug: 'deliveries-comment', path: '/dashboard/assignments/deliveries/comment/' + ids.assignment + '?oid=none' },
	{ slug: 'charts-list', path: '/dashboard/stats/list', admin: true },
	{ slug: 'charts-add', path: '/dashboard/stats/add', admin: true },
	{ slug: 'charts-edit', path: '/dashboard/stats/edit/' + ids.chart, admin: true },
	{ slug: 'stats', path: '/dashboard/stats', admin: true },
	{ slug: 'profile', path: '/dashboard/profile' },
	{ slug: 'two-factor-enable', path: '/dashboard/profile/enable2FA' },
	{ slug: '404', path: '/dashboard/does-not-exist' }
];

// KNOWN FAILURE TODAY (not fixed in this phase): GET /dashboard/assignments/deliveries/:id brings the whole server
// down. The dashboard calls api/controller/assignments.js findAllDeliveries, which still calls deliveries.get()
// (cursor API of the old MongoDB driver) after the upgrade to driver 6: "deliveries.get is not a function",
// uncaught exception, the process exits. These tests run last, are marked test.fail() and the harness restarts the
// server. Remove test.fail() when the page is fixed.
const DELIVERIES = { slug: 'deliveries', path: '/dashboard/assignments/deliveries/' + ids.assignment };

// Tutorials are launched by the first visit of a page: mark them as finished, except in the tutorial test
const TOURS = ['home', 'users', 'editUser', 'classroom', 'editClassroom', 'activities', 'journal1', 'journal2', 'assignment',
	'editAssignment', 'deliveries', 'stats', 'listCharts', 'editChart'];
function skipTours() {
	const names = arguments[0];
	for (const name of names) {
		for (const suffix of ['', '_add', '_edit']) {
			localStorage.setItem(name + suffix + '_end', 'yes');
		}
	}
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

async function settle(page) {
	await page.waitForLoadState('networkidle');
	// icons, charts and select2 widgets are drawn by scripts after load
	await page.waitForTimeout(600);
}

for (const role of ['admin', 'teacher']) {
	for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
		test.describe(role + ' ' + vpName, () => {
			test.use({ viewport });
			let storageState;

			test.beforeAll(async ({ browser }) => {
				await serverReady();
				const context = await browser.newContext();
				const page = await context.newPage();
				await login(page, info.users[role]);
				await page.waitForURL(/\/dashboard(\?.*)?$/);
				storageState = await context.storageState();
				await context.close();
			});

			test.beforeEach(async ({ context }) => {
				await serverReady();
				await context.addCookies(storageState.cookies);
				await context.addInitScript(skipTours, TOURS);
			});

			for (const p of PAGES) {
				if (p.admin && role != 'admin') {
					continue;
				}
				test(p.slug, async ({ page }, testInfo) => {
					const watched = watch(page);
					const response = await page.goto(p.path);
					await settle(page);

					expect(response.status(), 'HTTP status').toBe(p.slug == '404' ? 200 : 200);
					expect(watched.errors, 'uncaught page errors').toEqual([]);
					if (watched.failed.length) {
						testInfo.annotations.push({ type: 'failed requests', description: watched.failed.join(', ') });
					}

					if (p.slug != '404') {
						await expect(page.locator('#sugarizer-sidebar')).toBeAttached();
						if (vpName == 'desktop') {
							await expect(page.locator('#sugarizer-sidebar')).toBeVisible();
						}
					}
					if (p.select2 && (!p.select2Roles || p.select2Roles.includes(role))) {
						await expect(page.locator(p.select2).first(), 'select2 initialised').toHaveClass(/select2-hidden-accessible/);
						await expect(page.locator('.select2-container').first()).toBeVisible();
					}

					await page.screenshot({ path: path.join(shots, role + '-' + vpName + '-' + p.slug + '.png'), fullPage: true });
				});
			}

			if (vpName == 'desktop') {
				test('datetimepicker opens on the assignment form', async ({ page }) => {
					const watched = watch(page);
					await page.goto('/dashboard/assignments/edit/' + ids.assignment);
					await settle(page);
					await page.click('#datetimepicker1');
					await expect(page.locator('.xdsoft_datetimepicker').filter({ visible: true }).first()).toBeVisible();
					expect(watched.errors).toEqual([]);
				});

				test('QR modal opens from the sidebar', async ({ page }) => {
					const watched = watch(page);
					await page.goto('/dashboard');
					await settle(page);
					await page.click('.qr-icon');
					await expect(page.locator('#qrpopup')).toBeVisible();
					await expect(page.locator('#qrplaceholder canvas, #qrplaceholder img').first()).toBeAttached();
					expect(watched.errors).toEqual([]);
				});

				test('tutorial shows its first step from the help button', async ({ page }) => {
					const watched = watch(page);
					await page.goto('/dashboard');
					await settle(page);
					await page.click('#navbar-help');
					await expect(page.locator('.popover.tour').first()).toBeVisible();
					expect(watched.errors).toEqual([]);
				});
			}

			if (role == 'admin' && vpName == 'desktop') {
				test('a Chart.js canvas renders on stats', async ({ page }) => {
					const watched = watch(page);
					await page.goto('/dashboard/stats');
					await settle(page);
					const canvas = page.locator('canvas').first();
					await expect(canvas).toBeVisible();
					const painted = await canvas.evaluate((c) => {
						const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
						for (let i = 3; i < data.length; i += 4) {
							if (data[i] > 0) {
								return true;
							}
						}
						return false;
					});
					expect(painted, 'canvas has drawn pixels').toBe(true);
					expect(watched.errors).toEqual([]);
				});
			}

			// Last: this page crashes the server (see DELIVERIES), logged in state is lost afterwards
			test('deliveries (known failure: server crash)', async ({ page }) => {
				test.fail();
				const watched = watch(page);
				const response = await page.goto(DELIVERIES.path);
				await settle(page);
				expect(response.status(), 'HTTP status').toBe(200);
				expect(watched.errors, 'uncaught page errors').toEqual([]);
				await page.screenshot({ path: path.join(shots, role + '-' + vpName + '-deliveries.png'), fullPage: true });
			});
		});
	}
}

// Pages without a session
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
	test.describe('logged out ' + vpName, () => {
		test.use({ viewport });

		test('login', async ({ page }, testInfo) => {
			const watched = watch(page);
			await page.goto('/dashboard/login');
			await settle(page);
			await expect(page.locator('input[name="username"]')).toBeVisible();
			expect(watched.errors).toEqual([]);
			if (watched.failed.length) {
				testInfo.annotations.push({ type: 'failed requests', description: watched.failed.join(', ') });
			}
			await page.screenshot({ path: path.join(shots, 'public-' + vpName + '-login.png'), fullPage: true });
		});

		test('two-factor verification', async ({ page }, testInfo) => {
			const watched = watch(page);
			await login(page, info.users.tfa);
			await page.waitForURL(/\/dashboard\/verify2FA(\?.*)?$/);
			await settle(page);
			await expect(page.locator('input[name="tokenentry"]')).toBeVisible();
			expect(watched.errors).toEqual([]);
			if (watched.failed.length) {
				testInfo.annotations.push({ type: 'failed requests', description: watched.failed.join(', ') });
			}
			await page.screenshot({ path: path.join(shots, 'public-' + vpName + '-verify2FA.png'), fullPage: true });
		});
	});
}
