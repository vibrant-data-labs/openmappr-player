angular.module('common')
.directive('dirNodesList', ['BROADCAST_MESSAGES', 'playerFactory', 'hoverService', 'selectService', 'subsetService', 'FilterPanelService', 'layoutService', '$timeout',
function(BROADCAST_MESSAGES, playerFactory, hoverService, selectService, subsetService, FilterPanelService, layoutService, $timeout) {
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
            searchQuery: '=',
            hasSelection: '='
        },
        templateUrl: '#{player_prefix_index}/components/project/panels/right_panel/info_panel/nodesList.html',
        link: postLinkFn
    };

    const MAX_TOOLTIP_STRING_LENGTH = 400;

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
        scope.isDisplayTooltip = false;
        scope.filteredNodes = scope.nodes;

        playerFactory.getPlayerLocally().then(function(resp) {
            const isFalsy = (val) => val === undefined || val === null;
            const displayTooltipCard = resp.player.settings.displayTooltipCard;
            scope.isDisplayTooltip = isFalsy(displayTooltipCard) ? true : displayTooltipCard;
        })

        scope.hasSelection = selectService.getSelectedNodes() && selectService.getSelectedNodes().length;
        scope.isShowTooltip = false;
        scope.isShowMoreTextTooltip = false;
        scope.isShowMoreTagsTooltips = false;
        scope.PanelListInfo = null;
        scope.handleSearch = function() {
            if (!scope.searchQuery) {
                scope.filteredNodes = scope.nodes;
                return;
            }
            
            scope.filteredNodes = _.filter(scope.nodes, (node) => {
                return node.attr[scope.labelAttr].toUpperCase().indexOf(scope.searchQuery.toUpperCase()) != -1;
            });
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

        scope.$watch('searchQuery', function() {
            scope.handleSearch();
        });

        scope.$on(BROADCAST_MESSAGES.tabs.changed, function(_, data) {
            if (data === 'info') {
                scope.handleSearch();
            }
        });

        scope.$on(BROADCAST_MESSAGES.hss.select, function(e, data) {
            if (data.selectionCount > 1 && data.nodes.length == 1) {
                return;
            }

            setTimeout(() => {
                scope.handleSearch();
            }, 100)
        });

        layoutService.getCurrent().then(function (layout) {
            scope.layout = layout;
        });

        scope.selectNode = function(node, $event) {
            hoverService.unhover();
            selectService.selectSingleNode(node.id, true);
            scope.handleLeave();
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
            
            return node.attr[scope.labelAttr].toUpperCase().indexOf(scope.searchQuery.toUpperCase()) != -1;
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

        scope.handleLeave = function() {
            scope.isShowTooltip = false;
            scope.PanelListInfo = null;
            scope.isShowMoreTextTooltip = false;
            scope.isShowMoreTagsTooltips = false;
            
            if (scope.intervalId) {
                clearInterval(scope.intervalId);
                scope.$apply();
            }
        }

        scope.isLongText = function(text) {
            return text.length > MAX_TOOLTIP_STRING_LENGTH;
        }

        scope.getTooltipText = function(text) {
            return scope.isLongText(text) ? text.slice(0, MAX_TOOLTIP_STRING_LENGTH) + '...' : text; 
        }

        scope.toggleMoreText = function() {
            scope.isShowMoreTextTooltip = !scope.isShowMoreTextTooltip;
        }
        
        scope.toggleMoreTags = function() {
            scope.isShowMoreTagsTooltips = !scope.isShowMoreTagsTooltips;
        }

        scope.$on(BROADCAST_MESSAGES.hss.select, function(ev, data) {
            if (data.selectionCount == 1) {
                return;
            }

            if (data.filtersCount > 0) {
                scope.nodesStatus = 'Points selected';
                scope.linksStatus = 'Links selected';
            } else if (data.isSubsetted) {
                scope.nodesStatus = 'Points subset';
                scope.linksStatus = 'Links subset';
            } else {
                scope.nodesStatus = 'Total Points';
                scope.linksStatus = 'Total links';
            }

            if (data.nodes.length == 1) {
                scope.singleNode = data.nodes[0];

                if (!data.listPanelPrevent) {
                    scrollTo(scope.singleNode.id);
                }
            } else {
                scope.singleNode = null;
            }

            scope.handleLeave();
        })

        function getFunctionColor(cluster) {
            return d3.rgb(scope.layout.scalers.color(cluster)).toString();
        }

        scope.debounceHoverNode = _.debounce(hoverNodes, 150);

        function hoverNodes(node, event) {
            const selectedNode = scope.singleNode;

            if (!selectedNode || selectedNode.id !== node.id) {
                setPanelInfo(node);
                scope.isShowTooltip = true;
                scope.intervalId = setInterval(() => {
                    try {
                        if (!$('.panel-list-info').is(':hover') && !$('.nodes-list').is(':hover')) {
                            scope.handleLeave();
                        }
                    } catch (e) {
                        scope.handleLeave();
                    }
                }, 1000);
            } else {
                scope.handleLeave();
            }
            
            parCtrl.persistSelection();
            hoverService.hoverNodes({ ids: node.id });
        }

        function unHoverNodes(nodeIds) {
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
