// Starts MongoDB (if MONGOD_BIN is set) and the server before the tests, stops them afterwards.
// Also empties the screenshot folder (the baseline folder only in baseline mode), so that it holds this run only.
var fs = require('fs'),
	path = require('path'),
	harness = require('./harness'),
	paths = require('./paths');

module.exports = async function() {
	if (paths.baselineMode) {
		// regenerate on purpose: the full suite writes all the files again
		if (fs.existsSync(paths.baselineDir)) {
			fs.readdirSync(paths.baselineDir).filter(function(name) {
				return path.extname(name) == '.png';
			}).forEach(function(name) {
				fs.rmSync(path.join(paths.baselineDir, name));
			});
		}
	} else {
		fs.rmSync(paths.screenshotsDir, {recursive: true, force: true});
	}
	fs.mkdirSync(paths.screenshotsDir, {recursive: true});

	var started = await harness.start();
	// the test workers inherit the environment
	process.env.E2E_INFO = JSON.stringify(started.info);
	return async function() {
		await harness.stop(started.state);
	};
};
