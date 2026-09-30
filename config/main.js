var express = require('express'),
	bodyParser = require('body-parser'),
	expressSession = require('express-session'),
	cookieParser = require('cookie-parser'),
	logger = require('morgan'),
	flash = require('express-flash'),
	expressValidator = require('express-validator'),
	cors = require('cors');
var artificialDelay = 0;

// configure app settings
module.exports = function(app, ini) {

	// add an artificial delay for debug
	if (artificialDelay) {
		app.use(function(req,res,next) {
			setTimeout(next, artificialDelay);
		});
	}

	// security headers
	app.disable('x-powered-by');
	app.use(function(req, res, next) {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('X-Frame-Options', 'SAMEORIGIN');
		res.setHeader('Referrer-Policy', 'same-origin');
		if (ini.security.https) {
			res.setHeader('Strict-Transport-Security', 'max-age=15552000');
		}
		next();
	});

	// must use cookieParser before express Session
	// session cookie is not readable from scripts and never sent on requests coming from other sites (CSRF)
	app.use(cookieParser());
	app.use(expressSession({
		secret: ini.security.secret,
		cookie: {
			maxAge: parseInt(ini.security.max_age),
			httpOnly: true,
			sameSite: 'strict',
			secure: !!ini.security.https
		},
		resave: true,
		saveUninitialized: true
	}));

	//include body parser
	app.use(bodyParser.urlencoded({
		limit: '256mb',
		extended: false
	}));
	app.use(bodyParser.json({
		limit: '256mb',
		type: 'application/json'
	}));

	//include expressValidator
	app.use(expressValidator());

	// include flash notification
	app.use(flash());

	//logger
	if (process.env.NODE_ENV !== 'test') {
		var level = ini.log?ini.log.level:1;
		if (level != 0) {
			app.use(logger('dev'));
		}
	}

	// Handle CORS request
	app.use(cors());

	// Add headers
	app.use(function(req, res, next) {
		if (!res.headersSent) {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
			res.setHeader('Access-Control-Allow-Headers', 'x-key,x-access-token');
		}
		next();
	});

	// header's fix
	app.use(function(req, res, next) {
		var _send = res.send;
		var sent = false;
		res.send = function(data) {
			if (sent) return;
			_send.bind(res)(data);
			sent = true;
		};
		next();
	});

	//store ini in every request useful for dashboard
	app.use(function(req, res, next) {
		req.iniconfig = ini;
		next();
	});

	// Set .html as the default template extension
	app.set('view engine', 'ejs');

	// Tell express where it can find the templates
	app.set('views', __dirname + '/../dashboard/views');

	// Make the files in the public folder available to the world
	app.use('/public', express.static(__dirname + '/../dashboard/public'));

	// Make the activities folder available to the world
	var clientpath = ini.client.path;
	if (clientpath[0] != '/') {
		clientpath = __dirname + '/../' + ini.client.path;
	}
	app.use('/', express.static(clientpath));

	// Make the docs folder available to the world
	app.use('/docs', express.static(__dirname + '/../docs/www'));
};
