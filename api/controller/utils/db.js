// MongoDB driver helpers

// Call a Node.js style callback(err, result) when a driver promise settles
exports.callback = function(promise, callback) {
	promise.then(function(result) {
		callback(null, result);
	}, function(err) {
		callback(err);
	});
};

// Call a callback(err, cursor) with a cursor: aggregate() returns it directly
exports.cursor = function(cursor, callback) {
	callback(null, cursor);
};

// Number of documents inserted, matched or deleted by a write
exports.affected = function(result) {
	if (!result) {
		return 0;
	}
	if (typeof result.matchedCount == 'number') {
		return result.matchedCount;
	}
	if (typeof result.deletedCount == 'number') {
		return result.deletedCount;
	}
	if (typeof result.insertedCount == 'number') {
		return result.insertedCount;
	}
	return result.insertedId ? 1 : 0;
};
