(function() {
'use strict';


/**
* Configure mixPanel module
*/
angular.module('analytics.mixpanel')
.config(['$mixpanelProvider', function($mixpanelProvider) {
    var api_key = ""; //Prod player
    // var api_key = ""; //Dev
    if(_.contains(document.location.host.split('.'), 'mappr')) {
    	$mixpanelProvider.apiKey(api_key);
    }
}]);



/**
* Intercept all angular events and fire events for analytics
*/
angular.module('hcApp')
.config(function($provide) {
	if(_.contains(document.location.host.split('.'), 'mappr')) {
        $provide.decorator('$rootScope', function($delegate) {
             var Scope = $delegate.constructor,
                 origBroadcast = Scope.prototype.$broadcast,
                 events = window.MP_APP.events;

             Scope.prototype.$broadcast = function(eventName, data) {
                if(!eventStartsWith(eventName, '$')) { //discard angular's internal events
                	events.publish(eventName, data);
                }
                if(!listenersAttached) {
                	attachTrackingListeners();
                }
                return origBroadcast.apply(this, arguments);
             };

             return $delegate;
         });
    }

    function eventStartsWith(e, substr) {
        return e && e.lastIndexOf && e.lastIndexOf(substr, 0) === 0;
    }
});


/**
* Listen to app events and track them
*/
var listenersAttached = false;

function attachTrackingListeners() {
	listenersAttached = true;
	var BROADCAST_MESSAGES = angular.element(document.body).injector().get('BROADCAST_MESSAGES');
	var analyticsService = angular.element(document.body).injector().get('analytics');
	var events = window.MP_APP.events;
	if(_.isEmpty(events)) throw new Error('Events system doesn\'t exist');

	// Player load events
	events.on(BROADCAST_MESSAGES.player.loadStart, function() {
		analyticsService.playerLoadStart();
		analyticsService.playerRenderStart();
	});

	events.on(BROADCAST_MESSAGES.player.load, function() {
		analyticsService.setSuperProps();
		analyticsService.playerLoadFinish();
	});

	events.on(BROADCAST_MESSAGES.player.loadFailure, function() {
		analyticsService.playerLoadFailure();
	});

	var playerRendered = events.on(BROADCAST_MESSAGES.sigma.rendered, function() {
		playerRendered.remove();
		analyticsService.playerRenderFinish();
	});

	events.on(BROADCAST_MESSAGES.player.renderFailure, function() {
		analyticsService.playerRenderFailure();
	});

	// Search
	events.on(BROADCAST_MESSAGES.search, function(data) {
		analyticsService.nodeSearched(data ? data.search : '');
	});

	events.on(BROADCAST_MESSAGES.searchFailure, function(data) {
		analyticsService.searchFailure();
	});

	events.on(BROADCAST_MESSAGES.searchAttrToggled, function(data) {
		analyticsService.searchAttrToggled(data);
	});

}

}());
