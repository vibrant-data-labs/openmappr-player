(function() {
'use strict';

angular.module('common')
.directive('dirColResizer', ['$timeout', '$rootScope', 'BROADCAST_MESSAGES',
function($timeout, $rootScope, BROADCAST_MESSAGES) {

	return {
		restrict: 'E',
        scope: {
            colIndex:'@',
            colSizes:'='
        },
		link: function(scope, element) {
            console.log('resize directive initialized');
            element.draggable({
                axis:'x',
                drag: function(event, ui) {
                    scope.$apply(function() {
                        scope.colSizes[scope.colIndex] = ui.position.left;
                        console.log('resizing: ', scope.colSizes);
                    });
                },
                stop: function() {

                    $rootScope.$broadcast(BROADCAST_MESSAGES.layout.listColSizesUpdated, {
                        colSizes: scope.colSizes
                    });
                }
            });

		}
	};

}
]);
}());
