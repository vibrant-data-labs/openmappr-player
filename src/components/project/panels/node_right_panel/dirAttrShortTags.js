/*globals d3,$  */
angular.module('common')
    .directive('dirAttrShortTags', ['hoverService', 'selectService',
        function (hoverService, selectService) {
            'use strict';

            /*************************************
            ******** Directive description *******
            **************************************/
            var dirDefn = {
                restrict: 'AE',
                templateUrl: '#{player_prefix_index}/components/project/panels/node_right_panel/shortTags.html',
                scope: {
                  section: '='
                },
                link: postLinkFn
            };

            /*************************************
            ************ Local Data **************
            **************************************/
            
            var dirPrefix = '[dirAttrShortTags] ';
            var LIMIT_NODES_COUNT = 5;

            function postLinkFn(scope) {
              scope.limitNodes = LIMIT_NODES_COUNT;
              scope.isShow = false;

              scope.onTagLoad = function(section, $event) {
                var elem = $event.target[0];
                if (!section.popupText && $(elem).find('.cat-text')[0].scrollWidth > elem.clientWidth) {
                    section.popupText = section.value;
                }
              }

              scope.onSectionHover = function(sections, tag, $event) {
                hoverService.hoverNodes({ attr: sections.id, value: tag});
              }
              
              scope.onSectionLeave = function() {
                hoverService.unhover();
              }

              scope.onSectionSelect = function(sections, tag) {
                selectService.selectNodes({ attr: sections.id, value: tag});
              }

              scope.setLimit = function(isCollapsed) {
                return isCollapsed ? LIMIT_NODES_COUNT : null; 
              }

              scope.showMore = function() {
                scope.isShow = !scope.isShow;
              }
            }
          return dirDefn;
}]);
