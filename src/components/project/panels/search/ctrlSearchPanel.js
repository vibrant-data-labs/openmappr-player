angular.module('common')
.controller('SearchPanelCtrl', ['$scope', '$rootScope', '$timeout', 'searchService', 'BROADCAST_MESSAGES', 'uiService', 'dataService', 'dataGraph', 'renderGraphfactory', 'nodeSelectionService', 'layoutService', 'SelectionSetService', 'hoverService', 'selectService', 'subsetService',
function($scope, $rootScope, $timeout, searchService, BROADCAST_MESSAGES, uiService, dataService, dataGraph, renderGraphfactory, nodeSelectionService, layoutService, SelectionSetService, hoverService, selectService, subsetService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[CtrlSearchPanel: ] ';
    var numShowGroups = 0;
    var ITEMS_TO_SHOW = 100;
    var ITEMS_TO_SHOW_INITIALLY = 10;



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.globalSearch = {
        text: ''
    };

    $scope.ui = {
        attrFilterText: 'All',
        showLimit: 5,
        allAttrsSelected: true,
        disableAllChkbx: true,
        nodeLabelAttr: 'OriginalLabel',
        processingQuery: false,
        overlayOpen: false,
        showInfoIcon: false,
        numShowGroups: numShowGroups,
        hoveredIds: []
    };

    $scope.filterAttrVMs = [];
    $scope.showLimit = ITEMS_TO_SHOW_INITIALLY;



    /**
    * Scope methods
    */
    $scope.searchFn = _.debounce(searchFn, 500);
    $scope.searchFocus = function() {
        $scope.ui.showInfoIcon = true;
        $scope.$parent.$parent.$parent.$parent.searchDropdownVisible = false;
    }
    $scope.attrToggled = attrToggled;
    $scope.selectNode = selectNode;
    $scope.selectAllNodes = selectAllNodes;
    $scope.createNewSelection = createNewSelection;
    $scope.addDatapointsToGroup = addDatapointsToGroup;
    $scope.getSearchHighlights = getSearchHighlights;

    $scope.highlightTextInOverlay = function() {
        $rootScope.$broadcast(BROADCAST_MESSAGES.nodeOverlay.highlightText, {
            text: $scope.globalSearch.text
        });
    };

    $scope.onBlurSearch = function(ev) {
        $scope.ui.showInfoIcon = false;
        if (!ev.target.value) {
            $rootScope.$broadcast(BROADCAST_MESSAGES.searchClose)
        }
    }

    $scope.showMore = function() {
        $scope.ui.numShowGroups++;
        $scope.ui.showLimit = Math.min($scope.ui.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY, $scope.searchResults.length);
    };

    $scope.showLess = function() {
        $scope.ui.numShowGroups = 0;
        $scope.ui.showLimit = Math.min($scope.ui.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY, $scope.searchResults.length);   
    }

    $scope.leaveNode = function(node) {
        $timeout(function() {
            $scope.ui.hoveredIds = _.filter($scope.ui.hoveredIds, function(id) {
                return node.id !== id;
            });
        }, 400);
    }

    $scope.isNodeDescShown = function(node) {
        return _.some($scope.ui.hoveredIds, function(id) {
            return node.id === id;
        })
    }

    $scope.hoverNode = function(node, event) {
        hoverService.hoverNodes({ ids: [node.id]});
        $scope.ui.hoveredIds.push(node.id);
    };

    $scope.hideSearchResults = function() {
        $scope.showSearchResults = false;
    };

    $scope.handleClearSearch = function() {
        $scope.globalSearch.text = '';
        $scope.hideSearchResults();
    }


    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$watch('ui.allAttrsSelected', watchSelectedAttrs);
    $scope.$on(BROADCAST_MESSAGES.dataGraph.loaded, init);

    $scope.$on(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated, init);

    $scope.$on(BROADCAST_MESSAGES.nodeOverlay.creating, function() {
        $scope.ui.overlayOpen = true;
    });

    $scope.$on(BROADCAST_MESSAGES.nodeOverlay.removing, function() {
        $scope.ui.overlayOpen = false;
    });

    $scope.$on(BROADCAST_MESSAGES.searchRequest.init, function(ev, data){
        if (!data) {
            $timeout(function() {
                $scope.ui.overlayOpen = false;
                $scope.searchDisable();
                $scope.globalSearch.text = '';
                $scope.onBlurSearch({ target: { value: '' }})
            }, 50);
            return;
        }

        $scope.ui.overlayOpen = true;
        $scope.showSearch = true;
        $scope.searchEnable();
        $scope.searchFocus();
        $scope.globalSearch.text = data.text;

        searchFn();
    });




    /*************************************
    ********* Initialise *****************
    **************************************/
    if(dataGraph.getRawDataUnsafe()) {
        init();
    }



    /*************************************
    ********* Core Functions *************
    **************************************/

    function searchFn() {

        $scope.ui.searchHelperText = null;

        if($scope.globalSearch.text.length < 3) {
            console.warn(logPrefix + 'search key too short');
            $scope.searchResults = [];
            $scope.ui.searchHelperText = 'too short..';
            //$scope.showSearchResults = false;
            return;
        }

        if((_.startsWith($scope.globalSearch.text, "'") && !_.endsWith($scope.globalSearch.text, "'")) || (_.startsWith($scope.globalSearch.text, '"') && !_.endsWith($scope.globalSearch.text, '"'))) {
            console.warn(logPrefix + 'close quotes');
            $scope.searchResults = [];
            $scope.ui.searchHelperText = 'please close quotes..';
            return;
        }

        console.log('broadcasting search');

        $rootScope.$broadcast(BROADCAST_MESSAGES.search, {
            search: $scope.globalSearch.text
        });
        var dataRef = $rootScope.MAPP_EDITOR_OPEN
            ? dataService.currDataSetUnsafe().id
            : $scope.player.dataset.ref;

        // Run search only on attrs in search list, instead of '_all'
        var filterAttrIds;
        if ($scope.selectedSearchValue.length === 0) {
            filterAttrIds = _.map($scope.filterAttrVMs, 'id');
        } else {
            filterAttrIds = _.map($scope.selectedSearchValue, 'id');
        }
        console.assert(dataRef, "Dataset must exist for this version");

        $scope.ui.processingQuery = true;

        searchService.searchNodes($scope.globalSearch.text, dataRef, filterAttrIds, $scope.player.player.settings.searchAlg)
        .then(function(hits) {
            var subsetNodes = subsetService.currentSubset();
            if (subsetNodes && subsetNodes.length) {
                hits = _.filter(hits, function(hit) {
                    return _.includes(subsetNodes, hit._source.id);
                });
            }
            console.log('[ctrlSearchPanel : ] nodes found -- ', hits);
            var rgNodes = renderGraphfactory.getGraph().nodes();
            var dataPointIdNodeIdMap = dataGraph.getRawDataUnsafe().dataPointIdNodeIdMap;
            var validNodeIds = _(hits)
                                .map(function(hit) { return dataPointIdNodeIdMap[hit._source.id]; })
                                .compact()
                                .value();

            $scope.searchResults = _.filter(rgNodes, function(node) {
                return validNodeIds.indexOf(node.id) > -1;
            });

            //add highlights
            var highlightKeys = filterAttrIds.slice();
            _.forEach($scope.searchResults, function(n) {
                var hit = _.find(hits, function(h) {
                    return h._source.id == n.id;
                });
                n.highlights = [];
                _.forEach(highlightKeys, function(key) {
                    if(hit.highlight[key]) {
                        n.highlights = n.highlights.concat({
                            attrName: key,
                            text: hit.highlight[key]
                        });
                    }
                });
            });

            console.log(logPrefix + 'search results: ', $scope.searchResults);

            switch ($scope.searchResults.length) {
            case 0:
                $scope.ui.searchHelperText = 'Found None';
                break;
            case 1:
                $scope.ui.searchHelperText = 'Found 1 Node';
                break;
            default:
                $scope.ui.searchHelperText = 'Found ' + $scope.searchResults.length + ' Nodes';
            }

            $scope.ui.processingQuery = false;

            // Set node label attr.
            var layout = layoutService.getCurrentIfExists();
            $scope.ui.nodeLabelAttr = layout && layout.mapprSettings
                ? layout.mapprSettings.labelAttr
                : 'OriginalLabel';
        })
        .catch(function(error) {
            $scope.searchResults = [];
            $scope.ui.searchHelperText = 'Found None';

            switch(error) {
            case 'noMatch':
                console.log(logPrefix + 'No match found for ' + $scope.globalSearch.text);
                // uiService.logError('No match found for ' + $scope.globalSearch.text);
                break;
            case 'searchFailed':
                console.log(logPrefix + 'Could not search for ' + $scope.globalSearch.text);
                $rootScope.$broadcast(BROADCAST_MESSAGES.searchFailure);
                break;
            default:
            }
        });

        //added this in to show search panels
        $scope.showSearchResults = true;
    }

    function watchSelectedAttrs(val) {
        if(val === true) {
            _.each($scope.filterAttrVMs, function(attrVM) {
                attrVM.checked = false;
            });
            $scope.ui.disableAllChkbx = true;
            $scope.ui.attrFilterText = 'All';
        }
    }

    function attrToggled(attrVM) {
        var checkedAttrs = _.filter($scope.filterAttrVMs, 'checked');
        $scope.ui.allAttrsSelected = checkedAttrs.length === $scope.filterAttrVMs.length;

        if (checkedAttrs.length === 0) {
            $scope.ui.allAttrsSelected = true;
            $scope.ui.attrFilterText = 'All';
        } else if(checkedAttrs.length === 1) {
            $scope.ui.attrFilterText = checkedAttrs[0].title;
        } else {
            $scope.ui.attrFilterText = 'Multiple';
        }

        $scope.ui.disableAllChkbx = $scope.ui.allAttrsSelected;
        $scope.$broadcast(BROADCAST_MESSAGES.searchAttrToggled, {
            attrTitle: attrVM.title,
            selected: attrVM.checked
        });
    }

    function selectNode(node) {
        selectService.selectSingleNode(node.id);
        $scope.highlightTextInOverlay();
    }

    function selectAllNodes(showSearchResults) {
        selectService.selectNodes({ ids: _.map($scope.searchResults, 'id'), searchText: $scope.globalSearch.text, searchAttr: $scope.selectedSearchValue, scope: $scope});
        $scope.globalSearch.text = '';
        $scope.searchToggle();
        if(!showSearchResults) {
            $scope.hideSearchResults();
        }
    }

    function createNewSelection() {
        console.log(logPrefix + 'adding a new selection');
        $scope.selectAllNodes(true);
        var newSelVM = SelectionSetService.addNewSelection(false);
        newSelVM.create();
    }

    function addDatapointsToGroup(selVM) {
        console.log(logPrefix + 'adding datapoints to group ' + selVM.selName);
        $scope.selectAllNodes(true);
        selVM.addDatapoints();
    }

    function getSearchHighlights(node) {
        var html = '<ul class="highlight-list">';
        var highlight = {};
        for (var i = 0; i < node.highlights.length; i++) {
            highlight = node.highlights[i];
            html += '<li class="h7">'
                    + '<span><b>' + highlight.attrName + '</b></span> : '
                    + '<span>&ldquo;&hellip;' + highlight.text + '&hellip;&rdquo;</span>'
                    + '</li>';
        }
        html += '</ul>';
        return html;
    }

    function init() {
        $scope.filterAttrVMs = _.reduce(dataGraph.getNodeAttrs(), function(acc, attr) {
            // Filter hidden & numeric & not searchable attrs
            if(!attr.isNumeric && attr.visible && attr.searchable) {
                acc.push(_.assign(_.clone(attr), {
                    checked: false
                }));
            }
            return acc;
        }, []);

        $scope.selectionSetVMs = SelectionSetService.getSelectionVMs();

    }

}
]);
