// Baseline of the dashboard before the Bootstrap 5 migration: every page, as admin and as teacher,
// at desktop and phone size, with a full-page screenshot, and the behaviors that depend on Bootstrap/jQuery
// plugins (select2, datetimepicker, Chart.js, QR modal, tutorial).
// Screenshots go to test-results/screenshots/ (see paths.js); test/e2e/baseline/ is only written by
// `npm run test:e2e:baseline`. `npm run test:e2e:compare` compares the two.
const { test, expect } = require('@playwright/test');
const { info, VIEWPORTS, DASHBOARD_URL, prepareContext, serverReady, login, watch, settle, shot } = require('./support');

const ids = info.ids;

// the server is started by the global setup, which passes its address in E2E_INFO
test.use({ baseURL: info.baseURL });

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
	{ slug: 'deliveries', path: '/dashboard/assignments/deliveries/' + ids.assignment },
	{ slug: 'deliveries-comment', path: '/dashboard/assignments/deliveries/comment/' + ids.assignment + '?oid=none' },
	{ slug: 'charts-list', path: '/dashboard/stats/list', admin: true },
	{ slug: 'charts-add', path: '/dashboard/stats/add', admin: true },
	{ slug: 'charts-edit', path: '/dashboard/stats/edit/' + ids.chart, admin: true },
	{ slug: 'stats', path: '/dashboard/stats', admin: true },
	{ slug: 'profile', path: '/dashboard/profile' },
	{ slug: 'two-factor-enable', path: '/dashboard/profile/enable2FA' },
	{ slug: '404', path: '/dashboard/does-not-exist' }
];

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
				await page.waitForURL(DASHBOARD_URL);
				storageState = await context.storageState();
				await context.close();
			});

			test.beforeEach(async ({ context }) => {
				await serverReady();
				await context.addCookies(storageState.cookies);
				await prepareContext(context);
			});

			for (const p of PAGES) {
				if (p.admin && role != 'admin') {
					continue;
				}
				test(p.slug, async ({ page }, testInfo) => {
					const watched = watch(page);
					const response = await page.goto(p.path);
					await settle(page);

					// The dashboard renders its "Page Not Found" page with res.render() and no res.status(), so the
					// 404 page answers 200 (a wrong dashboard URL is not a 404 for the browser). Asserted on purpose:
					// a change of this status would be a behavior change.
					expect(response.status(), 'HTTP status').toBe(200);
					if (p.slug == '404') {
						await expect(page.locator('body')).toContainText('Page Not Found');
					}
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

					await shot(page, role + '-' + vpName + '-' + p.slug);
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
					await expect(page.locator('.introjs-tooltip').first()).toBeVisible();
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
		});
	}
}

// A teacher with no classroom has no students, so no shared journal: the journal pages used to redirect to
// themselves forever (ERR_TOO_MANY_REDIRECTS). They now show the page with a message.
test.describe('teacher without classroom', () => {
	test.use({ viewport: VIEWPORTS.desktop });

	for (const [slug, journalPath] of [['journal', '/dashboard/journal'], ['journal-entries', '/dashboard/journal/' + ids.teacherNoClassJournal]]) {
		test(slug + ' shows the page with a message instead of redirecting', async ({ page }) => {
			await serverReady();
			await prepareContext(page.context());
			const watched = watch(page);
			await login(page, info.users.teacherNoClass);
			await page.waitForURL(DASHBOARD_URL);
			const response = await page.goto(journalPath);
			await settle(page);
			expect(response.status(), 'HTTP status').toBe(200);
			expect(new URL(page.url()).pathname, 'no redirect loop').toMatch(/^\/dashboard\/journal/);
			await expect(page.locator('#journal-search-card')).toBeVisible();
			await expect(page.locator('[data-notify="message"]').first()).toContainText('No shared journal found');
			// the shared journal box stays unchecked and the user selector usable
			await expect(page.locator('#journal-type')).not.toBeChecked();
			await expect(page.locator('#users-select2')).toBeEnabled();
			expect(watched.errors, 'uncaught page errors').toEqual([]);
			await shot(page, 'teacher-no-classroom-desktop-' + slug);
		});
	}
});

// Pages without a session
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
	test.describe('logged out ' + vpName, () => {
		test.use({ viewport });

		test('login', async ({ page }, testInfo) => {
			await prepareContext(page.context());
			const watched = watch(page);
			await page.goto('/dashboard/login');
			await settle(page);
			await expect(page.locator('input[name="username"]')).toBeVisible();
			expect(watched.errors).toEqual([]);
			if (watched.failed.length) {
				testInfo.annotations.push({ type: 'failed requests', description: watched.failed.join(', ') });
			}
			await shot(page, 'public-' + vpName + '-login');
		});

		test('two-factor verification', async ({ page }, testInfo) => {
			await prepareContext(page.context());
			const watched = watch(page);
			await login(page, info.users.tfa);
			await page.waitForURL(/\/dashboard\/verify2FA(\?.*)?$/);
			await settle(page);
			await expect(page.locator('input[name="tokenentry"]')).toBeVisible();
			expect(watched.errors).toEqual([]);
			if (watched.failed.length) {
				testInfo.annotations.push({ type: 'failed requests', description: watched.failed.join(', ') });
			}
			await shot(page, 'public-' + vpName + '-verify2FA');
		});
	});
}
