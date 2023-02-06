(function() {
    'use strict';

    sigma.utils.pkg('mappr');

    /**
     *  interactive distribution plot for values that are lists of tags
     *  plots show relative frequency of tags in whole data set or in nodes
     *  with a particular value of a grouping attribute
     *  tags are displayed as a grid of buttons
     *  with the text grayscale showing tag importance or count
     *  tooltip rollover shows details (full name, group and global counts)
     */

    mappr.stats = mappr.stats || {};
    mappr.stats.distr = mappr.stats.distr || {};

    (function() {

        // For logging
        //var dirPrefix = '[tagDistr: ]';

        //var tagBg = "#eee";
        //var tagBorder = "#aaa";
        var textColor = "#222";
        var borderWd = 4;
        var rowsShowing = 4;
        var isShowingAll = false;

        //var minCols = 1; // minimum nuymber of columns in tag grid
        var maxTags = 100; // maximum number of toags to display

        // lodash _.forEach doen't work on objects with a property named "length"
        function _forEachInObj(obj, fn) {
            var keys = _.keys(obj);
            _.forEach(keys, function(key) {
                fn(obj[key], key);
            });
        }

        // compute tfidf-like importance score for each tag
        // returns array sorted by importance, values normalized so > 1 is more common than at random
        function computeTagImportance(attr, attrInfo, groupInfo, isAggregate, sortImportance) {

            // tag importance as a function of tag frequency in cluster and global tag frequency
            var computeImportance = function(clustFreq, globalFreq) {
                return clustFreq * clustFreq / globalFreq;
            };

            var tagImportance = [];
            var groupTotal = 0,
                globalTotal = 0;
            if (groupInfo) { // attribute is single node
                // for each tag in attribute, compute importance
                _.forEach(attr.value, function(val) {
                    var importance;
                    var groupFreq = groupInfo.valuesCount[val];
                    var globalFreq = attrInfo.valuesCount[val];
                    if (groupFreq === undefined) {
                        groupFreq = 1;
                    }
                    if (globalFreq == undefined) {
                        globalFreq = 1;
                    }
                    importance = (globalFreq == 1) ? 0 : computeImportance(groupFreq, globalFreq);
                    groupTotal += groupFreq;
                    globalTotal += globalFreq;
                    tagImportance.push({
                        tag: val,
                        importance: importance,
                        count: groupFreq,
                        globalCount: globalFreq
                    });
                });
            } else { // attribute is multiple nodes or singleton with no group attribute
                var values = isAggregate ? attr.values : [attr];
                // count freq of each tag
                var valCount = {};
                _.forEach(values, function(vals) {
                    _.forEach(vals.value, function(val) {
                        valCount[val] = (valCount[val] === undefined) ? 1 : valCount[val] + 1;
                    });
                });
                // compute importance of each tag
                _forEachInObj(valCount, function(groupFreq, val) {
                    var globalFreq = attrInfo.valuesCount[val];
                    groupTotal += groupFreq;
                    if (globalFreq !== undefined) {
                        globalTotal += globalFreq;
                        tagImportance.push({
                            tag: val,
                            importance: computeImportance(groupFreq, globalFreq),
                            count: groupFreq,
                            globalCount: globalFreq
                        });
                    } else if (!isAggregate) {
                        globalTotal += 1;
                        tagImportance.push({
                            tag: val,
                            importance: 0,
                            count: groupFreq,
                            globalCount: 1
                        });
                    }
                });
            }
            // descending sort by importance or count
            if (sortImportance) {
                tagImportance.sort(function(a, b) {
                    return b.importance - a.importance;
                });
            } else {
                tagImportance.sort(function(a, b) {
                    return b.count - a.count;
                });
            }
            // keep at most maxTags items
            if (tagImportance.length > maxTags) {
                tagImportance.length = maxTags;
            }
            // normalize
            if (tagImportance.length > 0) {
                var max = tagImportance[0].importance,
                    norm = computeImportance(groupTotal, globalTotal);
                _.forEach(tagImportance, function(t) {
                    //in case single tag and max importance is zero (else will result in NaN)
                    t.relImportance = (max > 0) ? t.importance / max : 1;
                    t.importance /= norm;
                });
            }
            return tagImportance;
        }

        /*
         * Tag Distr logic
         */
        function buildTagDistr(elem, tooltip, attr, attrInfo, groupInfo, isAggregate, opts, callbacks) {
            var $elem = $(elem);
            var wd = $elem.width();
            var canvasElem;
			//var marker, bar;
            var barWd = wd - 2 * opts.marginX;
            var nBuilt = 0;
            var addTag = _.noop,
                addTags = _.noop;
            //var tooltip = $(elem).find(".d3-tip");
            opts.callbacks = callbacks;
            if (barWd > 0) {
                addTag = function(item) {
                    item.elem = canvasElem.text(0, 0, item.tag);
                    bbox = item.elem.getBBox();
                    item.wd = bbox.width;
                    item.ht = bbox.height;
                };

                addTags = function(startRow, endRow) {
                    for (var i = startRow; i < endRow; i++) {
                        var item = tagInfo[i];
                        if (item.elem == undefined) {
                            addTag(item);
                        }
                        if (!isAggregate || item.importance > 0) { // show important tags of aggregates or all tags of single node
                            var x = opts.marginX;
                            var y = (i + 1) * (maxHt + 2 * borderWd);
                            _setDisplayTag(item, maxWd);
                            _drawTag(canvasElem, attr, x, y, maxWd, maxHt, item, opts, tooltip, $elem);
                            nBuilt++;
                        }
                    }
                };

                canvasElem = Snap(wd, 0);
                canvasElem.prependTo(elem);
                var tagInfo = computeTagImportance(attr, attrInfo, groupInfo, isAggregate, true);
                if (tagInfo.length == 0) {
                    return false;
                }
                var bbox, maxWd = wd,
                    maxHt = 0;
                var nRows = tagInfo.length;
                var initRows = Math.min(nRows, 4);
                // build svg text items for initial tags
                for (var i = 0; i < initRows; i++) {
                    var item = tagInfo[i];
                    addTag(item);
                    // keep track of biggest text element
                    if (item.ht > maxHt) {
                        maxHt = bbox.height;
                    }
                }
                // pad the max dimensions
                //give more horizontal padding to text within rect
                maxWd -= 60;
                maxHt += 20;

                maxWd = barWd - 8; // max length of text
                // set height of whole panel and of svg element within panel
                var containerHt = Math.min(rowsShowing, nRows) * (maxHt + 2 * borderWd) + 2;
                var maxContainerHt = nRows * (maxHt + 2 * borderWd) + 2;
                var elemHt = nRows * (maxHt + 2 * borderWd) + 2;
                $elem.css({
                    'height': containerHt
                });
                canvasElem.attr('height', elemHt);
                // place tag text in grid of tag buttons, only add a few to start with
                addTags(0, initRows);
                // elem.css({'overflow-x': 'visible'});
                // scroll big panels; process scrolling so scroll only happens the panel, and is not passed to the parent
                if (elemHt > containerHt) {
                    $elem.css({
                        'overflow-y': 'hidden'
                    });
                    //var maxScroll = elem.scrollHeight - containerHt;
                    var fadeTop = $elem.find(".scrollerFadeTop");
                    //var fadeBtm = $elem.find(".scrollerFadeBottom");
                    var moreBtn = $elem.parent().parent().parent().find('.more-btn');
                    fadeTop.css({
                        width: $elem.width(),
                        top: 0
                    });
                    // fadeBtm.css({
                    //     width : $elem.width(),
                    //     top : containerHt - fadeBtm.height()
                    // }).show();

                    var moreTxt = '<i class="fa fa-plus-circle"/> ' + String(tagInfo.length - rowsShowing) + ' more&hellip;';
                    moreBtn.find('.text').html(moreTxt);

                    moreBtn.bind('click', function() {
                        if (isShowingAll) {
                            $elem.height(containerHt);
                            // fadeBtm.show();
                            moreBtn.find('.text').html(moreTxt);
                        } else {
                            $elem.height(maxContainerHt);
                            // fadeBtm.hide();
                            moreBtn.find('.text').html('<i class="fa fa-minus-circle"/> less&hellip;');
                            // add tag elemnts if needed
                            if (nBuilt < nRows) {
                                addTags(nBuilt, nRows);
                            }
                        }
                        isShowingAll = !isShowingAll;
                    });
                    moreBtn.show();
                    console.debug('more text: ' + moreBtn.html());

                    //add margin on bottom to create room for moreBtn
                    $elem.css({
                        marginBottom: 20
                    });

                    // $elem.bind('mousewheel', function(ev, scroll) {
                    //     var self = this;
                    //     if((this.scrollTop >= maxScroll && scroll < 0) || (this.scrollTop === 0 && scroll > 0)) {
                    //         ev.preventDefault();
                    //     }
                    //     fadeTop.css({top : this.scrollTop});
                    //     fadeBtm.css({top : containerHt - fadeBtm.height() + this.scrollTop});
                    //     _.delay(function() {
                    //         (self.scrollTop > 0) ? fadeTop.show() : fadeTop.hide();
                    //         (self.scrollTop < maxScroll) ? fadeBtm.show() : fadeBtm.hide();
                    //     }, 100);
                    // });
                }
                return true;
            }

            // truncate displayed tag string if needed
            function _setDisplayTag(item, len) {
                len = 220;
                if (item.wd > len) {
                    var charWd = item.wd / item.tag.length;
                    var newTag = _.trunc(item.tag, Math.floor(len / charWd));
                    item.elem.attr("text", newTag);
                    item.wd = item.elem.getBBox().width;
                }
            }
        }

        function _drawTag(canvas, attr, x, y, wd, ht, item, opts, tooltip, elem) {
            var getTagColor = function(wt) {
                var c = d3.rgb(attr.colorStr ? attr.colorStr : opts.nodeColorStr);
                c.r = Math.floor(c.r * wt + 0xd0 * (1 - wt));
                c.g = Math.floor(c.g * wt + 0xd0 * (1 - wt));
                c.b = Math.floor(c.b * wt + 0xd0 * (1 - wt));
                return c.toString();
            };

            // draw the tag as a rounded rectangle
            var tag = canvas.rect(x, y - ht, wd, ht, 0);
            var tagCol = getTagColor(item.relImportance);
            tag.attr({
                // fill: tagBg,
                fill: tagCol,
                stroke: tagCol,
                "stroke-width": borderWd
            });
            // center the text in the tag and shade based on importance
            item.elem.attr({
                x: x + wd / 2 - item.wd / 2,
                y: y - ht / 2 + item.ht / 2 - 2,
                fill: textColor
            });
            // item.elem.attr("paint-order", "stroke");
            // text doesn't get mouse events
            item.elem.attr("pointer-events", "none");
            // pull text to the front
            item.elem.appendTo(canvas);

            // set up bar event handlers
            var debHover = opts.callbacks.hover;
            // console.log('------------------%%%%%');
            // console.log(debHover);
            var throttledUpdate = _.throttle(hoverHandler, 50);

            tag.hover(throttledUpdate, outHandler)
                .mousemove(throttledUpdate)
                .click(clickHandler);

            function hoverHandler(ev) { // in/move handler
                // set tooltip text
                var str = item.tag + " (" + item.count + " of " + item.globalCount + ")";
                $("strong", tooltip).text(str);
                tooltip.css({
                    position: 'absolute',
                    "z-index": 100
                });
                tooltip.show();
                var top = elem[0].offsetTop + y - ht - tooltip[0].scrollHeight - elem[0].scrollTop;
                var left = elem[0].offsetLeft + x + wd / 2 - tooltip.outerWidth() / 2;
                tooltip.css({
                    "top": top,
                    "left": left
                });
                // delayed hover to show nodes in graph
                debHover(attr.id, item.tag, $.Event(ev));
            }

            function outHandler() { // out handler
                throttledUpdate.cancel();
                // debHover.cancel(); // not required. managed by callbacks.
                tooltip.hide();
                opts.callbacks.unhover();
            }

            function clickHandler(ev) {
                opts.callbacks.select(attr.id, item.tag, $.Event(ev));
                ev.stopPropagation();
            }

        }

        this.buildTagDistr = buildTagDistr;
    }).call(mappr.stats.distr);
})();
