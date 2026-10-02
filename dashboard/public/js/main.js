function initDragDrop() {

	$("ol.simple_with_animation").sortable({
		handle: '.draggable',
		axis: 'y',
		containment: 'parent',
		animation: 150,
		scrollSensitivity: 50,
		scrollSpeed: 15,
		update: function (event, ui) {
			//update activities
			updateActivities();
		},
	});
}

// -- HTML5 IndexedDB handling
var html5indexedDB = {};
html5indexedDB.db = null;
var filestoreName = 'sugar_filestore';

// Test indexedDB support
html5indexedDB.test = function () {
	return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
};

// Load database or create database on first launch
html5indexedDB.load = function (then) {
	if (html5indexedDB.db != null) {
		then(null);
		return;
	}
	if (!html5indexedDB.test()) {
		if (then) {
			then(-1);
		}
		return;
	}
	var request = window.indexedDB.open(filestoreName, 1);
	request.onerror = function () {
		if (then) {
			then(-2);
		}
	};
	request.onsuccess = function () {
		html5indexedDB.db = request.result;
		if (then) {
			then(null);
		}
	};
	request.onupgradeneeded = function (event) {
		var db = event.target.result;
		var objectStore = db.createObjectStore(filestoreName, { keyPath: "objectId" });
		objectStore.createIndex("objectId", "objectId", { unique: true });
	};
};

// Set a value in the database
html5indexedDB.setValue = function (key, value, then) {
	var transaction = html5indexedDB.db.transaction([filestoreName], "readwrite");
	var objectStore = transaction.objectStore(filestoreName);
	var request = objectStore.put({ objectId: key, text: value });
	request.onerror = function () {
		if (then) {
			then(request.errorCode);
		}
	};
	request.onsuccess = function () {
		if (then) {
			then(null);
		}
	};
};

// Remove a value from the database
html5indexedDB.removeValue = function (key, then) {
	var transaction = html5indexedDB.db.transaction([filestoreName], "readwrite");
	var objectStore = transaction.objectStore(filestoreName);
	var request = objectStore.delete(key);
	request.onerror = function () {
		if (then) {
			then(request.errorCode);
		}
	};
	request.onsuccess = function () {
		if (then) {
			then(null);
		}
	};
};

function base64toBlob(mimetype, base64) {
	var contentType = mimetype;
	var byteCharacters = atob(base64.substr(base64.indexOf(';base64,') + 8));
	var byteArrays = [];
	for (var offset = 0; offset < byteCharacters.length; offset += 1024) {
		var slice = byteCharacters.slice(offset, offset + 1024);
		var byteNumbers = new Array(slice.length);
		for (var i = 0; i < slice.length; i++) {
			byteNumbers[i] = slice.charCodeAt(i);
		}
		var byteArray = new Uint8Array(byteNumbers);
		byteArrays.push(byteArray);
	}
	var blob = new Blob(byteArrays, { type: contentType });
	return blob;
}

function launch_activity(callurl) {
	function loadDataDeprec(response, lsBackup) {
		for (var index in response.lsObj) {
			lsBackup[index] = localStorage.getItem(index);
			var encodedValue = response.lsObj[index];
			var rawValue = JSON.parse(encodedValue);
			if (rawValue && rawValue.server) {
				rawValue.server.url = window.location.protocol + "//" + window.location.hostname + ":" + rawValue.server.web;
				encodedValue = JSON.stringify(rawValue);
			}
			localStorage.setItem(index, encodedValue);
		}
	}

	function loadData(response, lsBackup, callback) {
		var len = 0;
		for (var index in response.lsObj) {
			len++;
		}
		var lastCall = function () {
			if (--len == 0) {
				callback();
			}
		};
		for (var index in response.lsObj) {
			lsBackup[index] = localStorage.getItem(index);
			if (index == "sugar_datastoretext_" + response.objectId) {
				html5indexedDB.setValue(response.objectId, response.lsObj[index], lastCall);
			} else {
				var encodedValue = response.lsObj[index];
				var rawValue = JSON.parse(encodedValue);
				if (rawValue && rawValue.server) {
					rawValue.server.url = window.location.protocol + "//" + window.location.hostname + ":" + rawValue.server.web;
					encodedValue = JSON.stringify(rawValue);
				}
				localStorage.setItem(index, encodedValue);
				lastCall();
			}
		}
	}

	$.get((callurl), function (response) {
		if (response.error) {
			notify(response.error, 'danger');
		}

		var metadata = {};
		if (response && response.lsObj) {
			try {
				metadata = JSON.parse(response.lsObj["sugar_datastore_" + response.objectId]);
			} catch (e) {
				metadata = response.lsObj["sugar_datastore_" + response.objectId];
			}
		}
		if (metadata && metadata.metadata && metadata.metadata.mimetype == "application/pdf") {
			// Convert blob object URL
			var blob = base64toBlob(metadata.metadata.mimetype, response.lsObj["sugar_datastoretext_" + response.objectId]);
			var blobUrl = URL.createObjectURL(blob);

			// Open in a new browser tab
			window.open(blobUrl, '_blank');
			return;
		}

		// backup current storage and create a virtual context in local storage
		var keyHistory = [];
		var datastorePrefix = 'sugar_datastore';
		for (var i = 0; i < localStorage.length; i++) {
			var key = localStorage.key(i);
			if (key.indexOf(datastorePrefix) == 0) {
				keyHistory.push(key);
			}
		}

		// open window
		var openInWindow = function () {
			if (response.url) {
				var win = window.open(response.url + "&sa=1", '_blank');
				if (win) {
					win.focus();
					win.onbeforeunload = function () {
						// restore old context
						for (var index in lsBackup) {
							if (lsBackup[index] == null) {
								localStorage.removeItem(index);
							} else {
								localStorage.setItem(index, lsBackup[index]);
							}
						}

						// remove created storage
						for (var i = 0; i < localStorage.length; i++) {
							var key = localStorage.key(i);
							if (key.indexOf(datastorePrefix) == -1) {
								continue;
							}
							var found = false;
							for (var j = 0; !found && j < keyHistory.length; j++) {
								if (keyHistory[j] == key) {
									found = true;
								}
							}
							if (!found) {
								localStorage.removeItem(key);
							}
						}

						// Remove IndexDB storage if was not already there
						if (response.version > 1.1 && html5indexedDB.db != null) {
							if (!lsBackup["sugar_datastore_" + response.objectId]) {
								html5indexedDB.removeValue(response.objectId);
							}
						}
					};
				} else {
					notify(document.webL10n.get('CantOpenWindow'), 'danger');
				}
			}
		};

		// Check Sugarizer Version -- Backward Compatibilty
		var lsBackup = [];
		if (response.version > 1.1) {
			if (html5indexedDB.db == null) {
				html5indexedDB.load(function (err) {
					if (err) {
						console.log("FATAL ERROR: indexedDB not supported, could be related to use of private mode");
					} else {
						loadData(response, lsBackup, function () {
							openInWindow();
						});
					}
				});
			} else {
				loadData(response, lsBackup, function () {
					openInWindow();
				});
			}
		} else {
			loadDataDeprec(response, lsBackup);
			openInWindow();
		}
	});
}

