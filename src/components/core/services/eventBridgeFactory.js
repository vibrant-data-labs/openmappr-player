angular.module('common')
.service('eventBridgeFactory', ['$q','$timeout', 'renderGraphfactory', 'inputMgmtService', 'graphHoverService','graphSelectionService', 'hoverService', 'selectService', 'subsetService',
function ($q, $timeout, renderGraphfactory, inputMgmtService, graphHoverService, graphSelectionService, hoverService, selectService, subsetService) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.AngularLeaflet2Sigma = AngularLeaflet2Sigma;
    this.Sigma2Angular = Sigma2Angular;


    /*************************************
    ********* Local Data *****************
    **************************************/
    var hoverTimer;
    var hoverNodes;


    /*************************************
    ********* Core Functions *************
    **************************************/
    function safeApply ($scope, fn) {
        var phase = $scope.$root.$$phase;
        if (phase === '$apply' || phase === '$digest') {
            $scope.$eval(fn);
        } else {
            $scope.$apply(fn);
        }
    }

    function sigmaEventHandler (name, data) {
        var inputMap = {
            //'click'            : clickHandler,
            'clickStage'       : clickHandler,
            'doubleClickStage' : doubleClickHandler,
            //'clickNode'        : clickHandler,
            'clickNodes'       : clickHandler,
            // 'highlightNodes'       : highlightHandler,
            //'doubleClickNode'  : doubleClickHandler,
            'doubleClickNodes' : doubleClickHandler,
            //'overNode'         : hoverInHandler,
            'overNodes'        : hoverInHandler,
            //'outNode'          : hoverOutHandler,
            'outNodes'         : hoverOutHandler
        };
        //console.assert(inputMap[name], '[inputMgmtService] Mapping from name -> handler should exist.');
        if(inputMap[name]) {
            inputMap[name](name, data);
        }
    }

    // get top (last drawn) node from an array of hovered nodes
    function _getTopNode(nodes) {
        var currentSubset = subsetService.currentSubset();
        var subsettedNodes = currentSubset && currentSubset.length ?
            _.filter(nodes, function (n) { return (currentSubset.indexOf(n.id) > -1) || n.inHover; }) : nodes;

        var sortFunc = function (n1, n2) { 
            var weightN1 = 0;
            var weightN2 = 0;
            if (sigma) {
                weightN1 = sigma.d3.labels.selectOrder(n1);
                weightN2 = sigma.d3.labels.selectOrder(n2);
            }
            return weightN1 == weightN2 ? (n2.idx - n1.idx) : (weightN2 - weightN1); 
        }
        if (subsettedNodes.length > 0) {
            subsettedNodes.sort(sortFunc);
            return subsettedNodes[0];
        }

        return null;
    }

    function hoverInHandler (name, event) {
        var _node = inputMgmtService.inputMapping().hoverNode;
        var hoverFn = function() {
            var topNode = _getTopNode(hoverNodes);
            if (topNode) {
                event.data.allNodes = [topNode];    // pass top node through
                hoverService.hoverNodes({ ids: _.pluck([topNode], 'id'), withNeighbors: true });
                hoverTimer = undefined;
                hoverNodes = undefined;
            }
        };

        if(hoverTimer !== undefined) {
            clearTimeout(hoverTimer);
            hoverNodes = _.union(hoverNodes, event.data.nodes);
        } else {
            hoverNodes = event.data.nodes;
        }
        hoverTimer = setTimeout(hoverFn, 100);
    }

    function hoverOutHandler (name, event) {
        if(hoverTimer !== undefined ) {
            var temp = event.data.nodes.slice();  // clone nodes to remove
            temp.unshift(hoverNodes);   // copy hoverNodes to start of array
            hoverNodes = _.without.apply(this, temp);   // remove unhovered nodes
            if(hoverNodes.length === 0) {
                clearTimeout(hoverTimer);
                hoverTimer = undefined;
                hoverNodes = undefined;
            }
        }
        
        var topNode = _getTopNode(event.data.nodes);
        if (topNode) {
            event.data.nodes = [topNode];
        }
        hoverService.unhover();
    }

    function clickHandler (name, event) {
        var settings = renderGraphfactory.getRenderer().settings;
        if(name === 'clickNodes') {
            // event.data.node = event.data.all ? event.data.node : [_getTopNode(event.data.node)];
            if(settings('isShiftKey') || event.shiftKey) {
                event.shiftKey = true;
                settings('isShiftKey', false);
            }
            
            if (event.data.all) {
                selectService.selectNodes({ attr: settings('nodeClusterAttr'), value: event.data.labelId });
            }
            else {
                var topNode = _getTopNode(event.data.node);
                if (topNode) {
                    selectService.selectSingleNode(topNode.id);
                }
            }
        } else {
            selectService.unselect();
            hoverService.unhover();
        }
    }
    function doubleClickHandler (name, event) {
        if(name === 'doubleClickNodes') {
            //graphSelectionService.clickNodesHander(name, event, inputMgmtService.inputMapping().clickNode);
        } else {
            //graphSelectionService.clickStageHander(name, event, inputMgmtService.inputMapping().clickStage);
            hoverService.unhover();
        }
    }
    /**
     * opts -> object containing event:function(map,sigma) mapping
    */
    function AngularLeaflet2Sigma(options) {
        var self = this;
        var prefix = 'leafletDirectiveMap.';
        var events = ['zoomstart', 'drag', 'viewreset', 'resize'];
        //var events = ['zoomstart', 'drag','dragend', 'viewreset', 'resize'];
        var mouseEvents = ['click', 'mouseup','mousemove', 'mouseout', 'dblclick'];
        var opts = options || {};

        this.updateOpts = function(newOpts) {
            opts = _.assign(opts,newOpts);
        };
        //Update sigma graph
        function callEventHooks(eventName,map,sig) {
            if (opts[eventName]) {
                opts[eventName](sig, {eventName:eventName});
            }
        }

        this.build = function(scope, map, sig) {
            console.log('[eventBridgeFactory] Binding events');
            var deregisters = [];
            _.each(mouseEvents, function(eventName) {
                deregisters.push(scope.$on(prefix + eventName, function(e, data) {
                    //callEventHooks(data.leafletEvent.type, map, sig);
                    renderGraphfactory.getRenderer().dispatchEvent(e.name, data.leafletEvent);
                }));
            });
            _.map(events, function(eventName) {
                deregisters.push(scope.$on(prefix + eventName, function(e, data) {

                    callEventHooks(data.leafletEvent.type, map, sig);

                    if(e.name === prefix + 'zoomstart') {

                        //sig.settings('drawEdges', false);
                        //sig.settings('drawNodes', false);
                        //sig.settings('drawLabels', false);
                        _.each(sig.renderers,function(r) {
                            r.clear({
                                leafletEvent:data.leafletEvent
                            });
                        });
                    } else if(e.name  === prefix + 'drag') {
                        sig.renderCamera(sig.cameras.cam1);
                    } else {
                        //sig.settings('drawEdges', true);
                        //sig.settings('drawNodes', true);
                        //sig.settings('drawLabels', true);
                        sig.refresh();
                    }
                }));
            });
            self.deregisters = deregisters;
        };
        this.dismantle = function() {
            _.each(self.deregisters,function(dreg) {
                dreg();
            });
        };
        this.opts = opts;
        this.events = mouseEvents.concat(events);
    }

    function Sigma2Angular (options) {
        var self = this;
        var prefix = 'sigma.';
        var events = [
            //'click',
            'clickStage',
            'doubleClickStage',
            'clickNode',
            'clickNodes',
            'doubleClickNode',
            'doubleClickNodes',
            //'overNode',
            'overNodes',
            //'outNode',
            'outNodes'
            //'downNode',
            //'downNodes',
            //'upNode',
            //'upNodes'
        ];

        function build (scope, sig, emit) {
            var deregisters = [];
            var func = emit ? "$emit" : "$broadcast";
            //generic events
            _.each(events, function(event) {
                sig.bind(event, function(data) {
                    safeApply(scope, function() {
                        sigmaEventHandler(event, data, scope);
                        $timeout(function() {
                            //deregisters.push(scope[func](prefix + event, data));
                            scope[func](prefix + event, data);
                        });
                    });
                });
            });
            self.deregisters = deregisters;
        }

        this.build = build;
        this.prefix = prefix;
        this.events = events;
        this.options = options || {};
        this.dismantle = function() {
            _.each(self.deregisters,function(dreg) {
                if(typeof dreg === "function") { dreg(); }
            });
        };
    }

}
]);