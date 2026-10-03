// Test harness of the dashboard end-to-end tests: MongoDB, throwaway settings, server and seed data.
//
// - MONGOD_BIN set: starts that mongod on a free port, in a temporary directory
// - otherwise: uses the MongoDB already listening on 127.0.0.1:27017 (CI service)
// The settings are a copy of env/test.ini with a throwaway database and free ports,
// written as env/e2e-<port>.ini (git-ignored) and removed at the end.

var fs = require('fs'),
	os = require('os'),
	net = require('net'),
	path = require('path'),
	ini = require('ini'),
	otplib = require('otplib'),
	spawn = require('child_process').spawn,
	MongoClient = require('mongodb').MongoClient;

var root = path.resolve(__dirname, '../..');
// Names of the seed are the same on every run (the database is throwaway), so screenshots stay comparable
var stamp = Date.now().toString();

// The server clock starts at this fixed time (see server-preload.js), so the dates shown by the dashboard are the
// same on every run. The seed finishes within a few seconds: all of it happens at "10:00 AM".
var CLOCK_START = Date.UTC(2035, 2, 15, 10, 0, 0);

// Ordinary users of the seed (the password is the same for all)
var PASSWORD = 'pokemon';
var users = {
	admin: {name: 'E2E Admin', role: 'admin'},
	teacher: {name: 'E2E Teacher', role: 'teacher'},
	// teacher with no classroom (so no students, no shared journal)
	teacherNoClass: {name: 'E2E Teacher No Class', role: 'teacher'},
	student1: {name: 'E2E Student 1', role: 'student'},
	student2: {name: 'E2E Student 2', role: 'student'},
	// admin with two-factor authentication enabled (same secret as the API tests)
	tfa: {name: 'E2E TFA', role: 'admin', uniqueSecret: 'AAAAAAAAAAAAAAA'}
};

// One-time code of an authenticator at the given time
function totp(secret, time) {
	otplib.authenticator.options = {epoch: time};
	var code = otplib.authenticator.generate(secret);
	otplib.authenticator.resetOptions();
	return code;
}

function freePort() {
	return new Promise(function(resolve, reject) {
		var srv = net.createServer();
		srv.on('error', reject);
		srv.listen(0, '127.0.0.1', function() {
			var port = srv.address().port;
			srv.close(function() {
				resolve(port);
			});
		});
	});
}

function sleep(ms) {
	return new Promise(function(resolve) {
		setTimeout(resolve, ms);
	});
}

async function waitFor(check, what, timeout) {
	var end = Date.now() + (timeout || 30000);
	var last;
	while (Date.now() < end) {
		try {
			if (await check()) {
				return;
			}
		} catch (e) {
			last = e;
		}
		await sleep(250);
	}
	throw new Error('Timeout waiting for ' + what + (last ? ': ' + last.message : ''));
}

async function api(base, method, url, body, auth) {
	var headers = {'Content-Type': 'application/json'};
	if (auth) {
		headers['x-key'] = auth.user._id;
		headers['x-access-token'] = auth.token;
	}
	var res = await fetch(base + url, {method: method, headers: headers, body: body ? JSON.stringify(body) : undefined});
	var text = await res.text();
	var data;
	try {
		data = JSON.parse(text);
	} catch (e) {
		data = text;
	}
	if (!res.ok) {
		throw new Error(method + ' ' + url + ' -> ' + res.status + ' ' + text);
	}
	return data;
}

