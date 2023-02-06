angular.module('common')
.directive('dirGridCard', ['$rootScope', '$timeout', 'AttrInfoService', 'BROADCAST_MESSAGES',
function($rootScope, $timeout, AttrInfoService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var infoObj = AttrInfoService.getNodeAttrInfoForRG();


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        scope.openMediaModal = function(node) {
            scope.$broadcast(BROADCAST_MESSAGES.openMediaModal, {node: node});
        };

		scope.openRightPanel = function(node, $event) {
            var attr = node.selectedAttr;
			//if no attribute defined yet, don't do anything
			if(!attr.attrType) {
				return;
			}
			// console.log('click cell w attr: ', attr);
			if(AttrInfoService.isDistrAttr(attr, infoObj.getForId(attr.id))) {
				scope.panelUI.openPanel('filter');
			} else {
				scope.panelUI.openPanel('info');
			}
      scope.handleNodeClick(node, $event);
			$timeout(function() {
				$rootScope.$broadcast(BROADCAST_MESSAGES.layout.attrClicked, {
					attr: attr
				});
			}, 2000);
		};
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
