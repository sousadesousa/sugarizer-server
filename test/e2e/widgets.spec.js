// The two jQuery plugins that run on jQuery 3.7 since the Bootstrap 5 migration and that the other specs do not drive
// with the mouse: the sortable list of the activities (jQuery UI sortable) and the two lists widget (multi-select) of
// the user form. Each test puts the data back as it found it (this spec runs after the screenshots were taken).
const { test, expect } = require('@playwright/test');
const { info, DASHBOARD_URL, prepareContext, serverReady, login, watch, settle } = require('./support');

test.use({ baseURL: info.baseURL, viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

test.describe('widgets (admin)', () => {
	let context, page, watched;

	test.beforeAll(async ({ browser }) => {
		await serverReady();
		context = await browser.newContext({ baseURL: info.baseURL, viewport: { width: 1280, height: 800 } });
		await prepareContext(context);
		page = await context.newPage();
		await login(page, info.users.admin);
		await page.waitForURL(DASHBOARD_URL);
		watched = watch(page);
	});

	test.afterAll(async () => {
		await context.close();
	});

	async function names() {
		return page.locator('ol.simple_with_animation li .search_textbox').allInnerTexts();
	}

	// drags the handle of an item of the list onto another item, with real mouse events
	async function drag(from, to) {
		const handle = page.locator('ol.simple_with_animation li').nth(from).locator('.draggable');
		const target = page.locator('ol.simple_with_animation li').nth(to);
		const a = await handle.boundingBox();
		const b = await target.boundingBox();
		await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
		await page.mouse.down();
		await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 5, { steps: 3 });
		await page.mouse.move(a.x + a.width / 2, to > from ? b.y + b.height / 2 + 10 : b.y - 8, { steps: 15 });
		await page.mouse.move(a.x + a.width / 2, (to > from ? b.y + b.height / 2 + 14 : b.y - 12), { steps: 5 });
		await page.mouse.up();
	}

	test('the activities list is sortable and the new order is saved', async () => {
		await page.goto('/dashboard/activities');
		await settle(page);
		const before = await names();
		expect(before.length).toBeGreaterThan(2);

		const saved = page.waitForResponse((r) => r.url().includes('api/v1/activities') && r.request().method() == 'POST');
		await drag(0, 1);
		const response = await saved;
		expect(response.status()).toBe(200);
		const after = await names();
		expect(after, 'the first activity moved down').not.toEqual(before);
		expect(after[0]).not.toBe(before[0]);
		expect(after).toContain(before[0]);
		// the order is the one of the server after a reload
		await page.reload();
		await settle(page);
		expect(await names()).toEqual(after);

		// put it back: the first one again goes below the second one
		const restored = page.waitForResponse((r) => r.url().includes('api/v1/activities') && r.request().method() == 'POST');
		await drag(0, 1);
		await restored;
		await page.reload();
		await settle(page);
		expect(await names()).toEqual(before);
		expect(watched.errors).toEqual([]);
	});

	test('the two lists widget moves a classroom and filters its list', async () => {
		await page.goto('/dashboard/users/edit/' + info.ids.student1);
		await settle(page);
		const selected = page.locator('.ms-selection .ms-elem-selection.ms-selected', { hasText: 'E2E Class' });
		const selectable = page.locator('.ms-selectable .ms-elem-selectable', { hasText: 'E2E Class' });
		await expect(selected).toHaveCount(1);

		// the search box above the left list hides what does not match
		const search = page.locator('.ms-selectable input[type="text"]').first();
		await search.fill('no such classroom');
		await expect(page.locator('.ms-selectable .ms-elem-selectable:visible')).toHaveCount(0);
		await search.fill('');

		// out of the classroom, saved
		await selected.click();
		await expect(selected).toHaveCount(0);
		await page.click('button[type="submit"]');
		await page.waitForURL(/\/dashboard\/users/);
		await page.goto('/dashboard/users/edit/' + info.ids.student1);
		await settle(page);
		await expect(selected).toHaveCount(0);

		// back in the classroom, saved
		await selectable.first().click();
		await expect(selected).toHaveCount(1);
		await page.click('button[type="submit"]');
		await page.waitForURL(/\/dashboard\/users/);
		await page.goto('/dashboard/users/edit/' + info.ids.student1);
		await settle(page);
		await expect(selected).toHaveCount(1);
		expect(watched.errors).toEqual([]);
	});
});