function updateActivities() {

	//get favorites
	var list = [];
	$.each($('[name="favoriteActivities"]:checked'), function (index, value) {
		list.push($(this).parent().data('id'));
	});
	var data = {
		favorites: list.join()
	};

	$.post((url + 'api/v1/activities?' + decodeURIComponent($.param({
		x_key: headers['x-key'],
		access_token: headers['x-access-token']
	}))), data, function (response) {
		notify(document.webL10n.get('successActivityUpdate'), 'success');
	});
}

function initChartDragDrop() {
	$("ol.simple_with_animation").sortable({
		handle: '.draggable',
		axis: 'y',
		containment: 'parent',
		animation: 150,
		scrollSensitivity: 50,
		scrollSpeed: 15,
		update: function (event, ui) {
			//update chart order
			updateChartOrder();
		},
	});
}

function updateChartOrder() {
	var list = [];
	$.each($('[name="hiddenCharts"]'), function (index, value) {
		list.push($(this).parent().data('id'));
	});
	var data = {
		chart: JSON.stringify({
			list: list
		})
	};

	$.ajax({
		url: (url + 'api/v1/charts/reorder' + '?' + decodeURIComponent($.param({
			x_key: headers['x-key'],
			access_token: headers['x-access-token']
		}))),
		type: 'PUT',
		data: data,
		success: function (result) {
			notify(document.webL10n.get('successChartUpdate'), 'success');
		}
	});
}

function updateChart(chartid) {
	if (!chartid) return;
	var hidden = false;
	if ($('#' + chartid).is(":checked")) {
		hidden = true;
	}
	var data = {
		chart: JSON.stringify({
			hidden: hidden
		})
	};

	$.ajax({
		url: (url + 'api/v1/charts/' + chartid + '?' + decodeURIComponent($.param({
			x_key: headers['x-key'],
			access_token: headers['x-access-token']
		}))),
		type: 'PUT',
		data: data,
		success: function (result) {
			notify(document.webL10n.get('successChartUpdate'), 'success');
		}
	});
}

function formatUserField(state) {
	if (!state._id) {
		return state.text;
	}
	var d = new Date(state.timestamp);
	var $state = $(
		'<div class="student" id="' + state._id + '">\
			<div class="xo-icon"></div>\
			<div class="name">' + state.name + '</div>\
			<div class="timestamp">' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + '</div>\
		</div>\
		<script>\
			new icon().load("/public/img/owner-icon.svg", ' + JSON.stringify(state.color) + ', "' + state._id + '");\
		</script>'
	);
	return $state;
}

function formatColorField(state) {
	if (!state.id) {
		return $(state.element).val();
	}
	var id = $(state.element).data('stroke') + $(state.element).data('fill') + Math.floor((Math.random() * 100) + 1);
	var $state = $(
		'<div class="color" id="' + id + '">\
			<div class="xo-icon"></div>\
			<div class="stroke">Stroke - ' + $(state.element).data('stroke') + '</div>\
			<div class="fill">Fill - ' + $(state.element).data('fill') + '</div>\
		</div>'
	);
	if ($(state.element).data('icon')) {
		new icon().load("/public/img/" + $(state.element).data('icon') + ".svg", JSON.parse($(state.element).val()), id);
	} else {
		new icon().load("/public/img/owner-icon.svg", JSON.parse($(state.element).val()), id);
	}
	return $state;
}

function matchColorField(params, data) {
	if ($.trim(params.term) === '') {
		return data;
	}
	params.term = params.term.toUpperCase();

	if (typeof data.text === 'undefined') {
		return null;
	}

	if (data.id.indexOf(params.term) > -1) {
		var modifiedData = $.extend({}, data, true);
		modifiedData.text += ' (matched)';
		return modifiedData;
	}

	return null;
}

$(document).ready(function () {
	document.webL10n.ready(function () {
		var refreshIntervalId = setInterval(function () {
			if (document.webL10n.getReadyState() == "complete") {
				clearInterval(refreshIntervalId);
				if ($("#users-select2").length > 0) {
					$("#users-select2").select2({
						ajax: {
							url: "/dashboard/users/search",
							dataType: 'json',
							delay: 250,
							data: function (params) {
								return {
									q: params.term,
									role: 'stuteach'
								};
							},
							processResults: function (data) {
								if (data && data.data && data.data.users && data.data.users.length > 0) {
									for (var i = 0; i < data.data.users.length; i++) {
										data.data.users[i].id = data.data.users[i]._id;
										data.data.users[i].text = data.data.users[i].name;
									}
									return {
										results: data.data.users
									};
								} else {
									return {
										results: []
									};
								}
							},
							cache: true
						},
						templateResult: formatUserField,
						placeholder: document.webL10n.get("searchUser")
					}).on("select2:select", function (e) {
						if (e.params && e.params.data && (e.params.data.private_journal || e.params.data.shared_journal)) {
							document.pj_global = e.params.data.private_journal;
							document.sj_global = e.params.data.shared_journal;
							$('#getJournalEntries').attr('action', '/dashboard/journal/' + document.pj_global);
						}
					}).on("change", function (e) {
						if ($("#users-select2 option:selected").data('private_journal') || $("#users-select2 option:selected").data('shared_journal')) {
							document.pj_global = $("#users-select2 option:selected").data('private_journal');
							document.sj_global = $("#users-select2 option:selected").data('shared_journal');
							$('#getJournalEntries').attr('action', '/dashboard/journal/' + document.pj_global);
						}
					});
					$("#users-select2").trigger("change");
				}
			}
		}, 100);
	});

	if ($("#color-select2").length > 0) {
		$("#color-select2").select2({
			templateResult: formatColorField,
			templateSelection: formatColorField,
			matcher: matchColorField
		});
	}
});


