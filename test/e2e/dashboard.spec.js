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

// Pages of the dashboard. admin: only reachable as admin. teacher: only as teacher. sidebar: false for pages without sidebar.
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
	// teacher: only for teachers. An admin has no private journal: the page redirects to the journals with "Invalid journal",
	// so the admin variant was a second screenshot of the Journals page, not coverage of this page (see layout.spec.js too)
	{ slug: 'assignments-add', path: '/dashboard/assignments/add', teacher: true, select2: '#select2-activity', select2Roles: ['teacher'] },
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

// The tablet size (768-991 px, between the phone and the desktop layouts) is only captured for these pages
const TABLET_PAGES = ['home', 'users', 'assignments-add', 'journal'];

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
				if ((p.admin && role != 'admin') || (p.teacher && role != 'teacher')) {
					continue;
				}
				if (vpName == 'tablet' && !TABLET_PAGES.includes(p.slug)) {
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

				test('the titles of the home tables scroll with their card', async ({ page }) => {
					await page.goto('/dashboard');
					await settle(page);
					await page.locator('.main-area').evaluate((el) => { el.scrollTo(0, 300); window.scrollTo(0, 300); });
					await page.waitForTimeout(200);
					for (const id of ['recent-users-table-parent', 'recent-activities-table-parent']) {
						const card = page.locator('#' + id);
						const title = await card.locator('.dashboard-table-title').boundingBox();
						const table = await card.locator('table').boundingBox();
						expect(title.y + title.height, id + ': title above its table').toBeLessThanOrEqual(table.y);
						expect(await card.locator('.dashboard-table-title').evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
					}
				});

				test('the sidebar is reachable with the keyboard', async ({ page }) => {
					await page.goto('/dashboard');
					await settle(page);
					const links = page.locator('#sugarizer-sidebar .nav-link[href]:visible');
					await expect(links.first()).toHaveAttribute('href', '/dashboard');
					await page.locator('#languageSelection').focus();
					let focused = false;
					for (let i = 0; i < 12 && !focused; i++) {
						await page.keyboard.press('Tab');
						focused = await page.evaluate(() => !!document.activeElement.closest('#sugarizer-sidebar .nav-item'));
					}
					expect(focused, 'Tab reaches an item of the sidebar').toBe(true);
					// the second item (Users): Tab until it has the focus, then Enter
					for (let i = 0; i < 12; i++) {
						if (await page.evaluate(() => (document.activeElement.getAttribute('href') || '').indexOf('/dashboard/users') == 0)) {
							break;
						}
						await page.keyboard.press('Tab');
					}
					await page.keyboard.press('Enter');
					await page.waitForURL(/\/dashboard\/users/);
				});

				test('a mouse click on a sidebar item navigates, keeps the language and throws no error', async ({ page }) => {
					const watched = watch(page);
					await page.goto('/dashboard');
					await settle(page);
					await page.locator('#sugarizer-sidebar .nav-link[href="/dashboard/users"]').click();
					await page.waitForURL(/\/dashboard\/users/);
					expect(page.url(), 'the language is added to the URL').toMatch(/[?&]lang=/);
					expect(watched.errors, 'uncaught page errors').toEqual([]);
				});

				test('every item of the sidebar can be clicked with no page error', async ({ page }) => {
					const watched = watch(page);
					await page.goto('/dashboard');
					await settle(page);
					const hrefs = await page.locator('#sugarizer-sidebar .nav-link[href^="/dashboard"]:visible').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
					expect(hrefs.length).toBeGreaterThan(3);
					for (const href of hrefs) {
						await page.goto('/dashboard');
						await settle(page);
						await page.locator('#sugarizer-sidebar .nav-link[href="' + href + '"]').click();
						await page.waitForURL((url) => url.pathname == href && /lang=/.test(url.search), { timeout: 15000 });
						await settle(page);
					}
					expect(watched.errors, 'uncaught page errors').toEqual([]);
				});

				test('the page has the language of the dashboard', async ({ page }) => {
					await page.goto('/dashboard');
					await settle(page);
					await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 15000 });
					await page.selectOption('#languageSelection', 'fr');
					await page.waitForURL(/lang=fr/);
					await settle(page);
					await expect(page.locator('html')).toHaveAttribute('lang', 'fr', { timeout: 15000 });
					await page.selectOption('#languageSelection', 'en');
					await page.waitForURL(/lang=en/);
					await settle(page);
					await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 15000 });
				});

				test('the text of the toasts and of the card headers has a contrast of 4.5:1', async ({ page }) => {
					await page.goto('/dashboard');
					await settle(page);
					const ratio = (page_) => page_.evaluate(() => {
						const lum = (c) => {
							const v = c.match(/[\d.]+/g).slice(0, 3).map((n) => { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); });
							return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
						};
						const worst = [];
						const add = (el) => {
							const st = getComputedStyle(el);
							const a = lum(st.color), b = lum(st.backgroundColor);
							worst.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
						};
						document.querySelectorAll('.card-header[data-background-color="black"]').forEach(add);
						document.querySelectorAll('.sidebar .nav-item.active > .nav-link').forEach(add);
						// the icon of the round buttons (Upload journal, Download/Delete multiple): white on the button, not text-muted grey
						const btn = document.createElement('a');
						btn.className = 'btn btn-round';
						btn.innerHTML = '<i class="material-icons text-muted">delete_forever</i>';
						document.body.appendChild(btn);
						const icon = btn.firstChild;
						const ia = lum(getComputedStyle(icon).color), ib = lum(getComputedStyle(btn).backgroundColor);
						const iconRatio = (Math.max(ia, ib) + 0.05) / (Math.min(ia, ib) + 0.05);
						const iconColor = getComputedStyle(icon).color;
						btn.remove();
						['success', 'danger', 'warning', 'info'].forEach((type) => {
							const el = document.createElement('div');
							el.className = 'toast notify notify-' + type;
							el.style.color = '#fff';
							document.body.appendChild(el);
							add(el);
							el.remove();
						});
						return { text: Math.min.apply(null, worst), iconRatio, iconColor };
					});
					const result = await ratio(page);
					expect(result.text).toBeGreaterThanOrEqual(4.5);
					// white glyph on the grey button, as on master (2.85:1, not the 1.57:1 of the grey text-muted glyph)
					expect(result.iconColor, 'icon of a round button').toBe('rgb(255, 255, 255)');
					expect(result.iconRatio).toBeGreaterThanOrEqual(2.8);
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
					await expect(page.locator('.driver-popover').first()).toBeVisible();
					expect(watched.errors).toEqual([]);
				});

				test('tutorial walks through all its steps and stores that it is finished', async ({ page }) => {
					const watched = watch(page);
					await page.goto('/dashboard');
					await settle(page);
					await page.click('#navbar-help');
					const popover = page.locator('.driver-popover');
					await expect(popover).toBeVisible();
					for (let i = 0; i < 20 && await popover.count(); i++) {
						await popover.locator('.driver-popover-next-btn').click();
						await page.waitForTimeout(150);
					}
					await expect(popover).toHaveCount(0);
					expect(await page.evaluate(() => localStorage.getItem('home_end'))).toBe('yes');
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
	if (vpName == 'tablet') {
		continue;
	}
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