async function start() {
	var state = {mongod: null, server: null, dbDir: null, iniFile: null, dbName: null, mongoPort: 27017, log: []};
	try {
		// MongoDB
		if (process.env.MONGOD_BIN) {
			state.mongoPort = await freePort();
			state.dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-mongo-'));
			state.mongod = spawn(process.env.MONGOD_BIN, ['--dbpath', state.dbDir, '--port', String(state.mongoPort), '--bind_ip', '127.0.0.1'], {stdio: 'ignore'});
			state.mongod.on('exit', function(code) {
				state.mongod = null;
				if (code) {
					state.log.push('mongod exited with code ' + code);
				}
			});
		}
		await waitFor(async function() {
			var client = new MongoClient('mongodb://127.0.0.1:' + state.mongoPort, {serverSelectionTimeoutMS: 1000});
			try {
				await client.connect();
				return true;
			} finally {
				await client.close();
			}
		}, 'MongoDB on 127.0.0.1:' + state.mongoPort, 60000);

		// Throwaway settings
		var webPort = await freePort();
		var presencePort = await freePort();
		var settings = ini.parse(fs.readFileSync(path.join(root, 'env/test.ini'), 'utf-8'));
		state.dbName = 'sugarizer_e2e_' + stamp;
		settings.web.port = String(webPort);
		settings.presence.port = String(presencePort);
		settings.database.port = String(state.mongoPort);
		settings.database.name = state.dbName;
		settings.security.secret = 'e2e.sugarizer.server.key';
		// A small fixed client (a few activities): the activities that the dashboard counts and lists, and the
		// icons it shows, do not depend on the Sugarizer client that is checked out next to the server
		settings.client.path = path.join(__dirname, 'fixtures/client') + '/';
		var envName = 'e2e-' + webPort;
		state.iniFile = path.join(root, 'env', envName + '.ini');
		fs.writeFileSync(state.iniFile, ini.stringify(settings));

		// Server. If it crashes once the tests run (a page can bring it down), it is started again, with
		// the same database; sessions are lost, so tests logged in before a crash must log in again.
		state.clockOffset = CLOCK_START - Date.now();
		var fakeNow = function() {
			return Date.now() + state.clockOffset;
		};
		state.stopping = false;
		state.started = false;
		state.restarts = 0;
		var launch = function() {
			var child = spawn(process.execPath, ['--require', path.join(__dirname, 'server-preload.js'), 'sugarizer.js'], {
				cwd: root,
				env: Object.assign({}, process.env, {NODE_ENV: envName, TZ: 'UTC', E2E_CLOCK_OFFSET_MS: String(state.clockOffset), E2E_RANDOM_SEED: '1'}),
				stdio: ['ignore', 'pipe', 'pipe']
			});
			state.server = child;
			child.stdout.on('data', function(d) {
				state.log.push(String(d));
			});
			child.stderr.on('data', function(d) {
				state.log.push(String(d));
			});
			child.on('exit', function(code) {
				state.server = null;
				if (code) {
					state.log.push('server exited with code ' + code + '\n');
				}
				if (state.started && !state.stopping && state.restarts < 50) {
					state.restarts++;
					setTimeout(function() {
						if (!state.stopping) {
							launch();
						}
					}, 500);
				}
			});
		};
		launch();
		var base = 'http://127.0.0.1:' + webPort;
		await waitFor(async function() {
			if (!state.server) {
				throw new Error('server stopped:\n' + state.log.join(''));
			}
			return (await fetch(base + '/api')).ok;
		}, 'the server on ' + base, 60000);
		state.started = true;

		// Seed. Admins can only sign up from the server address
		for (var key of ['admin', 'tfa']) {
			await api(base, 'POST', '/auth/signup', {user: JSON.stringify(Object.assign({password: PASSWORD, language: 'en', color: {stroke: '#FF0000', fill: '#0000FF'}}, users[key]))});
		}
		var admin = await api(base, 'POST', '/auth/login', {user: JSON.stringify({name: users.admin.name, password: PASSWORD, role: 'admin'})});
		// The server reads the activities folder with asynchronous calls, so the order of the activities that are not
		// favorites changes from a start to the next. Making all of them favorites, in a fixed order, fixes it.
		await waitFor(async function() {
			return (await api(base, 'GET', '/api/v1/activities/', null, admin)).length > 0;
		}, 'the list of activities', 30000);
		var activities = await api(base, 'GET', '/api/v1/activities/', null, admin);
		await api(base, 'POST', '/api/v1/activities/', {favorites: activities.map(function(activity) {
			return activity.id;
		}).sort().join(',')}, admin);
		var created = {};
		var userBody = function(key, extra) {
			return {user: JSON.stringify(Object.assign({password: PASSWORD, language: 'en', color: {stroke: '#FF0000', fill: '#0000FF'}}, users[key], extra))};
		};
		for (key of ['student1', 'student2']) {
			created[key] = await api(base, 'POST', '/api/v1/users/', userBody(key), admin);
		}
		var classroom = await api(base, 'POST', '/api/v1/classrooms/', {classroom: JSON.stringify({name: 'E2E Class', color: {stroke: '#FF0000', fill: '#0000FF'}, students: [created.student1._id, created.student2._id]})}, admin);
		// A teacher sees (journals, users) the students of the classrooms assigned to the teacher
		created.teacher = await api(base, 'POST', '/api/v1/users/', userBody('teacher', {classrooms: [classroom._id]}), admin);
		created.teacherNoClass = await api(base, 'POST', '/api/v1/users/', userBody('teacherNoClass'), admin);
		var teacherNoClass = await api(base, 'POST', '/auth/login', {user: JSON.stringify({name: users.teacherNoClass.name, password: PASSWORD, role: 'teacher'})});
		var teacher = await api(base, 'POST', '/auth/login', {user: JSON.stringify({name: users.teacher.name, password: PASSWORD, role: 'teacher'})});
		// Two-factor authentication on for the tfa admin: the dashboard login then asks for the code
		var tfa = await api(base, 'POST', '/auth/login', {user: JSON.stringify({name: users.tfa.name, password: PASSWORD, role: 'admin'})});
		await api(base, 'PUT', '/api/v1/dashboard/profile/enable2FA', {userToken: totp(users.tfa.uniqueSecret, fakeNow())}, tfa);
		var workId = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
		await api(base, 'POST', '/api/v1/journal/' + teacher.user.private_journal, {journal: JSON.stringify({
			objectId: workId,
			text: 'E2E entry',
			metadata: {user_id: teacher.user._id, title: 'E2E work', timestamp: fakeNow(), activity: 'org.olpcfrance.PaintActivity'}
		})}, teacher);
		var assignment = await api(base, 'POST', '/api/v1/assignments/', {assignment: JSON.stringify({
			name: 'E2E Assignment',
			assignedWork: workId,
			color: {stroke: '#FF0000', fill: '#0000FF'},
			instructions: 'Draw something',
			// a boolean, as the dashboard stores it (the string 'false' is true for the form checkbox)
			lateTurnIn: false,
			classrooms: [classroom._id],
			// a number, as the dashboard stores it (a string shows "Invalid Date" in the edit form)
			dueDate: fakeNow() + 7 * 24 * 3600 * 1000
		})}, teacher);
		await api(base, 'GET', '/api/v1/assignments/launch/' + assignment._id, null, teacher);
		var chart = await api(base, 'POST', '/api/v1/charts/', {chart: JSON.stringify({title: 'E2E Chart', key: 'how-users-are-active', type: 'pie', hidden: false})}, admin);

		return {
			state: state,
			info: {
				baseURL: base,
				clockStart: new Date(CLOCK_START).toISOString(),
				password: PASSWORD,
				users: users,
				ids: {
					admin: admin.user._id,
					teacher: teacher.user._id,
					teacherJournal: teacher.user.private_journal,
					teacherNoClassJournal: teacherNoClass.user.private_journal,
					student1: created.student1._id,
					classroom: classroom._id,
					assignment: assignment._id,
					chart: chart._id
				}
			}
		};
	} catch (e) {
		var logs = state.log.join('');
		await stop(state);
		e.message += (logs ? '\n--- server/mongod log ---\n' + logs : '');
		throw e;
	}
}

function kill(child) {
	return new Promise(function(resolve) {
		if (!child) {
			return resolve();
		}
		child.once('exit', resolve);
		child.kill('SIGTERM');
		setTimeout(function() {
			child.kill('SIGKILL');
			resolve();
		}, 10000).unref();
	});
}

async function stop(state) {
	if (!state) {
		return;
	}
	state.stopping = true;
	await kill(state.server);
	if (state.dbName && !state.dbDir) {
		// shared MongoDB: drop only the throwaway database
		var client = new MongoClient('mongodb://127.0.0.1:' + state.mongoPort, {serverSelectionTimeoutMS: 2000});
		try {
			await client.connect();
			await client.db(state.dbName).dropDatabase();
		} catch (e) {
			// nothing to clean
		} finally {
			await client.close();
		}
	}
	await kill(state.mongod);
	if (state.dbDir) {
		fs.rmSync(state.dbDir, {recursive: true, force: true});
	}
	if (state.iniFile) {
		fs.rmSync(state.iniFile, {force: true});
	}
}

exports.start = start;
exports.stop = stop;
