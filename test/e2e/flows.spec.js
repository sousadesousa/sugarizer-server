// Interactions that the Bootstrap 5 migration can break: forms, select2/datetimepicker/multi-select widgets,
// confirm dialogs, buttons that post (launch, return, logout). Each flow creates its own data, so the seed that the
// screenshots of dashboard.spec.js show is not touched (and dashboard.spec.js runs first anyway).
//
// NOT covered, on purpose:
// - POST /dashboard/users/import: only reachable by uploading a CSV file
// - GET /dashboard/activities/launch and /launch/:jid: open an activity in the browser (the activities are served by
//   the Sugarizer client, not by the dashboard)
// - POST /dashboard/profile/enable2FA and disable2FA, POST /dashboard/verify2FA: they need the one-time code of an
//   authenticator for a user that is not in the seed (the verify page and the enable page are in dashboard.spec.js)
// - POST /dashboard/journal/:jid/delete/:oid and /dashboard/assignments/delete/:id, POST /dashboard/users/edit of the
//   own profile: the same delete/edit mechanism as the flows below, not repeated
const { test, expect } = require('@playwright/test');
const { info, DASHBOARD_URL, prepareContext, serverReady, login, watch, settle, apiLogin, apiCall } = require('./support');

test.use({ baseURL: info.baseURL, viewport: { width: 1280, height: 800 } });

// Each flow starts from a page that is already logged in
async function loggedIn(browser, role) {
	const context = await browser.newContext({ baseURL: info.baseURL, viewport: { width: 1280, height: 800 } });
	await prepareContext(context);
	const page = await context.newPage();
	await login(page, info.users[role]);
	await page.waitForURL(DASHBOARD_URL);
	return { context, page };
}

// Message of a notification (flash message) of the dashboard
async function expectFlash(page, text) {
	await expect(page.locator('[data-notify="message"]').filter({ hasText: text }).first(), 'notification').toBeVisible();
}

function row(page, text) {
	return page.locator('tbody tr').filter({ hasText: text });
}

// A cell whose whole text is the given one (a name that is the beginning of another name is not matched)
function exactCell(page, text) {
	return page.locator('tbody td').filter({ hasText: new RegExp('^\\s*' + text + '\\s*$') });
}

// The delete links ask for a confirmation with the browser dialog: accepted, and the messages are kept
function acceptDialogs(page) {
	const messages = [];
	page.on('dialog', async (dialog) => {
		messages.push(dialog.message());
		await dialog.accept();
	});
	return messages;
}

test.describe.configure({ mode: 'serial' });

