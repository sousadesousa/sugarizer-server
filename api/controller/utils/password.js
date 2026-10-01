// Password hashing helpers, based on Node's built-in scrypt
var crypto = require('crypto');

var PREFIX = 'scrypt';
var KEY_LENGTH = 64;
var SALT_LENGTH = 16;
var COST = 16384;

// Return true if the stored value is already a hash produced by this module
exports.isHashed = function(stored) {
	return typeof stored === 'string' && stored.split('$')[0] === PREFIX && stored.split('$').length === 4;
};

// Hash a clear password, callback(err, hash)
exports.hash = function(password, callback) {
	var salt = crypto.randomBytes(SALT_LENGTH);
	crypto.scrypt(String(password), salt, KEY_LENGTH, {N: COST}, function(err, key) {
		if (err) {
			return callback(err);
		}
		callback(null, [PREFIX, COST, salt.toString('base64'), key.toString('base64')].join('$'));
	});
};

// Check a clear password against a stored value, callback(err, match, needsRehash)
// Stored values that are not hashed yet are legacy clear passwords: they are compared
// case insensitively like the previous login did, and flagged to be rehashed
exports.verify = function(password, stored, callback) {
	if (typeof password !== 'string' || typeof stored !== 'string' || !stored.length) {
		return callback(null, false, false);
	}
	if (!exports.isHashed(stored)) {
		return callback(null, password.toLowerCase() === stored.toLowerCase(), true);
	}
	var parts = stored.split('$');
	var cost = parseInt(parts[1]);
	var salt = Buffer.from(parts[2], 'base64');
	var expected = Buffer.from(parts[3], 'base64');
	crypto.scrypt(password, salt, expected.length, {N: cost}, function(err, key) {
		if (err) {
			return callback(err);
		}
		callback(null, crypto.timingSafeEqual(key, expected), cost !== COST);
	});
};

// Escape a string to use it as a literal inside a regular expression
exports.escapeRegex = function(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
