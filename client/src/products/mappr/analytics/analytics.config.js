(function() {
    'use strict';


    /**
    * Configure mixPanel module
    */
    angular.module('analytics.mixpanel')
    .config(['$mixpanelProvider', function($mixpanelProvider) {
        var api_key = ""; //Prod App
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

        // Set user
        events.on(BROADCAST_MESSAGES.user.loggedIn, function() {
            analyticsService.setUser();
        });

        // Set org
        events.on(BROADCAST_MESSAGES.org.loaded, function() {
            analyticsService.setSuperProps();
        });

        // Project load events
        events.on(BROADCAST_MESSAGES.project.loadStart, function() {
            analyticsService.projLoadStart();
            analyticsService.projRenderStart();
        });

        events.on(BROADCAST_MESSAGES.project.load, function() {
            analyticsService.projLoadFinish();
        });

        events.on(BROADCAST_MESSAGES.project.loadFailed, function(data) {
            analyticsService.projLoadFailed(_.get(data, 'projId', null));
        });

        var sigmaRendered = events.on(BROADCAST_MESSAGES.sigma.rendered, function() {
            sigmaRendered.remove();
            analyticsService.projRenderFinished();
        });

        events.on(BROADCAST_MESSAGES.project.renderFailed, function() {
            analyticsService.projRenderFailed();
        });

        // netgen events
        events.on(BROADCAST_MESSAGES.netgen.started, function() {
            analyticsService.netgenStart();
        });

        events.on(BROADCAST_MESSAGES.netgen.finished, function(data) {
            analyticsService.netgenFinished(data.networkId);
        });

        events.on(BROADCAST_MESSAGES.netgen.failed, function() {
            analyticsService.netgenFailed();
        });

        // subnet events
        events.on(BROADCAST_MESSAGES.subnet.started, function() {
            analyticsService.subnetStart();
        });

        events.on(BROADCAST_MESSAGES.subnet.finished, function(data) {
            analyticsService.subnetFinished(data.networkId);
        });

        events.on(BROADCAST_MESSAGES.subnet.failed, function() {
            analyticsService.subnetFailed();
        });

        // Project edit ops
        events.on(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated, function() {
            analyticsService.nodeAttrsUpdated();
        });

        events.on(BROADCAST_MESSAGES.project.selectionBakedIntoDS, function() {
            analyticsService.selectionBakedIntoDS();
        });

        events.on(BROADCAST_MESSAGES.project.dpCatNamesChanged, function() {
            analyticsService.dpCatNamesChanged();
        });

        events.on(BROADCAST_MESSAGES.network.updated, function() {
            analyticsService.networkUpdated();
        });

        events.on(BROADCAST_MESSAGES.network.deleted, function(data) {
            analyticsService.networkDeleted(data ? data.delNetworkId : null);
        });

        events.on(BROADCAST_MESSAGES.dataMerged, function() {
            analyticsService.dataMerged();
        });

        events.on(BROADCAST_MESSAGES.player.updated, function(data) {
            analyticsService.playerUpdated(data ? data.updateOp : null);
        });

        // Snapshot ops
        events.on(BROADCAST_MESSAGES.snapshot.added, function(data) {
            analyticsService.snapshotAdded(data ? data.createdSnap : {});
        });

        events.on(BROADCAST_MESSAGES.snapshot.updated, function(data) {
            analyticsService.snapshotUpdated(data ? data.updatedSnap : {});
        });

        events.on(BROADCAST_MESSAGES.snapshot.removed, function(data) {
            analyticsService.snapshotDeleted(data ? data.deletedSnap : {});
        });

        // events.on(BROADCAST_MESSAGES.snapshot.disabled, function(data) {
        // 	analyticsService.snapshotDeleted(data ? data.deletedSnap : {});
        // });

        // Custom data groups ops
        events.on(BROADCAST_MESSAGES.dataGroup.added, function(data) {
            analyticsService.dgAdded(data ? data.groupName : {});
        });

        events.on(BROADCAST_MESSAGES.dataGroup.datapointsAdded, function(data) {
            analyticsService.dgDPsAdded(data ? data.groupName : {});
        });

        events.on(BROADCAST_MESSAGES.dataGroup.inverted, function(data) {
            analyticsService.dgInverted(data ? data.groupName : {});
        });

        events.on(BROADCAST_MESSAGES.dataGroup.datapointsRemoved, function(data) {
            analyticsService.dgDPsRemoved(data ? data.groupName : {});
        });

        events.on(BROADCAST_MESSAGES.dataGroup.nameUpdated, function(data) {
            analyticsService.dgNameUpdated(data ? data.groupName : {});
        });

        events.on(BROADCAST_MESSAGES.dataGroup.datapointsReplaced, function(data) {
            analyticsService.dgDPsReplaced(data ? data.groupName : {});
        });

        events.on(BROADCAST_MESSAGES.dataGroup.deleted, function(data) {
            analyticsService.dgDeleted(data ? data.groupName : {});
        });

        // Stats panel
        events.on(BROADCAST_MESSAGES.fp.filter.visibilityToggled, function(data) {
            analyticsService.filtersVisiblityToggled(data ? data.filtersVisible : null);
        });

        events.on(BROADCAST_MESSAGES.fp.attrSearched, function(data) {
            analyticsService.statsAttrSearched(data ? data.query : '');
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

        // Layout panel
        events.on(BROADCAST_MESSAGES.layoutPanel.layoutCreated, function(data) {
            analyticsService.layoutCreated(data);
        });

    }

}());