test.describe('admin forms', () => {
	let context, page, watched, dialogs;

	test.beforeAll(async ({ browser }) => {
		await serverReady();
		({ context, page } = await loggedIn(browser, 'admin'));
		watched = watch(page);
		dialogs = acceptDialogs(page);
	});

	test.afterAll(async () => {
		await context.close();
	});

	test('create, edit and delete a user', async () => {
		dialogs.length = 0;
		const name = 'E2E Flow User';
		const renamed = 'E2E Flow User Renamed';

		// create
		await page.goto('/dashboard/users/add');
		await settle(page);
		await page.fill('input[name="name"]', name);
		await page.selectOption('select[name="language"]', 'fr');
		await page.selectOption('select[name="role"]', 'student');
		await page.fill('input[name="password"]', 'flowpass');
		await page.click('button[type="submit"]');
		await expectFlash(page, 'User ' + name + ' has been successfully created!');
		await page.goto('/dashboard/users?q=' + encodeURIComponent(name));
		await settle(page);
		await expect(row(page, name), 'the new user is in the list').toHaveCount(1);

		// edit
		await row(page, name).locator('a[title="Edit User"]').click();
		await settle(page);
		await expect(page.locator('input[name="name"]')).toHaveValue(name);
		await expect(page.locator('select[name="language"]')).toHaveValue('fr');
		await page.fill('input[name="name"]', renamed);
		await page.selectOption('select[name="language"]', 'es');
		await page.click('button[type="submit"]');
		await expectFlash(page, 'User ' + renamed + ' has been successfully updated!');
		await page.goto('/dashboard/users?q=' + encodeURIComponent(renamed));
		await settle(page);
		await expect(row(page, renamed), 'the renamed user is in the list').toHaveCount(1);
		await expect(exactCell(page, name), 'the old name is gone').toHaveCount(0);

		// delete, with the confirmation
		await row(page, renamed).locator('a[title="Delete User"]').click();
		await expectFlash(page, 'User ' + renamed + ' has been successfully deleted!');
		expect(dialogs.length, 'a confirmation was asked').toBe(1);
		expect(dialogs[0]).toContain(renamed);
		await page.goto('/dashboard/users?q=' + encodeURIComponent(renamed));
		await settle(page);
		await expect(row(page, renamed), 'the user is gone').toHaveCount(0);
	});

	test('create, edit and delete a classroom', async () => {
		dialogs.length = 0;
		const name = 'E2E Flow Class';
		const renamed = 'E2E Flow Class Renamed';

		// create: name, a student chosen with the select2 search, an activity
		await page.goto('/dashboard/classrooms/add');
		await settle(page);
		await page.fill('input[name="name"]', name);
		await page.locator('.select2-selection--multiple').first().click();
		await page.locator('.select2-search__field').first().fill('E2E Student 1');
		await page.locator('.select2-results__option', { hasText: 'E2E Student 1' }).first().click();
		await expect(page.locator('.select2-selection__choice', { hasText: 'E2E Student 1' })).toHaveCount(1);
		await page.check('input[name="activities"][value="org.olpcfrance.PaintActivity"]');
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Classroom ' + name + ' has been successfully created!');
		await settle(page);
		await expect(row(page, name), 'the new classroom is in the list').toHaveCount(1);
		await expect(row(page, name).locator('td').nth(4), 'one student').toHaveText('1');

		// edit
		await row(page, name).locator('a[title="Edit Classroom"]').click();
		await settle(page);
		await expect(page.locator('input[name="name"]')).toHaveValue(name);
		await expect(page.locator('.select2-selection__choice', { hasText: 'E2E Student 1' }), 'the student is kept').toHaveCount(1);
		await expect(page.locator('input[name="activities"][value="org.olpcfrance.PaintActivity"]'), 'the activity is kept').toBeChecked();
		await page.fill('input[name="name"]', renamed);
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Classroom ' + renamed + ' has been successfully updated!');
		await settle(page);
		await expect(row(page, renamed), 'the renamed classroom is in the list').toHaveCount(1);

		// delete, with the confirmation
		await row(page, renamed).locator('a[title="Delete Classroom"]').click();
		await expectFlash(page, 'Classroom ' + renamed + ' has been successfully deleted!');
		expect(dialogs.length, 'a confirmation was asked').toBe(1);
		await settle(page);
		await expect(row(page, renamed), 'the classroom is gone').toHaveCount(0);
	});

	test('create and delete a chart', async () => {
		dialogs.length = 0;
		const title = 'E2E Flow Chart';

		await page.goto('/dashboard/stats/add');
		await settle(page);
		await page.fill('input[name="title"]', title);
		await page.click('label[for="pie"]');
		await page.click('label[for="how-users-are-active"]');
		await expect(page.locator('input[name="key"][value="how-users-are-active"]')).toBeChecked();
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Chart ' + title + ' has been successfully added!');
		await page.goto('/dashboard/stats/list');
		await settle(page);
		await expect(page.locator('a[data-name="' + title + '"][title="Delete Chart"]'), 'the new chart is in the list').toHaveCount(1);

		await page.locator('a[data-name="' + title + '"][title="Delete Chart"]').click();
		await expectFlash(page, 'Chart ' + title + ' has been successfully deleted!');
		expect(dialogs.length, 'a confirmation was asked').toBe(1);
		await settle(page);
		await expect(page.locator('a[data-name="' + title + '"]'), 'the chart is gone').toHaveCount(0);
	});

	// Data endpoints used by the pages (users select2, CSV export, charts)
	test('data endpoints answer', async () => {
		const search = await page.request.get('/dashboard/users/search?q=E2E');
		expect(search.status()).toBe(200);
		const found = (await search.json()).data.users.map((user) => user.name);
		expect(found).toContain(info.users.student1.name);

		const csv = await page.request.get('/dashboard/users/export');
		expect(csv.status()).toBe(200);
		expect(await csv.text()).toContain(info.users.student1.name);

		const graph = await page.request.get('/dashboard/stats/graph?type=how-users-are-active&element=how-users-are-active-chart');
		expect(graph.status()).toBe(200);
		const home = await page.request.get('/dashboard/graph?type=top-activities&element=top-activities-chart');
		expect(home.status()).toBe(200);
	});

	test('no uncaught page errors in the flows', async () => {
		expect(watched.errors).toEqual([]);
	});
});

