// jQuery Sink by Shale Craig (shalecraig.com)
//
// Copyright (c) 2011 Shale Craig
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


/*
	TODO:
		(v0 - alpha) OUTSTANDING BUGS:
			
			Fix tabs identifying being closed & opened.
				Call window_close 100% percent of the time when this window is refreshed.
					Reported chrome issue #94705  (http://bit.ly/obA3xf)
					Refreshes sometimes add other tabs without removing them before the unload.
					Also doesn't get called all of the time when closing tabs.
					Added a different type of onunload (v.s. onbeforeunload) handler, hopefully this will reduce the amount of instances of failure.
					Will not ever be sure that this bug is fixed unless chrome issue is addressed. (cannot reproduce, was happening randomly).
				
			Check that all other localStorage events in spec are handled properly.
				Re-establish identity of the tab that called localStorage.clear(); - This will be tough to do efficiently. See commented out code re: TypeError.
			
			Cross-browser testing.
				Works with:
					Chrome 15.0.865.0
					Firefox 5.0.1
					Firefox 6.0
					Safari 5.1
					
					

		(possible roadmap:)
			Change paradigm from one send/recieve per page to being able to send to 'addresses' from 'mailboxes'.
				This will allow one page to have multiple interaction spots.
				This will probably be accomplished by a change to an object, not on a functional level.
			Move away from being a jQuery plugin. Why not let everyone into the fun?
*/
if (window.jQuery === 'undefined') {
	alert('you need to define this after jquery is loaded');
} else {
	(function ($) {
		'use strict';
		
		$.sync = {
			numTabs : 0,
			local_tab_list : [],
			initialized : false,
			closed_event : false,
			id :  {
				name : Date.now(), //This needs to be unique. Hence defaulting to "when the tab was opened". Hopefully, this will be unique.
				value : {}
			},
			message : function (message, targets) {
				if (!$.sync.initialized) {
					return false;
				}
				
				//this sets targets to be all recipients, if it is either null or empty.
				if (typeof (targets) === 'undefined' || targets === null) {
					targets = [];
				} else if (typeof (targets) === 'string') {
					if (targets === $.sync.id.name) {
						//Sending a message to itself. Prevent 'trafficking' in the localStorage object.
						return $.sync.inboundHandler(message);
					} else {
						targets = [targets];
					}
				} else if (targets.constructor === Array) {
					var i = 0, found = false;
					for (; i < targets.length && !found; i += 1) {
						if (targets[i] === $.sync.id.name) {
							found = true;
							$.sync.inboundHandler(message);
						}
					}
				}
				
				var passed = {
					'passed' : (message),
					'date_passed' : Date.now(),
					'sync_event_object' : targets
				};
				$.sync.l.s('sync_event_object', JSON.stringify(passed));
			},
			
			
			inboundHandler : function (data) {
				// This is the "default inbound event handler."
				// Set this to what you need.
				console.log(data);
			},
			
			newTabHandler : function (opened_tab_id) {
				//This is the "default new tab handler"
				//This should be triggered whenever a new tab is opened, adding to list delivered in the get_tabs function.
				console.log('tab was opened: ', opened_tab_id);
			},
			
			closedTabHandler : function (closed_tab_id) {
				//This is the "default new tab handler"
				//This should be triggered whenever a tab is closed.
				console.log('tab was closed', closed_tab_id);
			},
			
			//This is the last step whenever a message is sent to this tab.
			callback : function (e) {
				try {
					$.sync.inboundHandler(e.passed);
				} catch (error) {} //This fails silently when parsing bad events.
			},
			
			syncEvent : function (event) {
				if (!$.sync.initialized) {
					return false;
				}
				try {
					if (!event) {
						event = window.event;
					}
					var message = JSON.parse(event.newValue),
						found = false,
						i = 0,
						tabs;
					if (message === null) {
						//Localstorage.clear() has been called. Reestablishing identity.
						$.sync.set_identity();
					} else if (event.key === "_tab_list") {
						//either added, removed or modified the tab list...
						if (message.length > $.sync.numTabs) { //added a tab.
							$.sync.numTabs = message.length;
							$.sync.newTabHandler($.sync.local_tab_list.push(message.pop()));
						} else if (message.length < $.sync.numTabs) { //closed a tab.
							
							$.sync.numTabs = message.length;
							
							//this loop looks for the one about to be deleted, and pushes it to the event loop.
							for (; i < $.sync.local_tab_list.length && !found; i += 1) {
								if (-1 === $.inArray($.sync.local_tab_list[i], message)) {
									$.sync.closedTabHandler($.sync.local_tab_list.splice(i, 1));
									found = true;
								}
							}
						}
					} else if (event.key === "sync_event_object") {
						if (typeof (message.sync_event_object) !== 'undefined') {
							tabs = message['_sync_event_object'];
							if (tabs === undefined || tabs === null || tabs.constructor === Array) {
								try {
									$.sync.callback(message);
								} catch (e) {}  //This function fails silently.
							} else if (typeof (tabs) === 'string' && tabs === $.sync.id.name) {
								try {
									$.sync.callback(message);
								} catch (error) {}
							} else {
								for (; i < tabs.length && !found; i += 1) {
									if (tabs[i] === $.sync.id.name) {
										$.sync.callback(message);
									}
								}
							}
						}
					}
				} catch (uncaught_error) {
					console.log('Failed at receiving the event.', uncaught_error);
					return false;
				}
				//This fails silently. This is done as to not interfere with other windows using the local storage.
			},
			
			get_tabs : function () {
				try {
					var raw_tabs = $.sync.l.g('_tab_list');
					return JSON.parse(raw_tabs);
				} catch (e) {}
			},
			
			set_identity : function (passed) {
				var tab_id = $.sync.id, orig_tabs = $.sync.l.g('_tab_list');
				if (typeof (passed) === 'object' && passed !== null) {
					if (typeof (passed.name) === 'string') {
						tab_id.name = passed.name; //This needs to be unique.
					} else {
						//decreases the probability of tab name collision, if left unchecked. TODO: fix...
						tab_id.name += Date.now();
						tab_id.name = tab_id.name.toString();
					}
					if (typeof (passed.tab_value) === 'object') {
						tab_id.value = passed.tab_value;
					}
				}
				
				if (orig_tabs !== 'undefined' && orig_tabs !== null && orig_tabs !== 'null') {
					var tab_list = JSON.parse(orig_tabs);
					tab_list.push(tab_id);
					$.sync.l.s('_tab_list', JSON.stringify(tab_list));
					$.sync.id = tab_id;
					return tab_list;
				} else {
					$.sync.l.s('_tab_list', JSON.stringify([tab_id]));
					$.sync.id = tab_id;
					return [tab_id];
				}
			},
			init : function (arg, tab_identity) {
				$.sync.local_tab_list = $.sync.set_identity(tab_identity);
				
				$.sync.numTabs = $.sync.local_tab_list.length;
				
				
				if (window.addEventListener) { //Apparently this helps IE8. Caution: this hasn't been tested on any version of IE.
					window.addEventListener('storage',
						function (event) { 
							$.sync.syncEvent(event);
						},
						false);
					//Interestingly, JS in Firefox complains when the third param isn't called. Chrome just assumes that it's false.
				} else {
					window.attachEvent('onstorage', function (event) {
						$.sync.syncEvent(event);
					});
				}
				
				if (typeof (arg) !== undefined && arg !== undefined) {
					if (arg.callback !== undefined && typeof (arg.callback) === 'function') {
						$.sync.inboundHandler = arg.callback;
					}
					if (arg.closeTab !== undefined && typeof (arg.closeTab) === 'function') {
						$.sync.closedTabHandler = arg.closeTab;
					}
					if (arg.newTab !== undefined && typeof (arg.newTab) === 'function') {
						$.sync.newTabHandler = arg.newTab;
					}
				}
				
				//This handles cleaning up.
				
				var closing = function () {
					if ($.sync.closed_event !== true) {
						$.sync.closed_event = true;
						var extTabList = $.sync.l.g('_tab_list'), found = false, i = 0;
		
						if (typeof (extTabList) !== 'undefined' && extTabList !== null) {
							extTabList = JSON.parse(extTabList);
							
							for (; i < extTabList.length && !found; i += 1) {
								if (extTabList[i].name === $.sync.id.name) {
									extTabList.splice(location, 1);
									$.sync.l.s('_tab_list', JSON.stringify(extTabList));
									found = true;
								}
							}
						}
					}
				};
				
				//closer to being bulletproof, still not perfect.
				window.onbeforeunload = closing;
				window.onunload = closing;
				
				// Attempts to intercepts and call the localStorage.clear() event to reestablish tabular identity.
				// Modded from (http://bit.ly/ohVpkh)
	/*
				//I'm getting a TypeError while running this code, this is a known issue.
				localStorage.clear = function (native) {
					return function () {
						native();
						$.sync.set_identity();
					}
				}(localStorage.clear);
	*/
	
				$.sync.initialized = true;
			},
			l : {
				s : function (key, val) {
					return localStorage.setItem(key, val);
				},
				g : function (key) {
					return localStorage.getItem(key);
				}
			}
		};
	}(window.jQuery));
}