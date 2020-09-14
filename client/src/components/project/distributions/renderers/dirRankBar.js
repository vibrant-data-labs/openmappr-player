angular.module('common')
.directive('dirRankBar', ['$timeout', '$q', 'FilterPanelService', 'dataGraph', 'AttrInfoService', 'BROADCAST_MESSAGES',
function($timeout, $q, FilterPanelService, dataGraph, AttrInfoService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var dirPrefix = '[dirRankBar] ';
    var tooltipObj = {
        tooltipText:''
    };



    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element, attrs, renderCtrl) {
        var bar = null;
        // Fix width via margins / padding.
        try {
            bar = renderDistr(scope, element, attrs, renderCtrl);
            updateHighlights(bar, scope, renderCtrl);
        } catch(e) {
            console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
        }

        scope.$on(BROADCAST_MESSAGES.fp.initialSelection.changed, function() {
            try {
                bar = bar || renderDistr(scope, element, attrs, renderCtrl);
                updateHighlights(bar, scope, renderCtrl);
            } catch(e) {
                console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
            }
        });

        scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function() {
            try {
                updateHighlights(bar, scope, renderCtrl);
            } catch(e) {
                console.error(dirPrefix + "draw() throws error for attrId:" + scope.attrToRender.id + ',', e.stack,e);
            }
        });

        scope.overDistr = function(event) {
            var off = $(event.currentTarget).offset();
            scope.tooltipText = tooltipObj.tooltipText;
            element.find('.tooltip-positioner').css({
                top : event.pageY - off.top - 40,
                right : event.pageX - off.left - 15
            });
            if(!scope.openTooltip) {
                $timeout(function() {
                    scope.openTooltip = true;
                }, 100);
            }
        };

        scope.outDistr = function() {
            $timeout(function() {
                scope.openTooltip = false;
                bar && bar.hideTooltip();
            }, 100);
        };
    }



    /*************************************
    ************ Local Functions *********
    **************************************/

    function renderDistr (scope, element, attrs, renderCtrl) {
        var distrOpts = angular.copy(window.mappr.stats.distr.defaults);
        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(scope.attrToRender.id);

        distrOpts.distrHt = distrOpts.multiDistrHt;
        console.assert(!attrInfo.isNumeric && !attrInfo.isTag, 'attribute type should be valid for dirRankBar');
        var distrSvg = element.find("svg");
        // var tooltip = element.find(".d3-tip");
        distrSvg.empty(); // clean the SVG!
        distrSvg.width(element.parent().width());
        var bar = new window.mappr.stats.distr.NonNumericRankBar(distrSvg, scope.attrToRender, attrInfo, distrOpts);
        bar.setupTooltips(tooltipObj, renderCtrl);
        return bar;
    }

    function updateHighlights (bar, scope, renderCtrl) {
        var cs = FilterPanelService.getCurrentSelection();
        var attrId = renderCtrl.getAttrId();
        var principalNode = null;
        if(FilterPanelService.getInitialSelection().length === 1) {
            principalNode = cs[0];
            cs = FilterPanelService.getNodesForSNCluster();
        }
        //render highlights only if the curSel contains values for this attr
        var hasValues = _.any(cs, function(node) {return node.attr[attrId] != null; });
        bar.renderCurrentSel(FilterPanelService.getColorString(), hasValues ? cs : [], principalNode);
    }


    return dirDefn;
}]);
