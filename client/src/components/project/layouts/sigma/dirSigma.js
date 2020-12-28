/**
 * Uses the given renderGraph and settings to display graph
 */
angular.module('common')
.directive('sig', ['$rootScope','renderGraphfactory', 'eventBridgeFactory','dataGraph', 'labelService', 'graphSelectionService', 'zoomService', 'tagService', 'graphHoverService', 'inputMgmtService', 'SelectionSetService', 'BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService',
function ($rootScope, renderGraphfactory, eventBridgeFactory, dataGraph, labelService, graphSelectionService, zoomService, tagService, graphHoverService, inputMgmtService, SelectionSetService, BROADCAST_MESSAGES, hoverService, selectService, subsetService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        template:
            '<div id="sig-holder" class="sig-holder" ng-mousemove="onMouseMoveSig($event)" ng-mouseup="onMouseUpSig($event)" ng-mousedown="onMouseDownSig($event)">'+
                '<div id="mainCanvas" class="graph-container"></div>' +
                '<div class="sig-selection" id="selection" hidden></div>' +
            '</div>',
        restrict: 'EA',
        scope: true,
        link: {
            pre: preLinkFn,
            post: postLinkFn
        }
    };



    /*************************************
    ************ Local Data **************
    **************************************/
    var tweenOpts = {
        tweenPrefix : renderGraphfactory.getTweenPrefix(),
        tweenTime : 750 // is changed depending on the transition
    };

    var __rendering_in_progress__ = false;
    var leftPanelWidth = 432;

    var selectionDiv;
    var x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    var selectionDivEnabled = false;

    function reCalc() {
        var x3 = Math.min(x1,x2);
        var x4 = Math.max(x1,x2);
        var y3 = Math.min(y1,y2);
        var y4 = Math.max(y1,y2);
        selectionDiv.style.left = x3 + 'px';
        selectionDiv.style.top = y3 + 'px';
        selectionDiv.style.width = x4 - x3 + 'px';
        selectionDiv.style.height = y4 - y3 + 'px';
    }


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Link Function *********
    **************************************/
    function preLinkFn(scope, element) {
        //Setup sigma
        var sigRoot = element[0].childNodes[0].childNodes;
        renderGraphfactory.initGraph(sigRoot, scope.mapprSettings || {});
        console.log('[dirSigma.link] Sigma Setup finished!');
    }

    function postLinkFn(scope, element) {
        var sigRoot = element[0].childNodes[0].childNodes;
        var sig = renderGraphfactory.sig() || renderGraphfactory.initGraph(sigRoot, scope.mapprSettings || {});
        // $(element).height($('#project-layout').height()).width($('#project-layout').width());
        $(element).height(window.innerHeight).width(window.innerWidth - leftPanelWidth);
        // Build the sigmaAngular Bridge
        var sigmaBridge = new eventBridgeFactory.Sigma2Angular({});
        sigmaBridge.build($rootScope, sig);
        graphHoverService.sigBinds(sig);
        graphSelectionService.sigBinds(sig);
        zoomService.sigBinds(sig);
        hoverService.sigBinds(sig);
        selectService.sigBinds(sig);
        subsetService.sigBinds(sig);

        scope.$on(BROADCAST_MESSAGES.sigma.doubleClickNode, function(event, data) {
            console.log("Node double clicked!:", event, data);
            zoomService.zoomToNodes(graphSelectionService.selectedNodesAndNeighbors());
        });

        scope.$on(BROADCAST_MESSAGES.zoom.end, reloadAggrGraphsOnZoomEnd);
        scope.$on(BROADCAST_MESSAGES.zoom.reset, reloadAggrGraphsOnZoomEnd);

        scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, function(event, rg) {
            renderGraphLoaded(event, rg);
        });
        scope.$on(BROADCAST_MESSAGES.renderGraph.changed, function(event, rg) {
            renderGraphChanged(event, rg, false, true);
        });
        scope.$on(BROADCAST_MESSAGES.renderGraph.tween, function(event, info) {
            tweenNodes(info.rg, info.pos, info.postOp);
        });

        // Re render with only mapprSettings changes.
        scope.$on(BROADCAST_MESSAGES.layout.mapprSettingsUpdated, function onMapprSettingsChange (event, data) {
            if(!data.regenGraph) {
                renderG();
            }
        });

        scope.$on('$destroy', function() {
            cleanup();
        });

        //hack to get resize in 1 go
        angular.element(window).bind('resize',function() {
            scope.windowWidth = window.innerWidth - leftPanelWidth;
            scope.windowHeight = window.innerHeight;
            scope.$apply('windowWidth');
            scope.$apply('windowHeight');
        });
        scope.$watch('windowWidth', function(newVal, oldVal) {
            if(newVal !== oldVal && scope.layout && scope.layout.plotType !== 'geo') {
                $(element).height(window.innerHeight).width(window.innerWidth - leftPanelWidth);
                // $(element).height($('#project-layout').height()).width($('#project-layout').width());
            }
        });

        scope.$watch('windowHeight', function(newVal, oldVal) {
            if(newVal !== oldVal && scope.layout && scope.layout.plotType !== 'geo') {
                $(element).height(window.innerHeight).width(window.innerWidth - leftPanelWidth);
                // $(element).height($('#project-layout').height()).width($('#project-layout').width());
            }
        });

        selectionDiv = document.getElementById('selection');

        scope.onMouseMoveSig = function(ev) {
            x2 = ev.clientX;
            y2 = ev.clientY;
            reCalc();
        }

        scope.onMouseUpSig = function(ev) {
            if (selectionDivEnabled) {
                const { bottom, left, top, right } = selectionDiv.getBoundingClientRect();
                var allNodes = sig.graph.nodes();
                var appendNodesOnly = $(selectionDiv).width() == 0 && $(selectionDiv).height() == 0;
                var selectedNodes = [];
                if (appendNodesOnly) {
                    selectedNodes = _.filter(allNodes, function(node) {
                        const nodeBorders = {
                            left: node['camcam1:x'] + leftPanelWidth - node['camcam1:size'],
                            right: node['camcam1:x'] + leftPanelWidth + node['camcam1:size'],
                            top: node['camcam1:y'] - node['camcam1:size'],
                            bottom: node['camcam1:y'] + node['camcam1:size'],
                        };

                        return left >= nodeBorders.left && right <= nodeBorders.right && top >= nodeBorders.top && bottom <= nodeBorders.bottom;
                    });
                } else {
                    selectedNodes = _.filter(allNodes, function(node) {
                        return node['camcam1:x'] + leftPanelWidth < right && node['camcam1:x'] + leftPanelWidth > left &&
                        node['camcam1:y'] > top && node['camcam1:y'] < bottom;
                    });
                }
                selectionDivEnabled = false;
                selectionDiv.hidden = true;

                setTimeout(function() {
                    if (appendNodesOnly) {
                        selectService.appendToSelection(_.map(selectedNodes, (node) => node.id));
                    } else {
                        selectService.selectNodes({ids: _.map(selectedNodes, (node) => node.id)});
                    }
                }, 100);
            }
        }

        scope.onMouseDownSig = function(ev) {
            if (ev.shiftKey) {
                selectionDivEnabled = true;
                selectionDiv.hidden = false;
                x1 = ev.clientX;
                y1 = ev.clientY;
                reCalc();
            }
        }

        function reloadAggrGraphsOnZoomEnd (event, data) {
            var rg = dataGraph.getRenderableGraph();
            if(rg.isGeo == true || (data.delta !== 0 && !rg.disableAggregation)) {
                renderGraphChanged(event, rg, true, true);
            }
        }

        function renderGraphLoaded (event, renderableGraph) {
            console.group('[dirSigma.$on ' + event.name);
            console.log('renderGraphLoaded event: %O, renderableGraph: %O',event, renderableGraph);
            var prevPlotType = sig.settings('layoutType');
            var reProjectNodes = false;

            if(scope.layout.isGeo) {
                // Disable mouse handling.
                element.css('pointer-events','none');
            } else {
                element.css('pointer-events','auto');
            }
            sig.settings('layoutType', scope.layout.plotType);

            if(scope.layout.plotType === 'geo' && prevPlotType === 'geo') {
                // no tweening between geo graphs
                renderGraph(renderableGraph, null, true, true);
            } else {
                if(prevPlotType) { reProjectNodes = true; }
                var tweenType = 'transition';
                if(!prevPlotType || sig.graph.nodes().length === 0) {
                    tweenType = 'randomly';
                }
                if(reProjectNodes) {
                    reProjectRenderedNodes(scope.layout.plotType, sig.graph);
                }
                var tween = tweenSetup(tweenType, renderableGraph);
                renderGraph(renderableGraph, tween, true, true);
            }
            console.groupEnd();
        }

        //
        // Reload sigma on datagraph change, with tweening
        //
        function renderGraphChanged(event, renderableGraph, reRender, reLoad) {
            console.group('[dirSigma.$on ' + event.name);
            console.log('renderGraphChanged event: %O, renderableGraph: %O',event, renderableGraph);
            var prevPlotType = sig.settings('layoutType');
            sig.settings('layoutType', scope.layout.plotType);
            if(scope.layout.isGeo) {
                // Disable mouse handling.
                element.css('pointer-events','none');
            } else {
                element.css('pointer-events','auto');
            }
            var tween = null;
            // no tweening between geo graph changes
            if(prevPlotType !=='geo' && scope.layout.plotType !== 'geo') {
                if(reRender) {
                    tween = tweenSetup('transition', renderableGraph);
                }
            }

            renderGraph(renderableGraph, tween, reRender, reLoad);
            console.groupEnd();
        }

        // Non tweening load
        function renderGraph (renderableGraph, tweenObj, reRender, reLoad) {
            if(__rendering_in_progress__) {
                console.error("Rendering is under progress!!");
                return;
            }
            var layout = scope.layout;
            var cam = sig.cameras.cam1;
            var layoutCam = layout.isGeo ? layout.getPointCamera() : layout.camera;
            var graph = filterOutNodes(renderableGraph.graph, SelectionSetService.hiddenDataPointIds());
            var camx = layoutCam.x, camy = layoutCam.y, camRatio = layoutCam.ratio;
            //
            // If data has changed, then center the camera to the center of snapshot
            //
            if(reRender) {
                console.log('[dirSigma]: Moving camera to (%f,%f)', layout.camera.x, layout.camera.y);
                cam.x = camx;
                cam.y = camy;
                cam.ratio = camRatio;
                console.assert(cam.ratio, "Camera ratio should exist");
            }
            console.log("CAMERA:(%f, %f, %f)", cam.x, cam.y, cam.ratio);
            console.log("Layout Ratio", layout.camera.ratio);

            // only re-render if the camera is updated
            if(reLoad) {
                console.log("Reloaded the rendergraph");
                sig.graph.clear();
                sig.graph.read(graph);
            }
            __rendering_in_progress__ = true;
            if(tweenObj) {
                tweenGraph(tweenObj, function() {
                    var tweenPrefix = tweenOpts.tweenPrefix;
                    if(tweenObj.restore) {
                        _.each(graph.nodes, function(node) {
                            node.x = node[tweenPrefix + 'x'];
                            node.y = node[tweenPrefix + 'y'];
                            node.size = node[tweenPrefix + 'size'];
                        });
                    }
                    renderG();
                });
            } else { renderG(); }
        }

        function tweenSetup (tweenType, rg) {
            var tween = null;
            if(tweenType === 'transition') {
                tween = tweenTransition(rg, sig.graph);
            }
            else if(tweenType === 'fromCenter') {
                tween = tweenFromCenter(rg);
            }
            else if(tweenType === 'randomly') {
                tween = tweenRandomly(rg);
            }
            else {
                console.log('No tween available');
            }
            return tween;
        }

        function tweenRandomly (renderGraph) {
            var tweenPrefix = tweenOpts.tweenPrefix;
            var leftEdge = $('#sig-holder').width() / 2;
            var bottomEdge = $('#sig-holder').height() / 2;
            _.each(renderGraph.graph.nodes, function(node) {
                node[tweenPrefix + 'x'] = node.x;
                node[tweenPrefix + 'y'] = node.y;
                node.x = _.random(-leftEdge, leftEdge);
                node.y = _.random(-bottomEdge, bottomEdge);
            });
            return {
                tweenSize : false,
                easing : sigma.utils.easings.quadraticOut,
                restore : true
            };
        }

        function tweenFromCenter (renderGraph) {
            var tweenPrefix = tweenOpts.tweenPrefix;
            _.each(renderGraph.graph.nodes, function(node) {
                node[tweenPrefix + 'x'] = node.x;
                node[tweenPrefix + 'y'] = node.y;
                node.x = 0;
                node.y = 0;
            });
            return {
                tweenSize : false,
                easing : sigma.utils.easings.quadraticOut,
                restore : true
            };
        }

        function tweenNodes(renderGraph, tweenInfo, postOp) {
            console.log("[dirSigma.tweenNodes]");
            var tweenSize = false;
            var tweenPrefix = tweenOpts.tweenPrefix;
            // make sure size tweening attribute exists
            _.each(renderGraph.nodes(), function(node) {
                if( node[tweenPrefix + 'size'] === undefined ) node[tweenPrefix + 'size'] = node.size;
            });
            // tween size and position of (a subset of) nodes
            _.each(tweenInfo, function(pos, id) {
                var node = renderGraph.getNodeWithId(id);
                tweenSize = tweenSize || (node[tweenPrefix + 'size'] != pos.size);
                node[tweenPrefix + 'x'] = pos.x;
                node[tweenPrefix + 'y'] = pos.y;
                node[tweenPrefix + 'size'] = pos.size;
            });
            var tweenObj = {
                tweenSize : tweenSize,
                easing : sigma.utils.easings.quadraticOut,
                restore : true
            };
            tweenGraph(tweenObj, function() {
                postOp();
                renderG();
            });
        }

        function tweenTransition (renderableGraph, sigGraph) {
            var newG = renderableGraph.graph;
            var getNode = sigGraph.nodes;
            var tweenPrefix = tweenOpts.tweenPrefix;
            console.assert(sigGraph.nodes().length > 0, 'Transition needs nodes to eixst in the current graph');
            // var layoutCam = scope.layout.camera;
            // for aggregates
            _.each(newG.nodes, function(newNode) {
                // the final positions are in tweenPrefix
                newNode[tweenPrefix + 'x'] = newNode.x;
                newNode[tweenPrefix + 'y'] = newNode.y;
                newNode[tweenPrefix + 'size'] = newNode.size;

                var existingNode = getNode(newNode.id);
                // if(!existingNode) {
                //     // came out of an aggregation
                //     var queryNodeId = newNode.id;
                //     if(newNode.isAggregation) {
                //         queryNodeId = newNode.aggregatedNodes[0].id;
                //     }
                //     existingNode = sigGraph.getParentAggrNode(queryNodeId);
                //     // This assert would not always work, because scatterplot of invalid data can generate nodes
                //     //  which do not exist in previous graph.
                //     //console.assert(existingNode, 'Parent aggr should exist for a new node');
                //     //existingNode = newNode;
                // }
                if(existingNode) {
                    newNode.x = existingNode.x;
                    newNode.y = existingNode.y;
                    newNode.size = existingNode.size;
                }
            });
            // if nothing has changed, then don't tween
            var maxDelta = {
                x: 1, y : 1, size : 1
            };
            _.each(newG.nodes, function(newNode) {
                var maxDeltax    = Math.abs(newNode[tweenPrefix + 'x'] - newNode.x),
                    maxDeltay    = Math.abs(newNode[tweenPrefix + 'y'] - newNode.y),
                    maxDeltasize = Math.abs(newNode[tweenPrefix + 'size'] - newNode.size);
                maxDelta.x    = maxDelta.x > maxDeltax ? maxDelta.x : maxDeltax;
                maxDelta.y    = maxDelta.y > maxDeltay ? maxDelta.y : maxDeltay;
                maxDelta.size = maxDelta.size > maxDeltasize ? maxDelta.size : maxDeltasize;
            });
            var hasChanged = maxDelta.x > 1 || maxDelta.y > 1 || maxDelta.size > 1;
            // if(!hasChanged) {
            //     console.log("[dirSigma] Graph hasn't changed sufficienty!!", maxDelta);
            // } else {
            //     console.log("[dirSigma] Graph has changed sufficienty!!", maxDelta);
            // }
            return hasChanged ? {
                tweenSize : true,
                easing : sigma.utils.easings.quadraticInOut,
                restore : true
            } : null;
        }

        function tweenGraph (tween, postOps) {
            var tweenTime = tweenOpts.tweenTime;
            var tweenPrefix = tweenOpts.tweenPrefix;
            var cam = sig.cameras.cam1;

            console.timeStamp('tweening setup');
            preTweenOpts(sig.settings, cam);
            renderGraphfactory.updateSettings(scope.mapprSettings);

            var tweenProps = {
                x: tweenPrefix + 'x',
                y: tweenPrefix + 'y'
            };
            if(tween.tweenSize) {
                tweenProps['size'] = tweenPrefix + 'size';
            }

            sigma.plugins.animate(sig, tweenProps, {
                duration: tweenTime,
                easing : tween.easing,
                onComplete: function() {
                    //Simply reload the whole graph.
                    if(scope.$$phase != '$apply' || scope.$$phase != '$digest') {
                        scope.$apply(function() {
                            onTweenComplete();
                        });
                    }
                    else {
                        onTweenComplete();
                    }

                    function onTweenComplete() {
                        postTweenOpts(sig.settings, cam);
                        postOps();
                        console.timeStamp('tweening onComplete');
                    }
                }
            });
        }

        function reProjectRenderedNodes (plotType, graph) {
            console.log("[reProjectRenderedNodes] ", plotType, graph);
            var r = renderGraphfactory.getRenderer();
            var prefix = renderGraphfactory.getRendererPrefix();
            var width_by_2 = (r.width / 2), height_by_2 = (r.height / 2);

            var layoutCam = scope.layout.isGeo ? scope.layout.getPointCamera() : scope.layout.camera;
            var ratio = scope.layout.isGeo ? 1 : scope.layout.camera.ratio || 1;
            var camx = layoutCam.x;
            var camy = layoutCam.y;
            // reproject from geo to sigma
            _.each(graph.nodes(), function(node) {
                node.x =  (node[prefix  + 'x'] - width_by_2) * ratio + camx;
                node.y =  (node[prefix  + 'y'] - height_by_2) * ratio + camy;
                node.size = node.size;
            });
        }

        /**
         * Sets mapprSettings into Sigma and renders it.
         */
        function renderG() {
            __rendering_in_progress__ = true;
            var timestart = Date.now();
            console.log('[dirSigma.renderG] Render graph started');
            renderGraphfactory.updateSettings(scope.mapprSettings);
            // Make sure selections are updated
            graphSelectionService.updateNodeSelState(sig.graph.nodes());
            updateSelectionIndices();
            tagService.runStrat();
            sig.refresh();
            console.log('[dirSigma.renderG] Render graph finish: %i', Date.now()-timestart);
            if(sig.graph.nodes().length > 0) {
                $rootScope.$broadcast(BROADCAST_MESSAGES.sigma.rendered, sig);
            }
            __rendering_in_progress__ = false;
        }

        function preTweenOpts(settings, cam) {
            settings('tweening', true);
            settings('eventsEnabled', false);
            settings('mouseEnabled', false);
            cam.isAnimated = true;
        }

        function postTweenOpts (settings, cam) {
            settings('tweening', false);
            settings('eventsEnabled', true);
            settings('mouseEnabled', true);
            cam.isAnimated = false;
            tweenOpts.tweenTime = 750;
        }

        function updateSelectionIndices () {
            graphSelectionService.clearSelectionCaches();
            graphSelectionService._selectNodes(_.filter(sig.graph.nodes(), 'isSelected'), 0, inputMgmtService.inputMapping().clickNode);
        }

        function filterOutNodes(graph, dataPointIds) {
            if(dataPointIds.length == 0) {
                return graph;
            }

            var rejectionIdx = _.reduce(dataPointIds, function(acc, dpId) {
                acc[dpId] = true;
                return acc;
            }, {});
            var nodes = _.reduce(graph.nodes, function(acc, node) {
                if(!rejectionIdx[node.dataPointId]) {
                    acc.push(node);
                }
                return acc;
            }, []);
            var nodeIdx = _.indexBy(nodes, 'id');
            var edges = _.reduce(graph.edges, function(acc, edge) {
                if(nodeIdx[edge.source] && nodeIdx[edge.target]) {
                    acc.push(edge);
                }
                return acc;
            }, []);
            return {
                nodes : nodes,
                edges : edges,
                nodeIndex : nodeIdx
            };
        }

        //function disableLabelDiv () {
        //    $('.sigma-d3-labels', element).hide();
        //}
        //function enableLabelDiv () {
        //    $('.sigma-d3-labels', element).show();
        //}


        function cleanup() {
            console.group('[dirSigma.$on event $destroy]');
            console.log("dirSigma destroyed");
            if(sig){
                sigmaBridge.dismantle();
                sigmaBridge = null;
                sig = null;
                renderGraphfactory.sigKill();
            }
            console.groupEnd();
        }

    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}]);
