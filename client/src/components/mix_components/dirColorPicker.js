angular.module('mappr')
.directive('colorPicker', ['$timeout',
function($timeout) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'E',
        scope: {
            colors: '='
        },
        //TODO: this is just using the current two objects, but need to consolidate into one object
        //that has a set structure
        template: "<div class='color-picker'>"+
        // "<div ng-if='tempColors.length < 3' ng-style='getGradientStyle()' class='color-gradient'></div>"+
            "<div ng-if='tempColors.length < 3' class='color-arrow'></div>"+
            "<ul class='stops tall' ng-if='editable'>"+
                "<li class='stop' ng-repeat='colObj in tempColors track by $index' ng-class='{"+'"pull-right"'+":($index == 1 && tempColors.length == 2) }' ng-style='getStopStyle($index)'>"+
                    "<input type='color' ng-model='colObj.col'/>"+
                "</li>"+
            "</ul>"+
            "<ul class='stops' ng-if='!editable'>"+
                "<li class='stop' ng-repeat='colObj in colorsSorted track by $index' ng-style='getStopStyle(colObj.value)'>"+
                    "<input type='color' ng-model='colObj.col'/>"+
                    "<label>{{colObj.name}}</label>"+
                "</li>"+
            "</ul>"+
        "</div>",
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element, attrs) {
        scope.editable = attrs.editable == 'true';
        console.debug('colors: ', scope.colors);

        scope.tempColors = _.cloneDeep(scope.colors);

        var setVal;

        scope.$watch('tempColors', function() {
            console.debug("temp colors changing");
            if(setVal) {
                $timeout.cancel(setVal);
            }
            setVal = $timeout(function() {
                scope.colors = _.cloneDeep(scope.tempColors);

                scope.min = _.min(scope.colors, function(c) {
                    return c.value;
                }).value;

                scope.max = _.max(scope.colors, function(c) {
                    return c.value;
                }).value;

                scope.colorsSorted = _.sortBy(scope.colors, function(c) {
                    return c.value;
                });
            }, 100);
        }, true);

        scope.getGradientStyle = function() {
            var gradCss = '',
                ind;
            if(scope.editable) {
                var perStop = 100/(scope.colors.length - 1);
                ind = 0;
                _.each(scope.colors, function(c) {
                    gradCss += c.col+" "+perStop*ind+"%";
                    ind++;
                    if(ind != scope.colors.length) {
                        gradCss+=',';
                    }
                });
            }
            else {
                //get min and max values
                ind = 0;
                _.each(scope.colorsSorted, function(c) {
                    var per = (c.value - scope.min)/(scope.max - scope.min)*100;
                    gradCss += c.col+" "+per+"%";
                    ind++;
                    if(ind != scope.colors.length) {
                        gradCss+=',';
                    }

                });
            }
            return {
                background:'linear-gradient(to right, '+gradCss+')'
            };

        };

        scope.getStopStyle = function(val) {
            if(scope.editable) {
                return {
                    left:100/(scope.colors.length - 1)*val+"%"
                };
            } else {
                return {
                    left:Number((val - scope.min)/(scope.max - scope.min)*100)+'%'
                };
            }
        };
    }

    return dirDefn;
}
]);