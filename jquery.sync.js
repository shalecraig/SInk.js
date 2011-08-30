// jQuery Sync by Shale Craig (shalecraig.com)
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
				
			Check that all other localStorage events in spec are handled properly.
				Re-establish identity of the tab that called localStorage.clear(); - This will be tough. See comment in commented out code regarding TypeError
			
			Cross-browser testing. It currently works(ish) with chrome 15.

		(possible roadmap:)
			Change paradigm from one send/recieve per page to being able to send to 'addresses' from 'mailboxes'.
				This will allow one page to have multiple interaction spots.
				This will probably be accomplished by a change to an object, not on a functional level.
			Move away from being a jQuery plugin. Why not let everyone into the fun?
*/
		
(function ($) {
	'use strict';
	$.sync = {
		numTabs : 0,
		local_tab_list : [],
		initialized : false,
		id :  {
			name : Date.now(), //This needs to be unique. Hence defaulting to "when the tab was opened". Hopefully, this will be unique.
			value : {}
		},
		message : function(message, targets) {
			if (!$.sync.initialized) {
				return false;
			}
			
			//this sets targets to be all recipients, if it is either null or empty.
			if (typeof(targets) === 'undefined' || targets == null) {
				targets = [];
			} else if (targets.length == 1) {
				targets = [targets];
			}
			
			var passed = {
				'passed' : (message),
				'date_passed' : Date.now(),
				'_sync_event_object' : targets
			};
			console.log('sending message', passed);
			$.sync.l.s('_sync_event_object', JSON.stringify(passed));
		},
		
		
		inboundHandler : function(data) {
			// This is the "default inbound event handler."
			// Set this to what you need.
			console.log(data);
		},
		
		newTabHandler : function(opened_tab_id) {
			//This is the "default new tab handler"
			//This should be triggered whenever a new tab is opened, adding to list delivered in the get_tabs function.
			console.log('tab was opened: ', opened_tab_id);
		},
		
		closedTabHanlder : function(closed_tab_id) {
			//This is the "default new tab handler"
			//This should be triggered whenever a tab is closed.
			console.log('tab was closed', closed_tab_id);
		},
		
		//this is the 'meat' of the plugin: this is the last step whenever a message is sent to this tab.
		callback : function (e) {
			try {
				$.sync.inboundHandler(e.passed);
			} catch (e) {
				console.log("Error is:", e);
			} //Except for a debugging console.log, this fails silently when parsing bad events.
		},
		
		syncEvent : function(event) {
			console.log('syncEvent recieved: ', event);
			if (!$.sync.initialized) {
				return false;
			}
			try {
				var message = (!event)? JSON.parse(event.newValue) : JSON.parse(window.event.newValue);
				console.log('message: ', message, 'event: ', event);
				if (message == null) {
					console.log('localStorage.clear() was called. Repairing tab listing.');
					//Localstorage.clear() has been called. Reestablishing identity.
					$.sync.set_identity();
				} else if (event.key == "_tab_list") {
					//either added, removed or modified the tab list...
					console.log('The number of tabs was modified.', message.length, $.sync.numTabs);
					if (message.length > $.sync.numTabs) { //added a tab.
						console.log('tab was opened.');
						$.sync.numTabs = message.length;
						$.sync.newTabHandler($.sync.local_tab_list.push(message.pop()));
						console.log('The number of tabs was modified.', message.length, $.sync.numTabs);
					} else if (message.length < $.sync.numTabs) { //closed a tab.
						console.log('Tab was closed.');
						
						$.sync.numTabs = message.length;
						
						var found = false;
						//this loop looks for the one about to be deleted, and pushes it to the event loop.
						for (var i=0; i<$.sync.local_tab_list.length && !found; i++) {
							if (-1 == $.inArray($.sync.local_tab_list[i],message)) {
								$.sync.closedTabHandler($.sync.local_tab_list.splice(i,1));
								found = true;
							}
						}
					}
				} else if (event.key == "_sync_event_object") {
					console.log('message was recieved');
					if (typeof(message['_sync_event_object']) !== 'undefined') {
						var tabs = message['_sync_event_object'];
						console.log('here are some tabs: ', tabs);
						if (tabs == undefined || tabs == null || tabs.constructor == Array) {
							console.log('Broadcasting to all tabs.');
							try {
								$.sync.callback(message);
							} catch (e) {  //In effect, this function fails silently.
								console.log('Failed calling the callback');
							}
						} else if (typeof(tabs) === 'string' && tabs == $.sync.id.name) {
							try {
								console.log('calling the callback');
								$.sync.callback(message);
							} catch (e) {
								console.log('Failed calling the callback');
							}
						} else {
							console.log('Broadcasting to specific tabs.', tabs, $.sync.id.name, tabs == $.sync.id.name);
							var found = false;
							for (var i=0; i<tabs.length && !found; i++) {
								if (tabs[i] == $.sync.id.name) {
									$.sync.callback(message);
								}
							}
						}
					}
				}
			} catch (e) {console.log('Failed at fixing the event.', e);return false;}
			//This fails silently. This is done as to not interfere with other windows using the local storage.
		},
		
		get_tabs : function() {
			try {
				var raw_tabs = $.sync.l.g('_tab_list');
				console.log(JSON.parse(raw_tabs));
				return JSON.parse(raw_tabs);
			} catch (e) {
				console.log('get_tabs failed', e);
				return false;
			}
			
		},
		
		set_identity : function(passed) {
			var tab_id = $.sync.id;
			if (typeof(passed) === 'object' && passed != null) {
				if (typeof(passed.name) === 'string') {
					tab_id.name = passed.name; //This needs to be unique.
				} else {
					//decreases the probability of tab name collision, if left unchecked. TODO: fix...
					tab_id.name += Date.now();
					tab_id.name = tab_id.name.toString();
				}
				if (typeof(passed.tab_value) === 'object') {
					tab_id.value = passed.tab_value;
				}
			}
			console.log('tab_id', tab_id);
			
			var orig_tabs = $.sync.l.g('_tab_list');
			if (orig_tabs != 'undefined' && orig_tabs != null && orig_tabs != 'null') {
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
		init : function(arg, tab_identity) {
			$.sync.local_tab_list = $.sync.set_identity(tab_identity);
			
			$.sync.numTabs = $.sync.local_tab_list.length;
			
			console.log('this tab\'s id: ', $.sync.id);
			
			if (window.addEventListener) { //Apparently this helps IE8. Caution: this hasn't been tested on any version of IE.
				window.addEventListener('storage', function(event) {
					$.sync.syncEvent(event);
				});
			} else {
				window.attachEvent('onstorage', function(event) {
					$.sync.syncEvent(event);
				});
			}
			
			if (typeof(arg) !== undefined && arg != undefined) {
				if (arg.callback != undefined && typeof(arg.callback) === 'function') {
					$.sync.inboundHandler = arg.callback;
				}
				if (arg.closeTab != undefined && typeof(arg.closeTab) === 'function') {
					$.sync.closedTabHandler = arg.closeTab;
				}
				if (arg.newTab != undefined && typeof(arg.newTab) === 'function') {
					$.sync.newTabHandler = arg.newTab;
				}
			}
			
			//This handles cleaning up.
			window.onbeforeunload = function () {
				console.log('Closing tab');
				var extTabList = $.sync.l.g('_tab_list');
				console.log('Ext list: ', extTabList);
				if (typeof(extTabList) !== 'undefined' && extTabList != null) {
					extTabList = JSON.parse(extTabList);
					var found = false;
					
					for (var i=0; i<extTabList.length && !found; i++) {
						if (extTabList[i].name == $.sync.id.name) {
							extTabList.splice(location,1);
							$.sync.l.s('_tab_list', JSON.stringify(extTabList));
							found = true;
						}
						console.log('extTabList', extTabList);
					}
					console.log($.sync.id, extTabList,$.inArray($.sync.id,extTabList));
				}
				
			};
			
			// Attempts to intercepts and call the localStorage.clear() event to reestablish tabular identity.
			// Modded from (http://bit.ly/ohVpkh)
/*
			//I'm getting a TypeError while running this code, this is a known issue.
			localStorage.clear = function(native) {
				return function() {
					native();
					$.sync.set_identity();
				}
			}(localStorage.clear);
*/

			$.sync.initialized = true;
		},
		l : {
			s : function (key, val) {
				return localStorage.setItem(key,val);
			},
			g : function (key) {
				return localStorage.getItem(key);
			}
		}
	};
}(jQuery));