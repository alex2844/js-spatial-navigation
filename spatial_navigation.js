(function() {
	var GlobalConfig = {
		selector: '', // can be a valid <extSelector> except "@" syntax.
		disabled: false,
		defaultElement: '', // <extSelector> except "@" syntax.
		leaveFor: null, // {left: <extSelector>, right: <extSelector>, up: <extSelector>, down: <extSelector>}
		restrict: 'self-first', // 'self-first', 'self-only', 'none'
		tabIndexIgnoreList: 'input, select, textarea, iframe, [contentEditable=true]',
		navigableFilter: null
	};
	var _idPool = 0,
		_ready = false,
		_pause = false,
		_sections = {},
		_sectionCount = 0,
		_defaultSectionId = '',
		_lastSectionId = '',
		_duringFocusChange = false;
	var elementMatchesSelector = (Element.prototype.matches || Element.prototype.matchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.webkitMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.oMatchesSelector || function (selector) {
		return ([].slice.call((this.parentNode || this.document).querySelectorAll(selector)).indexOf(this) >= 0);
    });
	function extend(out) {
		out = out || {};
		for (var i = 1; i < arguments.length; i++) {
			if (!arguments[i])
				continue;
			for (var key in arguments[i]) {
				if (arguments[i].hasOwnProperty(key) && (arguments[i][key] !== undefined))
					out[key] = arguments[i][key];
			}
		}
		return out;
	}
	function parseSelector(selector) {
		return ((typeof selector === 'string') ? [].slice.call(document.querySelectorAll(selector)) : (
			((typeof selector === 'object') && selector.length)
			? [].slice.call(selector)
			: (((typeof selector === 'object') && (selector.nodeType === 1)) ? [selector] : [])
		));
	}
	function matchSelector(elem, selector) {
		return ((typeof selector === 'string') ? elementMatchesSelector.call(elem, selector) : (
			((typeof selector === 'object') && selector.length)
			? (selector.indexOf(elem) >= 0)
			: (((typeof selector === 'object') && (selector.nodeType === 1)) ? (elem === selector) : false)
		));
	}
	function focusSection(sectionId) {
		var range = [];
		var addRange = function(id) {
			if (id && (range.indexOf(id) < 0) && _sections[id] && !_sections[id].disabled)
				range.push(id);
		};
		if (sectionId)
			addRange(sectionId);
		else{
			addRange(_defaultSectionId);
			addRange(_lastSectionId);
			Object.keys(_sections).map(addRange);
		}
		for (var i = 0; i < range.length; i++) {
			var id = range[i];
			var next = (getSectionDefaultElement(id) || getSectionLastFocusedElement(id) || getSectionNavigableElements(id).filter(function(elem) {
				return (elem.getAttribute('tabindex') != '-2');
			})[0]);
			if (next)
				return focusElement(next, id);
		}
		return false;
	}
	function getSectionDefaultElement(sectionId) {
		var defaultElement = _sections[sectionId].defaultElement;
		if (!defaultElement)
			return null;
		if (typeof defaultElement === 'string')
			defaultElement = parseSelector(defaultElement)[0];
		if (isNavigable(defaultElement, sectionId, true))
			return defaultElement;
		return null;
	}
	function getSectionLastFocusedElement(sectionId) {
		var lastFocusedElement = _sections[sectionId].lastFocusedElement;
		if (!isNavigable(lastFocusedElement, sectionId, true))
			return null;
		return lastFocusedElement;
	}
	function isNavigable(elem, sectionId, verifySectionSelector) {
		if (!elem || !sectionId || !_sections[sectionId] || _sections[sectionId].disabled)
			return false;
		if (((elem.offsetWidth <= 0) && (elem.offsetHeight <= 0)) || elem.hasAttribute('disabled'))
			return false;
		if (verifySectionSelector && !matchSelector(elem, _sections[sectionId].selector))
			return false;
		if (typeof _sections[sectionId].navigableFilter === 'function') {
			if (_sections[sectionId].navigableFilter(elem, sectionId) === false)
				return false;
		}else if (typeof GlobalConfig.navigableFilter === 'function') {
			if (GlobalConfig.navigableFilter(elem, sectionId) === false)
				return false;
		}
		return true;
	}
	function getSectionNavigableElements(sectionId) {
		return parseSelector(_sections[sectionId].selector).filter(function(elem) {
			return isNavigable(elem, sectionId);
		});
	}
	function focusElement(elem, sectionId, direction) {
		if (!elem)
			return false;
		var currentFocusedElement = getCurrentFocusedElement();
		var silentFocus = function() {
			if (currentFocusedElement)
				currentFocusedElement.blur();
			elem.focus();
			focusChanged(elem, sectionId);
		};
		if (_duringFocusChange)
			return !silentFocus();
		_duringFocusChange = true;
		if (_pause) {
			silentFocus();
			return !(_duringFocusChange = false);
		}
		if (currentFocusedElement) {
			var unfocusProperties = {
				nextElement: elem,
				nextSectionId: sectionId,
				direction: direction,
				native: false
			};
			if (!fireEvent(currentFocusedElement, 'willunfocus', unfocusProperties))
				return (_duringFocusChange = false);
			currentFocusedElement.blur();
			fireEvent(currentFocusedElement, 'unfocused', unfocusProperties, false);
		}
		var focusProperties = {
			previousElement: currentFocusedElement,
			sectionId: sectionId,
			direction: direction,
			native: false
		};
		if (!fireEvent(elem, 'willfocus', focusProperties))
			return (_duringFocusChange = false);
		elem.focus();
		fireEvent(elem, 'focused', focusProperties, false);
		_duringFocusChange = false;
		return !focusChanged(elem, sectionId);
	}
	function getCurrentFocusedElement() {
		if (document.activeElement && (document.activeElement !== document.body))
			return document.activeElement;
	}
	function fireEvent(elem, type, details, cancelable) {
		var evt = document.createEvent('CustomEvent');
		evt.initCustomEvent('sn:'+type, true, ((arguments.length < 4) ? true : cancelable), details);
		return elem.dispatchEvent(evt);
	}
	function focusChanged(elem, sectionId) {
		if (!sectionId)
			sectionId = getSectionId(elem);
		if (sectionId) {
			_sections[sectionId].lastFocusedElement = elem;
			_lastSectionId = sectionId;
		}
	}
	function getSectionId(elem) {
		for (var id in _sections) {
			if (!_sections[id].disabled && matchSelector(elem, _sections[id].selector))
				return id;
		}
	}
	function focusExtendedSelector(selector, direction) {
		if (selector.charAt(0) == '@')
			return focusSection((selector.length == 1) ? null : selector.substr(1));
		else{
			var next = parseSelector(selector)[0];
			if (next) {
				var nextSectionId = getSectionId(next);
				if (isNavigable(next, nextSectionId))
					return focusElement(next, nextSectionId, direction);
			}
		}
		return false;
	}
	function focusNext(direction, currentFocusedElement, currentSectionId) {
		var extSelector = currentFocusedElement.getAttribute('data-sn-'+direction);
		if (typeof extSelector === 'string') {
			if ((extSelector === '') || !focusExtendedSelector(extSelector, direction))
				return !!fireNavigatefailed(currentFocusedElement, direction);
			return true;
		}
		var sectionNavigableElements = {},
			allNavigableElements = [];
		for (var id in _sections) {
			allNavigableElements = allNavigableElements.concat((sectionNavigableElements[id] = getSectionNavigableElements(id)));
		}
		var next,
			config = extend({}, GlobalConfig, _sections[currentSectionId]);
		if (config.restrict == 'self-only' || config.restrict == 'self-first') {
			var currentSectionNavigableElements = sectionNavigableElements[currentSectionId];
			next = navigate(currentFocusedElement, direction, exclude(currentSectionNavigableElements, currentFocusedElement), config);
			if (!next && (config.restrict == 'self-first'))
				next = navigate(currentFocusedElement, direction, exclude(allNavigableElements, currentSectionNavigableElements), config);
		}else
			next = navigate(currentFocusedElement, direction, exclude(allNavigableElements, currentFocusedElement), config);
		if (next) {
			var nextSectionId = getSectionId(next);
			if (currentSectionId != nextSectionId) {
				var result = gotoLeaveFor(currentSectionId, direction);
				if (result)
					return true;
				else if (result === null)
					return !!fireNavigatefailed(currentFocusedElement, direction);
			}
			if (!next.closest('aside')) {
				var p = getRect(next);
				if (!(
					((window.pageYOffset + p.bottom) > window.pageYOffset) &&
					((window.pageYOffset + p.top) < (window.pageYOffset + document.documentElement.clientHeight + 100)) &&
					((window.pageXOffset + p.right) > window.pageXOffset) &&
					(/* (p.left > -1) && */ ((window.pageXOffset + p.left) < (window.pageXOffset + document.documentElement.clientWidth)))
				))
					return false;
			}
			return focusElement(next, nextSectionId, direction);
		}else if (gotoLeaveFor(currentSectionId, direction))
			return true;
		return !!fireNavigatefailed(currentFocusedElement, direction);
	}
	function navigate(target, direction, candidates, config) {
		if (!target || !direction || !candidates || !candidates.length)
			return null;
		var rects = [];
		for (var i = 0; i < candidates.length; i++) {
			var rect = getRect(candidates[i]);
			if (rect)
				rects.push(rect);
		}
		if (!rects.length)
			return null;
		var targetRect = getRect(target);
		if (!targetRect)
			return null;
		var distanceFunction = {
			nearPlumbLineIsBetter: function(rect) {
				var d = ((rect.center.x < targetRect.center.x) ? (targetRect.center.x - rect.right) : (rect.left - targetRect.center.x));
				return ((d < 0) ? 0 : d);
			},
			nearHorizonIsBetter: function(rect) {
				var d = ((rect.center.y < targetRect.center.y) ? (targetRect.center.y - rect.bottom) : (rect.top - targetRect.center.y));
				return ((d < 0) ? 0 : d);
			},
			nearTargetLeftIsBetter: function(rect) {
				var d = ((rect.center.x < targetRect.center.x) ? (targetRect.left - rect.right) : (rect.left - targetRect.left));
				return ((d < 0) ? 0 : d);
			},
			nearTargetTopIsBetter: function(rect) {
				var d = ((rect.center.y < targetRect.center.y) ? (targetRect.top - rect.bottom) : (rect.top - targetRect.top));
				return ((d < 0) ? 0 : d);
			},
			topIsBetter: function(rect) {
				return rect.top;
			},
			bottomIsBetter: function(rect) {
				return -1 * rect.bottom;
			},
			leftIsBetter: function(rect) {
				return rect.left;
			},
			rightIsBetter: function(rect) {
				return -1 * rect.right;
			}
		}
		var priorities,
			groups = partition(rects, targetRect),
			internalGroups = partition(groups[4], targetRect.center);
		switch (direction) {
			case 'left':
				priorities = [{
					group: internalGroups[0].concat(internalGroups[3]).concat(internalGroups[6]),
					distance: [
						distanceFunction.nearPlumbLineIsBetter,
						distanceFunction.topIsBetter
					]
				}, {
					group: groups[3],
					distance: [
						distanceFunction.nearPlumbLineIsBetter,
						distanceFunction.topIsBetter
					]
				}, {
					group: groups[0].concat(groups[6]),
					distance: [
						distanceFunction.nearHorizonIsBetter,
						distanceFunction.rightIsBetter,
						distanceFunction.nearTargetTopIsBetter
					]
				}];
			break;
			case 'right':
				priorities = [{
					group: internalGroups[2].concat(internalGroups[5]).concat(internalGroups[8]),
					distance: [
						distanceFunction.nearPlumbLineIsBetter,
						distanceFunction.topIsBetter
					]
				}, {
					group: groups[5],
					distance: [
						distanceFunction.nearPlumbLineIsBetter,
						distanceFunction.topIsBetter
					]
				}, {
					group: groups[2].concat(groups[8]),
					distance: [
						distanceFunction.nearHorizonIsBetter,
						distanceFunction.leftIsBetter,
						distanceFunction.nearTargetTopIsBetter
					]
				}];
			break;
			case 'up':
				priorities = [{
					group: internalGroups[0].concat(internalGroups[1]).concat(internalGroups[2]),
					distance: [
						distanceFunction.nearHorizonIsBetter,
						distanceFunction.leftIsBetter
					]
				}, {
					group: groups[1],
					distance: [
						distanceFunction.nearHorizonIsBetter,
						distanceFunction.leftIsBetter
					]
				}, {
					group: groups[0].concat(groups[2]),
					distance: [
						distanceFunction.nearPlumbLineIsBetter,
						distanceFunction.bottomIsBetter,
						distanceFunction.nearTargetLeftIsBetter
					]
				}];
			break;
			case 'down':
				priorities = [{
					group: internalGroups[6].concat(internalGroups[7]).concat(internalGroups[8]),
					distance: [
						distanceFunction.nearHorizonIsBetter,
						distanceFunction.leftIsBetter
					]
				}, {
					group: groups[7].concat((groups[7].length && groups[8].length && (groups[7][0].top > groups[8][0].top)) ? groups[8] : []),
					distance: [
						distanceFunction.nearHorizonIsBetter,
						distanceFunction.leftIsBetter
					]
				}, {
					group: groups[6].concat(groups[8]),
					distance: [
						distanceFunction.nearPlumbLineIsBetter,
						distanceFunction.topIsBetter,
						distanceFunction.nearTargetLeftIsBetter
					]
				}];
			break;
			default:
			return null;
		}
		var destGroup = prioritize(priorities.slice(0, -1));
		if (!destGroup && (
			!(destGroup = prioritize(priorities.slice(-1))) ||
			((direction == 'up') && ((targetRect.top < destGroup[0].top) || (targetRect.left < destGroup[0].left))) ||
			((direction == 'right') && ((targetRect.left > destGroup[0].left) || (targetRect.bottom > destGroup[0].bottom) || (destGroup[0].right > document.documentElement.clientWidth))) ||
			((direction == 'down') && ((targetRect.bottom > destGroup[0].bottom) || (targetRect.right < destGroup[0].right) || (destGroup[0].left < 0))) ||
			((direction == 'left') && ((targetRect.left < destGroup[0].left) || (targetRect.top < destGroup[0].top) || (destGroup[0].left < 0)))
		))
			return null;
		return destGroup[0].element;
	}
	function exclude(elemList, excludedElem) {
		if (!Array.isArray(excludedElem))
			excludedElem = [excludedElem];
		for (var i = 0, index; i < excludedElem.length; i++) {
			if ((index = elemList.indexOf(excludedElem[i])) >= 0)
				elemList.splice(index, 1);
		}
		return elemList;
	}
	function getRect(elem) {
		var cr = elem.getBoundingClientRect();
		var rect = {
			left: cr.left,
			top: cr.top,
			right: cr.right,
			bottom: cr.bottom,
			width: cr.width,
			height: cr.height
		};
		rect.element = elem;
		rect.center = {
			x: rect.left + Math.floor(rect.width / 2),
			y: rect.top + Math.floor(rect.height / 2)
		};
		rect.center.left = rect.center.right = rect.center.x;
		rect.center.top = rect.center.bottom = rect.center.y;
		return rect;
	}
	function partition(rects, targetRect) {
		var groups = [[], [], [], [], [], [], [], [], []];
		for (var i = 0; i < rects.length; i++) {
			var rect = rects[i],
				center = rect.center,
				groupId = (((center.y < targetRect.top) ? 0 : ((center.y <= targetRect.bottom) ? 1 : 2)) * 3 + ((center.x < targetRect.left) ? 0 : ((center.x <= targetRect.right) ? 1 : 2)));
			groups[groupId].push(rect);
			if ([0, 2, 6, 8].indexOf(groupId) !== -1) {
				if (rect.left <= targetRect.right - targetRect.width * 0.5) {
					if (groupId === 2)
						groups[1].push(rect);
					else if (groupId === 8)
						groups[7].push(rect);
				}
				if (rect.right >= targetRect.left + targetRect.width * 0.5) {
					if (groupId === 0)
						groups[1].push(rect);
					else if (groupId === 6)
						groups[7].push(rect);
				}
				if (rect.top <= targetRect.bottom - targetRect.height * 0.5) {
					if (groupId === 6)
						groups[3].push(rect);
					else if (groupId === 8)
						groups[5].push(rect);
				}
				if (rect.bottom >= targetRect.top + targetRect.height * 0.5) {
					if (groupId === 0)
						groups[3].push(rect);
					else if (groupId === 2)
						groups[5].push(rect);
				}
			}
		}
		return groups;
	}
	function prioritize(priorities) {
		var destPriority = null;
		for (var i = 0; i < priorities.length; i++) {
			if (!priorities[i].group.length)
				continue;
			destPriority = priorities[i];
		}
		if (!destPriority)
			return null;
		destPriority.group.sort(function(a, b) {
			for (var i = 0; i < destPriority.distance.length; i++) {
				var distance = destPriority.distance[i],
					delta = distance(a) - distance(b);
				if (delta)
					return delta;
			}
			return 0;
		});
		return destPriority.group;
	}
	function gotoLeaveFor(sectionId, direction) {
		if (_sections[sectionId].leaveFor && (_sections[sectionId].leaveFor[direction] !== undefined)) {
			var next = _sections[sectionId].leaveFor[direction];
			if (typeof next === 'string') {
				if (next === '')
					return null;
				return focusExtendedSelector(next, direction);
			}
			var nextSectionId = getSectionId(next);
			if (isNavigable(next, nextSectionId))
				return focusElement(next, nextSectionId, direction);
		}
		return false;
	}
	function fireNavigatefailed(elem, direction) {
		fireEvent(elem, 'navigatefailed', { direction: direction }, false);
	}
	function onKeyDown(evt) {
		if (!_sectionCount || _pause || evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey)
			return;
		var currentFocusedElement;
		var preventDefault = function() {
			evt.preventDefault();
			evt.stopPropagation();
			return false;
		};
		var direction = {
			'37': 'left',
			'38': 'up',
			'39': 'right',
			'40': 'down'
		}[evt.keyCode];
		if (!direction) {
			if ((evt.keyCode == 13) && (currentFocusedElement = getCurrentFocusedElement()) && getSectionId(currentFocusedElement) && !fireEvent(currentFocusedElement, 'enter-down'))
				return preventDefault();
			return;
		}
		if (!(currentFocusedElement = getCurrentFocusedElement())) {
			if (_lastSectionId)
				currentFocusedElement = getSectionLastFocusedElement(_lastSectionId);
			if (!currentFocusedElement) {
				focusSection();
				return preventDefault();
			}
		}
		var currentSectionId = getSectionId(currentFocusedElement);
		if (!currentSectionId)
			return;
		if ((currentFocusedElement.scrollHeight != currentFocusedElement.offsetHeight) && ([ 'hidden', 'visible' ].indexOf(getComputedStyle(currentFocusedElement).overflow) == -1) && (
			((direction == 'up') && !(currentFocusedElement.scrollTop <= 0)) ||
			((direction == 'down') && !(currentFocusedElement.scrollTop >= (currentFocusedElement.scrollHeight - currentFocusedElement.offsetHeight)))
		))
			return false;
		if (fireEvent(currentFocusedElement, 'willmove', {
			direction: direction,
			sectionId: currentSectionId,
			cause: 'keydown'
		}) && (focusNext(direction, currentFocusedElement, currentSectionId) || currentFocusedElement.closest('aside')))
			return preventDefault();
	}
	function onKeyUp(evt) {
		if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey)
			return;
		if (!_pause && _sectionCount && (evt.keyCode == 13)) {
			var currentFocusedElement = getCurrentFocusedElement();
			if (currentFocusedElement && getSectionId(currentFocusedElement) && !fireEvent(currentFocusedElement, 'enter-up')) {
				evt.preventDefault();
				evt.stopPropagation();
			}
		}
	}
	function onFocus(evt) {
		if ((evt.target !== window) && (evt.target !== document) && _sectionCount && !_duringFocusChange) {
			var sectionId = getSectionId(evt.target);
			if (sectionId) {
				if (_pause)
					return focusChanged(evt.target, sectionId);
				var focusProperties = {
					sectionId: sectionId,
					native: true
				};
				if (!fireEvent(evt.target, 'willfocus', focusProperties)) {
					_duringFocusChange = true;
					evt.target.blur();
					_duringFocusChange = false;
				}else{
					fireEvent(evt.target, 'focused', focusProperties, false);
					focusChanged(evt.target, sectionId);
				}
			}
		}
	}
	function onBlur(evt) {
		if ((evt.target !== window) && (evt.target !== document) && !_pause && _sectionCount && !_duringFocusChange && getSectionId(evt.target)) {
			var unfocusProperties = { native: true };
			if (!fireEvent(evt.target, 'willunfocus', unfocusProperties)) {
				_duringFocusChange = true;
				setTimeout(function() {
					evt.target.focus();
					_duringFocusChange = false;
				});
			}else
				fireEvent(evt.target, 'unfocused', unfocusProperties, false);
		}
	}
	var SpatialNavigation = {
		init: function(arr) {
			var res = [];
			if (!_ready) {
				window.addEventListener('keydown', onKeyDown);
				window.addEventListener('keyup', onKeyUp);
				window.addEventListener('focus', onFocus, true);
				window.addEventListener('blur', onBlur, true);
				_ready = true;
				if (arr) {
					res = arr.map(function(obj) {
						return SpatialNavigation.add(obj);
					});
					SpatialNavigation.makeFocusable();
					SpatialNavigation.focus();
				}
			}
			return res;
		},
		uninit: function() {
			window.removeEventListener('blur', onBlur, true);
			window.removeEventListener('focus', onFocus, true);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('keydown', onKeyDown);
			SpatialNavigation.clear();
			_idPool = 0;
			_ready = false;
		},
		clear: function() {
			_sections = {};
			_sectionCount = 0;
			_defaultSectionId = '';
			_lastSectionId = '';
			_duringFocusChange = false;
		},
		add: function() {
			var sectionId;
			var config = {};
			if (typeof arguments[0] === 'object')
				config = arguments[0];
			else if ((typeof arguments[0] === 'string') && (typeof arguments[1] === 'object')) {
				sectionId = arguments[0];
				config = arguments[1];
			}
			if (!sectionId)
				sectionId = ((typeof config.id === 'string') ? config.id : (function() {
					var id;
					while (true) {
						if (!_sections[(id = 'section-'+String(++_idPool))])
							break;
					}
					return id;
				})());
			if (_sections[sectionId])
				throw new Error('Section "'+sectionId+'" has already existed!');
			_sections[sectionId] = {};
			_sectionCount++;
			SpatialNavigation.set(sectionId, config);
			return sectionId;
		},
		set: function() {
			var sectionId, config;
			if (typeof arguments[0] === 'object')
				config = arguments[0];
			else if ((typeof arguments[0] === 'string') && (typeof arguments[1] === 'object')) {
				sectionId = arguments[0];
				config = arguments[1];
				if (!_sections[sectionId])
					throw new Error('Section "'+sectionId+'" doesn\'t exist!');
			}else
				return;
			for (var key in config) {
				if (GlobalConfig[key] !== undefined) {
					if (sectionId)
						_sections[sectionId][key] = config[key];
					else if (config[key] !== undefined)
						GlobalConfig[key] = config[key];
				}
			}
			if (sectionId)
				_sections[sectionId] = extend({}, _sections[sectionId]);
		},
		remove: function(sectionId) {
			if (!sectionId || typeof sectionId !== 'string')
				throw new Error('Please assign the "sectionId"!');
			if (_sections[sectionId]) {
				_sections[sectionId] = undefined;
				_sections = extend({}, _sections);
				_sectionCount--;
				if (_lastSectionId === sectionId)
					_lastSectionId = '';
				return true;
			}
			return false;
		},
		disable: function(sectionId) {
			if (_sections[sectionId])
				return (_sections[sectionId].disabled = true);
			return false;
		},
		enable: function(sectionId) {
			if (_sections[sectionId])
				return !(_sections[sectionId].disabled = false);
			return false;
		},
		pause: function() {
			_pause = true;
		},
		resume: function() {
			_pause = false;
		},
		move: function(direction, selector) {
			direction = direction.toLowerCase();
			var elem = (selector ? parseSelector(selector)[0] : getCurrentFocusedElement());
			if (!elem)
				return false;
			var sectionId = getSectionId(elem);
			if (!sectionId)
				return false;
			if (!fireEvent(elem, 'willmove', {
				direction: direction,
				sectionId: sectionId,
				cause: 'api'
			}))
				return false;
			return focusNext(direction, elem, sectionId);
		},
		makeFocusable: function(sectionId) {
			var doMakeFocusable = function(section) {
				var tabIndexIgnoreList = ((section.tabIndexIgnoreList !== undefined) ? section.tabIndexIgnoreList : GlobalConfig.tabIndexIgnoreList);
				parseSelector(section.selector).forEach(function(elem) {
					if (!matchSelector(elem, tabIndexIgnoreList)) {
						if (!elem.getAttribute('tabindex'))
							elem.setAttribute('tabindex', '-1');
					}
				});
			};
			if (sectionId) {
				if (_sections[sectionId])
					doMakeFocusable(_sections[sectionId]);
				else
					throw new Error('Section "'+sectionId+'" doesn\'t exist!');
			}else
				for (var id in _sections) {
					doMakeFocusable(_sections[id]);
				}
		},
		focus: function(elem, silent) {
			var result = false;
			if ((silent === undefined) && (typeof elem === 'boolean')) {
				silent = elem;
				elem = undefined;
			}
			var autoPause = (!_pause && silent);
			if (autoPause)
				SpatialNavigation.pause();
			if (!elem)
				result  = focusSection();
			else{
				if (typeof elem === 'string')
					result = (_sections[elem] ? focusSection(elem) : focusExtendedSelector(elem));
				else{
					var nextSectionId = getSectionId(elem);
					if (isNavigable(elem, nextSectionId))
						result = focusElement(elem, nextSectionId);
				}
			}
			if (autoPause)
				SpatialNavigation.resume();
			return result;
		},
		setDefaultSection: function(sectionId) {
			if (!sectionId)
				_defaultSectionId = '';
			else if (!_sections[sectionId])
				throw new Error('Section "' + sectionId + '" doesn\'t exist!');
			else
				_defaultSectionId = sectionId;
		},
		getElement: function() {
			return getCurrentFocusedElement();
		},
		getSection: function(elem) {
			return getSectionId((elem || getCurrentFocusedElement()));
		},
		getElements: function(sectionId) {
			return getSectionNavigableElements(sectionId || getSectionId(getCurrentFocusedElement()));
		}
	}
	window.SpatialNavigation = SpatialNavigation;
	if (typeof module === 'object')
		module.exports = SpatialNavigation;
})();
