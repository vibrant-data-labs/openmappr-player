angular.module('mappr')
.controller('recipeSnapshotModalCtrl', ['$scope', '$uibModalInstance', 'layoutConfig', 'recipeService', 'orgFactory', 'uiService', 'athenaService', 'recipeSnapshotConfig', 'recipeVM',
function ($scope, $uibModalInstance, layoutConfig, recipeService, orgFactory, uiService, athenaService, recipeSnapshotConfig, recipeVM) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipeSnapshotModalCtrl: ] ";

    //
    // controls recipe's snapshots settings
    //
    var tempRecipe = _.cloneDeep(recipeVM.recipe);
    var defaultSnapConfig = {
        mapprSettings : {
            nodeColorAttr: 'Cluster',
            drawGroupLabels: true,
            nodeSizeAttr: 'ClusterArchetype',
            nodeSizeMultiplier: 0.4
        }
    };

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    // $scope.settingsUI object at the end of this file
    $scope.recipe = tempRecipe;
    $scope.defaultSnapConfigActive = false;
    console.log(logPrefix + 'tempRecipe: ', tempRecipe);
    $scope.nodeAttrs = _.intersection.apply(_, _.map(recipeVM.phases.data_source.uploads, 'columns'));
    //unsure about this
    $scope.edgeAttrs = _.intersection.apply(_, _.map(recipeVM.phases.data_source.uploads, function (up) {
        return up.networks[0].linkAttrDescriptors;
    }));
    $scope.currSnapInd = 0;
    $scope.settingsTab = 'nodes';

    /**
    * Scope methods
    */
    $scope.setCurrSnap = setCurrSnap;
    $scope.makeDefaultSnapCurrent = makeDefaultSnapCurrent;
    $scope.defaultSnapshotsToggled = defaultSnapshotsToggled;
    $scope.removeSnapshot = removeSnapshot;
    $scope.createSnapshot = createSnapshot;
	$scope.filterNodeAttrs = filterNodeAttrs;
	$scope.filterEdgeAttrs = filterEdgeAttrs;

    $scope.saveSettings = function saveSettings() {
        recipeVM.recipe = _.cloneDeep(tempRecipe);
        $scope.$close(recipeVM);
    };

    $scope.closeModal = function () {
        $uibModalInstance.dismiss('cancel');
    };

    $scope.setCurrLayout = function (layout) {
        console.log('layout: ', layout);
        $scope.currSnap.layout.plotType = layout.plotType;
    };

    // $scope.getNodeAttrs = function getNodeAttrs() {
    //     return $scope.nodeAttrs;
    // };
    // $scope.getEdgeAttrs = function getEdgeAttrs() {
    //     return $scope.edgeAttrs;
    // };

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    console.log('snapshots: ', tempRecipe.snapshot_gen.snapshots);
    if (tempRecipe.snapshot_gen.snapshots && tempRecipe.snapshot_gen.snapshots.length > 0) {
        $scope.currSnap = tempRecipe.snapshot_gen.snapshots[0];
    }

    //go through snaps and assign layouts and merge settings
    //TODO: this could be simpler if config json was restructured
    _.each(tempRecipe.snapshot_gen.snapshots, function (snap) {
        //add mapprSettings and layout object if none
        if (!snap.mapprSettings) {
            snap.mapprSettings = {};
        }
        if (!snap.layout) {
            snap.layout = {};
        }
        applyDefaultsToSnap(snap);
        console.log('snap after defaults assigned: ', snap);
    });

    if(_.get(tempRecipe, 'snapshot_gen.genDefaultForNetwork')) {
        if(!_.isObject(_.get(tempRecipe, 'snapshot_gen.defaultSnapConfig'))) {
            _.set(tempRecipe, 'snapshot_gen.defaultSnapConfig', {});
            _.assign(tempRecipe.snapshot_gen.defaultSnapConfig, defaultSnapConfig);
        }
        applyDefaultsToSnap(tempRecipe.snapshot_gen.defaultSnapConfig);
    }

    //LAYOUTS

    layoutConfig.getLayouts()
        .then(function (layouts) {
            $scope.layouts = layouts;
        });



    /*************************************
    ********* Core Functions *************
    **************************************/

    function setCurrSnap(ind) {
        $scope.currSnapInd = ind;
        $scope.currSnap = tempRecipe.snapshot_gen.snapshots[ind];
        $scope.defaultSnapConfigActive = false;
    }

    function makeDefaultSnapCurrent() {
        var snapshot_gen = tempRecipe.snapshot_gen;
        if(snapshot_gen.genDefaultForNetwork) {
            $scope.currSnap = snapshot_gen.defaultSnapConfig;
        }
        else {
            $scope.currSnap = null;
        }
        $scope.defaultSnapConfigActive = true;
        $scope.currSnapInd = null;
    }

    function defaultSnapshotsToggled() {
        var snapshot_gen = tempRecipe.snapshot_gen;
        if(!snapshot_gen.genDefaultForNetwork) {
            if($scope.defaultSnapConfigActive) {
                $scope.defaultSnapConfigActive = false;
                $scope.currSnap = null;
            }
            return;
        }
        if(!_.isObject(snapshot_gen.defaultSnapConfig)) {
            snapshot_gen.defaultSnapConfig = {};
        }
        _.assign(snapshot_gen.defaultSnapConfig, defaultSnapConfig);
        applyDefaultsToSnap(snapshot_gen.defaultSnapConfig);
        $scope.makeDefaultSnapCurrent();
    }

    function removeSnapshot(ind) {
        if($scope.currSnapInd == ind) {
            if(tempRecipe.snapshot_gen.snapshots.length > 0) {
                $scope.currSnap = tempRecipe.snapshot_gen.snapshots[0];
                $scope.currSnapInd = 0;
            } else {
                $scope.currSnap = null;
                $scope.currSnapInd = null;
            }
        }
        tempRecipe.snapshot_gen.snapshots.splice(ind, 1);
    }

    function createSnapshot() {
        var snap = {
            networkIdx: -1,
            mapprSettings: {},
            layout: {}
        };
        applyDefaultsToSnap(snap);
        tempRecipe.snapshot_gen.snapshots.push(snap);
        $scope.setCurrSnap(tempRecipe.snapshot_gen.snapshots.length - 1);
    }

    function applyDefaultsToSnap(snap) {
        _.defaultsDeep(snap.mapprSettings, recipeSnapshotConfig.snapshotConfig.settings);
        snap.layout = {};
        return snap;
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



    //TODO: could create a config object for this and style panel settings so not duplicated
    //this is named scope.layoutUI in the style panel, but seems like a horrible name since we're also
    //dealing with layout types in this panel
    $scope.settingsUI = {
        nodeTab: {
            header: {
                key: 'drawNodes',
                title: 'Nodes',
                type: 'bool',
                class: 'switcher',
                dependents: [
                    'nodeSizeMultiplier',
                    'nodeSelectionDegree',
                    'nodeUnselectedOpacity'
                ],
                enabled: true
            },
            attributes: {},
            renderSettings: {
                size: [{
                    key: 'nodeSizeStrat',
                    title: 'Size Strategy',
                    type: 'select',
                    values: ['attr', 'fixed'],
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'Define How the Node is Sized',
                    enabled: true
                }, {
                    key: 'nodeSizeDefaultValue',
                    title: 'Enter Size',
                    type: 'input',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'fixed'
                    },
                    tooltip: 'Define the Size of all Nodes',
                    enabled: true
                }, {
                    key: 'nodeSizeAttr',
                    title: 'Attribute',
                    type: 'attr-select',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'Size the Nodes by the Selected Attribute',
                    enabled: true
                }, {
                    key: 'nodeSizeScaleStrategy',
                    title: 'Scale Strategy',
                    type: 'select',
                    values: ['linear', 'log', 'exponential'],
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'Scaler to use for generating values',
                    enabled: true
                }, {
                    key: 'nodeSizeScaleExponent',
                    title: 'Scale exponent(power)',
                    type: 'input',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr',
                        nodeSizeScaleStrategy: 'exponential'
                    },
                    tooltip: 'Define the exponent for exponential scaling',
                    enabled: true
                }, {
                    key: 'nodeSizeScaleBase',
                    title: 'Log scale Base',
                    type: 'input',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr',
                        nodeSizeScaleStrategy: 'log'
                    },
                    tooltip: 'Define the base for log scaling',
                    enabled: true
                }, {
                    key: 'nodeSizeScaleInvert',
                    title: 'Invert Scale',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'invert the scale being used',
                    enabled: true
                }, {
                    key: 'nodeSizeNumericDomain',
                    title: 'Domain for numeric scale',
                    type: 'select',
                    values: ['from_data', 'manual'],
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'Size Scaler Domain strategy',
                    enabled: true
                }, {
                    key: 'nodeSizeNumericDomainMin',
                    title: 'Min Value',
                    type: 'input',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeNumericDomain: 'manual'
                    },
                    tooltip: 'Define the Minimum Value for Size scaler',
                    enabled: true
                }, {
                    key: 'nodeSizeNumericDomainMax',
                    title: 'Max Value',
                    type: 'input',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeNumericDomain: 'manual'
                    },
                    tooltip: 'Define the Maximum Value for Size scaler',
                    enabled: true
                }, {
                    key: 'nodeSizeMultiplier',
                    title: 'Scale',
                    type: 'scale',
                    min: 0.1,
                    max: 2.0,
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'Scale the Overall Size of the Nodes',
                    enabled: true
                }, {
                    key: 'nodeSizeMin',
                    title: 'Min Size',
                    type: 'input',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'Define the Minimum Node Size',
                    enabled: true
                }, {
                    key: 'nodeSizeMax',
                    title: 'Max Size',
                    type: 'input',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'Define the Maximum Node Size',
                    enabled: true
                }, {
                    key: 'nodeSizePartitionEnabled',
                    title: 'Partition Scaling',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'Generate scalers for individual partitions',
                    enabled: true
                }, {
                    key: 'nodeSizePartitionAttr',
                    title: 'Partition Attribute',
                    type: 'attr-select',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'The attribute to partition on',
                    enabled: true
                }, {
                    key: 'bigOnTop',
                    title: 'Draw biggest on top',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodeSizeStrat: 'attr'
                    },
                    tooltip: 'Toggle drawing biggest nodes on top or small on top of big',
                    enabled: true
                }],
                color: [{
                        key: 'nodeColorStrat',
                        title: 'Node Color',
                        type: 'select',
                        values: ['attr', 'select'],
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'Define How the Node is Colored',
                        enabled: true,
                    }, {
                        key: 'nodeColorAttr',
                        title: 'Color Attribute',
                        type: 'attr-select',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'attr'
                        },
                        tooltip: 'Color the Nodes by the Selected Attribute',
                        enabled: true
                    }, {
                        key: 'nodeColorPaletteOrdinal',
                        title: 'Ordinal Palette',
                        type: 'color-p',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'attr'
                        },
                        tooltip: 'Define Colors for Non-numeric Attribute Values',
                        enabled: true
                    }, {
                        key: 'nodeColorScaleStrategy',
                        title: 'Scale Strategy',
                        type: 'select',
                        values: ['linear', 'log', 'exponential'],
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'attr'
                        },
                        tooltip: 'Scaler to use for generating values',
                        enabled: true
                    }, {
                        key: 'nodeColorScaleExponent',
                        title: 'Scale exponent(power)',
                        type: 'input',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'attr',
                            nodeColorScaleStrategy: 'exponential'
                        },
                        tooltip: 'Define the exponent for exponential scaling',
                        enabled: true
                    }, {
                        key: 'nodeColorScaleBase',
                        title: 'Log scale Base',
                        type: 'input',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'attr',
                            nodeColorScaleStrategy: 'log'
                        },
                        tooltip: 'Define the base for log scaling',
                        enabled: true
                    }, {
                        key: 'nodeColorScaleInvert',
                        title: 'Invert Scale',
                        type: 'bool',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'attr'
                        },
                        tooltip: 'invert the scale being used',
                        enabled: true
                    }, {
                        key: 'nodeColorNumericDomain',
                        title: 'Domain for numeric scale',
                        type: 'select',
                        values: ['from_data', 'manual'],
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'Color Scaler Domain strategy',
                        enabled: true
                    }, {
                        key: 'nodeColorNumericDomainMin',
                        title: 'Min Value',
                        type: 'input',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorNumericDomain: 'manual'
                        },
                        tooltip: 'Define the Minimum Value for Color scaler',
                        enabled: true
                    }, {
                        key: 'nodeColorNumericDomainMax',
                        title: 'Max Value',
                        type: 'input',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorNumericDomain: 'manual'
                        },
                        tooltip: 'Define the Maximum Value for Color scaler',
                        enabled: true
                    }, {
                        key: 'nodeColorPaletteNumeric',
                        title: 'Numeric Palette',
                        type: 'color-p',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'attr'
                        },
                        tooltip: 'Define Colors for Numeric Attribute Values',
                        enabled: true
                    }, {
                        key: 'nodeColorDefaultValue',
                        title: 'Select Color',
                        type: 'color',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorStrat: 'select'
                        },
                        tooltip: 'Define the Color for All the Nodes',
                        enabled: true
                    },
                    // {
                    // 	key: 'nodeColorPartitionEnabled',
                    // 	title: 'Partition Scaling',
                    // 	type: 'bool',
                    // 	class: 'node-setting',
                    // 	parents: {drawNodes: true, nodeColorStrat: 'attr'},
                    // 	tooltip: 'Generate scalers for individual partitions',
                    // 	enabled: true
                    // },
                    // {
                    // 	key: 'nodeColorPartitionAttr',
                    // 	title: 'Partition Attribute',
                    // 	type: 'attr-select',
                    // 	class: 'node-setting',
                    // 	parents: {drawNodes: true, nodeColorStrat: 'attr'},
                    // 	tooltip: 'The attribute to partition on',
                    // 	enabled: true
                    // },
                    {
                        key: 'nodeColorDensityStrategy',
                        title: 'Color Density Strat',
                        type: 'select',
                        values: ['attr', 'fixed'],
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'Color Density strategy',
                        enabled: true
                    }, {
                        key: 'nodeColorDensityAttr',
                        title: 'Choose Attr',
                        type: 'attr-select',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorDensityStrategy: 'attr'
                        },
                        tooltip: 'Which attr?',
                        enabled: true
                    }, {
                        key: 'nodeColorDensity',
                        title: 'Color Density',
                        type: 'scale',
                        min: 0,
                        max: 1.0,
                        multiplier: 1,
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeColorDensityStrategy: 'fixed'
                        },
                        tooltip: 'Color Density Value',
                        enabled: true,
                    }, {
                        key: 'nodeColorDensityOrder',
                        title: 'Color Density Order',
                        type: 'bool',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'Color Density Value',
                        enabled: true,
                    }, {
                        key: 'nodeUnselectedOpacity',
                        title: 'Unselected Opacity',
                        type: 'scale',
                        min: 0,
                        max: 1.0,
                        multiplier: 1,
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'The Opacity of the Unselected Nodes',
                        enabled: true,
                    }, {
                        key: 'nodeColorDefaultValue',
                        title: 'Node Color (Default)',
                        type: 'color',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'Default color of nodes',
                        enabled: true,
                    }, {
                        key: 'nodeColorNumericScalerType',
                        title: 'Numeric Color Scaler',
                        type: 'select',
                        values: ['RGB', 'HSL', 'HSL Long', 'LAB', 'HCL', 'HCL Long', 'Cubehelix', 'Cubehelix Long'],
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'Color Scaler to use for numeric scaling',
                        enabled: true
                    }
                ],
                on_highlight: [{
                    key: 'nodeHighlightRatio',
                    title: 'Size Scale',
                    type: 'scale',
                    min: 1.0,
                    max: 5.0,
                    multiplier: 5,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'The Amount the Size of the Node Increases When Hovered',
                    enabled: true
                }, {
                    key: 'nodeHighlightBorderOffset',
                    title: 'Border Offset',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'How Far Away the Border Outline is From the Edge of the Node',
                    enabled: true
                }, {
                    key: 'nodeHighlightBorderWidth',
                    title: 'Border Width',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'The width of the Border Outline',
                    enabled: true
                }, {
                    key: 'nodeHighlightColorStrategy',
                    title: 'Color Strategy',
                    type: 'select',
                    values: ['node-color-light', 'node-color-dark', 'node-color-inverse', 'highlight-color'],
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    enabled: false
                }, {
                    key: 'nodeHighlightColor',
                    title: 'Highlight Color',
                    type: 'color',
                    parents: {
                        drawNodes: true,
                        nodeHighlightColorStrategy: 'highlight-color'
                    },
                    class: 'node-setting',
                    enabled: false
                }],
                on_select: [{
                    key: 'nodeSelectionRatio',
                    title: 'Size Scale',
                    type: 'scale',
                    min: 0.1,
                    max: 5.0,
                    multiplier: 5,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'The Amount the Size of the Node Increases When Clicked',
                    enabled: true
                }, {
                    key: 'nodeSelectionBorderOffset',
                    title: 'Border Offset',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'How Far Away the Border Outline is From the Edge of the Node',
                    enabled: true
                }, {
                    key: 'nodeSelectionBorderWidth',
                    title: 'Border Width',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'The width of the Border Outline',
                    enabled: true
                }, {
                    key: 'nodeSelectionColorStrategy',
                    title: 'Color Strategy',
                    type: 'select',
                    values: ['node-color-light', 'node-color-dark', 'node-color-inverse', 'selected-color'],
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    enabled: false
                }, {
                    key: 'nodeSelectionColor',
                    title: 'Selected Color',
                    type: 'color',
                    parents: {
                        drawNodes: true,
                        nodeSelectionColorStrategy: 'selected-color'
                    },
                    class: 'node-setting',
                    enabled: false
                }, {
                    key: 'nodeSelectionDegree',
                    title: 'Neighborhood Degree',
                    type: 'input',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'The Number of Edges Between the Selected Node and Nodes Shown',
                    class: 'node-setting',
                    enabled: true
                }, {
                    key: 'nodeImageShow',
                    title: 'Show Image?',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'Whether to show an Image for selected nodes',
                    enabled: true
                }, {
                    key: 'nodeImageAttr',
                    title: 'Image Attr',
                    type: 'attr-select',
                    parents: {
                        drawNodes: true
                    },
                    class: 'node-setting',
                    tooltip: 'The Attribute holding the Image URL',
                    enabled: true
                }],
                pop: [{
                    key: 'nodePopShow',
                    title: 'PopShow?',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'Enables the Node to Increase in Size and Show an Image',
                    enabled: true
                }, {
                    key: 'nodePopSize',
                    title: 'Pop Scale',
                    type: 'scale',
                    min: 1,
                    max: 10,
                    multiplier: 10,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    tooltip: 'Node Pop Scale',
                    enabled: true
                }, {
                    key: 'nodePopDelay',
                    title: 'Delay',
                    type: 'input',
                    multiplier: 1,
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    tooltip: 'The Delay in Milliseconds before the Pop Happens',
                    class: 'node-setting',
                    enabled: true
                }, {
                    key: 'nodePopImageShow',
                    title: 'Show Image?',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    tooltip: 'Whether to show an Image within the Node when Popped',
                    enabled: false
                }, {
                    key: 'nodePopImageAttr',
                    title: 'Image Attr',
                    type: 'attr-select',
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    class: 'node-setting',
                    tooltip: 'The Attribute holding the Image URL',
                    enabled: true
                }, {
                    key: 'nodePopMenuShow',
                    title: 'Show Menu?',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    tooltip: 'Work in Progress',
                    enabled: true
                }, {
                    key: 'nodePopMenuFuncs',
                    title: 'Menu Options',
                    type: 'select',
                    values: ['afunc', 'bfunc', 'cfunc'],
                    parents: {
                        drawNodes: true,
                        nodePopShow: true,
                        nodePopMenuShow: true
                    },
                    tooltip: 'Work in Progress',
                    class: 'node-setting',
                    enabled: true
                }, {
                    key: 'nodePopTriggerContext',
                    title: 'Trigger Context',
                    type: 'select',
                    values: ['hover', 'click'],
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    class: 'node-setting',
                    tooltip: 'How the Pop is Triggered',
                    enabled: true
                }, {
                    key: 'nodePopReleaseContext',
                    title: 'Release Context',
                    type: 'select',
                    values: ['hover-out', 'click-out'],
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    tooltip: 'How the Pop is Closed',
                    class: 'node-setting',
                    enabled: false
                }, {
                    key: 'nodePopRepositionNeighbors',
                    title: 'Reposition neighbors',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        nodePopShow: true
                    },
                    tooltip: 'Reposition neighbors covered by the popped node',
                    enabled: true
                }, ],
                overlay: [{
                        key: 'nodeFocusShow',
                        title: 'Show Overlay',
                        type: 'bool',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true
                        },
                        tooltip: 'Show the Node\'s Details in a Modal Overlay',
                        enabled: true
                    }, {
                        key: 'nodeFocusContext',
                        title: 'Context',
                        type: 'select',
                        values: ['hover', 'click'],
                        parents: {
                            drawNodes: true,
                            nodeFocusShow: true
                        },
                        tooltip: 'Whether to Show the Overlay on Hover or Click??',
                        class: 'node-setting',
                        enabled: true
                    }, {
                        key: 'nodeFocusRenderTemplate',
                        title: 'RenderTemplate',
                        type: 'select',
                        values: ['scroll', 'content'],
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeFocusShow: true
                        },
                        tooltip: 'The Template for Rendering the Overlay',
                        enabled: true
                    }, {
                        key: 'nodeFocusShowNeighbors',
                        title: 'Show Neighbor Grid',
                        type: 'bool',
                        class: 'node-setting',
                        parents: {
                            drawNodes: true,
                            nodeFocusShow: true,
                            nodeFocusRenderTemplate: 'scroll'
                        },
                        tooltip: 'Show the Node\'s Neighbors in a Modal Overlay',
                        enabled: true
                    },
                    // {
                    // 	key: 'nodeFocusNeighborsButton',
                    // 	title: 'Show Orbiting Neighbors Button',
                    // 	type: 'bool',
                    // 	class: 'node-setting',
                    // 	parents: {drawNodes: true, nodeFocusShow: true, nodeFocusRenderTemplate: 'scroll', nodeFocusShowNeighbors: true},
                    // 	tooltip: 'Show a button for the Node\'s Neighbors',
                    // 	enabled: true
                    // },{
                    // 	key: 'nodeFocusNeighborsBefore',
                    // 	title: 'Attribute to place Neighbors before',
                    // 	type: 'attr-select',
                    // 	class: 'node-setting',
                    // 	parents: {drawNodes: true, nodeFocusShow: true, nodeFocusRenderTemplate: 'scroll', nodeFocusShowNeighbors: true},
                    // 	tooltip: 'Which Attribute to place the Neighbors Grid before',
                    // 	enabled: true
                    // }
                ]
            },
            aggregations: {
                settings: [{
                    key: 'disableAggregation',
                    title: 'Disable Aggregations',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true
                    },
                    tooltip: 'Disable All Node Clustering',
                    enabled: true
                }],
                rendering: [{
                    key: 'aggNodeSizeScale',
                    title: 'Size Ratio',
                    type: 'scale',
                    min: 0.1,
                    max: 1.0,
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'The Size of the Aggregations',
                    enabled: true
                }, {
                    key: 'aggNodeMinSize',
                    title: 'Min Size',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'The Minimum Size of the Aggregations',
                    enabled: true
                }, {
                    key: 'aggNodeMaxSize',
                    title: 'Max Size',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'The Maximum Size of the Aggregations',
                    enabled: true
                }, {
                    key: 'aggNodeRenderStyle',
                    title: 'Visual Strategy',
                    type: 'select',
                    values: ['thin-donut', 'thick-donut', 'full-donut'],
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'The Shape of the Clusters',
                    enabled: true
                }, {
                    key: 'aggNodeShowCount',
                    title: 'Show Count',
                    type: 'bool',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'Show the Number of Nodes in the Cluster',
                    enabled: true
                }, {
                    key: 'aggNodeBackgroundColor',
                    title: 'Background Color',
                    type: 'color',
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        aggNodeRenderStyle: 'thin-donut',
                        disableAggregation: false
                    },
                    tooltip: 'The Background Color of the Clusters',
                    enabled: true
                }],
                calculation: [{
                    key: 'disableAggregationLevel',
                    title: 'Cutoff ZoomLevel',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'At What Zoom to Stop Aggregating Nodes',
                    enabled: true
                }, {
                    key: 'aggregationWidth',
                    title: 'Unit Grid Width',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'At What Distance Horizontally to Begin Clustering',
                    enabled: true
                }, {
                    key: 'aggregationHeight',
                    title: 'Unit Grid Height',
                    type: 'input',
                    multiplier: 1,
                    class: 'node-setting',
                    parents: {
                        drawNodes: true,
                        disableAggregation: false
                    },
                    tooltip: 'At What Distance Vertically to Begin Clustering',
                    enabled: true
                }]
            }
        },

        edgeTab: {
            header: {
                key: 'drawEdges',
                title: 'Links',
                type: 'bool',
                class: 'switcher',
                enabled: true
            },
            attributes: {},
            renderSettings: {
                direction: [{
                    key: 'edgeTaper',
                    title: 'Link Directional?',
                    type: 'bool',
                    class: 'switcher',
                    parents: {
                        drawEdges: true
                    },
                    tooltip: 'Are the links directional?',
                    enabled: true
                }, {
                    key: 'edgeDirectionalRender',
                    title: 'Directional Rendering',
                    type: 'select',
                    values: ['all', 'incoming', 'outgoing'],
                    class: 'edge-setting',
                    parents: {
                        drawEdges: true,
                        edgeTaper: true
                    },
                    tooltip: 'Which link direction to render?',
                    enabled: true
                }],
                form: [{
                        key: 'edgeCurvature',
                        title: 'Curvature',
                        type: 'scale',
                        min: 0,
                        max: 1.0,
                        multiplier: 1,
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true
                        },
                        tooltip: 'How curved are the Links?',
                        enabled: true
                    }, {
                        key: 'edgePath',
                        title: 'Link Path',
                        type: 'bool',
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true
                        },
                        tooltip: 'Show paths when multiple nodes are selected',
                        enabled: false
                    }, {
                        key: 'edgeTaper',
                        title: 'Taper',
                        type: 'scale',
                        min: 0.1,
                        max: 1.0,
                        multiplier: 1,
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeDirectional: true
                        },
                        tooltip: 'The Amount of Taper to the Edge (not sure of diff to below??)',
                        enabled: false
                    }, {
                        key: 'edgeTaperScale',
                        title: 'Taper Scale',
                        type: 'scale',
                        min: 0.11,
                        max: 1.0,
                        multiplier: 1,
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeTaper: true
                        },
                        tooltip: 'How thick should the link be?',
                        enabled: true
                    }, {
                        key: 'edgeSizeStrat',
                        title: 'Thickness Strategy',
                        type: 'select',
                        values: ['attr', 'fixed'],
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeTaper: false
                        },
                        tooltip: 'Size by attribute or fixed?',
                        enabled: true
                    },

                    {
                        key: 'edgeSizeDefaultValue',
                        title: 'Thickness',
                        type: 'scale',
                        min: 0.1,
                        max: 10,
                        multiplier: 1,
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeTaper: false,
                            edgeSizeStrat: 'fixed'
                        },
                        tooltip: 'How thick should the link be?',
                        enabled: true
                    },

                    {
                        key: 'edgeSizeAttr',
                        title: 'Attribute',
                        type: 'attr-select',
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeTaper: false,
                            edgeSizeStrat: 'attr'
                        },
                        tooltip: 'Which attribute to size links by?',
                        enabled: true
                    },

                    {
                        key: 'edgeSizeMultiplier',
                        title: 'Scale',
                        type: 'scale',
                        min: 0.1,
                        max: 3.0,
                        multiplier: 3,
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeTaper: false,
                            edgeSizeStrat: 'attr'
                        },
                        tooltip: 'Scale the link thickness',
                        enabled: true
                    },

                    {
                        key: 'edgeSizeMin',
                        title: 'Min Thickness',
                        type: 'input',
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeTaper: false,
                            edgeSizeStrat: 'attr'
                        },
                        tooltip: 'Minimum link thickness',
                        enabled: true
                    }, {
                        key: 'edgeSizeMax',
                        title: 'Max Thickness',
                        type: 'input',
                        class: 'edge-setting',
                        parents: {
                            drawEdges: true,
                            edgeTaper: false,
                            edgeSizeStrat: 'attr'
                        },
                        tooltip: 'Maximum link thickness',
                        enabled: true
                    }
                ],
                color: [{
                    key: 'edgeColorStrat',
                    title: 'Color Strategy',
                    type: 'select',
                    values: ['gradient', 'source', 'target', 'attr', 'select'],
                    class: 'edge-setting',
                    parents: {
                        drawEdges: true
                    },
                    tooltip: 'How to color the links',
                    enabled: true
                }, {
                    key: 'edgeColorAttr',
                    title: 'Color Attribute',
                    type: 'attr-select',
                    class: 'edge-setting',
                    parents: {
                        drawNodes: true,
                        edgeColorStrat: 'attr'
                    },
                    tooltip: 'Which attribute to color links by?',
                    enabled: true,
                }, {
                    key: 'edgeColorDefaultValue',
                    title: 'Select Color',
                    type: 'color',
                    class: 'edge-setting',
                    parents: {
                        drawEdges: true,
                        edgeColorStrat: 'select'
                    },
                    tooltip: 'Choose color for all links',
                    enabled: true
                }, {
                    key: 'edgeColorPaletteOrdinal',
                    title: 'Ordinal Palette',
                    type: 'color-p',
                    class: 'edge-setting',
                    parents: {
                        drawEdges: true,
                        edgeColorStrat: 'attr'
                    },
                    tooltip: 'Define colors for non-numeric attribute values',
                    enabled: true,
                }, {
                    key: 'edgeColorPaletteNumeric',
                    title: 'Numeric Palette',
                    type: 'color-p',
                    class: 'edge-setting',
                    parents: {
                        drawEdges: true,
                        edgeColorStrat: 'attr'
                    },
                    tooltip: 'Define colors for numeric attribute values',
                    enabled: true,
                }, {
                    key: 'edgeSaturation',
                    title: 'Link Saturation',
                    type: 'scale',
                    min: 0,
                    max: 1,
                    multiplier: 1,
                    class: 'edge-setting',
                    parents: {
                        drawEdges: true
                    },
                    tooltip: 'The saturation of the links',
                    enabled: true,
                }, {
                    key: 'edgeUnselectedOpacity',
                    title: 'Unselected opacity',
                    type: 'scale',
                    min: 0,
                    max: 1,
                    multiplier: 1,
                    class: 'edge-setting',
                    parents: {
                        drawEdges: true
                    },
                    tooltip: 'The opacity of the unselected links',
                    enabled: true,
                }]
            }
        },

        labelTab: {
            header: {
                key: 'drawLabels',
                title: 'Labels',
                type: 'bool',
                class: 'switcher',
                enabled: true
            },
            attributes: {},
            renderSettings: {
                text: [{
                    key: 'labelAttr',
                    title: 'Attribute',
                    type: 'attr-select',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Which attribute to display?',
                    enabled: true
                }, {
                    key: 'drawGroupLabels',
                    title: 'Group Labels',
                    type: 'bool',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Whether to display group labels when zoomed out',
                    enabled: true
                }],
                color: [{
                    key: 'labelColor',
                    title: 'Color',
                    type: 'color',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Label font color',
                    enabled: true
                }, {
                    key: 'labelOutlineColor',
                    title: 'Outline Color',
                    type: 'color',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Label font outline',
                    enabled: true
                }, {
                    key: 'labelOpacity',
                    title: 'Opacity',
                    type: 'scale',
                    min: 0,
                    max: 1.0,
                    multiplier: 1,
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Opacity of the labels',
                    enabled: false
                }, {
                    key: 'labelUnselectedOpacity',
                    title: 'Unselected Opacity',
                    type: 'scale',
                    min: 0,
                    max: 1.0,
                    multiplier: 1,
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Opacity of the unselected labels',
                    enabled: true
                }],
                size: [{
                    key: 'labelSize',
                    title: 'Size Strategy',
                    type: 'select',
                    values: ['fixed', 'proportional', 'fixed-proportional'],
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'How to size the labels',
                    enabled: true
                }, {
                    key: 'labelSizeRatio',
                    title: 'Size Ratio',
                    type: 'scale',
                    min: 0.1,
                    max: 10.0,
                    multiplier: 4,
                    class: 'label-setting',
                    parents: {
                        drawLabels: true,
                        labelSize: 'proportional'
                    },
                    tooltip: 'Scale the size of the labels',
                    enabled: true
                }, {
                    key: 'defaultLabelSize',
                    title: 'Fixed Size',
                    type: 'input',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true,
                        labelSize: 'fixed'
                    },
                    tooltip: 'The size of all the labels',
                    enabled: true
                }, {
                    key: 'minLabelSize',
                    title: 'Min Size',
                    type: 'input',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true,
                        labelSize: 'proportional'
                    },
                    tooltip: 'The minimum label size',
                    enabled: true
                }, {
                    key: 'maxLabelSize',
                    title: 'Max Size',
                    type: 'input',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true,
                        labelSize: 'proportional'
                    },
                    tooltip: 'The maximum label size',
                    enabled: true
                }, {
                    key: 'labelSizeRatio',
                    title: 'Size Ratio',
                    type: 'scale',
                    min: 0.1,
                    max: 10.0,
                    multiplier: 4,
                    class: 'label-setting',
                    parents: {
                        drawLabels: true,
                        labelSize: 'fixed-proportional'
                    },
                    tooltip: 'The size of all the labels',
                    enabled: true
                }, {
                    key: 'minLabelSize',
                    title: 'Min Size',
                    type: 'input',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true,
                        labelSize: 'fixed-proportional'
                    },
                    tooltip: 'The minimum label size',
                    enabled: true
                }, {
                    key: 'maxLabelSize',
                    title: 'Max Size',
                    type: 'input',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true,
                        labelSize: 'fixed-proportional'
                    },
                    tooltip: 'The maximum label size',
                    enabled: true
                }],
                display: [{
                    key: 'labelMaxCount',
                    title: 'Max Label Count',
                    type: 'input',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Maximum num of labels visible',
                    enabled: true
                }, {
                    key: 'labelDisplayStrat',
                    title: 'Display Strategy',
                    type: 'select',
                    values: ['topXSizeCollision', 'topx', 'threshold'],
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'Whether to display overlapping labels',
                    enabled: true
                }, {
                    key: 'labelThreshold',
                    title: 'Threshold',
                    type: 'scale',
                    min: 0.05,
                    max: 1.0,
                    multiplier: 1,
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'The sensitivity for hiding labels',
                    enabled: true
                }],
                on_highlight: [{
                    key: 'labelHoverAttr',
                    title: 'Text Attribute',
                    type: 'attr-select',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'The attribute shown when hovering on a label',
                    enabled: true
                }],
                on_select: [{
                    key: 'labelClickAttr',
                    title: 'Text Attribute',
                    type: 'attr-select',
                    class: 'label-setting',
                    parents: {
                        drawLabels: true
                    },
                    tooltip: 'The attribute shown when clicking on a label',
                    enabled: true
                }],
            },
        },

        settingsTab: {
            stage: {
                // 	settings : [
                // 		{
                // 			key: 'backgroundColor',
                // 			title: 'Background Color',
                // 			type: 'color',
                // 			class: 'stage-setting',
                // 			tooltip: 'The mapp background color',
                // 			enabled: false,
                // 			owner: 'project'
                // 		},
                // 		{
                // 			key: 'backgroundImage',
                // 			title: 'Background Image',
                // 			// type: 'image-input',
                // 			type: 'text-input',
                // 			class: 'stage-setting',
                // 			tooltip: 'An image url to use for the mapp background',
                // 			enabled: true
                // 		},
                // 		{
                // 			key: 'theme',
                // 			title: 'Theme',
                // 			type: 'select-color',
                // 			values: ['light', 'dark'],
                // 			class: 'stage-setting',
                // 			tooltip: 'The color theme for the controls',
                // 			enabled: true,
                // 			owner: 'project'
                // 		}
                // 	],
                camera: [{
                        key: 'zoomLock',
                        title: 'Zoom Lock',
                        type: 'bool',
                        class: 'stage-setting',
                        tooltip: 'Disable zooming',
                        enabled: true
                    }, {
                        key: 'panLock',
                        title: 'Pan Lock',
                        type: 'bool',
                        class: 'stage-setting',
                        tooltip: 'Disable panning',
                        enabled: true
                    },
                    // {
                    // 	key: 'minZoomLevel',
                    // 	title: 'Min Zoom Lvl',
                    // 	type: 'input',
                    // 	multiplier: 1,
                    // 	class: 'stage-setting',
                    // 	tooltip: 'Minimum zoom level',
                    // 	enabled: true
                    // },
                    // {
                    // 	key: 'savedZoomLevel',
                    // 	title: 'Default Zoom Lvl',
                    // 	type: 'input',
                    // 	multiplier: 1,
                    // 	class: 'stage-setting',
                    // 	tooltip: 'Default zoom level',
                    // 	enabled: true
                    // },
                    // {
                    // 	key: 'pinRightPanel',
                    // 	title: 'Pin Right Panel',
                    // 	type: 'bool',
                    // 	class: 'stage-setting',
                    // 	tooltip: 'Don\'t close the right panel when interacting with the graph',
                    // 	enabled: true
                    // }
                ]
            },
            // legend: {
            // 	settings : [
            // 		// {
            // 		// 	key: 'legendAutoOpen',
            // 		// 	title: 'Auto Open',
            // 		// 	type: 'bool',
            // 		// 	class: 'stage-setting',
            // 		// 	tooltip: 'Immediately open the legend when loading a project',
            // 		// 	enabled: true
            // 		// },
            // 		{
            // 			key: 'hideLegend',
            // 			title: 'Hide Legend',
            // 			type: 'bool',
            // 			class: 'stage-setting',
            // 			tooltip: 'Hide the legend or Selection panel in this snapshot',
            // 			enabled: true
            // 		},
            // 		{
            // 			key: 'globalLegendOn',
            // 			title: 'Global Legend',
            // 			type: 'bool',
            // 			class: 'stage-setting',
            // 			tooltip: 'Show a legend when no nodes are selected',
            // 			enabled: true
            // 		},
            // 		{
            // 			key: 'entityLegendOn',
            // 			title: 'Entity Legend',
            // 			type: 'bool',
            // 			class: 'stage-setting',
            // 			tooltip: 'Show a legend when a node or nodes are selected',
            // 			enabled: true
            // 		},
            // 		{
            // 			key: 'legendTitle',
            // 			title: 'Title',
            // 			type: 'text-input',
            // 			class: 'stage-setting',
            // 			tooltip: 'The title for the legend',
            // 			enabled: true
            // 		},
            // 		{
            // 			key: 'legendTitleTooltip',
            // 			title: 'Tooltip',
            // 			type: 'text-input',
            // 			class: 'stage-setting',
            // 			tooltip: 'The tooltip for the legend title',
            // 			enabled: true
            // 		}
            // 	]
            // },
            // linkMapping: {
            // 	settings: [
            // 		{
            // 			key: 'enableLinkMapping',
            // 			title: 'Enable',
            // 			type: 'bool',
            // 			class: 'stage-setting',
            // 			tooltip: 'Allow for link mapping when a node is selected',
            // 			enabled: true
            // 		}
            // 	]
            // },
            // layouts: {
            //     scatterplot: [{
            //         key: 'xAxShow',
            //         title: 'Show X-Axis',
            //         type: 'bool',
            //         class: 'stage-setting',
            //         tooltip: 'Show the X-Axis',
            //         enabled: true
            //     }, {
            //         key: 'xAxTickShow',
            //         title: 'Show X-Divs',
            //         type: 'bool',
            //         class: 'stage-setting',
            //         tooltip: 'Show the X-Axis Divisions',
            //         enabled: true
            //     }, {
            //         key: 'xAxLabel',
            //         title: 'X-Label',
            //         type: 'text-input',
            //         class: 'stage-setting',
            //         tooltip: 'Show the X-Axis Label',
            //         enabled: true
            //     }, {
            //         key: 'xAxTooltip',
            //         title: 'X-Tooltip',
            //         type: 'text-input',
            //         class: 'stage-setting',
            //         tooltip: 'The Tooltip for the X-Axis',
            //         enabled: true
            //     }, {
            //         key: 'invertX',
            //         title: 'Invert X',
            //         type: 'bool',
            //         class: 'stage-setting',
            //         tooltip: 'Invert the X-Axis Divisions',
            //         enabled: true
            //     }, {
            //         key: 'yAxShow',
            //         title: 'Show Y-Axis',
            //         type: 'bool',
            //         class: 'stage-setting',
            //         tooltip: 'Show the Y-Axis',
            //         enabled: true
            //     }, {
            //         key: 'yAxTickShow',
            //         title: 'Show Y-Divs',
            //         type: 'bool',
            //         class: 'stage-setting',
            //         tooltip: 'Show the Y-Axis Divisions',
            //         enabled: true
            //     }, {
            //         key: 'yAxLabel',
            //         title: 'Y-Label',
            //         type: 'text-input',
            //         class: 'stage-setting',
            //         tooltip: 'Show the Y-Axis Label',
            //         enabled: true
            //     }, {
            //         key: 'yAxTooltip',
            //         title: 'Y-Tooltip',
            //         type: 'text-input',
            //         class: 'stage-setting',
            //         tooltip: 'The Tooltip for the Y-Axis',
            //         enabled: true
            //     }, {
            //         key: 'invertY',
            //         title: 'Invert Y',
            //         type: 'bool',
            //         class: 'stage-setting',
            //         tooltip: 'Invert the Y-Axis Divisions',
            //         enabled: true
            //     }, {
            //         key: 'scatterAspect',
            //         title: 'Aspect ratio',
            //         type: 'scale',
            //         min: 0,
            //         max: 1,
            //         multiplier: 1,
            //         class: 'stage-setting',
            //         tooltip: 'Scatterplot aspect ratio',
            //         enabled: true
            //     }, ],
            //     geoplot: [{
            //         key: 'mapboxMapID',
            //         title: 'Map Style',
            //         type: 'select',
            //         values: ['vibrantdata.ioeefmpb', 'vibrantdata.j5c7ofm2', 'vibrantdata.ic45fi91', 'vibrantdata.jjkpgbkp', 'vibrantdata.oidk9gmi'],
            //         class: 'stage-setting',
            //         tooltip: 'The ID for the Mapbox Tiles',
            //         enabled: true
            //     }]
            // }
        },
        disabledSettings: [],
        //currently hovered setting (if parent then will show children)
        hoveredSetting: null,
        //get possible values a setting can be
        getValues: function (opt) {
            var control = opt;
            return control.values;
        },
        //get class for this setting and class to hide or show or disable
        getClass: function (opt) {
            var control = opt;
            var cl = control.class + ' ';
            if (typeof control.parents !== 'object') return cl;

            var match = true;
            Object.keys(control.parents).forEach(function (key) {
                match = match && (control.parents[key] == $scope.currSnap.mapprSettings[key])
            });
            if (!match || !control.enabled) {
                cl += 'hidden ';
            } else {
                cl += 'visible';
            }
            return cl;
        }
    }; //end of $scope.settingsUI object

}
]);