// Security token of the session, sent with every request that changes something
function csrfToken() {
	return $('meta[name="csrf-token"]').attr('content') || '';
}

// Send a POST request to an url with a form (for links that change something)
function postTo(url) {
	var form = document.createElement('form');
	form.method = 'POST';
	form.action = url;
	var input = document.createElement('input');
	input.type = 'hidden';
	input.name = '_csrf';
	input.value = csrfToken();
	form.appendChild(input);
	document.body.appendChild(form);
	form.submit();
}

// Follow a link with a POST request
function postLink(link) {
	postTo(link.getAttribute('href'));
	return false;
}

// Ask confirmation, with the name read from the data-name attribute (never from JS source),
// then follow the link with a POST request. Without link, only returns the answer.
function confirmWith(link, key, param) {
	var params = {};
	params[param] = link.getAttribute('data-name') || '';
	if (!confirm(document.webL10n.get(key, params))) {
		return false;
	}
	if (link.getAttribute('href')) {
		postTo(link.getAttribute('href'));
		return false;
	}
	return true;
}

// Add the security token to every ajax request that changes something on the dashboard and to the forms
$.ajaxSetup({
	beforeSend: function(xhr, settings) {
		if (!/^(GET|HEAD|OPTIONS)$/i.test(settings.type || 'GET') && !/^(https?:)?\/\//i.test(settings.url || '')) {
			xhr.setRequestHeader('x-csrf-token', csrfToken());
		}
	}
});
$(function() {
	$('form').filter(function() {
		return (this.getAttribute('method') || '').toLowerCase() == 'post';
	}).each(function() {
		if (!$(this).find('input[name="_csrf"]').length) {
			$('<input type="hidden" name="_csrf">').val(csrfToken()).appendTo(this);
		}
	});
});

function highlight(text) {

	//set var
	var offset = -1;
	var text = text.toLowerCase().trim();

	//search elemetns for text
	$('.search_textbox').each(function () {

		//get data
		var inputText = $(this).text();
		var index = inputText.toLowerCase().indexOf(text);

		//check: rebuild the content with text nodes only, so the text is never parsed as HTML
		$(this).empty();
		if (index >= 0 && text.length > 0) {
			if (offset == -1) {
				offset = $(this).offset().top;
			}
			$(this).append(document.createTextNode(inputText.substring(0, index)));
			$(this).append($('<span class="highlight"></span>').text(inputText.substring(index, index + text.length)));
			$(this).append(document.createTextNode(inputText.substring(index + text.length)));
		} else {
			$(this).append(document.createTextNode(inputText));
		}
	});

	//show error
	if (offset === -1 && text !== '') {
		$('.control-label').removeClass('hidden');
		$('.search_query')
			.parent()
			.addClass('label-floating has-error is-focused')
			.removeClass('form-black is-empty');
	} else {
		$('.control-label').addClass('hidden');
		$('.search_query')
			.parent()
			.removeClass('label-floating has-error is-focused');
	}

	//scroll
	if ($(window).width() < 992) {
		$('.main-panel').animate({
			scrollTop: (offset - 86)
		}, 500);
	} else {
		$('.main-panel').animate({
			scrollTop: (offset - 30)
		}, 500);
	}
}

//hide label when input is empty
function hideLabel(value) {
	if (value === '') {
		$('.control-label').addClass('hidden');
		highlight('');
	}
}

// localization
function onLocalized() {
	var l10n = document.webL10n;
	var lang = document.getElementById('languageSelection');

	if (lang != null) {
		if (lang.selectedIndex == -1) {
			lang.value = l10n.getLanguage();
		} else if (localStorage.getItem("languageSelection") == null) {
			l10n.setLanguage(lang.options[lang.selectedIndex].value);
		} else {
			l10n.setLanguage(localStorage.getItem("languageSelection"));
			lang.value = localStorage.getItem("languageSelection");
		}
		lang.onchange = function () {
			localStorage.setItem("languageSelection", this.value);
			var searchQuery = location.search;
			if (searchQuery.length == 0) {
				//query empty
				searchQuery = '?lang=' + lang.value;
			} else if (searchQuery.indexOf('lang=') != -1) {
				// query contains the 'lang=' parameter
				searchQuery = searchQuery.replace(/lang=[a-z][a-z]/, 'lang=' + lang.value);
			} else {
				// query does not contain 'lang=' parameter
				searchQuery += '&lang=' + lang.value;
			}
			location.href = window.location.pathname + searchQuery;
		};
	}
}
document.webL10n.ready(onLocalized);

// Initiate localization in mobile view
$(document).ready(function () {
	var toggle = document.getElementById('navbar-toggle');

	if (toggle != null) {
		toggle.addEventListener("click", function () {
			document.webL10n.ready(onLocalized);
		});
	}
});

