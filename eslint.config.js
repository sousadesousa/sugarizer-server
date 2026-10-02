// ESLint configuration: rules and overrides stay in .eslintrc.json
const { FlatCompat } = require("@eslint/eslintrc");
const js = require("@eslint/js");

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended
});

module.exports = [
	{
		ignores: [
			"node_modules/**",
			"dashboard/node_modules/**",
			"docs/**",
			"build/**",
			"coverage/**",
			".nyc_output/**",
			"dashboard/public/js/bootstrap.bundle.min.js",
			"dashboard/public/js/driver.js.iife.js",
			"dashboard/public/js/Chart.min.js",
			"dashboard/public/js/jquery-3.7.1.min.js",
			"dashboard/public/js/jquery-ui-1-11-4.js",
			"dashboard/public/js/jquery.ui.sortable-animation.js",
			"dashboard/public/js/jquery.multi-select.js",
			"dashboard/public/js/jquery.searchable.js",
			"dashboard/public/js/l10n.js",
			"dashboard/public/js/moment.min.js",
			"dashboard/public/js/noty.js",
			"dashboard/public/js/pace.min.js",
			"dashboard/public/js/qrcodegen.js",
			"dashboard/public/js/FileSaver.js",
			"dashboard/public/js/select2.min.js",
			"dashboard/public/js/jquery.datetimepicker.full.js",
			"api/controller/utils/qrCodeUtil.js"
		]
	},
	...compat.config(require("./.eslintrc.json"))
];
