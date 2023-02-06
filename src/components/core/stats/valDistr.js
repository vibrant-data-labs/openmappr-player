/* globals mappr, $ */
(function() {
    'use strict';

    sigma.utils.pkg('mappr');

    /**
     *  interactive distribution plot for numerical data with value or shaded value bins
     *  positioned by value on linear or log scale
     */

    mappr.stats = mappr.stats || {};
    mappr.stats.distr = mappr.stats.distr || {};

    (function() {

        // For logging
        //var dirPrefix = '[valDistr: ]';

        function NumericValueBar(svgElem, attr, attrInfo, opts) {
            this.svgElem = svgElem; // the elem in which to render the bar
            this.opts = opts;
            this.attr = attr;
            this.attrInfo = attrInfo;

            this.bar = null; // the base background bar
            this.selSvg = null; // the group for sel Histr
            this.globalSvg = null; // the group for global Histr
            this.highlightBox = null;
            this.barWd = 0;
            this.barHt = opts.distrHt;

            this.hideTooltip = _.noop;
            this.showTooltip = _.noop;
            this.updateTooltip = _.noop;

            this.renderBase();
        }
        // renders the background + the division ticks
        NumericValueBar.prototype.renderBase = function() {
            var svgElem = this.svgElem,
                opts = this.opts,
                attrInfo = this.attrInfo;

            var wd = svgElem.width();
            var barWd = wd,
                barHt = opts.distrHt;

            this.barWd = barWd;
            this.barHt = barHt;

            // initialize base Canvas
            var canvasElem = Snap(svgElem[0]).attr({
                width: wd,
                height: barHt
            });

            // setup background bar
            var bar = canvasElem.rect(0, 0, barWd, barHt);
            this.bar = bar;
            bar.attr({
                "fill": opts.multibarColor,
                "stroke": opts.multibarColor
            });
            // for sel nodes histo
            var selSvg = canvasElem.svg(0, 0, barWd, barHt / 2);
            this.selSvg = selSvg;
            // for global pop histo
            var globalSvg = canvasElem.svg(0, 0, barWd, barHt);
            this.globalSvg = globalSvg;

            _drawValueBarHist(globalSvg, barWd, barHt, attrInfo.bins, attrInfo.nBins, opts.binColor, 0);
        };


        //tooltipObj is obj containing tooltipText so directive can reference for angular bootstrap tooltip
        NumericValueBar.prototype.setupTooltips = function(tooltipObj, renderCtrl) {
            var attrInfo = this.attrInfo,
                attrId = attrInfo.attr.id,
                opts = this.opts;

            var canvasElem = Snap(this.svgElem[0]);

            canvasElem
                .mouseover(showTooltip)
                .click(function(ev) {
                    if (!('snap' in ev.srcElement)) {
                        return;
                    }
                    var elem = Snap(ev.srcElement);
                    var bin = elem.data('binData');
                    if (!bin) {
                        return;
                    } else {
                        ev.stopPropagation();
                    }

                    if (bin.nodeIds) {
                        renderCtrl.selectNodeIdList(bin.nodeIds, ev, opts.raiseEvents);
                    } else {
                        renderCtrl.selectNodesByAttribRange(attrId, bin.min, bin.max, ev, opts.raiseEvents);
                    }
                });
            // update tooltip Position
            // var throttledUpdatePos = _.throttle(updateTooltip, 50);
            // canvasElem.mousemove(throttledUpdatePos);
            // canvasElem.mouseout(hideTooltip);

            // tooltipDiv.css({
            //     'position': 'absolute',
            //     'z-index': 100
            // });
            // tooltipDiv.on('mouseover', hideTooltip);
            // tooltipDiv.hide(); // hide at start

            // general tooltip handlers
            this.hideTooltip = hideTooltip;
            this.showTooltip = showTooltip;
            this.updateTooltip = updateTooltip;

            var currentBin = null;

            function showTooltip(ev) {
                if (!('snap' in ev.srcElement)) return;

                var elem = Snap(ev.srcElement);
                var bin = elem.data('binData');

                if (!bin) {
                    return;
                } else {
                    ev.stopPropagation();
                }

                // if inside the same bar, then return
                // object comparision works here, because both bins will point to same object
                if (currentBin == bin) {
                    return;
                }
                currentBin = bin;

                if (currentBin.nodeIds !== undefined) {
                    renderCtrl.hoverNodeIdList(currentBin.nodeIds, ev);
                } else {
                    renderCtrl.hoverNodesByAttribRange(attrId, currentBin.min, currentBin.max, ev);
                }
                updateTooltip(ev);
                ev.stopPropagation();
                // tooltipDiv.show();
            }

            function hideTooltip() {
                currentBin = null;
                // tooltipDiv.hide();
                renderCtrl.unHoverNodes();
            }

            function updateTooltip(ev) {
                if (!('snap' in ev.srcElement)) {
                    return;
                }
                //var x = mappr.stats.distr.offsetX(ev);
                var elem = Snap(ev.srcElement);
                var bin = elem.data('binData');

                if (!bin) {
                    return;
                } else {
                    ev.stopPropagation();
                }

                if (bin.min == bin.max) {
                    tooltipObj.tooltipText = mappr.utils.numericString(bin.min);
                } else {
                    tooltipObj.tooltipText = mappr.utils.numericString(bin.min) + '-' + mappr.utils.numericString(bin.max);
                }
            }
        };

        // renders the info about the nodes in selection
        // NOTE : Snap.svg selectAll returns a set for no selection
        NumericValueBar.prototype.renderCurrentSel = function(nodeColorStr, selNodes) {
            var attrInfo = this.attrInfo,
                opts = this.opts;
            var barWd = this.barWd,
                barHt = this.barHt,
                animTime = 250;

            var selSvg = this.selSvg,
                globalSvg = this.globalSvg,
                canvasElem = Snap(this.svgElem[0]);

            var toDel = canvasElem.select('.line-marker');
            if (toDel) {
                toDel.remove();
            }


            if (selNodes.length > 1) {
                globalSvg.animate({
                    y: barHt / 2,
                    'height': barHt / 2
                }, animTime);

                // selSvg.attr({
                //     'y'       : barHt / 2,
                //     'height'  : 0
                // });
                selSvg.attr({
                    'display': 'block',
                    'y': 0,
                    'height': barHt / 2
                });
                // animate out bars previously rendered bars
                var rects = selSvg.selectAll('rect');
                rects.forEach(function(elem) {
                    elem.animate({
                        'height': 0
                    }, animTime, function() {
                        elem.remove();
                    });
                });
                // }
            } else {
                // animate globalSvg to full bar and disappear selSvg
                globalSvg.animate({
                    y: 0,
                    'height': barHt
                }, animTime);
                // selSvg.attr({ 'display' : 'none' });
                selSvg.animate({
                    'height': 0
                }, animTime, function() {
                    selSvg.attr({
                        'display': 'none'
                    });
                    selSvg.selectAll('rect').remove();
                });
            }

            if (selNodes.length === 0) {
                return;
            }

            if (selNodes.length > 1) {
                var selNodesBin = _binSelectedNodes(selNodes, attrInfo);
                _drawValueBarHist(selSvg, barWd, barHt, selNodesBin, attrInfo.nBins, nodeColorStr, animTime);
            } else {
                _drawSingleNodeHighlight(canvasElem, selNodes, attrInfo, barWd, barHt, nodeColorStr, 2 * opts.markerHalfWd, animTime);
            }
        };

        function _drawValueBarHist(svgElem, barWd, barHt, bins, nBins, binColor, animTime) {
            // draw the bins
            var i, x = 0,
                deltax = barWd / nBins,
                rects = Snap.set();
            for (i = 0; i < nBins; i++) {
                var bin = bins[i];
                if (bin.numFrac > 0) {
                    var binRect = svgElem.rect(x, '100%', deltax, 0); // start animation from bottom to top
                    binRect.attr({
                        'fill': binColor,
                        'opacity': bin.numFrac,
                        "class": "elem-highlight"
                    });
                    binRect.data('binData', bin);
                    binRect[animTime ? 'animate' : 'attr']({
                        y: 0,
                        height: '100%'
                    }, animTime);
                    rects.push(binRect);
                }
                x += deltax;
            }
            return rects;
        }

        function _drawSingleNodeHighlight(svgElem, selNodes, attrInfo, barWd, barHt, nodeColorStr, markerWd, animTime) {
            var attrId = attrInfo.attr.id,
                max = attrInfo.stats.max,
                min = attrInfo.stats.min;
            var val = selNodes[0].attr[attrId];

            var range = max - min;
            var markerX = barWd * ((range === 0) ? 0.5 : (val - min) / range);
            var marker = svgElem.line(markerX, 0, markerX, "100%");
            marker.attr({
                'stroke': nodeColorStr,
                'stroke-width': markerWd
            });
            marker.addClass('line-marker');
            return marker;
        }
        // bin the selected nodes into their correct global positions
        function _binSelectedNodes(nodes, globalAttrInfo) {
            var min = globalAttrInfo.stats.min,
                max = globalAttrInfo.stats.max,
                nBins = globalAttrInfo.nBins,
                bins = globalAttrInfo.bins,
                attrId = globalAttrInfo.attr.id;

            var delta = (max - min) / nBins,
                i,
                values = _.map(nodes, 'attr.' + attrId);

            /// create a duplicate of global bin, which is empty.
            var selBins = _.map(bins, function(bin, index) {
                return {
                    id: index,
                    min: bin.min,
                    max: bin.max,
                    numFrac: 0,
                    count: 0,
                    nodeIds: [],
                    colors: {}
                };
            });
            // count values in each bin and track max count
            var maxCount = 0,
                binIdx, node, val, bin;
            for (i = 0; i < values.length; i++) {
                val = values[i];
                if (val == null || isNaN(val)) {
                    continue;
                }

                node = nodes[i];

                if (delta > 0) {
                    binIdx = Math.floor((val - min) / delta);
                } else { // all the same value
                    binIdx = Math.floor(nBins * i / values.length);
                }
                // protect against rounding errors
                if (binIdx == nBins) {
                    binIdx--;
                } else if (binIdx < 0) {
                    binIdx = 0;
                }
                bin = selBins[binIdx];
                var count = bin.count += 1;
                if (count > maxCount) {
                    maxCount = count;
                }
                bin.nodeIds.push(node.id);
                bin.colors[node.colorStr] = bin.colors[node.colorStr] ? bin.colors[node.colorStr] + 1 : 1;
            }
            // normalize bin sizes and pick the max color
            for (i = 0; i < nBins; i++) {
                bin = selBins[i];
                bin.numFrac = bin.count / maxCount;
                bin.binColor = _.reduce(bin.colors, function(acc, val, key) {
                    if (acc.count < val) {
                        return {
                            count: val,
                            color: key
                        };
                    } else {
                        return acc;
                    }
                }, {
                    count: 0,
                    color: undefined
                }).color;
            }
            return selBins;
        }

        ///
        /// Old tools
        ///
        // function _setNBins1(attrInfo) {
        //     var nBins = 20;           // 5% per bin
        //     // set bins for integers with a small range of values
        //     if( attrInfo.isInteger && (attrInfo.bounds.max - attrInfo.bounds.min) < 40 ) {
        //         nBins = attrInfo.bounds.max - attrInfo.bounds.min + 1;
        //     }
        //     return nBins;
        // };

        /*
         * Value Bar logic
         */

        // function buildValueBar(elem, tooltip, attr, attrInfo, opts, callbacks) {
        //     var wd = elem.clientWidth;
        //     var canvasElem, bar;
        //     var barWd = wd - 2*opts.marginX;
        //     opts.distrHt = opts.singleDistrHt;
        //     //var tooltip = $(elem).find(".d3-tip");
        //     opts.callbacks = callbacks;
        //     elem.setAttribute("height", opts.distrHt+"px");
        //     if( barWd > 0 && attrInfo.isNumeric) {
        //         numericBar();
        //     }

        //     function numericBar() {
        //         var nBins = _setNBins(attrInfo);
        //         var min = attrInfo.stats.min;
        //         var max = attrInfo.stats.max;
        //         var value = attr.value;
        //         canvasElem = Snap(wd, opts.distrHt);
        //         canvasElem.prependTo(elem);

        //         // draw the value bar
        //         bar = _drawValueBar(canvasElem, barWd, opts.barHt, attr, attrInfo, false, opts, tooltip, elem);
        //         // draw value bar histogram
        //         _drawValueBarHistogram(canvasElem, bar, barWd, opts.barHt, attr, attrInfo, undefined, nBins, opts, tooltip);
        //         // draw the marker
        //         if( value !== undefined ) {
        //             _drawMarker(attr, canvasElem, barWd, value, min, max, opts);
        //         }
        //     }

        // }

        // function _drawValueBar1(canvas, barWd, barHt, attr, attrInfo, isMulti, opts, tooltip, elem) {
        //     var min = attrInfo.stats.min;
        //     var max = attrInfo.stats.max;
        //     var bar = canvas.rect(opts.marginX, opts.distrHt - barHt - opts.marginBtm, barWd, barHt);
        //     bar.values = _.keys(attrInfo.valuesCount).sort(function(a, b){return a-b;});
        //     bar.values = _.map(bar.values, function(s){return parseFloat(s);})

        //     bar.attr({
        //         "fill": isMulti ? opts.multibarColor : opts.barColor,
        //         "stroke": isMulti ? opts.multibarColor : opts.barColor
        //     });

        //     // set up bar event handlers
        //     var debHoverRange = opts.callbacks.hoverRange;
        //     var debHoverList = opts.callbacks.hoverList;
        //     var throttledUpdate = _.throttle(updateTooltip, 50);

        //     bar.hover(throttledUpdate, removeTooltip)
        //        .mousemove(throttledUpdate);

        //     function updateTooltip(ev) {    // in/move handler
        //         if( ev.data ) {
        //             var x = mappr.stats.distr.offsetXY(ev).offsetX - opts.marginX;
        //             if( ev.data.min == ev.data.max) {
        //                 $("strong", tooltip).text(mappr.utils.numericString(ev.data.min));
        //             } else {
        //                 $("strong", tooltip).text(mappr.utils.numericString(ev.data.min) + '-' + mappr.utils.numericString(ev.data.max));
        //             }

        //             tooltip.css({
        //                 position : 'absolute',
        //                 "z-index" : 100
        //             });
        //             tooltip.show();
        //             tooltip.css({
        //                 "top" : elem.offsetTop + opts.distrHt - opts.barHt - opts.marginBtm - tooltip[0].scrollHeight,
        //                 left : elem.offsetLeft + x + opts.marginX - tooltip.outerWidth()/2
        //             });
        //             if( ev.data.nodeIds !== undefined ) {
        //                 debHoverList(ev.data.nodeIds, $.Event(ev));
        //             } else {
        //                 debHoverRange(attr.id, ev.data.min, ev.data.max, $.Event(ev));
        //             }
        //         }
        //     };

        //     function removeTooltip() {  // out handler
        //         // console.log(dirPrefix, 'removing tooltip')
        //         throttledUpdate.cancel();
        //         tooltip.hide();
        //         opts.callbacks.unhover();
        //     };

        //     return bar;
        // }

        // function _drawValueBarHistogram1(canvasElem, bar, barWd, barHt, attr, attrInfo, excludedBinInfo, nBins, opts, tooltip) {
        //     // get the bins
        //     var binSizes = _getBinInfo(attrInfo.values, undefined, excludedBinInfo, attrInfo.stats.min, attrInfo.stats.max, nBins, attrInfo.isInteger);
        //     // draw the bins
        //     var i, x = 0, deltax = barWd/nBins;
        //     var binInfo = {colorStr: opts.binColor, id: attr.id};
        //     for(i = 0; i < nBins; i++) {
        //         _drawBin(canvasElem, binInfo, attrInfo, bar, barWd, barHt, binSizes[i], x, deltax, 0, opts, tooltip);
        //         x += deltax;
        //     }
        // }

        // function _drawMarker1(attr, canvas, barWd, val, min, max, opts) {
        //     var range = (max - min);
        //     var markerX = opts.marginX + barWd * ((range == 0) ? 0.5 : (val - min)/range);
        //     var marker = mappr.stats.distr.drawMarker(canvas, barWd, markerX, opts);
        //     mappr.stats.distr.setupMarkerEvents(marker, attr, opts);
        //     return marker;
        // }


        // /*
        // * MultiValue Value logic
        // */

        // // show histogram of population and sample
        // // excludeSample true then population excludes the sample
        // function buildMultiValueBar(elem, tooltip, attr, attrInfo, opts, excludeSample, callbacks) {
        //     var wd = elem.clientWidth;
        //     var canvasElem, bar;
        //     var barWd = wd - 2*opts.marginX;
        //     var nBins = _setNBins(attrInfo);
        //     opts.distrHt = opts.multiDistrHt;
        //     opts.callbacks = callbacks;
        //     elem.setAttribute("height", opts.distrHt+"px");

        //     if( barWd > 0 && attrInfo.isNumeric) {
        //         numericBar();
        //     }

        //     function numericBar() {
        //         var min = attrInfo.stats.min;
        //         var max = attrInfo.stats.max;
        //         var i, yOffset;
        //         canvasElem = Snap(wd, opts.distrHt);
        //         canvasElem.prependTo(elem);

        //         // get the bins for the selected nodes
        //         var values = _.pluck(attr.values, 'value');
        //         var binInfo = _getBinInfo(values, attr.nodes, undefined, min, max, nBins, attrInfo.isInteger);
        //         // draw the value bar
        //         bar = _drawValueBar(canvasElem, barWd, 2*opts.multiBarHt, attr, attrInfo, true, opts, tooltip, elem);
        //         // draw value bar (population) histogram
        //         _drawValueBarHistogram(canvasElem, bar, barWd, opts.multiBarHt, attr, attrInfo, (excludeSample ? binInfo : undefined), nBins, opts, tooltip);
        //         // draw sample histogram
        //         yOffset = opts.multiBarHt;
        //         // draw the bins
        //         var x = 0, deltax = barWd/nBins;
        //         for(i = 0; i < nBins; i++) {
        //             _drawBin(canvasElem, attr, attrInfo, bar, barWd, opts.multiBarHt, binInfo[i], x, deltax, yOffset, opts, tooltip);
        //             x += deltax;
        //         }
        //     };

        // };

        // // compute min, max, count and relative size of each bin based on number of nodes in each bin, largest bin = 1
        // // excludedBinInfo is a set of binInfo whose counts are excluded from this histogram
        // //
        // function _getBinInfo(values, nodes, excludedBinInfo, min, max, nBins, isInt) {
        //     // initialize bins
        //     var i, delta = (max - min)/nBins;
        //     var binSizes = [];
        //     var multiColor = false;
        //     for(i = 0; i < nBins; i++) {
        //         var excluded = excludedBinInfo ? excludedBinInfo[i] : undefined;
        //         var binMin = min + i * delta;
        //         var binMax = (i == nBins - 1) ? max : (min + (i +1) * delta);
        //         if( isInt ) {
        //             binMin = Math.ceil(binMin);
        //             binMax = Math.floor(binMax);
        //         }
        //         binSizes[i] = {
        //             frac: 0,
        //             count: excluded ? -excluded.count : 0,
        //             min: binMin,
        //             max: binMax,
        //             nodeIds: nodes ? [] : undefined,
        //             colors: nodes ? {} : undefined
        //         };
        //     }
        //     // count values in each bin and track max count
        //     var maxCount = 0;
        //     for( i = 0; i < values.length; i++) {
        //         var val = values[i];
        //         if( val !== undefined && !isNaN(val) ) {
        //             var node = nodes ? nodes[i] : undefined;
        //             var binIdx;
        //             if( delta > 0 ) {
        //                 binIdx = Math.floor((val-min)/delta);
        //             } else {    // all the same value
        //                 binIdx = Math.floor(nBins*i/values.length);
        //             }
        //             // protect against rounding errors
        //             if(binIdx == nBins) {
        //                 binIdx--;
        //             } else if( binIdx < 0 ) {
        //                 binIdx = 0;
        //             }
        //             var bin = binSizes[binIdx];
        //             var count = bin.count += 1;
        //             if( count > maxCount ) {
        //                 maxCount = count;
        //             }
        //             if(node !== undefined) {
        //                 bin.nodeIds.push(node.id);
        //                 bin.colors[node.colorStr] = true;
        //             }
        //         }
        //     }
        //     // normalize bin sizes
        //     for(i = 0; i < nBins; i++) {
        //         var bin = binSizes[i];
        //         bin.frac =  bin.count/maxCount;
        //         if(_.keys(bin.colors).length > 1) {
        //             multiColor = true;
        //         }
        //     }
        //     // color bins
        //     for(i = 0; i < nBins; i++) {
        //         var bin = binSizes[i];
        //         bin.colorStr = multiColor ? undefined : _.keys(bin.colors)[0];
        //     }
        //     return binSizes;
        // };

        // // draw a bin as a shaded rectangle, use binSize to set color saturation (opacity)
        // //
        // function _drawBin1(canvas, binInfo, attrInfo, bar, barWd, barHt, binSizeInfo, binx, wd, yOffset, opts, tooltip) {
        //     var min = binSizeInfo.min;
        //     var max = binSizeInfo.max;
        //     var frac = binSizeInfo.frac;
        //     var nodeIds = binSizeInfo.nodeIds;
        //     var binColor = binSizeInfo.colorStr;
        //     if(frac > 0) {
        //         var bin = canvas.rect(binx + opts.marginX, opts.distrHt - opts.marginBtm - barHt - yOffset, wd, barHt);
        //         var colorStr = binColor ? binColor : binInfo.colorStr;
        //         bin.attr({fill: colorStr, stroke: colorStr, opacity: frac})
        //            .attr("stroke-opacity", frac);

        //         bin.hover(inHandler, outHandler).mousemove(moveHandler).click(clickHandler);
        //     }

        //     function inHandler(ev) {
        //         ev.data = {max: max, min: min, nodeIds: nodeIds};
        //         mappr.stats.distr.triggerEvent(bar, 'mousein', ev); // pass event through to underlying bar
        //     };

        //     function outHandler(ev) {
        //         mappr.stats.distr.triggerEvent(bar, 'mouseout', ev); // pass event through to underlying bar
        //     };

        //     function moveHandler(ev) {
        //         ev.data = {max: max, min: min, nodeIds: nodeIds};
        //         mappr.stats.distr.triggerEvent(bar, 'mousemove', ev); // pass event through to underlying bar
        //     };

        //     function clickHandler(ev) {
        //         if( nodeIds ) {
        //             opts.callbacks.selectList(nodeIds, $.Event(ev), opts.raiseEvents);
        //         } else {
        //             opts.callbacks.selectRange(binInfo.id, min, max, $.Event(ev), opts.raiseEvents);
        //         }
        //         ev.stopPropagation();
        //     };
        // };
        this.NumericValueBar = NumericValueBar;
        // this.buildMultiValueBar = buildMultiValueBar;
        // this.buildValueBar = buildValueBar;
    }).call(mappr.stats.distr);
})();
