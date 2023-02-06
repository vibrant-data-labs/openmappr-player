/*jshint unused:false, loopfunc:true */
/**
 * This service builds intelligence about an attribute in the dataset
 */
angular.module('common')
    .service('FilterPanelService', ['$timeout', '$q', 'dataGraph', 'AttrInfoService', 'attrUIService', 'renderGraphfactory', 'hoverService', 'constSteps',
        function ($timeout, $q, dataGraph, AttrInfoService, attrUIService, renderGraphfactory, hoverService, constSteps) {
            "use strict";

            /*************************************
    *************** API ******************
    **************************************/
            this.init = init;
            this.clear = clear;

            // this.buildFilters = buildFilters;
            this.applyFilters = applyFilters; // updates CS and returns it
            this.resetFilters = resetFilters;
            this.getFilterForId = function getFilterForId(id) { return attrFilterConfigMap && attrFilterConfigMap[id]; };
            this.updateFilterForId = updateFilterForId;
            this.getActiveFilterCount = getActiveFilterCount;
            this.updateFiltersVis = updateFiltersVis;
            this.getFiltersVis = getFiltersVis;

            this.updateInitialSelection = updateInitialSelection; // updates initialObs + sets up the rest of the panel
            this.getInitialSelection = function() { return initialSelection; };
            this.getInitSel = this.getInitialSelection;
            this.isInitialized = function() { return initialized; };

            this.appendToSelectionHistory = function appendToSelectionHistory(previousFilterMapState) {
                selectionUndoHistory = selectionUndoHistory || [];
                if (selectionUndoHistory.length === 0) {
                    selectionRedoHistory = [];
                }

                selectionUndoHistory.push(previousFilterMapState);
                return {
                    enableUndo: !!(selectionUndoHistory && selectionUndoHistory.length),
                    enableRedo: !!(selectionRedoHistory && selectionRedoHistory.length),
                };
            };

            this.getLastFilterFromSelectionHistory = function getLastFilterFromSelectionHistory() {
                return _.last(selectionUndoHistory);
            };

            this.undoFilterFromSelectionHistory = function undo() {
                selectionRedoHistory.push(angular.copy(attrFilterConfigMapAfterSubset));
                var lastFilterState = selectionUndoHistory.pop();
                attrFilterConfigMap = angular.copy(lastFilterState);
                attrFilterConfigMapAfterSubset = angular.copy(attrFilterConfigMap);
                applyFilters();
                return {
                    enableUndo: !!(selectionUndoHistory && selectionUndoHistory.length),
                    enableRedo: !!(selectionRedoHistory && selectionRedoHistory.length),
                };
            };

            this.redoFilterFromSelectionHistory = function redo() {
                selectionUndoHistory.push(angular.copy(attrFilterConfigMapAfterSubset));
                var futureFilterState = selectionRedoHistory.pop();
                attrFilterConfigMap = angular.copy(futureFilterState);
                attrFilterConfigMapAfterSubset = angular.copy(attrFilterConfigMap);
                applyFilters();
                return {
                    enableUndo: !!(selectionUndoHistory && selectionUndoHistory.length),
                    enableRedo: !!(selectionRedoHistory && selectionRedoHistory.length),
                };
            };

            this.shouldReplaceNewSel = function() { return replaceNewSel; };
            this.rememberSelection = function(val) { replaceNewSel = !val; };

            this.getCurrentSelection = function() { return currentSelection; };
            this.getCurrSel = this.getCurrentSelection;

            this.getAttrFilterConfigMap = function() { return angular.copy(attrFilterConfigMap); };

            this.getInfoObjForInitialS = function() { return initialSelectionInfoObj; };
            // this.getInfoObjForCurrentS = function() { return currentSelectionInfoObj; };

            this.genColorString = genColorString;
            this.getColorString = function() { return panelColor; };

            this.getNodesForSNCluster = getNodesForSNCluster;
            this.getNodesForClusters = getNodesForClusters;

            // Used for preventing accidental FP hover interactions while scrolling
            this.updateFPScrollStatus = updateFPScrollStatus;
            this.getFPScrollStatus = getFPScrollStatus;

            this.setFilterMapAfterSubset = function setFilterMapAfterSubset(map) {
                attrFilterConfigMapAfterSubset = map;
            };

            this.getFilterMapAfterSubset = function getFilterMapAfterSubset() {
                return angular.copy(attrFilterConfigMapAfterSubset);
            };


            this.getFilterIntroOptions = getFilterIntroOptions;


            /*************************************
    ********* CLASSES ********************
    **************************************/
            function FilterConfig (attrId) {
                this.attrId = attrId;
                this.isEnabled = false;
                this.selector = null; // maybe a selector from selector Service?
                this.selectedVals = [];
                this.state = {}; //Remembers filter state. Upto the consumer how to use this obj.
            }
            // if given null as nodes, then select from datagraph
            // else select from nodes
            FilterConfig.prototype.filter = function(nodes) {
                var selNodes = nodes;
                if(!this.isEnabled) return selNodes;
                else {
                    // previous filters application got us empty selection
                    if(nodes && nodes.length === 0) {return [];}

                    // if nodes is null, then select from dataGraph
                    if(!nodes) {
                        this.selector.selectfromDataGraph();
                    }
                    else {
                        this.selector.selectFromNodes(nodes);
                    }
                    // selNodes = _.map(nodeIds, function(nodeId) { return nodeIdx[nodeId]; });
                    selNodes = this.selector.getNodes();
                }
                return selNodes;
            };





            /*************************************
    ********* Local Data *****************
    **************************************/
            var logPrefix = '[FilterPanelService: ] ';
            var defPanelColor = "#999";
            //var defPanelColor = '#444444';
            //var defPanelColor = '#4F4F4F';
            var initialSelection      = [], // The base selection used to configure. Filters are applied it this
                currentSelection        = [], // the selection being highlighted on the graph. filtered subset
                attrFilterConfigMap     = {}, // the configuration of filter objects
                attrFilterConfigMapAfterSubset     = {}, // the configuration of filter objects
                selectionUndoHistory = [],
                selectionRedoHistory = [],
                initialized = false,
                replaceNewSel = true,
                filtersVisible = true;


            var initialSelectionInfoObj = null,
                // currentSelectionInfoObj = null,
                fpScrollActive = false, //Filter Panel recently scrolled ?
                panelColor = defPanelColor; // AttrInfo objects for the directs to use




            /*************************************
    ********* Core Functions *************
    **************************************/

            function init () {
                initialSelection      = [];
                currentSelection        = [];
                attrFilterConfigMap = _.indexBy(_buildFilters(dataGraph.getNodeAttrs()), 'attrId');
                attrFilterConfigMapAfterSubset = angular.copy(attrFilterConfigMap);
                initialized = true;
            }

            function clear() {
                initialSelection = [];
                currentSelection = [];
                attrFilterConfigMap = {};
                filtersVisible = false;
                initialized = false;
            }

            function updateFiltersVis(visibile) {
                filtersVisible = visibile;
            }

            function getFiltersVis() {
                return filtersVisible;
            }

            function getActiveFilterCount() {
                return _.filter(_.values(attrFilterConfigMap), 'isEnabled').length;
            }

            function applyFilters () {
                var cs = _.reduce(_.values(attrFilterConfigMap), function(acc, filterCfg) {
                    return filterCfg.filter(acc);
                }, initialSelection.length > 0 ? initialSelection : null);
                currentSelection = cs || [];

                return currentSelection;
            }

            function resetFilters() {
                _.each(attrFilterConfigMap, function(filterCfg) {
                    filterCfg.isEnabled = false;
                    filterCfg.selector = null;
                    filterCfg.state = {};
                });
                hoverService.unhover();
                applyFilters();

                selectionRedoHistory = [];
                selectionUndoHistory = [];
            }

            function updateFilterForId(fc) {
                console.assert(fc instanceof FilterConfig);
                return attrFilterConfigMap[fc.attrId] = fc;
            }

            function updateInitialSelection(nodes) {
                initialSelection = nodes || [];
                currentSelection = _.clone(initialSelection);
                replaceNewSel = false;
            }

            // Returns all nodes belonging to single node's cluster
            function getNodesForSNCluster() {
                var allNodes = renderGraphfactory.getGraph().nodes(),
                    clustNodes = [],
                    clusterAttr = 'Cluster';
                if(initialSelection.length !== 1) {
                    throw new Error('called for non-single-node selection');
                }
                var nodeCluster = initialSelection[0].attr[clusterAttr];
                if(nodeCluster == null) {
                    console.error(logPrefix + 'node doesnt belong to a cluster');
                    return [initialSelection[0]];
                }
                clustNodes = _.filter(allNodes, function(nd) {
                    return nd.attr[clusterAttr] == nodeCluster;
                });
                return clustNodes;
            }

            // For External Overlay only
            function getNodesForClusters(userClusters) {
                var allNodes = renderGraphfactory.getGraph().nodes(),
                    clustersNodes = [];
                if(!_.isArray(userClusters)) {
                    throw new Error('Array expected');
                }

                userClusters.forEach(function(clust) {
                    _.each(allNodes, function(nd) {
                        if(nd.attr.Cluster == clust) {
                            clustersNodes.push(nd);
                        }
                    });
                });
                return clustersNodes;
            }

            /// Internals

            function _buildFilters (attrs) {
                return _.map(attrs, function(attr) { return new FilterConfig(attr.id, "DISABLE"); });
            }

            // Recent scroll status of filter panel
            function updateFPScrollStatus(status) {
                fpScrollActive = status;
            }

            function getFPScrollStatus() {
                console.log('[FilterPanelService: FP scroll active - ] ', fpScrollActive);
                return fpScrollActive;
            }


            /// ASK RICH
            // function distrIsSignificant(values, attrInfo, significance) {
            //     var vals = _.map(values, function(v) {return v.value;});
            //     if( dataGraph.getRenderableGraph().layout.setting('testSignificance') ) {
            //         if( attrInfo.isNumeric) {
            //             return mappr.stats.sigtest.isSignificantNumeric(vals, attrInfo.values, significance);
            //         } else if( attrInfo.isTag ) {
            //             return mappr.stats.sigtest.isSignificantTag(vals, attrInfo.nAttrValues, attrInfo.valuesCount, significance);
            //         } else {
            //             return mappr.stats.sigtest.isSignificantCategorical(vals, attrInfo.nAttrValues, attrInfo.valuesCount, significance);
            //         }
            //     }
            //     return true;
            // }

            function genColorString () {

                if(currentSelection.length === 0) {
                    panelColor = defPanelColor;
                } else {
                    var colors = _.map(currentSelection, 'colorStr'), colorCounts = _.countBy(colors);

                    if(_.size(colorCounts) <= 1 ) { // same color for all
                        panelColor = colors[0] || defPanelColor;
                    } else {
                        // comment out max color stuff. Defaults to defPanelColor
                        // find the color with max count
                        // var maxColor = _.reduce(colorCounts, function(acc, val, key) {
                        //     if(acc.count < val) {
                        //         return {
                        //             color : key,
                        //             count : val
                        //         };
                        //     } else return acc;
                        // }, { color : defPanelColor, count : 0 });

                        // tagColor = panelColor = maxColor.color;
                        panelColor = defPanelColor;
                    }
                }
                return panelColor;
            }

            function addKeywordStepIfExists(steps) {
                var element = $('dir-tag-cloud').closest('.filter-item');
                if (element.length) {
                    steps.push({
                        element: element[0],
                        intro: constSteps.keyword
                    });
                }

                return steps;
            }

            function addCategoryStepIfExists(steps) {
                var element = $('dir-category-list').closest('.filter-item');
                if (element.length) {
                    steps.push({
                        element: element[0],
                        intro: constSteps.category
                    });
                }

                return steps;
            }

            function getFilterIntroOptions() {
                var steps = [
                    {
                        element: '#mainFilterPanel',
                        intro: constSteps.main
                    },
                ];
                steps = addKeywordStepIfExists(steps);
                steps = addCategoryStepIfExists(steps);

                return {
                    steps: steps,
                    disableInteraction: true,
                    exitOnOverlayClick: false,
                    showBullets: false,
                    scrollToElement: false,
                    keyboardNavigation: false,
                    exitOnEsc: false,
                    showStepNumbers: false,
                    tooltipPosition: 'right'
                };
            }

        }
    ]);
    angular.$inject = ['constSteps'];  