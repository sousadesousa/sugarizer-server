// Unit tests for server hardening, no database needed
process.env.NODE_ENV = 'test';

var chai = require('chai');
var fs = require('fs');
var os = require('os');
var path = require('path');
var common = require('../../../dashboard/helper/common');
var limiter = require('../../../api/middleware/loginLimiter');
var EventEmitter = require('events');

chai.should();

// Fake express request and response
function fakeRequest(address, headers, body) {
	return {socket: {remoteAddress: address}, headers: headers || {}, body: body || {}};
}
function fakeResponse() {
	var res = new EventEmitter();
	res.statusCode = 200;
	res.headers = {};
	res.body = null;
	res.setHeader = function(name, value) {
		res.headers[name] = value;
	};
	res.status = function(code) {
		res.statusCode = code;
		return res;
	};
	res.send = function(body) {
		res.body = body;
		res.emit('finish');
	};
	return res;
}

describe('Local request check', function() {
	it('it should accept IPv4 and IPv6 loopback', function() {
		common.isLocalRequest(fakeRequest('127.0.0.1')).should.be.eql(true);
		common.isLocalRequest(fakeRequest('::1')).should.be.eql(true);
		common.isLocalRequest(fakeRequest('::ffff:127.0.0.1')).should.be.eql(true);
	});

	it('it should reject a remote address even with forged headers', function() {
		common.isLocalRequest(fakeRequest('192.0.2.10', {'x-real-ip': '::1'})).should.be.eql(false);
		common.isLocalRequest(fakeRequest('192.0.2.10', {'x-forwarded-for': '127.0.0.1'})).should.be.eql(false);
	});

	it('it should reject a remote client forwarded by a local proxy', function() {
		common.isLocalRequest(fakeRequest('127.0.0.1', {'x-real-ip': '192.0.2.10'})).should.be.eql(false);
		common.isLocalRequest(fakeRequest('127.0.0.1', {'x-forwarded-for': '127.0.0.1, 192.0.2.10'})).should.be.eql(false);
	});
});

describe('Login limiter', function() {
	function attempt(middleware, address, name, status) {
		var req = fakeRequest(address, {}, {name: name});
		var res = fakeResponse();
		var passed = false;
		middleware(req, res, function() {
			passed = true;
			res.status(status).send({});
		});
		return {passed: passed, res: res};
	}
	var keyOf = function(req) {
		return req.body.name;
	};

	it('it should block after too many failures on an account', function() {
		var middleware = limiter({max: 3, window: 60000, key: keyOf});
		for (var i = 0 ; i < 3 ; i++) {
			attempt(middleware, '192.0.2.1', 'kid', 401).passed.should.be.eql(true);
		}
		var blocked = attempt(middleware, '192.0.2.1', 'kid', 200);
		blocked.passed.should.be.eql(false);
		blocked.res.statusCode.should.be.eql(429);
		blocked.res.body.code.should.be.eql(42);
		blocked.res.headers['Retry-After'].should.be.above(0);
	});

	it('it should not block other accounts or addresses', function() {
		var middleware = limiter({max: 3, window: 60000, key: keyOf});
		for (var i = 0 ; i < 3 ; i++) {
			attempt(middleware, '192.0.2.1', 'kid', 401);
		}
		attempt(middleware, '192.0.2.1', 'other', 200).passed.should.be.eql(true);
		attempt(middleware, '192.0.2.2', 'kid', 200).passed.should.be.eql(true);
	});

	it('it should reset the count after a success', function() {
		var middleware = limiter({max: 3, window: 60000, key: keyOf});
		attempt(middleware, '192.0.2.1', 'kid', 401);
		attempt(middleware, '192.0.2.1', 'kid', 401);
		attempt(middleware, '192.0.2.1', 'kid', 200);
		attempt(middleware, '192.0.2.1', 'kid', 401);
		attempt(middleware, '192.0.2.1', 'kid', 401);
		attempt(middleware, '192.0.2.1', 'kid', 200).passed.should.be.eql(true);
	});

	it('it should count every attempt when asked to', function() {
		var middleware = limiter({max: 2, window: 60000, key: keyOf, countAll: true});
		attempt(middleware, '192.0.2.1', 'kid', 200);
		attempt(middleware, '192.0.2.1', 'kid', 200);
		attempt(middleware, '192.0.2.1', 'kid', 200).passed.should.be.eql(false);
	});
});

describe('Secret', function() {
	var cwd = process.cwd();
	var dir;
	var env = process.env.SUGARIZER_SECRET;
	var settings = require('../../../config/settings');

	beforeEach(function() {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sugarizer-'));
		fs.mkdirSync(path.join(dir, 'env'));
		fs.mkdirSync(path.join(dir, 'dashboard/public/l10n'), {recursive: true});
		fs.writeFileSync(path.join(dir, 'dashboard/public/l10n/locales.ini'), '');
		process.chdir(dir);
		delete process.env.SUGARIZER_SECRET;
	});

	afterEach(function() {
		process.chdir(cwd);
		if (env) {
			process.env.SUGARIZER_SECRET = env;
		} else {
			delete process.env.SUGARIZER_SECRET;
		}
	});

	function writeSettings(secret) {
		fs.writeFileSync(path.join(dir, 'env/test.ini'), '[security]\nsecret=' + secret + '\n');
	}

	it('it should generate and keep a secret instead of the default one', function() {
		writeSettings('super.sugarizer.server.key');
		var first = settings.load().security.secret;
		first.should.not.be.eql('super.sugarizer.server.key');
		first.length.should.be.above(40);
		(fs.statSync('env/secret.key').mode & 511).should.be.eql(384);
		settings.load().security.secret.should.be.eql(first);
	});

	it('it should generate a secret when none is set', function() {
		writeSettings('');
		settings.load().security.secret.length.should.be.above(40);
	});

	it('it should use the secret from the settings file', function() {
		writeSettings('my.own.secret');
		settings.load().security.secret.should.be.eql('my.own.secret');
		fs.existsSync('env/secret.key').should.be.eql(false);
	});

	it('it should prefer the environment variable', function() {
		writeSettings('my.own.secret');
		process.env.SUGARIZER_SECRET = 'from.environment';
		settings.load().security.secret.should.be.eql('from.environment');
	});
});
