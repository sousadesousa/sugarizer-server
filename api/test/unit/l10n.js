// Unit test for the dashboard translations, no database needed
var chai = require('chai');
var fs = require('fs');
var path = require('path');

chai.should();

// Read locales.ini into {section: {key: value}} the way the dashboard l10n library does
function readLocales() {
	var content = fs.readFileSync(path.join(__dirname, '../../../dashboard/public/l10n/locales.ini'), 'utf8');
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
});
