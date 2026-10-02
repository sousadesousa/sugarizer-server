// Tutorial handling

function sugarizerTour(currentView, role, mode) {
	var tutorial = {};
	var tour;
	var launched = false;

	var tutorialName = currentView;
	if (mode) {
		tutorialName = currentView + "_" + mode;
	}

	// Init tutorial
	tutorial.init = function () {
		var prevString = document.webL10n.get("TutoPrev");
		var nextString = document.webL10n.get("TutoNext");
		var endString = document.webL10n.get("TutoEnd");
		tour = createTour({
			name: tutorialName,
			labels: { prev: prevString, next: nextString, end: endString },
			onNext: function (tour) {
				if (currentView == "home") {
					if (tour._current == "3" || tour._current == "4") {
						$('.main-panel').animate({
							scrollTop: (document.getElementsByClassName('main-panel')[0].scrollHeight)
						}, 500);
					}
					if (tour._current == "5") {
						$('.main-panel').animate({
							scrollTop: 0
						}, 500);
					}
				} else if (currentView == "editUser") {
					if (tour._current == "5") {
						$('.main-panel').animate({
							scrollTop: (document.getElementsByClassName('main-panel')[0].scrollHeight)
						}, 500);
					}
					if (tour._current == "8") {
						$('.main-panel').animate({
							scrollTop: 0
						}, 500);
					}
				}
			},
			onPrev: function (tour) {
				if (currentView == "home") {
					if (tour._current == "4") {
						$('.main-panel').animate({
							scrollTop: 0
						}, 500);
					}
					if (tour._current == "5" || tour._current == "6") {
						$('.main-panel').animate({
							scrollTop: (document.getElementsByClassName('main-panel')[0].scrollHeight)
						}, 500);
					}
				} else if (currentView == "editUser") {
					if (tour._current == "6") {
						$('.main-panel').animate({
							scrollTop: 0
						}, 500);
					}
				}
			},
			onEnd: function () {
				if (currentView == "home") {
					unlockScroll();
				} else if (currentView == "editUser") {
					$('.main-panel').animate({
						scrollTop: 0
					}, 500);
				}
			}
		});
		if (currentView == "home") {
			lockScroll();
			tour.addStep(getStep("home", "", "bottom", 1, true));
			tour.addStep(getStep("home", "#dashboard-home-cards", "bottom", 2));
			tour.addStep(getStep("home", "#top-contributor-chart-parent", "right", 3));
			tour.addStep(getStep("home", "#top-activities-chart-parent", "left", 4));
			tour.addStep(getStep("home", "#recent-users-table-parent", "top", 5));
			tour.addStep(getStep("home", "#recent-activities-table-parent", "top", 6));
			tour.addStep(getStep("home", "#sugarizer-sidebar", "right", 7));
			tour.addStep(getStep("home", "#languageSelection", "bottom", 8));
			tour.addStep(getStep("home", "#navbar-xo-icon", "left", 9));
			tour.addStep(getStep("home", "#navbar-help", "left", 10));
		} else if (currentView == "users") {
			tour.addStep(getStep("users", "", "bottom", 1, true));
			tour.addStep(getStep("users", "#user-serach-row", "bottom", 2));
			tour.addStep(getStep("users", "#username", "bottom", 3));
			tour.addStep(getStep("users", "#select2-user-type-select2-container", "bottom", 4));
			tour.addStep(getStep("users", "#select2-classroom_select-container", "bottom", 5));
			tour.addStep(getStep("users", "#show-result", "bottom", 6));
			tour.addStep(getStep("users", "#users-adduser", "left", 7));
			tour.addStep(getStep("users", "#users-addfromcsv", "bottom", 8));
			tour.addStep(getStep("users", "#users-exportusers", "bottom", 9));
			tour.addStep(getStep("users", "#seeJournalEntries", "left", 10));
			tour.addStep(getStep("users", "#editUser", "left", 11));
			tour.addStep(getStep("users", "#deleteUser", "left", 12));
			tour.addStep(getStep("users", "#checkAll", "right", 13));
			tour.addStep(getStep("users", "#users-deleteMultiple", "left", 14));
		} else if (currentView == "activities") {
			tour.addStep(getStep("activities", "", "bottom", 1, true));
			tour.addStep(getStep("activities", "#activities-list-parent", "left", 2));
			tour.addStep(getStep("activities", "#activities-searchbox", "left", 3));
			tour.addStep(getStep("activities", "#activities-card", "bottom", 4));
			tour.addStep(getStep("activities", "#activities-draggable", "right", 5));
			tour.addStep(getStep("activities", "#activities-favoriteBox", "left", 6));
			tour.addStep(getStep("activities", "#activity-launch", "left", 7));
		} else if (currentView == "journal1") {
			tour.addStep(getStep("journal", "", "bottom", 1, true));
			tour.addStep(getStep("journal", "#journal-search-card", "bottom", 2));
		} else if (currentView == "journal2") {
			if (!(window.localStorage.journal1_end == "yes" || window.localStorage.journal1_current_step == "1")) {
				localStorage.setItem('journal1_end', 'yes');
				localStorage.setItem('journal1_current_step', 1);
				tour.addStep(getStep("journal", "", "bottom", 1, true));
				tour.addStep(getStep("journal", "#journal-search-card", "bottom", 2));
			}
			tour.addStep(getStep("journal", "#journal-cards-parent", "top", 3));
			tour.addStep(getStep("journal", "#journal-entry-card", "bottom", 4));
			tour.addStep(getStep("journal", "#journal-activity-launch", "left", 5));
			tour.addStep(getStep("journal", "#journal-activity-download", "left", 6));
			tour.addStep(getStep("journal", "#journal-activity-delete", "left", 7));
			tour.addStep(getStep("journal", "#journal-uploadJournal", "left", 8));
			tour.addStep(getStep("journal", "#checkAll", "right", 9));
			tour.addStep(getStep("journal", "#journal-downloadMultiple", "left", 10));
			tour.addStep(getStep("journal", "#journal-deleteMultiple", "left", 11));
		} else if (currentView == "classroom") {
			tour.addStep(getStep("classroom", "", "bottom", 1, true));
			tour.addStep(getStep("classroom", "#classroom-serach-row", "bottom", 2));
			tour.addStep(getStep("classroom", "#classroom-addclassroom", "left", 3));
			tour.addStep(getStep("classroom", "#classroom-cards-parent", "top", 4));
			tour.addStep(getStep("classroom", "#classroom-card", "bottom", 5));
			tour.addStep(getStep("classroom", "#classroom-view-students", "left", 6));
			tour.addStep(getStep("classroom", "#classroom-edit-class", "left", 7));
			tour.addStep(getStep("classroom", "#classroom-delete-class", "left", 8));
			tour.addStep(getStep("classroom", "#checkAll", "right", 9));
			tour.addStep(getStep("classroom", "#classroom-deleteMultiple", "left", 10));
		} else if (currentView == "assignment") {
			tour.addStep(getStep("assignment", "#assignment-serach-row", "bottom", 2));
			tour.addStep(getStep("assignment", "#assignment-deleteMultiple", "left", 10));
			tour.addStep(getStep("assignment", "#assignment-addassignment", "left", 3));
			tour.addStep(getStep("assignment", "#assignment-cards-parent", "top", 4));
			tour.addStep(getStep("assignment", "#checkAll", "right", 9));
			tour.addStep(getStep("assignment", "#assignment-card", "bottom", 5));
			tour.addStep(getStep("assignment", "#assignment-delete-class", "left", 8));
			tour.addStep(getStep("assignment", "#assignment-view-students", "left", 6));
			tour.addStep(getStep("assignment", "#assignment-launch", "left", 5));
		} else if (currentView == "deliveries") {
			tour.addStep(getStep("deliveries", "#deliveries-serach-row", "bottom", 2));
			tour.addStep(getStep("deliveries", "#deliveries-deleteMultiple", "left", 10));
			tour.addStep(getStep("deliveries", "#deliveries-cards-parent", "top", 4));
			tour.addStep(getStep("deliveries", "#checkAll", "right", 9));
			tour.addStep(getStep("deliveries", "#deliveries-card", "bottom", 5));
			tour.addStep(getStep("deliveries", "#deliveries-delete-delivery", "left", 8));
			tour.addStep(getStep("deliveries", "#deliveries-comment", "left", 11));
			tour.addStep(getStep("deliveries", "#deliveries-launch", "left", 7));
			tour.addStep(getStep("deliveries", "#deliveries-journal-activity-download", "right", 3));

		}
		else if (currentView == "stats") {
			tour.addStep(getStep("stats", "", "bottom", 1, true));
			tour.addStep(getStep("stats", "#stats-addChart", "left", 2));
			tour.addStep(getStep("stats", "#stats-listCharts", "left", 3));
		} else if (currentView == "listCharts") {
			tour.addStep(getStep("listCharts", "", "bottom", 1, true));
			tour.addStep(getStep("listCharts", "#listCharts-chartList", "left", 2));
			tour.addStep(getStep("listCharts", "#listCharts-viewCharts", "left", 3));
			tour.addStep(getStep("listCharts", "#listCharts-addChart", "left", 4));
			tour.addStep(getStep("listCharts", "#listCharts-searchbox", "bottom", 5));
			tour.addStep(getStep("listCharts", "#listCharts-card", "bottom", 6));
			tour.addStep(getStep("listCharts", "#listCharts-draggable", "right", 7));
			tour.addStep(getStep("listCharts", "#listCharts-toggleBox", "left", 8));
			tour.addStep(getStep("listCharts", "#listCharts-editChart", "left", 9));
			tour.addStep(getStep("listCharts", "#listCharts-deleteChart", "left", 10));
		} else if (currentView == "editUser") {
			tour.addStep(getStep("editUser", "", "bottom", 1, true));
			tour.addStep(getStep("editUser", "#editUser-name", "right", 2));
			tour.addStep(getStep("editUser", "#editUser-language", "right", 3));
			tour.addStep(getStep("editUser", "#editUser-role", "right", 4));
			tour.addStep(getStep("editUser", "#editUser-colors", "right", 5));
			tour.addStep(getStep("editUser", "#editUser-password", "right", 6));
			tour.addStep(getStep("editUser", "#searchable-select-classrooms-row", "right", 7));
			tour.addStep(getStep("editUser", "#editUser-twoFactor", "right", 8));
			tour.addStep(getStep("editUser", "#editUser-created", "right", 9));
			tour.addStep(getStep("editUser", "#editUser-lastseen", "right", 10));
		} else if (currentView == "editClassroom") {
			tour.addStep(getStep("editClassroom", "", "bottom", 1, true));
			tour.addStep(getStep("editClassroom", "#editClassroom-name", "right", 2));
			tour.addStep(getStep("editClassroom", "#editClassroom-students", "right", 3));
			tour.addStep(getStep("editClassroom", "#editClassroom-colors", "right", 4));
			tour.addStep(getStep("editClassroom", "#editClassroom-created", "right", 5));
			tour.addStep(getStep("editClassroom", "#editClassroom-lastupdated", "right", 6));
		} else if (currentView == "editAssignment") {
			tour.addStep(getStep("editAssignment", "", "bottom", 1, true));
			tour.addStep(getStep("editAssignment", "#editAssignment-name", "right", 2));
			tour.addStep(getStep("editAssignment", "#editAssignment-activity", "right", 3));
			tour.addStep(getStep("editAssignment", "#editAssignment-instructions", "right", 4));
			tour.addStep(getStep("editAssignment", "#editAssignment-duedate", "right", 5));
			tour.addStep(getStep("editAssignment", "#searchable-select-classrooms-row", "right", 6));
		} else if (currentView == "editChart") {
			tour.addStep(getStep("editChart", "", "bottom", 1, true));
			tour.addStep(getStep("editChart", "#editChart-title", "right", 2));
			tour.addStep(getStep("editChart", "#editChart-type", "right", 3));
			tour.addStep(getStep("editChart", "#editChart-selectchart", "right", 4));
			tour.addStep(getStep("editChart", "#editChart-display", "right", 5));
		}
		tour.init();
	};

	// Start tutorial
	tutorial.start = function () {
		if ($(window).width() > 992) {
			document.webL10n.ready(function () {
				var refreshIntervalId = setInterval(function () {
					if (document.webL10n.getReadyState() == "complete") {
						clearInterval(refreshIntervalId);
						tutorial.init();
						tour.start(true);
						launched = true;
					}
				}, 100);
			});
		}
	};

	// Check if already finished
	tutorial.isFinished = function () {
		if (window.localStorage[tutorialName + "_end"] == "yes") return true;
		return false;
	};

	tutorial.restart = function () {
		localStorage.setItem(tutorialName + "_current_step", 0);
		localStorage.removeItem(tutorialName + "_end");
		tutorial.start();
	};

	// Test if launched
	tutorial.isLaunched = function () {
		return launched;
	};

	// The tour of a view, on Intro.js. It has the interface that the code above uses (addStep, init, start) and keeps the
	// state in localStorage like the previous library did: <name>_end = "yes" when finished, <name>_current_step.
	// options: name, labels {prev, next, end}, onNext(tour), onPrev(tour), onEnd(); tour._current is the index
	// (in the list of steps) of the step that is left when onNext and onPrev are called.
	function createTour(options) {
		var steps = [];
		var tour = { _current: 0 };

		tour.addStep = function (step) {
			steps.push(step);
		};

		tour.init = function () {};

		tour.start = function () {
			// steps whose element is not on the page, or not visible, are skipped, except the ones without element
			var shown = [];
			for (var i = 0; i < steps.length; i++) {
				if (steps[i].orphan || (steps[i].element && $(steps[i].element).filter(':visible').length)) {
					shown.push({ index: i, step: steps[i] });
				}
			}
			if (!shown.length) {
				return;
			}
			var last = shown[0].index;
			var finished = false;
			var intro = introJs();
			intro.setOptions({
				steps: shown.map(function (item) {
					var step = { title: item.step.title, intro: item.step.content, position: item.step.placement || 'bottom' };
					if (item.step.element) {
						step.element = item.step.element;
					}
					return step;
				}),
				nextLabel: options.labels.next,
				prevLabel: options.labels.prev,
				doneLabel: options.labels.end,
				skipLabel: options.labels.end,
				showBullets: false,
				showProgress: false,
				showStepNumbers: false,
				exitOnOverlayClick: false,
				disableInteraction: true,
				scrollToElement: true,
				scrollPadding: 30,
				tooltipClass: 'sugarizer-tour'
			});
			intro.onchange(function () {
				var current = shown[this.currentStep()].index;
				tour._current = last;
				if (current > last && options.onNext) {
					options.onNext(tour);
				} else if (current < last && options.onPrev) {
					options.onPrev(tour);
				}
				last = current;
				tour._current = current;
				localStorage.setItem(options.name + "_current_step", current);
			});
			var end = function () {
				if (finished) {
					return;
				}
				finished = true;
				localStorage.setItem(options.name + "_end", "yes");
				if (options.onEnd) {
					options.onEnd();
				}
			};
			intro.oncomplete(end);
			intro.onexit(end);
			intro.start();
		};

		return tour;
	}

	function getStep(view, element, placement, step, orphan) {
		var step = {
			title: document.webL10n.get(view + "Title" + step),
			content: document.webL10n.get(view + "Content" + step),
			element: element,
			placement: placement
		};
		if (orphan == true) {
			step['orphan'] = true;
		}
		return step;
	}

	function lockScroll() {
		var scrollPosition = [
			self.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
			self.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
		];
		var html = jQuery('html'); // it would make more sense to apply this to body, but IE7 won't have that
		html.data('scroll-position', scrollPosition);
		html.data('previous-overflow', html.css('overflow'));
		html.css('overflow', 'hidden');
		window.scrollTo(scrollPosition[0], scrollPosition[1]);
	}

	function unlockScroll() {
		var html = jQuery('html');
		var scrollPosition = html.data('scroll-position');
		html.css('overflow', html.data('previous-overflow'));
		window.scrollTo(scrollPosition[0], scrollPosition[1]);
	}

	return tutorial;
}
