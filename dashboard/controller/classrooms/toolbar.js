/**
 * Parse toolbar overrides from form data.
 * Converts form input (array of "activityId=mode" strings) into an object mapping activityId -> mode.
 * Only includes activities that are in the activities array and have valid modes (simple/full).
 *
 * @param {Array|string} toolbarOverridesInput - The raw form data (may be string, array, or undefined)
 * @param {Array} activities - Array of activity IDs that are selected
 * @returns {Object} Object mapping activityId -> "simple" | "full"
 */
function parseToolbarOverrides(toolbarOverridesInput, activities) {
	// Normalize input to array
	var overridesArray = toolbarOverridesInput || [];
	if (typeof overridesArray === 'string') {
		overridesArray = [overridesArray];
	}

	// Ensure activities is an array
	if (!Array.isArray(activities)) {
		activities = [];
	}

	var result = {};

	// Process each override entry
	overridesArray.forEach(function(entry) {
		if (!entry || typeof entry !== 'string') {
			return;
		}

		// Split at LAST '=' to handle activity IDs with dots
		var lastEqualIndex = entry.lastIndexOf('=');
		if (lastEqualIndex === -1) {
			return;
		}

		var activityId = entry.substring(0, lastEqualIndex);
		var mode = entry.substring(lastEqualIndex + 1);

		// Skip empty entries
		if (!activityId || !mode) {
			return;
		}

		// Only keep valid modes
		if (mode !== 'simple' && mode !== 'full') {
			return;
		}

		// Only keep activities that are in the selected activities list
		if (activities.indexOf(activityId) === -1) {
			return;
		}

		result[activityId] = mode;
	});

	return result;
}

module.exports = {
	parseToolbarOverrides: parseToolbarOverrides
};