// graph create
function createGraph(type, element, route) {
	$(document).ready(function () {
		$.get(('/dashboard/' + (route ? route : 'graph')), {
			type: type,
			element: element
		}, function (response) {

			//check for data
			if (response.data.datasets[0].data.length == 0) {
				var html = '<div class="text-center">\
											<i class="material-icons dp96 text-muted">info_outline</i>\
											<p data-l10n-id="noGraphDataText">' + document.webL10n.get('noGraphDataText') + '</p>\
										</div>';
				$("#" + response.element).replaceWith(html);
			} else {
				var ctx = document.getElementById(response.element).getContext('2d');
				var myChart = new Chart(ctx, {
					type: response.graph,
					data: response.data,
					options: (response.options ? response.options : {})
				});
				if (type == 'top-contributor') {
					myChart.options.onClick = function (e) {
						var activePoints = myChart.getElementsAtEvent(e);
						// Avoid console erros when clicking on any white space in the chart
						var index = activePoints.length ? activePoints[0]._index : -1;
						if (index > -1) {
							window.location.href = "/dashboard/journal/" + response.journalIDs[index] + "?uid=" + response.userIDs[index] + "&type=private";
						}
					};
				} else if (type == 'top-activities') {
					myChart.options.onClick = function (e) {
						var activePoints = myChart.getElementsAtEvent(e);
						// Avoid console erros when clicking on any white space in the chart
						var index = activePoints.length ? activePoints[0]._index : -1;
						if (index > -1) {
							window.location.href = "javascript:launch_activity('/dashboard/activities/launch?aid=" + response.activityIDs[index] + "')";
						}
					};
				}
			}
		});
	});
}

function createTable(type, element, route) {
	$(document).ready(function () {
		$.get(('/dashboard/' + (route ? route : 'graph')), {
			type: type,
			element: element
		}, function (response) {
			$('#' + response.element + ' tbody').html(response.data);
		});
	});
}

function convertToCSV(objArray) {
	var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
	var str = '';

	for (var i = 0; i < array.length; i++) {
		var line = '';
		var flag = false;
		for (var index in array[i]) {
			if (flag) line += ',';
			flag = true;

			try {
				JSON.parse(array[i][index]);
				line += array[i][index];
			} catch (e) {
				var value = array[i][index];
				// avoid formulas in spreadsheets (CSV injection)
				if (typeof value == 'string' && /^[=+\-@\t\r]/.test(value)) {
					value = "'" + value;
				}
				line += JSON.stringify(value);
			}
		}

		str += line + '\r\n';
	}

	return str;
}

