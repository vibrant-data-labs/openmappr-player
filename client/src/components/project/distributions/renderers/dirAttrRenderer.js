/**
* NOTE:
* 1) Used by distribution directives
* 2) It always passes raiseEvents as 'true' for graphSelectionService as there isn't any use case for 'false' yet.
     Will need change if 'false' use-case is required.
*/
angular.module('common')
    .directive('dirAttrRenderer', ['$timeout', 'FilterPanelService', 'nodeSelectionService', 'hoverService', 'graphSelectionService', 'layoutService', 'AttrInfoService', 'projFactory', 'networkService', 'BROADCAST_MESSAGES', 'dataGraph',
        function($timeout, FilterPanelService, nodeSelectionService, hoverService, graphSelectionService, layoutService, AttrInfoService, projFactory, networkService, BROADCAST_MESSAGES, dataGraph) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                template: '<div class="attr-renderers" ng-if="shouldRender && renderer.renderTemplate" ng-include="renderer.renderTemplate"></div>',

                // Values passed to scope will serve as RENDER OPTIONS for child render directives
                scope: {
                    attrToRender: '=', // attribute value(s), name only if plotting global distribution
                    nodeColorStr: '=',
                    isNode: '@',
                    isSized: '@',
                    isGlobal: '=?',
                    isNodeFocus: '@',
                    cancelOverlayFctn: '&',
                    renderWidth: '@',
                    renderHeight: '@',
                    isSmall: '@',
                    showFilter: '=',
                    disableFilter: '=',
                    chosenNodes: '=',
                    theme: '=',
                    pinnedMedia: '=',
                    focusNode: '=?'
                },
                controller: ['$scope', ControllerFn],
                link: postLinkFn
            };


            /*************************************
    ************ Local Data **************
    **************************************/
            var logPrefix = 'dirAttrRenderer: ';
            var delay = 500; //ms
            var debHoverByAttr = _.debounce(nodeSelectionService.hoverNodesByAttrib, delay);
            var debHoverByAttributes = _.debounce(nodeSelectionService.hoverNodesByAttributes, delay);
            var debHoverByAttrRange = _.debounce(nodeSelectionService.hoverNodesByAttribRange, delay);
            var debSelectByAttr = _.debounce(nodeSelectionService.selectNodesByAttrib, delay);
            var debSelectByAttrRange = _.debounce(nodeSelectionService.selectNodesByAttribRange, delay);
            var debHoverIdList = _.debounce(nodeSelectionService.hoverNodeIdList, delay);
            var debSelectIdList = _.debounce(nodeSelectionService.selectNodeIdList, delay);
            var debUnHoverByAttributes = _.debounce(nodeSelectionService.unhoverNodesByAttributes, 10);
            var debUnHoverByAttrib = _.debounce(nodeSelectionService.unhoverNodesByAttrib, 10);

            var isFPScrollActive = FilterPanelService.getFPScrollStatus; //Function ref




            /*************************************
    ******** Controller Function *********
    **************************************/
            function ControllerFn($scope) {
                var attrValues;
                this.attrInfo = null;
                this.isGrid = false;
                this.isExtUser = false;

                // console.log('attr to render: ', $scope.attrToRender);

                // Graph interaction functions to be used by child directives
                this.hoverNodesByAttrib = hoverNodesByAttrib;
                this.hoverNodesByAttributes = hoverNodesByAttributes;
                this.unhoverNodesByAttrib = unhoverNodesByAttrib;
                this.unhoverNodesByAttributes = unhoverNodesByAttributes;
                this.highlightNodesByAttributes = highlightNodesByAttributes;
                this.unhighlightNodesByAttributes = unhighlightNodesByAttributes;
                this.hoverNodesByAttribRange = hoverNodesByAttribRange;
                this.hoverNodeIdList = hoverNodeIdList;
                this.unHoverNodes = unHoverNodes;
                this.addNodeIdsToSelected = addNodeIdsToSelected;
                this.highlightNodesByAttrRange = highlightNodesByAttrRange;

                //if in overlay, then close it before selecting new nodes
                //debounce doesn't work becuse this directive disappears before
                //it can be called when closing the overlay
                if($scope.cancelOverlayFctn) {
                    this.selectNodeIdList = function(nodeIds, ev) {
                        unHoverNodes();
                        nodeSelectionService.selectNodeIdList(nodeIds, ev, true);
                        $scope.cancelOverlayFctn();
                    };
                    this.selectNodesByAttrib = function(id, val, ev) {
                        unHoverNodes();
                        nodeSelectionService.selectNodesByAttrib(id, val, ev, true, true);
                        $scope.cancelOverlayFctn();
                    };
                    this.selectNodesByAttribRange = function(id, min, max, ev) {
                        unHoverNodes();
                        nodeSelectionService.selectNodesByAttribRange(id, min, max, ev, true, true);
                        $scope.cancelOverlayFctn();
                    };
                } else {
                    this.selectNodeIdList = selectNodeIdList;
                    this.selectNodesByAttrib = selectNodesByAttrib;
                    this.selectNodesByAttribRange = selectNodesByAttribRange;
                }

                this.getSelectedNodes = getSelectedNodes;

                //
                this.isLazy = '';
                $scope.renderer = {
                    renderTemplate: null,
                    nodeValues : [],
                    nodeValue : null
                };

                this.getAttrVals = function() {
                    return attrValues;
                };

                this.setAttrVals = function(attrVals) {
                    attrValues = attrVals.slice();
                };

                this.getAttrId = function() {
                    return $scope.attrToRender.id;
                };

                this.isGridNode = function() {
                    return this.isGrid === 'true' || this.isGrid === true;
                };

                this.isCompareView = function() {
                    return this.isExtUser === 'true' || this.isExtUser === true;
                };

                this.getTotalNodesCount = function() {
                    return dataGraph.getAllNodes().length;
                }

                this.getClusterMeta = function() {
                    if($scope.attrToRender.id != 'Cluster') throw new Error('Called for non-cluster attr');
                    var projSettings = projFactory.getProjectSettings();
                    var clusterMeta = projSettings.clusterMeta[networkService.getCurrentNetwork().id]['Cluster'] || {};
                    if(_.isEmpty(clusterMeta)) {
                        console.warn(logPrefix + 'empty cluster meta');
                    }
                    return clusterMeta;
                };

                // Individual distributions may override this function
                this.getBinCount = function() {
                    return this.attrInfo.nBins;
                };
            }



            /*************************************
    ******** Post Link Function *********
    **************************************/
            function postLinkFn(scope, element, attrs, ctrl) {
                var attrInfo = ctrl.attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id);
                ctrl.isLazy = attrs.isLazy;
                ctrl.isGrid = attrs.isGrid;
                ctrl.isExtUser = attrs.isExtUser;
                ctrl.setAttrVals(attrInfo.values);
                scope.maxAttrs = 10;
                scope.shouldRender = true;
                setupScope(scope.attrToRender.id);
                scope.renderer.renderTemplate = getRenderTemplate(scope.attrToRender, scope.isSized);

                scope.$on(BROADCAST_MESSAGES.selectNodes, function(e, data) {
                    if(!_.isArray(_.get(data, 'nodes'))) {
                        return console.warn('SelectNodes Event data has no nodes');
                    }
                    // Update node value for Single node browsing
                    if(data.nodes.length === 1) {
                        setupScope(scope.attrToRender.id);
                        // reset attribute to render so will accurately reset rendered attrs
                        // (using for twitterfeed to accurately switch between node selection)
                        scope.renderer.renderTemplate = getRenderTemplate({}, scope.isSized);
                        $timeout(function() {
                            scope.renderer.renderTemplate = getRenderTemplate(scope.attrToRender, scope.isSized);
                        });
                    }
                });

                // Update render template if renderType changed
                scope.$on(BROADCAST_MESSAGES.attr.renderTypeChanged, function(e, data) {
                    if(data.id == scope.attrToRender.id) {
                        scope.renderer.renderTemplate = getRenderTemplate(scope.attrToRender, scope.isSized);
                    }
                });

                scope.$on(BROADCAST_MESSAGES.fp.panel.rebuild, function() {
                    scope.shouldRender = false;

                    $timeout(function() {
                        scope.shouldRender = true;
                        scope.renderer.renderTemplate = getRenderTemplate(scope.attrToRender, scope.isSized);
                        setupScope(scope.attrToRender.id);
                    }, 200);
                });

                // update render template if attrType changed
                scope.$on(BROADCAST_MESSAGES.attr.typeChanged, function(e, modifiedAttr) {
                    if(modifiedAttr.id == scope.attrToRender.id) {
                        scope.shouldRender = false;
                        var x = scope.$on(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated, function() {
                            x();
                            $timeout(function() {
                                scope.renderer.renderTemplate = getRenderTemplate(scope.attrToRender, scope.isSized);
                                scope.shouldRender = true;
                            });
                        });
                    }
                });

                function setupScope (attrId) {
                    var cs;
                    if(scope.focusNode) {
                        cs = [scope.focusNode];
                    } else {
                        cs = graphSelectionService.getSelectedNodes();
                    }
                    console.log('cs: ', cs);
                    scope.renderer.nodeValues = _.map(cs, 'attr.' + attrId);
                    console.log('node values: ', scope.renderer.nodeValues);
                    if(attrs.isGrid == 'true' || attrs.isGrid == true) {
                        scope.renderer.nodeValue = scope.attrToRender.value;
                    }
                    else {
                        scope.renderer.nodeValue = cs.length === 1 ? scope.renderer.nodeValues[0] : null;
                    }
                }
            }





            /*************************************
            ************ Local Functions *********
            **************************************/

            function hoverNodesByAttrib(id, val, ev) {
                // !isFPScrollActive() && debHoverByAttr(id, val, ev, true);
                !isFPScrollActive() && nodeSelectionService.hoverNodesByAttrib(id, val, ev, true);
            }

            function hoverNodesByAttributes(id, values, ev) {
                !isFPScrollActive() && debHoverByAttributes(id, values, ev, true);
            }

            function highlightNodesByAttributes(id, values, ev, subsettedValues) {
                !isFPScrollActive() && nodeSelectionService.selectionActionByAttributes(id, values, subsettedValues);
            }

            function unhighlightNodesByAttributes(id, values, ev) {
                !isFPScrollActive() && nodeSelectionService.unselectActionByAttributes(id, values);
            }

            function highlightNodesByAttrRange(id, min, max) {
                return !isFPScrollActive() && nodeSelectionService.selectionActionByAttribRange(id, min, max);
            }

            function unhoverNodesByAttributes(id, values, ev) {
                !isFPScrollActive() && debUnHoverByAttributes(id, values, ev, true);
            }

            function unhoverNodesByAttrib(id, values, ev) {
                // !isFPScrollActive() && debUnHoverByAttrib(id, values, ev, true);
                nodeSelectionService.unhoverNodesByAttrib(id, values, ev, true);
            }

            function hoverNodesByAttribRange(id, min, max, ev) {
                unHoverNodes();
                !isFPScrollActive() && debHoverByAttrRange(id, min, max, ev, true);
            }

            function selectNodesByAttribRange(id, min, max, ev) {
                unHoverNodes();
                debSelectByAttrRange(id, min, max, ev, true, true);
            }

            function hoverNodeIdList(nodeIds, ev) {
                unHoverNodes();
                !isFPScrollActive() && debHoverIdList(nodeIds, ev);
            }

            function selectNodesByAttrib(id, val, ev) {
                unHoverNodes();
                debSelectByAttr(id, val, ev, true, true);
            }

            function selectNodeIdList(nodeIds, ev) {
                unHoverNodes();
                debSelectIdList(nodeIds, ev, true);
            }

            function unHoverNodes () {
                debHoverByAttr.cancel();
                debHoverIdList.cancel();
                debHoverByAttrRange.cancel();
                debSelectByAttr.cancel();
                debSelectIdList.cancel();
                debSelectByAttrRange.cancel();
                hoverService.unhover();
                nodeSelectionService.highlightAllSelected(true);
            }

            function addNodeIdsToSelected(nodeIds) {
                nodeSelectionService.addNodeIdsToSelected(nodeIds);
            }

            function getSelectedNodes() {
                return graphSelectionService.getSelectedNodes() || [];
            }

            function getRenderTemplate(attr, isSized) {
                var renderTemplate = '';
                if(attr.renderType && attr.renderType != 'default') {
                    switch(attr.renderType) {
                    case 'densitybar':
                        // For backwards compatibility
                        if(!attr.isTag) {
                            renderTemplate = attr.isNumeric ? 'value_bar.html' : 'rank_bar.html';
                        }
                        else {
                            renderTemplate = 'tag_listing.html';
                        }
                        // renderTemplate = 'value_bar.html';
                        break;
                    case 'categorybar':
                        renderTemplate = 'rank_bar.html';
                        break;
                    case 'categorylist':
                        renderTemplate = 'cat_listing.html';
                        break;
                    case 'tags':
                        renderTemplate = 'tag_listing.html';
                        break;
                    case 'tags-simple': //deprecated
                        renderTemplate = 'tag_simple.html';
                        break;
                    case 'tag-cloud':
                        renderTemplate = 'tag_cloud.html';
                        break;
                    case 'wide-tag-cloud':
                        renderTemplate = 'wide_tag_cloud.html';
                        break;
                    case 'row-tag-cloud':
                        renderTemplate = 'row_tag_cloud.html';
                        break;
                    case 'piechart':
                        renderTemplate = 'piechart.html';
                        break;
                    case 'histogram':
                    case 'barchart':
                        renderTemplate = 'histogram.html';
                        break;
                    case 'twitterfeed':
                        renderTemplate = 'twitterfeed.html';
                        break;
                    case 'instagramfeed':
                        renderTemplate = 'instagramfeed.html';
                        break;
                    case 'medialist':
                        renderTemplate = 'medialist.html';
                        break;
                    case 'media':
                        renderTemplate = 'media.html';
                        break;
                    case 'link':
                        renderTemplate = 'link.html';
                        break;
                    case 'date':
                        renderTemplate = 'date.html';
                        break;
                    case 'date-time':
                        renderTemplate = 'date-time.html';
                        break;
                    case 'time':
                        renderTemplate = 'time.html';
                        break;
                    case 'email':
                        renderTemplate = 'email.html';
                        break;
                    case 'lat,lng':
                        renderTemplate = 'lat-lng.html';
                        break;
                    case 'quote':
                        renderTemplate = 'quote.html';
                        break;
                    case 'longtext':
                        renderTemplate = 'longtext.html';
                        break;
                    case 'horizontal-bars':
                        renderTemplate = 'horizontal_bars.html';
                    default:

                    }
                }
                else if((!attr.renderType || attr.renderType == 'default') && !isSized) {
                    switch(attr.attrType) {
                    case 'picture':
                        renderTemplate = 'picture.html';
                        break;
                    case 'video':
                        renderTemplate = 'video.html';
                        break;
                    case 'video_stream':
                        renderTemplate = 'video_stream.html';
                        break;
                    case 'audio_stream':
                        renderTemplate = 'audio_stream.html';
                        break;
                    case 'url':
                        renderTemplate = 'url.html';
                        break;
                    case 'timestamp':
                        renderTemplate = 'date-time.html';
                        break;
                    case 'html':
                        renderTemplate = 'html_renderer.html';
                        break;
                    case 'media_link':
                        renderTemplate = 'media_link.html';
                        break;
                    default:

                    }
                }
                // Note:-  Size distr not there anymore in the UI, so removed
                // else if(isSized) {
                //  renderTemplate = 'attrDistribution.html';
                // }

                return renderTemplate;
            }

            return dirDefn;
        }
    ]);
