angular.module('common')
.controller('NodePopCtrl', ['$rootScope','$scope', '$timeout', 'BROADCAST_MESSAGES', 'renderGraphfactory', 'repositionService', 'graphSelectionService', 'graphHoverService', 'zoomService',
function($rootScope, $scope, $timeout, BROADCAST_MESSAGES, renderGraphfactory, repositionService, graphSelectionService, graphHoverService, zoomService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var disableNextHover = false;
    var camPrefix = renderGraphfactory.getRenderer().options.prefix;
    var hoverNeighbor = false;
    var savedNodeInfo = null;
    var savedSelection = [];
    var isNeighborsSelected = false;
    var inOverlay = false;
    var popTimer;
    var hoverTimer;
    var hoverNodes;

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.showNodePop = false;
    $scope.nodeStartData = null;
    $scope.nodeEndData = null;
    $scope.nodeImageAttr = null;
    $scope.bufferSize = 40;

    /**
    * Scope methods
    */
    $scope.leavePop = leavePop; //leave pop after mouse moves off of buffer area or node is clicked
    $scope.clickPop = clickPop;




    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.sigma.overNodes, onSigmaOverNodes);

    $scope.$on(BROADCAST_MESSAGES.sigma.outNode, function(){
        console.log("[ctrlNodePop] on outNode, hoverNeighbor = " + hoverNeighbor);
        if( !hoverNeighbor ) {
            clearPendingHover();
        }
    });

    $scope.$on(BROADCAST_MESSAGES.nodeOverlay.creating, function() {
        console.log("[ctrlNodePop] create overlay");
        clearPendingHover();
        inOverlay = true;
    });

    $scope.$on(BROADCAST_MESSAGES.nodeOverlay.removing, function() {
        console.log("[ctrlNodePop] remove overlay");
        inOverlay = false;
        disableNextHover = true;
    });

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function overNodesHelper(){
        var delay = $scope.mapprSettings.nodePopDelay;
        var pos, neighbor, pop;
        // get top (last drawn) node from an array of hovered nodes
        function getTopNode(nodes) {
            nodes.sort(function(n1, n2) {   // sort by drawing order, last on top
                if((n1.inPop && n2.inPop) || (!n1.inPop && !n1.inPop)) {
                    var order1 = graphHoverService.selectOrder(n1), order2 = graphHoverService.selectOrder(n2);
                    if(order1 == order2) {
                        // sort by size
                        return n2.idx - n1.idx;
                    } else {
                        return order1 - order2;
                    }
                } else if(n1.inPop) {
                    return 1;
                }
                return -1;
            });
            return nodes[nodes.length-1];
        }
        // called when done animating neighbors
        function doneFn() {
            console.log("[ctrlNodePop] doneFn, hoverNeighbor = " + hoverNeighbor);
            graphSelectionService.selectByIds(pop.id);
            popTimer = $timeout(hoverFn, delay);
        }
        function hoverFn() {
            console.log("[ctrlNodePop] hoverFn popid: " + pop.id);
            if(!hoverNeighbor) {
                savedSelection = graphSelectionService.getSelectedNodes();
                isNeighborsSelected = savedSelection.length != graphSelectionService.selectedNodesAndNeighbors().length;
            }
            // kill graph interactions (until rolled off) and set selection
            // do this before starting tween
            $scope.nodeOverlayProps.enabled = false;
            showNodePop(pos, pop, postTween);
            hoverNeighbor = false;
            hoverTimer = undefined;
            hoverNodes = undefined;
        }
        function hoverNeighborFn() {
            console.log("[ctrlNodePop] hoverNeighborFn id " + neighbor.id);
            if(!savedNodeInfo) {
                return;
            }
            var pos = savedNodeInfo.pos[neighbor.id];
            var panx = pos.x - neighbor.x;
            var pany = pos.y - neighbor.y;
            $scope.showNodePop = false;
            pop = neighbor;
            $timeout(function() {
                restoreNeighbors(true);
                $scope.focusNode.inPop = false;     // release pop so label is drawn normal-size
                zoomService.panCamera(panx, pany, doneFn);
            });
        }

        var node = getTopNode(hoverNodes);
        console.log("[ctrlNodePop] overNodes " + hoverNodes.length + " id: " + node.id);

        var postTween = function() {
            console.log("[ctrlNodePop] postTween popid: " + pop.id);
            graphSelectionService.selectByIds(pop.id);
            // enable overlay click on hovered neighbor
            // causes problems in reposition when leave overlay
            //$scope.nodeOverlayProps.enabled = true;
        };

        // in case tween reveals a different node underneath
        if( $scope.mapprSettings.tweening ) {console.log("Exit - tweening"); hoverNodes = undefined; return;}
        // suppress overnode call if animating to hovered neighbor
        if(hoverNeighbor) {console.log("Exit - neighbor"); hoverNodes = undefined; return;}
        // suppress repeated overNode call
        if( node.inPop && node == $scope.focusNode ) {console.log("Exit - repeated call"); hoverNodes = undefined; return;}
        //reject rollover of non-neighbor inside pop area
        if( $scope.focusNode && $scope.focusNode.inPop && !node.inPop) {console.log("Exit - non-neighbor"); hoverNodes = undefined; return;}

        $timeout.cancel(popTimer);
        if($scope.mapprSettings.nodePopTriggerContext !== 'hover'
            || !$scope.mapprSettings.nodePopShow) return;
        if(disableNextHover) {
            //in case zoom wasn't fired
            //TODO: revisit
            disableNextHover = false;
            return;
        }

        hoverNeighbor = savedNodeInfo !== null && node.inPop && node.inPop.neighbor;
        if( hoverNeighbor ) {
            console.log("[ctrlNodePop] set timer on hoverNeighborFn");
            neighbor = node;
            popTimer = $timeout(hoverNeighborFn, delay);
        } else {
            console.log("[ctrlNodePop] set timer on hoverFn");
            pop = node;
            pos = undefined;
            popTimer = $timeout(hoverFn, delay);
        }
    }

    function clearPendingHover() {
        $timeout.cancel(popTimer);
        $timeout.cancel(hoverTimer);
        hoverTimer = undefined;
        hoverNodes = undefined;
    }

    function onSigmaOverNodes(e, data){
        if(inOverlay) {
            clearPendingHover();
            return;
        }
        if(hoverTimer !== undefined) {
            $timeout.cancel(hoverTimer);
            hoverNodes = _.union(hoverNodes, data.data.nodes);
        } else {
            hoverNodes = data.data.nodes;
        }
        hoverTimer = $timeout(overNodesHelper, 200);
    }

    function leavePop(clicked) {
        var restoreSelection = function() {
            if(savedSelection.length !== 0) {
                if(isNeighborsSelected) {
                    graphSelectionService.selectNodes(savedSelection, 1);
                } else {
                    graphSelectionService.selectNodes(savedSelection, 0);
                }
            }
            savedSelection = [];
            console.log("Selection restored");
        };

        console.log('leaving pop');
        clearPendingHover();
        if( $scope.showNodePop ) {
            $scope.showNodePop = false;
            var restored = restoreNeighbors(false);
            if($scope.focusNode)
                $scope.focusNode.inPop = undefined;
            if(!clicked) {
                if( restored ) {
                    var x = $rootScope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
                        restoreSelection();
                        x();
                    });
                }
                console.log("savedSelection: ", savedSelection)
                if(savedSelection.length == 0) {
                    graphSelectionService.clearSelections(true);
                    console.log('broadcasting select stage');
                    $rootScope.$broadcast(BROADCAST_MESSAGES.selectStage);
                }
            }
            $scope.nodeOverlayProps.enabled = true;
            hoverNeighbor = false;
            if(!restored && !clicked) {
                restoreSelection();
            }
        }
    }

    function clickPop() {
        console.log('click pop');
        $scope.leavePop(true);
        $timeout(function() {
            graphSelectionService.disableRendering();
            graphSelectionService.selectByIds($scope.focusNode.id);
            graphSelectionService.enableRendering();
        });
    }

    function showNodePop(pos, n, postTween) {
        var newSz = $scope.mapprSettings.nodePopSize * n[camPrefix + 'size'];
        var scale = newSz / n[camPrefix + 'size'];
        var zoomScale = n[camPrefix + 'size']/n.size;
        $scope.focusNode = n;

        //get start pos and size for start for focus node
        $scope.nodeStartData = {
            x: n[camPrefix + 'x'],
            y: n[camPrefix + 'y'],
            size: n[camPrefix + 'size']
        };

        $scope.nodeEndData = {
            x: n[camPrefix + 'x'],
            y: n[camPrefix + 'y'],
            size: newSz
        };

        $scope.nodeLabel = $scope.focusNode.attr[$scope.mapprSettings.labelHoverAttr];
        $scope.nodeImageAttr =  $scope.mapprSettings.nodePopImageAttr || $scope.mapprSettings.nodeImageAttr;
        $scope.showNodePop = true;
        $scope.focusNode.inPop = {};

        popNeighbors(pos, scale, zoomScale, postTween);
        // set buffer, include padding beyond outermost node
        $scope.bufferSize = 2*zoomScale * (savedNodeInfo ? savedNodeInfo.maxR : 0);
    }

    function restoreNeighbors(keepPop) {
        if(savedNodeInfo) {
            console.log("restoreNeighbors of node " + savedNodeInfo.node.id);
            if(!keepPop) {  // keep pop state if moving to neighbor
                savedNodeInfo.node.inPop = undefined;
            }
            repositionService.undoRepositioning(savedNodeInfo.pos, _.noop);
            savedNodeInfo = null;
            return true;
        }
        return false;
    }

    // pop neighbors either to node's current position or to different position
    function popNeighbors(pos, scale, zoomScale, postOp) {
        var info = savedNodeInfo;
        if($scope.mapprSettings.nodePopRepositionNeighbors && (!info || info.node !== $scope.focusNode)) {
            restoreNeighbors();
            info = repositionService.popNeighbors($scope.focusNode, pos ? pos : $scope.focusNode, scale, zoomScale, postOp);
            savedNodeInfo = {
                node: $scope.focusNode,
                pos: info.pos,
                maxR: info.maxR
            };
        } else {
            postOp();
        }
    }

}
]);
