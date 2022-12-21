angular.module('common')
.directive('dirPieChart', ['$rootScope', '$compile', '$timeout', 'AttrInfoService', 'dataGraph', 'projFactory', 'FilterPanelService', 'graphSelectionService', 'BROADCAST_MESSAGES',
function($rootScope, $compile, $timeout, AttrInfoService, dataGraph, projFactory, FilterPanelService, graphSelectionService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        template: '<div class="pie-chart" data-attr-id="{{attrToRender.id}}" ng-mouseleave="outPie()" ng-mousemove="overPie($event)">' +
                    '<div class="tooltip-positioner" uib-tooltip="{{tooltipText}}" tooltip-append-to-body="true" tooltip-is-open="openTooltip"></div>' +
                 '</div>' +
                  '<dir-checkbox-filter ng-if="showFilter" ng-class="{disableFilter: disableFilter}"></dir-checkbox-filter>',
        scope: true,
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirPieChart: ] ';

    //defined within link so has access to scope
    var tooltipText;
    var isOverD3Pie = false;

    var opts = {
        barColor: '#ffffff',
        textColor: '#444444',
        lineColor: '#b3b3b3',
        selectionColor: '#bdbdbd',
        maxSegments: 12,
        others_segment_id: 'others_piechart',
        width: 280,
        height: 280,
        outerRadius: 140,
        innerRadius: 0,
        lineLength: 100,
        labelFontSize: 10,
        labelYMargin: 5
    };


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element, attrs, renderCtrl) {
        var pie; //Pie element
        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id);
        var pieSettings = _.cloneDeep(opts);
        var pieContainer = element[0].children[0];
        var pieData = {
            selectedNodes: [],
            barSelectionMap: {},
            innerRadius: opts.innerRadius,
            outerRadius: opts.outerRadius,
            nodeOverlay: scope.isNodeFocus == 'true',
            compareView: renderCtrl.isCompareView()
        };
        var mappTheme = projFactory.getProjectSettings().theme || 'light';
        var hasInitialSelection = false; // To check if initial selection is in place before updating current selection.

        scope.tooltipText = '';
        scope.showTooltip = false;


        //if in node detail, adjust settings
        if(pieData.nodeOverlay || pieData.compareView) {
            pieData.outerRadius = 100;
            pieSettings.width = 440;
            pieSettings.height = 400;
        }

        // Refresh selection slices on selection change
        scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function(e, payload) {
            try {
                if(payload.nodes.length === 0) {
                    hasInitialSelection = false;
                }
                else {
                    hasInitialSelection = true;
                }
                highlightNewSelection(pie, attrInfo, pieData, renderCtrl, payload.nodes, pieSettings);
            } catch(e) {
                console.error(logPrefix + "pie selection update throws error", e.stack, e);
            }
        });

        scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function(e, data) {
            try {
                if(!hasInitialSelection) {
                    hasInitialSelection = true;
                    highlightNewSelection(pie, attrInfo, pieData, renderCtrl, data.nodes, pieSettings);
                }
                else {
                    if(_.isEmpty(data.nodes)) {
                        highlightNewSelection(pie, attrInfo, pieData, renderCtrl, data.nodes, pieSettings);
                    }
                    highlightSelectionDiff(pie, attrInfo, pieData, renderCtrl, data.nodes);
                }
            } catch(e) {
                console.error(logPrefix + "highlighting selection difference throws error", e.stack, e);
            }
        });

        $rootScope.$on(BROADCAST_MESSAGES.project.changeTheme, function(e, data) {
            mappTheme = data.theme;
            changeThemeColors(pieSettings, mappTheme);
            updatePieColors(pie, pieSettings);
        });

        // Create pie chart
        try {
            var initialSelection = FilterPanelService.getInitialSelection();
            changeThemeColors(pieSettings, mappTheme);
            pie = createGlobalDistribution(pieContainer, attrInfo, pieData, pieSettings, renderCtrl);

            if(!_.isEmpty(initialSelection)) {
                highlightNewSelection(pie, attrInfo, pieData, renderCtrl, initialSelection, pieSettings);
                if(initialSelection.length > 1) {
                    highlightSelectionDiff(pie, attrInfo, pieData, renderCtrl, FilterPanelService.getCurrentSelection());
                }
            }
            else {
                highlightNewSelection(pie, attrInfo, pieData, renderCtrl, FilterPanelService.getCurrentSelection(), pieSettings);
            }
        } catch(e) {
            console.error(logPrefix + "pie creation throws error", e.stack, e);
        }

        scope.outPie = function() {
            $timeout(function() {
                scope.openTooltip = false;
            }, 101);
        };

        scope.overPie = function(event) {
            scope.tooltipText = tooltipText;
            element.find('.tooltip-positioner').css({
                top : event.offsetY,
                left : event.offsetX
            });
            scope.openTooltip = false;
            if(isOverD3Pie) {
                $timeout(function() {
                    scope.openTooltip = true;
                }, 100);
            }
        };
    }



    /*************************************
    ************ Local Functions *********
    **************************************/

    function getSelectionColor(nodes) {
        if(_.keys(_.indexBy(nodes, 'colorStr')).length === 1) {
            return nodes[0].colorStr;
        }
        else {
            return opts.selectionColor;
        }
    }

    function getBarSelectionMap(nodes, id) {
        var nodeAttrVal;
        var result = {};
        _.each(nodes, function(node) {
            nodeAttrVal = node.attr[id];
            if(result[nodeAttrVal] == null) {
                result[nodeAttrVal] = {
                    count: 1,
                    nodeIds: [node.id]
                };
            }
            else {
                result[nodeAttrVal].count++;
                result[nodeAttrVal].nodeIds.push(node.id);
            }
        });
        return result;
    }

    function getSelectionPathData(origSliceData, selectedNodeIds) {
        if(!_.isArray(selectedNodeIds)) throw new Error('Array expected');
        var selectionCount = selectedNodeIds.length;
        var sliceNodeCount = origSliceData.value;
        var selectionFraction = selectionCount/sliceNodeCount;
        var selectionAngle = (origSliceData.endAngle - origSliceData.startAngle)*selectionFraction;
        return {
            endAngle: selectionAngle + origSliceData.startAngle,
            startAngle: origSliceData.startAngle,
            padAngle: origSliceData.padAngle,
            value: selectionCount,
            data: {
                nodeIds: selectedNodeIds,
                id: origSliceData.data.id,
                label: origSliceData.data.label,
                perc: selectionFraction*100
            }
        };
    }

    function getSelectionArc(selectionSlice, innerRadius, outerRadius) {
        return d3.svg.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(selectionSlice.startAngle)
            .endAngle(selectionSlice.endAngle);
    }

    function getShrinkedArc(startAngle, outerRadius, innerRadius) {
        var shrinkedAngleObj = {
            startAngle: startAngle,
            endAngle: startAngle
        };
        return getSelectionArc(shrinkedAngleObj, outerRadius, innerRadius);
    }

    function createGlobalDistribution(pieContainer, attrInfo, pieData, pieSettings, renderCtrl) {
        var uniqueSegments = _.pick(attrInfo.valuesCount, attrInfo.values.slice(0).reverse().slice(0, opts.maxSegments));
        var othersSegment = _.omit(attrInfo.valuesCount, _.keys(uniqueSegments));
        var othersSegmentNodeIds = []; //Node Ids of all other values

        // Create slices
        var dataSegments = [];
        _.each(uniqueSegments, function(val, key) {
            dataSegments.push({
                id: key,
                label: key,
                value: val,
                perc: (val*100)/attrInfo.nValues
            });
        });

        // Others segment
        dataSegments.push({
            id: opts.others_segment_id,
            label: 'Others',
            value: _.reduce(othersSegment, function(res, val, key) {
                othersSegmentNodeIds = othersSegmentNodeIds.concat(dataGraph.getNodesByAttrib(attrInfo.attr.id, key));
                return res + val;
            }, 0)
        });

        var lastSlice = _.last(dataSegments);
        lastSlice.perc = (lastSlice.value*100)/attrInfo.nValues;

        console.log(logPrefix + 'pie data: ', dataSegments);

        var width = pieSettings.width;
        var height = pieSettings.height;
        // pieData.outerRadius = Math.min(width, height)/2;

        var svg = d3.select(pieContainer)
          .append('svg')
          .attr('width', width)
          .attr('height', height)
          .append('g')
          .attr('transform', 'translate(' + (width / 2) +  ',' + (height / 2) + ')');

        var arc = d3.svg.arc()
                    .outerRadius(pieData.outerRadius)
                    .innerRadius(pieData.innerRadius);

        var pie = d3.layout.pie()
                    .value(function(d) { return d.value; })
                    .sort(null);

        var d3PieData = pie(dataSegments);
        console.log(logPrefix + 'd3 pie data: ', d3PieData);

        var g = svg.selectAll('path')
                    .data(d3PieData)
                    .enter()
                    .append('g')
                    .attr("class", "elem-child-highlight");

        // Append global slice
        g.append('path')
            .attr('d', arc)
            .attr('stroke', pieSettings.lineColor)
            .attr('stroke-width', '1')
            .attr('fill', pieSettings.barColor)
            .attr('data-main-slice', true);

        // Append selection slice
        g.append('path')
            .attr("data-selection", "true");

        // Append filtered sleection slice
        g.append('path')
            .attr("data-filt-selection", "true");

        // Append texts
        g.append("text")
            .attr('fill', pieSettings.textColor)
            .attr("transform", function(d) {
                var c = arc.centroid(d);
                return "translate(" + c[0]*1.3 +"," + c[1]*1.3 + ")";
            })
            .attr("dy", ".30em")
            .style("text-anchor", "middle")
            .text(function(d) {
                if(d.endAngle - d.startAngle >= 0.25) {
                    return Math.floor(d.data.perc) + '%';
                }
            });

        if(pieData.nodeOverlay || pieData.compareView) {
            var labelsStartPosnArr = [];

            g.each(function(d) {
                var slice = d3.select(this),
                    c = arc.centroid(d),
                    midAngle = Math.atan2(c[1], c[0]),
                    x1 = c[0] * 2,
                    y1 = c[1] * 2,
                    x2 = Math.cos(midAngle) * pieSettings.lineLength,
                    y2 = Math.sin(midAngle) * pieSettings.lineLength;

                var nearByYPosnArr = _(labelsStartPosnArr)
                                        .filter(function(val) {
                                            return Math.sign(x1) == Math.sign(val.x1) && (Math.sign(val.y1) * val.y1) > y1;
                                        })
                                        .map('y2')
                                        .value();

                console.log(logPrefix + 'MOD ARR: ', nearByYPosnArr);
                if(_.any(nearByYPosnArr, function(yVal) {
                    return Math.abs(y2 - yVal) < (pieSettings.labelFontSize + 2*pieSettings.labelYMargin);
                })) {
                    y2 = _.chain(nearByYPosnArr)
                            .filter(function(val) {
                                return (val * Math.sign(y2) > 0) && (Math.abs(val) > Math.abs(y1) );
                            })
                            .tap(function(arr) {
                                if(_.isEmpty(arr)) {
                                    arr.push(y2);
                                }
                            })
                            .max(function(val) { return Math.abs(val); })
                            .chain()
                            .thru(function(val) {
                                return Math.sign(y2) * (Math.abs(val) + pieSettings.labelFontSize + 2*pieSettings.labelYMargin);
                            })
                            .value();
                }

                labelsStartPosnArr.push({x1: x1, y1: y1, y2: y2});

                slice
                    .append('line')
                    .attr({
                        'stroke-width': 1,
                        stroke: pieSettings.lineColor,
                        x1: x1,
                        y1: y1,
                        x2: x2,
                        y2: y2
                    });

                slice
                    .append('text')
                    .attr({
                        stroke: pieSettings.textColor,
                        x: x2 + 3*(x2 > 0 ? 1 : -1),
                        y: y2,
                        'text-anchor': x2 > 0 ? 'start' : 'end'
                    })
                    .text(_.trunc(d.data.label), 20)
                    .style({
                        'font-size': pieSettings.labelFontSize + 'px'
                    });
            });

        }

        g.on('mouseover', function(segment) {
            var data = segment.data;
            var targetElem = d3.select(d3.event.target);
            if(targetElem.attr('data-selection') == 'true' || targetElem.attr('data-filt-selection') == 'true') {
                // Selection arc hover
                renderCtrl.hoverNodeIdList(pieData.barSelectionMap[data.id].nodeIds, window.event);
            }
            else if(targetElem.attr('data-filt-selection') == 'true') {
                // Filtered selection hover
            }
            else {
                // Whole slice hover
                if(data.id == opts.others_segment_id) {
                    renderCtrl.hoverNodeIdList(othersSegmentNodeIds, window.event);
                }
                else {
                    renderCtrl.hoverNodesByAttrib(attrInfo.attr.id, data.label, window.event);
                }
            }
            isOverD3Pie = true;
            if(pieData.compareView && attrInfo.attr.id == 'Cluster') {
                tooltipText = _.get(renderCtrl.getClusterMeta(), data.label + '.descr');
            }
            else {
                tooltipText = data.label + ' (' + (data.perc).toFixed(2) + '%)';
            }

        });

        // g.on('mousemove', function(segment) {
        //     var data = segment.data;
        //     // tooltipText = data.label;
        // });

        g.on('mouseout', function() {
            renderCtrl.unHoverNodes();
            isOverD3Pie = false;
        });

        g.on('click', function(segment) {
            var data = segment.data;
            var targetElem = d3.select(d3.event.target);
            if(targetElem.attr('data-selection') == 'true' || targetElem.attr('data-filt-selection') == 'true') {
                // Selection arc select
                renderCtrl.selectNodeIdList(pieData.barSelectionMap[data.id].nodeIds, window.event);
            }
            else {
                // Whole slice select
                if(data.id == opts.others_segment_id) {
                    renderCtrl.selectNodeIdList(othersSegmentNodeIds, window.event);
                }
                else {
                    renderCtrl.selectNodesByAttrib(attrInfo.attr.id, data.label, window.event);
                }
            }
        });

        return g;
    }

    function highlightNewSelection(pie, attrInfo, pieData, renderCtrl, initialSelection, pieSettings) {
        var principalNode = null;

        if(initialSelection.length === 1) {
            principalNode = initialSelection[0];
            initialSelection = FilterPanelService.getNodesForSNCluster();
        }

        pieData.selectedNodes = initialSelection;
        pieData.barSelectionMap = getBarSelectionMap(pieData.selectedNodes, attrInfo.attr.id);
        console.log(logPrefix + 'selection value group map: ', pieData.barSelectionMap);
        var selectionColor = getSelectionColor(pieData.selectedNodes);

        pie.each(function(d) {
            // Clear selection bars
            // Clear previous selection bars
            var pieSlice = d3.select(this);
            var globalBar = pieSlice.selectAll('[data-main-slice="true"]');
            var selectionBars = pieSlice.selectAll('[data-selection="true"]');
            var filteredSelBars = pieSlice.selectAll('[data-filt-selection="true"]');
            // console.log(logPrefix + 'removing selection bars if any: ', selectionBars);
            globalBar.attr('opacity', 1);
            globalBar.style({
                fill: pieSettings.barColor
            });

            // 1) Shrink filtered selection bars
            filteredSelBars.attr('d', getShrinkedArc(d.startAngle, pieData.outerRadius, pieData.innerRadius));

            // 2) Update selection bars
            var opacity = 1;
            if(principalNode) {
                opacity = 0.4;
                if(principalNode.attr[attrInfo.attr.id] == d.data.id) {
                    opacity = 1;
                    // globalBar.attr('opacity', 0.7);
                    globalBar.style({
                        fill: window.mappr.utils.getLightColorStr(pieSettings.barColor, 2)
                    });
                }
            }
            selectionBars.attr('opacity', opacity);

            var newArc;
            if(_.has(pieData.barSelectionMap, d.data.id)) {
                var selectionArcData = getSelectionPathData(d, pieData.barSelectionMap[d.data.id].nodeIds);
                pieData.barSelectionMap[d.data.id].arcData = selectionArcData;
                newArc = getSelectionArc(selectionArcData, pieData.outerRadius, pieData.innerRadius);

                selectionBars
                    .attr('fill', selectionColor);
            }
            else {
                newArc = getShrinkedArc(d.startAngle, pieData.outerRadius, pieData.innerRadius);
            }

            selectionBars
                .transition()
                .duration(1000)
                .attr('d', newArc);

        });
    }

    function highlightSelectionDiff(pie, attrInfo, pieData, renderCtrl, filteredNodes) {
        var filtSelValMap = getBarSelectionMap(filteredNodes, attrInfo.attr.id);
        console.log(logPrefix + 'filtered selection value group map: ', filtSelValMap);
        var selectionColor = getSelectionColor(pieData.selectedNodes);

        pie.each(function(d) {
            var pieSlice = d3.select(this);
            var selectionBars = pieSlice.selectAll('[data-selection="true"]');
            var filteredSelBars = pieSlice.selectAll('[data-filt-selection="true"]');

            selectionBars.attr('opacity', 0.3);

            var newArc;
            if(_.has(filtSelValMap, d.data.id)) {
                var selectionArcData = getSelectionPathData(d, filtSelValMap[d.data.id].nodeIds);
                newArc = getSelectionArc(selectionArcData, pieData.outerRadius, pieData.innerRadius);

                filteredSelBars
                    .attr('fill', selectionColor);
            }
            else {
                newArc = getShrinkedArc(d.startAngle, pieData.outerRadius, pieData.innerRadius);
            }

            filteredSelBars
                .transition()
                .duration(1000)
                .attr('d', newArc);

        });
    }

    function updatePieColors(pie, pieSettings) {
        pie.each(function() {
            var pieSlice = d3.select(this);

            pieSlice.select('[data-main-slice="true"]')
                .attr('stroke', pieSettings.lineColor)
                .attr('fill', pieSettings.barColor);

            pieSlice.select('text')
                .attr('fill', pieSettings.textColor);
        });
    }

    function changeThemeColors(settings, theme) {
        console.log('mapppTheme: ', theme);
        if(theme == 'dark') {
            settings.barColor = '#444444';
            settings.lineColor = '#cccccc';
            settings.textColor = '#ffffff';
        }
        else {
            settings.barColor = '#ffffff';
            settings.lineColor = '#b3b3b3';
            settings.textColor = '#444444';
        }
    }

    return dirDefn;
}
]);
