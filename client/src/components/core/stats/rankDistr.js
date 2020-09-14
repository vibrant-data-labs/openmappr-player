/* globals mappr, $ */

(function() {
    'use strict';

    sigma.utils.pkg('mappr');

    /**
     *  interactive distribution plot with values positioned in rank order
     *  numerical values are sorted by value
     *  categorical values are sorted by frequency of value
     */

    mappr.stats = mappr.stats || {};
    mappr.stats.distr = mappr.stats.distr || {};

    (function() {

        // For logging
        //var dirPrefix = '[rankDistr: ]';
        var animTime = 250;

        function NonNumericRankBar(svgElem, attr, attrInfo, opts) {

            this.svgElem = svgElem; // the elem in which to render the bar
            this.opts = opts;
            this.attr = attr;
            this.attrInfo = attrInfo;

            this.bar = null;
            this.divGroup = null; // the group for divisions
            this.highlightBox = null;
            this.barWd = 0;
            this.barHt = opts.distrHt;

            this.hideTooltip = _.noop;
            this.showTooltip = _.noop;
            this.updateTooltip = _.noop;

            this.renderBase();
        }
        // renders the background + the division ticks
        NonNumericRankBar.prototype.renderBase = function() {
            var svgElem = this.svgElem,
                opts = this.opts,
                attrInfo = this.attrInfo;

            var wd = svgElem.width();
            var barWd = wd,
                barHt = opts.distrHt; //opts.distrHt - opts.marginBtm;

            this.barWd = barWd;
            this.barHt = barHt;


            var maxRank = attrInfo.nValues - 1;
            // initialize base Canvas
            var canvasElem = Snap(svgElem[0]).attr({
                width: wd,
                height: barHt
            });
            // setup global distr
            var bar = canvasElem.rect(0, 0, barWd, barHt);
            bar.attr({
                fill: opts.barColor,
                stroke: opts.barColor
            });
            this.bar = bar;

            // a group for highlights
            var tickGrp = canvasElem.select('.tick-grp');
            if (!tickGrp) {
                tickGrp = canvasElem.group();
            }
            tickGrp.addClass('tick-grp');
            tickGrp.attr("pointer-events", "none");

            this.highlightBox = canvasElem.rect(0, 0, 1, '100%');
            this.highlightBox.attr({
                fill: opts.hiliteColor,
                stroke: opts.hiliteColor,
                'pointer-events': 'none',
                "fill-opacity": 0.67,
                'display': 'none'
            });

            // draw divisions
            var divGroup = _drawCategoryDivisions(canvasElem, barWd, barHt, maxRank, attrInfo, opts);
            this.divGroup = divGroup;
        };

        //tooltipObj is obj containing tooltipText so directive can reference for angular bootstrap tooltip
        NonNumericRankBar.prototype.setupTooltips = function(tooltipObj, renderCtrl) {
            var bar = this.bar,
                highlightBox = this.highlightBox,
                attrInfo = this.attrInfo,
                barWd = this.barWd;

            //var canvas = Snap(this.svgElem[0]);
            var maxRank = attrInfo.nValues - 1;
            var currentValue = null,
                currentMinX = 0,
                currentMaxX = 0;

            bar
                .mouseover(showTooltip)
                .mousemove(showTooltip)
                .click(function(ev) {
                    if (currentValue) {
                        ev.stopPropagation();
                        renderCtrl.selectNodesByAttrib(attrInfo.attr.id, currentValue, ev);
                    }
                });
            // .mouseout(hideTooltip);

            // tooltipDiv.css({
            //     'position': 'absolute',
            //     'z-index': 100
            // });
            // // update tooltip Position
            // var throttledUpdatePos = _.throttle(updateTooltip, 50);
            // canvas.mousemove(throttledUpdatePos);
            // canvas.mouseout(hideTooltip);
            //
            // tooltipDiv.on('mouseover', hideTooltip);
            // tooltipDiv.hide(); // hide at start

            // general tooltip handlers
            this.hideTooltip = hideTooltip;
            this.showTooltip = showTooltip;
            // this.updateTooltip = updateTooltip;

            function showTooltip(ev) {
                var val, x = mappr.stats.distr.offsetX(ev),
                    min, max;
                var idx = Math.floor((maxRank + 1) * x / (barWd + 1));

                // if inside the same bar, then return
                if (x > currentMinX && x < currentMaxX) {
                    return;
                }
                // find the value being hovered on
                for (var i = 0; i < attrInfo.values.length; i++) {
                    val = attrInfo.values[i];

                    if (idx < attrInfo.ranks[val].max) {
                        min = attrInfo.ranks[val].min * barWd / (maxRank + 1);
                        max = attrInfo.ranks[val].max * barWd / (maxRank + 1);
                        break;
                    }
                }
                if (val != currentValue) {
                    currentValue = val;
                    currentMinX = min;
                    currentMaxX = max;

                    highlightBox.attr({
                        'x': min,
                        'width': max - min,
                        'display': 'block'
                    });

                    renderCtrl.hoverNodesByAttrib(attrInfo.attr.id, currentValue, ev);
                    tooltipObj.tooltipText = _.trunc(val, 100);
                    // tooltipDiv.find("strong").text(_.trunc(val, 100));
                    ev.stopPropagation();
                }
                // tooltipDiv.show();
            }

            function hideTooltip() {
                // currentMinX = currentMaxX = 0;
                // currentValue = undefined;
                removeHighlightBox();
                // tooltipDiv.hide();
                tooltipObj.tooltipText = '';
            }

            function removeHighlightBox() {
                highlightBox.attr({
                    x: 0,
                    width: 1,
                    'display': 'none'
                });
                renderCtrl.unHoverNodes();
            }
            // function updateTooltip(ev) {
            //     var x = mappr.stats.distr.offsetX(ev);
            //     tooltipDiv.css({
            //         left : x  - tooltipDiv.outerWidth()/2,
            //         top : -50 // TODO : HACK NEED SUNNY HELP
            //     });
            // }
        };

        // renders the info about the nodes in selection
        NonNumericRankBar.prototype.renderCurrentSel = function(nodeColorStr, selNodes, principalNode) {
            var attrInfo = this.attrInfo,
                opts = this.opts;
            var barWd = this.barWd;

            var canvas = Snap(this.svgElem[0]),
                maxRank = attrInfo.nValues - 1;

            // animate out ticks
            var tickGrp = canvas.select('.tick-grp');
            tickGrp.selectAll('rect').forEach(function(el) {
                el.addClass('tick-fade-out');
                el.animate({
                    "width": 0
                }, animTime, function() {
                    el.remove();
                });
            });
            tickGrp.selectAll('line').remove();

            if (selNodes.length === 0) {
                return;
            }

            tickGrp.attr({
                'stroke-width': 0
            });

            if (selNodes.length > 1) {
                // get unique values and their count not sorted
                var selInfo = buildSelInfoData(selNodes, attrInfo.attr.id);
                _drawSelectionHighlights(attrInfo, selInfo, tickGrp, barWd, maxRank, nodeColorStr, principalNode);
            } else {
                _drawSingleNodeHighlight(selNodes, attrInfo, tickGrp, barWd, maxRank, 2 * opts.markerHalfWd, nodeColorStr);
            }
        };

        function _drawCategoryDivisions(canvas, barWd, barHt, maxRank, attrInfo, opts) {
            // draw the vertical breaks in the bar
            var divGroup = canvas.g();
            divGroup.attr({
                stroke: opts.lineColor
            })
            .attr("stroke-width", "1")
            .attr("pointer-events", "none");

            var i = 0,
                prev = -1,
                val, max, x;
            for (i = 0; i < attrInfo.values.length - 1; i++) {
                val = attrInfo.values[i];
                max = attrInfo.ranks[val].max;

                if (max != prev) {
                    prev = max;
                    x = barWd * max / (maxRank + 1);
                    divGroup.line(x, 0, x, '100%');
                } else {
                    console.log("BIZZARE CONDITION HAPPENED");
                }
            }
            return divGroup;
        }
        // draw highlights for many nodes
        function _drawSelectionHighlights(attrInfo, selInfo, tickGrp, barWd, maxRank, nodeColorStr, principalNode) {
            var val, rank, valRank, count, tickWd, tickX, tick;
            var tickColor = nodeColorStr,
                opacity;

            for (var i = 0; i < selInfo.values.length; i++) {
                val = selInfo.values[i];
                rank = attrInfo.ranks[val];
                valRank = rank.min;
                count = selInfo.counts[val];

                if (principalNode) {
                    opacity = 0.6;
                    // tickColor = mappr.utils.getDarkColorStr(nodeColorStr, 1);
                    if (principalNode.attr[attrInfo.attr.id] == val) {
                        opacity = 1;
                        // tickColor = nodeColorStr;
                    }
                }

                tickWd = Math.max(2, barWd * count / (maxRank + 1));
                tickX = barWd * valRank / (maxRank + 1);
                tick = tickGrp.rect(tickX, 0, 0, '100%');
                tick.attr('fill', tickColor);
                tick.attr('opacity', opacity);
                tick.animate({
                    "width": tickWd
                }, animTime);
            }
        }
        // render single tick
        function _drawSingleNodeHighlight(selNodes, attrInfo, tickGrp, barWd, maxRank, markerWd, nodeColorStr) {
            var val, rank, valRank;
            var attrId = attrInfo.attr.id;

            val = selNodes[0].attr[attrId];
            rank = attrInfo.ranks[val];

            // approx place where the marker should be placed
            valRank = (rank.max + rank.min - 1) / 2;
            var markerX = barWd * (0.5 + valRank) / (maxRank + 1);
            var marker = tickGrp.line(markerX, 0, markerX, "100%");
            marker.attr({
                'stroke-width': markerWd,
                'stroke': nodeColorStr
            });
        }
        // get unique values and their count (not sorted)
        function buildSelInfoData(selNodes, attrId) {
            var values = [],
                counts = {};
            _.each(selNodes, function(node) {
                var val = node.attr[attrId];
                if (!val) return;

                if (!counts[val]) {
                    counts[val] = 1;
                    values.push(val);
                } else {
                    counts[val] += 1;
                }
            });


            return {
                'counts': counts,
                'values': values
            };
        }
        /*
         * Rank Bar logic
         */
        // function buildRankBar(elem, tooltip, attr, attrInfo, opts, callbacks) {
        //     var wd = elem.clientWidth;
        //     var canvasElem, bar;
        //     var barWd = wd - 2*opts.marginX;
        //     //var tooltip = $(elem).find(".d3-tip");
        //     opts.distrHt = opts.singleDistrHt;
        //     opts.callbacks = callbacks;
        //     elem.setAttribute("height", opts.distrHt+"px");
        //     if( barWd > 0 ) {
        //         if( attrInfo.isNumeric) {
        //             return numericBar();
        //         } else {
        //             return nonNumericBar();
        //         }
        //     }

        //     function numericBar() {
        //         var maxRank = attrInfo.values.length - 1;
        //         // draw the rank bar
        //         bar = _drawRankBar(canvasElem, barWd, attr, attrInfo, false, opts, tooltip, elem);
        //         if(attr.value) {
        //             var rank = attrInfo.valuesCount[attr.value].rank;
        //             if( rank ) {
        //                 var valRank = (rank.max + rank.min)/2;
        //                 canvasElem = Snap(wd, opts.distrHt);
        //                 canvasElem.prependTo(elem);
        //                 // draw the marker
        //                 _drawMarker(attr, canvasElem, barWd, valRank, maxRank, opts);
        //                 return true;
        //             }
        //         }
        //         return false;
        //     }

        //     function nonNumericBar() {   // draw rank bar and marker for a non-numeric attribute
        //         var maxRank = attrInfo.nValues - 1;
        //         var rank = attrInfo.ranks[attr.value];
        //         if( rank ) {
        //             var valRank = (rank.max + rank.min - 1)/2;

        //             // if every value is unique, don't display bar
        //             if( (maxRank > 30 && attrInfo.values.length > maxRank/2) || attrInfo.valuesCount[attrInfo.values[attrInfo.values.length - 1] ] == 1 ) {
        //                 elem.setAttribute("height", "0px");
        //                 return;
        //             }
        //             canvasElem = Snap(wd, opts.distrHt);
        //             canvasElem.prependTo(elem);

        //             // draw the category distribution bar
        //             bar = _drawCategoryBar(canvasElem, barWd, attr, attrInfo, opts, tooltip, elem);
        //             // draw the marker
        //             bar.itemMarker = _drawMarker(attr, canvasElem, barWd, valRank, maxRank, opts);
        //             return true;
        //         }
        //         return false;
        //     }

        //     return true;
        // }

        // function _drawRankBar(canvas, barWd, attr, attrInfo, isMulti, opts, tooltip, elem) {
        //     var maxRank = attrInfo.values.length - 1;
        //     var bar = canvas.rect(opts.marginX, opts.distrHt - opts.barHt - opts.marginBtm, barWd, opts.barHt);

        //     bar.attr({
        //         "fill": isMulti ? opts.multibarColor : opts.barColor,
        //         "stroke": isMulti ? opts.multibarColor : opts.barColor
        //     });

        //     // set up bar event handlers
        //     var debHover = opts.callbacks.hover;
        //     var throttledUpdate = _.throttle(updateTooltip, 50);

        //     bar.hover(throttledUpdate, removeTooltip)
        //        .mousemove(throttledUpdate);

        //     function updateTooltip(ev) {    // in/move handler
        //         var x = mappr.stats.distr.offsetXY(ev).offsetX - opts.marginX;
        //         var val = attrInfo.values[Math.floor((maxRank + 1)*x/(barWd + 1))];
        //         $("strong", tooltip).text(mappr.utils.numericString(val));

        //         tooltip.css({
        //             position : 'absolute',
        //             "z-index" : 100
        //         });
        //         tooltip.show();
        //         tooltip.css({
        //             "top" : elem.offsetTop + opts.distrHt - opts.barHt - opts.marginBtm - tooltip[0].scrollHeight,
        //             left : elem.offsetLeft + x + opts.marginX - tooltip.outerWidth()/2
        //         });
        //         debHover(attr.id, val, $.Event(ev));
        //     };

        //     function removeTooltip() {  // out handler
        //         // console.log(dirPrefix, 'removing tooltip')
        //         throttledUpdate.cancel();
        //         tooltip.hide();
        //         opts.callbacks.unhover();
        //     };

        //     return bar;
        // }

        // function _drawCategoryBar(canvas, barWd, attr, attrInfo, opts, tooltip, elem) {
        //     var highlight;
        //     var maxRank = attrInfo.nValues - 1;
        //     var bar = canvas.rect(opts.marginX, opts.distrHt - opts.barHt - opts.marginBtm, barWd, opts.barHt);

        //     bar.attr({
        //         fill: opts.barColor,
        //         stroke: opts.barColor
        //     });

        //     // draw the vertical breaks in the bar
        //     var i = 0, prev = -1;
        //     for (var i = 0; i < attrInfo.values.length - 1; i++) {
        //         var val = attrInfo.values[i];
        //         var max = attrInfo.ranks[val].max;

        //         if( max != prev ) {
        //             prev = max;
        //             var x = opts.marginX + barWd * max/(maxRank + 1);

        //             canvas.path("M" + x + "," + (opts.distrHt - opts.barHt - opts.marginBtm)
        //                       + "L" + x + "," + (opts.distrHt - opts.marginBtm))
        //                   .attr({stroke: opts.lineColor})
        //                   .attr("stroke-width", "1");
        //         }
        //     }

        //     // set up bar event handlers
        //     var prev;
        //     var debHover = opts.callbacks.hover;
        //     var throttledUpdate = _.throttle(updateTooltip, 50);

        //     bar.hover(showTooltip, hideTooltip)
        //        .mousemove(showTooltip);

        //     function showTooltip(ev) {

        //         var val, x = mappr.stats.distr.offsetXY(ev).offsetX - opts.marginX, min, max;
        //         var idx = Math.floor((maxRank + 1)*x/(barWd + 1));

        //         //console.log(dirPrefix, 'Updating TOOLTIP, x = ' + x);

        //         for(var i = 0; i < attrInfo.values.length; i++) {
        //             val = attrInfo.values[i];

        //             if(idx < attrInfo.ranks[val].max ) {
        //                 min = attrInfo.ranks[val].min * barWd /(maxRank + 1);
        //                 max = attrInfo.ranks[val].max * barWd /(maxRank + 1);
        //                 break;
        //             }

        //         }

        //         if(val != prev) {
        //             prev = val;
        //             removeHighlight();
        //             // highlight the hovered category
        //             highlight = canvas.rect(opts.marginX + min, opts.distrHt - opts.barHt - opts.marginBtm, max-min, opts.barHt);
        //             highlight.attr({
        //                 fill: opts.hiliteColor,
        //                 stroke: opts.hiliteColor
        //             });

        //             highlight.hover(throttledUpdate, hideTooltip)
        //                      .mousemove(throttledUpdate, hideTooltip)
        //                      .click(clickHandler);
        //             if( bar.itemMarker ) {
        //                 canvas.append(bar.itemMarker);      // move marker to top
        //             }

        //             tooltip.on('mouseover', hideTooltip);
        //             //@rich havent we already established that this value is non-numeric?
        //             //$("strong", tooltip).text(mappr.utils.numericString(val));
        //             $("strong", tooltip).text(val);
        //             tooltip.css({
        //                 position: 'absolute',
        //                 'z-index': 100
        //             });
        //         }
        //         tooltip.show();
        //         throttledUpdate(ev);
        //     }

        //     function updateTooltip(ev) {
        //         //console.log(dirPrefix, 'updating tooltip');
        //         var x = mappr.stats.distr.offsetXY(ev).offsetX - opts.marginX;

        //         tooltip.css({
        //             "top" : elem.offsetTop + opts.distrHt - opts.barHt - opts.marginBtm - tooltip[0].scrollHeight,
        //             left :  elem.offsetLeft + x + opts.marginX - tooltip.outerWidth()/2
        //         });

        //         // Graph interaction on hover
        //         debHover(attr.id, prev, $.Event(ev));
        //     }

        //     function removeHighlight(ev) {
        //         if(highlight !== undefined) {
        //             console.log(dirPrefix, 'Removing highlight');
        //             highlight.unhover(throttledUpdate).unmousemove(throttledUpdate).unclick(clickHandler);
        //             highlight.remove();
        //             highlight = undefined;
        //             opts.callbacks.unhover();
        //         }
        //     }

        //     function hideTooltip(ev) {
        //         var xy = mappr.stats.distr.offsetXY(ev);
        //         var x = xy.offsetX, y = xy.offsetY;
        //         var bnds = bar.getBBox();
        //         //var hbnds = highlight.getBBox();

        //         if( x <= bnds.x || y <= bnds.y || x >= bnds.x2 || y >= bnds.y2 ) {
        //             console.log(dirPrefix, 'hiding tooltip');
        //             removeHighlight();
        //             tooltip.off('mouseover', hideTooltip);
        //             tooltip.hide();
        //             prev = undefined;
        //             console.log('REMOVING TOOLTIP')
        //         }
        //         opts.callbacks.unhover();
        //     }

        //     function clickHandler(ev) {
        //         if( prev !== undefined ) {
        //             opts.callbacks.select(attr.id, prev, $.Event(ev));
        //             ev.stopPropagation();
        //         }
        //     }

        //     return bar;
        // }

        // function _drawMarker(attr, canvas, barWd, valRank, maxRank, opts) {
        //     var markerX = opts.marginX + barWd * (0.5 + valRank)/(maxRank + 1);
        //     var marker = mappr.stats.distr.drawMarker(canvas, barWd, markerX, opts);
        //     mappr.stats.distr.setupMarkerEvents(marker, attr, opts);
        //     return marker;
        // }

        // /*
        // * MultiRank Bar logic
        // */

        // function buildMultiRankBar(elem, tooltip, attr, attrInfo, opts, callbacks) {
        //     var wd = elem.clientWidth;
        //     var canvasElem, bar;
        //     var barWd = wd - 2*opts.marginX;
        //     var maxShowTicks = 100;   // biggest data set to show as individual ticks instead of as a histogram
        //     var nBins = 20;           // 5% per bin
        //     //var tooltip = $(elem).find(".d3-tip");

        //     opts.distrHt = opts.multiDistrHt;
        //     opts.callbacks = callbacks;
        //     elem.setAttribute("height", opts.distrHt+"px");

        //     if( barWd > 0 ) {
        //         if( attrInfo.isNumeric) {
        //             numericBar();
        //         } else {
        //             nonNumericBar();
        //         }
        //     }

        //     function numericBar() {
        //         var i, maxRank = attrInfo.values.length - 1;
        //         canvasElem = Snap(wd, opts.distrHt);
        //         canvasElem.prependTo(elem);

        //         // draw the rank bar
        //         bar = _drawRankBar(canvasElem, barWd, attr, attrInfo, true, opts, tooltip, elem);


        //         if(maxRank < maxShowTicks) {
        //             // draw tick mark for each value
        //             // find unique values
        //             var val, valCount = {};
        //             for( i = 0; i < attr.values.length; i++) {
        //                 val = attr.values[i].value;
        //                 valCount[val] = (valCount[val] === undefined) ? 1 : valCount[val] + 1;
        //             }
        //             // draw tick for each unique value
        //             var vals = _.keys(valCount);
        //             for( var i = 0; i < vals.length; i++) {
        //                 val = parseFloat(vals[i]);
        //                 var rank = attrInfo.valuesCount[val].rank;
        //                 var valRank = rank.min; //(rank.max + rank.min)/2;
        //                 _drawTick(canvasElem, attr, val, bar, barWd, valRank, valCount[val], maxRank, opts);
        //             }
        //         }
        //         else {
        //             // draw histogram
        //             // initialize bins
        //             var binSizes = new Array(nBins);
        //             i = nBins;
        //             while (--i >= 0) {
        //                 binSizes[i] = 0;
        //             }
        //             // count values in each bin and track max count
        //             var max = 0;
        //             for( i = 0; i < attr.values.length; i++) {
        //                 val = attr.values[i].value;
        //                 var rank = attrInfo.valuesCount[val].rank;
        //                 // accumulate to bins; if multiple ranks, split across bins
        //                 var binMin = Math.floor(nBins * rank.min/maxRank);
        //                 var binMax = Math.floor(nBins * rank.max/maxRank);
        //                 var nRankBins = binMax - binMin + 1;

        //                 for(var bin = binMin; bin <= binMax; bin++) {
        //                     var count = binSizes[bin] += 1/nRankBins;
        //                     if( count > max ) {
        //                         max = count;
        //                     }
        //                 }
        //             }
        //             // draw the bins
        //             var x = 0, deltax = barWd/nBins;
        //             for(i = 0; i < nBins; i++) {
        //                 _drawBin(canvasElem, attr, attrInfo, bar, barWd, binSizes[i]/max, x, deltax, opts, tooltip);
        //                 x += deltax;
        //             }

        //         }
        //     };

        //     function nonNumericBar() {   // draw rank bar and histogram for a non-numeric attribute
        //         var maxRank = attrInfo.nValues - 1;

        //         // if every value is unique, don't display bar
        //         if( (maxRank > 30 && attrInfo.values.length > maxRank/2) || attrInfo.valuesCount[attrInfo.values[attrInfo.values.length - 1] ] == 1 ) {
        //             elem.setAttribute("height", "0px");
        //             return;
        //         }
        //         canvasElem = Snap(wd, opts.distrHt);
        //         canvasElem.prependTo(elem);

        //         // draw the category distribution bar
        //         bar = _drawCategoryBar(canvasElem, barWd, attr, attrInfo, opts, tooltip, elem);
        //         // draw tick mark for each value
        //         // first find all the unique values
        //         var val, valCount = {};
        //         for( var i = 0; i < attr.values.length; i++) {
        //             val = attr.values[i].value;
        //             valCount[val] = (valCount[val] === undefined) ? 1 : valCount[val] + 1;
        //         }
        //         // draw (wide) tick for each unique value
        //         var vals = _.keys(valCount);
        //         for( var i = 0; i < vals.length; i++) {
        //             val = vals[i];
        //             var rank = attrInfo.ranks[val];
        //             var valRank = rank.min; //(rank.max + rank.min - 1)/2;
        //             _drawTick(canvasElem, attr, val, bar, barWd, valRank, valCount[val], maxRank, opts);
        //         }
        //     };
        // };

        // function _drawBin(canvas, attr, attrInfo, bar, barWd, frac, binx, wd, opts, tooltip) {
        //     if(frac > 0) {
        //         var maxRank = attrInfo.values.length - 1;
        //         var bin = canvas.rect(binx + opts.marginX, opts.distrHt - opts.marginBtm - opts.barHt, wd, opts.barHt);

        //         bin.attr({fill: attr.colorStr, stroke: attr.colorStr, opacity: frac})
        //            .attr("stroke-opacity", frac);

        //         bin.hover(inHandler, outHandler).mousemove(moveHandler).click(clickHandler);
        //     }

        //     function inHandler(ev) {
        //         mappr.stats.distr.triggerEvent(bar, 'mousein', ev); // pass event through to underlying bar
        //     };

        //     function outHandler(ev) {
        //         mappr.stats.distr.triggerEvent(bar, 'mouseout', ev); // pass event through to underlying bar
        //     };

        //     function moveHandler(ev) {
        //         mappr.stats.distr.triggerEvent(bar, 'mousemove', ev); // pass event through to underlying bar
        //     };

        //     function clickHandler(ev) {
        //         var x = mappr.stats.distr.offsetXY(ev).offsetX - opts.marginX;
        //         var val = attrInfo.values[Math.floor((maxRank + 1)*x/(barWd + 1))];
        //         opts.callbacks.select(attr.id, val, $.Event(ev));
        //         ev.stopPropagation();
        //     };
        // };

        // function _drawTick(canvas, attr, val, bar, barWd, valRank, count, maxRank, opts) {
        //     var label, popup;
        //     var tickWd = Math.max(2, barWd * count/(maxRank + 1));
        //     var tickX = opts.marginX + tickWd/2 + barWd * valRank/(maxRank + 1);
        //     var tickBtm = opts.distrHt - opts.marginBtm;
        //     var tick = canvas.path("M" + tickX + "," + tickBtm
        //                   + "L" + tickX + "," + (tickBtm - opts.barHt));
        //     tick.attr({stroke: attr.colorStr})
        //         .attr("stroke-width", tickWd);

        //     tick.hover(inHandler, outHandler).mousemove(moveHandler);

        //     function inHandler(ev) {
        //          // console.log('Trigger in');
        //         mappr.stats.distr.triggerEvent(bar, 'mousein', ev); // pass event through to underlying bar
        //         tick.appendTo(canvas);
        //     };

        //     function outHandler(ev) {
        //         // console.log('Trigger out');
        //         mappr.stats.distr.triggerEvent(bar, 'mouseout', ev); // pass event through to underlying bar
        //         tick.appendTo(canvas);
        //     };

        //     function moveHandler(ev) {
        //         console.log('Trigger move');
        //         mappr.stats.distr.triggerEvent(bar, 'mousemove', ev); // pass event through to underlying bar
        //         tick.appendTo(canvas);
        //     };

        // };


        // this.buildMultiRankBar = buildMultiRankBar;
        // this.buildRankBar = buildRankBar;
        this.NonNumericRankBar = NonNumericRankBar;
    }).call(mappr.stats.distr);
})();
