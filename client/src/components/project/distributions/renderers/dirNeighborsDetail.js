angular.module('common')
    .directive('dirNeighborsDetail', ['$timeout', '$sce', 'dataGraph', 'linkService',
        function ($timeout, $sce, dataGraph, linkService) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'EA',
                templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/neighborsDetail.html',
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/


            /*************************************
    ******** Controller Function *********
    **************************************/


            /*************************************
    ******** Post Link Function *********
    **************************************/
            function postLinkFn(scope, element, attrs) {
                var links, hasLinks, incomingEdgesIndex, outgoingEdgesIndex;
                if (scope.focusNode) {

                    var node = scope.focusNode;
                    var dataset = dataGraph.getRawDataUnsafe();

                    // link vars
                    incomingEdgesIndex = dataset.edgeInIndex[node.id];
                    outgoingEdgesIndex = dataset.edgeOutIndex[node.id];
                    hasLinks = scope.hasLinks = _.size(incomingEdgesIndex) + _.size(outgoingEdgesIndex) > 0;

                }

                //scrolling vars
                var totContainers, scrollerWidth;
                var linkInfoAttrs = dataGraph.getEdgeInfoAttrs();
                scope.hideScrollLeft = true;
                scope.hideScrollRight = false;
                scope.curNeighborInd = 0;
                scope.linkInfo = "";
                scope.highlightColorStr = "";
                scope.activeLinkNodeId = null;


                //wait for creation cycle
                $timeout(function () {
                    totContainers = $(element).find('.container').length;
                    scrollerWidth = $(element).find('.scroll-bar').width() / totContainers;
                });

                //for grouping links into scrollable grid
                scope.linksGroup = [];
                scope.hasScroll = false;

                if (hasLinks || scope.extLinkedNodes) {
                    if (scope.extLinkedNodes) {
                        scope.hasLinks = true;
                        links = constructNeighborInfo(scope.extLinkedNodes);
                    } else {
                        links = linkService.constructLinkInfo(node, incomingEdgesIndex, outgoingEdgesIndex, scope.mapprSettings.labelAttr, scope.mapprSettings.nodeImageAttr);

                        scope.numLinks = links.length;

                        //create color obj for piebar
                        var nodeColors = _.map(links, function (link) {
                            return link.linkNode.colorStr;
                        });
                        //not just sorting by color because want most similar colors first
                        scope.neighborColors = [];
                        for (var i = 0; i < nodeColors.length; i++) {
                            var col = nodeColors[i];
                            var nC = _.find(scope.neighborColors, {
                                'colorStr': col
                            });
                            if (!nC) {
                                scope.neighborColors.push({
                                    colorStr: col,
                                    num: 1,
                                    percent: 1 / scope.numLinks * 100
                                });
                            } else {
                                nC.num++;
                                nC.percent = nC.num / scope.numLinks * 100;
                            }
                        }
                    }

                    //generate link information

                    //create grids
                    if (links.length > attrs.gridSize) {
                        console.log('has scroll');
                        scope.hasScroll = true;
                    }

                    //split up links into link groups
                    var lGInd = -1;
                    for (i = 0; i < links.length; i++) {
                        if (i % attrs.gridSize == 0) {
                            lGInd++;
                            scope.linksGroup[lGInd] = [];
                        }
                        scope.linksGroup[lGInd].push(links[i]);
                        console.log("linksGroup: ", scope.linksGroup);
                    }
                } else {
                    console.log("Node has no links to other nodes");
                }



                /*
         * Neighbors from links
         */

                //if coming from outside source and not actually linked
                function constructNeighborInfo(linkNodes) {
                    var links = [];
                    _.each(linkNodes, function (linkNode) {

                        var linkNodeLabel = linkNode.attr[scope.mapprSettings.labelAttr] || linkNode.label || 'missing label';
                        var linkNodeImage = linkNode.attr[scope.mapprSettings.nodeImageAttr] || linkNode.attr[scope.mapprSettings.nodePopImageAttr] || linkNode.image || '';
                        links.push({
                            isIncoming: true,
                            isOutgoing: false,
                            sourceId: linkNode.id,
                            targetId: 0,
                            linkNode: linkNode,
                            linkNodeLabel: linkNodeLabel,
                            linkNodeImage: linkNodeImage,
                            edgeInfo: null,
                            id: null
                        });
                    });
                    return links;
                }

                /*
         * SCROLLING
         */

                scope.scrollLeft = function () {
                    scope.curNeighborInd--;
                    if (scope.curNeighborInd == 0) {
                        scope.hideScrollLeft = true;
                    } else {
                        scope.hideScrollLeft = false;
                    }
                    scope.hideScrollRight = false;

                };

                scope.scrollRight = function () {
                    scope.curNeighborInd++;
                    if (scope.curNeighborInd == totContainers - 1) {
                        scope.hideScrollRight = true;
                    } else {
                        scope.hideScrollRight = false;
                    }
                    scope.hideScrollLeft = false;

                };

                scope.getContainerStyle = function (ind) {
                    var op = ind === scope.curNeighborInd ? 1 : 0;
                    return {
                        transform: "translate3d(" + Number(scope.curNeighborInd * -100) + "%, 0, 0)",
                        opacity: op
                    };
                };

                scope.getScrollerStyle = function () {
                    return {
                        transform: "translate3d(" + Number(scope.curNeighborInd * 100) + "%, 0, 0)",
                        width: scrollerWidth
                    };
                };

                //click (calls parent method. Maybe should move to attribute of this directive)
                scope.beginNeighborSwitch = function (linkNode, $event) {
                    console.log('beginNeighborSwitch', linkNode);
                    
                    $($event.currentTarget).css({
                        opacity: 0
                    });
                    scope.switchToNeighbor(linkNode, $event);
                };

                scope.enterNeighbor = function (link, $event) {
                    var linkNode = link.linkNode;
                    scope.activeLinkNodeId = link.linkNode.id;
                    //dim all links but this one
                    _.forEach(scope.linksGroup, function (links) {
                        _.forEach(links, function (link) {
                            if (link.linkNode.id != linkNode.id) {
                                link.isDimmed = true;
                            } else {
                                scope.highlightColorStr = link.linkNode.colorStr;
                            }
                        });
                    });

                    //if overlay is not content type
                    if (scope.mapprSettings.nodeFocusRenderTemplate !== 'content') {
                        //if external user directive is parent
                        if (link.edgeInfo) {
                            scope.linkInfo = linkService.getLinkInfo(link);
                            scope.drawNeighborLine(linkNode, link.edgeInfo.attr.similarity, $event);
                        } else {
                            scope.drawNeighborLine(linkNode, $event);
                        }
                    }
                };

                scope.leaveNeighbor = function () {
                    //remove isDimmed property
                    _.forEach(scope.linksGroup, function (links) {
                        _.forEach(links, function (link) {
                            if (link.isDimmed) {
                                delete link.isDimmed;
                            }
                        });
                    });

                    scope.activeLinkNodeId = null;
                    scope.linkInfo = "";
                    scope.removeNeighborLine();
                };

                scope.getNeighborInfoHtml = function(link) {
                    var neighborNode = link.linkNode;
                    var html = '<ul class="list-unstyled" style="color:' + neighborNode.colorStr + '">';
                    if(_.isEmpty(linkInfoAttrs)) { return ''; }
                    _.each(linkInfoAttrs, function(attr) {
                        var attrId = attr.id;
                        // Not sure about this. Seems to work to stop showing undefined in tooltip
                        var attrVal = neighborNode[attrId] || link.edgeInfo.attr[attrId];
                        if (_.isNumber(attrVal) && !Number.isInteger(attrVal)) { attrVal = attrVal.toFixed(2); }
                        var attrLabel = attrId !== 'label' ? _.startCase(attr.title) : 'Name';
                        html += '<li><b>' + attrLabel + ':</b> ' + attrVal + '</li>';
                    });
                    html += '</ul>';
                    return html;
                };
            }



            /*************************************
    ************ Local Functions *********
    **************************************/



            return dirDefn;
        }
    ]);
