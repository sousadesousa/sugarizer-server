//include libraries
var superagent = require('superagent'),
	common = require('../../helper/common');

// Read the name of an assignment from the API (the launch and return links carry no name)
module.exports = function assignmentName(req, assignmentId, callback) {
	superagent
		.get(common.getAPIUrl(req) + 'api/v1/assignments/' + assignmentId)
		.set(common.getHeaders(req))
		.end(function (error, response) {
			var name = response && response.statusCode == 200 && response.body && response.body.name;
			callback(name || req.query.name || 'assignment');
		});
};
