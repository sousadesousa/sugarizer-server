var fs = require('fs');
var os = require('os');
var ini = null;
var crypto = require('crypto');
var AsyncLocalStorage = require('async_hooks').AsyncLocalStorage;
var moment = require('moment');
var version = '';

exports.init = function(settings) {
	ini = settings;
	var info = JSON.parse(fs.readFileSync("./package.json", 'utf-8'));
	version = info.version;
};

// language features
// The language is stored per request (not per process), so that concurrent users don't see each other's language
var languageContext = new AsyncLocalStorage();

function currentStore() {
	return languageContext.getStore();
}

exports.l10n = {
	setLanguage: function(lang) {
		var store = currentStore();
		if (store) {
			store.language = lang;
		}
	},

	getLanguage: function() {
		var store = currentStore();
		return store ? store.language : '*';
	},

	get: function(text, params) {
		var language = exports.l10n.getLanguage();
		var locales = Object.prototype.hasOwnProperty.call(ini.locales, language) ? ini.locales[language] : ini.locales['*'];
		var translate = locales[text];
		if (translate === undefined) {
			// not translated in this language: fallback to default
			translate = ini.locales['*'][text];
		}
		if (translate === undefined) {
			return text;
		}
		for (var param in params) {
			translate = translate.replace('{{'+param+'}}', params[param]);
		}
		return translate;
	}
};

// Is this a language we have locales for
function isKnownLanguage(lang) {
	return typeof lang == 'string' && lang != '*' && ini && ini.locales && Object.prototype.hasOwnProperty.call(ini.locales, lang);
}

// Middleware: run each dashboard request in its own language context.
// The language comes from the request (lang parameter) then from the session.
exports.languageMiddleware = function(req, res, next) {
	var lang = (req.query && req.query.lang) || (req.body && req.body.lang) || (req.session && req.session.lang);
	var store = { language: '*' };
	if (isKnownLanguage(lang)) {
		store.language = lang;
		if (req.session && req.session.lang !== lang) {
			req.session.lang = lang;
		}
	}
	res.locals.jsonForScript = exports.jsonForScript;
	languageContext.run(store, function() {
		next();
	});
};

// Middleware: protect the dashboard against cross-site requests.
// Each session has a random token, that requests changing something must send back (_csrf field, query or x-csrf-token header).
exports.csrfMiddleware = function(req, res, next) {
	if (!req.session) {
		return next();
	}
	if (!req.session.csrf) {
		req.session.csrf = crypto.randomBytes(32).toString('hex');
	}
	res.locals.csrfToken = req.session.csrf;
	if (req.method == 'GET' || req.method == 'HEAD' || req.method == 'OPTIONS') {
		return next();
	}
	var sent = (req.body && req.body._csrf) || (req.query && req.query._csrf) || req.headers['x-csrf-token'];
	var expected = Buffer.from(req.session.csrf);
	var received = Buffer.from(typeof sent == 'string' ? sent : '');
	if (received.length != expected.length || !crypto.timingSafeEqual(received, expected)) {
		return res.status(403).send('Invalid or missing security token. Please reload the page and try again.');
	}
	next();
};

// Start a new session for a user that just logged in (avoids session fixation), keeping the language
exports.startSession = function(req, user, callback) {
	var lang = req.session.lang;
	req.session.regenerate(function(err) {
		if (err) {
			return callback(err);
		}
		if (lang) {
			req.session.lang = lang;
		}
		req.session.user = user;
		callback();
	});
};

// Capture the current language context to run a callback in it later
exports.bindLanguage = function(fn) {
	var store = currentStore();
	if (!store) {
		return fn;
	}
	return function() {
		var args = arguments;
		var self = this;
		return languageContext.run(store, function() {
			return fn.apply(self, args);
		});
	};
};

// Language to use for dates (moment keeps a global locale)
exports.reinitLocale = function() {
	var lang = exports.l10n.getLanguage();
	if (isKnownLanguage(lang)) {
		moment.locale(lang);
	}
};

// Escape a value to put it in HTML text or in a quoted attribute
exports.escapeHtml = function(value) {
	if (value === undefined || value === null) {
		return '';
	}
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};

