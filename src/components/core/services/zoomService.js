/**
* APIs to perform zoom operations on graph
*/
angular.module('common')
.service('zoomService', ['$q', '$rootScope', '$timeout', 'dataGraph', 'layoutService','renderGraphfactory' , 'BROADCAST_MESSAGES',
function($q, $rootScope, $timeout, dataGraph, layoutService, renderGraphfactory, BROADCAST_MESSAGES) {

    "use strict";


    /*************************************
    *************** API ******************
    **************************************/
    this.sigBinds = sigBinds;
    this.currentZoomLevel = currentZoomLevel;
    this.zoomIn           = zoomIn;
    this.zoomOut          = zoomOut;
    this.zoomReset        = zoomReset;
    this.zoomToNodes      = zoomToNodes;
    this.enableZoom       = enableZoom;
    this.disableZoom      = disableZoom;
    this.panCamera        = panCamera;
    this.restoreCamera    = restoreCamera;
    this.saveCamera       = saveCamera;
    this.zoomToOffsetPosition = zoomToOffsetPosition;
    this.centerNode       = centerNode;
    this.nodeFocus        = nodeFocus;
    this.panRightPanelBack = panRightPanelBack;
    this.shiftSavedCamCoords = shiftSavedCamCoords;
    // geo
    this.onGeoZoomStart   = onGeoZoomStart;
    this.onGeoZoomEnd     = onGeoZoomEnd;
    this.geoZoomRefresh = geoZoomRefresh;



    /*************************************
    ********* Local Data *****************
    **************************************/
    var isZoomDisabled = false;
    var savedCamera;


    /*************************************
    ********* Core Functions *************
    **************************************/

    var sigmaZoom = _.noop,
        sigmaReset = _.noop,
        sigmaZoomBase = _.noop,
        getRenderSettings = _.noop,
        getRenderCamera = _.noop;

    var refreshRenderGraph = _.debounce(function(rg, delta, event, fn) {
        if(delta !== 0) {
            if(rg.disableAggregation) {
                rg.updateZoomLevel(rg.zoomLevel + delta);
            } else {
                rg.refreshForZoomLevel(delta);
            }
        }
        fn();
        $rootScope.$broadcast(event.type, _.extend(event.data, { delta : delta }));
    }, 250);

    function getDefCamera () {
        return layoutService.getCurrentIfExists().defCamera;
    }
    function isInGeoMode () {
        return layoutService.getCurrentIfExists().isGeo;
    }

    function sigBinds(sig) {
        console.log('Binding handlers');
        var renderer = sig.renderers.graph;

        getRenderSettings = function () { return renderer.settings;};
        getRenderCamera = function () { return renderer.camera;};

        // Update camera in accordance with the sigma camera
        renderer.bind("coordinatesUpdated", function() {
            var cam = layoutService.getCurrentIfExists().camera;
            console.trace('Copying over sigma cam to layout cam', renderer.camera.x, cam);
            cam.x = renderer.camera.x;
            cam.y = renderer.camera.y;
            cam.ratio = renderer.camera.ratio;
        });

        renderer.bind('resize', function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.sigma.resize);
        });

        renderer.bind(BROADCAST_MESSAGES.zoom.start, function() {
            $rootScope.$broadcast(BROADCAST_MESSAGES.zoom.start);
        });

        renderer.bind(BROADCAST_MESSAGES.zoom.end, function(event) {
            // check if a new graph should be loaded or not
            var rg = dataGraph.getRenderableGraph();
            var delta = event.data.delta;
            if(!delta) {
                // try to guess it
                delta = event.data.eventType === 'zoomIn' ? -1 : 1;
                delta = event.data.eventType === 'zoomReset' ? -rg.zoomLevel : delta;
            }

            var cam = layoutService.getCurrentIfExists().camera;

            refreshRenderGraph(rg, delta, event, function() {
                // dir sigma uses these to update render cam.
                cam.x = renderer.camera.x;
                cam.y = renderer.camera.y;
                cam.ratio = renderer.camera.ratio;
            });
        });

        sigmaZoom = function sigmaZoom (delta) {
            var _settings = renderer.settings;
            var ratio = Math.pow(_settings('zoomingRatio'), delta);
            var defCam = getDefCamera();
            var pos = renderer.camera.cameraPosition(-defCam.x / defCam.ratio, -defCam.y / defCam.ratio, true);

            var eventType = delta > 0 ? 'zoomIn' : 'zoomOut';
            sigmaZoomBase(eventType, pos, ratio, delta);
        };

        sigmaReset = function sigmaReset (newCam) {
            var pos = {};
            var cam = renderer.camera;
            const ratioMap = {
                'scatterplot': newCam.ratio,
                'clustered-scatterplot': 1.5,
            }

            const newRatio = ratioMap[layoutService.getCurrentIfExists().plotType] || (newCam.ratio * 1.125);            
            var ratio = newRatio / cam.ratio;
            var eventType = 'zoomReset';
            var rg = dataGraph.getRenderableGraph();
            //ratio *= rg.baseRatio;
            if(Math.abs(ratio - 1) < 0.001 ) {
                ratio = 1;
                pos.x = newCam.x;
                pos.y = newCam.y;
            } else {
                pos.x = ((newCam.x) - cam.x) / (1 - ratio);
                pos.y = ((newCam.y) - cam.y) / (1 - ratio);
            }
            sigmaZoomBase(eventType, pos, ratio, -rg.zoomLevel);
        };

        sigmaZoomBase = function sigmaZoomBase (eventType, pos, ratio, delta) {
            var _settings = renderer.settings;
            var cam = renderer.camera;

            var count = sigma.misc.animation.killAll(cam);
            var animation = {
                duration: _settings('mouseZoomDuration'),
                easing: count ? 'quadraticOut' : 'quadraticInOut',
                onComplete : function() {
                    renderer.dispatchEvent(BROADCAST_MESSAGES.zoom.end, {
                        eventType : eventType,
                        ratio : ratio,
                        pos : pos,
                        delta : delta
                    });
                }
            };
            renderer.dispatchEvent(BROADCAST_MESSAGES.zoom.start, {
                eventType : eventType,
                ratio : ratio,
                pos : pos,
                delta : delta
            });
            if(ratio === 1) {
                sigma.misc.animation.camera(cam, pos, animation);
            } else {
                sigma.utils.zoomTo(cam, pos.x, pos.y, ratio, animation);
            }
        };
    }

    function saveCamera() {
        if(isInGeoMode()) {
            var map = layoutService.getCurrentIfExists().map;
            savedCamera = {
                latLng: map.getCenter(),
                zoom: map.getZoom()
            };
        } else {
            var cam = getRenderCamera();
            savedCamera = {
                x: cam.x,
                y: cam.y,
                ratio: cam.ratio,
                zoomLevel: currentZoomLevel()
            };
        }
    }

    // Used currently only for node overlay transition to node
    function shiftSavedCamCoords(x, y) {
        savedCamera.x -= x;
        savedCamera.y -= y;
    }

    function currentZoomLevel () {
        return dataGraph.getRenderableGraph().zoomLevel;
    }

    function sigmaZoomOut() {
        console.timeStamp('zoomOut');
        if(isZoomDisabled) {return;}
        sigmaZoom(1);
    }

    function sigmaZoomIn() {
        console.timeStamp('zoomIn');
        if(isZoomDisabled) {return;}
        sigmaZoom(-1);
    }
    function sigmaZoomReset() {
        sigmaReset(layoutService.getCurrentIfExists().defCamera);
    }

    function sigmaZoomToNodes(nodes) {
        var _settings = getRenderSettings(), _cam = getRenderCamera();
        var rg = dataGraph.getRenderableGraph();
        var rightPanel = $('#right-panel');

        var minxNode = _.min(nodes, 'x'),
            maxxNode = _.max(nodes, 'x'),
            minyNode = _.min(nodes, 'y'),
            maxyNode = _.max(nodes, 'y');
        var minSize = 5 * _.max(nodes, 'size').size;    // minimum horizontal or vertical extent
        var minx = minxNode.x - minxNode.size,
            maxx = maxxNode.x + maxxNode.size,
            miny = minyNode.y - minyNode.size,
            maxy = maxyNode.y + maxyNode.size;
        var pos = {x: (maxx + minx)/2, y: (maxy + miny)/2};
        var leftPanelWidth = rightPanel.width();

        var width = Math.max(minSize, Math.abs(minx - maxx)), height = Math.max(minSize, Math.abs(miny - maxy));
        var ratioX = width / (window.innerWidth - leftPanelWidth - layoutService.marginX - ((window.innerWidth - leftPanelWidth) / 100 * 5)), 
            ratioY = height / (window.innerHeight - layoutService.marginY - (window.innerHeight / 100 * 3 ));
        var ratio = ratioX > ratioY ? ratioX : ratioY;
        pos.x += ratio * layoutService.offsetX;
        pos.y -= ratio * layoutService.offsetY;

        // normalize ratio
        ratio = Math.min(ratio/getDefCamera().ratio, 1.0);

        var tgtZoomLevel = 0, prevRatio = NaN;
        var base = _settings('zoomingRatio'), tgtRatio = 1;
        // find the correst multiplier for tgtZoomLevel
        if(ratio > tgtRatio) {
            while(ratio > tgtRatio){
                prevRatio = tgtRatio;
                tgtRatio *= base;
                tgtZoomLevel ++;
            }
        } else if(ratio < tgtRatio){
            base = 1 / base;
            while(ratio < tgtRatio){
                prevRatio = tgtRatio;
                tgtRatio *= base;
                tgtZoomLevel--;
            }
            tgtRatio = prevRatio;
            tgtZoomLevel++;
        } else {
            prevRatio = base;
        }
        var delta = tgtZoomLevel - rg.zoomLevel;
        // Since this ratio is multiplied to the current camera, need to adjust for it.
        tgtRatio = tgtRatio * getDefCamera().ratio / _cam.ratio;
        if(Math.abs(tgtRatio - 1) < 0.001 ) {
            tgtRatio = 1;
        } else {
            pos.x = (pos.x - _cam.x) / (1 - tgtRatio);
            pos.y = (pos.y - _cam.y) / (1 - tgtRatio);
        }

        if(delta < 0) {
            sigmaZoomBase('zoomIn', pos, tgtRatio, delta);
        } else {
            sigmaZoomBase('zoomOut', pos, tgtRatio, delta);
        }
        return $q.when('zoomDone');
    }

    // restore x, y, ratio, zoomLevel
    function restoreCamera() {
        if( savedCamera !== undefined ) {
            if(isInGeoMode()) {
                var map = layoutService.getCurrentIfExists().map;
                map.setView(savedCamera.latLng, savedCamera.zoom);
                geoZoomReset();
                return $q.when('zoomDone');
            } else {
                var rg = dataGraph.getRenderableGraph();
                var _cam = getRenderCamera();
                var delta = savedCamera.zoomLevel - rg.zoomLevel;
                // Since this ratio is multiplied to the current camera, need to adjust for it.
                var tgtRatio = savedCamera.ratio / _cam.ratio;
                var pos = {};
                if(Math.abs(tgtRatio - 1) < 0.001 ) {
                    tgtRatio = 1;
                    pos.x = savedCamera.x;
                    pos.y = savedCamera.y;
                } else {
                    pos.x = (savedCamera.x - _cam.x) / (1 - tgtRatio);
                    pos.y = (savedCamera.y - _cam.y) / (1 - tgtRatio);
                }
                if(delta < 0) {
                    sigmaZoomBase('zoomIn', pos, tgtRatio, delta);
                } else {
                    sigmaZoomBase('zoomOut', pos, tgtRatio, delta);
                }
            }
        }
    }

    /////////
    /// Geo Zoom Funcs

    function onGeoZoomStart (event, data) {
        console.log("[zoomService.onGeoZoomStart] args:", event, data);
        // disable rendering
        var renderer = renderGraphfactory.getRenderer();
        renderer.clear(true);
    }

    function onGeoZoomEnd (event, data) {
        console.log("[zoomService.onGeoZoomEnd] args:", event, data);
        // recalc graph
        var graph = dataGraph.getRenderableGraph();
        var prevZoomLevel = graph.zoomLevel;
        graph.updateZoomLevel(layoutService.getCurrentIfExists().map.getZoom());
        graph.refreshForGeoLevelChange();
        console.log('zoom end in geo');
        $rootScope.$broadcast(BROADCAST_MESSAGES.zoom.end, {
            eventType : '',
            ratio : NaN,
            pos: null,
            delta : prevZoomLevel - graph.zoomLevel,
            baseEvent : data,
            isGeo : true
        });
    }

    function geoZoom(delta) {
        var zoomType = delta > 0 ? 'zoomOut' : 'zoomIn';
        layoutService.getCurrentIfExists().map[zoomType](Math.abs(delta));
    }

    function geoZoomRefresh() {
        layoutService.getCurrentIfExists().map['zoomOut'](0);
    }

    function geoZoomOut() {
        console.timeStamp('zoomOut');
        if(isZoomDisabled) {return;}
        geoZoom(1);
    }

    function geoZoomIn() {
        console.timeStamp('zoomIn');
        if(isZoomDisabled) {return;}
        geoZoom(-1);
    }
    function geoZoomReset() {
        console.timeStamp('zoomReset');
        var graphData = dataGraph.getRawDataUnsafe();
        var layout = layoutService.getCurrentIfExists();
        var map = layout.map;
        var center = dataGraph.getRawDataUnsafe().bounds.getCenter();
        var zoomLevelToReset = map.getBoundsZoom(graphData.bounds);

        map.setView(center, zoomLevelToReset);
    }

    function geoZoomToNodes (nodes) {
        var map = layoutService.getCurrentIfExists().map;
        var bounds = _.map(nodes, function calcGeoBounds (n) {
            var lat = n.attr.Latitude ? parseFloat(n.attr.Latitude) : 0;
            var lng = n.attr.Longitude ? parseFloat(n.attr.Longitude) : 0;
            return window.L.latLng(lat, lng);
        });
        bounds = window.L.latLngBounds(bounds);
        var zoomLevel = map.getBoundsZoom(bounds);
        var center = bounds.getCenter();
        map.setView(center, zoomLevel);
        return $q.when('zoomDone');
    }

    ///////////
    /// Generic Zoom Funcs

    function enableZoom () {
        isZoomDisabled = false;
    }
    function disableZoom () {
        isZoomDisabled = true;
    }

    function zoomOut() {
        console.timeStamp('zoomOut');
        if(isZoomDisabled) {return;}
        if(isInGeoMode()) {
            return geoZoomOut();
        } else {
            return sigmaZoomOut();
        }
    }

    function zoomIn() {
        console.timeStamp('zoomIn');
        if(isZoomDisabled) {return;}
        if(isInGeoMode()) {
            return geoZoomIn();
        } else {
            return sigmaZoomIn();
        }
    }
    function zoomReset() {
        console.timeStamp('zoomReset');
        if(isInGeoMode()) {
            return geoZoomReset();
        } else {
            return sigmaZoomReset();
        }
    }
    function zoomToNodes (nodes) {
        if(isInGeoMode()){
            return geoZoomToNodes(nodes);
        } else {
            return sigmaZoomToNodes(nodes);
        }
    }

    // movement in model coordinates
    function panCamera(dx, dy, doneFn) {
        if(isInGeoMode()) {
            var map = layoutService.getCurrentIfExists().map;
            map.panBy(window.L.point(dx, dy));
            doneFn();
        } else {
            var cam = getRenderCamera();
            var pos = {x: cam.x + dx, y: cam.y + dy};
            var _settings = getRenderSettings();
            var count = sigma.misc.animation.killAll(cam);
            var animation = {
                duration: _settings('mouseZoomDuration'),
                easing: count ? 'quadraticOut' : 'quadraticInOut',
                onComplete : function() {
                    doneFn();
                }
            };
            sigma.misc.animation.camera(cam, pos, animation);
        }
    }

    // centers a node on visible graph area without changing zoom level
    function centerNode(node) {
        if(!node.id || !node.dataPointId) throw new Error('Not a valid node object');
        // Visible graph area center coords
        var rightPanel = $('#right-panel'),
            header = $('#header'),
            leftPanelWidth = 0,
            headerHeight = 0;

        if(!rightPanel) {
            console.error('Could not find right panel element');
        }
        else {
            leftPanelWidth = rightPanel.width();
        }

        if(!header) {
            console.error('Could not find header element');
        }
        else {
            headerHeight = header.height();
        }

        var centerPos = {
            x: (window.innerWidth - leftPanelWidth)/2,
            y: (window.innerHeight - headerHeight)/2
        };
        var panX = (centerPos.x - node['camcam1:x']) * -1;
        var panY = (centerPos.y - node['camcam1:y']) * -1;

        var cam = getRenderCamera();
        panCamera(panX * cam.ratio, panY * cam.ratio, _.noop);
    }

    // Returns the flag indicating whether was the panning or not
    function nodeFocus(node) {
        if (isInGeoMode() && $rootScope.geo.level !== 'node') {
            // no extra panning for the region selection
            return;
        }

        if(!node.id || !node.dataPointId) throw new Error('Not a valid node object');
        // Visible graph area center coords
        var header = $('#header'),
            leftPanelWidth = $('.node-right-panel').width() || 0,
            rightPanelWidth = $('.right-panel').offset().left + $('.right-panel').width(),
            headerHeight = header ? $(header).height() : 0;

        // Boundaries for canvas
        var bounds = {
            left: 0, 
            right: (window.innerWidth - rightPanelWidth - leftPanelWidth),
            top: headerHeight,
            bottom: window.innerHeight
        };

        // if node falls in 5% distance of boundary then treat it as shouldCenter
        bounds.left = bounds.right * 0.05;
        bounds.right = bounds.right - bounds.left;

        var deltaY = window.innerHeight * 0.05;
        bounds.top += deltaY;
        bounds.bottom -= deltaY;
        var nodeData = {
            x: node['camcam1:x'],
            y: node['camcam1:y']
        };

        var outOfX = nodeData.x < bounds.left || nodeData.x > bounds.right;
        var outOfY = nodeData.y < bounds.top || nodeData.y > bounds.bottom;
        
        if (outOfX || outOfY) {
            var resultCoordinates = {
                x: nodeData.x,
                y: nodeData.y
            };

            if (outOfX) {
                var leftDistance = bounds.left - nodeData.x;
                resultCoordinates.x = leftDistance > 0 ? bounds.left : bounds.right;
            }

            if (outOfY) {
                var topDistance = bounds.top - nodeData.y;
                resultCoordinates.y = topDistance > 0 ? bounds.top : bounds.bottom;
            }

            var panX = (resultCoordinates.x - node['camcam1:x']) * -1;
            var panY = (resultCoordinates.y - node['camcam1:y']) * -1;

            var cam = getRenderCamera();
            panCamera(panX * cam.ratio, panY * cam.ratio, _.noop);

            return panX;
        }

        return 0;
    }

    function panRightPanelBack(panX) {
        var cam = getRenderCamera();
        panCamera(-panX * cam.ratio, 0, _.noop);
    }

    function geoZoomToOffsetPosition(nodes) {
        //just zoom graph in one
        // geoZoomIn();
        geoZoomToNodes(nodes).then(function() {
            var map = layoutService.getCurrentIfExists().map;
            map.panBy(window.L.point(-525, 0));
        });
    }

    // pos is model coordinate position
    // relRatio is relative zoom ratio
    // offset is in screen coordinates
    function sigZoomToOffsetPosition(pos, relRatio, offset) {
        var _cam = getRenderCamera(), defCam = getDefCamera();

        // compute camera position, converting offset from screen to model coords
        var tgtRatio = _cam.ratio/relRatio;
        pos.x += offset.x*tgtRatio;
        pos.y += offset.y*tgtRatio;
        // Since this ratio is multiplied to the current camera, need to adjust for it.
        tgtRatio = defCam.ratio / relRatio;
        if(Math.abs(tgtRatio - 1) < 0.001 ) {
            tgtRatio = 1;
        } else {
            pos.x = (pos.x - _cam.x) / (1 - tgtRatio);
            pos.y = (pos.y - _cam.y) / (1 - tgtRatio);
        }
        sigmaZoomBase('zoomIn', pos, tgtRatio, 0);
    }
    function zoomToOffsetPosition(pos, relRatio, offset, nodes) {
        if(isInGeoMode()) {
            geoZoomToOffsetPosition(nodes);
        } else {
            sigZoomToOffsetPosition(pos, relRatio, offset);
        }
    }

}
]);
