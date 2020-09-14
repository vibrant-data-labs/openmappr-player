/**
 * Layout based switching
 */
 angular.module('common')
 .directive('geolayout', ['$rootScope', 'renderGraphfactory', 'leafletData', 'layoutService', 'dataGraph', 'zoomService', 'selectService', 'BROADCAST_MESSAGES',
function ($rootScope, renderGraphfactory, leafletData, layoutService, dataGraph, zoomService, selectService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'EA',
        template:'<leaflet center="center" defaults="defaults" tiles="tiles" event-broadcast="events"></leaflet>', //
        scope: true,
        controller: ['$scope', ControllerFn],
        link:  {
            pre: preLinkFn,
            post: postLinkFn
        }
    };




    /*************************************
    ************ Local Data **************
    **************************************/
    var prefix = 'leafletDirectiveMap.';
    //var events = ['move'];//['zoomstart', 'drag', 'viewreset', 'resize'];
    //var events = ['zoomstart', 'drag','dragend', 'viewreset', 'resize'];
    var mouseEvents = ['click', 'mouseup','mousemove', 'mouseout', 'dblclick', 'viewreset', 'zoomstart', 'move', 'moveend'];
    var leftPanelWidth = 412;


    /*************************************
    ************ Leaflet override ********
    **************************************/
    var onBoxZoomEnd = null;
    L.Map.BoxZoom.prototype._onMouseUp = function (e) {
        if ((e.which !== 1) && (e.button !== 1)) { return; }
    
        this._finish();
    
        if (!this._moved) { return; }
        // Postpone to next JS tick so internal click event handling
        // still see it as "moved".
        this._resetStateTimeout = setTimeout(L.Util.bind(this._resetState, this), 0);
    
        var point = this._map.mouseEventToContainerPoint(e);
        var bounds = new L.LatLngBounds(
            this._map.containerPointToLatLng(this._startLayerPoint),
            this._map.containerPointToLatLng(point)
        );

        if (typeof onBoxZoomEnd === 'function') {
            onBoxZoomEnd(bounds);
        }
    };

    /*************************************
    ******** Controller Function *********
    **************************************/
    function ControllerFn($scope) {
        if($scope.plotType === "geo") {
            $('.angular-leaflet-map').height($('#project-layout').height());

            var mapID = $scope.mapprSettings.mapboxMapID || 'vibrantdata.j5c7ofm2';
            //added for custom mapbox styling
            angular.extend($scope, {
                defaults: {
                    minZoom: 2,
                    maxZoom: 15,
                    //scrollWheelZoom: false,
                    zoomControl: false
                },
                tiles: {
                    url: "https://a.tiles.mapbox.com/v3/" + mapID + "/{z}/{x}/{y}.png"
                }
            });
            $scope.events = {
                map: {
                    enable:mouseEvents,
                    logic: 'broadcast'
                }
            };
            var graphData = dataGraph.getRawDataUnsafe();
            var center = graphData.bounds.getCenter();

            $scope.center = {
                lat: center.lat,
                lng: center.lng,
                zoom: 3
            };
            $scope.$on(BROADCAST_MESSAGES.layout.changed, function(event, layout) {
                $scope.center.zoom = layout.setting('savedZoomLevel');
                $scope.center.lat = layout.camera.x;
                $scope.center.lng = layout.camera.y;
                console.log("[dirGeo] Updated center on layout.change", $scope.center);
            });
            $scope.$on(BROADCAST_MESSAGES.layout.loaded, function(event, layout) {
                $scope.center.zoom = layout.setting('savedZoomLevel');
                $scope.center.lat = layout.camera.x;
                $scope.center.lng = layout.camera.y;
                console.log("[dirGeo] Updated center on layout.loaded", $scope.center);
            });
        } else {
            console.warn('[dirGeoLayout]Should never be called!');
            //Make it happy
        }
    }


    /*************************************
    ************** Link Functions *********
    **************************************/

    function preLinkFn() {
        //$('.angular-leaflet-map').height($('#project-layout').height()).width($('#project-layout').width());
        //$('#project-layout').height($(element).height()).width($(element).width());
    }

    function postLinkFn(scope) {
        console.log('[dirGeoLayout.postLink] called!');
        $('.angular-leaflet-map').height(window.innerHeight).width(window.innerWidth - leftPanelWidth);
        var deregisters = [];
        var disableViewReset = false;

        var mapID = scope.mapprSettings.mapboxMapID || 'vibrantdata.j5c7ofm2';
        onBoxZoomEnd = function(bounds) {
            var layout = layoutService.getCurrentIfExists();
            var sig = renderGraphfactory.sig();
            var allNodes = sig.graph.nodes();

            var selectedNodes = _.filter(allNodes, function(node) {
                return bounds.contains([node.attr[layout.attr.x], node.attr[layout.attr.y]]);
            });
            selectService.selectNodes({ids: _.map(selectedNodes, (node) => node.id)});
        }

        scope.$watch('mapprSettings.mapboxMapID',function(newVal, oldVal) {
            if(newVal && newVal !== oldVal && newVal !== mapID) {
                console.log('[dirGeo]mapboxMapID Changed! (%s -> %s)', oldVal, newVal);
                mapID = newVal;
                scope.tiles = {
                    url : "https://a.tiles.mapbox.com/v3/" + mapID + "/{z}/{x}/{y}.png"
                };
            }
        });
        scope.$on(BROADCAST_MESSAGES.layout.changed, disableViewResetEvent);
        scope.$on(BROADCAST_MESSAGES.layout.loaded, disableViewResetEvent);

        scope.$on(BROADCAST_MESSAGES.sigma.rendered, enableViewResetEvent);
        //scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, enableViewResetEvent);



        function disableViewResetEvent () {
            disableViewReset = true;
        }
        function enableViewResetEvent () {
            disableViewReset = false;
        }


        leafletData.getMap().then(function(map) {
            window.map = map;
            setupGeoLayout(map);
        });

        function setupGeoLayout (map) {
            //console.log(map);
            console.assert(map, "Map Exists on the graph");

            // $('.angular-leaflet-map').height($('#project-layout').height()).width($('#project-layout').width());
            // bind events
            console.log('[dirGeo]Binding GEO events: ' + mouseEvents);
            _.each(mouseEvents, function(eventName) {
                deregisters.push(scope.$on(prefix + eventName, function(e, data) {
                    //console.log('mouse Event. e:%O, data: %O', e, data);
                    renderGraphfactory.getRenderer().dispatchEvent(e.name, data.leafletEvent);
                }));
            });

            // Zoom Start Event
            deregisters.push(scope.$on(prefix + 'zoomstart', function(e, data) {
                if(!disableViewReset) {
                    console.log('[Geo Zoom: zoomstart]: For graph. Event:%O, Data: %O',e, data);
                    zoomService.onGeoZoomStart(e, data);
                }
            }));

            // View Reset Event. Rebuild Graph as well
            deregisters.push(scope.$on(prefix + 'viewreset', function(e, data) {
                if(!disableViewReset) {
                    console.log('[Geo Zoom: viewreset]: rebuilding graph. Event:%O, Data: %O',e, data);
                    zoomService.onGeoZoomEnd(e, data);
                }
                //dataGraph.getRenderableGraph().refreshForGeoLevelChange();
            }));

            //Move event. Panning
            deregisters.push(scope.$on(prefix + 'move', function(e) {
                if(!disableViewReset) {
                    var sig = renderGraphfactory.sig();
                    if(e.name === prefix + 'move') {
                        var sigCam = sig.cameras.cam1;
                        var geoCenter = map.getCenter();
                        var center = map.latLngToLayerPoint(geoCenter);
                        //console.log(center);
                        if(Math.abs(sigCam.x - center.x) > 0.01 || Math.abs(sigCam.y - center.y) > 0.01) {
                            console.log("[dirGeo]Updating Geo camera");
                            sigCam.x = center.x;
                            sigCam.y = center.y;
                            sig.renderCamera(sigCam);
                        }
                        sigCam.ratio = 1;
                        var layoutCam = layoutService.getCurrentIfExists().camera;
                        layoutCam.x = geoCenter.lat;
                        layoutCam.y = geoCenter.lng;
                    } else {
                        console.error("WTF Has HAPPENED");
                    }
                }
            }));
        }

        function cleanup() {
            _.each(deregisters,function(dreg) {
                dreg();
            });
        }
        scope.$on('$destroy', function() {
            console.log("geoDir destroyed");
            cleanup();
        });

        angular.element(window).bind('resize',function() {
            scope.windowWidth = window.outerWidth;
            scope.windowHeight = window.outerHeight;
            scope.$apply('windowWidth');
            scope.$apply('windowHeight');
        });
        scope.$watch('windowWidth', function(newVal, oldVal) {
            if(newVal !== oldVal) {
                $('.angular-leaflet-map').height($('#project-layout').height()).width(window.innerWidth - leftPanelWidth);
            }
        });
        scope.$watch('windowHeight', function(newVal, oldVal) {
            if(newVal !== oldVal) {
                $('.angular-leaflet-map').height($('#project-layout').height()).width(window.innerWidth - leftPanelWidth);
            }
        });
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