// Serialize a value to JSON that can safely be put in a <script> block
exports.jsonForScript = function(value) {
	var json = JSON.stringify(value);
	if (json === undefined) {
		return 'null';
	}
	return json
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
};

exports.loadCredentials = function(settings) {
	if (!settings.security.certificate_file || !settings.security.key_file) {
		return null;
	}
	var cert, key;
	try {
		cert = fs.readFileSync(settings.security.certificate_file);
		key = fs.readFileSync(settings.security.key_file);
		if (!settings.security.strict_ssl) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}
	} catch(err) {
		return null;
	}
	return {cert: cert, key: key};
};

exports.getHeaders = function(req) {

	// headers
	return {
		"content-type": "application/json",
		"x-access-token": (req.session.user ? req.session.user.token : ""),
		"x-key": (req.session.user ? req.session.user.user._id : ""),
	};
};

exports.getClientIP = function(req) {

	return req.headers['x-real-ip'] ||
		req.headers['x-forwarded-for'] ||
		req.connection.remoteAddress ||
		req.socket.remoteAddress ||
		req.connection.socket.remoteAddress;
};


exports.getServerIP = function() {

	var interfaces = os.networkInterfaces();
	var addresses = [];
	for (var i in interfaces) {
		for (var j in interfaces[i]) {
			var address = interfaces[i][j];
			if (address.family === 'IPv6' && !address.internal) {
				addresses.push(address.address);
			}
		}
	}
	addresses.push("::1");
	addresses.push("::ffff:127.0.0.1");
	addresses.push("127.0.0.1");
	return addresses;
};

// Check if a request comes from the server itself.
// Based on the socket address only: headers like X-Real-IP can be sent by anyone.
// Behind a reverse proxy the socket address is the proxy, so any forwarded address must be local too.
exports.isLocalRequest = function(req) {
	var local = exports.getServerIP();
	var socketAddress = (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress);
	if (local.indexOf(socketAddress) == -1) {
		return false;
	}
	var forwarded = [];
	if (req.headers['x-real-ip']) {
		forwarded.push(req.headers['x-real-ip']);
	}
	if (req.headers['x-forwarded-for']) {
		forwarded = forwarded.concat(req.headers['x-forwarded-for'].split(','));
	}
	for (var i = 0 ; i < forwarded.length ; i++) {
		if (local.indexOf(forwarded[i].trim()) == -1) {
			return false;
		}
	}
	return true;
};

exports.getAPIUrl = function() {
	return (ini.security.https ? 'https' : 'http' ) + "://localhost:" + ini.web.port + '/';
};


/**
 * @api {get} api/ Get server settings
 * @apiName GetAPIInfo
 * @apiDescription Retrieve server settings.
 * @apiGroup Information
 * @apiVersion 1.0.0
 *
 * @apiSuccess {Object} settings Settings object
 * @apiSuccess {String} settings.name Server name
 * @apiSuccess {String} settings.description Server description
 * @apiSuccess {String} settings.web Server web port
 * @apiSuccess {String} settings.presence Server presence port
 * @apiSuccess {String} settings.secure Server is secured using SSL
 * @apiSuccess {String} settings.version Server version
 * @apiSuccess {Object} settings.options Server options
 * @apiSuccess {String} settings.options.min-password-size Minimum size for password
 * @apiSuccess {Boolean} settings.options.statistics Statistics active or not
 * @apiSuccess {String} settings.options.cookie-age Expiration time for authentication token
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "name": "Sugarizer Server",
 *       "description": "Your Sugarizer Server",
 *       "web": "8080",
 *       "presence": "8039",
 *       "secure": false,
 *       "version": "1.2.0",
 *       "options":
 *       {
 *         "min-password-size": "4",
 *         "statistics": true,
 *         "cookie-age": "172800000"
 *       }
 *     }
 **/
exports.getAPIInfo = function(req, res) {
	res.send({
		"name": ini.information.name,
		"description": ini.information.description,
		"web": ini.web.port,
		"presence": ini.presence.port,
		"secure": ini.security.https,
		"version": version,
		"options": {
			"min-password-size": ini.security.min_password_size,
			"statistics": ini.statistics.active,
			"cookie-age": ini.security.max_age,
			"consent-need": ini.privacy.consent_need,
			"policy-url": ini.privacy.policy
		}
	});
};
