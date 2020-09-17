angular.module('mappr')
.directive('settingsInput', ['$timeout',
function($timeout) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'E',
        scope: {
            opt: '=',
            attrs: '=',
            attrFilter: '=?',
            ngModel: '=',
            colorChange: '&',
            updateProjectSetting: '&'
        },
        require:'ngModel',
        templateUrl: '#{server_prefix}#{view_path}/components/mix_components/input-settings.html',
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope) {
        //for number pattern validation
        scope.number = /^(?:\d*\.\d{1,2}|\d+)$/;
        scope.attrFilter = scope.attrFilter || _.constant(true);
        scope.attrsSelect = _.filter(scope.attrs, scope.attrFilter);

        //in case render type or other filter property changes
        if(scope.opt.type == 'attr-select') {
            scope.$watch('attrs', function() {
                scope.attrsSelect = _.filter(scope.attrs, scope.attrFilter);
            }, true);
        }

        scope.valModel = scope.ngModel;

        var setVal;

        scope.$watch('valModel', function() {
            if(setVal) {
                $timeout.cancel(setVal);
            }
            setVal = $timeout(function() {
                scope.ngModel = scope.valModel;
            }, 200);
        });

        scope.$watch('ngModel', function(newValue, oldValue) {
            // console.log('ngModel new value: ', newValue);
            if(newValue != oldValue && scope.ngModel != scope.valModel) {
                scope.valModel = scope.ngModel;
            }
        });

        scope.setAttr = function(val) {
            scope.valModel = val.id;
        };
    }

    return dirDefn;
}
]);
