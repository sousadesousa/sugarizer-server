// Dashboard end-to-end tests (npm run test:e2e). The API tests are in api/test (npm test).
// CHROMIUM_PATH: browser to launch, defaults to the Playwright browser of the machine.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
	testDir: 'test/e2e',
	testMatch: '*.spec.js',
	globalSetup: require.resolve('./test/e2e/global-setup.js'),
	// one server and one database shared by all the tests
	workers: 1,
	fullyParallel: false,
	timeout: 60000,
	expect: { timeout: 10000 },
	reporter: [['list']],
	use: {
		launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] }
	}
});
