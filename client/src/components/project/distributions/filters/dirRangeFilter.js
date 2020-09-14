angular.module('common')
    .directive('dirRangeFilter', ['FilterPanelService','AttrInfoService', 'SelectorService', 'BROADCAST_MESSAGES', 'hoverService', 'selectService',
        function(FilterPanelService, AttrInfoService, SelectorService, BROADCAST_MESSAGES, hoverService, selectService) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                require: '?^dirAttrRenderer',
                templateUrl: '#{server_prefix}#{view_path}/components/project/distributions/filters/rangeFilter.html',
                scope: {
                    attr: '=',
                },
                link: postLinkFn
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var logPrefix = '[dirRangeFilter: ] ';


            /*************************************
    ******** Controller Function *********
    **************************************/


            /*************************************
    ******** Post Link Function *********
    **************************************/
            function postLinkFn(scope, element, attrs, renderCtrl) {
                var
                    attrId       = renderCtrl.getAttrId(),
                    filterConfig = selectService.getFilterForId(attrId),
                    attrInfo     = scope.attr,
                    binCount     = renderCtrl.getBinCount();

                console.assert(attrInfo.isNumeric || attrInfo.isYear, logPrefix + 'attribute should be isNumeric/isYear');

                setRange();

                var formatValue = function (val) {
                    var attrType = attrInfo.attrType;
                    if (attrType == 'timestamp') { return window.moment.unix(val).format(format); }
                    else if (attrType == 'year') { return Number(val).toFixed(0); }
                    else {
                        if ((val % 1 !== 0)) {
                            return d3.format(",.2f")(val);
                        }
                        else {
                            return d3.format("s")(val);
                        }
                    }
                }

                scope.startValue = function() {
                    var val = getValueRangeFilterRange(scope.filterRange[0], scope.filterRange[1]).min;
                    return formatValue(val);
                };

                scope.endValue = function() {
                    var val = getValueRangeFilterRange(scope.filterRange[0], scope.filterRange[1]).max;
                    return formatValue(val);
                };

                scope.bounds = {
                    min : 0,
                    max : binCount,
                    step: 1
                };
                scope.sliderObj ={
                    range: true,
                    start: function(ev, ui) {
                        console.log(logPrefix + 'Slider start - event & ui ', ev, ui);
                        scope.isHovered = true;
                    },
                    stop: function(ev, ui) {
                        console.log(logPrefix + 'Slider stop - event & ui ', ev, ui);
                        scope.isHovered = false;
                        var valueRange = getValueRangeFilterRange(scope.filterRange[0], scope.filterRange[1]);
                        if (valueRange.min == attrInfo.stats.min && valueRange.max == attrInfo.stats.max) {
                            selectService.selectNodes({ attr: attrInfo.attr.id, forceDisable: true });
                        } else if (attrInfo.isLogScale) {
                            selectService.selectNodes({ attr: attrInfo.attr.id, min: Math.pow(10, valueRange.min), max: Math.pow(10, valueRange.max), force: true});
                        } else {
                            selectService.selectNodes({ attr: attrInfo.attr.id, min: valueRange.min, max: valueRange.max, force: true});
                        }
                    }
                };

                scope.$on(BROADCAST_MESSAGES.hss.select, function(ev, data) {
                    if (!data.filtersCount) {
                        // Reset filter values on reset
                        filterConfig = selectService.getFilterForId(attrId)
                        setRange();
                    }
                });

                scope.$watch('attr', function(){
                    attrInfo = scope.attr;
                });

                // scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function() {
                //     // Reset filter values range on subset
                //     filterConfig = selectService.getFilterForId(attrId);
                //     console.log("FILTERCONFIG", attrInfo);
                //     setRange();
                // });

                // scope.$on(BROADCAST_MESSAGES.fp.filter.reset, function() {
                //     scope.filterRange = [0, binCount];
                // });

                function init () {
                    binCount = renderCtrl.getBinCount();
                    scope.filterRange = [0, binCount];
                    scope.bounds.max = binCount;
                }

                function setRange() {
                    scope.filterRange = filterConfig.state.filterRange
                        ? _.clone(filterConfig.state.filterRange)
                        :  [0, binCount];
                }

                function getValueRangeFilterRange(min, max) {
                    var attrMax = attrInfo.stats.max, attrMin = attrInfo.stats.min;
                    var step = (attrMax - attrMin) / binCount;

                    var
                        valMin = attrMin + (min === 0 ? 0 : min * step),
                        valMax = max === binCount ? attrMax : attrMin + max * step;

                    return {
                        min: attrInfo.isInteger ? Math.ceil(valMin) : valMin,
                        max: attrInfo.isInteger ? Math.floor(valMax) : valMax
                    };
                }
            }



            /*************************************
    ************ Local Functions *********
    **************************************/



            return dirDefn;
        }]);