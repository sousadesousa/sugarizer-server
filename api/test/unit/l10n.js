// Unit test for the dashboard translations, no database needed
var chai = require('chai');
var fs = require('fs');
var path = require('path');

var dashboardPath = path.join(__dirname, '../../../dashboard');

chai.should();

// Read locales.ini into {section: {key: value}} the way the dashboard l10n library does
function readLocales() {
	var content = fs.readFileSync(path.join(dashboardPath, 'public/l10n/locales.ini'), 'utf8');
	var sections = {};
	var current = null;
	content.split(/\r?\n/).forEach(function(line) {
		var section = line.match(/^\[(.*)\]$/);
		if (section) {
			current = sections[section[1]] = {};
			return;
		}
		var entry = line.match(/^([^=\s;#][^=]*?)\s*=\s*(.*)$/);
		if (entry && current) {
			current[entry[1]] = entry[2];
		}
	});
	return sections;
}

function placeholders(text) {
	return (text.match(/\{\{\w+\}\}/g) || []).sort().join(',');
}

describe('Dashboard translations', function() {
	var locales = readLocales();
	// [*] holds the default strings, [en] overrides them: together they are the reference
	var reference = Object.assign({}, locales['*'], locales.en);

	['fr', 'es'].forEach(function(lang) {
		it('[' + lang + '] has every key of [en]', function() {
			var missing = Object.keys(reference).filter(function(key) {
				return !(key in locales[lang]);
			});
			missing.should.deep.equal([]);
		});

		it('[' + lang + '] keeps the {{placeholders}} of [en]', function() {
			var wrong = Object.keys(reference).filter(function(key) {
				return key in locales[lang] && placeholders(locales[lang][key]) !== placeholders(reference[key]);
			});
			wrong.should.deep.equal([]);
		});
	});

	it('[es] is translated, not a copy of [en]', function() {
		var same = Object.keys(reference).filter(function(key) {
			return locales.es[key] === reference[key];
		});
		// brand names and units are the same in both languages
		same.length.should.be.below(20);
	});

	it('has every string that the dashboard code asks for by name', function() {
		var used = {};
		['controller', 'helper'].forEach(function(folder) {
			(function walk(dir) {
				fs.readdirSync(dir, {withFileTypes: true}).forEach(function(entry) {
					var file = path.join(dir, entry.name);
					if (entry.isDirectory()) {
						return walk(file);
					}
					var re = /l10n\.get\(\s*'([\w.-]+)'\s*[,)]/g;
					var match;
					var code = fs.readFileSync(file, 'utf8');
					while ((match = re.exec(code))) {
						used[match[1]] = true;
					}
				});
			})(path.join(dashboardPath, folder));
		});
		Object.keys(used).length.should.be.above(20);
		var missing = Object.keys(used).filter(function(key) {
			return !(key in reference);
		});
		missing.should.deep.equal([]);
	});
});