function exportCSVFile(headers, items, fileTitle) {
	if (headers) {
		items.unshift(headers);
	}

	// Convert Object to JSON
	var jsonObject = JSON.stringify(items);

	var csv = this.convertToCSV(jsonObject);

	var exportedFilenmae = fileTitle + '.csv' || 'export.csv';

	var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	if (navigator.msSaveBlob) { // IE 10+
		navigator.msSaveBlob(blob, exportedFilenmae);
	} else {
		var link = document.createElement("a");
		if (link.download !== undefined) { // feature detection
			// Browsers that support HTML5 download attribute
			var url = URL.createObjectURL(blob);
			link.setAttribute("href", url);
			link.setAttribute("download", exportedFilenmae);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}
}

function getJsonFromUrl(url) {
	if (!url) url = location.search;
	var query = url.substr(1);
	var result = {};
	query.split("&").forEach(function (part) {
		var item = part.split("=");
		result[item[0]] = decodeURIComponent(item[1]);
	});
	return result;
}

function handleSort() {
	var query = getJsonFromUrl();
	if (query.sort) {
		if (query.sort == "+name" || query.sort == " name") {
			document.getElementById("name-column").innerHTML = document.getElementById("name-column").innerHTML + '<i class="arrow up"></i>';
		} else if (query.sort == "-name") {
			document.getElementById("name-column").innerHTML += '<i class="arrow down"></i>';
		} else if (query.sort == "+timestamp" || query.sort == " timestamp") {
			document.getElementById("last-column").innerHTML += '<i class="arrow up"></i>';
		} else if (query.sort == "-timestamp") {
			document.getElementById("last-column").innerHTML += '<i class="arrow down"></i>';
		} else if (query.sort == "+textsize" || query.sort == " textsize") {
			document.getElementById("journal-size").innerHTML += '<i class="arrow up"></i>';
		} else if (query.sort == "-textsize") {
			document.getElementById("journal-size").innerHTML += '<i class="arrow down"></i>';
		} else if (query.sort == "+title" || query.sort == " title") {
			document.getElementById("journal-title").innerHTML += '<i class="arrow up"></i>';
		} else if (query.sort == "-title") {
			document.getElementById("journal-title").innerHTML += '<i class="arrow down"></i>';
		}
	}
}

function sortBy(params) {
	var query = getJsonFromUrl();
	var prev = "";
	if (query['sort']) {
		prev = query['sort'];
	}
	if (params == "name") {
		if (prev == "-name") {
			query['sort'] = "+name";
		} else {
			query['sort'] = "-name";
		}
	} else if (params == "time") {
		if (prev == "+timestamp" || prev == " timestamp") {
			query['sort'] = "-timestamp";
		} else if (prev == "-timestamp") {
			delete query.sort;
		} else {
			query['sort'] = "+timestamp";
		}
	} else if (params == "size") {
		if (prev == "+textsize" || prev == " textsize") {
			query['sort'] = "-textsize";
		} else if (prev == "-textsize") {
			delete query.sort;
		} else {
			query['sort'] = "+textsize";
		}
	} else if (params == "title") {
		if (prev == "+title" || prev == " title") {
			query['sort'] = "-title";
		} else if (prev == "-title") {
			delete query.sort;
		} else {
			query['sort'] = "+title";
		}
	} else {
		delete query.sort;
	}

	var url = location.origin + location.pathname + '?';
	for (var key in query) {
		if (key && Object.prototype.hasOwnProperty.call(query, key)) {
			var val = query[key];
			url += key + '=' + val + '&';
		}
	}
	window.location.href = url;
}

// Date format of the date pickers, from the region of the browser and not from the language of the dashboard
// (a user of the English dashboard in Switzerland wants 22.03.2035, not 03-22-2035).
// Returns the format in the syntax of the date picker: 'd.m.Y' (de-CH, fr-CH), 'm/d/Y' (en-US), 'd/m/Y' (pt-PT),
// 'Y/m/d' (ja-JP). Digits are Latin and the calendar is Gregorian whatever the region, as the picker is.
function regionDateFormat() {
	var languages = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en-US'];
	var tokens = { day: 'd', month: 'm', year: 'Y' };
	for (var i = 0; i < languages.length; i++) {
		try {
			// 25 November 2001: every part has a different value
			var parts = new Intl.DateTimeFormat(languages[i], {
				year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory', numberingSystem: 'latn'
			}).formatToParts(new Date(2001, 10, 25));
			var format = '';
			var found = '';
			for (var j = 0; j < parts.length; j++) {
				if (tokens[parts[j].type]) {
					format += tokens[parts[j].type];
					found += tokens[parts[j].type];
				} else if (parts[j].type == 'literal') {
					// no invisible direction marks in the format
					format += parts[j].value.replace(/[\u200e\u200f\u061c]/g, '');
				}
			}
			if (found.length == 3 && found.indexOf('d') != -1 && found.indexOf('m') != -1 && found.indexOf('Y') != -1) {
				return format;
			}
		} catch (e) {
			// unknown language tag: try the next one
		}
	}
	return 'm/d/Y';
}

// First day of the week in the region of the browser, as the date picker wants it (0 Sunday ... 6 Saturday),
// or undefined when the browser does not tell (the picker then keeps its own default)
function regionWeekStart() {
	try {
		var locale = new Intl.Locale((navigator.languages && navigator.languages[0]) || navigator.language);
		var info = locale.getWeekInfo ? locale.getWeekInfo() : locale.weekInfo;
		if (info && info.firstDay) {
			return info.firstDay % 7;
		}
	} catch (e) {
		// not supported
	}
	return undefined;
}

// Text of a date in a date picker format ('d', 'm' and 'Y' are replaced, the rest is kept), in the time zone of the browser
function formatPickerDate(date, format) {
	function two(value) {
		return (value < 10 ? '0' : '') + value;
	}
	var text = '';
	for (var i = 0; i < format.length; i++) {
		var token = format.charAt(i);
		if (token == 'd') {
			text += two(date.getDate());
		} else if (token == 'm') {
			text += two(date.getMonth() + 1);
		} else if (token == 'Y') {
			text += date.getFullYear();
		} else {
			text += token;
		}
	}
	return text;
}

// Notification (flash message) on a Bootstrap toast, at the top right of the page.
// type: 'success' or 'danger' (also 'warning' and 'info'). The message is text, never HTML.
function notify(message, type) {
	type = type || 'info';
	var container = document.getElementById('notify-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'notify-container';
		container.className = 'toast-container position-fixed top-0 end-0 p-3';
		document.body.appendChild(container);
	}
	var toast = document.createElement('div');
	toast.className = 'toast notify notify-' + type;
	toast.setAttribute('role', type == 'danger' ? 'alert' : 'status');
	toast.setAttribute('aria-live', type == 'danger' ? 'assertive' : 'polite');
	toast.setAttribute('aria-atomic', 'true');
	toast.setAttribute('data-notify', 'container');
	var body = document.createElement('div');
	body.className = 'toast-body d-flex align-items-center';
	var icon = document.createElement('i');
	icon.className = 'material-icons';
	icon.setAttribute('aria-hidden', 'true');
	icon.textContent = (type == 'danger' || type == 'warning') ? 'error' : 'notifications';
	var text = document.createElement('span');
	text.className = 'notify-message';
	text.setAttribute('data-notify', 'message');
	text.textContent = message;
	var close = document.createElement('button');
	close.type = 'button';
	close.className = 'btn-close btn-close-white ms-auto';
	close.setAttribute('data-bs-dismiss', 'toast');
	close.setAttribute('aria-label', 'Close');
	body.appendChild(icon);
	body.appendChild(text);
	body.appendChild(close);
	toast.appendChild(body);
	container.appendChild(toast);
	toast.addEventListener('hidden.bs.toast', function() {
		toast.remove();
	});
	bootstrap.Toast.getOrCreateInstance(toast, { delay: 5000 }).show();
}

// Small screens (992px and less): the language and user menu of the navbar move to the top of the sidebar,
// which slides in from the right when the toggler of the navbar is used. Pages without sidebar (login) use the
// collapse of the navbar instead.
var mobileMenu = { built: false, visible: false };

function initMobileMenu() {
	var wrapper = $('.sidebar-wrapper');
	if (!wrapper.length) {
		$('#navbar-toggle').attr({ 'data-bs-toggle': 'collapse', 'data-bs-target': '.navbar-collapse' });
		return;
	}
	var small = $(window).width() <= 991;
	if (small && !mobileMenu.built) {
		var items = '';
		$('.navbar .navbar-collapse').first().clone(true).children('ul').each(function() {
			items += $(this).html();
		});
		var menu = $('<ul class="nav flex-column nav-mobile-menu"></ul>').html(items);
		var form = $('.navbar .navbar-form').first().clone(true);
		menu.insertBefore(wrapper.children('.nav').first());
		form.insertBefore(menu);
		mobileMenu.built = true;
	} else if (!small && mobileMenu.built) {
		wrapper.find('.navbar-form, .nav-mobile-menu').remove();
		mobileMenu.built = false;
		closeMobileMenu();
	}
}

function closeMobileMenu() {
	if (!mobileMenu.visible) {
		return;
	}
	$('html').removeClass('nav-open');
	var layer = $('.close-layer').removeClass('visible');
	setTimeout(function() {
		layer.remove();
	}, 400);
	$('#navbar-toggle').removeClass('toggled');
	mobileMenu.visible = false;
}

function toggleMobileMenu() {
	if (mobileMenu.visible) {
		closeMobileMenu();
		return;
	}
	var panel = $('.main-panel');
	var layer = $('<div class="close-layer"></div>').css('height', panel[0].scrollHeight + 'px').appendTo(panel);
	setTimeout(function() {
		layer.addClass('visible');
	}, 100);
	layer.on('click', closeMobileMenu);
	$('#navbar-toggle').addClass('toggled');
	$('html').addClass('nav-open');
	mobileMenu.visible = true;
}

$(function() {
	initMobileMenu();
	if ($('.sidebar-wrapper').length) {
		$('#navbar-toggle').on('click', toggleMobileMenu);
	}
	$(window).on('resize', initMobileMenu);
});

function launchTutorial() {
	if (window.currTour && typeof window.currTour.restart == "function") {
		if (window.location.pathname.substr(0, 19) == "/dashboard/journal/") {
			localStorage.removeItem('journal1_end');
			localStorage.removeItem('journal1_current_step');
		}
		window.currTour.restart();
	}
}

function generateQRCode() {
	var placeholder = document.getElementById("qrplaceholder");
	placeholder.innerHTML = "";
	var qrCode = new QRCode("qrplaceholder", { width: 300, height: 300, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
	qrCode.clear();
	qrCode.makeCode(window.location.protocol + "//" + window.location.host);
	bootstrap.Modal.getOrCreateInstance(document.getElementById('qrpopup')).show();
}

// Decoding functions taken from
// https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
function b64ToUint6(nChr) {
	return nChr > 64 && nChr < 91 ?
		nChr - 65
		: nChr > 96 && nChr < 123 ?
			nChr - 71
			: nChr > 47 && nChr < 58 ?
				nChr + 4
				: nChr === 43 ?
					62
					: nChr === 47 ?
						63
						:
						0;
}

function base64DecToArr(sBase64, nBlocksSize) {
	var
		sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, ""), nInLen = sB64Enc.length,
		nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2, taBytes = new Uint8Array(nOutLen);
	for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
		nMod4 = nInIdx & 3;
		nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 6 * (3 - nMod4);
		if (nMod4 === 3 || nInLen - nInIdx === 1) {
			for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
				taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
			}
			nUint24 = 0;
		}
	}
	return taBytes;
}

