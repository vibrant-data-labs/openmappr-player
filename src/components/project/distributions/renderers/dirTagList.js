/*globals d3,$  */
angular.module('common')
    .directive('dirTagList', ['$timeout', '$q', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES',
        function($timeout, $q, FilterPanelService, dataGraph, AttrInfoService, SelectorService, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                require: '?^dirAttrRenderer',
                scope: true,
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var dirPrefix = '[dirTagList] ';
            var noTagId = 'no tags';
            var defTagBackgroundColor = "#555555";
            var totalNodes = dataGraph.getAllNodes().length;
            var ITEMS_TO_SHOW = 100;
            var ITEMS_TO_SHOW_INITIALLY = 10;

            var tooltipText;


            /*************************************
    ******** Controller Function *********
    **************************************/


            /*************************************
    ******** Post Link Function *********
    **************************************/
            function postLinkFn(scope, element, attrs, renderCtrl) {
                var attrId = scope.attrToRender.id;
                var filteringTagVals = [];
                var inFilteringMode = false;
                var searchFn = _.debounce(searchTags, 300);
                var sortOrder = scope.attrToRender.sortOps.sortOrder;
                var sortType = scope.attrToRender.sortOps.sortType;

                var distrData = {
                    numShowGroups : 0, // num of groups to show. increase with clicking 'more', clicking 'less' reduces it to 0 (+ ITEMS_TO_SHOW_INITIALLY)
                    showAllTags : false, //whether to show all tags or only tags on the selected nodes
                    tagListData : null,
                    nUniqueTags : 0,
                    nShownTags : ITEMS_TO_SHOW_INITIALLY,
                    searchQuery: '',
                    tagsDataCopy: null,
                    inFilteringMode: false
                };
                scope.distrData = distrData;

                function draw(attribOrdering) {

                    var cs       = FilterPanelService.getCurrentSelection(),
                        attrInfo     = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id),
                        tagListData  = gentagListData(cs, attrInfo, filteringTagVals, defTagBackgroundColor, sortType, sortOrder);//FilterPanelService.getColorString());

                    if(attribOrdering) {
                        tagListData.data = reOrderTags(attribOrdering, tagListData.data);
                    }
                    inFilteringMode = !!attribOrdering;

                    scope.distrData.tagListData = tagListData;
                    scope.distrData.tagsDataCopy = tagListData.data.slice();
                    scope.distrData.inFilteringMode = inFilteringMode;
                    distrData.showAllTags = false;
                    console.log('distrData: ', distrData);
                    renderDistr(element, tagListData, applyFilter, scope, inFilteringMode, renderCtrl);
                }

                // Fix width via margins / padding.
                try {
                    filteringTagVals = _.clone(_.get(FilterPanelService.getFilterForId(attrId), 'state.selectedVals')) || [];
                    draw();
                } catch(e) {
                    console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                }

                // reset filters as well
                scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
                    try {
                        filteringTagVals = [];
                        draw();
                    } catch(e) {
                        console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                    }
                });
                // on current selection change, update highlights
                scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function() {
                    try {
                        draw(_.map(scope.distrData.tagListData.data, 'tagId'));
                    } catch(e) {
                        console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
                    }
                });
                /**
         * watch filters being enabled disabled
         */
                scope.$watch('showFilter', function onShowFilterChanged(newVal, oldVal) {
                    if(scope.distrData.tagListData && oldVal != newVal) {
                        var tagListDiv = element.find('.tag-list');
                        var d3sel = d3.select(tagListDiv[0]).selectAll('div.tag-item');
                        updateFilterStatus(d3sel, newVal, scope.disableFilter);
                        applyFilter(scope.distrData.tagListData);
                    }
                });

                scope.$on(BROADCAST_MESSAGES.fp.filter.reset, function() {
                    filteringTagVals = [];
                });

                scope.$watch('disableFilter', function onDisableFilterChanged(newVal, oldVal) {
                    if(scope.distrData.tagListData && oldVal != newVal) {
                        var tagListDiv = element.find('.tag-list');
                        var d3sel = d3.select(tagListDiv[0]).selectAll('div.tag-item');
                        updateFilterStatus(d3sel, scope.showFilter, newVal);
                        // applyFilter(scope.distrData.tagListData);
                    }
                });

                scope.$watch('distrData.searchQuery', searchFn);

                scope.$watch('attrToRender.sortOps', function(sortOps) {
                    console.log('dirTagList: sortOps', sortOps);
                    sortType = sortOps.sortType || 'statistical';
                    sortOrder = sortOps.sortOrder || 'desc';
                    var tagData = distrData.tagListData.data;
                    distrData.tagListData.data = sortTagData(tagData, sortType, sortOrder, distrData.tagListData.inSelectionMode);
                    renderDistr(element, scope.distrData.tagListData, applyFilter, scope, scope.distrData.inFilteringMode, renderCtrl);
                }, true);

                scope.overTag = function(event) {
                    var curTarget = $(event.target).closest('.tag-item');
                    var off = curTarget.position();
                    // tElem = curTarget[0],
                    // tElemPosnObj = tElem.getBoundingClientRect();
                    scope.tooltipText = tooltipText;
                    element.find('.tooltip-positioner').css({
                        top : off.top + curTarget.height()/2 - 10,
                        left : off.left + curTarget.width()
                    });
                    $timeout(function() {
                        scope.openTooltip = true;
                    }, 2);
                };

                scope.outTag = function() {
                    $timeout(function() {
                        scope.openTooltip = false;
                        renderCtrl.unHoverNodes();
                    }, 100);
                };

                scope.clearSearch = function() {
                    scope.distrData.searchQuery = '';
                    searchTags();
                };


                scope.showMore = function() {
                    console.log("showing more tags");
                    distrData.numShowGroups++;
                    distrData.showAllTags = true;
                    renderDistr(element, distrData.tagListData, applyFilter, scope, inFilteringMode, renderCtrl);
                };
                scope.showLess = function() {
                    distrData.numShowGroups = 0;
                    distrData.showAllTags = false;
                    renderDistr(element, distrData.tagListData, applyFilter, scope, inFilteringMode, renderCtrl);
                };

                function searchTags(searchVal) {
                    var inSelectionMode = distrData.tagListData.inSelectionMode;
                    if (searchVal) {
                        console.log('Searching tags for', searchVal);
                        var tagListData = _.filter(scope.distrData.tagsDataCopy, function(tagData) {
                            return tagData.tagText.match(new RegExp('^' + searchVal, 'i'));
                        });

                        scope.distrData.tagListData.data = sortTagData(tagListData, sortType, sortOrder, inSelectionMode);
                        renderDistr(element, scope.distrData.tagListData, applyFilter, scope, scope.distrData.inFilteringMode, renderCtrl);
                    }
                    else {
                        scope.distrData.tagListData.data = sortTagData(scope.distrData.tagsDataCopy, sortType, sortOrder, inSelectionMode);
                        renderDistr(element, scope.distrData.tagListData, applyFilter, scope, scope.distrData.inFilteringMode, renderCtrl);
                    }
                }

                /// filter stuff
                /// when a filter is applied, all the other filters are greyed out.
                /// When the current selection is refreshed, the tagList gets sorted depending upon the importance in the CS
                function applyFilter () {
                    var filterConfig = FilterPanelService.getFilterForId(attrId);
                    filteringTagVals = _.map(_.filter(distrData.tagListData.data, 'isFiltering'), 'tagId');

                    filterConfig.isEnabled = filteringTagVals.length > 0 && scope.showFilter;
                    filterConfig.state.selectedVals = _.clone(filteringTagVals);
                    filterConfig.selector = filterConfig.isEnabled ? genSelector(filteringTagVals) : null;

                    // scope.$emit(BROADCAST_MESSAGES.fp.filter.changed, {
                    //     filterConfig : filterConfig
                    // });
                }
                function genSelector (selectedVals) {
                    var selector = SelectorService.newSelector();
                    selector.ofMultipleAttrValues(attrId, selectedVals, true);
                    return selector;
                }
            }






            /*************************************
    ************ Local Functions *********
    **************************************/

            /**
     * tagList styling in _renderers.scss
     */


            /**
     * Generate tag list
     * @param  {Array} currentSel       The current selection
     * @param  {Object} globalAttrInfo   The attrInfo object
     * @param  {Array} filteringTagVals tag Values which are being used to filter the list
     * @param  {String} colorStr         The chosen color this distribution
     * @return {Object}                  An object used to render tag listing
     */
            function gentagListData (currentSel, globalAttrInfo, filteringTagVals, colorStr, sortType, sortOrder) {
                var attrInfo = globalAttrInfo;
                var currSelFreqs = getCurrSelFreqsObj(currentSel, attrInfo.attr.id);

                var tagData = _.compact(_.map(globalAttrInfo.values, function genTagData(tagVal) {
                    var globalFreq = attrInfo.valuesCount[tagVal],
                        selTagFreq = currSelFreqs[tagVal];

                    // FILTER tags
                    if(currentSel.length > 0) {
                        //skip tag from selection, if
                        // a) UNUSED LOGIC: occurs in population less than twice ie globalFreq < 2
                        if(globalFreq < 1) { return; }
                        // b) UNUSED LOGIC: there is a selection and the tag does not occur in selection
                        //if(selTagFreq === 0 || _.isUndefined(selTagFreq)){ return; }
                        // c) if tag does not occur is selection, set tag count to 0
                        if(_.isUndefined(selTagFreq)){ selTagFreq = 0;}
                    }

                    // IMPORTANCE
                    // no selection - tag is important if its globally frequent. that is imp = glob freq.
                    // mult selection - tag is important if its locally frequent in selection but globally rare. that is imp = (local freq * local freq) / global freq
                    // in single node mode - tag is important if its globally rare. resulting in the inverse of glob freq. or (1 * 1) / glob freq
                    var importance = 1;
                    if(currentSel.length > 0) {
                        //single or multiple
                        importance = computeImportance(selTagFreq, globalFreq);
                    } else {
                        //no selection - ie global
                        importance = globalFreq;
                    }

                    return {
                        tagText : tagVal, // the text in the bar
                        tagId : tagVal, // the Id of tag
                        currSelFreq : selTagFreq || 0, // freq in selection
                        globalFreq : globalFreq, // freq in global data
                        importance : importance,
                        isFiltering : _.contains(filteringTagVals, tagVal),
                        colorStr : selTagFreq > 0 ? colorStr : null
                    };
                }));

                // SORT. BY IMPORTANCE Desc
                tagData = sortTagData(tagData, sortType, sortOrder, currentSel.length > 0);

                return {
                    numNodesInSel : currentSel.length,
                    inSelectionMode : currentSel.length > 0,
                    data : tagData,
                    currSelFreqs : currSelFreqs,
                    byImportance : true,
                    maxTagFreq : globalAttrInfo.maxTagFreq,
                    maxImportance : _.max(tagData, 'importance').importance,
                    filteringEnabled : filteringTagVals.length > 0
                };
            }

            function sortTagData(tagData, sortType, sortOrder, inSelection) {
                var sortFn = function(tag) { return tag.importance; }; //sortType: statistical
                if(sortType === 'alphabetical') { sortFn = function(tag) { return tag.tagText.toLowerCase(); }; }
                if(sortType === 'frequency') { sortFn = function(tag) {
                    return inSelection ? tag.currSelFreq : tag.globalFreq;
                };}
                var sortedTagData = _.sortBy(tagData, sortFn);
                if(sortOrder === 'desc') { sortedTagData = sortedTagData.reverse(); }
                return sortedTagData;
            }

            // tag importance as a function of tag frequency in local selection and global tag frequency
            function computeImportance (localFreq, globalFreq) {
                return (localFreq*localFreq)/globalFreq;
            }
            function getCurrSelFreqsObj (currentSel, attrId) {
                return _.reduce(currentSel, function(acc, node) {
                    if(node.attr[attrId]) {
                        _.each(node.attr[attrId], function(tagVal) {
                            acc[tagVal] = acc[tagVal]  + 1 || 1;
                        });
                    }
                    return acc;
                }, {});
            }

            function renderTagList (tagListDiv, tagListData, scope, attrId, inFilteringMode) {

                var numShowGroups = scope.distrData.numShowGroups,
                    inSelectionMode = tagListData.inSelectionMode,
                    numNodesInSel = tagListData.numNodesInSel;

                var dataToShow = null;
                if(inFilteringMode || scope.distrData.showAllTags || !tagListData.inSelectionMode) {
                    dataToShow = tagListData.data;
                } else {
                    dataToShow = _.filter(tagListData.data, function(tagData) { return tagData.currSelFreq > 0; });
                }
                dataToShow = _.take(dataToShow, numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY);

                if(dataToShow.length === 0) {
                    dataToShow = [{
                        tagText : 'no tags in selection', // the text in the bar
                        tagId : noTagId, // the Id of tag
                        currSelFreq : 0, // freq in selection
                        globalFreq : 0, // freq in global data
                        importance : 0,
                        isFiltering : false,
                        colorStr : null
                    }];
                }

                // div for individual tag items
                // don't want it bound by Id. since array is already sorted
                var d3sel = d3.select(tagListDiv[0]).selectAll('div.tag-item').data(dataToShow, _.property('tagId'));

                var newTagItems = d3sel.enter()
                    .append('div')
                    .classed('tag-item', true);

                // remove old stuff
                d3sel.exit().remove();

                // a div for percentage bar
                var lbCont = newTagItems.append('div')
                    .classed('linebar-container transition', true);
                lbCont.append('div')
                    .classed('tag-linebar',true)
                // .style('width', byImportance ? widthByImportance : widthByFreq)
                    .style('width',  widthBySel)
                    .style('background-color', _.property('colorStr'));


                var row = newTagItems
                    .append('div')
                    .classed('row vert-align', true);

                var col = row
                    .append('div')
                    .classed('col-xs-2', true);

                // a div for checkbox
                var checkboxes = col
                    .append('div')
                    .classed('tag-checkbox',true);

                checkboxes.append('input')
                    .attr('type', 'checkbox')
                    .property('checked', false)
                    .classed('tag-checkbox-input',true);
                checkboxes.append('label')
                    .attr('for', attrId + '-' + _.property('tagText'))
                    .classed('tag-checkbox-label',true);

                // container for text and bar
                var tagRow = row
                    .append('div')
                    .classed('tag-row col-xs-10', true);

                // a div for text
                tagRow.append('div')
                    .classed('tag-text truncate h6 col-xs-10',true)
                    .text('new tag');

                // a div for count
                var countDiv = tagRow
                    .append('div')
                    .classed('col-xs-2',true);

                countDiv.append('div')
                    .classed('tag-count h6 text-right',true)
                    .text('count');

                // // a div for global hovering
                // row.append('div')
                //  .classed('tag-global col-xs-2',true)
                //  .text('O');

                ///
                /// UPDATE element values
                ///

                // add a class to tag rows where there count is 0
                d3sel.classed('tag-count-not-in-sel', _.matchesProperty(inSelectionMode? 'currSelFreq' : 'globalFreq', 0));

                //update check status
                d3sel.select('input.tag-checkbox-input').property('checked', _.property('isFiltering'));

                d3sel.classed('filter', scope.showFilter);

                // update classes
                updateFilterStatus(d3sel, scope.showFilter, scope.disableFilter);

                // update text for each tag
                d3sel.select('div.tag-text').text(_.property('tagText'));

                d3sel.select('input.tag-checkbox-input').attr('id', function(d) {
                    return attrId + '-' + d.tagText;
                });
                d3sel.select('label.tag-checkbox-label').attr('for', function(d) {
                    return attrId + '-' + d.tagText;
                });

                // update count
                d3sel.select('div.tag-count').text(function(d) {
                    //global
                    //show global frequency

                    //selection - multiple nodes
                    //show tag-frequency in selection
                    //except if tag-frequency in selection is 0.

                    //selection - single node
                    //dont show numbers - its always 1 (or 0)

                    if(inSelectionMode) {
                        if(numNodesInSel > 1){
                            return d.currSelFreq > 0 ? d.currSelFreq  : '';
                        } else {
                            return '';
                        }
                    } else {
                        return d.globalFreq;
                    }
                });


                // update bars widths
                d3sel.select('div.tag-linebar')
                // .style('width',  byImportance ? widthByImportance : widthByFreq)
                    .style('width',  widthBySel)
                    .style('background-color', _.property('colorStr'));

                // in correct order
                d3sel.order();
                return d3sel;

                // function widthByImportance(tagData) {
                //     var minWidth = tagData.currSelFreq > 0 ? 1 : 0;
                //     return Math.max(minWidth, roundTo2(tagData.importance / maxImportance * 100)).toFixed(2) + '%';
                // }
                // function widthByFreq(tagData) {
                //     var minWidth = tagData.currSelFreq > 0 ? 1 : 0;
                //     return Math.max(minWidth, roundTo2(tagData.globalFreq / maxTagFreq * 100)).toFixed(2) + '%';
                // }

                function widthBySel(tagData) {
                    var minWidth = tagData.currSelFreq > 0 ? 1 : 0;
                    if(inSelectionMode && numNodesInSel != 1) {
                        return Math.max(minWidth, roundTo2(tagData.currSelFreq / numNodesInSel * 100)).toFixed(2) + '%';
                    } else {
                        return Math.max(minWidth, roundTo2(tagData.globalFreq / totalNodes * 100)).toFixed(2) + '%';
                    }
                }
                function roundTo2 (num) { return Math.round(num * 100) / 100; }
            }

            function hookupEvents (tagListDiv, tooltipDiv, currentSel, globalAttrInfo, applyFilter, scope, renderCtrl) {
                var d3sel = d3.select(tagListDiv[0]);
                var attrId = globalAttrInfo.attr.id;

                //DO NOT SELECT WITHIN THE GROUP RIGHT NOW. UNTIL WE HAVE A SCHEME TO SELECT WITHIN BOTH GROUP AND GLOBAL SCOPE.
                //ON CLICK -> Select all nodes in population which is tagged by the tagId.
                // globalMode controls whether to select from selection or globally
                var globalMode = true, //currentSel.length <= 1,
                    nodeBins = {};

                // bin nodes according with tags
                if(!globalMode) {
                    nodeBins = _.reduce(currentSel, function (acc, node) {
                        _.each(node.attr[attrId],function (tag) {
                            if(!acc[tag]) {
                                acc[tag] = [];
                            }
                            acc[tag].push(node.id);
                        });
                        return acc;
                    }, {});
                }

                d3sel.selectAll('.tag-row')
                    .on('mouseenter', function updateTooltipAndHoverNodes(tagData) {
                        setTooltipText(tagData);
                        if(tagData.tagId === noTagId) { return; }
                        // hover nodes
                        if(!globalMode && nodeBins[tagData.tagId] && nodeBins[tagData.tagId].length > 0) {
                            renderCtrl.hoverNodeIdList(nodeBins[tagData.tagId], d3.event);
                        } else {
                            renderCtrl.hoverNodesByAttrib(attrId, tagData.tagId, d3.event);
                        }
                    })

                    .on('click', function selectNodes(tagData) {
                        d3.event.stopPropagation();
                        if(tagData.tagId === noTagId) { return; }
                        if(!globalMode && nodeBins[tagData.tagId] && nodeBins[tagData.tagId].length > 0) {
                            renderCtrl.selectNodeIdList(nodeBins[tagData.tagId], d3.event);
                        } else {
                            renderCtrl.selectNodesByAttrib(attrId, tagData.tagId, d3.event);
                        }
                        // $timeout(function() {
                        //  setTooltipText(tagData);
                        // });
                    });
                // global selector
                d3sel.selectAll('.tag-global')
                    .on('mouseenter', function highlightGlobalNodes(tagData) {
                        setTooltipText(tagData);
                        if(tagData.tagId === noTagId) { return; }
                        renderCtrl.hoverNodesByAttrib(attrId, tagData.tagId, d3.event);
                    })
                    .on('click',function(tagData) {
                        d3.event.stopPropagation();
                        if(tagData.tagId === noTagId) { return; }
                        renderCtrl.selectNodesByAttrib(attrId, tagData.tagId, d3.event);
                    });

                // filter checkbox
                var showFilter = scope.showFilter;
                // d3sel.select('input.tag-checkbox-input').on('input', function updateFilterData(tagData) {
                //  console.log("tag-checkbox-input changed!");
                //  tagData.isFiltering = !tagData.isFiltering;
                // });
                d3sel.selectAll('.tag-checkbox').on('click', function onInputClicked(tagData) {
                    d3.event.stopPropagation();
                    if(tagData.tagId === noTagId) { return; }
                    var parent = d3.select(this);
                    tagData.isFiltering = !tagData.isFiltering;

                    parent.select('input').property('checked', tagData.isFiltering);
                    updateFilterStatus(d3sel, showFilter, scope.disableFilter);
                    applyFilter();
                });
                d3sel.selectAll('.tag-checkbox label').on('click', function() { d3.event.stopPropagation(); });

                function setTooltipText (tagData) {
                    //NO SELECTION : Global
                    // tooltipText = tagData.tagText; // + '(' + tagData.globalFreq + ')';
                    // tooltipText = "Total tagged with " + tagData.tagText + ": " + tagData.globalFreq;
                    tooltipText = tagData.tagText + " (Total " + tagData.globalFreq + ' nodes tagged)';
                    if(currentSel.length == 1) {
                        //SINGLE NODE SELECITON
                        if(tagData.globalFreq == 1){
                            //UNIQUE TAG (FREQ = 1 in population)
                            tooltipText = tagData.tagText + ' is a unique tag';
                        } else {
                            //SHARED TAG (FREQ > 1 in population)
                            tooltipText = (tagData.globalFreq - 1) + ' other' + ((tagData.globalFreq > 2)? 's' : '') + ' tagged as ' + tagData.tagText;
                        }
                    } else if(currentSel.length > 1) {
                        //MULTI NODE SELECTION
                        // tooltipText = tagData.tagText + ' (' + tagData.currSelFreq + ' of ' +  tagData.globalFreq + ' tagged nodes)';
                        //tooltipText = tagData.currSelFreq  + ' of ' + tagData.globalFreq + ' total tagged as ' + tagData.tagText;
                        // tooltipText += "<h6 class='row vert-align'><span class='col-xs-8'>Selected tagged with &lsquo;" + tagData.tagText + "&rsquo;: </span><span class='col-xs-4'>" + tagData.currSelFreq + '</span></h6>';
                        // tooltipText += "<h6 class='row vert-align'><span class='col-xs-8'>Selected Nodes: </span><span class='col-xs-4'>" + currentSel.length + '</span></h6>';
                        // tooltipText += "<h6 class='row vert-align'><span class='col-xs-8'>Total tagged with &lsquo;" + tagData.tagText + "&rsquo;: </span><span class='col-xs-4'>" + tagData.globalFreq + '</span></h6>';
                        tooltipText += tagData.tagText + " (Total " + tagData.globalFreq + ' nodes tagged)';
                    }
                }
            }


            function renderDistr (element, tagListData, applyFilter, scope, inFilteringMode, renderCtrl) {
                var cs             = FilterPanelService.getCurrentSelection(),
                    globalAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id);

                var tooltip    = element.find(".d3-tip"),
                    tagInfoDiv = element.find(".tag-info"),
                    tagListDiv = element.find('.tag-list');

                //in the tag info - count only the non-zero frequency tags.
                //also the list inclused zero-freq tags.
                var nFilteredTags = _.filter(tagListData.data, 'currSelFreq').length;

                if(cs.length > 1) {
                    //tagInfoDiv.text(nUniqueTags + ' shared tags of ' + globalAttrInfo.nUniqueTags);
                    tagInfoDiv.text(nFilteredTags + ' tags in group, ordered by importance.');
                } else if(cs.length == 1) {
                    tagInfoDiv.text(nFilteredTags + ' tags ordered by importance.');
                } else {
                    tagInfoDiv.text(globalAttrInfo.nUniqueTags + ' tags ordered by frequency.');
                }

                scope.distrData.nUniqueTags = tagListData.data.length;
                scope.distrData.nShownTags = Math.min(scope.distrData.numShowGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY, tagListData.data.length);

                renderTagList(tagListDiv, tagListData, scope, globalAttrInfo.attr.id, inFilteringMode);
                hookupEvents(tagListDiv, tooltip, cs, globalAttrInfo, applyFilter, scope, renderCtrl);
                return tagListData;
            }

            function updateFilterStatus (d3sel, showFilter, disableFilter) {
                var anyFilterApplied = !d3sel.filter(_.property('isFiltering')).empty();

                var chkbox = d3sel.select('.tag-checkbox');

                // remove state
                d3sel.classed('tag-checkbox-on', false);
                d3sel.classed('tag-checkbox-off', false);
                chkbox.classed('tag-checkbox-disable', false);
                chkbox.classed('disableFilter', false);
                chkbox.classed('col-xs-2', true);
                d3sel.select('div.tag-row').classed('col-xs-10', true).classed('col-xs-12', null);

                if(anyFilterApplied && showFilter) {
                    d3sel.classed('tag-checkbox-on', _.property('isFiltering'));
                    d3sel.classed('tag-checkbox-off', _.negate(_.property('isFiltering')));
                } else if(!showFilter) {
                    chkbox.classed('tag-checkbox-disable', true);
                    chkbox.classed('col-xs-2', null);
                    d3sel.select('div.tag-row').classed('col-xs-10', null).classed('col-xs-12', true);
                }
                else if(disableFilter) {
                    chkbox.classed('disableFilter', true);
                }
            }

            function reOrderTags (ordering, data) {
                var idx = _.indexBy(data, 'tagId');
                var newOrder = _.reduce(ordering, function(acc, tagId) {
                    var tagData = idx[tagId];
                    if(tagData) {
                        acc.push(tagData);
                        delete idx[tagId];
                    }
                    return acc;
                },[]);
                // any leftovers in idx are appended
                var leftovers = _.values(idx);
                if(leftovers.length > 0) {
                    console.warn("Bunch of tags are without an order!!", leftovers);
                    return newOrder.concat(leftovers);
                } else {
                    return newOrder;
                }
            }

            return dirDefn;
        }]);
