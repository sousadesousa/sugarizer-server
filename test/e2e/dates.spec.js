// Due date of the assignment form, for users in different regions and time zones.
// The date order of the picker follows the region of the browser (not the language of the dashboard), and the
// date and time of the form are the ones of the browser time zone, on the add page and on the edit page.
// Each case uses the real pickers (calendar and time list) in a browser context with its own locale and time zone.
const { test, expect } = require('@playwright/test');
const { info, DASHBOARD_URL, prepareContext, serverReady, login, watch, settle, apiLogin, apiCall } = require('./support');

test.use({ baseURL: info.baseURL });

// Epoch (ms) of a wall clock time in a time zone
function zonedEpoch(year, month, day, hour, minute, timeZone) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
	});
	const offsetAt = (time) => {
		const p = Object.fromEntries(parts.formatToParts(new Date(time)).map((part) => [part.type, Number(part.value)]));
		return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - time;
	};
	const wanted = Date.UTC(year, month - 1, day, hour, minute);
	let guess = wanted - offsetAt(wanted);
	guess = wanted - offsetAt(guess);
	return guess;
}

// The browser clock is the fixed time of the harness (2035-03-15 10:00 UTC): "day + 7" is 2035-03-22
const CASES = [
	{ id: 'zurich', timeZone: 'Europe/Zurich', locale: 'de-CH', day: [2035, 3, 22], monthsAhead: 0, text: '22.03.2035' },
	{ id: 'zurich summer', timeZone: 'Europe/Zurich', locale: 'de-CH', day: [2035, 7, 15], monthsAhead: 4, text: '15.07.2035' },
	{ id: 'new york', timeZone: 'America/New_York', locale: 'en-US', day: [2035, 3, 22], monthsAhead: 0, text: '03/22/2035' },
	{ id: 'paris', timeZone: 'Europe/Paris', locale: 'fr-FR', day: [2035, 3, 22], monthsAhead: 0, text: '22/03/2035' },
	{ id: 'tokyo', timeZone: 'Asia/Tokyo', locale: 'ja-JP', day: [2035, 3, 22], monthsAhead: 0, text: '2035/03/22' }
];

async function teacherPage(browser, options) {
	await serverReady();
	const context = await browser.newContext(Object.assign({ baseURL: info.baseURL, viewport: { width: 1280, height: 800 } }, options));
	await prepareContext(context);
	const page = await context.newPage();
	await login(page, info.users.teacher);
	await page.waitForURL(DASHBOARD_URL);
	return { context, page };
}

// Message of a notification (flash message) of the dashboard
async function expectFlash(page, text) {
	await expect(page.locator('[data-notify="message"]').filter({ hasText: text }).first(), 'notification').toBeVisible();
}

// Pick a day in the calendar of the date field, `monthsAhead` months after the current one
async function pickDay(page, [year, month, day], monthsAhead) {
	await page.click('#datetimepicker1');
	const picker = page.locator('.xdsoft_datetimepicker:visible').first();
	for (let i = 0; i < monthsAhead; i++) {
		await picker.locator('.xdsoft_monthpicker .xdsoft_next').click();
	}
	await picker.locator('.xdsoft_date[data-year="' + year + '"][data-month="' + (month - 1) + '"][data-date="' + day + '"]').click();
}

// Pick a time in the list of the time field. The field is under the list: the click is sent to the item
async function pickTime(page, hour, minute) {
	await page.click('#timepicker');
	await page.locator('.xdsoft_datetimepicker:visible .xdsoft_time[data-hour="' + hour + '"][data-minute="' + minute + '"]').first().dispatchEvent('click');
}

// Fields of the add form, except the due date
async function fillAddForm(page, name) {
	await page.goto('/dashboard/assignments/add');
	await settle(page);
	await page.fill('input[name="name"]', name);
	await page.locator('.select2-selection').first().click();
	await page.locator('.select2-results__option', { hasText: 'E2E work' }).first().click();
	await page.fill('textarea[name="instructions"]', 'Dates');
	await page.locator('.ms-selectable .ms-elem-selectable', { hasText: 'E2E Class' }).first().click();
}

// What the API stored for the assignment of that name
async function storedAssignment(name) {
	const teacher = await apiLogin(info.users.teacher, 'teacher');
	const list = await apiCall('GET', '/api/v1/assignments?limit=100', null, teacher);
	return list.assignments.find((assignment) => assignment.name == name);
}

