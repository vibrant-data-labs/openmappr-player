angular.module('common')
.directive('dirNodesList', ['BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService', 'FilterPanelService', 'layoutService', '$timeout',
function(BROADCAST_MESSAGES, hoverService, selectService, subsetService, FilterPanelService, layoutService, $timeout) {
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
            searchQuery: '='
        },
        templateUrl: '#{player_prefix_index}/components/project/panels/right_panel/info_panel/nodesList.html',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    // var logPrefix = 'dirNodesList: ';


    /*************************************
    ******** Controller Function *********
    **************************************/

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, elem, attrs, parCtrl) {

        var memoizedGetFunctionColor = _.memoize(getFunctionColor);

        scope.singleNode = selectService.singleNode;
        scope.isShowInfo = false;

        var hasSelection = selectService.getSelectedNodes() && selectService.getSelectedNodes().length;
        var hasSubset = subsetService.currentSubset() && subsetService.currentSubset().length;

        scope.PanelListInfo = {
            name: '',
            photo: '',
            description: '',
            tags: []
        }

        scope.$watch('sortInfo.sortType', function() {
            if (scope.singleNode) {
                $timeout(function() {
                    scrollTo(scope.singleNode.id);
                }, 400);
            }
        });
        scope.$watch('sortInfo.sortOrder', function() {
            if (scope.singleNode) {
                $timeout(function() {
                    scrollTo(scope.singleNode.id);
                }, 400);
            }            
        });

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

        scope.selectNode = function(node, $event) {
            hoverService.unhover();
            selectService.selectSingleNode(node.id);
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
            if (!scope.searchQuery) { return true; }
            var regex = new RegExp(scope.searchQuery, 'gi');
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

        scope.getHighlightColor = function(node) {
            if (scope.layout && node && node.attr && node.attr[scope.nodeColorAttr]) {
                var color = memoizedGetFunctionColor(node.attr[scope.nodeColorAttr]) + 60;
                return color;
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
                scrollTo(scope.singleNode.id);
            } else {
                scope.singleNode = null;
            }
        })

        function getFunctionColor(cluster) {
            return d3.rgb(scope.layout.scalers.color(cluster)).toString();
        }

        scope.debounceHoverNode = _.debounce(hoverNodes, 300);

        function hoverNodes(node) {
            scope.isShowInfo = true;
            setPanelInfo(node);

            parCtrl.persistSelection();
            hoverService.hoverNodes({ ids: node.id });
        }

        function unHoverNodes(nodeIds) {
            scope.isShowInfo = false;
            hoverService.unhover();
            if (scope.selectedGroup != undefined) hoverNodes(scope.selectedGroup);
        }

        function setPanelInfo (node) {
            scope.PanelListInfo = {
                name:  node.attr[scope.labelAttr],
                photo: node.attr.Photo,
                description: node.attr.Description || node.attr.Education,
                tags: node.attr.Keywords
            }
        }
        function scrollTo(id) {
            var $scrollTo = angular.element('#item-' + id);
            var $container = angular.element('#info-panel-scroll');
            $container.animate({scrollTop: $scrollTo.offset().top - $container.offset().top + $container.scrollTop()}, "slow");
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/


    return dirDefn;
}
]);
