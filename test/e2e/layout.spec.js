// Generic layout check of the form pages on a phone (390x844), as admin and as teacher where the page exists:
// - every visible field, button, label and widget lies horizontally inside the content box of its card (1 px of slack),
//   so nothing sticks out of the card padding or sits on its border;
// - every button of the card can be clicked: a Playwright trial click fails when another element intercepts the
//   pointer events (floated buttons that pile up on a narrow screen, for example).
// It exists because the screenshots of the suite do not tell that a widget is 40 px too wide or a button is covered.
const { test, expect } = require('@playwright/test');
const { info, VIEWPORTS, DASHBOARD_URL, prepareContext, serverReady, login, watch, settle } = require('./support');

const ids = info.ids;
test.use({ baseURL: info.baseURL, viewport: VIEWPORTS.mobile });

// the form pages. admin: only for admins; teacher: false when a teacher is redirected
const FORMS = [
	{ slug: 'users-add', path: '/dashboard/users/add' },
	{ slug: 'users-edit', path: '/dashboard/users/edit/' + ids.student1 },
	{ slug: 'classrooms-add', path: '/dashboard/classrooms/add', admin: true },
	{ slug: 'classrooms-edit', path: '/dashboard/classrooms/edit/' + ids.classroom, admin: true },
	// an admin is redirected to the journals: the page exists for the teacher only
	{ slug: 'assignments-add', path: '/dashboard/assignments/add', teacher: true },
	{ slug: 'assignments-edit', path: '/dashboard/assignments/edit/' + ids.assignment, teacher: true },
	{ slug: 'deliveries-comment', path: '/dashboard/assignments/deliveries/comment/' + ids.assignment + '?oid=none', teacher: true },
	{ slug: 'charts-add', path: '/dashboard/stats/add', admin: true },
	{ slug: 'charts-edit', path: '/dashboard/stats/edit/' + ids.chart, admin: true },
	{ slug: 'profile', path: '/dashboard/profile' },
	{ slug: 'two-factor-enable', path: '/dashboard/profile/enable2FA' }
];

const CONTROLS = 'input:not([type="hidden"]), select, textarea, button, a.btn, label, .ms-container, .select2-container, .form-check';

// Runs in the browser: the controls of the card that are not inside the content box of its body
function outsideTheCard(selector) {
	const out = [];
	const card = document.querySelector('.content .card');
	if (!card) {
		return ['no card on the page'];
	}
	const body = card.querySelector('.card-body') || card;
	const style = getComputedStyle(body);
	const box = body.getBoundingClientRect();
	const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
	const right = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
	for (const el of card.querySelectorAll(selector)) {
		const s = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		// not displayed, or the hidden original of a widget (select2: 1 px and clipped, multi-select: parked at -9999 px)
		if (s.display == 'none' || s.visibility == 'hidden' || r.width < 2 || r.height < 2 || r.right < -1000 || el.closest('.select2-dropdown, .table-responsive, [hidden]')) {
			continue;
		}
		if (r.left < left - 1 || r.right > right + 1) {
			out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && el.className.baseVal === undefined ? '.' + String(el.className).trim().replace(/\s+/g, '.') : '')) +
				' x=' + Math.round(r.left) + '..' + Math.round(r.right) + ' (card content ' + Math.round(left) + '..' + Math.round(right) + ')');
		}
	}
	return out;
}

for (const role of ['admin', 'teacher']) {
	test.describe('form pages on a phone, ' + role, () => {
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

		for (const p of FORMS) {
			if ((p.admin && role != 'admin') || (p.teacher && role != 'teacher')) {
				continue;
			}
			test(p.slug, async ({ page }) => {
				const watched = watch(page);
				await page.goto(p.path);
				await settle(page);
				expect(new URL(page.url()).pathname, 'the page is not redirected').toBe(p.path.split('?')[0]);

				expect.soft(await page.evaluate(outsideTheCard, CONTROLS), 'controls outside the content box of the card').toEqual([]);

				// every button can be clicked (trial: nothing is pressed)
				const buttons = page.locator('.content .card :is(button, a.btn):visible');
				const count = await buttons.count();
				expect(count, 'the form has buttons').toBeGreaterThan(0);
				for (let i = 0; i < count; i++) {
					const label = (await buttons.nth(i).innerText()).trim() || (await buttons.nth(i).getAttribute('title')) || 'button ' + i;
					await buttons.nth(i).click({ trial: true, timeout: 3000 }).catch((e) => {
						throw new Error('"' + label + '" cannot be clicked: ' + e.message.split('\n').slice(0, 3).join(' '));
					});
				}
				expect(watched.errors).toEqual([]);
			});
		}
	});
}
