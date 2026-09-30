// Unit tests for authentication, no database needed
process.env.NODE_ENV = 'test';

var chai = require('chai');
var jwt = require('jwt-simple');
var settings = require('../../../config/settings').load();
var passwords = require('../../../api/controller/utils/password');
var auth = require('../../../api/controller/auth');
var users = require('../../../api/controller/users');
var validateRequest = require('../../../api/middleware/validateRequest');

chai.should();

var secret = settings.security.secret;

// Fake express response
function fakeResponse(callback) {
	var res = {
		statusCode: 200,
		status: function(code) {
			res.statusCode = code;
			return res;
		},
		send: function(body) {
			callback(res.statusCode, body);
		}
	};
	return res;
}

describe('Password helper', function() {
	it('it should hash and verify a password', function(done) {
		passwords.hash('pass', function(err, hash) {
			chai.expect(err).to.be.null;
			passwords.isHashed(hash).should.be.eql(true);
			hash.should.not.contain('pass');
			passwords.verify('pass', hash, function(err, match, needsRehash) {
				match.should.be.eql(true);
				needsRehash.should.be.eql(false);
				done();
			});
		});
	});

	it('it should use a different salt for each hash', function(done) {
		passwords.hash('pass', function(err, hash1) {
			passwords.hash('pass', function(err, hash2) {
				hash1.should.not.be.eql(hash2);
				done();
			});
		});
	});

	it('it should reject a wrong password', function(done) {
		passwords.hash('pass', function(err, hash) {
			passwords.verify('Pass', hash, function(err, match) {
				match.should.be.eql(false);
				passwords.verify('.*', hash, function(err, match) {
					match.should.be.eql(false);
					done();
				});
			});
		});
	});

	it('it should verify a legacy clear password and ask for a rehash', function(done) {
		passwords.verify('PASS', 'pass', function(err, match, needsRehash) {
			match.should.be.eql(true);
			needsRehash.should.be.eql(true);
			passwords.verify('.*', 'pass', function(err, match) {
				match.should.be.eql(false);
				done();
			});
		});
	});

	it('it should reject missing passwords', function(done) {
		passwords.verify('', undefined, function(err, match) {
			match.should.be.eql(false);
			passwords.verify(undefined, 'pass', function(err, match) {
				match.should.be.eql(false);
				done();
			});
		});
	});

	it('it should escape regular expressions', function() {
		var regex = new RegExp('^' + passwords.escapeRegex('.*') + '$', 'i');
		regex.test('anything').should.be.eql(false);
		regex.test('.*').should.be.eql(true);
	});
});

describe('Token validation', function() {
	var validateUser = auth.validateUser;
	var updateTimestamp = auth.updateTimestamp;

	before(function() {
		auth.validateUser = function(uid, callback) {
			callback({_id: uid, role: 'student'});
		};
		auth.updateTimestamp = function(uid, callback) {
			callback();
		};
	});

	after(function() {
		auth.validateUser = validateUser;
		auth.updateTimestamp = updateTimestamp;
	});

	function request(payload, key) {
		return {
			body: {},
			query: {},
			headers: {
				'x-access-token': jwt.encode(payload, secret),
				'x-key': key
			}
		};
	}

	it('it should accept a token used by its own user', function(done) {
		var req = request({uid: 'aaaaaaaaaaaaaaaaaaaaaaaa', partial: false, exp: Date.now() + 10000}, 'aaaaaaaaaaaaaaaaaaaaaaaa');
		validateRequest(false)(req, fakeResponse(function(status, body) {
			done(new Error('Unexpected response ' + status + ' ' + JSON.stringify(body)));
		}), function() {
			req.user._id.should.be.eql('aaaaaaaaaaaaaaaaaaaaaaaa');
			done();
		});
	});

	it('it should reject a token used with the key of another user', function(done) {
		var req = request({uid: 'aaaaaaaaaaaaaaaaaaaaaaaa', partial: false, exp: Date.now() + 10000}, 'bbbbbbbbbbbbbbbbbbbbbbbb');
		validateRequest(false)(req, fakeResponse(function(status, body) {
			status.should.be.eql(401);
			body.code.should.be.eql(5);
			done();
		}), function() {
			done(new Error('Request should have been rejected'));
		});
	});

	it('it should handle a token without user as expired', function(done) {
		var req = request({partial: false, exp: Date.now() + 10000}, 'aaaaaaaaaaaaaaaaaaaaaaaa');
		validateRequest(false)(req, fakeResponse(function(status, body) {
			status.should.be.eql(400);
			body.code.should.be.eql(3);
			done();
		}), function() {
			done(new Error('Request should have been rejected'));
		});
	});

	it('it should reject a token signed with another secret', function(done) {
		var req = request({uid: 'aaaaaaaaaaaaaaaaaaaaaaaa', partial: false, exp: Date.now() + 10000}, 'aaaaaaaaaaaaaaaaaaaaaaaa');
		req.headers['x-access-token'] = jwt.encode({uid: 'aaaaaaaaaaaaaaaaaaaaaaaa', partial: false, exp: Date.now() + 10000}, 'another.secret');
		validateRequest(false)(req, fakeResponse(function(status) {
			status.should.not.be.eql(200);
			done();
		}), function() {
			done(new Error('Request should have been rejected'));
		});
	});
});

