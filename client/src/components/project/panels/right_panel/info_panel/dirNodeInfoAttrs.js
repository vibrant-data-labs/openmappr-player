angular.module('common')
    .directive('dirNodeInfoAttrs', ['$timeout', '$rootScope', 'AttrInfoService', 'dataGraph', 'BROADCAST_MESSAGES',
        function($timeout, $rootScope, AttrInfoService, dataGraph, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                scope: {
                    selNode: '=',
                    pinnedMedia: '='
                },
                templateUrl: '#{player_prefix_index}/components/project/panels/right_panel/info_panel/nodeInfoAttrs.html',
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            // var logPrefix = 'dirNodeInfoAttrs: ';


            /*************************************
    ******** Controller Function *********
    **************************************/


            /*************************************
    ******** Post Link Function *********
    **************************************/
            function postLinkFn(scope) {
                scope.nodeInfoAttrs = getNodeInfoAttrs();
                scope.MAPP_EDITOR_OPEN = $rootScope.MAPP_EDITOR_OPEN;

                scope.ui = {
                    loadInfoAttrs: false,
                    activeAttrIdx: -1
                };

                scope.$watch('selNode', function() {
                    _.each(scope.nodeInfoAttrs, function(attr) {
                        attr.principalVal = scope.selNode.attr[attr.id];
                        attr.showRenderer = AttrInfoService.shouldRendererShowforSN(attr.attrType, attr.renderType);
                    });
                });

                $timeout(function() {
                    scope.ui.loadInfoAttrs = true;
                });


                function getNodeInfoAttrs() {
                    var infoObj = AttrInfoService.getNodeAttrInfoForRG();
                    var nodeInfoAttrs = [];

                    _.each(dataGraph.getNodeAttrs(), function(attr) {
                        if(!AttrInfoService.isDistrAttr(attr, infoObj.getForId(attr.id))) {
                            var attrClone = _.clone(attr);
                            attrClone.showRenderer = AttrInfoService.shouldRendererShowforSN(attr.attrType, attr.renderType);
                            attrClone.principalVal = null;
                            nodeInfoAttrs.push(attrClone);
                        }
                    });

                    return nodeInfoAttrs;
                }

            }



            /*************************************
    ************ Local Functions *********
    **************************************/



            return dirDefn;
        }
    ]);