// Write a new file
function writeFile(metadata, content, callback) {
	var binary = null;
	var text = null;
	var extension = "json";
	var title = metadata.title;
	var mimetype = 'application/json';
	if (metadata && metadata.mimetype) {
		mimetype = metadata.mimetype;
		if (mimetype == "image/jpeg") {
			extension = "jpg";
		} else if (mimetype == "image/png") {
			extension = "png";
		} else if (mimetype == "audio/wav") {
			extension = "wav";
		} else if (mimetype == "video/webm") {
			extension = "webm";
		} else if (mimetype == "audio/mp3" || mimetype == "audio/mpeg") {
			extension = "mp3";
		} else if (mimetype == "video/mp4") {
			extension = "mp4";
		} else if (mimetype == "text/plain") {
			extension = "txt";
			text = content;
		} else if (mimetype == "application/pdf") {
			extension = "pdf";
		} else if (mimetype == "application/msword") {
			extension = "doc";
		} else if (mimetype == "application/vnd.oasis.opendocument.text") {
			extension = "odt";
		} else {
			extension = "bin";
		}
		binary = base64DecToArr(content.substr(content.indexOf('base64,') + 7)).buffer;
	} else {
		text = JSON.stringify({ metadata: metadata, text: content });
	}
	var filename = title;
	if (filename.indexOf("." + extension) == -1) {
		filename += "." + extension;
	}
	var blob = new Blob((text ? [text] : [binary]), { type: mimetype });
	callback(blob, filename);
}

function download_activity(callurl) {
	$.get((callurl), function (response) {
		if (response.error) {
			notify(response.error, 'danger');
		}

		var metadata = {};

		if (response && response.lsObj) {
			try {
				metadata = JSON.parse(response.lsObj["sugar_datastore_" + response.objectId]);
			} catch (e) {
				metadata = response.lsObj["sugar_datastore_" + response.objectId];
			}
			writeFile(metadata.metadata, response.lsObj["sugar_datastoretext_" + response.objectId], function (blob, filename) {
				saveAs(blob, filename);
			});
		}
	});
}

// Write file content to datastore
function writeFileToStore(file, text, callback) {
	if (file.type == 'application/json') {
		// Handle JSON file
		var data = null;
		try {
			data = JSON.parse(text);
			if (!data.metadata) {
				callback(file.name, -1);
				return;
			}
		} catch (e) {
			callback(file.name, -1);
			return;
		}
		callback(file.name, 0, data.metadata, data.text);
	} else {
		var activity = "";
		if (file.type != "text/plain" && file.type != "application/pdf" && file.type != "application/msword" && file.type != "application/vnd.oasis.opendocument.text") {
			activity = "org.olpcfrance.MediaViewerActivity";
		}
		var metadata = {
			title: file.name,
			mimetype: file.type,
			activity: activity
		};
		callback(file.name, 0, metadata, text);
	}
}

// Create a uuid
function createUUID() {
	var s = [];
	var hexDigits = "0123456789abcdef";
	for (var i = 0; i < 36; i++) {
		s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
	}
	s[14] = "4";
	s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
	s[8] = s[13] = s[18] = s[23] = "-";

	var uuid = s.join("");
	return uuid;
}

function upload_journal(files, journalId, name, user_id, color) {
	var file = files[0];
	var reader = new FileReader();
	reader.onload = function () {
		writeFileToStore(file, reader.result, function (filename, err, metadata, text) {
			if (err) {
				return;
			}
			if(metadata.assignmentId){
				notify("Error", 'danger');
				return;
			}
			metadata["timestamp"] = new Date().getTime();
			metadata["creation_time"] = new Date().getTime();
			if (text) {
				metadata["textsize"] = text.length;
			}
			if (name) {
				metadata["buddy_name"] = name;
			}
			if (color) {
				metadata["buddy_color"] = color;
			} else if (!metadata["buddy_color"]) {
				metadata["buddy_color"] = {
					"stroke": "#005FE4",
					"fill": "#FF2B34"
				};
			}
			if (user_id) {
				metadata["user_id"] = user_id;
			}

			var entry = JSON.stringify({
				"objectId": createUUID(),
				"text": text,
				"metadata": metadata
			});

			$.post(('/api/v1/journal/' + journalId + '/?' + decodeURIComponent($.param({
				x_key: headers['x-key'],
				access_token: headers['x-access-token']
			}))), {
				"journal": entry
			}, function (res) {
				var timer = 2000;
				if (res && res.objectId) {
					notify(document.webL10n.get('journalUploaded', { title: metadata.title }), 'success');
				} else {
					notify(document.webL10n.get('journalUploadError'), 'danger');
				}
				setTimeout(function () {
					location.reload();
				}, timer);
			});
		});

	};

	if (file) {
		if (file.type == 'application/json' || file.type == 'text/plain') {
			reader.readAsText(file);
		} else {
			reader.readAsDataURL(file);
		}
	}
}

