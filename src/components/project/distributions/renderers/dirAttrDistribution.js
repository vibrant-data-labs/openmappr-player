// /*
// * Attribute distribution
// */
// angular.module('common')
// .directive('dirAttrDistribution', ['$timeout', '$q', 'FilterPanelService', 'renderGraphfactory', 'dataGraph', 'AttrInfoService', 'zoomService', 'graphSelectionService', 'layoutService',
// function($timeout, $q, FilterPanelService, renderGraphfactory, dataGraph, AttrInfoService, zoomService, graphSelectionService, layoutService) {
//     'use strict';

//     /*************************************
//     ******** Directive description *******
//     **************************************/
//     var dirDefn = {
//         restrict: 'EA',
//         require: '?^dirAttrRenderer',
//         template:'<div>' +
//                     '<div ng-class="{sizeDistrCover1: isSized}">' +
//                     '<div ng-class="{sizeDistrCover2: isSized}">' +
//                     '<div ng-class="{sizeDistr: isSized}" class="attrDistribution">' +
//                         '<div class="scrollerFadeTop" style="display:none;"></div>' +
//                         '<div class="scrollerFadeBottom" style="display:none;"></div>' +
//                     '</div>' +
//                     '</div>' +
//                     '</div>' +
//                     '<div class="moreBtn" style="display:none;">'+
//                     '<span class="text"></span>'+
//                     '</div>' +
//                     '<div class="d3-tip n" style="display:none;"><strong></strong></div>' +
//                 '</div>',
//         link: postLinkFn
//     };

//     /*************************************
//     ************ Local Data **************
//     **************************************/
//     var dirPrefix = '[dirAttrDistribution: ]';


//     /*************************************
//     ******** Controller Function *********
//     **************************************/



//     /*************************************
//     ******** Post Link Function *********
//     **************************************/
//     function postLinkFn(scope, element, attrs, renderCtrl) {
//         var distOpts, callbacks;
//         // if(scope.isGlobal === true) {
//         //     scope.$watch('attrToRender', function(newVal, oldVal) {
//         //         if(newVal && newVal !== oldVal) {
//         //             setupAndDraw();
//         //         }
//         //     });
//         // }

//         // if(renderCtrl.isLazy === 'true') {
//         //     // Needs something from DOM which isn't ready yet
//         //     $timeout(setupAndDraw);
//         // }
//         // else {
//         //     setupAndDraw();
//         // }

//         // scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function(e) {
//         //     setupAndDraw();
//         // });
//         // scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function(e) {
//         //     setupAndDraw();
//         // });

//         function setupAndDraw () {
//             distOpts = angular.copy(window.mappr.stats.distr.defaults);
//             _.assign(distOpts, {
//                 nodeColorStr: scope.nodeColorStr,
//                 raiseEvents: scope.isGlobal
//             });
//             callbacks = {
//                 hover: renderCtrl.hoverNodesByAttrib,
//                 hoverList: renderCtrl.hoverNodeIdList,
//                 hoverRange: renderCtrl.hoverNodesByAttribRange,
//                 unhover: renderCtrl.unHoverNodes,
//                 select: renderCtrl.selectNodesByAttrib,
//                 selectList: renderCtrl.selectNodeIdList,
//                 selectRange: renderCtrl.selectNodesByAttribRange
//             };

//             try {
//                 draw();
//             } catch (e) {
//                 console.error(dirPrefix + "draw() throws error", e.stack,e);
//             }
//         }

//         function draw() {
//             function getNodeGroupTagInfo(tagAttr, groupAttrName, groupAttrVal) {
//                 var groupNodes = _.filter(dataGraph.getAllNodes(), function(n) {
//                     return n.attr[groupAttrName] == groupAttrVal;
//                 });
//                 return AttrInfoService.buildAttrInfoMap(tagAttr, groupNodes);
//             }

//             var elem = element[0].childNodes[0];
//             var attrInfo;
//             var distr = $(elem).find(".attrDistribution")[0];
//             var tooltip = $(elem).find(".d3-tip");
//             var elemAttr = _.clone(scope.attrToRender);
//             var excludeSample = true;               // exclude sample from full population in value distribution
//             if( scope.isGlobal == true ) {
//                 elemAttr = _.clone({
//                     name : elemAttr,
//                     title: elemAttr,
//                     id : elemAttr
//                 });
//             }
//             attrInfo = (scope.isNode == 'true') ? AttrInfoService.getNodeAttrInfoForRG().getForId(elemAttr.id) : AttrInfoService.getLinkAttrInfoForRG().getForId(elemAttr.id);

//             // set height of distribution element
//             if( !attrInfo.isTag ) {
//                 $(elem).css({'max-height': distOpts.distrHt});
//             }
//             // draw the bar
//             var showValueDistr = true;      // set true to draw value distributions instead of rank distributions
//             if(elemAttr.value === null && scope.attrName === undefined) {
//                 console.warn("[dirAttrDistribution.draw] Called for a null value", elemAttr);
//                 return;
//             }
//             if( FilterPanelService.getCurrentSelection().length != 1) {     // group of nodes selected
//                 if( attrInfo.isNumeric && showValueDistr ) {    // value distr
//                     window.mappr.stats.distr.buildMultiValueBar(distr, tooltip, elemAttr, attrInfo, distOpts, excludeSample, callbacks);
//                 } else if (!attrInfo.isTag ) {          // rank (percentile) distr
//                     window.mappr.stats.distr.buildMultiRankBar(distr, tooltip, elemAttr, attrInfo, distOpts, callbacks);
//                 } else {
//                     window.mappr.stats.distr.buildTagDistr(distr, tooltip, elemAttr, attrInfo, undefined, true, distOpts, callbacks);

//                         // crude hack to remove the list element if it is empty
//                         //$(elem.parentNode.parentNode.parentNode).hide();
//                 }
//             } else {    // single node selected
//                 if( attrInfo.isNumeric && showValueDistr ) {    // value distr
//                     window.mappr.stats.distr.buildValueBar(distr, tooltip, elemAttr, attrInfo, distOpts, callbacks);
//                 } else if (!attrInfo.isTag ) {          // rank (percentile) distr
//                     window.mappr.stats.distr.buildRankBar(distr, tooltip, elemAttr, attrInfo, distOpts, callbacks);
//                 } else {                                // tag distr
//                     // for tag attribute, get current grouping attribute, if any (the coloring attribute if it is categorical)
//                     var groupAttrInfo;
//                     var info = layoutService.getGroupAttr();
//                     if(info !== undefined ) {
//                         var groupAttr = info.id;
//                         var nodeId = scope.$parent.$parent.nodeId;
//                         if( nodeId !== undefined ) {
//                             var node = dataGraph.getNodeById(nodeId);
//                             groupAttrInfo = getNodeGroupTagInfo(elemAttr, groupAttr, node.attr[groupAttr]);
//                         }
//                     }

//                     window.mappr.stats.distr.buildTagDistr(distr, tooltip, elemAttr, attrInfo, groupAttrInfo, false, distOpts, callbacks);

//                 }
//             }
//         }
//     }



//     /*************************************
//     ************ Local Functions *********
//     **************************************/



//     return dirDefn;
// }
// ]);