(function() {
	'use strict';

	angular.module('mappr')
	.controller('renderSurveyModalCtrl', ['$scope', '$uibModalInstance',
		function($scope, $uibModalInstance) {

			$scope.renderParams = {
				noOfPackets: 100,
				noOfQuesPerPacket: 20,
				noOfAnsPerQuestion: 3,
				questionAttrMaps: {
					srcAttr: 'challenge',
					srcSubAttr: null,
					srcTooltipAttr: 'tooltip_description',
					trgAttr: 'challenge',
					trgTooltipAttr: 'tooltip_description',
				},
				questionTemplate: {
					prefix: '',
					condition: 'If the post secondary system improves',
					source: 'srcNode',
					sourceSub: null,
					sourceTooltip: 'tooltip',
					conjunction: 'it affects..',
					target: 'trgNode',
					targetTooltip: 'tooltip',
					effect: 'positively|negatively|no strong effect'
				},
				questionType: 'matrix_radio'
			}

			$scope.renderSurvey = function () {
				$uibModalInstance.close($scope.renderParams);
			}

			$scope.closeModal = function() {
				$uibModalInstance.dismiss('cancel');
			};

		}
	])
}());