function checkAll() {
	var state = document.getElementById("checkAll") ? document.getElementById("checkAll").checked : false;
	var check = [];
	if (document.getElementsByClassName("journal-checkbox").length > 0) {
		check = document.getElementsByClassName("journal-checkbox");
	} else if (document.getElementsByClassName("users-checkbox").length > 0) {
		check = document.getElementsByClassName("users-checkbox");
	} else if (document.getElementsByClassName("classrooms-checkbox").length > 0) {
		check = document.getElementsByClassName("classrooms-checkbox");
	} else if (document.getElementsByClassName("assignment-checkbox").length > 0) {
		check = document.getElementsByClassName("assignment-checkbox");
	}
	for (var i = 0; i < check.length; i++) {
		check[i].checked = state;
	}
}

function deleteMultipleEntries() {
	function displayNotification(success, failed) {
		var timer = 2000;
		if (success > 0 && failed > 0) {
			notify(document.webL10n.get('deleteSuccessFailEntry', { success: success, failed: failed }), 'success');
		} else if (failed == 0) {
			notify(document.webL10n.get('deleteEntrySuccess', { success: success }), 'success');
		} else {
			notify(document.webL10n.get('deleteEntryFailed'), 'danger');
		}
		setTimeout(function () {
			location.reload();
		}, timer);
	}
	if (document.getElementsByClassName("journal-checkbox").length > 0) {
		var check = document.getElementsByClassName("journal-checkbox");
		var toBeDeleted = [];
		var totalSelected = 0;
		var totalDeleted = 0;
		var totalFailed = 0;
		for (var i = 0; i < check.length; i++) {
			if (check[i].checked) {
				totalSelected++;
				var el = {};
				if (check[i].getAttribute("jid")) el["jid"] = check[i].getAttribute("jid");
				else {
					totalFailed++;
					continue;
				}

				if (check[i].getAttribute("oid")) el["oid"] = check[i].getAttribute("oid");
				else {
					totalFailed++;
					continue;
				}
				toBeDeleted.push(el);
			}
		}

		if (totalSelected == 0) {
			notify(document.webL10n.get('noEntriesSelectedDelete'), 'danger');
		} else {
			var confirmation = confirm(document.webL10n.get('deleteEntryConfirmation', { selected: totalSelected }));
			if (confirmation) {
				if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
				for (var i = 0; i < toBeDeleted.length; i++) {
					$.ajax({
						url: ('/api/v1/journal/' + toBeDeleted[i].jid + '?' + decodeURIComponent($.param({
							x_key: headers['x-key'],
							access_token: headers['x-access-token'],
							oid: toBeDeleted[i].oid,
							type: 'partial'
						}))),
						type: 'DELETE',
						success: function (response) {
							if (response && response.objectId) {
								totalDeleted++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							} else {
								totalFailed++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							}
						},
						fail: function () {
							totalFailed++;
							if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
						}
					});
				}
			}
		}
	}
}

function downloadMultipleEntries() {
	function displayNotification(success, failed) {
		if (success > 0 && failed > 0) {
			notify(document.webL10n.get('downloadSuccessFail', { success: success, failed: failed }), 'success');
		} else if (failed == 0) {
			notify(document.webL10n.get('downloadSuccess', { success: success }), 'success');
		} else {
			notify(document.webL10n.get('downloadFailed'), 'danger');
		}
	}
	if (document.getElementsByClassName("journal-checkbox").length > 0) {
		var check = document.getElementsByClassName("journal-checkbox");
		var toBeDownloaded = [];
		var totalSelected = 0;
		var totalDownloaded = 0;
		var totalFailed = 0;
		for (var i = 0; i < check.length; i++) {
			if (check[i].checked) {
				totalSelected++;
				var el = {};
				if (check[i].getAttribute("jid")) el["jid"] = check[i].getAttribute("jid");
				else {
					totalFailed++;
					continue;
				}

				if (check[i].getAttribute("oid")) el["oid"] = check[i].getAttribute("oid");
				else {
					totalFailed++;
					continue;
				}

				if (check[i].getAttribute("uid")) el["uid"] = check[i].getAttribute("uid");
				else {
					totalFailed++;
					continue;
				}

				if (check[i].getAttribute("aid")) el["aid"] = check[i].getAttribute("aid");
				else {
					totalFailed++;
					continue;
				}

				var callurl = "/dashboard/activities/launch/" + el.jid + "?oid=" + el.oid + "&source=journal&uid=" + el.uid + "&aid=" + el.aid + "&mode=download";
				toBeDownloaded.push(callurl);
			}
		}
		if (totalSelected == 0) {
			notify(document.webL10n.get('noEntriesSelectedDownload'), 'danger');
		} else {
			var confirmation = confirm(document.webL10n.get('downloadEntryConfirmation', { selected: totalSelected }));
			if (confirmation) {
				if (totalDownloaded + totalFailed == totalSelected) displayNotification(totalDownloaded, totalFailed);
				for (var i = 0; i < toBeDownloaded.length; i++) {
					$.get((toBeDownloaded[i]), function (response) {
						if (response.error) {
							totalFailed++;
						}

						var metadata = {};

						if (response && response.lsObj) {
							try {
								metadata = JSON.parse(response.lsObj["sugar_datastore_" + response.objectId]);
							} catch (e) {
								metadata = response.lsObj["sugar_datastore_" + response.objectId];
							}
							writeFile(metadata.metadata, response.lsObj["sugar_datastoretext_" + response.objectId], function (blob, filename) {
								saveAs(blob, filename);
								totalDownloaded++;
								if (totalDownloaded + totalFailed == totalSelected) displayNotification(totalDownloaded, totalFailed);
							});
						}
					});
				}
			}
		}
	}
}

