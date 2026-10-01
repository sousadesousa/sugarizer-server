// Handle to wait for db connection
var mongo = require('mongodb');


//- Utility functions

// Init database
exports.waitConnection = function(settings, callback) {
	var waitTime = settings.database.waitdb;
	if (waitTime) {
		var timer = setInterval(function() {

			var client = createConnection(settings);

			// Open the db
			client.connect().then(function(client) {
				clearInterval(timer);
				var db = client.db(settings.database.name);
				callback(db);
			}, function(err) {
				console.log("Waiting for DB... ("+err.name+")");
				client.close().catch(function() {});
			});
		}, waitTime*1000);
	} else {
		var client = createConnection(settings);

		// Open the db
		client.connect().then(function(client) {
			var db = client.db(settings.database.name);
			callback(db);
		}, function() {
			callback();
		});
	}
};

function createConnection(settings) {
	return new mongo.MongoClient(
		settings.database.replicaset ? 'mongodb://'+settings.database.server+'/'+settings.database.name+'?replicaSet=rs0' : 'mongodb://'+settings.database.server+':'+settings.database.port+'/'+settings.database.name,
		{w: 1, serverSelectionTimeoutMS: 5000});
}
