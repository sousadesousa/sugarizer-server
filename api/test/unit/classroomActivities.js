// Unit tests for the activities a student can see, no database needed
process.env.NODE_ENV = 'test';

var chai = require('chai');
var activities = require('../../controller/activities');

chai.should();

var all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

function ids(list) {
	return list.map(function(activity) { return activity.id; });
}

describe('Activities assigned to classrooms', function() {
	it('shows nothing to a student without classroom', function() {
		activities.filterAssigned(all, []).should.deep.equal([]);
	});
	it('shows only the activities of the classroom', function() {
		ids(activities.filterAssigned(all, [{ activities: ['b'] }])).should.deep.equal(['b']);
	});
	it('shows the union of the activities of several classrooms', function() {
		ids(activities.filterAssigned(all, [{ activities: ['a'] }, { activities: ['c', 'a'] }])).should.deep.equal(['a', 'c']);
	});
	it('shows nothing for classrooms without activities', function() {
		activities.filterAssigned(all, [{}, { activities: [] }, { activities: 'a' }]).should.deep.equal([]);
	});
	it('ignores unknown activities and inherited properties', function() {
		ids(activities.filterAssigned([{ id: 'a' }, { id: 'constructor' }], [{ activities: ['zzz'] }])).should.deep.equal([]);
	});
});
