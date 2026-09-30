// Load Sugarizer Settings
var fs = require('fs'),
	crypto = require('crypto'),
	ini = require('ini');

// Secret shipped in the default settings files, never used to sign tokens
var DEFAULT_SECRET = 'super.sugarizer.server.key';

// Load and parse sugarizer.ini file and locales.ini
exports.load = function() {

	//validate
	var env = (process.env.NODE_ENV ? process.env.NODE_ENV : 'sugarizer');

	//add directory
	var confFile = "./env/" + env + '.ini';

	//check file
	try {
		fs.statSync(confFile);
	} catch (err) {
		console.log("Ooops! cannot load settings file '"+ confFile + "', error code "+err.code);
		process.exit(-1);
	}

	//parse config
	var settings = ini.parse(fs.readFileSync(confFile, 'utf-8'));

	//parse locales.ini
	settings.locales = ini.parse(fs.readFileSync('./dashboard/public/l10n/locales.ini', 'utf-8'));

	//secret used to sign tokens and sessions
	settings.security.secret = loadSecret(settings.security);

	return settings;
};

// Get secret from SUGARIZER_SECRET environment variable, the settings file,
// or a secret file generated on first launch
function loadSecret(security) {
	if (process.env.SUGARIZER_SECRET) {
		return process.env.SUGARIZER_SECRET;
	}
	if (security.secret && security.secret != DEFAULT_SECRET) {
		return security.secret;
	}
	var secretFile = security.secret_file || './env/secret.key';
	try {
		var secret = fs.readFileSync(secretFile, 'utf-8').trim();
		if (secret) {
			return secret;
		}
	} catch (err) {
		if (err.code != 'ENOENT') {
			console.log("Ooops! cannot read secret file '" + secretFile + "', error code " + err.code);
			process.exit(-1);
		}
	}
	var generated = crypto.randomBytes(48).toString('base64');
	try {
		fs.writeFileSync(secretFile, generated + '\n', {mode: 384, flag: 'wx'});
	} catch (err) {
		if (err.code == 'EEXIST') {
			return fs.readFileSync(secretFile, 'utf-8').trim();
		}
		console.log("Ooops! cannot write secret file '" + secretFile + "', error code " + err.code);
		process.exit(-1);
	}
	console.log("New secret generated in '" + secretFile + "'");
	return generated;
}
