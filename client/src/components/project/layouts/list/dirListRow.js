(function() {
'use strict';

angular.module('common')
.directive('dirListRow', ['$rootScope', '$timeout', 'BROADCAST_MESSAGES', 'AttrInfoService',
function($rootScope, $timeout, BROADCAST_MESSAGES, AttrInfoService) {

	return {
		restrict: 'A',
		link: function(scope, element) {
			//for getting which panel attr is in
			var infoObj = AttrInfoService.getNodeAttrInfoForRG();
			//for attr renderer
			scope.chosenNodes = [scope.node];


			// console.log("list attrs: ",scope.listAttrs, scope.node);
			scope.$watch('listAttrs', function() {
				scope.rowAttrs = [];
				_.each(scope.listAttrs, function(attr) {
					var obj = _.cloneDeep(attr);
					obj.value = scope.node.attr[attr.id];
					//set render type to tag cloud if attrType is liststring because
					//no other liststring rendertype will fit in a cell
					if(obj.attrType === 'liststring') {
						obj.renderType = 'row-tag-cloud';
					}
					scope.rowAttrs.push(obj);
				});
			}, true);

			scope.openRightPanel = function(attr) {
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
				$timeout(function() {
					$rootScope.$broadcast(BROADCAST_MESSAGES.layout.attrClicked, {
						attr: attr
					});
				}, 2000);
			};

			//delay rendering of attribute to optimize scrolling
			$timeout(function() {
				scope.renderAttrs = true;
			}, 3000);

		}
	};

}
]);
}());