function deleteMultipleUsers() {
	function displayNotification(success, failed) {
		var timer = 2000;
		if (success > 0 && failed > 0) {
			notify(document.webL10n.get('deleteSuccessFailUser', { success: success, failed: failed }), 'success');
		} else if (failed == 0) {
			notify(document.webL10n.get('DeleteSuccess', { count: success }), 'success');
		} else {
			notify(document.webL10n.get('deleteUserFailed'), 'danger');
		}
		setTimeout(function () {
			location.reload();
		}, timer);
	}
	if (document.getElementsByClassName("users-checkbox").length > 0) {
		var check = document.getElementsByClassName("users-checkbox");
		var toBeDeleted = [];
		var totalSelected = 0;
		var totalDeleted = 0;
		var totalFailed = 0;
		for (var i = 0; i < check.length; i++) {
			if (check[i].checked) {
				totalSelected++;
				if (check[i].getAttribute("uid")) toBeDeleted.push(check[i].getAttribute("uid"));
				else {
					totalFailed++;
					continue;
				}
			}
		}

		if (totalSelected == 0) {
			notify(document.webL10n.get('noUsersSelectedDelete'), 'danger');
		} else {
			var confirmation = confirm(document.webL10n.get('deleteUserConfirmation', { selected: totalSelected }));
			if (confirmation) {
				if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
				for (var i = 0; i < toBeDeleted.length; i++) {
					$.ajax({
						url: ('/api/v1/users/' + toBeDeleted[i] + '?' + decodeURIComponent($.param({
							x_key: headers['x-key'],
							access_token: headers['x-access-token']
						}))),
						type: 'DELETE',
						success: function (response) {
							if (response && response.user_id) {
								totalDeleted++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							} else {
								totalFailed++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							}
						},
						fail: function () {
							totalFailed++;
							if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
						}
					});
				}
			}
		}
	}
}

function deleteMultipleClassrooms() {
	function displayNotification(success, failed) {
		var timer = 2000;
		if (success > 0 && failed > 0) {
			notify(document.webL10n.get('deleteSuccessFailClassroom', { success: success, failed: failed }), 'success');
		} else if (failed == 0) {
			notify(document.webL10n.get('deleteClassroomSuccess', { success: success }), 'success');
		} else {
			notify(document.webL10n.get('deleteClassroomFailed'), 'danger');
		}
		setTimeout(function () {
			location.reload();
		}, timer);
	}
	if (document.getElementsByClassName("classrooms-checkbox").length > 0) {
		var check = document.getElementsByClassName("classrooms-checkbox");
		var toBeDeleted = [];
		var totalSelected = 0;
		var totalDeleted = 0;
		var totalFailed = 0;
		for (var i = 0; i < check.length; i++) {
			if (check[i].checked) {
				totalSelected++;
				if (check[i].getAttribute("cid")) toBeDeleted.push(check[i].getAttribute("cid"));
				else {
					totalFailed++;
					continue;
				}
			}
		}

		if (totalSelected == 0) {
			notify(document.webL10n.get('noClassroomSelectedDelete'), 'danger');
		} else {
			var confirmation = confirm(document.webL10n.get('deleteClassroomConfirmation', { selected: totalSelected }));
			if (confirmation) {
				if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
				for (var i = 0; i < toBeDeleted.length; i++) {
					$.ajax({
						url: ('/api/v1/classrooms/' + toBeDeleted[i] + '?' + decodeURIComponent($.param({
							x_key: headers['x-key'],
							access_token: headers['x-access-token']
						}))),
						type: 'DELETE',
						success: function (response) {
							if (response && response.id) {
								totalDeleted++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							} else {
								totalFailed++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							}
						},
						fail: function () {
							totalFailed++;
							if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
						}
					});
				}
			}
		}
	}
}

function deleteMultipleAssignments() {
	function displayNotification(success, failed) {
		var timer = 2000;
		if (success > 0 && failed > 0) {
			notify(document.webL10n.get('deleteSuccessFailAssignment', { success: success, failed: failed }), 'success');
		} else if (failed == 0) {
			notify(document.webL10n.get('deleteAssignmentSuccess', { success: success }), 'success');
		} else {
			notify(document.webL10n.get('deleteAssignmentFailed'), 'danger');
		}
		setTimeout(function () {
			location.reload();
		}, timer);
	}
	if (document.getElementsByClassName("assignments-checkbox").length > 0) {
		var check = document.getElementsByClassName("assignments-checkbox");
		var toBeDeleted = [];
		var totalSelected = 0;
		var totalDeleted = 0;
		var totalFailed = 0;
		for (var i = 0; i < check.length; i++) {
			if (check[i].checked) {
				totalSelected++;
				if (check[i].getAttribute("aid")) toBeDeleted.push(check[i].getAttribute("aid"));
				else {
					totalFailed++;
					continue;
				}
			}
		}

		if (totalSelected == 0) {
			notify(document.webL10n.get('noAssignmentSelectedDelete'), 'danger');
		}
		else {
			var confirmation = confirm(document.webL10n.get('deleteAssignmentConfirmation', { selected: totalSelected }));
			if (confirmation) {
				if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
				for (var i = 0; i < toBeDeleted.length; i++) {
					$.ajax({
						url: ('/api/v1/assignments/' + toBeDeleted[i] + '?' + decodeURIComponent($.param({
							x_key: headers['x-key'],
							access_token: headers['x-access-token']
						}))),
						type: 'DELETE',
						success: function (response) {
							if (response && response.id) {
								totalDeleted++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							} else {
								totalFailed++;
								if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
							}
						},
						fail: function () {
							totalFailed++;
							if (totalDeleted + totalFailed == totalSelected) displayNotification(totalDeleted, totalFailed);
						}
					});
				}
			}
		}
	}
}
