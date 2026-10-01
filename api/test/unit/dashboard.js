// Unit tests for the dashboard helpers, no database needed
process.env.NODE_ENV = 'test';

var chai = require('chai');
var common = require('../../../dashboard/helper/common');
var graph = require('../../../dashboard/controller/graph/util');

chai.should();

var locales = {
	'*': { Hello: 'Hello', OnlyDefault: 'Default only' },
	'fr': { Hello: 'Bonjour' }
};

function request(query, session) {
	return { query: query || {}, body: {}, session: session || {} };
}

// Run a request through the language middleware, then the callback
function inRequest(req, callback) {
	var res = { locals: {} };
	common.languageMiddleware(req, res, function() {
		callback(res);
	});
}

describe('Dashboard helpers', function() {

	before(function() {
		common.init({ locales: locales });
	});

	describe('escapeHtml', function() {
		it('escapes HTML special characters', function() {
			common.escapeHtml('<img src=x onerror="a()">\'&').should.equal('&lt;img src=x onerror=&quot;a()&quot;&gt;&#39;&amp;');
		});
		it('handles empty values', function() {
			common.escapeHtml(undefined).should.equal('');
			common.escapeHtml(null).should.equal('');
			common.escapeHtml(12).should.equal('12');
		});
	});

	describe('jsonForScript', function() {
		it('cannot close a script block', function() {
			var json = common.jsonForScript({ title: '</script><script>alert(1)</script>' });
			json.should.not.contain('<');
			json.should.not.contain('>');
			JSON.parse(json).title.should.equal('</script><script>alert(1)</script>');
		});
		it('escapes line separators and keeps the value', function() {
			var value = 'a\u2028b\u2029c&d';
			var json = common.jsonForScript(value);
			json.should.not.contain('\u2028');
			json.should.not.contain('\u2029');
			JSON.parse(json).should.equal(value);
		});
		it('serializes undefined as null', function() {
			common.jsonForScript(undefined).should.equal('null');
		});
	});

	describe('language per request', function() {
		it('uses the default language without context', function() {
			common.l10n.getLanguage().should.equal('*');
			common.l10n.get('Hello').should.equal('Hello');
		});
		it('uses the language of the query and stores it in the session', function(done) {
			var req = request({ lang: 'fr' });
			inRequest(req, function() {
				common.l10n.get('Hello').should.equal('Bonjour');
				req.session.lang.should.equal('fr');
				done();
			});
		});
		it('uses the language of the session', function(done) {
			inRequest(request({}, { lang: 'fr' }), function() {
				common.l10n.get('Hello').should.equal('Bonjour');
				done();
			});
		});
		it('ignores unknown languages', function(done) {
			var req = request({ lang: '__proto__' });
			inRequest(req, function() {
				common.l10n.getLanguage().should.equal('*');
				(req.session.lang === undefined).should.equal(true);
				done();
			});
		});
		it('falls back to the default language for missing keys', function(done) {
			inRequest(request({ lang: 'fr' }), function() {
				common.l10n.get('OnlyDefault').should.equal('Default only');
				common.l10n.get('Unknown').should.equal('Unknown');
				done();
			});
		});
		it('does not mix languages between concurrent requests', function(done) {
			var results = {};
			var pending = 2;
			function finish() {
				if (--pending == 0) {
					results.a.should.equal('Bonjour');
					results.b.should.equal('Hello');
					done();
				}
			}
			inRequest(request({ lang: 'fr' }), function() {
				setTimeout(function() {
					results.a = common.l10n.get('Hello');
					finish();
				}, 20);
			});
			inRequest(request({}), function() {
				setTimeout(function() {
					results.b = common.l10n.get('Hello');
					finish();
				}, 10);
			});
		});
		it('restores the language in a bound callback', function(done) {
			inRequest(request({ lang: 'fr' }), function() {
				var bound = common.bindLanguage(function() {
					return common.l10n.get('Hello');
				});
				// call from outside the request context
				setImmediate(function() {
					bound().should.equal('Bonjour');
					done();
				});
			});
		});
	});

	describe('home page rows', function() {
		var evil = '<img src=x onerror=alert(1)>"\'';

		it('escapes the name of students and handles missing colors', function() {
			var html = graph.studentRow({ _id: 'u1', private_journal: 'j1', name: evil, timestamp: 0 }, 0);
			html.should.not.contain('<img');
			html.should.contain('&lt;img src=x onerror=alert(1)&gt;');
			html.should.contain('#005FE4');
			html.should.contain('</td></tr>');
		});
		it('escapes the name of teachers and admins and closes the row', function() {
			var html = graph.userRow({ _id: 'u1', name: evil, timestamp: 0 }, 1);
			html.should.not.contain('<img');
			html.should.match(/<\/td><\/tr>$/);
		});
		it('escapes the title and the owner of journal entries', function() {
			var entry = { journalId: 'j1', objectId: 'o1', metadata: { title: '</script><b>' + evil, buddy_name: evil, user_id: 'u1', activity: 'a', timestamp: 0 } };
			var html = graph.activityRow(entry, 0, '/icon.svg');
			html.should.not.contain('<b>');
			html.should.not.contain('<img');
			// only the icon script of the row
			(html.match(/<script>/g) || []).length.should.equal(1);
			(html.match(/<\/script>/g) || []).length.should.equal(1);
		});
		it('cannot break out of the onclick attribute', function() {
			var html = graph.studentRow({ _id: 'u1', private_journal: '"><script>alert(1)</script>', name: 'a', timestamp: 0 }, 0);
			html.should.not.contain('"><script>alert(1)');
		});
	});
});