test.describe('teacher assignment', () => {
	let context, page, watched;

	test.beforeAll(async ({ browser }) => {
		await serverReady();
		({ context, page } = await loggedIn(browser, 'teacher'));
		watched = watch(page);
	});

	test.afterAll(async () => {
		await context.close();
	});

	const name = 'E2E Flow Assignment';
	const renamed = 'E2E Flow Assignment Renamed';
	let assignmentId;

	test('create an assignment', async () => {
		await page.goto('/dashboard/assignments/add');
		await settle(page);
		await page.fill('input[name="name"]', name);
		// the work to assign, from the select2 list of the journal of the teacher
		await page.locator('.select2-selection').first().click();
		await page.locator('.select2-results__option', { hasText: 'E2E work' }).first().click();
		await page.fill('textarea[name="instructions"]', 'Do the flow');
		// due date: next month in the calendar, then a time in the list
		await page.click('#datetimepicker1');
		await page.locator('.xdsoft_datetimepicker:visible .xdsoft_next').first().click();
		await page.locator('.xdsoft_datetimepicker:visible .xdsoft_date:not(.xdsoft_other_month):not(.xdsoft_disabled)').nth(14).click();
		await expect(page.locator('#datetimepicker1')).not.toHaveValue('');
		await page.click('#timepicker');
		await page.locator('.xdsoft_datetimepicker:visible .xdsoft_time[data-hour="12"][data-minute="0"]').first().click();
		await expect(page.locator('#timepicker')).toHaveValue('12:00');
		// the classroom, with the two lists widget
		await page.locator('.ms-selectable .ms-elem-selectable', { hasText: 'E2E Class' }).first().click();
		await expect(page.locator('.ms-selection .ms-elem-selection.ms-selected', { hasText: 'E2E Class' })).toHaveCount(1);
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Assignment ' + name + ' has been successfully created!');
		await settle(page);
		await expect(row(page, name), 'the new assignment is in the list').toHaveCount(1);
		await expect(row(page, name)).toContainText('Created');
	});

	test('edit the assignment', async () => {
		await row(page, name).locator('a[title="Edit Assignment"]').click();
		await settle(page);
		await expect(page.locator('input[name="name"]')).toHaveValue(name);
		await expect(page.locator('textarea[name="instructions"]')).toHaveValue('Do the flow');
		// an assignment made by the dashboard has a date in the form (no "Invalid Date")
		await expect(page.locator('#datetimepicker1')).toHaveValue(/^\d+[-/.]\d+[-/.]\d+$/);
		await expect(page.locator('#timepicker')).toHaveValue('12:00');
		await page.fill('input[name="name"]', renamed);
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Assignment ' + renamed + ' has been successfully updated!');
		await settle(page);
		await expect(row(page, renamed)).toHaveCount(1);
		await expect(exactCell(page, name), 'the old name is gone').toHaveCount(0);
	});

	test('late turn in is stored as a boolean, ticked and unticked', async () => {
		const teacher = await apiLogin(info.users.teacher, 'teacher');
		const stored = async () => {
			const list = await apiCall('GET', '/api/v1/assignments?name=' + encodeURIComponent(renamed), null, teacher);
			return list.assignments[0];
		};
		async function saveWith(ticked) {
			await row(page, renamed).locator('a[title="Edit Assignment"]').click();
			await settle(page);
			await page.locator('input[name="lateTurnIn"]').setChecked(ticked);
			await page.click('button[type="submit"]');
			await expectFlash(page, 'Assignment ' + renamed + ' has been successfully updated!');
			await settle(page);
		}
		await saveWith(true);
		expect((await stored()).lateTurnIn, 'ticked').toBe(true);
		await row(page, renamed).locator('a[title="Edit Assignment"]').click();
		await settle(page);
		await expect(page.locator('input[name="lateTurnIn"]')).toBeChecked();
		await page.goto('/dashboard/assignments');
		await settle(page);
		await saveWith(false);
		expect((await stored()).lateTurnIn, 'unticked').toBe(false);
		await row(page, renamed).locator('a[title="Edit Assignment"]').click();
		await settle(page);
		await expect(page.locator('input[name="lateTurnIn"]')).not.toBeChecked();
		await page.goto('/dashboard/assignments');
		await settle(page);
	});

	test('launch the assignment and open its deliveries', async () => {
		const launch = row(page, renamed).locator('a[title="Launch Assignment"]');
		assignmentId = (await launch.getAttribute('href')).split('/').pop();
		await launch.click();
		await expectFlash(page, 'Assignment ' + renamed + ' has been successfully launched!');
		await settle(page);
		await expect(row(page, renamed)).toContainText('Assigned');

		await row(page, renamed).locator('a#assignment-deliveries').click();
		await settle(page);
		await expect(page).toHaveURL(new RegExp('/dashboard/assignments/deliveries/' + assignmentId));
		await expect(page.locator('#deliveries-card'), 'a delivery for each student of the classroom').toHaveCount(2);
		await expect(page.locator('#deliveries-card').first()).toContainText('Expected');
	});

	test('add a comment to a delivery', async () => {
		await page.goto('/dashboard/assignments/deliveries/' + assignmentId);
		await settle(page);
		const first = page.locator('#deliveries-card').first();
		const student = (await first.locator('td').nth(3).innerText()).trim();
		await first.locator('a[title="Comment"]').click();
		await settle(page);
		await page.fill('input[name="comment"]', 'Well done');
		await page.click('button[type="submit"]');
		await expectFlash(page, 'Comment has been successfully added!');
		await settle(page);
		await expect(page.locator('#deliveries-card').filter({ hasText: student })).toContainText('Well done');
	});

	test('return a delivery after the student handed it in', async () => {
		// a student hands in the work: that is done in the Sugarizer client, here with the API
		const teacher = await apiLogin(info.users.teacher, 'teacher');
		const deliveries = (await apiCall('GET', '/api/v1/assignments/deliveries/' + assignmentId, null, teacher)).deliveries;
		const delivery = deliveries[0].content[0];
		const studentKey = delivery.metadata.buddy_name == info.users.student1.name ? 'student1' : 'student2';
		const student = await apiLogin(info.users[studentKey], 'student');
		await apiCall('PUT', '/api/v1/assignments/deliveries/submit/' + assignmentId + '?oid=' + delivery.objectId, {}, student);

		await page.goto('/dashboard/assignments/deliveries/' + assignmentId);
		await settle(page);
		const handedIn = page.locator('#deliveries-card').filter({ hasText: delivery.metadata.buddy_name });
		await expect(handedIn).toContainText('Delivered');
		await handedIn.locator('a[title="Return"]').click();
		await expectFlash(page, 'Assignment ' + renamed + ' has been successfully returned!');
		await settle(page);
		await expect(page.locator('#deliveries-card').filter({ hasText: delivery.metadata.buddy_name })).toContainText('Expected');
		await expect(page.locator('#deliveries-card').filter({ hasText: delivery.metadata.buddy_name }).locator('.returnAssignment-icon-inactive')).toHaveCount(1);
	});

	test('no uncaught page errors in the flows', async () => {
		expect(watched.errors).toEqual([]);
	});
});

test('log out', async ({ browser }) => {
	await serverReady();
	const { context, page } = await loggedIn(browser, 'admin');
	const watched = watch(page);
	await page.goto('/dashboard');
	await settle(page);
	// the user menu of the navbar
	await page.locator('.navbar .dropdown-toggle').click();
	await page.locator('.navbar .dropdown-menu a[data-l10n-id="logout"]').click();
	await expect(page).toHaveURL(/\/dashboard\/login/);
	await expect(page.locator('input[name="username"]')).toBeVisible();
	// the session is over: a page of the dashboard sends back to the login
	await page.goto('/dashboard/users');
	await expect(page).toHaveURL(/\/dashboard\/login/);
	expect(watched.errors).toEqual([]);
	await context.close();
});
