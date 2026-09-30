// Limit failed login attempts to slow down password guessing
// A client is blocked for `window` ms after `max` failed attempts on the same account from the same address
// With `countAll`, every attempt counts: used for 2FA codes, where a wrong code still answers 200

module.exports = function(options) {
	var max = parseInt(options.max) || 10;
	var window = parseInt(options.window) || 15 * 60 * 1000;
	var keyOf = options.key;
	var countAll = !!options.countAll;
	var failures = new Map();

	// Remove expired entries from time to time
	var cleaner = setInterval(function() {
		var now = Date.now();
		failures.forEach(function(entry, key) {
			if (entry.reset <= now) {
				failures.delete(key);
			}
		});
	}, window);
	if (cleaner.unref) {
		cleaner.unref();
	}

	return function(req, res, next) {
		var key = (req.socket && req.socket.remoteAddress) + '|' + keyOf(req);
		var now = Date.now();
		var entry = failures.get(key);
		if (entry && entry.reset <= now) {
			failures.delete(key);
			entry = null;
		}
		if (entry && entry.count >= max) {
			res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
			return res.status(429).send({
				'error': 'Too many failed attempts, try again later',
				'code': 42
			});
		}
		res.on('finish', function() {
			if (countAll || res.statusCode == 401) {
				var current = failures.get(key);
				if (!current || current.reset <= Date.now()) {
					current = {count: 0, reset: Date.now() + window};
					failures.set(key, current);
				}
				current.count++;
			} else if (res.statusCode == 200 && !countAll) {
				failures.delete(key);
			}
		});
		next();
	};
};