describe('Login', function() {
	var getAllUsers = users.getAllUsers;
	var rehashPassword = users.rehashPassword;
	var storedUsers;
	var lastQuery;
	var rehashed;

	before(function(done) {
		auth.init(settings);
		passwords.hash('pass', function(err, hash) {
			users.getAllUsers = function(query, options, callback) {
				lastQuery = query;
				var list = storedUsers.filter(function(user) {
					return query.name.$regex.test(user.name);
				}).map(function(user) {
					var copy = Object.assign({}, user);
					if (!options.enablePassword) delete copy.password;
					return copy;
				});
				callback(list);
			};
			users.rehashPassword = function(uid, password) {
				rehashed = {uid: uid, password: password};
			};
			storedUsers = [
				{_id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Hashed', role: 'student', password: hash},
				{_id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Legacy', role: 'student', password: 'word'}
			];
			done();
		});
	});

	after(function() {
		users.getAllUsers = getAllUsers;
		users.rehashPassword = rehashPassword;
	});

	beforeEach(function() {
		rehashed = null;
	});

	function login(user, callback) {
		auth.login({
			body: {user: JSON.stringify(user)},
			iniconfig: settings
		}, fakeResponse(callback));
	}

	it('it should login with a hashed password and bind the token to the user', function(done) {
		login({name: 'hashed', password: 'pass'}, function(status, body) {
			status.should.be.eql(200);
			body.user.should.not.have.property('password');
			jwt.decode(body.token, secret).uid.should.be.eql('aaaaaaaaaaaaaaaaaaaaaaaa');
			chai.expect(rehashed).to.be.null;
			done();
		});
	});

	it('it should not login with a regular expression as password', function(done) {
		login({name: 'Hashed', password: '.*'}, function(status, body) {
			status.should.be.eql(401);
			body.code.should.be.eql(1);
			done();
		});
	});

	it('it should not match a regular expression as name', function(done) {
		login({name: '.*', password: 'pass'}, function(status) {
			status.should.be.eql(401);
			lastQuery.name.$regex.test('Hashed').should.be.eql(false);
			done();
		});
	});

	it('it should login with a legacy password and rehash it', function(done) {
		login({name: 'Legacy', password: 'word'}, function(status, body) {
			status.should.be.eql(200);
			body.user.should.not.have.property('password');
			rehashed.should.be.eql({uid: 'bbbbbbbbbbbbbbbbbbbbbbbb', password: 'word'});
			done();
		});
	});

	it('it should not login with a wrong legacy password', function(done) {
		login({name: 'Legacy', password: 'wrong'}, function(status) {
			status.should.be.eql(401);
			chai.expect(rehashed).to.be.null;
			done();
		});
	});
});
