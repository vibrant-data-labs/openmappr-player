/**
 * Layout based switching
 */
 angular.module('common')
 .directive('geolayout', ['$rootScope', 'renderGraphfactory', 'leafletData', 'layoutService', 'dataGraph', 'zoomService', 'selectService', 'subsetService', '$log', 'BROADCAST_MESSAGES',
function ($rootScope, renderGraphfactory, leafletData, layoutService, dataGraph, zoomService, selectService, subsetService, $log, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'EA',
        template:`<leaflet center="center" defaults="defaults" tiles="tiles" no-wrap="true" event-broadcast="events"></leaflet>
            <div
                class="node-label group-label"
                style="position: absolute; font-size: 15px;"
                ng-style="{'color': clickedRegion.color, 'top': clickedRegion.y, 'left': clickedRegion.x }"
                ng-if="clickedRegion">
                <p style="font-size: 15px; pointer-events: auto; width: max-content;" ng-if="clickedRegion && clickedRegion.name">
                    {{clickedRegion.name}}
                </p>
                <span ng-if="!clickedRegion.name" class="loader-spinner"></span>
            </div>
            <div
                id="regionLabelFollower"
                class="node-label group-label"
                style="position: absolute; font-size: 15px;"
                ng-style="{'color': region ? region.color : 'black' }"
                ng-show="!!region">
                <p style="font-size: 15px; pointer-events: auto; width: max-content;" ng-if="region && region.name">
                    {{region.name}}
                </p>
                <span ng-if="!region.name" class="loader-spinner"></span>
            </div>
            `, //
        scope: true,
        controller: ['$scope', ControllerFn],
        link:  {
            pre: preLinkFn,
            post: postLinkFn
        }
    };

    var currentQuery = {};
    var abortController = new AbortController();

    /*************************************
    ************ Local Data **************
    **************************************/
    var prefix = 'leafletDirectiveMap.';
    //var events = ['move'];//['zoomstart', 'drag', 'viewreset', 'resize'];
    //var events = ['zoomstart', 'drag','dragend', 'viewreset', 'resize'];
    var mouseEvents = ['click', 'mouseup','mousemove', 'mouseout', 'dblclick', 'viewreset', 'zoomstart', 'zoomend', 'move', 'moveend'];
    var leftPanelWidth = 432;


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
    
        var point = this._map.mouseEventToLayerPoint(e);
        
        var bounds = new L.LatLngBounds(
            this._map.layerPointToLatLng(this._startLayerPoint),
            this._map.layerPointToLatLng(point)
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

            var mapID = $scope.mapprSettings.mapboxMapID || 'mapbox/light-v10';
            if (mapID.indexOf('vibrantdata') > -1) {
                mapID = 'mapbox/light-v10';
            }
            //added for custom mapbox styling
            angular.extend($scope, {
                defaults: {
                    minZoom: 2,
                    maxZoom: 15,
                    //scrollWheelZoom: false,
                    zoomControl: false
                },
                tiles: {
                    url: "https://api.mapbox.com/styles/v1/" + mapID + "/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZXJpY2JlcmxvdyIsImEiOiJja2h6MjA5bGkwY283MndvaDMyMzN0eXlmIn0.9f_Dm_N5IHHgGS4bfidgtA",
                    // options: {
                    //     noWrap: true
                    // }
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
                zoom: 2
            };
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

    function getColors(nodes, lod, scope) {
        const polygonColors = _.reduce(nodes, function(acc, cv) {
            if (!cv.geodata || !cv.geodata[lod]) return acc;

            const itemId = cv.geodata[lod];
            const color = cv.colorStr;

            if (itemId in acc) {
                acc[itemId] = [...acc[itemId], color];
            } else {
                acc[itemId] = [color];
            }

            return acc;
        }, {});

        return _.reduce(polygonColors, function(acc, cv, key) {
            acc[key] = {
                color: _.chain(cv).countBy().pairs().max(_.last).head().value(),
                count: cv.length,
            }
            acc.max = cv.length > acc.max ? cv.length : acc.max;
            return acc;
        }, {
            max: 0,
        });
    }

    function getOpacity(nodeData, id, opt) {
        if (!(id in nodeData)) {
            return 0;
        }

        if (!opt) {
            opt = {};
        }

        const percentage = nodeData[id].count / nodeData.max;

        const maxOpacity = opt.isHover ? 0.9 : 0.75;
        const minOpacity = opt.isHover ? 0.7 : 0.3;

        return minOpacity + (maxOpacity - minOpacity) * percentage;
    }

    function getRegionCacheItem(scope, osmId) {
        if (!scope.cache) {
            return undefined;
        }

        if (osmId in scope.cache) {
            return scope.cache[osmId];
        }

        return undefined;
    }

    function updateRegionCacheItem(scope, osmId, name) {
        if (!scope.cache) {
            scope.cache = {};
        }

        scope.cache[osmId] = name;
    }

    function getItemName(osmId, scope, type) {
        if (currentQuery[type] && currentQuery[type].id == osmId) {
            return;
        }

        currentQuery[type] = { id: osmId };

        abortController.abort('Query is obsolete');
        abortController = new AbortController();
        return fetch(`https://geo-tiles.vibrantdatalabs.org/regionname/${osmId}`, {
            signal: abortController.signal
        }).then(x => x.json())
            .then(x => {
                if (!x.name) {
                    return;
                }

                updateRegionCacheItem(scope, osmId, x.name);

                scope[type] = {
                    ...scope[type],
                    name: x.name
                }
                scope.$apply();
            }).catch(() => {
                currentQuery[type] = undefined;
            });
    }

    function renderProtobuf(lod, nodes, scope) {
        if (!lod) {
            lod = 'countries';
        }

        if (typeof window.removeTileLayer == 'function') {
            window.removeTileLayer();
        }

        const nodeData = getColors(nodes, lod, scope); // { [lodId]: color }
        const tileGrid = L.vectorGrid
        .protobuf(`https://geo-tiles.vibrantdatalabs.org/tiles/${lod}/{z}/{x}/{y}`, {
                vectorTileLayerStyles: {
                [lod]: (prop) => {
                    const color = nodeData[prop.osm_id]?.color;
                    if (color) {
                        return {
                            color: color,
                            opacity: getOpacity(nodeData, prop.osm_id, { isHover: false }),
                            fillOpacity: getOpacity(nodeData, prop.osm_id, { isHover: false }),
                            fill: true,
                        }
                    }

                    return {
                        color: 'transparent',
                        fill: false,
                    }
                }
            },
            rendererFactory: L.canvas.tile,
            interactive: true,
            getFeatureId: function(feature) {
                return feature.properties.osm_id;
            },
        })
        .addTo(window.map);

        const visitorTracker = {
            current: null,
            previous: null,
            clickedItem: null,
            _expHovers: [],
            _setHighlightInternal: function(id) {
                const color = nodeData[id].color;
                tileGrid.setFeatureStyle(id, {
                    color: color,
                    opacity: getOpacity(nodeData, id, { isHover: true }),
                    fillOpacity: getOpacity(nodeData, id, { isHover: true }),
                    fill: true,
                });
            },
            _clearHighlightInternal: function(id) {
                if (!(id in nodeData)) {
                    return;
                }
                const color = nodeData[id].color;
                tileGrid.setFeatureStyle(id, {
                    color: color,
                    opacity: getOpacity(nodeData, id, { isHover: false }),
                    fillOpacity: getOpacity(nodeData, id, { isHover: false }),
                    fill: true,
                });
            },
            setHoverStyleExplicitly: function(osmIds) {
                this._expHovers = osmIds;
                this._expHovers.forEach(this._setHighlightInternal);
            },
            hardResetHoverStyle: function() {
                this._expHovers.filter(x => x != this.clickedItem).forEach(this._clearHighlightInternal);
                this._expHovers = [];
            },
            setCurrentItem: function(osmId) {
                this.previous = this.current;
                this.resetHoverStyle();
                this.current = osmId;
                this.setHoverStyle();
            },
            leaveItem: function(osmId) {
                this.previous = osmId;
                this.resetHoverStyle();
            },
            click: function(osmId) {
                this.clickedItem = osmId;
                this.reset();
                this._setHighlightInternal(this.clickedItem)

                var sig = renderGraphfactory.sig();
                var allNodes = subsetService.subsetNodes.length > 0 ? subsetService.subsetNodes : sig.graph.nodes();
    
                var selectedNodes = _.filter(allNodes, function(node) {
                    if (!('geodata' in node)) {
                        return false;
                    }

                    return Object.values(node.geodata).includes(osmId);
                });
                
                selectService.selectNodes({ids: _.map(selectedNodes, (node) => node.id)});
            },
            clearClick: function() {
                this._clearHighlightInternal(this.clickedItem);
                this.clickedItem = null;
                this.reset();
                selectService.unselect();
            },
            reset: function() {
                this.current = null;
                this.previous = null;
            },
            setHoverStyle: function() {
                if (!(this.current in nodeData)) {
                    return;
                }

                if (this.current == this.clickedItem) {
                    return;
                }

                const container = document.querySelector('.leaflet-container');
                if (!container.classList.contains('leaflet-clickable')) {
                    container.classList.add('leaflet-clickable');
                }

                if (this.current) {
                    this._setHighlightInternal(this.current);
                    return;
                }
            },
            resetHoverStyle: function() {
                if (!(this.previous in nodeData)) {
                    return;
                }

                if (this.previous == this.clickedItem) {
                    return;
                }

                if (this._expHovers.includes(this.previous)) {
                    return;
                }

                if (this.previous) {
                    const container = document.querySelector('.leaflet-container');
                    if (container.classList.contains('leaflet-clickable')) {
                        container.classList.remove('leaflet-clickable');
                    }
                    this._clearHighlightInternal(this.previous);
                    return;
                }
            }
        };

        const onMouseMove = function(e) {
            const osmId = +e.layer.properties.osm_id;
            if (!(osmId in nodeData)) {
                return;
            }

            visitorTracker.setCurrentItem(osmId);
            scope.region = {
                name: (e.layer.properties['name:en'] || e.layer.properties.name || getRegionCacheItem(scope, osmId)),
                color: nodeData[osmId]?.color
            }

            if (!scope.region.name) {
                getItemName(osmId, scope, 'region');
            }

            if (visitorTracker.current == visitorTracker.clickedItem) {
                return;
            }

            $('#regionLabelFollower').css({
                left:  e.originalEvent.pageX + 20,
                top:   e.originalEvent.pageY
             });
        };

        tileGrid.on('mousemove', onMouseMove);

        const onMouseOut = function(e) {
            const osmId = +e.layer.properties.osm_id;
            visitorTracker.leaveItem(osmId);
            scope.region = undefined;
        };

        tileGrid.on('mouseout', onMouseOut);

        const onClick = function(e) {
            const osmId = +e.layer.properties.osm_id;
            scope.clickedRegion = undefined;
            if (visitorTracker.clickedItem && visitorTracker.clickedItem != osmId) {
                visitorTracker.clearClick();
            }
            if (!(osmId in nodeData)) {
                return;
            }
            
            visitorTracker.click(osmId);
            scope.clickedRegion = {
                name: e.layer.properties['name:en'] || e.layer.properties.name || getRegionCacheItem(scope, osmId),
                color: nodeData[osmId]?.color,
                x: e.originalEvent.pageX + 20,
                y: e.originalEvent.pageY,
            }

            if (!scope.clickedRegion.name) {
                getItemName(osmId, scope, 'clickedRegion');
            }

            e.originalEvent._isCaught = true;
        }

        tileGrid.on('click', onClick);
        window.map.on('click', (e) => {
            if (e.originalEvent._isCaught) {
                return;
            }

            scope.clickedRegion = undefined;
            visitorTracker.clearClick();
        });

        window.removeTileLayer = function() {
            tileGrid.off('mousemove', onMouseMove);
            tileGrid.off('mouseout', onMouseOut);
            tileGrid.off('click', onClick);
            window.map.removeLayer(tileGrid);
        }

        scope.visitorTracker = visitorTracker;
    }

    function postLinkFn(scope) {
        $log.debug('[dirGeoLayout.postLink] called!');
        $('.angular-leaflet-map')
            .height(window.innerHeight)
            .width(window.innerWidth - leftPanelWidth - 20)
            .css('left', (leftPanelWidth + 20) + 'px');
        var deregisters = [];
        var disableViewReset = false;

        var mapID = scope.mapprSettings.mapboxMapID || 'mapbox/light-v10';
        if (mapID.indexOf('vibrantdata') > -1) {
            mapID = 'mapbox/light-v10';
        }
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
                $log.debug('[dirGeo]mapboxMapID Changed! (%s -> %s)', oldVal, newVal);
                mapID = newVal;
                scope.tiles = {
                    url: "https://api.mapbox.com/styles/v1/" + mapID + "/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZXJpY2JlcmxvdyIsImEiOiJja2h6MjA5bGkwY283MndvaDMyMzN0eXlmIn0.9f_Dm_N5IHHgGS4bfidgtA",
                };
            }
        });
        scope.$on(BROADCAST_MESSAGES.layout.changed, disableViewResetEvent);
        scope.$on(BROADCAST_MESSAGES.layout.loaded, disableViewResetEvent);

        scope.$on(BROADCAST_MESSAGES.sigma.rendered, enableViewResetEvent);
        scope.$on(BROADCAST_MESSAGES.geoSelector.changed, function(ev, d) {
            const nodes = renderGraphfactory.sig().graph.nodes();

            if (d.levelId == 'node') {
                if (typeof window.removeTileLayer == 'function') {
                    window.removeTileLayer();
                    window.map.panBy(window.L.point(1, 1));
                    window.map.panBy(window.L.point(-1, -1));
                }

                $('sig').css('display', 'inherit');
            } else {
                renderProtobuf(d.levelId, nodes, scope);
                $('sig').css('display', 'none');
            }
        });

        scope.$on(BROADCAST_MESSAGES.renderGraph.changed, () => {
            if (typeof window.removeTileLayer == 'function') {
                window.removeTileLayer();
            }

            var sig = renderGraphfactory.sig();
            var nodes = subsetService.subsetNodes.length > 0 ? subsetService.subsetNodes : sig.graph.nodes();

            renderProtobuf($rootScope.geo.level, nodes, scope);
        });

        scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, function(ev, d) {
            if (!d.isGeo) {
                $('sig').css('display', 'inherit');
                return;
            }

            if ($rootScope.geo.level == 'node') {
                window.map.panBy(window.L.point(1, 1));
                window.map.panBy(window.L.point(-1, -1));
            } else {
                $('sig').css('display', 'none');
                renderProtobuf($rootScope.geo.level, d.graph.nodes, scope);
            }
        });

        scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function(ev, d) {
            if (!d.subsetCount) {
                const nodes = renderGraphfactory.sig().graph.nodes();
                renderProtobuf($rootScope.geo.level, nodes, scope);
            } else {
                renderProtobuf($rootScope.geo.level, d.nodes, scope);
            }
        });

        scope.$on(BROADCAST_MESSAGES.hss.hover, function(ev, d) {
            if (!scope.visitorTracker) {
                return;
            }

            scope.visitorTracker.hardResetHoverStyle();
            
            if (!d.nodes.length) {
                return;
            }

            var sig = renderGraphfactory.sig();
            var allNodes = sig.graph.nodes();
            const lod = $rootScope.geo.level;

            const geoItems = new Set();

            _.filter(allNodes, function(node) {
                if (!('geodata' in node)) {
                    return false;
                }

                return d.nodes.includes(node.id) && Boolean(node.geodata[lod]);
            }).forEach((v) => {
                geoItems.add(v.geodata[lod])
            });

            scope.visitorTracker.setHoverStyleExplicitly(Array.from(geoItems));
        });



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
            console.assert(map, "Map Exists on the graph");
           
            scope.mapCenter = map.latLngToLayerPoint(map.getCenter());
            map.on('move', function(e) {
                const newCenter = map.latLngToLayerPoint(map.getCenter());

                const diffX = scope.mapCenter.x - newCenter.x;
                const diffY = scope.mapCenter.y - newCenter.y;
                if(Math.abs(diffX) > 0.01 || Math.abs(diffY) > 0.01) {
                    scope.mapCenter = newCenter;

                    if (scope.clickedRegion) {
                        scope.clickedRegion.x = scope.clickedRegion.x + diffX;
                        scope.clickedRegion.y = scope.clickedRegion.y + diffY;
                    }
                    
                }

            });

            // Zoom Start Event
            deregisters.push(scope.$on(prefix + 'zoomstart', function(e, data) {
                if(!disableViewReset) {
                    $log.debug('[Geo Zoom: zoomstart]: For graph. Event:%O, Data: %O',e, data);
                    zoomService.onGeoZoomStart(e, data);
                }
            }));

            // Zoom End Event. Rebuild Graph as well
            deregisters.push(scope.$on(prefix + 'zoomend', function(e, data) {
                if(!disableViewReset) {
                    $log.debug('[Geo Zoom: zoomend]: rebuilding graph. Event:%O, Data: %O',e, data);
                    zoomService.onGeoZoomEnd(e, data);
                }
            }));

            //Move event. Panning
            deregisters.push(scope.$on(prefix + 'move', function(e) {
                if(!disableViewReset) {
                    var sig = renderGraphfactory.sig();
                    if(e.name === prefix + 'move') {
                        var sigCam = sig.cameras.cam1;
                        var geoCenter = map.getCenter();
                        var center = map.latLngToLayerPoint(geoCenter);
                        //$log.debug(center);
                        if(Math.abs(sigCam.x - center.x) > 0.01 || Math.abs(sigCam.y - center.y) > 0.01) {
                            $log.debug("[dirGeo]Updating Geo camera");
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
            $log.debug("geoDir destroyed");
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
