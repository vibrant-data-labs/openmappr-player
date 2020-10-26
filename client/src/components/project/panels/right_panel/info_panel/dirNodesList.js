angular.module('common')
.directive('dirNodesList', ['BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService', 'FilterPanelService', 'layoutService',
function(BROADCAST_MESSAGES, hoverService, selectService, subsetService, FilterPanelService, layoutService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirSelectionInfo',
        scope: {
            nodes: '=',
            links: '=',
            labelAttr: '=',
            nodeColorAttr: '=',
            nodeColorAttrTitle: '=',
            panelMode: '=',
            selectedGroups: '=',
            sortTypes: '=',
            sortInfo: '=',
        },
        templateUrl: '#{player_prefix_index}/components/project/panels/right_panel/info_panel/nodesList.html',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    // var logPrefix = 'dirNodesList: ';
    var ITEMS_TO_SHOW = 100;
    var ITEMS_TO_SHOW_INITIALLY = 20;


    /*************************************
    ******** Controller Function *********
    **************************************/

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, elem, attrs, parCtrl) {

        var memoizedGetFunctionColor = _.memoize(getFunctionColor);

        scope.nodeSearchQuery = '';
        scope.numShowGroups = 0;
        scope.viewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.nodes.length);

        scope.singleNode = selectService.singleNode;

        var hasSelection = selectService.getSelectedNodes() && selectService.getSelectedNodes().length;
        var hasSubset = subsetService.currentSubset() && subsetService.currentSubset().length;

        if (hasSubset && hasSelection) {
            scope.nodesStatus = 'Nodes selected';
            scope.linksStatus = 'Links selected';
        } else if (hasSubset) {
            scope.nodesStatus = 'Nodes subset';
            scope.linksStatus = 'Links subset';
        } else if(hasSelection) {
            scope.nodesStatus = 'Nodes selected';
            scope.linksStatus = 'Links selected';
        } else {
            scope.nodesStatus = 'Total nodes';
            scope.linksStatus = 'Total links';
        }

        layoutService.getCurrent().then(function (layout) {
            scope.layout = layout;
        });

        scope.$watch('nodes', function() {
            scope.viewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.nodes.length);
        });

        scope.viewMore = function() {
            if(scope.viewLimit < scope.nodes.length) {
                // scope.viewLimit += Math.min(minViewCount, scope.nodes.length - scope.viewLimit);
                scope.numShowGroups++;
                scope.viewLimit = Math.min(scope.nodes.length, scope.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY);
            }
        };

        scope.viewLess = function() {
            scope.numShowGroups = 0;
            scope.viewLimit = Math.min(ITEMS_TO_SHOW_INITIALLY, scope.nodes.length);
        };

        scope.selectNode = function(nodeId, $event) {
            hoverService.unhover();
            selectService.selectSingleNode(nodeId);
        };

        scope.hoverNode = function(nodeId) {
            hoverNodes([nodeId]);
        };

        scope.unHoverNode = function(nodeId) {
            unHoverNodes([nodeId]);
        };

        scope.selectGroup = function(group) {
            selectService.selectNodes({ attr: group.attr, value: group.name});
        };

        scope.hoverGroup = function(group) {
            hoverNodes(_.map(group.nodes, 'id'));
        };

        scope.unHoverGroup = function(group) {
            unHoverNodes(_.map(group.nodes, 'id'));
        };

        scope.filterNode = function(node) {
            if (!scope.nodeSearchQuery) { return true; }
            var regex = new RegExp(scope.nodeSearchQuery, 'gi');
            return node.attr[scope.labelAttr].match(regex);
        };

        scope.getNodeTooltipHtml = function(node) {
            var html = '<ul class="list-unstyled">';
            var attrTitle = _.get(_.find(scope.sortTypes, 'id', scope.sortInfo.sortType), 'title', '');
            var attrVal = node.attr[scope.sortInfo.sortType];
            if (_.isNumber(attrVal) && !Number.isInteger(attrVal)) { attrVal = attrVal.toFixed(2); }
            html += '<li><b>Name: ' + '</b> ' + node.attr[scope.labelAttr] + '</li>';
            // Don't duplicate 'Name' as it is always displayed as first property in tooltip info
            if (attrTitle !== 'Name') {
                html += '<li><b>' + _.startCase(attrTitle) + '</b> ' + attrVal + '</li>';
            }
            html += '</ul>';
            return html;
        };

        scope.getNodeColor = function(node) {
            if (scope.layout && node && node.attr && node.attr[scope.nodeColorAttr]) {
                return memoizedGetFunctionColor(node.attr[scope.nodeColorAttr]);
            }
        }

        scope.getGroupColor = function(groupName) {
            if (scope.layout) {
                return memoizedGetFunctionColor(groupName);
            }
        }

        scope.$on(BROADCAST_MESSAGES.hss.select, function(ev, data) {
            if (data.filtersCount > 0) {
                scope.nodesStatus = 'Nodes selected';
                scope.linksStatus = 'Links selected';
            } else if (data.isSubsetted) {
                scope.nodesStatus = 'Nodes subset';
                scope.linksStatus = 'Links subset';
            } else {
                scope.nodesStatus = 'Total nodes';
                scope.linksStatus = 'Total links';
            }

            if (data.nodes.length == 1) {
                scope.singleNode = data.nodes[0];
            } else {
                scope.singleNode = null;
            }
        })

        function getFunctionColor(cluster) {
            return d3.rgb(scope.layout.scalers.color(cluster)).toString();
        }

        function hoverNodes(nodeIds) {
            parCtrl.persistSelection();
            hoverService.hoverNodes({ ids: nodeIds });
        }

        function unHoverNodes(nodeIds) {
            hoverService.unhover();
            if (scope.selectedGroup != undefined) hoverNodes(scope.selectedGroup);
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/


    return dirDefn;
}
]);
