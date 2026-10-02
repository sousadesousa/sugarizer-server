// Where the e2e tests read and write screenshots.
// - baseline: committed, read-only during a normal run. Only `npm run test:e2e:baseline` (E2E_BASELINE=1) writes it.
// - screenshots: written by every run, git-ignored (test-results/). E2E_SCREENSHOT_DIR changes it.
const path = require('path');

const root = path.resolve(__dirname, '../..');
const baselineMode = !!process.env.E2E_BASELINE;
const baselineDir = path.join(__dirname, 'baseline');
const screenshotsDir = baselineMode ? baselineDir : path.resolve(root, process.env.E2E_SCREENSHOT_DIR || 'test-results/screenshots');

module.exports = { root, baselineMode, baselineDir, screenshotsDir };
