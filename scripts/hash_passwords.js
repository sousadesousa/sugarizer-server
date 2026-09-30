// Replace every clear password stored in the users collection by its hash
// Usage: node scripts/hash_passwords.js (NODE_ENV selects the env/*.ini file, like the server)

var settings = require('../config/settings').load(),
	wait4db = require('../config/wait4db'),
	passwords = require('../api/controller/utils/password');

wait4db.waitConnection(settings, function(db) {
	if (!db) {
		console.log("Unable to connect to database");
		process.exit(-1);
	}
	db.collection(settings.collections.users, function(err, collection) {
		if (err) {
			console.log(err);
			process.exit(-1);
		}
		collection.find({
			password: {
				$exists: true,
				$not: /^scrypt\$/
			}
		}, {
			projection: {
				password: 1
			}
		}).toArray(function(err, users) {
			if (err) {
				console.log(err);
				process.exit(-1);
			}
			console.log(users.length + " clear password(s) to hash");
			hashNext(collection, users, 0, 0);
		});
	});
});

function hashNext(collection, users, index, errors) {
	if (index >= users.length) {
		console.log("Done, " + (users.length - errors) + " password(s) hashed, " + errors + " error(s)");
		process.exit(errors ? -1 : 0);
	}
	var user = users[index];
	if (typeof user.password !== 'string' || passwords.isHashed(user.password)) {
		return hashNext(collection, users, index + 1, errors);
	}
	passwords.hash(user.password, function(err, hash) {
		if (err) {
			console.log("Error hashing password for user " + user._id + ": " + err);
			return hashNext(collection, users, index + 1, errors + 1);
		}
		// Only update if the password was not changed in the meantime
		collection.updateOne({
			_id: user._id,
			password: user.password
		}, {
			$set: {
				password: hash
			}
		}, function(err) {
			if (err) {
				console.log("Error updating user " + user._id + ": " + err);
			}
			hashNext(collection, users, index + 1, errors + (err ? 1 : 0));
		});
	});
}
