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
	spawn = require('child_process').spawn,
	MongoClient = require('mongodb').MongoClient;

var root = path.resolve(__dirname, '../..');
var stamp = Date.now().toString();

// Ordinary users of the seed (the password is the same for all)
var PASSWORD = 'pokemon';
var users = {
	admin: {name: 'E2E Admin ' + stamp, role: 'admin'},
	teacher: {name: 'E2E Teacher ' + stamp, role: 'teacher'},
	student1: {name: 'E2E Student 1 ' + stamp, role: 'student'},
	student2: {name: 'E2E Student 2 ' + stamp, role: 'student'},
	// admin with two-factor authentication enabled (same secret as the API tests)
	tfa: {name: 'E2E TFA ' + stamp, role: 'admin', uniqueSecret: 'AAAAAAAAAAAAAAA'}
};

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
		var envName = 'e2e-' + webPort;
		state.iniFile = path.join(root, 'env', envName + '.ini');
		fs.writeFileSync(state.iniFile, ini.stringify(settings));

		// Server
		state.server = spawn(process.execPath, ['sugarizer.js'], {
			cwd: root,
			env: Object.assign({}, process.env, {NODE_ENV: envName}),
			stdio: ['ignore', 'pipe', 'pipe']
		});
		state.server.stdout.on('data', function(d) {
			state.log.push(String(d));
		});
		state.server.stderr.on('data', function(d) {
			state.log.push(String(d));
		});
		state.server.on('exit', function(code) {
			state.server = null;
			if (code) {
				state.log.push('server exited with code ' + code);
			}
		});
		var base = 'http://127.0.0.1:' + webPort;
		await waitFor(async function() {
			if (!state.server) {
				throw new Error('server stopped:\n' + state.log.join(''));
			}
			return (await fetch(base + '/api')).ok;
		}, 'the server on ' + base, 60000);

		// Seed. Admins can only sign up from the server address
		for (var key of ['admin', 'tfa']) {
			await api(base, 'POST', '/auth/signup', {user: JSON.stringify(Object.assign({password: PASSWORD, language: 'en'}, users[key]))});
		}
		var admin = await api(base, 'POST', '/auth/login', {user: JSON.stringify({name: users.admin.name, password: PASSWORD})});
		var created = {};
		for (key of ['teacher', 'student1', 'student2']) {
			created[key] = await api(base, 'POST', '/api/v1/users/', {user: JSON.stringify(Object.assign({password: PASSWORD, language: 'en', color: {stroke: '#FF0000', fill: '#0000FF'}}, users[key]))}, admin);
		}
		var teacher = await api(base, 'POST', '/auth/login', {user: JSON.stringify({name: users.teacher.name, password: PASSWORD})});
		var classroom = await api(base, 'POST', '/api/v1/classrooms/', {classroom: JSON.stringify({name: 'E2E Class ' + stamp, color: {stroke: '#FF0000', fill: '#0000FF'}, students: [created.student1._id, created.student2._id]})}, admin);
		var workId = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
		await api(base, 'POST', '/api/v1/journal/' + teacher.user.private_journal, {journal: JSON.stringify({
			objectId: workId,
			text: 'E2E entry',
			metadata: {user_id: teacher.user._id, title: 'E2E work', timestamp: Date.now(), activity: 'org.olpcfrance.PaintActivity'}
		})}, teacher);
		var assignment = await api(base, 'POST', '/api/v1/assignments/', {assignment: JSON.stringify({
			name: 'E2E Assignment ' + stamp,
			assignedWork: workId,
			color: {stroke: '#FF0000', fill: '#0000FF'},
			instructions: 'Draw something',
			lateTurnIn: 'false',
			classrooms: [classroom._id],
			dueDate: String(Date.now() + 7 * 24 * 3600 * 1000)
		})}, teacher);
		await api(base, 'GET', '/api/v1/assignments/launch/' + assignment._id, null, teacher);
		var chart = await api(base, 'POST', '/api/v1/charts/', {chart: JSON.stringify({title: 'E2E Chart ' + stamp, key: 'how-users-are-active', type: 'pie', hidden: false})}, admin);

		return {
			state: state,
			info: {
				baseURL: base,
				password: PASSWORD,
				users: users,
				ids: {
					admin: admin.user._id,
					teacher: teacher.user._id,
					teacherJournal: teacher.user.private_journal,
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
