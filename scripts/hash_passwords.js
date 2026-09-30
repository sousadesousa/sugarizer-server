// Replace every clear password stored in the users collection by its hash
// Usage: node scripts/hash_passwords.js (NODE_ENV selects the env/*.ini file, like the server)

var settings = require('../config/settings').load(),
	wait4db = require('../config/wait4db'),
	passwords = require('../api/controller/utils/password');

// Hash a password with the callback based helper
function hash(password) {
	return new Promise(function(resolve, reject) {
		passwords.hash(password, function(err, hashed) {
			if (err) {
				reject(err);
			} else {
				resolve(hashed);
			}
		});
	});
}

async function hashAll(db) {
	var collection = db.collection(settings.collections.users);
	var users = await collection.find({
		password: {
			$exists: true,
			$not: /^scrypt\$/
		}
	}, {
		projection: {
			password: 1
		}
	}).toArray();
	console.log(users.length + " clear password(s) to hash");
	var errors = 0;
	for (var i = 0 ; i < users.length ; i++) {
		var user = users[i];
		if (typeof user.password !== 'string' || passwords.isHashed(user.password)) {
			continue;
		}
		try {
			// Only update if the password was not changed in the meantime
			await collection.updateOne({
				_id: user._id,
				password: user.password
			}, {
				$set: {
					password: await hash(user.password)
				}
			});
		} catch (err) {
			console.log("Error hashing password for user " + user._id + ": " + err);
			errors++;
		}
	}
	console.log("Done, " + (users.length - errors) + " password(s) hashed, " + errors + " error(s)");
	return errors;
}

wait4db.waitConnection(settings, function(db) {
	if (!db) {
		console.log("Unable to connect to database");
		process.exit(-1);
	}
	hashAll(db).then(function(errors) {
		process.exit(errors ? -1 : 0);
	}, function(err) {
		console.log(err);
		process.exit(-1);
	});
});
