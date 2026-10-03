// Unit test for the GitHub Actions workflow: it must stay valid YAML and keep running the dashboard e2e suite
var chai = require('chai');
var fs = require('fs');
var path = require('path');
var YAML = require('yaml');

chai.should();

describe('GitHub Actions workflow of the tests', function() {
	var workflow = YAML.parse(fs.readFileSync(path.join(__dirname, '../../../.github/workflows/test.yml'), 'utf8'));

	function runs(job, command) {
		return job.steps.some(function(step) {
			return typeof step.run == 'string' && step.run.indexOf(command) != -1;
		});
	}

	it('has the API tests job and the dashboard e2e job', function() {
		workflow.should.have.property('jobs');
		workflow.jobs.should.have.all.keys('test', 'e2e');
		runs(workflow.jobs.test, 'npm test').should.equal(true);
	});

	describe('e2e job', function() {
		var job = workflow.jobs.e2e || { steps: [] };

		it('has a MongoDB service', function() {
			job.should.have.property('services');
			job.services.should.have.property('mongodb');
			job.services.mongodb.ports.should.include('27017:27017');
		});

		it('installs Chromium for Playwright before running the suite', function() {
			var install = job.steps.findIndex(function(step) {
				return typeof step.run == 'string' && step.run.indexOf('playwright install --with-deps chromium') != -1;
			});
			var suite = job.steps.findIndex(function(step) {
				return typeof step.run == 'string' && step.run.indexOf('npm run test:e2e') != -1 && step.run.indexOf('compare') == -1;
			});
			install.should.be.above(-1);
			suite.should.be.above(install);
		});

		it('does not fail on the screenshot differences', function() {
			var suite = job.steps.filter(function(step) {
				return typeof step.run == 'string' && step.run.trim() == 'npm run test:e2e';
			})[0];
			suite.should.be.an('object');
			// the suite only saves the screenshots: no pixel assertion in the specs
			var specs = path.join(__dirname, '../../../test/e2e');
			fs.readdirSync(specs).filter(function(file) {
				return /\.spec\.js$/.test(file);
			}).forEach(function(file) {
				fs.readFileSync(path.join(specs, file), 'utf8').should.not.match(/toHaveScreenshot|toMatchSnapshot/);
			});
			// and the comparison with the baseline is a report that never blocks
			var compare = job.steps.filter(function(step) {
				return typeof step.run == 'string' && step.run.indexOf('test:e2e:compare') != -1;
			})[0];
			compare.should.be.an('object');
			compare['continue-on-error'].should.equal(true);
		});

		it('uploads the test results as an artifact, even when the suite fails', function() {
			var upload = job.steps.filter(function(step) {
				return typeof step.uses == 'string' && step.uses.indexOf('actions/upload-artifact') == 0;
			})[0];
			upload.should.be.an('object');
			upload.with.path.should.match(/test-results/);
			upload.if.should.equal('always()');
		});
	});
});
