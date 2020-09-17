/**
* Contains layout models and allows generating layouts
* Note: - Currently, this controller is always alive, so any event listeners/watches you attach
* must be manually removed when the panel is closed, as $scope.$destroy() is never called for it.
*/
angular.module('mappr')
.controller('LayoutPanelCtrl', ['$scope', '$rootScope', '$timeout', '$q', '$uibModal', 'dataGraph', 'networkService' , 'layoutService', 'athenaService', 'projFactory', 'AttrInfoService', 'graphStyleService', 'BROADCAST_MESSAGES',
function($scope, $rootScope, $timeout, $q ,$uibModal, dataGraph, networkService, layoutService, athenaService, projFactory, AttrInfoService, graphStyleService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ********* CLASSES ********************
    **************************************/
    /**
     * The class used to represent a layout in the view
     * @param {String} name
     * @param {String} plotType
     * @param {Array} optionsPrimary  options which changed require rebuilding the layout
     * @param {Array} optionsOptional mapprSettings options which change only requires graph refresh
     * @param {Function} onSwitch     Function to run when the layout is enabled
     * @param {Function} onRefresh    Function to run when primary settings are changed
     *
     * The isCurrent / inInitialized are flags for the state.
     *  isCurrent -> Layout is current focus of attention. is auto toggled by accordion
     *  isInitialized -> Layout has been applied to the graph atleast once
     */
    function LayoutModel(name, plotType, optionsPrimary, optionsOptional, onSwitch, onRefresh, isBuilder) {
        this.name = name;
        this.plotType = plotType;
        this.isInitialized = false;
        this.isCurrent = false;
        this.isCurrentPanel = false;
        this.isGenerated = false;
        this.isBuilder = isBuilder;
        this.options = {
            primary : optionsPrimary || [],
            optional : optionsOptional || []
        };
        this._onSwitch = onSwitch;
        this._onRefresh = onRefresh;
        this._onDelete = onDelete;
    }
    LayoutModel.prototype.delete = function() {
        this._onDelete(this);
    };
    LayoutModel.prototype.makeCurrent = function() {
        var self = this;
        layoutPanel.triggeredChange = true;

        if($scope.layoutPanel.focusLayout){
            $scope.layoutPanel.focusLayout.isInitialized = false;
            $scope.layoutPanel.focusLayout.isCurrent = false;
        } else {
            console.error("$scope.layoutPanel.focusLayout is null!");
        }


        //default to original layout when open cluster panel or last layout looked at
        //when cluster panel open
        if(self.plotType == 'athena_layout_clustered') {
            currentClusterLayout = self.name;
        }
        //if clicked on panel and layout is layout for generating layouts,
        //then stop and make current the last cluster layout that was loaded
        if(self.plotType == 'layout_generator_layout_clustered') {
            _.find(layouts, {name: currentClusterLayout}).makeCurrent();
            return;
        }


        $scope.layoutPanel.focusLayout = self;

        if(this.plotType == 'geo' && !_hasLatLong())  {
            this.isCurrent = true;
            setCurrentPanel();
            console.warn('Not switching to GEO as lat & long not found');
            return;
        }

        //self.isCurrent = true;
        console.log($scope.layoutPanel);
        return $q.when(this._onSwitch(self))
                .then(function() {
                    self.isCurrent = true;
                    self.isInitialized = true;
                    $rootScope.$broadcast(BROADCAST_MESSAGES.layoutPanel.layoutCreated, {
                        layoutName: self.name,
                        layoutType: self.plotType
                    });
                    $timeout(function() {
                        setCurrentPanel();
                    });
                });
    };
    LayoutModel.prototype.refresh = function() {
        layoutPanel.triggeredChange = true;
        return this._onRefresh(this);
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var layouts = [], // a list of all layouts. contains LayoutModel objects
        layoutPanel = {
            focusLayout : null,
            triggeredChange: false,
            disableScatterplotWatch : false
        };

    //so when return to cluster panel, will remember last layout
    var currentClusterLayout = 'Original';

    //for determining which layout types are available based on attributes
    var mediaAttrTypes, mediaAttrs, firstMediaAttr, firstRowAttr;



    var listenerRemoveFns = []; //A list of function references which unregister the listener/watch

    //need to set variables before creating layout settings below
    dataGraph.getRawData().then(function (resolve) {
        setMediaAttrVars();
    });

    ///
    /// Layout Settings
    ///
    var scatterplotPrimary = [
        {
            key: 'xAttr',
            title: 'xAttr',
            type: 'attr-select',
            class: 'node-setting',
            tooltip: 'Attribute to use for X-Axis',
            input_value : 'OriginalX',
            enabled: true
        },
        {
            key: 'yAttr',
            title: 'yAttr',
            type: 'attr-select',
            class: 'node-setting',
            tooltip: 'Attribute to use for Y-Axis',
            input_value : 'OriginalY',
            enabled: true
        },
        {
            key: 'xScaleType',
            title: 'X-Axis Scale Strategy',
            type: 'select',
            //values: ['linear', 'log', 'exponential'],
            values: ['linear', 'log'],
            class: 'node-setting',
            tooltip: 'Scaler to use for generating values',
            input_value : 'linear',
            enabled: true
        },
        {
            key: 'xScaleExponent',
            title: 'X-Axis Scale exponent(power)',
            type: 'input',
            class: 'node-setting',
            tooltip: 'Define the exponent for exponential scaling',
            input_value : 2,
            enabled: false
        },
        {
            key: 'xScaleBase',
            title: 'X-Axis Log scale Base',
            type: 'input',
            class: 'node-setting',
            tooltip: 'Define the base for log scaling',
            input_value : 10,
            enabled: false
        },
        {
            key: 'yScaleType',
            title: 'Y-Axis Scale Strategy',
            type: 'select',
            //values: ['linear', 'log', 'exponential'],
            values: ['linear', 'log'],
            class: 'node-setting',
            tooltip: 'Scaler to use for generating values',
            input_value : 'linear',
            enabled: true
        },
        {
            key: 'yScaleExponent',
            title: 'Y-Axis Scale exponent(power)',
            type: 'input',
            class: 'node-setting',
            tooltip: 'Define the exponent for exponential scaling',
            input_value : 2,
            enabled: false
        },
        {
            key: 'yScaleBase',
            title: 'Y-Axis Log scale Base',
            type: 'input',
            class: 'node-setting',
            tooltip: 'Define the base for log scaling',
            input_value : 10,
            enabled: false
        }
    ];

    var geoPrimary = [
        {
            key: 'xAttr',
            title: 'Latitude',
            type: 'attr-select',
            class: 'node-setting',
            tooltip: 'Attribute to use for Latitude',
            input_value : 'Latitude',
            enabled: true
        },
        {
            key: 'yAttr',
            title: 'Longitude',
            type: 'attr-select',
            class: 'node-setting',
            tooltip: 'Attribute to use for Longitude',
            input_value : 'Longitude',
            enabled: true
        }
    ];


    var gridPrimary = [
        {
            key: 'renderAttr',
            title: 'Rendered Attr',
            type: 'attr-select',
            class: 'node-setting',
            tooltip: 'Attribute to render in card',
            input_value : firstMediaAttr ? firstMediaAttr.id : 'OriginalLabel',
            enabled: true
        },
        {
            key: 'sortAttr',
            title: 'Sort Attr',
            type: 'attr-select',
            class: 'node-setting',
            tooltip: 'Attribute to Sort cards by',
            input_value : 'OriginalLabel',
            enabled: true,
            disableFilter: true
        },
        {
            key: 'compareIds',
            title: 'Compare Node Ids',
            type: 'array',
            class: '',
            tooltip: 'IDs of nodes in compare list',
            input_value : false,
            enabled: false,
            disableFilter: true
        }
    ];


        var listPrimary = [
            {
                key: 'renderAttrs',
                title: 'Rendered Attr',
                type: 'attr-select',
                class: 'node-setting',
                tooltip: 'Attributes to render in columns',
                input_value : firstRowAttr,
                enabled: false
            },
            // {
            //     key: 'sortAttr',
            //     title: 'Sort Attr',
            //     type: 'attr-select',
            //     class: 'node-setting',
            //     tooltip: 'Attribute to Sort cards by',
            //     input_value : 'OriginalLabel',
            //     enabled: true,
            //     disableFilter: true
            // },
            // {
            //     key: 'sortReverse',
            //     title: 'Reverse Sort',
            //     type: 'bool',
            //     class: 'node-setting',
            //     tooltip: 'Direction of Sort',
            //     input_value : false,
            //     enabled: true,
            //     disableFilter: true
            // },

            {
                key: 'listSortAttrAr',
                title: 'Sort Attributes',
                type: 'array',
                class: '',
                tooltip: 'Attributes to Sort rows by',
                input_value : 'Cluster',
                enabled: true,
                disableFilter: true
            },
            {
                key: 'sortReverseAr',
                title: 'Reverse Sort of Attributes',
                type: 'array',
                class: '',
                tooltip: 'Direction of Sort',
                input_value : false,
                enabled: true,
                disableFilter: true
            },
            {
                key: 'compareIds',
                title: 'Compare Node Ids',
                type: 'array',
                class: '',
                tooltip: 'IDs of nodes in compare list',
                input_value : false,
                enabled: false,
                disableFilter: true
            },
            {
                key: 'listColSizes',
                title: 'Column Sizes',
                type: 'array',
                class: '',
                tooltip: 'Widths of columns',
                input_value : false,
                enabled: false,
                disableFilter: true
            }
        ];






    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.layouts = layouts;
    $scope.layoutPanel = layoutPanel;
    $scope.attrs = {};


    /**
    * Scope methods
    */
    $scope.layoutOptattrFilterFnBuilder = layoutOptattrFilterFnBuilder;

    $scope.initAttrs = function() {
        //get new attrs in case render type changed
        $scope.nodeAttrs = dataGraph.getNodeAttrs();
    };

    $scope.isLayoutNameUsed = function(layout) {
        var nameOpt = _.find(layout.options.primary, 'key', 'layoutName');
        if(nameOpt === undefined) {
            return false;
        }
        return _.find(layouts, {name: nameOpt.input_value}) !== undefined;

    };




    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    // crazy hack to get scatterplot working
    var scatterplotWatchOn = _.map(_.range(0,scatterplotPrimary.length), function(idx) {
        return 'layouts[1].options.primary[' + idx + '].input_value';
    });

    var geoWatchOn = _.map(_.range(0, geoPrimary.length), function(idx) {
        return 'layouts[2].options.primary[' + idx + '].input_value';
    });

    //This doesn't work because layout needs to know regardless of whether the panel is open whether the layout is changing
    // $scope.$watch('panelUI.layoutPanelOpen', function(panelOpen) {
    //     if(panelOpen) {
    //         setupListeners();
    //         initPanel();
    //     }
    //     else {
    //         removeListeners();
    //     }
    // });

    function setupListeners() {
        console.log('Setting up event listeners & watches');
        var a = $scope.$watchGroup(geoWatchOn, function(newVals, oldVals) {
            if(_.any(newVals, function(val, idx) { return val != oldVals[idx]; })) {
                if(!$scope.layoutPanel.focusLayout.isInitialized) {
                    layouts[2].makeCurrent();
                }
                else {
                    layouts[2].refresh();
                }
            }
        });

        var b = $scope.$watchGroup(scatterplotWatchOn, function(newVals, oldVals) {
            if(_.any(newVals, function(val, idx) { return val != oldVals[idx]; })) {
                if(!layoutPanel.disableScatterplotWatch) {
                    layouts[1].refresh();
                } else {
                    layoutPanel.disableScatterplotWatch = false;
                }
            }
        });

        var c = $scope.$on(BROADCAST_MESSAGES.snapshot.changed, function() {
            // Set triggered change to false if snapshot changed, so that appropriate focusLayout can be loaded on panel init.
            layoutPanel.triggeredChange = false;
        });

        var d = $scope.$on(BROADCAST_MESSAGES.layout.changed, initPanel);
        var e = $scope.$on(BROADCAST_MESSAGES.dataGraph.loaded, $scope.initAttrs);


        //listeners for list layout
        var f = $scope.$on(BROADCAST_MESSAGES.layout.layoutSorted, function(event, data) {
            if(layoutPanel.focusLayout.plotType === 'list') {
                console.log('layout sorted: ', _.map(_.map(data.attrAr,'val'), 'id'), _.map(data.attrAr,'direction'));
                _.find(layoutPanel.focusLayout.options.primary, 'key', 'listSortAttrAr').input_value = _.map(_.map(data.attrAr,'val'), 'id') ;
                _.find(layoutPanel.focusLayout.options.primary, 'key', 'sortReverseAr').input_value = _.map(data.attrAr,'direction');
            }
            layoutPanel.focusLayout.refresh();
        });

        var g = $scope.$on(BROADCAST_MESSAGES.layout.rowAttrsUpdated, function(event, data) {
            console.log('heard rowAttrsUpdated event');
            if(layoutPanel.focusLayout.plotType === 'list') {
                _.find(layoutPanel.focusLayout.options.primary, 'key', 'renderAttrs').input_value = data.attrs;
            }
            layoutPanel.focusLayout.refresh();
        });

        var h = $scope.$on(BROADCAST_MESSAGES.layout.compareIdsUpdated, function(event, data) {
            console.log('data.ids updated: ', data.ids);
            if(layoutPanel.focusLayout.plotType === 'list' || layoutPanel.focusLayout.plotType === 'grid') {
                _.find(layoutPanel.focusLayout.options.primary, 'key', 'compareIds').input_value = data.ids;
            }
            layoutPanel.focusLayout.refresh();
        });

        var i = $scope.$on(BROADCAST_MESSAGES.layout.listColSizesUpdated, function(event, data) {
            if(layoutPanel.focusLayout.plotType === 'list') {
                _.find(layoutPanel.focusLayout.options.primary, 'key', 'listColSizes').input_value = data.colSizes;
            }
            layoutPanel.focusLayout.refresh();
        });

        listenerRemoveFns = [a,b,c,d,e,f,g,h];
    }

    function removeListeners() {
        console.log('Removing event listeners & watches');
        _.each(listenerRemoveFns, function(unregisterFn) {
            _.isFunction(unregisterFn) && unregisterFn();
        });
    }


    //reinitialize layouts if attributes change
    $rootScope.$on(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated, function(event, data) {
        initLayouts();

    });


    /*************************************
    ********* Initialise *****************
    **************************************/


    //create layouts
    dataGraph.getRawData().then(function (resolve) {
        initLayouts();
    });

    /*************************************
    ********* Core Functions *************
    **************************************/

    function initLayouts() {
        removeListeners();
        //reset layout Object
        layouts = [];
        //make sure to get a media attr for grid
        //turning on if has media
        setMediaAttrVars();

        //push layouts

        // original
        layouts.push(new LayoutModel("Original","original",[], [], onSwitch, onRefresh, false));
        //scatterplot
        layouts.push(new LayoutModel("ScatterPlot","scatterplot",
                            _.cloneDeep(scatterplotPrimary),
                            _.cloneDeep(graphStyleService.getStyleSettingsAtPath('settingsTab.layouts.scatterplot')),
                            onSwitch,
                            onRefresh,
                            true));
        // geo
        if(dataGraph.hasGeoData()) {
            layouts.push(new LayoutModel("Geospatial","geo",
                            _.cloneDeep(geoPrimary),
                            _.cloneDeep(graphStyleService.getStyleSettingsAtPath('settingsTab.layouts.geoplot')),
                            onSwitch,
                            onRefresh,
                            true));
        }
        //list
        if(firstRowAttr) {
            layouts.push(new LayoutModel("List","list",
                             _.cloneDeep(listPrimary),
                            [],
                            onSwitch,
                            onRefresh,
                            true));
        }
        //grid
        if(mediaAttrs.length > 0) {
            //set grid primary option to have first media attr
            gridPrimary[0].input_value = firstMediaAttr ? firstMediaAttr.id : 'OriginalLabel';
            layouts.push(new LayoutModel("Grid","grid",
                            _.cloneDeep(gridPrimary),
                            [],
                            onSwitch,
                            onRefresh,
                            true));
        }

        //
        // Algos

        /// Build layoutModels for athena algos
        var onFetched = athenaService.fetchAlgos()
            .then(function(algos) {
                return _.filter(algos, function(algo) {
                    return algo.name.indexOf('layout') !== -1; // all athena algos which contain 'layout' are layout algos
                });
            })
            .then(function(algos){
                console.log("Creating layout of algos: ", algos);
                // find out if any other layouts have been generated as well.
                // projSettings.layouts.<algoName>.[{layoutName,attrPrefix}]
                var projSettings = projFactory.getProjectSettings();
                if(networkService.getCurrentNetwork()) {
                    _.each(algos, function(algo) {
                        var prevGenLayouts = _.filter(_.get(projSettings, 'layouts.' + algo.name), 'networkId', networkService.getCurrentNetwork().id);
                        _.each(prevGenLayouts, function(athena_layout) {
                            var obj = new LayoutModel(athena_layout.layoutName, "athena_" + algo.name,
                                                        athenaGenPrimaryOpts(athena_layout.layoutName, athena_layout.attrPrefix),
                                                        [], onSwitch , onRefresh, false);
                            obj.algoName = algo.name;
                            obj.isGenerated = true;
                            obj.networkId = networkService.getCurrentNetwork().id;
                            layouts.push(obj);
                        });
                    });
                }
                _.each(algos, function(algo) {
                    var options = _.cloneDeep(algo.options);
                    // init options here
                    _.each(options, function(opt) {
                        convert_athena_opts_to_graphStyle_opts(opt);
                        if(opt.default != null) {
                            if(algo.name == 'layout_clustered' && opt.key == 'clustering') {
                                opt.input_value = _.get($scope.mapprSettings, 'nodeColorAttr') || opt.default;
                            }
                            else {
                                opt.input_value = opt.default;
                            }
                        }
                    });
                    // build object
                    var obj = new LayoutModel(algo.title, "layout_generator_" + algo.name, options, [], onSwitch_Athena , onRefresh_Athena, true);
                    obj.algo = algo;
                    layouts.push(obj);
                });
            });

        // Init panel

        onFetched.finally(function() {
            initPanel();
            setupListeners();
            $scope.layouts = layouts;
        });
    }

    function setMediaAttrVars() {

        mediaAttrTypes = AttrInfoService.getMediaAttrTypes() || [];
        mediaAttrs = _.filter(dataGraph.getNodeAttrs(), function(attr) {
            return _.contains(mediaAttrTypes, attr.attrType) || attr.renderType == 'media';
        });
        firstMediaAttr = _.find(dataGraph.getNodeAttrs(), function(attr) {
            return _.contains(mediaAttrTypes, attr.attrType) || attr.renderType == 'media';
        });
        //attr for list
        firstRowAttr = _.find(dataGraph.getNodeAttrs(), function(attr) {
            var attrType = attr.attrType;
            return attrType == 'float' || attrType == 'integer' || attrType == 'string' || attrType == 'timestamp' || attrType == 'liststring';
        });
    }

    function layoutOptattrFilterFnBuilder(plotType, disable) {
        if(disable) {
            return layoutOptattrFilterByPass;
        }
        if(plotType === 'scatterplot') {
            return layoutOptattrFilterScatterPlot;
        } else if(plotType === 'grid') {
            return layoutOptattrFilterNodeCard;
        } else if(plotType === 'list') {
            return layoutOptattrFilterListRow;
        } else {
            return layoutOptattrFilterByPass;
        }
    }

    function layoutOptattrFilterScatterPlot (attr) {
        var allowedAttrTypes = ['float', 'integer', 'string', 'timestamp', 'year'];
        var attrType = attr.attrType;
        if(!attrType) { return false; }
        return _.contains(allowedAttrTypes, attrType);
    }

    function layoutOptattrFilterNodeCard (attr) {
        var attrType = attr.attrType;
        if(!attrType) { return false; }
        var mediaAttrTypes = AttrInfoService.getMediaAttrTypes() || [];
        // return _.contains(mediaAttrTypes.concat(['string']), attrType);
        return _.contains(mediaAttrTypes, attrType) || attr.renderType == 'media';
    }

    function layoutOptattrFilterListRow (attr) {
        var attrType = attr.attrType;
        if(!attrType) { return false; }
        // return _.contains(mediaAttrTypes.concat(['string']), attrType);
        return attrType == 'float' || attrType == 'integer' || attrType == 'string' || attrType == 'timestamp';
        // return _.contains(mediaAttrTypes, attrType) || attr.renderType == 'media';
    }
    function layoutOptattrFilterByPass() { return true; }

    function _hasLatLong() {
        var geoLayout = _.find($scope.layouts, 'plotType', 'geo');
        return _.find($scope.nodeAttrs, 'id', _.get(geoLayout, 'options.primary[0].input_value')) && _.find($scope.nodeAttrs, 'id', _.get(geoLayout, 'options.primary[1].input_value')) ? true : false;
    }

    // onSwitch for original / geo / scatter / grid
    function onSwitch(layout_model) {
        console.log('[LayoutPanelCtrl.onSwitch] called with layout_model: %O', layout_model);
        var layoutName = _.find(layout_model.options.primary, 'key', 'layoutName');
        var xAttrOpt = _.find(layout_model.options.primary, 'key', 'xAttr'),
            yAttrOpt = _.find(layout_model.options.primary, 'key', 'yAttr');
        var xAttr = layoutName ? layoutName.input_value + '_X' : (xAttrOpt ? xAttrOpt.input_value : 'OriginalX');
        var yAttr = layoutName ? layoutName.input_value + '_Y' : (yAttrOpt ? yAttrOpt.input_value : 'OriginalY');

        // athena generated layouts
        var athenaNamed = _.find(layout_model.options.primary, 'key', 'athena_attr_prefix');
        xAttr = athenaNamed ? athenaNamed.input_value + '_X' : xAttr;
        yAttr = athenaNamed ? athenaNamed.input_value + '_Y' : yAttr;

        var plotOps = {xAttr : xAttr, yAttr : yAttr};
        if(layout_model.plotType === 'scatterplot') {
            var scaleOpts = {
                xScaleType : _.find(layout_model.options.primary, 'key', 'xScaleType').input_value,
                xScaleExponent : parseFloat(_.find(layout_model.options.primary, 'key', 'xScaleExponent').input_value),
                xScaleBase : parseFloat(_.find(layout_model.options.primary, 'key', 'xScaleBase').input_value),

                yScaleType : _.find(layout_model.options.primary, 'key', 'yScaleType').input_value,
                yScaleExponent : parseFloat(_.find(layout_model.options.primary, 'key', 'yScaleExponent').input_value),
                yScaleBase : parseFloat(_.find(layout_model.options.primary, 'key', 'yScaleBase').input_value)
            };
            _.assign(plotOps, scaleOpts);
        } else if(layout_model.plotType === 'grid') {
            plotOps.gridAttr = _.find(layout_model.options.primary, 'key', 'renderAttr').input_value;
            plotOps.gridSortAttr = _.find(layout_model.options.primary, 'key', 'sortAttr').input_value;
            plotOps.listCompareIds = _.find(layout_model.options.primary, 'key', 'compareIds').input_value;
        } else if(layout_model.plotType === 'list') {
            plotOps.listAttrs = _.find(layout_model.options.primary, 'key', 'renderAttrs').input_value;
            // plotOps.listSortAttr = _.find(layout_model.options.primary, 'key', 'sortAttr').input_value;
            // plotOps.listSortReverse = _.find(layout_model.options.primary, 'key', 'sortReverse').input_value;
            plotOps.listSortAttrAr = _.find(layout_model.options.primary, 'key', 'listSortAttrAr').input_value;
            plotOps.listSortReverseAr = _.find(layout_model.options.primary, 'key', 'sortReverseAr').input_value;
            plotOps.listCompareIds = _.find(layout_model.options.primary, 'key', 'compareIds').input_value;
            plotOps.listColSizes = _.find(layout_model.options.primary, 'key', 'listColSizes').input_value;
            console.log('switching layout: ', plotOps.listSortAttrAr);
        }
        if($scope.layoutHelpers) {
            return $scope.layoutHelpers.switchGraph(layout_model.plotType, plotOps);
        }
    }
    // onRefresh for original / geo / scatter
    function onRefresh(layout_model) {
        console.log('[LayoutPanelCtrl.onRefresh] called with layout_model: %O', layout_model);
        var layout = $scope.layout;

        var athenaNamed = _.find(layout_model.options.primary, 'key', 'athena_attr_prefix');

        if(athenaNamed) {
            athenaNamed = athenaNamed.input_value;
            var name = _.find(layout_model.options.primary, 'key', 'layoutName').input_value;
            updateNameInProjectSettings (layout_model.algoName, name, athenaNamed);

            layout.setAttrX(athenaNamed + '_X');
            layout.setAttrY(athenaNamed + '_Y');

        } else if(layout_model.plotType === 'scatterplot') {
            layout.setAttrX(_.find(layout_model.options.primary, 'key', 'xAttr').input_value);
            layout.setAttrY(_.find(layout_model.options.primary, 'key', 'yAttr').input_value);

            layout.setScalerInfoX(_.find(layout_model.options.primary, 'key', 'xScaleType').input_value,
                        parseFloat(_.find(layout_model.options.primary, 'key', 'xScaleBase').input_value),
                        parseFloat(_.find(layout_model.options.primary, 'key', 'xScaleExponent').input_value));

            layout.setScalerInfoY(_.find(layout_model.options.primary, 'key', 'yScaleType').input_value,
                            parseFloat(_.find(layout_model.options.primary, 'key', 'yScaleBase').input_value),
                            parseFloat(_.find(layout_model.options.primary, 'key', 'yScaleExponent').input_value));
        } else if(layout_model.plotType === 'grid') {
            layout.gridAttr = _.find(layout_model.options.primary, 'key', 'renderAttr').input_value;
            layout.gridSortAttr = _.find(layout_model.options.primary, 'key', 'sortAttr').input_value;
            layout.listCompareIds = _.find(layout_model.options.primary, 'key', 'compareIds').input_value;
        }
        else if(layout_model.plotType == 'geo') {
            layout.setAttrX(_.find(layout_model.options.primary, 'key', 'xAttr').input_value);
            layout.setAttrY(_.find(layout_model.options.primary, 'key', 'yAttr').input_value);
        }
        else if(layout_model.plotType === 'list') {
            layout.listAttrs = _.find(layout_model.options.primary, 'key', 'renderAttrs').input_value;
            // layout.listSortAttr = _.find(layout_model.options.primary, 'key', 'sortAttr').input_value;
            // layout.listSortReverse = _.find(layout_model.options.primary, 'key', 'sortReverse').input_value;
            layout.listSortAttrAr = _.find(layout_model.options.primary, 'key', 'listSortAttrAr').input_value;
            layout.listSortReverseAr = _.find(layout_model.options.primary, 'key', 'sortReverseAr').input_value;
            layout.listCompareIds = _.find(layout_model.options.primary, 'key', 'compareIds').input_value;
            layout.listColSizes = _.find(layout_model.options.primary, 'key', 'listColSizes').input_value;
            console.log('refreshing layout: ', layout);
        }
        return $scope.layoutHelpers.refreshLayout($scope.layout);
    }

    function onDelete (layout_model) {
        if(layout_model.isGenerated) {
            var athenaNamed = _.find(layout_model.options.primary, 'key', 'athena_attr_prefix');
            if(athenaNamed) {
                athenaNamed = athenaNamed.input_value;
                var name = _.find(layout_model.options.primary, 'key', 'layoutName').input_value;
                var deleted = deleteLayoutInProjectSettings(layout_model.algoName, name, athenaNamed);
                if(deleted) {
                    var idx = _.findIndex(layouts, 'name', layout_model.name);
                    console.assert(idx >= 0 ,"layout should exist in the layouts listing");
                    layouts.splice(idx,1);
                }
                if(deleted && layout_model.isCurrent) {
                    layout_model.isCurrent = false;
                    layouts[0].isCurrent = true;
                    layouts[0].makeCurrent();
                }
            }
        } else {
            console.error("Can't be deleted! layout_model:", layout_model.name);
        }
    }

    // Switcher for athena Algos
    function onSwitch_Athena(layout_model) {
        console.log('[LayoutPanelCtrl.onSwitch_Athena] called with layout_model: %O', layout_model);
        // var layoutName = _.find(layout_model.options.primary, 'key', 'layoutName');
        // if( layoutName ) {   // switch to layout if it is a named layout
        //  var xAttr = layoutName.input_value + '_X';
        //  var yAttr = layoutName.input_value + '_Y';
        //  if( dataGraph.isNodeAttr(xAttr) && dataGraph.isNodeAttr(yAttr)) {
        //      return $scope.layoutHelpers.switchGraph(layout_model.plotType, {xAttr : xAttr, yAttr : yAttr});
        //  }
        // }
    }

    // refresher for athena Algos
    function onRefresh_Athena(layout_model) {
        console.log('[LayoutPanelCtrl.onRefresh_Athena] called with layout_model: %O', layout_model);
        var networkId = networkService.getCurrentNetwork().id;
        var runOptions = _.reduce(layout_model.options.primary, function(acc, opt) {
            acc[opt.key] = opt.input_value;
            return acc;
        }, {});

        console.log('Running algo: %O with options : %O, on network: %s', layout_model.algo, runOptions ,networkId);

        return athenaService.run_algorithm(layout_model.algo, _getSanitizedAlgoOpts(layout_model.algo, runOptions), null, networkId)
        .then(function() {
            return networkService.fetchProjectNetwork(networkId);
        })
        .then(function(network) {
            var nw = dataGraph.mergeAndLoadNetwork(network);
            AttrInfoService.loadInfoForNetwork(network);
            return nw;
        })
        .then(function() {
            var algo = layout_model.algo;
            var layoutName = _.find(layout_model.options.primary, 'key', 'layoutName').input_value;
            var genLayoutName = layoutName; //algo.title + ' | ' + layoutName;

            // if a previous layout with the same attr prefix exists, then simply switch to it, otherwise create a new one and add it

            var layoutToSwitch = _.find(layouts, { name : genLayoutName});
            if(!layoutToSwitch) {
                // generate a new layout and save it to the project
                layoutToSwitch = new LayoutModel(genLayoutName, "athena_" + algo.name, athenaGenPrimaryOpts(genLayoutName, layoutName),
                                            [], onSwitch , onRefresh);
                layoutToSwitch.algoName = algo.name;
                layoutToSwitch.isGenerated = true;
                layoutToSwitch.networkId = networkService.getCurrentNetwork().id;
                layoutToSwitch.isBuilder = false;
                layouts.splice(-2, 0, layoutToSwitch);

                // update proj settings
                addLayoutToProjectSettings(algo.name, genLayoutName, layoutName, networkId);
            }
            return $timeout(function() {
                _.find(layouts, 'isCurrent', true).isCurrent = false;
                layoutToSwitch.isCurrent = true;
                return layoutToSwitch.makeCurrent();
            });
            // return $scope.layoutHelpers.switchGraph(layout_model.plotType, {
            //  xAttr : xAttr,
            //  yAttr : yAttr
            // });
        });
    }

    function updateNameInProjectSettings (algoName, layoutName, attrPrefix) {
        var projSettings = projFactory.getProjectSettings();
        var updated = false;
        _.each(_.get(projSettings, 'layouts.' + algoName), function(layoutSettings) {
            if( layoutSettings.attrPrefix === attrPrefix &&
                    layoutSettings.layoutName !== layoutName &&
                    layoutName.length > 0 ) {
                layoutSettings.layoutName = layoutName;
                updated = true;
            }
        });
        if(updated) {
            $timeout(function() { return projFactory.updateProjectSettings(projSettings);});
        }
        return updated;
    }

    function addLayoutToProjectSettings (algoName, layoutName, attrPrefix, networkId) {
        var projSettings = projFactory.getProjectSettings();
        var list = _.get(projSettings, 'layouts.' + algoName) || [];
        list.push({
            'layoutName' : layoutName,
            attrPrefix : attrPrefix,
            networkId : networkId
        });
        _.set(projSettings, 'layouts.' + algoName, list);
        return $timeout(function() { return projFactory.updateProjectSettings(projSettings);});
    }
    function deleteLayoutInProjectSettings (algoName, layoutName, attrPrefix) {
        var projSettings = projFactory.getProjectSettings();
        var list = _.get(projSettings, 'layouts.' + algoName) || [];
        var exists = _.any(list, 'attrPrefix', attrPrefix);
        if(exists) {
            _.set(projSettings, 'layouts.' + algoName, _.reject(list, 'attrPrefix', attrPrefix));
            $timeout(function() { return projFactory.updateProjectSettings(projSettings);});
        } else {
            console.warn("Layout %s does not exist in layoutDirectory", layoutName);
        }
        return exists;
    }

    function setCurrentPanel () {
        //(layout.plotType == 'layout_generator_layout_clustered' && layoutPanel.focusLayout.plotType == 'layout_clustered')
        _.each(layouts, function(l) {
            l.isCurrentPanel = false;
        });
        var plotType = $scope.layoutPanel.focusLayout.plotType;
        if(plotType == 'original' || plotType == 'athena_layout_clustered') {
            _.find(layouts, {plotType: 'layout_generator_layout_clustered'}).isCurrentPanel = true;
        } else {
            $scope.layoutPanel.focusLayout.isCurrentPanel = true;
        }
        console.log('setting current panel');

        $rootScope.$broadcast(BROADCAST_MESSAGES.layout.layoutModelChanged, {
            layout: $scope.layoutPanel.focusLayout
        });
    }

    // function setFirstClustered() {
    //     _.find(layouts, {plotType: 'original'}).isPanel = true;
    // }


    function convert_athena_opts_to_graphStyle_opts(opt) {
        opt.class = 'stage-setting';
        opt.tooltip = opt.description;
        opt.enabled = true;
    }
    // athena generated algo have this primary attribute, which is used to find out the correct x,y positions
    function athenaGenPrimaryOpts (layoutName, attrPrefix) {
        return [
            {
                key: "layoutName",
                title: "Layout Name",
                tooltip: "Name for this layout",
                type: "text-input",
                class: 'node-setting',
                input_value : layoutName,
                enabled: true
            },{
                key: 'athena_attr_prefix',
                title: 'Attribute Prefix',
                type: 'attr-select',
                class: 'node-setting',
                tooltip: 'Attribute prefix for gen layouts',
                input_value : attrPrefix,
                enabled: false
            }
        ];
    }


    function initPanel() {
        console.log("Initializing layout Panel");

        // //get new attrs in case render type changed
        $scope.nodeAttrs = dataGraph.getNodeAttrs();

        // if layoutPanel did not trigger change
        if(!layoutPanel.triggeredChange) {
            var foundLayouts = _.filter(layouts, 'plotType', $scope.layout.plotType);

            if(foundLayouts.length > 1) {
                console.assert(_.all(foundLayouts, 'isGenerated', true), "Layouts should be generated");
                var attrPrefixes = _.pluck(foundLayouts, "options.primary[1].input_value");
                console.log('attrPrefixes: ', attrPrefixes);
                var needLayoutIdx = _.findIndex(attrPrefixes, function(prefix) { return $scope.layout.attr.x.startsWith(prefix);});
                layoutPanel.focusLayout = foundLayouts[needLayoutIdx];
            } else {
                layoutPanel.focusLayout = foundLayouts[0];
            }

                //to set non-focusLayouts -> non-isCurrent
            _.map(layouts, function(lt){
                if(lt.name !== layoutPanel.focusLayout.name){lt.isCurrent = false;}
                return lt;
            });

            layoutPanel.focusLayout.isCurrent = true;
            layoutPanel.focusLayout.isInitialized = true;

            //setup current cluster layout if one and then set current panel to cluster panel if
            //the current layout is a cluster layout
            if(layoutPanel.focusLayout.plotType == 'athena_layout_clustered') {
                currentClusterLayout = layoutPanel.focusLayout.name;
            }
            setCurrentPanel();
        }

        if(layoutPanel.focusLayout.plotType === 'scatterplot') {
            layoutPanel.disableScatterplotWatch = !layoutPanel.triggeredChange;
            var xAttr = _.find(layoutPanel.focusLayout.options.primary, 'key', 'xAttr');
            var yAttr = _.find(layoutPanel.focusLayout.options.primary, 'key', 'yAttr');
            xAttr.input_value = $scope.layout.attr.x;
            yAttr.input_value = $scope.layout.attr.y;
            _.find(layoutPanel.focusLayout.options.primary, 'key', 'xScaleType').input_value = $scope.layout.scalers.x_scaler_info.scalerType || 'linear';
            _.find(layoutPanel.focusLayout.options.primary, 'key', 'xScaleExponent').input_value = $scope.layout.scalers.x_scaler_info.exponent || 2;
            _.find(layoutPanel.focusLayout.options.primary, 'key', 'xScaleBase').input_value = $scope.layout.scalers.x_scaler_info.base || 10;

            _.find(layoutPanel.focusLayout.options.primary, 'key', 'yScaleType').input_value = $scope.layout.scalers.y_scaler_info.scalerType || 'linear';
            _.find(layoutPanel.focusLayout.options.primary, 'key', 'yScaleExponent').input_value = $scope.layout.scalers.y_scaler_info.exponent || 2;
            _.find(layoutPanel.focusLayout.options.primary, 'key', 'yScaleBase').input_value = $scope.layout.scalers.y_scaler_info.base || 10;
        } else if(layoutPanel.focusLayout.plotType === 'grid') {

            var renderAttr = _.find(layoutPanel.focusLayout.options.primary, 'key', 'renderAttr');
            renderAttr.input_value = $scope.layout.gridAttr;
            var sortAttr = _.find(layoutPanel.focusLayout.options.primary, 'key', 'sortAttr');
            sortAttr.input_value = $scope.layout.gridSortAttr;

            var compareIds = _.find(layoutPanel.focusLayout.options.primary, 'key', 'compareIds');
            compareIds.input_value = $scope.layout.listCompareIds;
        } else if(layoutPanel.focusLayout.plotType === 'list') {
            //close layout panel if list since everything for list is done in header
            if($scope.panelUI.layoutPanelOpen) {
                $scope.panelUI.openPanel('info');
            }
            var renderAttrs = _.find(layoutPanel.focusLayout.options.primary, 'key', 'renderAttrs');
            renderAttrs.input_value = $scope.layout.listAttrs;
            // var sortAttr = _.find(layoutPanel.focusLayout.options.primary, 'key', 'sortAttr');
            // sortAttr.input_value = $scope.layout.listSortAttr;
            // var sortReverse = _.find(layoutPanel.focusLayout.options.primary, 'key', 'sortReverse');
            // sortReverse.input_value = $scope.layout.listSortReverse;

            var listSortAttrAr = _.find(layoutPanel.focusLayout.options.primary, 'key', 'listSortAttrAr');
            listSortAttrAr.input_value = $scope.layout.listSortAttrAr;
            var sortReverseAr = _.find(layoutPanel.focusLayout.options.primary, 'key', 'sortReverseAr');
            sortReverseAr.input_value = $scope.layout.listSortReverseAr;

            var compareIds = _.find(layoutPanel.focusLayout.options.primary, 'key', 'compareIds');
            compareIds.input_value = $scope.layout.listCompareIds;

            var listColSizes = _.find(layoutPanel.focusLayout.options.primary, 'key', 'listColSizes');
            listColSizes.input_value = $scope.layout.listColSizes;
        }
        layoutPanel.triggeredChange = false;

        //finally, broadcast layouts for layout toggle
        $rootScope.$broadcast(BROADCAST_MESSAGES.layout.layoutsLoaded, {
            layouts:layouts
        });
    }

    function _getSanitizedAlgoOpts(algo, opts) {
        if(algo.title == 'Cluster') {
            if(isNaN(parseFloat(opts.clumpiness))) { throw new Error("Invalid value for float parsing"); }
            opts.clumpiness = parseFloat(opts.clumpiness);
        }
        return opts;
    }

}]);
