angular.module('common')
    .directive('dirHistogram', ['$timeout', 'AttrInfoService', 'projFactory', 'FilterPanelService', 'BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService', 'dataGraph',
        function ($timeout, AttrInfoService, projFactory, FilterPanelService, BROADCAST_MESSAGES, hoverService, selectService, subsetService, dataGraph) {
            'use strict';

            /*************************************
            ******** Directive description *******
            **************************************/
            var dirDefn = {
                restrict: 'AE',
                require: '?^dirAttrRenderer',
                template: '<div class="histogram" ng-mouseleave="outBar()" ng-mousemove="overBar($event)">' +
                    '<div class="tooltip-positioner" uib-tooltip="{{tooltipText}}" tooltip-append-to-body="true" tooltip-is-open="openTooltip"></div>' +
                    '</div>' +
                    '<dir-range-filter ng-if="showFilter" ng-class="{disableFilter: disableFilter}" attr="attrInfo" log="isLogScale"></dir-range-filter>' +
                    `<div ng-show="hasLogScale" class="log-scale-toggle">
                        <input type="checkbox" ng-change="toggleLogScale()" ng-model="isLogScale"/>
                        <label>log</label>
                    </div>`,
                link: postLinkFn
            };

            /*************************************
            ************ Local Data **************
            **************************************/
            window.mappr.stats = window.mappr.stats || {};
            window.mappr.stats.distr = window.mappr.stats.distr || {};

            var logPrefix = '[dirHistogram] ';
            // var _log = window.console.log.bind(window.console);
            var _log = _.noop;

            var tooltipText;

            var defaultOpts = {
                marginTop: 10,
                marginBottom: 15,
                catMarginBottom: 75,
                marginLeft: 30,
                marginRight: 10,
                // barColor: '#555555',
                barColor: '#D8D8D8',
                barColorAfterSelection: '#D8D8D8',
                strokeColor: '#000',
                textColor: '#000',
                clickColor: '#424242',
                selectionDefaultColor: '#315F6B',
                highlightColor: '#666',
                strokeWidth: 0.5,
                histWidth: 370,
                histHeight: 75,
                categoricalHeight: 200,
                binCount: 18,
                maxBinCount: 18,
                minBinWidth: 18,
                xTickCount: 8,
                yTickCount: 4,
                tickWidth: 2,
                minSelectionHeight: 3,
                barPadding: 2,
                datetimeLabelHeight: 45,
                yearLabelHeight: 18
            };

            var maxTickValue = 0;
            var initAxis = null;
            var isLogScaleById = {};

            /*************************************
            ******** Controller Function *********
            **************************************/


            /*************************************
            ******** Post Link Function *********
            **************************************/
            function postLinkFn(scope, element, attrs, renderCtrl) {
                var histoBars; // Ref for histo svg bars
                var mappTheme = projFactory.getProjectSettings().theme || 'light';
                var attrInfo;
                var defaultAttrInfo = _.cloneDeep(AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id));
                var logAttrInfo = _.cloneDeep(AttrInfoService.getNodeAttrInfoForRG().getForLogId(scope.attrToRender.id));
                scope.hasLogScale = !!logAttrInfo;
                attrInfo = defaultAttrInfo;
                scope.attrInfo = defaultAttrInfo;
                isLogScaleById[scope.attrToRender.id] = false;
                scope.isLogScale = false;
                var histElem = element[0].childNodes[0];
                var tooltip = element.find(".d3-tip");

                //for dark or node detail theme
                if (scope.isNodeFocus || mappTheme == 'dark') {
                    defaultOpts.barColor = '#555';
                    defaultOpts.strokeColor = '#ccc';
                    defaultOpts.textColor = '#ccc';
                    defaultOpts.clickColor = '#c4c4c4';
                    defaultOpts.highlightColor = '#999';
                }

                var histoData = {
                    selectedNodes: [],
                    d3Data: [],
                    isOrdinal: false,
                    isNodeFocus: scope.isNodeFocus,
                    isCompareView: renderCtrl.isCompareView(),
                    xScaleFunc: _.noop,
                    yScaleFunc: _.noop,
                    width: 0,
                    height: 0,
                    barWidth: 0,
                    binCount: 0,
                    opts: _.clone(defaultOpts),
                    intVarData: {},
                    binType: getBinType(attrInfo),
                    xAxisType: (function () {
                        var attrType = attrInfo.attr.attrType;
                        if (attrType == 'timestamp') { return 'dateTime'; }
                        else if (attrType == 'year') { return 'year'; }
                        else { return 'default'; }
                    }()),
                    yAxisType: (function () {
                        return 'default';
                    }())
                };

                if (histoData.xAxisType == 'dateTime') {
                    histoData.opts.histHeight += histoData.opts.datetimeLabelHeight;
                    histoData.opts.marginBottom += histoData.opts.datetimeLabelHeight;
                }
                else if (histoData.xAxisType == 'year') {
                    histoData.opts.histHeight += histoData.opts.yearLabelHeight;
                    histoData.opts.marginBottom += histoData.opts.yearLabelHeight;
                }
                if (histoData.binType == 'categorical') {
                    histoData.opts.histHeight = histoData.opts.categoricalHeight;
                    histoData.opts.marginBottom = histoData.opts.catMarginBottom;
                }

                var hasInitialSelection = false; // To check if initial selection is in place before updating current selection.

                // Override dirAttrRenderer's controller's getBinCount function
                // Histogram uses dynamic number of bins which may or may not be different than attrInfo.nBins
                renderCtrl.getBinCount = function () {
                    return histoData.binCount ? histoData.binCount : 18;
                };

                scope.$on(BROADCAST_MESSAGES.hss.select, function (ev, payload) {
                    var nodes = selectService.selectedNodes.length == subsetService.currentSubset().length ? [] : payload.nodes;
                    updateSelectionBars(histoBars, nodes, attrInfo, histoData, mappTheme, false, histElem, renderCtrl);
                    updateFiltSelBars(histoBars, nodes, attrInfo, histoData);
                });

                scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function (ev, payload) {
                    var infoMap = AttrInfoService.buildAttrInfoMap(scope.attrToRender, payload.nodes);
                    defaultAttrInfo = infoMap.infoObj;
                    logAttrInfo = infoMap.logInfoObj;
                    if (scope.isLogScale) {
                        scope.attrInfo = logAttrInfo;
                        attrInfo = logAttrInfo;
                    } else {
                        scope.attrInfo = defaultAttrInfo;
                        attrInfo = defaultAttrInfo;
                    }
                    redrawHistogram(attrInfo, payload.nodes);
                });

                // Create global distributions & selection bars
                try {
                    var initialSelection = FilterPanelService.getInitialSelection();
                    histoBars = createGlobalDistribution(histElem, tooltip, attrInfo, renderCtrl, histoData);

                    if (!_.isEmpty(initialSelection)) {
                        updateSelectionBars(histoBars, initialSelection, attrInfo, histoData, mappTheme, initialSelection.length === 1, histElem, renderCtrl);
                        if (initialSelection.length > 1) {
                            updateFiltSelBars(histoBars, FilterPanelService.getCurrentSelection(), attrInfo, histoData);
                        }
                    }
                    else {
                        updateSelectionBars(histoBars, FilterPanelService.getCurrentSelection(), attrInfo, histoData, mappTheme, false, histElem, renderCtrl);
                    }

                    redrawHistogram(attrInfo);
                } catch (e) {
                    console.error(logPrefix + "creating global distribution throws error", e.stack, e);
                }

                scope.toggleLogScale = function () {
                    if (scope.isLogScale) {
                        scope.attrInfo = logAttrInfo;
                        attrInfo = logAttrInfo;
                    } else {
                        scope.attrInfo = defaultAttrInfo;
                        attrInfo = defaultAttrInfo;
                    }
                    attrInfo.isLogScale = isLogScaleById[attrInfo.attr.id] = scope.isLogScale;
                    redrawHistogram(attrInfo);
                }

                scope.outBar = function () {
                    $timeout(function () {
                        scope.openTooltip = false;
                    }, 101);
                };

                scope.overBar = function (event) {
                    scope.tooltipText = tooltipText;
                    element.find('.tooltip-positioner').css({
                        top: event.offsetY - 20,
                        left: event.offsetX
                    });
                    scope.openTooltip = false;
                    $timeout(function () {
                        scope.openTooltip = true;
                    }, 100);
                };

                function redrawHistogram(attrInfo, nodes) {
                    animateRemoval(histElem, histoData);

                    $timeout(function () {
                        while (histElem.firstChild) {
                            histElem.removeChild(histElem.lastChild);
                        }
                        histoData.binType = getBinType(attrInfo);
                        histoBars = createGlobalDistribution(histElem, tooltip, attrInfo, renderCtrl, histoData, nodes);
                        $timeout(function () {
                            updateSelectionBars(histoBars, [], attrInfo, histoData, mappTheme, false, histElem, renderCtrl);
                        }, 500);
                    }, 500);
                }
            }



            /*************************************
            ************ Local Functions *********
            **************************************/
            // Number formatting
            var SIFormatter = d3.format("s");
            var floatFormatter = d3.format(",.2f");

            function getBinType(attrInfo) {
                if (attrInfo.isNumeric) {
                    if (attrInfo.isInteger || attrInfo.attr.attrType == 'year') {
                        if (attrInfo.nBins < defaultOpts.binCount
                            && _.every(attrInfo.bins, function (bin) { return bin.max === bin.min; })) {
                            return 'int_unique'; // 1 value per bin
                        }
                        else {
                            return 'int_variable'; // Multiple values per bin
                        }
                    }
                    else {
                        return 'default'; // Float values
                    }
                }
                else {
                    return 'categorical'; // Categorical values
                }
            }

            function sanitizeYPosn(y, histoHeight, opts) {
                if (histoHeight - y >= opts.minSelectionHeight) {
                    return y;
                }
                else {
                    return histoHeight - opts.minSelectionHeight;
                }
            }

            function resetAllBarsColor(elem, opts) {
                elem.style({
                    fill: opts.barColor
                });
            }

            function setColor(color) {
                var barElem = d3.select(this);
                barElem.style({
                    fill: color
                });
            }

            function setTooltipText(data, isNumeric, xAxisType, binType) {
                if (!isNumeric) {
                    tooltipText = data.label;
                }
                else {
                    if (binType == 'int_unique') {
                        tooltipText = window.mappr.utils.numericString(data[0]);
                    }
                    else if (binType == 'int_variable') {
                        tooltipText = window.mappr.utils.numericString(data.x) + ' - ' + window.mappr.utils.numericString(data.x + data.dx - 1);
                    }
                    else if (xAxisType === 'dateTime') {
                        tooltipText = formatTimestamp(data.x, 'YYYY/MM/DD') + ' - ' + formatTimestamp(data.x + data.dx, 'YYYY/MM/DD');
                    }
                    else {
                        tooltipText = window.mappr.utils.numericString(data.x) + ' - ' + window.mappr.utils.numericString(data.x + data.dx);
                    }
                }
            }

            function formatTimestamp(val, format) {
                if (!window.moment(val).isValid()) throw new Error('Invalid timestamp!');
                return window.moment.unix(val).format(format);
            }

            function suggestBinCount(attrInfo, binType, opts) {
                var binCount;
                if (binType == 'int_unique') {
                    binCount = attrInfo.nBins;
                }
                else if (binType == 'categorical') {
                    binCount = attrInfo.values.length;
                }
                else {
                    binCount = opts.binCount;
                }
                return binCount;
            }

            function getSelectionValuesMap(nodes, attrId) {
                var result = {};

                _.each(nodes, function (node) {
                    var nodeVal = node.attr[attrId];
                    if (result[nodeVal] == null) {
                        result[nodeVal] = {
                            count: 1,
                            nodeIds: [node.id]
                        };
                    }
                    else {
                        result[nodeVal].count++;
                        result[nodeVal].nodeIds.push(node.id);
                    }
                });

                return result;
            }

            function mapSelectionToBars(attrId, selectionDataMap, histoData, isNumeric) {
                var histoRangeList = [];
                var selectionValues = _.keys(selectionDataMap);

                if (isNumeric) {
                    _.each(histoData, function (barData, i) {
                        var min = isLogScaleById[attrId] ? Math.pow(10, barData.x) : barData.x;
                        var max = isLogScaleById[attrId] ? Math.pow(10, barData.x + barData.dx) : (barData.x + barData.dx);
                        var valsInRange = _.filter(selectionValues, function (val) {
                            if (histoData.length == i + 1)
                                return val >= min && val <= max;
                            else
                                return val >= min && val < max;
                        });
                        var valsCountInRange = 0;
                        var nodeIds = [];
                        _.each(valsInRange, function (val) {
                            valsCountInRange += selectionDataMap[val].count;
                            nodeIds = nodeIds.concat(selectionDataMap[val].nodeIds);
                        });

                        histoRangeList.push({
                            min: barData.x,
                            max: barData.x + barData.dx,
                            selectionCount: valsCountInRange,
                            nodeIds: nodeIds
                        });
                    });
                }
                else {
                    _.each(histoData, function (barData) {
                        var valsInRange = _.filter(selectionValues, function (val) {
                            return val == barData.label;
                        });
                        var valsCountInRange = 0;
                        var nodeIds = [];
                        _.each(valsInRange, function (val) {
                            valsCountInRange += selectionDataMap[val].count;
                            nodeIds = nodeIds.concat(selectionDataMap[val].nodeIds);
                        });

                        histoRangeList.push({
                            min: null,
                            max: null,
                            selectionCount: valsCountInRange,
                            nodeIds: nodeIds
                        });
                    });
                }

                var max = _.reduce(histoRangeList, function (acc, cv) {
                    if (acc < cv.selectionCount) acc = cv.selectionCount;

                    return acc;
                }, 0);


                // var totalMax = _.reduce(Object.keys(totalResult), function (acc, cv) {
                //     var elem = totalResult[cv];
                //     if (acc < elem.count) acc = elem.count;

                //     return acc;
                // }, 0);

                // var totalCount = subsetService.subsetNodes && subsetService.subsetNodes.length ? subsetService.subsetNodes.length : dataGraph.getAllNodes().length;
                _.each(histoRangeList, function (r) {
                    r.selectionCount = max > 0 ? (r.selectionCount / max * maxTickValue) : r.selectionCount;
                    // result[r].totalCount = totalCount
                });

                return histoRangeList;
            }

            function getSelectionColor(nodes, opts) {
                if (_.keys(_.indexBy(nodes, 'colorStr')).length === 1) {
                    return nodes[0].colorStr;
                }
                else {
                    return opts.selectionDefaultColor;
                }
            }

            function getDomain(attrInfo, isNumeric, binType, intVarData) {
                if (isNumeric) {
                    if (binType == 'int_variable' || binType == 'int_unique') {
                        return [intVarData.roundMinVal, intVarData.roundMaxVal];
                    }
                    else {
                        return [attrInfo.bounds.min, attrInfo.bounds.max];
                    }
                }
                else {
                    return _.map(attrInfo.values, function (val) { return val.toString(); }).reverse();
                }
            }

            function generateD3Data(attrInfo, binCount, isNumeric, x, binThresholds, binType) {
                var values = attrInfo.values;
                var valuesCount = attrInfo.valuesCount;
                if (isNumeric) {
                    if (binType == 'int_variable' || binType == 'int_unique') {
                        return d3.layout.histogram()
                            .bins(binThresholds)(values);
                    }
                    else {
                        return d3.layout.histogram()
                            .bins(binCount)(values);
                    }
                }
                else if (attrInfo.isYear) {
                    return d3.layout.histogram()
                        .bins(x.ticks(binCount))(values);
                }
                else {
                    return _.reduce(values, function (res, val) {
                        res.push({
                            y: valuesCount[val],
                            label: val
                        });
                        return res;
                    }, []);
                }
            }

            function generateXScale(attrInfo, width, isNumeric, binType, intVarData) {
                var scale;
                if (isNumeric) {
                    scale = d3.scale.linear()
                        .domain(getDomain(attrInfo, isNumeric, binType, intVarData))
                        .range([0, width]);
                }
                else {
                    scale = d3.scale.ordinal()
                        .domain(getDomain(attrInfo, isNumeric))
                        .rangeBands([0, width]);
                }
                return scale;
            }

            function generateYScale(attrInfo, height, data) {
                var scale;
                scale = d3.scale.linear()
                    .domain([0, d3.max(data, function (d) { return d.y; })])
                    .range([height, 0]);
                return scale;
            }

            function formatNumber(val) {
                //@bimal check and resolve - if(Math.abs(val) < 1 && (val % 1 !== 0)) {
                if ((val % 1 !== 0)) {
                    return floatFormatter(val);
                }
                else {
                    return SIFormatter(val);
                }
            }

            function getBarXPosn(d, i, binType, barWidth) {
                if (binType == 'int_unique') {
                    return -1 * (barWidth / 2);
                }
                else {
                    return 1;
                }
            }

            function getBinThresholds(attrInfo, opts, histoData) {
                var minVal = attrInfo.bounds.min,
                    maxVal = attrInfo.bounds.max,
                    bins = attrInfo.bins,
                    roundMinVal,
                    roundMaxVal,
                    range = maxVal - minVal,
                    binThresholds = [];

                if (histoData.binType == 'int_unique') {
                    binThresholds = _.map(bins, 'max');
                    var binInterval = bins.length > 1 ? bins[1].max - bins[0].max : 1;
                    if (bins[0].count > 0) {
                        binThresholds.unshift(bins[0].max - binInterval);
                    }
                    if (_.last(bins).count > 0) {
                        binThresholds.push(_.last(bins).max + binInterval);
                    }
                    histoData.intVarData.roundMinVal = _.head(binThresholds);
                    histoData.intVarData.roundMaxVal = _.last(binThresholds);
                    binThresholds.push(_.last(binThresholds) + 1);
                    return binThresholds;
                }

                var valsPerBin = Math.ceil(range / opts.maxBinCount);

                // Round valsPerBin
                var binCount = opts.maxBinCount;
                var x = Math.pow(10, valsPerBin.toString().length - 1);
                valsPerBin = Math.ceil(valsPerBin / x) * x;
                x = Math.pow(10, valsPerBin.toString().length - 1);
                roundMinVal = Math.floor(minVal / x) * x;

                histoData.intVarData.roundMinVal = roundMinVal;

                // Build thresholds list
                binThresholds[0] = roundMinVal;
                for (var i = 1; i <= binCount; i++) {
                    binThresholds[i] = roundMinVal + i * valsPerBin;
                    if (binThresholds[i] >= maxVal) {
                        binCount = i;
                        roundMaxVal = binThresholds[i] + valsPerBin;
                        break;
                    }
                }
                binThresholds.push(roundMaxVal);

                histoData.intVarData.roundMaxVal = roundMaxVal;
                console.log(logPrefix + 'bin thresholds for int_variable: ', binThresholds);
                return binThresholds;
            }

            function animateRemoval(histElem, histoData) {
                d3.select(histElem)
                    .selectAll('.bar')
                    .selectAll('rect')
                    .each(function () {
                        var barElem = d3.select(this);
                        var newBarHeight = 0;
                        var selY = sanitizeYPosn(histoData.yScaleFunc(0), histoData.height, histoData.opts);

                        barElem
                            .transition()
                            .duration(500)
                            .attr("height", newBarHeight)
                            .attr("y", selY);
                    });
            }

            function createGlobalDistribution(histElem, tooltip, attrInfo, renderCtrl, histoData, nodes) {
                var isOrdinal = histoData.isOrdinal = !attrInfo.isNumeric;
                _log(logPrefix + 'Rendering attr: ', attrInfo.attr.title);
                _log(logPrefix + 'AttrInfo: ', attrInfo);

                histoData.selectedNodes = nodes || renderCtrl.getSelectedNodes();
                var binCount, binThresholds = [];
                var selectionValuesMap;
                var opts = histoData.opts;
                var binType = histoData.binType;
                _log(logPrefix + 'HISTO SELECTION VALUES MAP: ', selectionValuesMap);

                // A formatter for counts.
                // var formatCount = d3.format(",.0f");
                var yAxisWidth, barWidth, width, height,
                    containerWidth = 370; //histElem.clientWidth

                if (binType == 'int_variable' || binType == 'int_unique') {
                    binThresholds = getBinThresholds(attrInfo, opts, histoData);
                    binCount = binThresholds.length - 1;
                }
                else {
                    binCount = suggestBinCount(attrInfo, histoData.binType, opts);
                    if (binCount > opts.maxBinCount) {
                        containerWidth = binCount * opts.minBinWidth;
                        histElem.style.width = containerWidth + 'px !important';
                    }
                }
                histoData.binCount = binCount;

                width = histoData.width = containerWidth - opts.marginLeft - opts.marginRight;
                height = histoData.height = opts.histHeight - opts.marginTop - opts.marginBottom;
                barWidth = histoData.barWidth = (width - 20) / binCount - 2 * opts.barPadding;


                // Generate histogram data
                var x = histoData.xScaleFunc = generateXScale(attrInfo, width - 20, !isOrdinal, binType, histoData.intVarData);
                var data = histoData.d3Data = generateD3Data(attrInfo, binCount, !isOrdinal, x, binThresholds, binType);
                _log(logPrefix + 'histo d3 data: ', data);


                var y = histoData.yScaleFunc = generateYScale(attrInfo, height, data);

                var xAxis = d3.svg.axis()
                    .scale(x);

                if (binType == 'int_variable') {
                    xAxis.tickValues(_.filter(binThresholds, function (val, i) { return i % 2 === 0; }));
                }
                else if (binType == 'int_unique') {
                    xAxis.tickValues(binThresholds);
                }

                xAxis
                    .tickFormat(function (xVal) {
                        var formattedVal;
                        if (histoData.binType == 'categorical') {
                            formattedVal = xVal;
                        }
                        else {
                            switch (histoData.xAxisType) {
                                case 'year':
                                    formattedVal = xVal;
                                    break;
                                case 'dateTime':
                                    formattedVal = formatTimestamp(xVal, 'YYYY/MM/DD');
                                    break;
                                default:
                                    formattedVal = formatNumber(xVal);
                            }
                        }

                        return formattedVal;
                    })
                    .orient("bottom");

                var histoMax = d3.max(data, function (d) { return d.y; });
                var histoStep = histoMax * 0.25;
                maxTickValue = histoMax;
                var yAxis = initAxis = d3.svg.axis()
                    .scale(y)
                    .tickValues(d3.range(0, histoMax + histoStep, histoStep))
                    .tickFormat(function (yVal) {
                        if (nodes) {
                            return (yVal / nodes.length * 100).toFixed(0) + '%';
                        }

                        return (yVal / renderCtrl.getTotalNodesCount() * 100).toFixed(0) + '%';
                    })
                    .orient("left");

                var svg = d3.select(histElem).append("svg")
                    .attr("width", width + opts.marginLeft + opts.marginRight)
                    .attr("height", height + opts.marginTop + opts.marginBottom)
                    .append("g")
                    .attr("transform", "translate(" + opts.marginLeft + "," + opts.marginTop + ")");

                var bar = svg.selectAll()
                    .data(data)
                    .enter()
                    .append("g")
                    .attr("class", "elem-child-highlight")
                    .attr("class", "bar")
                    .attr("transform", function (d) {
                        var xVal;
                        if (binType == 'int_unique') { xVal = d.x; }
                        else if (binType == 'categorical') { xVal = d.label; }
                        else { xVal = d.x; }

                        return "translate(" + x(xVal) + "," + 0 + ")";
                    });

                var globalBarFillColor = opts.barColor;
                // Make global bar
                bar.append("rect")
                .attr('opacity', 1)
                .style({ fill: globalBarFillColor, 'shape-rendering': 'crispEdges' })
                .attr("data-main-bar", "true")
                .attr("x", function (d, i) { return getBarXPosn(d, i, binType, barWidth); })
                .attr("width", barWidth)
                .attr("y", height)
                .attr("height", 0);
 

                // Make selection bar, initially height 0
                bar.append("rect")
                    .attr("x", function (d, i) { return getBarXPosn(d, i, binType, barWidth); })
                    .attr("y", histoData.height)
                    .attr("data-selection", "true")
                    .attr("width", barWidth)
                    .attr("height", 0);

                // Make filtered selection bar, inititally height 0
                // Make selection bar, initially height 0
                bar.append("rect")
                    .attr("x", function (d, i) { return getBarXPosn(d, i, binType, barWidth); })
                    .attr("y", histoData.height)
                    .attr("data-filt-selection", "true")
                    .attr("width", barWidth)
                    .attr("height", 0);

                $timeout(function (b) {
                    b.select('[data-main-bar="true"]')
                        .transition()
                        .duration(1000)
                        .attr("y", function (d) {
                            return y(d.y);
                        })
                        .attr("height", function (d) { return height - y(d.y); });
                }, 100, null, bar);
                // Attach listeners on parent of overlapping bars i.e 'g' element
                bar.on('mouseover', onBarHover)
                    .on('mouseout', onBarUnHover)
                    .on('click', onBarClick);

                // Append xaxis
                svg.append("g")
                    .attr("class", "xaxis")
                    .attr("transform", "translate(0," + height + ")")
                    .call(xAxis);

                if (histoData.xAxisType == 'dateTime' || histoData.xAxisType == 'year') {
                    svg.select(".xaxis")
                        .selectAll('text')
                        .style("text-anchor", "end")
                        .style("font-weight", "300")
                        .style("font-size", "10px")
                        .attr("dx", "-.8em")
                        .attr("dy", ".15em")
                        .attr("transform", "rotate(-70)");
                }
                else if (binType == 'categorical') {
                    svg.select(".xaxis")
                        .selectAll('text')
                        .style("text-anchor", "start")
                        .style("font-weight", "300")
                        .style("font-size", "10px")
                        .attr("dx", ".8em")
                        .attr("dy", ".15em")
                        .attr("transform", "rotate(45)");
                }

                svg.append("g")
                    .attr("class", "yaxis")
                    .call(yAxis);

                function onBarHover(segment, i) {
                    _log(logPrefix + 'hovering over segment - ', segment);
                    var targetElem = d3.select(d3.event.target);
                    if (!yAxisWidth) {
                        yAxisWidth = svg.select('.yaxis').node().getBBox().width;
                    }
                    if ((targetElem.attr('data-selection') == 'true' && targetElem.attr('height') > 0)
                        || (targetElem.attr('data-filt-selection') == 'true' && targetElem.attr('height') > 0)) {
                        hoverService.hoverNodes({ ids: histoData.selectionCountsList[i].nodeIds });
                    }
                    else {
                        if (isOrdinal) {
                            hoverService.hoverNodes({ attr: attrInfo.attr.id, value: segment.label });
                        }
                        else if (isLogScaleById[attrInfo.attr.id]) {
                            var min = Math.pow(10, segment.x);
                            var max = Math.pow(10, _.last(segment));
                            hoverService.hoverNodes({ attr: attrInfo.attr.id, min: min, max: max });
                        } else {
                            hoverService.hoverNodes({ attr: attrInfo.attr.id, min: segment.x, max: _.last(segment) });
                        }
                    }
                    // showTooltip.call(this, tooltip, segment, barWidth, yAxisWidth, isOrdinal, histoData.isNodeFocus, i);
                    setTooltipText(segment, !isOrdinal, histoData.xAxisType, binType);
                }

                function onBarUnHover(segment) {
                    _log(segment);
                    // hideTooltip(tooltip);
                    hoverService.unhover();
                }

                function onBarClick(segment, i) {
                    _log(logPrefix + 'selecting segment - ', segment);
                    var targetElem = d3.select(d3.event.target);
                    resetAllBarsColor(bar.selectAll('rect').filter(function () {
                        return d3.select(this).attr('data-selection') != 'true';
                    }), opts);
                    setColor.call(this, opts.clickColor);
                    if (isOrdinal) {
                        selectService.selectNodes({ attr: attrInfo.attr.id, value: segment.label });
                    }
                    else if (isLogScaleById[attrInfo.attr.id]) {
                        var min = Math.pow(10, segment.x);
                        var max = Math.pow(10, _.last(segment));
                        selectService.selectNodes({ attr: attrInfo.attr.id, min: min, max: max });
                    }
                    else {
                        selectService.selectNodes({ attr: attrInfo.attr.id, min: segment.x, max: _.last(segment) });
                    }

                }

                return bar;
            }

            function updateSelectionBars(bar, selectedNodes, attrInfo, histoData, mappTheme, showClusterNodes, histElem, renderCtrl) {

                _log(logPrefix + 'rebuilding selections');
                var principalNode = null;
                var binType = histoData.binType;

                if (showClusterNodes) {
                    principalNode = selectedNodes[0];
                    selectedNodes = FilterPanelService.getNodesForSNCluster();
                }

                var allNodes = [];
                if (renderCtrl && renderCtrl.isGradient()) {
                    allNodes = renderCtrl.getAllNodes();
                }
                var opts = histoData.opts;
                var selectionValuesMap = getSelectionValuesMap(selectedNodes, attrInfo.attr.id);
                var selectionCountsList = histoData.selectionCountsList = mapSelectionToBars(attrInfo.attr.id, selectionValuesMap, histoData.d3Data, !histoData.isOrdinal, attrInfo);
                _log(logPrefix + 'selection values map data: ', selectionValuesMap);
                _log(logPrefix + 'selection counts list: ', selectionCountsList);
                var selectionColor = getSelectionColor(selectedNodes, opts);

                var selectionData = _.map(selectionCountsList, function (r) { return { y: r.selectionCount } });
                var yScaleFunc = generateYScale(attrInfo, histoData.height, selectionData);
                if (selectService.selectedNodes && selectService.selectedNodes.length) {
                    var selectionMax = d3.max(selectionData, function (d) { return d.y; });
                    var selectionStep = selectionMax * 0.25;
                    var total = _.reduce(selectionData, function (acc, cv) { return acc + cv.y; }, 0);
                    var yAxis = d3.svg.axis()
                        .scale(yScaleFunc)
                        .tickValues(d3.range(0, selectionMax + selectionStep, selectionStep))
                        .tickFormat(function (yVal) {
                            return (yVal / total * 100).toFixed(0) + '%';
                        })
                        .orient("right");

                    var svg = d3.select(histElem).select("svg");
                    svg.select('g.yaxis.right').remove();
                    svg.append("g")
                        .attr("class", "yaxis right")
                        .attr("transform", "translate(343,10)")
                        .call(yAxis);
                }
                else {
                    var svg = d3.select(histElem).select("svg");
                    svg.select('g.yaxis.right').remove();
                }

                bar.each(function (d, i) {
                    var barElem = d3.select(this);
                    var globalBar = barElem.selectAll('[data-main-bar="true"]');
                    var selectionBars = barElem.selectAll('[data-selection="true"]');
                    var filteredSelBars = barElem.selectAll('[data-filt-selection="true"]');

                    barElem.selectAll('[data-mask-bar="true"]').remove();
                    globalBar.attr('opacity', 1);
                    var globalBarFillColor = selectedNodes.length ? opts.barColorAfterSelection : opts.barColor;
                    if (renderCtrl && renderCtrl.isGradient()) {
                        const mapprSettings = renderCtrl.getMapprSettings();
                        const min = selectionCountsList[i].min;
                        const max = selectionCountsList[i].max;
                        const node = _.filter(allNodes, x => {
                            const val = x.attr[mapprSettings.nodeColorAttr];
                            return val >= min && val <= max;
                        });
                        const barColor = node && node.length ? node[0].colorStr : opts.barColor;
                        globalBar.style({
                            fill: barColor,
                            'shape-rendering': 'crispEdges'
                            // stroke: opts.strokeColor,
                            // 'stroke-width': opts.strokeWidth
                        });
                    } else {
                        globalBar.style({
                            fill: globalBarFillColor,
                            'shape-rendering': 'crispEdges'
                            // stroke: opts.strokeColor,
                            // 'stroke-width': opts.strokeWidth
                        });
                    }

                    // 2) Shrink filtered selection bars
                    filteredSelBars.attr('height', 0);

                    // 3) Update selection bars
                    var opacity = 1;
                    var valInRange = false;
                    var nodeVal;
                    if (principalNode) {
                        opacity = 0.3;
                        nodeVal = principalNode.attr[attrInfo.attr.id];
                        valInRange = _.inRange(nodeVal, selectionCountsList[i].min, selectionCountsList[i].max);

                        if (valInRange) {
                            barElem.insert("rect", '[data-selection="true"]')
                                .attr("x", function () { return getBarXPosn(d, i, binType, histoData.barWidth); })
                                .attr("y", 1)
                                .attr("data-mask-bar", "true")
                                .attr("width", histoData.barWidth)
                                .attr("height", 0)
                                .attr('fill', opts.barColor);
                            globalBar.style({
                                fill: selectionColor
                            });
                        }
                    }
                    selectionBars.attr('opacity', opacity);

                    var newBarHeight;
                    var selY = sanitizeYPosn(yScaleFunc(selectionCountsList[i].selectionCount), histoData.height, opts);
                    if (selectionCountsList[i].selectionCount >= 1) {
                        newBarHeight = histoData.height - sanitizeYPosn(yScaleFunc(selectionCountsList[i].selectionCount), histoData.height, opts);

                        selectionBars
                            .attr("x", function () { return getBarXPosn(d, i, binType, histoData.barWidth); })
                            .style({
                                fill: selectionColor
                                // fill: getSelectionColor(selectedNodes, selectionCountsList[i].nodeIds)
                            });
                    }
                    else {
                        newBarHeight = 0;
                    }

                    if (principalNode && valInRange) {
                        barElem.selectAll('[data-mask-bar="true"]')
                            .attr("y", selY)
                            .attr("height", newBarHeight);
                    }

                    if (newBarHeight != selectionBars.attr('height')) {
                        selectionBars
                            .transition()
                            .duration(1000)
                            .attr("height", newBarHeight)
                            .style('opacity', 0.3)
                            .attr("y", selY);
                    }

                });

            }

            function updateFiltSelBars(bar, selectedNodes, attrInfo, histoData) {
                _log(logPrefix + 'rebuilding selections');
                var opts = histoData.opts;
                var selectionValuesMap = getSelectionValuesMap(selectedNodes, attrInfo.attr.id);
                var filtSelectionCountsList = mapSelectionToBars(attrInfo.attr.id, selectionValuesMap, histoData.d3Data, !histoData.isOrdinal, attrInfo);
                _log(logPrefix + 'filtered selection values map data: ', selectionValuesMap);
                _log(logPrefix + 'filtered selection counts list: ', filtSelectionCountsList);
                var selectionColor = getSelectionColor(selectedNodes, opts);

                var yScaleFunc = generateYScale(attrInfo, histoData.height, _.map(filtSelectionCountsList, function (r) { return { y: r.selectionCount } }));
                bar.each(function (d, i) {
                    var barElem = d3.select(this);
                    var selectionBars = barElem.selectAll('[data-selection="true"]');
                    var filteredSelBars = barElem.selectAll('[data-filt-selection="true"]');

                    selectionBars.attr('opacity', 0.3);

                    var newBarHeight;
                    var filtY = sanitizeYPosn(yScaleFunc(filtSelectionCountsList[i].selectionCount), histoData.height, opts);
                    if (filtSelectionCountsList[i].selectionCount > 0) {
                        newBarHeight = histoData.height - sanitizeYPosn(yScaleFunc(filtSelectionCountsList[i].selectionCount), histoData.height, opts);
                        filteredSelBars
                            .style({
                                fill: selectionColor
                            })
                            .attr("width", histoData.barWidth);
                    }
                    else {
                        newBarHeight = 0;
                        filteredSelBars.attr("height", 0);
                    }

                    if (newBarHeight != filteredSelBars.attr('height')) {
                        filteredSelBars
                            .transition()
                            .duration(1000)
                            .attr("height", newBarHeight)
                            .style('opacity', 0.3)
                            .attr("y", filtY);
                    }

                });

            }

            return dirDefn;
        }
    ]);
