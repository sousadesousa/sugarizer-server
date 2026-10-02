// Loaded in the server process of the e2e tests (node --require): makes what the dashboard renders repeatable.
// - the clock starts at the fixed time of the harness and then runs normally, so timestamps shown by the dashboard
//   ("Today at 10:00 AM") are the same on every run
// - Math.random is a seeded generator, so the "random" colors the dashboard picks do not change between runs
// Only used by the tests, never by the real server.
(function() {
	var RealDate = Date;
	var offset = Number(process.env.E2E_CLOCK_OFFSET_MS || 0);

	function FakeDate() {
		if (!(this instanceof FakeDate)) {
			return new RealDate(RealDate.now() + offset).toString();
		}
		if (arguments.length === 0) {
			return new RealDate(RealDate.now() + offset);
		}
		var args = [null].concat(Array.prototype.slice.call(arguments));
		return new (Function.prototype.bind.apply(RealDate, args))();
	}
	FakeDate.prototype = RealDate.prototype;
	FakeDate.now = function() {
		return RealDate.now() + offset;
	};
	FakeDate.parse = RealDate.parse;
	FakeDate.UTC = RealDate.UTC;
	global.Date = FakeDate;

	// mulberry32
	var state = Number(process.env.E2E_RANDOM_SEED || 1) >>> 0;
	Math.random = function() {
		state = (state + 0x6D2B79F5) >>> 0;
		var t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
})();
