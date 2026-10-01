// Starts MongoDB (if MONGOD_BIN is set) and the server before the tests, stops them afterwards
var harness = require('./harness');

module.exports = async function() {
	var started = await harness.start();
	// the test workers inherit the environment
	process.env.E2E_INFO = JSON.stringify(started.info);
	return async function() {
		await harness.stop(started.state);
	};
};
