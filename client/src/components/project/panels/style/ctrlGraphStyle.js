angular.module('mappr')
.controller('GraphStyleCtrl',['$scope', '$rootScope', '$timeout', 'dataGraph', 'dataService', 'layoutService', 'orgFactory', 'projFactory', 'BROADCAST_MESSAGES', 'graphStyleService', 'AttrInfoService',
function ($scope, $rootScope, $timeout, dataGraph, dataService, layoutService, orgFactory, projFactory, BROADCAST_MESSAGES, graphStyleService, AttrInfoService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    // $scope.layoutUI object at end of file
    $scope.mapprSettingsHelper = _.clone($scope.mapprSettings); //hack to avoid graph update instantly

    $scope.spAccordionStatus = {
        misc: {
            closeOthers: true,
            aggregations: true,
            stage: false,
            legend: false,
            linkMapping: false
        }
    };

    /**
    * Scope methods
    */
    $scope.updateColors = updateColors;
    // $scope.getNodeAttrs = getNodeAttrs;
    // $scope.getEdgeAttrs = getEdgeAttrs;
    $scope.filterNodeAttrs = filterNodeAttrs;
    $scope.filterEdgeAttrs = filterEdgeAttrs;
    $scope.getNodeAttrTitles = getNodeAttrTitles;
    $scope.getEdgeAttrTitles = getEdgeAttrTitles;

    $scope.updateSettings= function(){
        //console.log($scope.mapprSettingsHelper);
        _.assign($scope.mapprSettings, $scope.mapprSettingsHelper);
        // console.log($scope.mapprSettings);
    };




    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.dataGraph.loaded, function dataLoad_attrs(event, data) {
        if(!data) {
            return;
        }
        var removeSigmaRenderListener = $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
            setupCtrl();
            removeSigmaRenderListener();
        });
    });

    $scope.$watch('mapprSettings.nodeColorAttr', function(nodeColorAttr) {
        if(!nodeColorAttr) { return; }
        // Customise layout UI
        var nodeColorSettings = graphStyleService.getStyleSettingsAtPath('nodeTab.renderSettings.color');
        var ordinalColorPaletteUI = _.find(nodeColorSettings, 'key', 'nodeColorPaletteOrdinal');
        var numericColorPaletteUI = _.find(nodeColorSettings, 'key', 'nodeColorPaletteNumeric');
        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(nodeColorAttr);
        if(attrInfo.isNumeric) {
            if(ordinalColorPaletteUI) { ordinalColorPaletteUI.enabled = false; }
            numericColorPaletteUI.enabled = true;
        }
        else {
            if(numericColorPaletteUI) { numericColorPaletteUI.enabled = false; }
            ordinalColorPaletteUI.enabled = true;
        }
    });




    /*************************************
    ********* Initialise *****************
    **************************************/
    $scope.layoutUI = graphStyleService.getStyleSettings();

    _.assign($scope.layoutUI, {
        disabledSettings: [],
        //currently hovered setting (if parent then will show children)
        hoveredSetting: null,
        getSettings: function() {
            return $scope.layout.settings;
        },
        //get possible values a setting can be
        getValues: function(opt) {
            var control = opt;
            return control.values;
        },
        //see if should disable any settings dependent on this one (also sets animation to false for sigma)
        setupLayoutChange: function() {
            return;

            // var val = $scope.mapprSettings[opt.key];
            // //console.log(val);
            // $scope.layout.isAnimatingLayout = false;
            // var control = opt;//_.findWhere($scope.layoutUI.controls, {key:opt.key});
            // if (control.dependents && opt.type == 'bool') {
            //     if (val == '1') {
            //         for (var i = 0; i < control.dependents.length; i++) {
            //             var key = control.dependents[i];
            //             var ind = this.disabledSettings.indexOf(key);
            //             if (ind != -1) {
            //                 this.disabledSettings.splice(ind, 1);
            //             }
            //         }
            //     } else {
            //         this.disabledSettings = this.disabledSettings.concat(control.dependents);
            //     }
            //     console.log(this.disabledSettings);
            // }
        },
        setHoverSetting: function(opt) {

            console.log({setHoverSetting: opt});
            var control = opt;// _.findWhere($scope.layoutUI.controls, {key:opt.key});
            //console.log(control);
            if(!control.parents) {
                this.hoveredSetting = opt.key;
                //console.log('this-child', this);
            } else {
                this.hoveredSetting = control.parents[0];
                //console.log('this-parent', this);
            }
        },
        unsetHoverSetting: function() {
            return;
            // //so won't fade out when using dropdown that has selectboxit plugin applied
            // var isOnDD = false;
            // if(e) {
            //     $(e.target).parents().each(function() {
            //         if($(this).hasClass('selectboxit-option') || $(this).hasClass('select-attr')) {
            //             isOnDD = true;
            //             return false;
            //         }
            //     });
            // }
            // if(!isOnDD) {
            //     this.hoveredSetting = null;
            // }
        },
        //get class for this setting and class to hide or show or disable
        getClass: function(opt) {
            var control = opt;
            var cl = control.class+' ';
            if(typeof control.parents !== 'object') return cl;

            var match = true;
            Object.keys(control.parents).forEach(function (key) {
                match = match && (control.parents[key] == $scope.mapprSettings[key]);
            });
            if(!match || !control.enabled) {
                cl += 'hidden ';
            } else {
                cl += 'visible';
            }
            return cl;
        }

        // showSetting: function(opt) {
        //  return true;
        //  var control = _.findWhere($scope.layoutUI.controls, {key:opt.key});
        //  if(!control.enabled) {
        //      return false;
        //  }
        //  switch ($scope.layout.plotType) {
        //      case 'graph':
        //          var k = opt.key;
        //          if (k == 'xAxShow' || k == 'yAxShow' || k == 'xAxTickShow' || k == 'yAxTickShow') {
        //              return false;
        //          }
        //      break;
        //      case 'scatter':
        //      break;
        //      case 'force':
        //          if (k == 'xAxShow' || k == 'yAxShow' || k == 'xAxTickShow' || k == 'yAxTickShow') {
        //              return false;
        //          }
        //      break;
        //  }
        //  return true;
        // } //end of $scope.layoutUI object
    });

    setupCtrl();

    /*************************************
    ********* Core Functions *************
    **************************************/

    function setupCtrl () {
        dataGraph.getRawData().then(function() {
            $scope.nodeAttrTypes = dataGraph.getNodeAttrTypes();
            $scope.edgeAttrTypes = dataGraph.getEdgeAttrTypes();
            $scope.hasGeoData = dataGraph.hasGeoData();
            $scope.nodeAttrs = dataGraph.getNodeAttrs();
            $scope.nodeColorAttrs = layoutService.getNodeColorAttrs();
            $scope.nodeSizeAttrs = layoutService.getNodeSizeAttrs();
            $scope.edgeAttrs = dataGraph.getEdgeAttrs();
            $scope.edgeColorAttrs = layoutService.getEdgeColorAttrs();
            $scope.edgeSizeAttrs = layoutService.getEdgeSizeAttrs();
        });
    }

    function updateColors(){
        // color updates
        var cssNodeLabel = getCSSRule('.page-stage .node-label');
        cssNodeLabel.style.color = $scope.mapprSettings.labelColor;
        cssNodeLabel.style.textShadow = $scope.mapprSettings.labelOutlineColor + " -1px -1px 0px, " + $scope.mapprSettings.labelOutlineColor + " 1px -1px 0px, " + $scope.mapprSettings.labelOutlineColor + " -1px 1px 0px, " + $scope.mapprSettings.labelOutlineColor + " 1px 1px 0px";

        var cssNodeLabelHover = getCSSRule('.page-stage .node-label-hover');
        cssNodeLabelHover.style.color = $scope.mapprSettings.labelColor;
        cssNodeLabelHover.style.textShadow = $scope.mapprSettings.labelOutlineColor + " -1px -1px 0px, " + $scope.mapprSettings.labelOutlineColor + " 1px -1px 0px, " + $scope.mapprSettings.labelOutlineColor + " -1px 1px 0px, " + $scope.mapprSettings.labelOutlineColor + " 1px 1px 0px";

        var cssNodeLabelHoverHide = getCSSRule('.page-stage .node-label-hover-hide');
        cssNodeLabelHoverHide.style.color = $scope.mapprSettings.labelColor;
        cssNodeLabelHoverHide.style.textShadow = $scope.mapprSettings.labelOutlineColor + " -1px -1px 0px, " + $scope.mapprSettings.labelOutlineColor + " 1px -1px 0px, " + $scope.mapprSettings.labelOutlineColor + " -1px 1px 0px, " + $scope.mapprSettings.labelOutlineColor + " 1px 1px 0px";

        var cssGraphContainer = getCSSRule('#content');
        cssGraphContainer.style.backgroundColor = $scope.projSettings.backgroundColor;
    }

    function filterNodeAttrs(opt) {
        if(opt.type === "attr-select") {
            switch(opt.key) {
            case "nodeSizeAttr":
                return filterNodeSizeAttrs;
            case "nodeColorAttr":
                return filterNodeColorAttrs;
            }
        }
        return filterByPass;
    }


    function filterEdgeAttrs(opt) {
        if(opt.type === "attr-select") {
            switch(opt.key) {
            case "edgeSizeAttr":
                return filterEdgeSizeAttrs;
            case "edgeColorAttr":
                return filterEdgeColorAttrs;
            }
        }
        return filterByPass;
    }

    function filterNodeSizeAttrs(attr) {
        return _.map($scope.nodeSizeAttrs, 'id').indexOf(attr.id) !== -1;
    }

    function filterNodeColorAttrs(attr) {
        return _.map($scope.nodeColorAttrs, 'id').indexOf(attr.id) !== -1;
    }

    function filterEdgeSizeAttrs(attr) {
        return _.map($scope.edgeSizeAttrs, 'id').indexOf(attr.id) !== -1;
    }

    function filterEdgeColorAttrs(attr) {
        return _.map($scope.edgeColorAttrs, 'id').indexOf(attr.id) !== -1;
    }

    function filterByPass() { return true; }

    function getNodeAttrTitles() {
        throw new Error("Stupid function. Do Not use");
        // if(opt.type === "attr-select") {
        //     switch(opt.key) {
        //     case "nodeSizeAttr":
        //         return $scope.nodeSizeAttrTitles;
        //     case "nodeColorAttr":
        //         return $scope.nodeColorAttrTitles;
        //     }
        // }
        // return $scope.nodeAttrTitles;
    }

    function getEdgeAttrTitles() {
        throw new Error("Stupid function. Do Not use");
        // if(opt.type === "attr-select") {
        //     switch(opt.key) {
        //     case "edgeSizeAttr":
        //         return $scope.edgeSizeAttrTitles;
        //     case "edgeColorAttr":
        //         return $scope.edgeColorAttrTitles;
        //     }
        // }
        // return $scope.edgeAttrTitles;
    }

    function getCSSRule(rulename){
        var ruleSelected = null;

        if (document.styleSheets) {
            _.each(document.styleSheets, function(stylesheet) {
                if(stylesheet && stylesheet!== null){
                    //console.log('stylesheet',stylesheet);
                    if (stylesheet.cssRules) {
                        _.each(stylesheet.cssRules, function(rule) {
                            if (rule && rule.selectorText && rule.selectorText == rulename) {
                                console.log('[ctrlLayout] selecting css rule : ' + rule.selectorText);
                                console.log(rule);
                                ruleSelected = rule;
                            }
                        });
                    } else {
                        _.each(stylesheet.rules, function(rule) {
                            if (rule && rule.selectorText && rule.selectorText == rulename) {
                                console.log('[ctrLayout] selecting css rule : ' + rule.selectorText);
                                //console.log(rule);
                                ruleSelected = rule;
                            }
                        });
                    }
                }
            });
        }

        return ruleSelected;
    }


}]);
