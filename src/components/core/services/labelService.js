angular.module('common')
    .service('labelService', ['$q', 'renderGraphfactory', 'labelRenderer', 'layoutService',
        function ($q, renderGraphfactory, labelRenderer, layoutService) {

            "use strict";


            /*************************************
    *************** API ******************
    **************************************/
            this.defRenderer = defRenderer;
            this.selRenderer = selRenderer;
            this.hoverRenderer = hoverRenderer;

            //
            // Collection of label renderering strategies



            /*************************************
    ********* Local Data *****************
    **************************************/

            var labelSizeFuncFactory = labelRenderer.labelSizeFuncFactory;
            var collisionCount;
            var leftPanelWidth = 475;


            // Initialise sigma
            sigma.utils.pkg('sigma.d3');
            sigma.utils.pkg('sigma.d3.labels');

            /*************************************
    ********* External Assignments *******
    **************************************/
            ///
            /// Common label definitions. So that other label renderers can use them
            ///
            //sigma.d3.labels.labelSizeFuncFactory = labelSizeFuncFactory;
            sigma.d3.labels.thresholdStrat = thresholdStrat;
            sigma.d3.labels.topXSize = topXSize;
            sigma.d3.labels.filterCollision = topXSizeCollision;
            sigma.d3.labels.cssClasses = labelRenderer.classes;
            sigma.d3.labels.selectOrder = selectOrder;


            sigma.d3.labels.def = defRenderer;
            sigma.d3.labels.sel = selRenderer;
            sigma.d3.labels.hover = hoverRenderer;




            /*************************************
    ********* Core Functions *************
    **************************************/
            ///
            /// Common funcs
            ///

            var
                nodeId = window.mappr.utils.nodeId,
                toPx = window.mappr.utils.toPx;
            // isSpecial = window.mappr.utils.isSpecial,
            // invert = window.mappr.utils.invert,
            // multi = window.mappr.utils.multi,
            // add = window.mappr.utils.add,
            // plucker = window.mappr.utils.plucker,
            // darkenColor = window.mappr.utils.darkenColor,
            // lightenColor = window.mappr.utils.lightenColor;


            //
            // LABEL RENDERER
            //
            /**
     * Builds a func (node -> Int) which returns the font size for the label
     * @param  {[type]} settings [description]
     * @return {[type]}          [description]
     */

            function isSelected(node) {
                return node.isSelected || node.isSelectedNeighbour;
            }

            function selectOrder(node) {
                if (node.specialHighlight)
                    return 9;
                if (node.inHoverNeighbor && node.inHover)
                    return 8;
                if (node.isSelected && node.inHover)
                    return 7;
                if (node.inHover && node.isGroup)
                    return 6;
                if (node.inHover)
                    return 5;
                if (node.inHoverNeighbor)
                    return 4;
                if (node.isSelected)
                    return 3;
                if (node.isSelectedNeighbor)
                    return 2;
                if (node.isGroup)
                    return 1;
                return 0;
            }

            function calculateDistance(group1, group2, prefix) {
                var dx = group1[prefix + 'x'] - group2[prefix + 'x'];
                var dy = group1[prefix + 'y'] - group2[prefix + 'y'];
                return Math.sqrt(dx * dx + dy * dy);
            }

            function isSpatiallyDistant(smallGroup, largeGroups, prefix) {
                if (largeGroups.length === 0) return true;
                
                var minDistance = 100; // Minimum distance threshold in pixels
                
                // Check if the small group is far enough from all large groups
                return largeGroups.every(function(largeGroup) {
                    var distance = calculateDistance(smallGroup, largeGroup, prefix);
                    return distance > minDistance;
                });
            }

            // add nodes representing group labels
            // nodes are those on screen or in a border outside the screen
            // allnodes are all the nodes, so that groups can contain every node, even those offscreen
            // every group will have at least one onscreen node
            //
            function addGroupNodes(nodes, allnodes, settings, inHover, hasSubset) {
                var onScreen = function (x, y) {
                    return x > 0 && x < window.innerWidth - leftPanelWidth && y > 0 && y < window.innerHeight;
                };

                var groupInfo = layoutService.getGroupAttr();
                var subGroupInfo = layoutService.getSubgroupAttr();
                if (settings('drawGroupLabels') && groupInfo !== undefined) {
                    var finalNodes = [];
                    var prefix = settings('prefix');
                    var attr = groupInfo.attr.id;
                    var subAttr = subGroupInfo ? subGroupInfo.attr.id : null;
                    var maxGroups = groupInfo.values.length;
                    var groups = {};
                    var popped = [];
                    var allGroups = _.groupBy(allnodes, n => n.attr[attr]);
                    var allSubgroups = subAttr ? _.groupBy(allnodes, n => `${n.attr[attr]}:::${n.attr[subAttr]}`) : [];
                    // get nodes and nodes positions of each group
                    _.each(nodes, function (node) {
                        var x = node[prefix + 'x'], y = node[prefix + 'y'];
                        var group = node.attr[attr];
                        if (!groups[group]) {
                            var groupNodes = allGroups[group];
                            var count = groupInfo.valuesCount[group];
                            if (hasSubset) {
                                groupNodes = groupNodes.filter(n => nodes.find(q => q.id == n.id));
                                count = groupNodes.length;
                            }

                            groups[group] = {
                                title: group,
                                id: group,
                                nodes: groupNodes,
                                viznodes: [],
                                sumX: 0,
                                sumY: 0,
                                isGroup: true,
                                inHover: inHover,
                                count: count,
                                clusterColorStr: ''
                            };
                        }

                        if (subAttr) {
                            var subgroup = `${node.attr[attr]}:::${node.attr[subAttr]}`;
                            var subAttrVal = node.attr[subAttr];
                            if (!groups[subgroup]) {
                                var groupNodes = allSubgroups[group];
                                var count = subGroupInfo.valuesCount[subAttrVal];
                                if (hasSubset && groupNodes) {
                                    allSubgroups = allSubgroups.filter(n => nodes.find(q => q.id == n.id));
                                    count = allSubgroups.length;
                                }
    
                                groups[subgroup] = {
                                    title: subAttrVal,
                                    id: subgroup,
                                    nodes: groupNodes || [],
                                    viznodes: [],
                                    sumX: 0,
                                    sumY: 0,
                                    isGroup: true,
                                    isSubGroup: true,
                                    inHover: inHover,
                                    count: count,
                                    clusterColorStr: ''
                                };
                            }
                        }
                
                        var info = groups[group];
                        if (onScreen(x, y)) {
                            info.viznodes.push(node);
                            info.sumX += x;
                            info.sumY += y;
                            if (!info.clusterColorStr)
                                info.clusterColorStr = node.parentClusterColorStr;
                            if (node.inPop) {
                                popped.push(node);
                            }
                        }
                
                        if (subAttr) {
                            var subinfo = groups[subgroup];
                            if (onScreen(x, y)) {
                                subinfo.viznodes.push(node);
                                subinfo.sumX += x;
                                subinfo.sumY += y;
                                if (!subinfo.clusterColorStr)
                                    subinfo.clusterColorStr = node.clusterColorStr;
                                if (node.inPop) {
                                    popped.push(node);
                                }
                            }
                        }
                    });

                    if (popped.length == 0) {
                        //remove undefined groups (nodes which do not have label value or have no visible nodes)
                        groups = _.reject(groups, (group) => !group.title || !group.viznodes.length);

                        // compute position centroid
                        // and test whether to display the group label
                        onScreen = 0;
                        var labelSizeFunc = labelSizeFuncFactory(prefix, settings);
                        _.each(groups, function (info) {
                            info[prefix + 'size'] = 30;
                            var sz = labelRenderer.labelSizeFn(labelRenderer.getLabel(info, settings), labelSizeFunc(info));
                            //var hasSelectedNodes = _.any(info.viznodes, 'isSelected') || _.any(info.viznodes, 'isSelectedNeighbour');
                            var n = info.viznodes.length;
                            info[prefix + 'x'] = info.sumX / n - sz.wd * 0.2;
                            info[prefix + 'y'] = info.sumY / n;
                            // show group if it is big enough and if 60% of the groups nodes are visible onscreen
                            info.onScreen = (n > 3 && n >= 0.4 * info.count);

                            if (info.onScreen) {
                                onScreen++;
                            }
                            info.showNodes = true; // hasSelectedNodes || (inHover || (n >= 0.8*info.count));    // show node labels if cluster fully on screen
                        });



                        // Get groups with more than 1% of total nodes
                        var largeGroups = groups.filter(x => x.onScreen && x.count / allnodes.length > 0.01);
                        var groupsCount = largeGroups.length;
                        
                        if (groupsCount > 5) {
                            // If we have many large groups, include them plus any small groups that are spatially distant
                            var smallGroups = groups.filter(x => x.onScreen && x.count / allnodes.length <= 0.01);
                            var spatiallyDistantSmallGroups = smallGroups.filter(function(smallGroup) {
                                return isSpatiallyDistant(smallGroup, largeGroups, prefix);
                            });
                            
                            finalNodes = largeGroups.concat(spatiallyDistantSmallGroups);
                        } else {
                            // decide whether to include node labels
                            if (!inHover || onScreen > 4 || onScreen > maxGroups / 3) {  // show only group labels and perhaps some node labels if a lot are visible
                                _.each(groups, function (info) {
                                    if (info.showNodes) {
                                        finalNodes.push(...info.nodes);
                                    }
                                });
                            } else {    // otherwise show group and all node labels when few group labels are visible
                                finalNodes = _.clone(nodes);
                            }

                            // add visible group labels if inHover or more than one is visible
                            // (one group label visible means the user probably knows where they are so don't bother with it)
                            if (inHover || onScreen > 0) {
                                _.each(groups, function (info) {
                                    if (info.onScreen) {
                                        finalNodes.push(info);
                                    }
                                });
                            }
                        }

                        return finalNodes;
                    } else {
                        return popped;
                    }
                }
                return nodes;
            }

            // Label strategies

            //
            // returns the final list of nodes which would have their label rendered
            //
            function thresholdStrat(nodes, settings, overrideThresholding) {
                var prefix = settings('prefix');
                var finalNodes = [];
                var threshold = overrideThresholding ? 1 : settings('labelThreshold');
                var t = Math.min(1, Math.max(0.05, threshold)); // Limit between 0.05, 1
                var filterFunc = _.constant(true);

                var labelAttr = settings('labelAttr') || 'OriginalLabel', // the default label
                    selLabelAttr = settings('labelClickAttr') || labelAttr;

                //reject nodes with no labels
                var validNodes = _.reject(nodes, function (nd) { return (!nd.attr[labelAttr] || !nd.attr[selLabelAttr]); });

                if (threshold < 1 && !overrideThresholding) {
                    var sizes = _.pluck(validNodes, prefix + 'size').sort(function (s1, s2) { return s2 - s1; });
                    filterFunc = window.mappr.utils.greaterThan(prefix + 'size', d3.quantile(sizes, t));
                }

                _.each(validNodes, function (n) {
                    if (isSelected(n))
                        finalNodes.push(n);
                    else {
                        if (filterFunc(n))
                            finalNodes.push(n);
                    }
                });

                return Promise.resolve(finalNodes);
            }

            //
            // Only top 'x' number of nodes are selected based on size
            //
            function topXSize(nodes, settings, overrideThresholding, callback) {
                var prefix = settings('prefix');
                var threshold = overrideThresholding ? 1 : settings('labelThreshold');
                var labelAttr = settings('labelAttr') || 'OriginalLabel', // the default label
                    selLabelAttr = settings('labelClickAttr') || labelAttr;

                //reject nodes with no labels
                var validNodes = _.reject(nodes, function (nd) { return (!nd.attr[labelAttr] || !nd.attr[selLabelAttr]); });
                console.log(validNodes);
                console.assert(threshold > 0, 'threshold should be greater than 0');
                //console.log('Applying topx strat for labels. Num of nodes to take:' + threshold);
                //var thresholdVal = Math.max(maxLabels, Math.floor(threshold*validNodes.length));
                var sortedNodes = validNodes.sort(function isSmallerInSize(n1, n2) {
                    if (isSelected(n1) === isSelected(n2)) // xnor
                        return n2[prefix + 'size'] - n1[prefix + 'size'];
                    else
                        return isSelected(n1) ? -1 : 1;
                });

                callback(sortedNodes);
            }

            //
            // Only top 'x' number of nodes are selected based on size and collision
            //
            function topXSizeCollision(nodes, settings, overrideThresholding, callback) {
                var prefix = settings('prefix');
                var threshold = overrideThresholding ? 1 : settings('labelThreshold');

                console.assert(threshold > 0, 'threshold should be greater than 0');
                var sortedNodes = nodes.sort(function isSmallerInSize(n1, n2) {
                    var order1 = selectOrder(n1), order2 = selectOrder(n2);
                    if (order1 == order2) { /// XNOR
                        if (n1.isGroup) return n2.count - n1.count;  // sort group nodes by group size

                        return n2[prefix + 'size'] - n1[prefix + 'size'];
                    }

                    return order2 - order1;
                });

                // selected nodes
                var selNodes = [];//_.filter(sortedNodes, isSelected);

                if (sortedNodes.length > 0) {
                    collisionCount = 0;
                    return optFilterCollisions(sortedNodes, settings).then(function (result) {
                        var labelsToShow = _.compact(result).concat(selNodes);

                        return labelsToShow;
                    });
                }

                return Promise.resolve(_.filter(sortedNodes || [], isSelected));
            }
            // 1st opt is to use closures to reduce computations -> done
            // Next:
            // use iteration instead of recursion -> done
            // use heapsort
            function optFilterCollisions(nodes, settings) {
                var nodeCache = {};
                var prefix = settings('prefix') || '';
                var labelSizeFunc = labelSizeFuncFactory(prefix, settings);
                var validNodes = _.reduce(nodes, function (accum, node) {
                    var fontSize1 = labelSizeFunc(node);
                    var labelText = labelRenderer.getLabel(node, settings);
                    if (labelText) {
                        var sz = labelRenderer.labelSizeFn(labelText.toString(), fontSize1);    // the label attribute might not be a string
                        var rect1 = {
                            x: labelRenderer.labelX(undefined, node, settings),
                            y: labelRenderer.labelY(undefined, node, settings),
                            width: sz.wd,
                            height: sz.ht
                        };
                        nodeCache[node.id] = {
                            size: fontSize1,
                            rect: rect1
                        };
                        return [
                            ...accum,
                            node
                        ]
                    }
                    return accum;
                }, []);
                // remove labels that are entirely offscreen
                validNodes = _.filter(validNodes, function (n) {
                    var rect = nodeCache[n.id].rect;
                    return (rect.x + rect.width > 0);
                });

                // A function to filter out all labels which intersect with the selected node
                var removeCollisions = function removeCollisions(selectedNode, listToTest) {
                    return _.filter(listToTest, function (nodeToTest) {
                        var rect1 = nodeCache[selectedNode.id].rect;
                        var rect2 = nodeCache[nodeToTest.id].rect;
                        if (rect1.x < rect2.x + rect2.width &&
                            rect1.x + rect1.width > rect2.x &&
                            rect1.y < rect2.y + rect2.height &&
                            rect1.height + rect1.y > rect2.y) {
                            return false;
                        }
                        return true;
                    });
                };
                // Remove collisions algo
                var nodesCount = renderGraphfactory.sig().graph.nodes().length;
                


                // Get groups with more than 1% of total nodes
                var largeGroups = validNodes.filter(x => x.count / nodesCount > 0.01);
                var groupsCount = largeGroups.length;
                
                if (groupsCount > 5) {
                    // If we have many large groups, include them plus any small groups that are spatially distant
                    var smallGroups = validNodes.filter(x => x.count / nodesCount <= 0.01);
                    var spatiallyDistantSmallGroups = smallGroups.filter(function(smallGroup) {
                        return isSpatiallyDistant(smallGroup, largeGroups, prefix);
                    });
                    
                    validNodes = largeGroups.concat(spatiallyDistantSmallGroups);
                }

                var selNodes = validNodes.filter(x => x.specialHighlight);
                var filteredList = [selNodes.length ? selNodes[0] : validNodes[0]],
                    listToTest = _.rest(validNodes);

                while (listToTest.length > 0) {
                    var selectedNode = _.last(filteredList);
                    // select all nodes in listToTest which don't collide with Selected Node
                    var noCollisionList = removeCollisions(selectedNode, listToTest, settings);
                    var newComer = noCollisionList[0];

                    if (Boolean(newComer)) {
                        filteredList.push(newComer);
                    }

                    listToTest = noCollisionList;
                }

                return Promise.resolve(filteredList)
            }

            //
            // Default renderer, generally called directly by sigma
            // Labels can be in default or selected state. Label would never be in hover state though.(hopefully)
            //
            function defRenderer(nodes, allnodes, d3Sel, settings, hasSubset) {
                var isTweening = settings('tweening'),
                    cssClass = sigma.d3.labels.cssClasses.baseCssClass, // the css class to apply for labels
                    cssGroup = sigma.d3.labels.cssClasses.cssGroupClass, // the css class to apply for group labels
                    strat = settings('labelDisplayStrat') == 'topx' ? topXSize : (settings('labelDisplayStrat') == 'threshold' ? thresholdStrat : topXSizeCollision);
                var prefix = settings('prefix') || '';
                var labelSizeFunc = labelSizeFuncFactory(prefix, settings);
                if (isTweening) {
                    d3Sel.selectAll('div').remove();
                    return; // no label rendering when tweening
                }

                d3Sel.selectAll('div').remove();
                const wGroupNodes = addGroupNodes(nodes, allnodes, settings, false, hasSubset);
                // Create final list of nodes with labels
                strat(wGroupNodes, settings, false).then(function (nodesToLabel) {
                    if (nodesToLabel.length > 0 && typeof _.last(nodesToLabel) !== "undefined") {
                        var sel = d3Sel.selectAll('div').data(nodesToLabel, nodeId);
                        const hasSubgroup = nodesToLabel.some(x => x.isSubGroup);
                        // create html element for holding the label if it does not exist in the selection.
                        sel.enter()
                            .append('div')
                            // Set the element position style
                            .style('position', 'absolute')
                            .style('font-size', function (node) { return toPx(labelSizeFunc(node)); })
                            .style('color', function (node) {
                                return node.isGroup ? node.clusterColorStr : undefined;
                            })
                            //.style('opacity', 0)
                            .classed(cssClass, true)
                            .classed(cssGroup, function (node) { return node.isGroup; })
                            .classed('d3-cluster-node', function (node) { return node.isGroup && !node.isSubGroup && hasSubgroup; })
                            .classed('d3-subgroup-node', function (node) { return node.isSubGroup; })
                            .append('p');

                        // For existing ones, set to the default state. (also updates for the newly creates ones above)
                        //sigma.d3.labels.labelDefaultState(sel, settings);

                        sel.each(function (node) {
                            labelRenderer.d3NodeLabelDefRender(node, d3.select(this), settings);
                        });

                        // Remove labels for nodes which don't exist
                        sel.exit().remove();
                    } else {
                        //console.warn('selection.nodesToLabel array is empty or corrupt', nodesToLabel);
                        d3Sel.selectAll('div').remove();
                    }
                });

            }

            ///
            /// Called by selection service when a user selects a node on the graph. the nodes list is of selected nodes and their neighbours
            ///
            function selRenderer(nodes, d3Sel, settings) {
                var prefix = settings('prefix') || '',
                    isTweening = settings('tweening'),

                    cssClass = sigma.d3.labels.cssClasses.baseCssClass, // the css class to apply for nodes
                    // cssSelectionClass = sigma.d3.labels.cssClasses.cssSelectionClass, // the css class to apply for nodes in selection
                    // cssHoverClass = sigma.d3.labels.cssClasses.cssHoverClass, // the css class to apply for nodes in hover
                    cssMarkTemp = 'internal-d3-sel-label-temp', // Marker for temp nodes.
                    cssHoverMarkTemp = 'internal-d3-hover-label-temp'; // Marker for temp nodes. INTERNAL
                var labelSizeFunc = labelSizeFuncFactory(prefix, settings);

                // util functions
                if (isTweening) {
                    console.error('Shouldn\'t be called during tweening');
                    return;
                }

                d3Sel.selectAll('.' + cssMarkTemp).remove();

                if (nodes.length === 0) {
                    d3Sel.selectAll('div').each(function (node) {
                        labelRenderer.d3NodeLabelDefRender(node, d3.select(this), settings);
                    });
                } else {
                    sigma.d3.labels.filterCollision(nodes, settings, true, function (nodesToLabel, labelsToHide) {
                        if (nodesToLabel.length > 0 && typeof _.last(nodesToLabel) !== "undefined") {
                            if (labelsToHide) {  // remove labels that are hidden by collision filtering
                                d3Sel.selectAll('div').data(labelsToHide, nodeId).remove();
                            }
                            var sel = d3Sel.selectAll('div').data(nodesToLabel, nodeId);

                            // Create node Label div to holding the label, if it does not already exist
                            // Since these were not already rendered, mark them and remove at end of selectioning.
                            sel.enter()
                                .append('div')
                                // Set the element position style
                                .style('position', 'absolute')
                                .style('font-size', function (node) { toPx(labelSizeFunc(node)); })
                                .classed(cssClass, true)
                                .classed(cssMarkTemp, true)
                                .append('p');

                            // For existing ones, update position and the label text.
                            d3Sel.selectAll('div').each(function (node) {

                                labelRenderer.d3NodeLabelDefRender(node, d3.select(this), settings);
                            });
                            //sigma.d3.labels.labelDefaultState(d3Sel.selectAll('div'), settings);

                            // If the node is marked with temp Hover state, then mark it with temp sel state.
                            d3Sel.selectAll('.' + cssHoverMarkTemp)
                                .classed(cssMarkTemp, true)
                                .classed(cssHoverMarkTemp, false);

                        } else {
                            console.warn('default.nodesToLabel array is empty or corrupt', nodesToLabel);
                            //d3Sel.selectAll('div').remove();
                        }
                    });
                }
            }

            ///
            /// Called by hover service when a user hovers or unhovers a node on the graph. The nodes list is of hovered nodes
            /// selNodes are the selected nodes.  Collision detection is run on both hovered and selected
            ///
            function hoverRenderer(nodes, selNodes, d3Sel, settings, hasSubset) {
                var prefix = settings('prefix') || '',
                    labelSizeFunc = labelSizeFuncFactory(prefix, settings),
                    cssClass = sigma.d3.labels.cssClasses.baseCssClass, // the css class to apply for nodes in hover
                    cssHoverClass = sigma.d3.labels.cssClasses.cssHoverClass, // the css class to apply for nodes in hover
                    cssHoverHideClass = sigma.d3.labels.cssClasses.cssHoverHideClass, // the css class to apply for nodes NOT in hover

                    cssMarkTemp = 'internal-d3-hover-label-temp'; // Marker for temp nodes. INTERNAL (used in Sel renderer)

                var allNodes = _.uniq(nodes.concat(selNodes));  // merge hovered and selected nodes
                if (labelRenderer.isGroupLabelHover) {
                    allNodes = addGroupNodes(allNodes, allNodes, settings, true, hasSubset);   // add group labels if enabled
                }

                sigma.d3.labels.filterCollision(allNodes, settings, true).then(function (nodes) {

                    var sel = d3Sel.selectAll('div').data(nodes, nodeId);

                    // Create node Label div to holding the label, if it does not already exist
                    // Since these were not already rendered, mark them and remove at end of hovering.
                    sel.enter()
                        .append('div')
                        // Set the element position style
                        .style('position', 'absolute')
                        .style('font-size', function (node) { return toPx(labelSizeFunc(node)); })
                        .classed(cssClass, true)
                        .classed(cssMarkTemp, true)
                        .append('p');
                    // For existing ones, update position, size and the label text.
                    sel
                        //                  .filter(function(n) { return !n.isGroup; })
                        .style('top', function (n) {
                            return toPx(labelRenderer.labelY(sel.filter(function (n2) { return n == n2; }), n, settings));
                        })
                        .style('left', function (n) {
                            return toPx(labelRenderer.labelX(sel.filter(function (n2) { return n == n2; }), n, settings));
                        });
                    sel
                        .classed(cssHoverClass, true)
                        .classed(cssHoverHideClass, false)
                        .style('color', function (node) { return node.isGroup ? node.clusterColorStr : undefined; })
                        .select('p')
                        .text(function (node) { return labelRenderer.getLabel(node, settings); })
                        //.transition().duration(200)
                        .style('font-size', function (node) { return toPx(labelSizeFunc(node)); });

                    if (nodes.length > 0) {
                        // There are nodes in hover state, so dim others and reset text
                        sel.exit()
                            .classed(cssHoverClass, false)
                            .classed(cssHoverHideClass, true)
                            .select('p')
                            .text(function (node) {
                                return labelRenderer.getLabel(node, settings);
                            });
                    } else {
                        // nothing in hover state, revert node labels to default state
                        // And remove temp nodes which are not selected
                        //console.log('[hoverRenderer] inSelMode: %s', inSelMode);

                        // remove temp labels on hovered nodes
                        d3Sel.selectAll('.' + cssMarkTemp)
                            .classed(cssMarkTemp, false)
                            .filter(function (n) {
                                return !(n.isSelected || n.isSelectedNeighbour);
                            }).remove();
                        // redraw labels
                        sel.exit()
                            .each(function (node) {
                                node.inHover = false;
                                labelRenderer.d3NodeLabelDefRender(node, d3.select(this), settings);
                            });
                    }

                });
            }

        }
    ]);
