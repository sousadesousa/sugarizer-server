// Unit tests for toolbar mode resolution and cleaning, no database needed
process.env.NODE_ENV = 'test';

var chai = require('chai');
var activities = require('../../controller/activities');
var classrooms = require('../../controller/classrooms');

chai.should();

describe('resolveToolbarMode', function() {
	it('returns "full" for a student without classroom', function() {
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', []).should.equal('full');
	});

	it('applies class default "simple"', function() {
		var classrooms = [
			{ activities: ['org.sugarlabs.Blockrain'], toolbarMode: 'simple' }
		];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('simple');
	});

	it('applies class default "full"', function() {
		var classrooms = [
			{ activities: ['org.sugarlabs.Blockrain'], toolbarMode: 'full' }
		];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('full');
	});

	it('applies per-activity override "full" over class default "simple"', function() {
		var classrooms = [
			{
				activities: ['org.sugarlabs.Blockrain'],
				toolbarMode: 'simple',
				toolbarOverrides: { 'org.sugarlabs.Blockrain': 'full' }
			}
		];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('full');
	});

	it('applies per-activity override "simple" over class default "full"', function() {
		var classrooms = [
			{
				activities: ['org.sugarlabs.Blockrain'],
				toolbarMode: 'full',
				toolbarOverrides: { 'org.sugarlabs.Blockrain': 'simple' }
			}
		];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('simple');
	});

	it('returns "simple" if ANY classroom says "simple"', function() {
		var classrooms = [
			{
				activities: ['org.sugarlabs.Blockrain'],
				toolbarMode: 'full'
			},
			{
				activities: ['org.sugarlabs.Blockrain'],
				toolbarMode: 'simple'
			}
		];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('simple');
	});

	it('ignores classrooms that do not contain the activity', function() {
		var classrooms = [
			{
				activities: ['org.sugarlabs.Paint'],
				toolbarMode: 'simple'
			},
			{
				activities: ['org.sugarlabs.Blockrain'],
				toolbarMode: 'full'
			}
		];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('full');
	});

	it('ignores invalid mode values', function() {
		var classrooms = [
			{
				activities: ['org.sugarlabs.Blockrain'],
				toolbarMode: 'invalid'
			}
		];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('full');
	});

	it('ignores inherited properties like constructor in overrides', function() {
		var classrooms = [
			{
				activities: ['org.sugarlabs.Blockrain'],
				toolbarMode: 'full',
				toolbarOverrides: { 'org.sugarlabs.Blockrain': 'simple' }
			}
		];
		// Even with 'constructor' inherited, it should not affect the result
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', classrooms).should.equal('simple');
	});
});

describe('cleanToolbar', function() {
	it('removes invalid toolbarMode values', function() {
		var classroom = {
			toolbarMode: 'invalid',
			activities: []
		};
		classrooms.cleanToolbar(classroom);
		chai.expect(classroom.toolbarMode).to.be.undefined;
	});

	it('keeps valid toolbarMode "simple"', function() {
		var classroom = {
			toolbarMode: 'simple',
			activities: []
		};
		classrooms.cleanToolbar(classroom);
		classroom.toolbarMode.should.equal('simple');
	});

	it('keeps valid toolbarMode "full"', function() {
		var classroom = {
			toolbarMode: 'full',
			activities: []
		};
		classrooms.cleanToolbar(classroom);
		classroom.toolbarMode.should.equal('full');
	});

	it('removes non-object toolbarOverrides', function() {
		var classroom = {
			toolbarOverrides: 'not an object',
			activities: []
		};
		classrooms.cleanToolbar(classroom);
		chai.expect(classroom.toolbarOverrides).to.be.undefined;
	});

	it('removes array toolbarOverrides', function() {
		var classroom = {
			toolbarOverrides: ['simple'],
			activities: []
		};
		classrooms.cleanToolbar(classroom);
		chai.expect(classroom.toolbarOverrides).to.be.undefined;
	});

	it('keeps only valid override entries', function() {
		var classroom = {
			toolbarOverrides: {
				'org.sugarlabs.Blockrain': 'simple',
				'invalid': 'simple',
				'org.sugarlabs.Paint': 'full',
				'': 'simple'
			},
			activities: ['org.sugarlabs.Blockrain', 'org.sugarlabs.Paint']
		};
		classrooms.cleanToolbar(classroom);
		classroom.toolbarOverrides.should.deep.equal({
			'org.sugarlabs.Blockrain': 'simple',
			'org.sugarlabs.Paint': 'full'
		});
	});

	it('removes overrides for activities not in classroom.activities', function() {
		var classroom = {
			toolbarOverrides: {
				'org.sugarlabs.Blockrain': 'simple',
				'org.sugarlabs.Paint': 'full'
			},
			activities: ['org.sugarlabs.Blockrain']
		};
		classrooms.cleanToolbar(classroom);
		classroom.toolbarOverrides.should.deep.equal({
			'org.sugarlabs.Blockrain': 'simple'
		});
	});

	it('ignores inherited keys like __proto__', function() {
		var classroom = {
			activities: ['org.sugarlabs.Blockrain']
		};
		// Manually set a property (simulating prototype pollution attempt)
		Object.defineProperty(classroom, 'toolbarOverrides', {
			value: { 'org.sugarlabs.Blockrain': 'simple' },
			enumerable: true,
			configurable: true
		});
		classrooms.cleanToolbar(classroom);
		classroom.toolbarOverrides.should.deep.equal({
			'org.sugarlabs.Blockrain': 'simple'
		});
	});

	it('removes invalid override values', function() {
		var classroom = {
			toolbarOverrides: {
				'org.sugarlabs.Blockrain': 'simple',
				'org.sugarlabs.Paint': 'invalid'
			},
			activities: ['org.sugarlabs.Blockrain', 'org.sugarlabs.Paint']
		};
		classrooms.cleanToolbar(classroom);
		classroom.toolbarOverrides.should.deep.equal({
			'org.sugarlabs.Blockrain': 'simple'
		});
	});
});

describe('toolbar mode edge cases', function() {
	it('uses the classroom default when the override of the activity is invalid', function() {
		var list = [{ activities: ['org.sugarlabs.Blockrain'], toolbarMode: 'simple', toolbarOverrides: { 'org.sugarlabs.Blockrain': 'bogus' } }];
		activities.resolveToolbarMode('org.sugarlabs.Blockrain', list).should.equal('simple');
	});
	it('keeps valid overrides when the list of activities is not part of the update', function() {
		var classroom = { toolbarOverrides: { 'org.sugarlabs.Blockrain': 'full', 'org.sugarlabs.TankOp': 'nope' } };
		classrooms.cleanToolbar(classroom);
		classroom.toolbarOverrides.should.deep.equal({ 'org.sugarlabs.Blockrain': 'full' });
	});
});
