angular.module('common')
.directive('dirNeighborNodes', ['graphSelectionService', 'hoverService', 'linkService', 'dataGraph', 'zoomService', 'FilterPanelService',
function(graphSelectionService, hoverService, linkService, dataGraph, zoomService, FilterPanelService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        templateUrl: '#{player_prefix_index}/components/project/panels/right_panel/info_panel/neighborNodes.html',
        scope: {
            nodeNeighbors: '=',
            linkInfoAttrs: '='
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var ITEMS_TO_SHOW = 100;
    var ITEMS_TO_SHOW_INITIALLY = 10;


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        scope.neighborSearchQuery = '';

        // sort model
        scope.neighborsSort = '';



        // Sort types for neighbor sort menu
        scope.sortTypes = getSortTypesForSelectedNodes(scope.linkInfoAttrs);

        // Sort info object used to create sort model string
        scope.sortInfo = {
            sortType: _.find(scope.sortTypes, 'id', 'similarity') ? 'similarity' : scope.sortTypes[0].id,
            sortOrder: 'desc'
        };

        scope.setNeighborSort = setNeighborSort;
        scope.comparator = comparator;
        scope.numShowGroups = 0;
        scope.viewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.nodeNeighbors.length);

        scope.setNeighborSort();

        //if click on neighbor in list of nodeNeighbors
        scope.selectNode = selectNode;

        scope.$watch('sortInfo', function(sortInfo) {
            console.log('dirNeighborNodes: sortInfo', sortInfo);
            scope.setNeighborSort();
        }, true);

        scope.viewMore = function() {
            if(scope.viewLimit < scope.nodeNeighbors.length) {
                scope.numShowGroups++;
                scope.viewLimit = Math.min(scope.nodeNeighbors.length, scope.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY);
            }
        };

        scope.viewLess = function() {
            scope.numShowGroups = 0;
            scope.viewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.nodeNeighbors.length);
        };

        scope.addNeighborsToSelection = function() {
            var nids = _.pluck(graphSelectionService.getSelectedNodeNeighbours(), 'id');
            graphSelectionService.selectByIds(nids, 0);
            FilterPanelService.rememberSelection(false);
        };

        scope.hoverNode = function(nodeId) {
            hoverService.hoverNodes({ ids: [nodeId] });
        };

        scope.unHoverNode = function(nodeId) {
            hoverService.unhover()
        };

        scope.getNeighborInfoHtml = function(neighbor) {
            try {
                var sortAttrs = _.filter(dataGraph.getNodeAttrs(), {isNumeric: true, visible: true}) || [];
            } catch (e){
                var sortAttrs = []; 
            }

            sortAttrs = sortAttrs.concat(scope.linkInfoAttrs);

            var html = '<ul class="list-unstyled" style="margin-bottom: 0">';
            if (_.isEmpty(sortAttrs)) {
                return '';
            }
            _.each(sortAttrs, function(attr) {
                var attrId = attr.id;
                var attrVal = getNeighborAttributeValue(attrId, neighbor);
                if (_.isNumber(attrVal) && !Number.isInteger(attrVal)) {
                    attrVal = attrVal.toFixed(2);
                }

                var attrLabel =
                attrId !== 'label' ? _.startCase(attr.title) : 'Name';
                html += '<li><b>' + attrLabel + ':</b> ' + attrVal + '</li>';
            });

            html += '</ul>';
            return html;
        };

        function getNeighborAttributeValue(attrId, neighbor) {
            if (!attrId) {
                return '';
            }

            if (typeof neighbor[attrId] !== 'undefined') {
                return neighbor[attrId];
            }

            if (typeof neighbor.attr[attrId] !== 'undefined') {
                return neighbor.attr[attrId];
            }

            return '';
        }

        function setNeighborSort() {
            // if (scope.nodeNeighbors.length > 0) {
            //     if (scope.nodeNeighbors[0].attr && scope.nodeNeighbors[0].attr.hasOwnProperty(neighborsSort)) {
            //         scope.neighborsSort = 'attr.' + neighborsSort;
            //     } else if (scope.nodeNeighbors[0].hasOwnProperty(neighborsSort)) {
            //         scope.neighborsSort = neighborsSort;
            //     }
            // } else {
            //     scope.neighborsSort = neighborsSort;
            // }

            if (scope.sortInfo.sortOrder === 'desc') {
                scope.order = true;
            } else {
                scope.order = false;
            }

            scope.neighborsSort = comparator;
        }

        function comparator(v1, v2) {
            if (!v1.value || !v2.value) {
                return 0;
            }
            
            var value1 = v1.value[scope.sortInfo.sortType] || (v1.value.attr && v1.value.attr[scope.sortInfo.sortType]);
            var value2 = v2.value[scope.sortInfo.sortType] || (v2.value.attr && v2.value.attr[scope.sortInfo.sortType]);

            if (typeof value1 === 'string') {
                return value1.localeCompare(value2);
            } else if (typeof value1 === 'number') {
                if (value1 == value2) {
                    return 0;
                }

                return (value1 < value2) ? -1 : 1; 
            }

            return 0;
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/
    function selectNode(id) {
        graphSelectionService.runFuncInCtx(function() {
            graphSelectionService.selectByIds(id, 1);
            zoomService.centerNode(_.first(graphSelectionService.getSelectedNodes()));
        }, true, true);
        FilterPanelService.rememberSelection(false);
    }

    function getSortTypesForSelectedNodes(linkInfoAttrs) {
        var sortTypes = [];
        var sortAttrs = _.filter(dataGraph.getNodeAttrs(), {isNumeric: true, visible: true});

        sortTypes = _.map(linkInfoAttrs, function(attr) {
            return {
                id: attr.id,
                title: attr.title
            };
        });
        sortTypes.push({
            id: 'label',
            title: 'Name'
        });

        return sortTypes.concat(_.map(sortAttrs, function(attr) {
            return {
                id: attr.id,
                title: attr.title
            };
        }));
    }


    return dirDefn;
}
]);