for (const c of CASES) {
	test.describe('due date, ' + c.id + ' (' + c.locale + ', ' + c.timeZone + ')', () => {
		const name = 'E2E Date ' + c.id.replace(/[^a-z ]/gi, '');
		const expected = zonedEpoch(c.day[0], c.day[1], c.day[2], 10, 0, c.timeZone);
		test.describe.configure({ mode: 'serial' });
		let context, page, watched;

		test.beforeAll(async ({ browser }) => {
			({ context, page } = await teacherPage(browser, { locale: c.locale, timezoneId: c.timeZone }));
			watched = watch(page);
		});

		test.afterAll(async () => {
			await context.close();
		});

		test('create with the pickers: the date uses the order of the region, the stored time is local', async () => {
			await fillAddForm(page, name);
			await pickDay(page, c.day, c.monthsAhead);
			await expect(page.locator('#datetimepicker1'), 'date in the order of the region').toHaveValue(c.text);
			await pickTime(page, 10, 0);
			await expect(page.locator('#timepicker')).toHaveValue('10:00');
			await page.click('button[type="submit"]');
			await expectFlash(page, 'Assignment ' + name + ' has been successfully created!');
			const stored = await storedAssignment(name);
			expect(stored, 'the assignment is stored').toBeTruthy();
			expect(new Date(Number(stored.dueDate)).toISOString(), 'due 10:00 local time').toBe(new Date(expected).toISOString());
		});

		test('edit page: same local date and time, saved unchanged', async () => {
			const before = await storedAssignment(name);
			await page.goto('/dashboard/assignments/edit/' + before._id);
			await settle(page);
			await expect(page.locator('#datetimepicker1')).toHaveValue(c.text);
			await expect(page.locator('#timepicker')).toHaveValue('10:00');
			await expect(page.locator('form')).not.toContainText('Invalid');
			await page.click('button[type="submit"]');
			await expectFlash(page, 'Assignment ' + name + ' has been successfully updated!');
			const after = await storedAssignment(name);
			expect(Number(after.dueDate), 'the due date is unchanged').toBe(Number(before.dueDate));
		});

		test('edit page of an assignment made through the API: local date and time, no "Invalid Date"', async () => {
			// The API stores the due date as given: here 10:00 of the region, as a number
			const teacher = await apiLogin(info.users.teacher, 'teacher');
			const apiName = name + ' Api';
			const created = await apiCall('POST', '/api/v1/assignments/', {
				assignment: JSON.stringify({
					name: apiName,
					assignedWork: 'ffffffff-ffff-ffff-ffff-fffffffffff1',
					color: { stroke: '#FF0000', fill: '#0000FF' },
					instructions: 'Dates',
					lateTurnIn: false,
					classrooms: [info.ids.classroom],
					dueDate: expected
				})
			}, teacher);
			await page.goto('/dashboard/assignments/edit/' + created._id);
			await settle(page);
			await expect(page.locator('#datetimepicker1')).toHaveValue(c.text);
			await expect(page.locator('#timepicker')).toHaveValue('10:00');
			await expect(page.locator('form')).not.toContainText('Invalid');
		});

		test('no uncaught page errors', async () => {
			expect(watched.errors).toEqual([]);
		});
	});
}

test.describe('due date, wrong values', () => {
	// each test starts from its own page: a failure does not hide the others
	let context, page;

	test.beforeAll(async ({ browser }) => {
		({ context, page } = await teacherPage(browser, { locale: 'de-CH', timezoneId: 'Europe/Zurich' }));
	});

	test.afterAll(async () => {
		await context.close();
	});

	test('a date without time says that the date and the time are missing', async () => {
		await fillAddForm(page, 'E2E Date No Time');
		await pickDay(page, [2035, 3, 22], 0);
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Please choose a due date and a time');
		expect(await storedAssignment('E2E Date No Time'), 'nothing saved').toBeFalsy();
	});

	test('a time without date says that the date and the time are missing', async () => {
		await fillAddForm(page, 'E2E Date No Day');
		await pickTime(page, 10, 0);
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Please choose a due date and a time');
		expect(await storedAssignment('E2E Date No Day'), 'nothing saved').toBeFalsy();
	});

	test('a typed date that the picker cannot read says that the date and the time are missing', async () => {
		await fillAddForm(page, 'E2E Date Typed');
		await page.fill('#datetimepicker1', 'tomorrow');
		await pickTime(page, 10, 0);
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Please choose a due date and a time');
		expect(await storedAssignment('E2E Date Typed'), 'nothing saved').toBeFalsy();
	});

	test('a hidden value that is not a number is refused, not sent to the API as NaN', async () => {
		await fillAddForm(page, 'E2E Date Nan');
		await pickDay(page, [2035, 3, 22], 0);
		await pickTime(page, 10, 0);
		// submitted from the script: a click on the button would blur the time field, and the picker would write
		// the right numbers again
		await page.evaluate(() => {
			document.querySelector('#dueDatestamp').value = 'NaN';
			document.querySelector('#assignment-add-edit-form').requestSubmit();
		});
		await expectFlash(page, 'Please choose a due date and a time');
		expect(await storedAssignment('E2E Date Nan'), 'nothing saved').toBeFalsy();
	});

	test('a time already past today says that the date must be in the future', async () => {
		await fillAddForm(page, 'E2E Date Past');
		await pickDay(page, [2035, 3, 15], 0);
		await pickTime(page, 0, 0);
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Due date must be in the future');
		expect(await storedAssignment('E2E Date Past'), 'nothing saved').toBeFalsy();
	});
});
