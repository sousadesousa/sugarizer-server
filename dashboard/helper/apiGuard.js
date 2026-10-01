// Guard for the calls the dashboard makes to the server API with superagent:
// - the callback runs in the language context of the request that started the call
// - a network error (no response) gives a 503 response instead of an exception in the callback
var superagent = require('superagent');
var common = require('./common');

var installed = false;

exports.install = function() {
	if (installed) {
		return;
	}
	installed = true;
	var originalEnd = superagent.Request.prototype.end;
	superagent.Request.prototype.end = function(callback) {
		if (typeof callback != 'function') {
			return originalEnd.call(this, callback);
		}
		var bound = common.bindLanguage(function(error, response) {
			if (error && !response) {
				response = {
					statusCode: 503,
					status: 503,
					ok: false,
					body: { code: 'Network', error: error.message || 'Network error' }
				};
			}
			return callback.call(this, error, response);
		});
		return originalEnd.call(this, bound);
	};
};
