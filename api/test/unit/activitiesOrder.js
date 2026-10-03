// Unit test for the order of the activities after a server start, no database needed
process.env.NODE_ENV = 'test';

var chai = require('chai');
var fs = require('fs');
var os = require('os');
var path = require('path');
var activities = require('../../controller/activities');

chai.should();

var FAVORITES = ['org.test.m', 'org.test.c'];

// A client folder with activities named a00 ... a39 (written in the order of a shuffled list)
function makeClient() {
	var client = fs.mkdtempSync(path.join(os.tmpdir(), 'activities-order-'));
	var names = [];
	for (var i = 0; i < 40; i++) {
		names.push('a' + (i < 10 ? '0' : '') + i);
	}
	names.slice().reverse().concat(['Template']).forEach(function(name) {
		var info = path.join(client, 'activities', name + '.activity', 'activity');
		fs.mkdirSync(info, { recursive: true });
		fs.writeFileSync(path.join(info, 'activity.info'), '[Activity]\nname = ' + name + '\nbundle_id = org.test.' + name + '\nicon = ' + name + '\nactivity_version = 1\n');
	});
	// two favorites, named by bundle id
	['m', 'c'].forEach(function(letter) {
		var info = path.join(client, 'activities', letter + '.activity', 'activity');
		fs.mkdirSync(info, { recursive: true });
		fs.writeFileSync(path.join(info, 'activity.info'), '[Activity]\nname = ' + letter + '\nbundle_id = org.test.' + letter + '\nicon = ' + letter + '\nactivity_version = 1\n');
	});
	return client;
}

// load() with a database that has no activities list yet: resolve with the list that load() stores
function loadFrom(client) {
	return new Promise(function(resolve) {
		var database = {
			collection: function() {
				return {
					findOne: function() {
						return Promise.resolve(null);
					},
					replaceOne: function(filter, document) {
						resolve(document.activities);
						return Promise.resolve({});
					}
				};
			}
		};
		activities.load({
			client: { path: client },
			collections: { activities: 'activities', classrooms: 'classrooms' },
			activities: {
				activities_directory_name: 'activities',
				template_directory_name: 'Template.activity',
				activity_info_path: 'activity/activity.info',
				favorites: FAVORITES.join(',')
			}
		}, database);
	});
}

describe('Order of the activities after a server start', function() {
	var client;
	before(function() {
		client = makeClient();
	});
	after(function() {
		fs.rmSync(client, { recursive: true, force: true });
	});

	it('is the same at each start: favorites first, then the directory order', async function() {
		var first = await loadFrom(client);
		var expected = FAVORITES.slice();
		for (var n = 0; n < 40; n++) {
			expected.push('org.test.a' + (n < 10 ? '0' : '') + n);
		}
		// favorites in the order of the settings, then the others in the order of their directory name
		first.map(function(activity) { return activity.id; }).should.deep.equal(expected);
		first.map(function(activity) { return activity.index; }).should.deep.equal(first.map(function(activity, i) { return i; }));
		for (var i = 0; i < 5; i++) {
			var again = await loadFrom(client);
			again.should.deep.equal(first);
		}
	});

	it('does not leak its working data in the stored activities', async function() {
		var list = await loadFrom(client);
		list.forEach(function(activity) {
			activity.should.not.have.property('position');
			activity.should.have.all.keys('id', 'name', 'version', 'directory', 'icon', 'favorite', 'activityId', 'index');
		});
	});
});
