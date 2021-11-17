/*globals d3,$  */
angular.module('common')
    .directive('dirTagListRightPanel', ['$timeout', '$q', '$filter', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES', 'hoverService', 'selectService', 'subsetService',
        function ($timeout, $q, $filter, FilterPanelService, dataGraph, AttrInfoService, SelectorService, BROADCAST_MESSAGES, hoverService, selectService, subsetService) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                templateUrl: '#{player_prefix_index}/components/project/panels/node_right_panel/tagListRightPanel.html',
                scope: {
                  section: '='
                },
                link: postLinkFn
            };

            /*************************************
            ************ Local Data **************
            **************************************/
            
            var dirPrefix = '[dirTagListRightPanel] ';
            var ITEMS_TO_SHOW = 20;

            function postLinkFn(scope) {
                scope.initialItems = []
                
                for(let i = 0; i <= scope.section.value.length / ITEMS_TO_SHOW; i++) {
                  scope.initialItems.push(scope.section.value.slice(i * ITEMS_TO_SHOW, ITEMS_TO_SHOW * (i + 1)))
                }

                scope.items = scope.initialItems[0];

                scope.maxItemsToShow = ITEMS_TO_SHOW;
                scope.numShowGroups = 0;
                scope.numShownCats = ITEMS_TO_SHOW;
                scope.step = ITEMS_TO_SHOW;
                scope.tagsLength = scope.section.value.length;
                scope.initVisItemCount = ITEMS_TO_SHOW;

                scope.startItem = function() {
                  if (scope.numShownCats == scope.tagsLength) {
                      return scope.numShowGroups * scope.step + 1;
                  }

                  return scope.numShownCats - scope.step + 1;
                }

                scope.showMore = function () {
                  scope.numShowGroups++;
                  scope.numShownCats = Math.min(scope.numShowGroups * ITEMS_TO_SHOW + scope.initVisItemCount, scope.tagsLength);
                  scope.items = scope.initialItems[scope.numShowGroups];
                };

                scope.showLess = function () {
                  scope.numShowGroups--;
                  scope.numShowGroups = scope.numShowGroups < 0 ? 0 : scope.numShowGroups;
                  scope.numShownCats = Math.min(scope.numShowGroups * ITEMS_TO_SHOW + scope.initVisItemCount, scope.tagsLength);
                  scope.items = scope.initialItems[scope.numShowGroups];
                };

                scope.onSectionHover = function (sections, tag, $event) {
                  hoverService.hoverNodes({ attr: sections.id, value: tag});
                }
  
                scope.onSectionSelect = function (sections, tag) {
                  selectService.selectNodes({ attr: sections.id, value: tag});
                }
    
                scope.onSectionLeave = function() {
                  hoverService.unhover();
                }
                
            }



            

            

            

            

            

            

            return dirDefn;
        }]);
