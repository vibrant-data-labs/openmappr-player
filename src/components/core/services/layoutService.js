/**
* Provides layout builders(scatterplot, geo, grid n cluster) & other layout related ops
*/
angular.module('common')
.service('layoutService', ['$q', 'dataGraph', 'renderGraphfactory','AttrInfoService' ,'leafletData', 'partitionService',
function($q, dataGraph, renderGraphfactory,AttrInfoService, leafletData, partitionService) {
    "use strict";



    /*************************************
    *************** API ******************
    **************************************/
    this.getNodeColorAttrs =  getNodeColorAttrs;
    this.getNodeSizeAttrs =  getNodeSizeAttrs;
    this.getEdgeColorAttrs =  getEdgeColorAttrs;
    this.getEdgeSizeAttrs =  getEdgeSizeAttrs;
    this.getLayoutPanelAttrs = getLayoutPanelAttrs;
    this.getGroupAttr = getGroupAttr;
    this.getSubgroupAttr = getSubgroupAttr;
    this.MAX_COLOR_ITEMS = MAX_COLOR_ITEMS;
    this.hasRenderSettingsChanged = hasRenderSettingsChanged;
    this.invalidateCurrent = invalidateCurrent; //Invalidate the current layout, useful if changing layouts.
    this.serializeCurrent = serializeCurrent; // Layout Serialization

    this.getCurrent = getCurrentLayout;
    this.getCurrentIfExists = function() { return _currLayout; };

    this.getCurrentOrCreateDefault = getCurrentOrCreateDefault;

    this.setCurrent = setCurrent;
    //
    //Layout Builders
    //
    this.buildLayoutForSnapshot = buildLayoutForSnapshot;
    //Creates a new layout of given type.
    this.createDefault = createDefaultLayout;
    this.ScaleBuilder = ScaleBuilder





    /*************************************
    ********* CLASSES ********************
    **************************************/
    /**
     * A scale builder for numeric values. eg : nodeColor / nodeSize
     * these are top level instances to manage scaler builders
     * @param {[type]}  prefix  [description]
     * @param {Boolean} isColor [description]
     */
    function ScaleBuilder (prefix) {
        this.prefix = prefix;
        this.isColor = prefix.endsWith('Color') || prefix === 'nodeCluster';
        this.isEdge = prefix.startsWith('edge');
        this.defaultValues = {};
        this.defaultValues[prefix + 'Strat'] = 'attr'; // 'select' for manual selection
        this.defaultValues[prefix + 'Attr'] = 'OriginalColor';
        this.defaultValues[prefix + 'ScaleStrategy'] = 'linear'; // 'log' / 'exponential'
        this.defaultValues[prefix + 'ScaleInvert'] = false;
        this.defaultValues[prefix + 'ScaleExponent'] = 2.5;
        this.defaultValues[prefix + 'ScaleBase'] = 10;

        this.defaultValues[prefix + 'NumericDomain'] = 'from_data'; // 'manual'
        this.defaultValues[prefix + 'NumericDomainMin'] = 0;
        this.defaultValues[prefix + 'NumericDomainMax'] = 100;
        if(this.isColor) {
            this.defaultValues[prefix + 'DefaultValue'] = colorStr([200, 200, 200]); // used in manual coloring
            this.defaultValues[prefix + 'CycleCategoryColors'] = true;
            this.defaultValues[prefix + 'PaletteNumeric'] = [{col:"#ee4444"}, {col:"#3399ff"}]; // color mapping
            this.defaultValues[prefix + 'PaletteOrdinal'] = [{col:"#ee4444"}, {col:"#cc6600"}, {col:"#0099ff"}, {col:"#ffcc00"}, {col:"#66cccc"}, {col:"#99cc00"}, {col:"#993399"},
                                      {col:"#b23333"}, {col:"#994c00"}, {col:"#0073bf"}, {col:"#bf9900"}, {col:"#4c9999"}, {col:"#739900"}, {col:"#732673"}];

            this.defaultValues[prefix + 'NumericScalerType'] = 'HCL Long'; // 'RGB', 'HSL' , 'HSL Long', 'LAB', 'HCL', 'HCL Long', 'Cubehelix', 'Cubehelix Long'

        } else {
            this.defaultValues[prefix + 'DefaultValue'] = 7; // used in manual option
            this.defaultValues[prefix + 'Min'] = 4;
            this.defaultValues[prefix + 'Max'] = 15;
            this.defaultValues[prefix + 'Multiplier'] = 1;
            this.defaultValues[prefix + 'PartitionEnabled'] = false;
            this.defaultValues[prefix + 'PartitionAttr'] = 'Cluster';
        }

        this.keys = _.keys(this.defaultValues);
    }
    ScaleBuilder.prototype.updateDefaultValues = function(new_values) {
        var prefix = this.prefix,
            objToMerge = _.mapKeys(new_values, function(val, key) { return prefix + key;});
        return _.assign(this.defaultValues, objToMerge);
    };
    // ScaleBuilder.prototype.updateFromMapprSettings = function(mapprSettings) {
    //  return this.updateDefaultValues(_.pick(mapprSettings, this.keys));
    // };
    ScaleBuilder.prototype.injectSettings = function(mapprSettings) {
        _.assign(mapprSettings, this.defaultValues);
    };
    ScaleBuilder.prototype.injectDataGraphSettings = function(dataGraphSettings) {
        dataGraphSettings.push.apply(dataGraphSettings, this.keys);
    };
    ScaleBuilder.prototype.extractValues = function(mapprSettings) {
        var indexToSlice = this.prefix.length;
        return _.mapKeys(_.pick(mapprSettings, this.keys), function(val, key) {
            return key.slice(indexToSlice);
        });
    };
    ScaleBuilder.prototype._getInfo = function(mapprVals) {
        return this.isEdge ? AttrInfoService.getLinkAttrInfoForRG().getForId(mapprVals.Attr) : AttrInfoService.getNodeAttrInfoForRG().getForId(mapprVals.Attr);
    };
    // returns a scaler which takes 2 arguments
    // 1 -> the attribute val for mapprVals.Attr
    // 2 -> the attribute val to mapprVals.PartitionAttr
    ScaleBuilder.prototype.genScale = function (mapprSettings) {
        // console.time(logPrefix + '[ScaleBuilder.prototype.genScale] ' + this.prefix + ' call');
        var res = this._genScale(mapprSettings);
        // console.timeEnd(logPrefix + '[ScaleBuilder.prototype.genScale] ' + this.prefix + ' call');
        return res;
    };
    ScaleBuilder.prototype._genScale = function(mapprSettings) {
        var mapprVals = this.extractValues(mapprSettings);
        var defFun = _.constant(mapprVals.DefaultValue);

        var rawData = dataGraph.getRawDataUnsafe();
        if(mapprVals.Strat === 'select' || mapprVals.Strat === 'fixed') {
            return defFun;
        } else {
            // check if entities exist, otherwise move to default scaler
            if((this.isEdge && rawData.isEdgesEmpty()) ||
                (!this.isEdge && rawData.isEmpty())) {
                return defFun;
            }
            var attrInfo = this._getInfo(mapprVals);
            if(!attrInfo) {
                console.warn('Building %s Scaler: AttributeInfo Not found for :%s, %O', this.prefix, mapprVals.Attr, mapprVals);
                return defFun;
            }
            // finally build the scalers
            if(this.isColor && attrInfo.attr.attrType === 'color') {
                return _.identity;
            } else {
                if(mapprVals.PartitionEnabled) {
                    var partitionedInfos = partitionService.genPartitionedNodeAttrInfos_light(rawData.nodes, mapprVals.Attr, mapprVals.PartitionAttr);
                    // console.log("$$$ PARTITIONED: ", partitionedInfos);
                    return this._genPartitionedScale(mapprVals, partitionedInfos);
                } else {
                    if(attrInfo.isNumeric) {
                        return this._genNumericScale(mapprVals, attrInfo);
                    } else {
                        return this._genOrdinalScale(mapprVals, attrInfo);
                    }
                }
            }
        }
    };
    // generate a scale for these settings
    ScaleBuilder.prototype._genNumericScale = function(mapprVals, attrInfo) {
        // var mapprVals = this._extractValues(mapprSettings);
        // var attrInfo = this._getInfo(mapprVals);
        if(!this.isColor) {
            if(mapprVals.Min > mapprVals.Max) {
                mapprVals.Min = mapprVals.Max;
            }
        }
        //console.log('[layoutService] Building numeric %s Scaler for attrInfo: %O, mapprVals: %O',this.prefix, attrInfo, mapprVals);

        var bounds = attrInfo.bounds,
            shiftInputVal = false,
            shiftInputValBy = 0,
            scaler = _.identity;

        var domain = null;
        if(mapprVals.NumericDomain === 'from_data') {
            domain = [bounds.min, bounds.max];
        } else {
            domain = [parseFloat(mapprVals.NumericDomainMin),
                        parseFloat(mapprVals.NumericDomainMax)];
        }

        if(Math.abs(domain[0] - domain[1]) <= 0) {
            // same number values for all nodes
            scaler = _.constant(mapprVals.DefaultValue);
        } else {

            var range = null;

            switch(mapprVals.ScaleStrategy) {
            case 'linear'      : scaler = d3.scale.linear();
                break;
            case 'log'         :
                scaler = d3.scale.log().base(+mapprVals.ScaleBase); // log is handled differently. seen `if`
                if(domain[0] < 1 && domain[1] >= 1) {
                    shiftInputVal = true;
                    shiftInputValBy = (-1 * domain[0]) + 1;

                    domain[1] = domain[1] + shiftInputValBy;
                    domain[0] = 1;
                }
                break;
            case 'exponential' : scaler = d3.scale.pow().exponent(+mapprVals.ScaleExponent);
                break;
            default            : scaler = d3.scale.linear();
                break;
            }

            if(mapprVals.ScaleInvert === true) {
                domain = domain.reverse();
            }

            scaler.domain(domain);

            if(this.isColor) {
                var interpolator = interpolatorForScaler[mapprVals.NumericScalerType];
                range = _.map(_.map(mapprVals.PaletteNumeric, 'col'), function(col) { return d3.rgb(col); });
                scaler
                .range(range)
                .interpolate(interpolator)
                .clamp(true);
            } else {
                range = [mapprVals.Min, mapprVals.Max];
                scaler.range(range);
            }
            if(shiftInputVal) {
                //log fails if the bounds contain zero, since log 0 is infinity. So move bounds to solve this issue
                var oldScaler = scaler;
                scaler = function (val) {
                    return oldScaler(val + shiftInputValBy);
                };
            }
        }
        return scaler;
    };
    ScaleBuilder.prototype._genOrdinalScale = function(mapprVals, attrInfo) {
        // var mapprVals = this._extractValues(mapprSettings);
        // var attrInfo = this._getInfo(mapprVals);
        var isTag = attrInfo.isTag,
            attrId = mapprVals.Attr;

        if(!this.isColor) {
            if(mapprVals.Min > mapprVals.Max) {
                mapprVals.Min = mapprVals.Max;
            }
        }
        console.log('Building %s Scaler for attrInfo: %O, mapprVals: %O', this.prefix, attrInfo, mapprVals);

        //Ordinal Scaling
        var values = attrInfo.values;
        if(isTag) {
            // generate a list of node tags sorted in descending order
            values = _(attrInfo.nodeValsFreq)
                .pairs()
                .sortBy(_.last)
                .map(_.head)
                .reverse()
                .value();
        }
        var scaler = null;
        if(this.isColor) {
            var palette = mapprVals.PaletteOrdinal;
            var cycle = mapprVals.CycleCategoryColors;
            var defaultColor = mapprVals.defaultVal;
            var colorCount = palette.length;

            scaler = function(value) {
                if(isTag && value === "others" && attrId === "mappr_groups") {
                    return defaultColor;
                }

                var idx = values.indexOf(value);
                var desat = Math.floor(idx/colorCount);
                idx %= colorCount;
                if(idx < 0 || (!cycle && desat > 0)) {
                    return defaultColor;
                }
                var color = palette[idx].col;
                if( desat > 0 ) {
                    var hsl = d3.hsl(color);
                    while( desat-- > 0 ) {
                        hsl.s *= 0.6;
                    }
                    color = hsl.toString();
                }
                return color;
            };
        } else {
            scaler = d3.scale.ordinal()
                .domain(values)
                .rangePoints([mapprVals.Min, mapprVals.Max]);
        }

        return scaler
    };
    ScaleBuilder.prototype._genPartitionedScale = function(mapprVals, partitionedInfos) {
        // generate scalers for each partition
        var scalers = _.mapValues(partitionedInfos, function genIndividualScales (partitionInfo) {
            if(partitionInfo.isNumeric) {
                return this._genNumericScale(mapprVals, partitionInfo);
            } else {
                return this._genOrdinalScale(mapprVals, partitionInfo);
            }
        }, this);
        // the common scaler
        return function parititionedScaler (val, partitionVal) {
            return scalers[partitionVal] ? scalers[partitionVal](val) : mapprVals.DefaultValue;
        };

    };




    /*************************************
    ********* Local Data *****************
    **************************************/
    // var logPrefix = '[layoutService] ';

    var colorStr = window.mappr.utils.colorStr;
        // limitValue = window.mappr.utils.limitValue;

    var marginRt = 40, marginLeft = 40, marginTop = 0, marginBtm = 40, scatterplotMarginBtm = 200;
    var offsetX = (marginRt - marginLeft)/2;
    var offsetY = (marginTop - marginBtm)/2;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.marginX = (marginRt + marginLeft);
    this.marginY = (marginTop + marginBtm);
    var scatterplotOffsetY = (marginTop + 80 - scatterplotMarginBtm)/2; // giant axis at bottom
    this.scatterplotOffsetY = scatterplotOffsetY;

    var MAX_COLOR_ITEMS = 50;

    var dataGraphSettings = [
        'numZoomLevels',
        'zoomStepScale',
        'disableAggregationLevel',
        'disableAggregation',
        'aggregationWidth',
        'aggregationHeight',
        'aggNodeMinSize',
        'aggNodeMaxSize',
        'invertX',
        'invertY',
        'scatterAspect',
        'bigOnTop',
        'nodeUserColorMap',
        'nodeColorDensityStrategy',
        'nodeColorDensityAttr',
        'nodeColorDensity',
        'nodeColorDensityOrder',
        'edgeUserColorMap'
    ];

    // Assign settings to service instance
    this.dataGraphSettings =  dataGraphSettings;

    const interpolate = require('d3-interpolate');

    // scaler factory
    var interpolatorForScaler = {
        'RGB'            : interpolate.interpolateRgb,
        'HSL'            : interpolate.interpolateHsl,
        'HSL Long'       : interpolate.interpolateHslLong,
        'LAB'            : interpolate.interpolateLab,
        'HCL'            : interpolate.interpolateHcl,
        'HCL Long'       : interpolate.interpolateHclLong,
        'Cubehelix'      : interpolate.interpolateCubehelix,
        'Cubehelix Long' : interpolate.interpolateCubehelixLong
    };

    //The current layout
    var _currLayout = null;//createDefaultLayout('original');
    var layoutDefer = $q.defer();
    //layoutDefer.resolve(_currLayout);

    // mapprSettings version
    // 1 - pre version code
    // 2 - scale builder creation and attribute normalization
    var defaultOriginalLayout = {
        plotType: 'original',
        settings: {
            version : 1.1,

            //NODES
            drawNodes: true,
            drawSelectedInHover: true,
            borderRatio: 0.15,      // radius to border ratio
            bigOnTop: false,        // sort order
            nodeImageShow : false,
            nodeImageAttr : 'Picture',
            //colors
            invalidNodeColor: colorStr([250, 250, 250]),
            nodeUserColorMap: {},
            nodeOpacity: 1,
            nodeOpacityAttr: 'OriginalSize',
            nodeOpacityStrategy: 'fixed',
            nodeUnselectedOpacity: 0.25,

            nodeColorDensityStrategy: 'fixed',
            nodeColorDensityAttr: 'OriginalSize',
            nodeColorDensity: 1,
            nodeColorDensityOrder: true,

            //Highlight
            nodeHighlightRatio:1.2,
            nodeHighlightBorderOffset: 6,           //offset from node size
            nodeHighlightBorderWidth: 1,
            nodeHighlightColorStrategy: 'node-color-light', //'node-color-dark', 'node-color-inverse', 'highlight-color'
            nodeHighlightColor: colorStr([200,0,0]),
            //Select
            nodeSelectionRatio:1.2,
            nodeSelectionBorderOffset: 0,           //offset from node size
            nodeSelectionBorderWidth: 3,
            nodeSelectionColorStrategy: 'node-color-light', //'node-color-dark', 'node-color-inverse', 'highlight-color'
            nodeSelectionColor: colorStr([200,0,0]),
            nodeSelectionDegree: 1,

            //Pop
            nodePopSize: 2,
            nodePopImageShow: true,
            nodePopImageAttr: 'Image',
            nodePopMenuShow: false,
            nodePopMenuFuncs: ['afunc','bfunc','cfunc'],
            nodePopShow: false,
            nodePopDelay: 1500,
            nodePopTriggerContext: 'hover', //'hover','click'
            nodePopReleaseContext: 'hover-out', //'hover-out', 'click-out'
            nodePopRepositionNeighbors: false,
            //Focus
            nodeFocusShow: true,
            nodeFocusContext: 'click',
            nodeFocusRenderTemplate: 'node-right-panel',     //'orbit', 'scroll', 'slideshow', 'content'
            nodeFocusShowNeighbors: true,
            nodeFocusNeighborsButton: true,
            nodeFocusNeighborsBefore: null,
            nodeFocusTextLength: 100,

            showNodeDetailOnLoad: false, // load node focus + node overlay for snap

            //aggregates
            disableAggregationLevel : 10,
            disableAggregation : true,
            aggregationWidth: 10,
            aggregationHeight: 10,
            aggNodeSizeScale: 1,
            aggNodeMinSize: 6,
            aggNodeMaxSize: 30,
            aggNodeRenderStyle: 'full-donut', //thin-donut, thick-donut
            aggNodeShowCount: false,
            aggNodeBackgroundColor: '#ffffff',

            testSignificance: false,

            //EDGES
            drawEdges: true,
            edgeCurvature: 0,
            edgePath: true,
            //thickness/size
            edgeDirectional: false,
            edgeTaper: false,
            edgeTaperScale: 0.5,

            edgeUserColorMap: {},
            edgeSaturation: 1.0,
            edgeUnselectedOpacity: 0.2,
            edgeDirectionalRender: "all", // incoming / outgoing / all

            //LABELS
            drawLabels: true,
            drawEdgeLabels: false,
            drawGroupLabels: false,
            //color
            labelColor: '#000000',//colorStr([0, 0, 0]),
            labelOutlineColor : '#ffffff', //colorStr([255, 255, 255]),
            //size
            labelSize: 'proportional', //'fixed' or 'proportional' or 'fixed-proportional'
            labelScale: 1, // 0-1
            labelSizeRatio: 0.5, // for proportional display only
            defaultLabelSize: 12, // for fixed display only
            minLabelSize: 12,
            maxLabelSize: 16,
            //display
            labelDisplayStrat: 'topXSizeCollision', // 'threshold' or 'topx'.
            //threshold strat : The minimum size a node must have to see its label displayed. type: number
            // topx strat: Nodes sorted and only the top X number of nodes are picked to show labels.
            labelThreshold: 1,
            labelMaxCount: 300,
            //events
            labelDefaultShow: true,
            labelAttr: 'OriginalLabel', // The label attrib to show.
            labelHoverAttr: 'OriginalLabel', //attrName
            labelClickAttr: 'OriginalLabel', //attrName
            labelDegree: 0, //DISCONTINUE // Covered in hover show and click show // 0 -> selected node only, 1 -> 1st degree neighbors, 2-> 2nd degree neighbor
            labelOpacity: 1,
            labelUnselectedOpacity: 0, //0-1

            //APP THEME
            theme: 'light',

            //STAGE
            backgroundColor: '#ffffff',//'rgb(255,255,255)',
            backgroundImage: '',
            showBackgroundImage: false,
            backgroundSize: 'cover',
            backgroundPosition: '50%',
            zoomLock: false,
            panLock: false,
            pinRightPanel: true,
            //camera
            maxZoomLevel : 10,//Number of zoom levels to generate
            minZoomLevel  : -10,// Minimum zoom level. determines how much you can zoom into the graph
            savedZoomLevel : 0,// the stored zoom level for the graph.
            zoomingRatio : 1.7,
            mouseZoomDuration: 500,
            //legend
            legendAutoOpen: true,
            hideLegend: false,
            globalLegendOn: true,
            entityLegendOn: true,
            legendTitle: "",
            legendTitleTooltip: "",
            showGlobalNodesLegend: true,
            showGlobalEdgesLegend: true,
            showEntityNodesLegend: true,
            showEntityEdgesLegend: true,
            //Link Mapping
            enableLinkMapping: true,
            legendSortOption: 'frequency',
            legendSortIsReverse: true,

            // Legend
            // legendColorCustomiserNode : {}, // { 'attrTitle': { 'value' : {'label': String, 'position': Nuber}}}
            // legendColorCustomiserEdge : {}, // { 'attrTitle': { 'value' : {'label': String, 'position': Nuber}}}
            //LAYOUTS
            //axes
            xAxShow: false,
            yAxShow: false,
            xAxTickShow: false,
            yAxTickShow: false,
            xAxLabel: "",
            yAxLabel: "",
            xAxTooltip: "",
            yAxTooltip: "",
            //xy
            invertX: false,
            invertY: true,
            scatterAspect: 0.5,
            //Geo mapbox settings
            mapboxMapID: 'mapbox/light-v10',

            //
            nodeOnHover: 'expand', //'expand', 'select', 'pop', 'focus'
            nodeOnClick: 'select', //'expand', 'select', 'pop', 'focus'
            nodeOnDblClick: 'select' //'expand', 'select', 'pop', 'focus'
        },

        xaxis: null,
        yaxis: null,
        x_scaler_type :  'linear',
        x_scaler_base :  2,
        x_scaler_exponent :  2,

        y_scaler_type :  'linear',
        y_scaler_base :  2,
        y_scaler_exponent :  2
    };

    var nodeSizeScaleBuilder = new ScaleBuilder('nodeSize'),
        nodeColorScaleBuilder = new ScaleBuilder('nodeColor'),
        nodeClusterScaleBuilder = new ScaleBuilder('nodeCluster'),
        edgeSizeScaleBuilder = new ScaleBuilder('edgeSize'),
        edgeColorScaleBuilder = new ScaleBuilder('edgeColor');

    nodeSizeScaleBuilder.injectDataGraphSettings(dataGraphSettings);
    nodeColorScaleBuilder.injectDataGraphSettings(dataGraphSettings);
    nodeClusterScaleBuilder.injectDataGraphSettings(dataGraphSettings);
    edgeSizeScaleBuilder.injectDataGraphSettings(dataGraphSettings);
    edgeColorScaleBuilder.injectDataGraphSettings(dataGraphSettings);

    // nodeSize defaults
    nodeSizeScaleBuilder.updateDefaultValues({
        'Attr' : 'OriginalSize'
    });
    // node Color defaults
    nodeColorScaleBuilder.updateDefaultValues({
        'Attr' : 'OriginalColor'
    });

    nodeClusterScaleBuilder.updateDefaultValues({
        'Attr' : 'OriginalColor'
    });

    edgeSizeScaleBuilder.updateDefaultValues({
        'Attr' : 'OriginalSize',
        'Strat' : 'fixed', // fixed or attr
        'DefaultValue' : 0.2,
        'Min' : 0.1,
        'Max' : 10
    });
    edgeColorScaleBuilder.updateDefaultValues({
        'Attr' : 'OriginalColor',
        'Strat' : 'gradient' //source, target, attr, default

    });


    nodeSizeScaleBuilder.injectSettings(defaultOriginalLayout.settings);
    nodeColorScaleBuilder.injectSettings(defaultOriginalLayout.settings);
    nodeClusterScaleBuilder.injectSettings(defaultOriginalLayout.settings);
    edgeSizeScaleBuilder.injectSettings(defaultOriginalLayout.settings);
    edgeColorScaleBuilder.injectSettings(defaultOriginalLayout.settings);

    //
    // Default settings for scatterplot
    //
    var defaultScatterPlot = _.cloneDeep(defaultOriginalLayout);
    defaultScatterPlot.plotType = 'scatterplot';
    defaultScatterPlot.settings.xaxis = 'OriginalX';
    defaultScatterPlot.settings.xAxShow = true;
    defaultScatterPlot.settings.xAxTickShow = true;

    defaultScatterPlot.settings.yaxis = 'OriginalY';
    defaultScatterPlot.settings.yAxShow = true;
    defaultScatterPlot.settings.yAxTickShow = true;
    defaultScatterPlot.settings.invertY = true;
    defaultScatterPlot.settings.scatterAspect = 0.5;

    //
    //Default settings for Geo
    //
    var defaultGeo = _.cloneDeep(defaultOriginalLayout);
    defaultGeo.plotType = 'geo';
    defaultGeo.settings.minZoomLevel = 2;
    defaultGeo.settings.maxZoomLevels = 15;
    defaultGeo.settings.disableAggregationLevel = 5;



    /*************************************
    ********* Core Functions *************
    **************************************/
    function hasRenderSettingsChanged (newVal, oldVal) {
        // Find out whether any layout effecting setting has changed or not. These trigger a regen of renderGraph
        var regenGraph = _.any(dataGraphSettings, function(dgSetting) {
            var hasChanged = false;
            if(_.isArray(newVal[dgSetting])) {
                hasChanged = _.isArray(oldVal[dgSetting]) && oldVal[dgSetting].length === newVal[dgSetting].length;
                // check array elements as well
                hasChanged =  hasChanged && _.any(_.zip(newVal[dgSetting],oldVal[dgSetting]), function(elem) {
                    if(dgSetting === 'nodeColorPaletteOrdinal' ||
                        dgSetting === 'nodeColorPaletteNumeric' ||
                        dgSetting === 'edgeColorPaletteOrdinal' ||
                        dgSetting === 'edgeColorPaletteNumeric')
                        return elem[0].col !== elem[1].col;
                    else
                        return elem[0] !== elem[1];
                });
            } else if(_.isObject(newVal[dgSetting])) {
                hasChanged = !_.isEqual(newVal[dgSetting],oldVal[dgSetting]);
            } else {
                hasChanged = newVal[dgSetting] != oldVal[dgSetting];
            }
            return hasChanged;
        });
        return regenGraph;
    }

    function invalidateCurrent() {
        if(_currLayout) {
            _currLayout = null;
            layoutDefer.reject('layout invalidated');
            layoutDefer = $q.defer();
        }
    }

    function getCurrentLayout() {
        if(_currLayout) {
            return $q.when(_currLayout);
        } else {
            return layoutDefer.promise;
        }
    }

    function getCurrentOrCreateDefault () {
        if(_currLayout) {
            return _currLayout;
        }
        else {
            return this.createDefault('original');
        }
    }

    function setCurrent(layout) {
        console.log('[layoutService] Current Layout Changed to: %O', layout);
        _currLayout = layout;
        layoutDefer.resolve(_currLayout);
        return _currLayout;
    }

    function buildLayoutForSnapshot(snapshot) {
        console.group('[layoutService.buildLayoutForSnapshot]');
        var l = null;
        if (!snapshot.layout) { // if no layout exists, then create one
            console.warn('Snapshot does not contain a layout!!');
            //snapshot.layout = this.createDefault('original');
        } else {
            var layoutCfg = createDefaultLayout(snapshot.layout.plotType, snapshot.layout.settings, snapshot.layout.camera);
            layoutCfg = _.merge(layoutCfg, snapshot.layout);
            l = new Layout(layoutCfg, snapshot.camera, true);
            l.snapshotId = snapshot.id;
        }
        console.groupEnd();
        return l;
    }


    /**
     * LAYOUT NOTES
     * Has 3 cameras : this.camera -> the camera being used.
     * this.defCamera , this.baseCamera -> These are used to initialize this.camera. DefCamera is generic camera for the layout
     * this.baseCamera is the camera used to create this layout. It can either be defCamera or snapshotCamera
     *
     */

    function getAttrValue (rawAttrValue) {
        return _.isArray(rawAttrValue) ? rawAttrValue.join('|') : rawAttrValue;
    }
    //
    // Scale node Size according to the attribute.
    // needs to run in context of a layout. (this == layout)
    //
    function reScaleNodeSizes() {
        var self = this,
            scaleGen = nodeSizeScaleBuilder,
            scaler = scaleGen.genScale(self.mapprSettings),
            mapprVals = scaleGen.extractValues(self.mapprSettings);

        self.scalers.size = scaler;
        self._getSize = function _getSize(node) {
            var val = scaler(getAttrValue(node.attr[mapprVals.Attr]), node.attr[mapprVals.PartitionAttr]);
            if(val == null || isNaN(val)) {
                console.warn("Size Scaler failed at value: %s -> %s", getAttrValue(node.attr[mapprVals.Attr]), val);
                return mapprVals.DefaultValue;
            } else { return val; }
        };
    }
    /**
     * Attribute based colors
     * needs to run in context of a layout. (this == layout)
     */
    function setColorAttrib () {
        var self = this;
        var scaleGen = nodeColorScaleBuilder,
            clusterScaleGen = nodeClusterScaleBuilder,
            mapprVals = scaleGen.extractValues(self.mapprSettings),
            clusterMapprVals = clusterScaleGen.extractValues(self.mapprSettings),
            colorMap = self.mapprSettings.nodeUserColorMap[mapprVals.Attr];

        var scaler = scaleGen.genScale(self.mapprSettings);
        var clusterScaler = clusterScaleGen.genScale(self.mapprSettings);

        self.scalers.color = function(value, partitionValue) {
            if(colorMap && _.isString(colorMap[value])) {
                return colorMap[value];
            } else if(value != null) {
                return scaler(value, partitionValue);
            } else {
                return mapprVals.DefaultValue;
            }
        };
        self.scalers.clusterColor = function(value, partitionValue) {
            if(colorMap && _.isString(colorMap[value])) {
                return colorMap[value];
            } else if(value != null) {
                return clusterScaler(value, partitionValue);
            } else {
                return clusterMapprVals.DefaultValue;
            }
        };

        // Finally the func
        self._getColor = function _getColor (node) {
            var val = self.scalers.color(getAttrValue(node.attr[mapprVals.Attr]), node.attr[mapprVals.PartitionAttr]);
            if(val == null) {
                console.warn("Color Scaler failed at value: %s -> %s", getAttrValue(node.attr[mapprVals.Attr]), val);
                return mapprVals.DefaultValue;
            } else { return val; }
        };

        self._getClusterColor = function _getClusterColor (node) {
            var val = self.scalers.clusterColor(getAttrValue(node.attr[clusterMapprVals.Attr]), node.attr[clusterMapprVals.PartitionAttr]);
            if(val == null) {
                console.warn("Color Cluster Scaler failed at value: %s -> %s", getAttrValue(node.attr[clusterMapprVals.Attr]), val);
                return clusterMapprVals.DefaultValue;
            } else { return val; }
        };
    }
    function reScaleEdgeSizes() {
        var self = this;

        var scaleGen = edgeSizeScaleBuilder,
            scaler = scaleGen.genScale(self.mapprSettings),
            mapprVals = scaleGen.extractValues(self.mapprSettings);

        self.scalers.edgeSize = scaler;
        self._getEdgeSize = function _getEdgeSize(edge) {
            var val = scaler(getAttrValue(edge.attr[mapprVals.Attr]), edge.attr[mapprVals.PartitionAttr]);
            if(val == null || isNaN(val)) {
                console.warn("Edge Size Scaler failed at value: %s -> %s", getAttrValue(edge.attr[mapprVals.Attr]), val);
                return mapprVals.DefaultValue;
            } else { return val; }
        };
    }
    function setColorAttribEdge () {
        var self = this;
        var scaleGen = edgeColorScaleBuilder,
            mapprVals = scaleGen.extractValues(self.mapprSettings),
            colorMap = self.mapprSettings.edgeUserColorMap[mapprVals.Attr];

        var scaler = scaleGen.genScale(self.mapprSettings);

        self.scalers.edgeColor = function(value, partitionValue) {
            if(colorMap && _.isString(colorMap[value])) {
                return colorMap[value];
            } else if(value != null) {
                return scaler(value, partitionValue);
            } else {
                return mapprVals.DefaultValue;
            }
        };
        // Finally the func
        self._getEdgeColor = function _getEdgeColor (edge) {
            var val = self.scalers.edgeColor(getAttrValue(edge.attr[mapprVals.Attr]), edge.attr[mapprVals.PartitionAttr]);
            if(val == null) {
                console.warn("Edge Color Scaler failed at value: %s -> %s", getAttrValue(edge.attr[mapprVals.Attr]), val);
                return mapprVals.DefaultValue;
            } else { return val; }
        };
    }
    // NOTE: Run after setting the color func. Updates the color func
    function calcColorDensity () {
        var densityShifter = _.identity,
            densityAttr  = this.mapprSettings.nodeColorDensityAttr,
            densityStrat = this.mapprSettings.nodeColorDensityStrategy,
            densityValue = this.mapprSettings.nodeColorDensity,
            densityOrder = this.mapprSettings.nodeColorDensityOrder,

            attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(densityAttr),
            values = null,
            bounds = null;

        var modifierMin = 0.1, modifierMax = 2;

        if(densityStrat === 'fixed') {
            if(densityValue !== 1) {
                densityShifter = function(node, d3rgbColor) {
                    return densityOrder ? d3rgbColor.brighter(densityValue) : d3rgbColor.darker(densityValue);
                };
            } else {
                densityShifter = function(node, color) { return color;};
            }
        } else {
            var scaler;
            if(attrInfo.isNumeric) {
                // numeric scaling
                bounds = attrInfo.bounds;
                scaler = d3.scale.linear();
                scaler.domain([bounds.min, bounds.max]).range([modifierMin, modifierMax]); // these magic constants are guesswork

            } else {
                // ordinal scaling
                values = attrInfo.values;
                scaler = d3.scale.ordinal()
                    .domain(values)
                    .rangePoints([modifierMin, modifierMax]);
            }
            densityShifter = function(node, d3rgbColor) {
                if(node.attr[densityAttr] != null) {
                    var scaledValue = scaler(getAttrValue(node.attr[densityAttr], attrInfo));
                    return densityOrder ? d3rgbColor.brighter(scaledValue) : d3rgbColor.darker(scaledValue);
                } else {
                    return d3rgbColor;
                }

            };
        }
        this.scalers.opacity = densityShifter;
        this._getColorDensity = densityShifter;
    }

    // function getCenter(attrBounds, margin) {
    //     return ((attrBounds.max + attrBounds.min) / 2) + margin;
    // }

    function getNodeColorAttrs() {
        // Only Attributes which are
        // 1) the original color attribute
        // 2) Non Tags -- tags are now allowed
        // 3) any cluster attribute - include lower case louvain so quid data imports
        // 4a) numeric and multivalued
        // 4b) or strings with less than a max number of discrete values
        function _filterAttrs (attr) {
            var idsToIgnore = ['OriginalColor', 'OriginalSize', 'OriginalLabel', 'linkingAttributes', 'id', 'isDirectional'];
            if (idsToIgnore.includes(attr.id)) return false;
            if (attr.colorSelectable === undefined) return false;
            if(!Boolean(attr.colorSelectable) && attr.colorSelectable !== undefined) return false;

            return true;
        }
        return _.filter(dataGraph.getNodeAttrs(), _filterAttrs);
    }

    function getNodeSizeAttrs() {
        // Only Attributes which are numeric and multivalues
        function _filterAttrs (attr) {
            // not hidden and selectable, colorSelectable, sizeSelectable
            if (attr.sizeSelectable === undefined) return false;
            if(!Boolean(attr.sizeSelectable) && attr.sizeSelectable !== undefined) return false;
            return !!attr.isNumeric  && attr.bounds.max >= attr.bounds.min;
        }
        return _.filter(dataGraph.getNodeAttrs(), _filterAttrs);
    }

    function getEdgeColorAttrs() {
        // Only Attributes which are
        // 1) the original color attribute
        // 2) Non Tags
        // 3) any cluster attribute - include lower case louvain so quid data imports
        // 4a) numeric and multivalued
        // 4b) or strings with less than a max number of discrete values
        function _filterAttrs (attr) {
            var maxItems = Math.max(attr.nValues/2, MAX_COLOR_ITEMS);
            var clusteringStrings = ["Cluster", "Louvain", "louvain"];
            if(attr.attrType == 'color') {
                return true;
            }
            if(attr.isTag) {return false;}
            if( _.any(clusteringStrings, function(str) { return attr.title.indexOf(str) >= 0; })) { return true; }
            if(attr.isNumeric && attr.bounds.max <= attr.bounds.min) { return false; }
            if(!attr.isNumeric && (attr.attrType !== 'string' || _.size(attr.values) > maxItems)) { return false; }
            return true;
        }
        return _.filter(dataGraph.getEdgeAttrs(), _filterAttrs);
    }

    function getEdgeSizeAttrs() {
        // Only Attributes which are numeric and multivalues
        function _filterAttrs (attr) {
            return !!attr.isNumeric  && attr.bounds.max >= attr.bounds.min;
        }
        return _.filter(dataGraph.getEdgeAttrs(), _filterAttrs);
    }

    function getLayoutPanelAttrs() {
        // Only Attributes which are no tags
        // if numeric, must be multivalued
        function _filterAttrs (attr) {
            if(attr.generatorType == "uiGenerated" ) {
                return attr.title.toLowerCase() == "originalx" || attr.title.toLowerCase() == "originaly";
            }
            if(attr.isNumeric && attr.bounds.max <= attr.bounds.min) { return false; }
            return  !attr.isTag;
        }
        return _.filter(dataGraph.getNodeAttrs(), _filterAttrs);
    }

    function getGroupAttr() {
        var layout = this.getCurrentIfExists();
        if( layout && layout.mapprSettings.nodeColorStrat == 'attr' ) {
            var groupAttr = layout.mapprSettings.nodeClusterAttr;
            var info = AttrInfoService.getNodeAttrInfoForRG().getForId(groupAttr);
            if(info && !info.isNumeric && !info.isTag && info.values.length > 1) {
                return info;
            }
        }
        return undefined;
    }

    function getSubgroupAttr() {
        var layout = this.getCurrentIfExists();
        if (!layout || layout.mapprSettings.nodeColorStrat !== 'attr') {
            return undefined;
        }

        var groupAttr = layout.mapprSettings.nodeSubclusterAttr;
        if (!groupAttr) {
            return undefined;
        }

        var info = AttrInfoService.getNodeAttrInfoForRG().getForId(groupAttr);
        if(info && !info.isNumeric && !info.isTag && info.values.length > 1) {
            return info;
        }

        return undefined;
    }


    //
    // Layout Classes
    //

    //There are 3 types of layout original, geo and spatial.
    // the camera is the initial camera. The camera takes care about centering things
    function Layout(layoutOpts, camera) {
        console.log('Creating layout with options: %O', layoutOpts);
        this.id = _.uniqueId('layout_');
        this.plotType = layoutOpts.plotType;

        //Solely to prevent angular scope from observing everything!
        this.getRawLayoutData = function() {
            return layoutOpts;
        };
        // ratio is the number by which the node positions have to be divided to fit into the window
        // The camera being used.
        this.camera = _.clone(camera);
        // legacy support
        if(this.camera && this.camera.r && !this.camera.ratio) {
            this.camera.ratio = this.camera.r;
        }
        this.defCamera = {
            x: offsetX, // right panel width
            y: -offsetY,
            ratio : 1
        };
        console.log('Camera on layout Creation: %O', camera);
        this.resetCamera = function() {
            this.camera = _.clone(this.defCamera);
        };
        this.normalizeCamera = function (baseRatio) {
            console.warn("LAYOUT CAMERA NORMALIZED");
            this.camera.x /= baseRatio;
            this.camera.y /= baseRatio;
        };
        //
        // The layout's mapprSettings accessor / settor
        //
        this.setting = function settings (key, value) {
            if(_.has(this.mapprSettings, key)) {
                if(value == null) {
                    // accessor
                    return this.mapprSettings[key];
                }
                if(this.mapprSettings[key] === null)
                    this.mapprSettings[key] = value;
                if( (value !== undefined || value !== null) &&
                    typeof(value) === typeof(this.mapprSettings[key]))
                    this.mapprSettings[key] = value;
                else {
                    // If the base type is number and the new type is string, see if it can be coorced into a number
                    if(typeof (this.mapprSettings[key]) === 'number' &&
                        isFinite(Number(value))) {
                        this.mapprSettings[key] = Number(value);
                    } else {
                        console.warn('value type mismatch, ignoring! (%s, %s)', key, value);
                    }
                }

                return this.mapprSettings[key];
            } else {
                //throw 'Key:' + key + ' not found in layout settings';
                //console.warn('Key:' + key + ' not found in layout settings');
            }
        };

        // The node Transformer. Customized by specialized layouts below
        this.nodeT = _.identity;
        this.edgeT = _.identity;

        //Initialize Sigma Settings.
        var mapprSettings = null;
        //This ensures defaults always exist even if the layout didn't have them before
        if(['scatterplot', 'clustered-scatterplot'].includes(this.plotType))
            mapprSettings = _.clone(defaultScatterPlot.settings);
        else if(this.plotType === 'geo')
            mapprSettings = _.clone(defaultGeo.settings);
        else
            mapprSettings = _.clone(defaultOriginalLayout.settings);

        var version = mapprSettings.version;
        mapprSettings.version = undefined;
        // Only copy over defined values
        _.assign(mapprSettings, layoutOpts.settings, function(dest, src) {
            return typeof src  !== 'undefined' ? src : dest;
        });
        if(+mapprSettings.version < version) {
            mapprSettings = upgradeMapprSettings(mapprSettings);
        }

        if(!mapprSettings.version)
            mapprSettings.version = version;
        this.mapprSettings = mapprSettings;
        this.mapprSettings.layoutId = this.id; // and Id in mapprSettings for easy reference

        //The scalers being used by the system
        //the scalers take 2 arguments, attr Value and partitionAttr Value
        this.scalers = {
            color: _.noop,
            size: _.noop,
            edgeColor: _.noop,
            edgeSize: _.noop,
            x: _.noop,
            y: _.noop
        };
        // An array of functions which are used to setup the layout.
        this.setupLayoutFuncs = [];
        //To be called whenever data on which the layout operates is changed.
        this.setup = function setupLayout() {
            console.log('Calling setup funcs: %O', this.setupLayoutFuncs);
            var self = this;
            _.each(this.setupLayoutFuncs, function(fn) {
                fn.call(self);
            });
        };
        this.setupLayoutFuncs.push(reScaleNodeSizes);
        this.setupLayoutFuncs.push(reScaleEdgeSizes);
        this.setupLayoutFuncs.push(setColorAttrib);
        this.setupLayoutFuncs.push(setColorAttribEdge);
        this.setupLayoutFuncs.push(calcColorDensity);
        // build the camera
        this.setupLayoutFuncs.push(function setupCamera() {
            if(!this.camera) {
                this.camera = _.clone(this.defCamera);
            }
            this.baseCamera = _.clone(this.camera);
        });
        var self = this;
        //
        // Node validity. These 4 funcs are used to check if the node can be drawn
        this.validity = {
            x: function(node) {
                return node.attr[self.attr.x] != null;
            },
            y: function(node) {
                return node.attr[self.attr.y] != null;
            },
            size: function(node) {
                return node.attr[self.mapprSettings.nodeSizeAttr] != null;
            },
            color: function() {
                return true; // dont validate color, revert to default color of none found
            },
            edgeSize: function(edge) {
                return edge.attr[self.mapprSettings.edgeSizeAttr] != null;
            },
            edgeColor: function() {
                return true; // dont validate color, revert to default color of none found
            }
        };
        this.isNodeValid = function(node) {
            return this.validity.x(node) &&
            this.validity.y(node) &&
            this.validity.size(node) &&
            this.validity.color(node);
        };
        this.isEdgeValid = function(edge) {
            var v = this.validity.edgeSize(edge) &&
            this.validity.edgeColor(edge);
            return v;
        };


        //Default extractors are noop. The extractor is provided by following funcs
        //
        this._getSize = _.noop;
        this._getColor = _.noop;
        this._getClusterColor = _.noop;

        this._commonNodeT = function(node) {
            var color     = d3.rgb(this._getColor(node));
            var newColor = this._getColorDensity(node, color);

            node.size     = this._getSize(node);
            node.baseSize = node.size;
            node.colorStr = newColor.toString();
            node.color    = [newColor.r, newColor.g, newColor.b];
            node.colorStr = window.mappr.utils.colorStr(node.color);
            node.clusterColor = node.color;
            node.clusterColorStr = node.colorStr;
        };
        this._commonEdgeT = function(edge) {
            var color;
            edge.size     = this._getEdgeSize(edge);
            edge.baseSize = edge.size;
            edge.colorStr = this._getEdgeColor(edge);
            color         = d3.rgb(edge.colorStr);
            edge.color    = [color.r, color.g, color.b];
            edge.colorStr = window.mappr.utils.colorStr(edge.color);
        };

        //Specialize the layout.
        if (layoutOpts.plotType == 'original') {
            Original.call(this);
            console.log('Created layout Original: %O', this);
        } else if (layoutOpts.plotType == 'scatterplot') {
            ScatterPlot.call(this);
            console.log('Created layout ScatterPlot: %O', this);
        } else if (layoutOpts.plotType == 'clustered-scatterplot') {
            ClusteredScatterplot.call(this);
            console.log('Created layout Clustered ScatterPlot: %O', this);
        }
        else if(layoutOpts.plotType == 'geo'){
            console.log('Created layout geo: %O', this);
            Geo.call(this);
        } else if (layoutOpts.plotType.indexOf('athena') !== -1) {
            AthenaLayout.call(this);
            console.log('Created AthenaLayout %s: %O', layoutOpts.plotType, this);
        } else if(layoutOpts.plotType == 'grid'){
            Original.call(this);
            console.log('Created layout grid %s: %O', layoutOpts.plotType, this);
        }else {
            console.warn('Unable to build layout for type: %s. So building default layout',layoutOpts.plotType);
            Original.call(this);
        }
    }
    //Suppliments the Layout object
    function Original() {
        //ScatterPlot.call(this);
        this.isScatterPlot = false;
        this.isOriginal = true;
        this.gridAttr = this.getRawLayoutData().gridAttr; // for grid layout
        this.gridSortAttr = this.getRawLayoutData().gridSortAttr; // for grid layout
        this.listAttrs = this.getRawLayoutData().listAttrs || [this.mapprSettings.nodeClusterAttr];
        // this.listSortAttr = this.getRawLayoutData().listSortAttr || 'Cluster';
        // this.listSortReverse = this.getRawLayoutData().listSortReverse;
        this.listSortAttrAr = this.getRawLayoutData().listSortAttrAr || [this.mapprSettings.nodeClusterAttr];
        this.listSortReverseAr = this.getRawLayoutData().listSortReverseAr;
        this.listCompareIds = this.getRawLayoutData().listCompareIds;
        this.listColSizes = this.getRawLayoutData().listColSizes || [300];

        var defaultAttr = {};
        defaultAttr.x = 'OriginalX';
        defaultAttr.y = 'OriginalY';

        this.attr = {};
        this.attr.x = this.getRawLayoutData().xaxis || defaultAttr.x;
        this.attr.y = this.getRawLayoutData().yaxis || defaultAttr.y;

        this.nodeT = function nodeT (node) {
            this._commonNodeT(node);
            node.x = node.attr[this.attr.x];
            node.y = node.attr[this.attr.y];
        };
        this.edgeT = function edgeT(edge) {
            this._commonEdgeT(edge);
        };
    }
    function AthenaLayout() {
        Original.call(this);
        this.isAthenaLayout = true;

        this.setAttrX = function setAttrX(attribName) {
            this.attr.x = attribName || 'OriginalX';
        };
        this.setAttrY = function setAttrY(attribName) {
            this.attr.y = attribName || 'OriginalY';
        };
    }


    function ScatterPlot() {
        var self = this;
        this.isScatterPlot = true;

        var defaultAttr = {};
        defaultAttr.x = 'OriginalX';
        defaultAttr.y = 'OriginalY';

        this.attr = {};
        this.attr.x = this.getRawLayoutData().xaxis || defaultAttr.x;
        this.attr.y = this.getRawLayoutData().yaxis || defaultAttr.y;

        this.isOrdinal = {};
        this.isOrdinal.x = false;
        this.isOrdinal.y = false;

        this.scalers.x = null;
        this.scalers.y = null;

        this.defCamera.y = - scatterplotOffsetY;

        this.scalers.x_scaler_info = {
            scalerType : this.getRawLayoutData().x_scaler_type || 'linear',
            base : this.getRawLayoutData().x_scaler_base || 10,
            exponent : this.getRawLayoutData().x_scaler_exponent || 2,
            shiftInputValBy : 0 // the amount by which the value has been shifted
        };
        this.scalers.y_scaler_info = {
            scalerType : this.getRawLayoutData().y_scaler_type || 'linear',
            base : this.getRawLayoutData().y_scaler_base || 10,
            exponent : this.getRawLayoutData().y_scaler_exponent || 2,
            shiftInputValBy : 0
        };

        this.setupLayoutFuncs.push(function setupAxisAttrs() {
            var aspect  = this.mapprSettings['scatterAspect'];
            var wd      = window.innerWidth - marginRt - 50 - marginLeft;
            var ht      = (window.innerHeight - marginTop - scatterplotMarginBtm);
            var centerX = wd/2;
            var centerY = (window.innerHeight - marginTop - scatterplotMarginBtm)/2;
            aspect = Math.max(0, Math.min(aspect, 1));  // constrain value
            aspect = Math.pow(2, 2*aspect-1);   // map (0,1) to (1/2, 2) with 1 at center of range
            //aspect = 1;
            var rangeX = aspect * ht;
            var rangeY = ht;
            if(rangeX > wd) {
                rangeY = rangeY * wd/rangeX;
                rangeX = wd;
            }
            this.setAxisAttr(this.attr.x, 'x', centerX - (rangeX - 80), centerX + rangeX/2);
            this.setAxisAttr(this.attr.y, 'y', centerY - rangeY/2, centerY + rangeY/2);
        });

        this.setAxisAttr = _setAxisAttr;
        this.getPlotableValue = getPlotableValue;

        this.nodeT = function nodeT (node) {
            this._commonNodeT(node);
            node.x = this.getPlotableValue(node, 'x');
            node.y = this.getPlotableValue(node, 'y');
            //console.log(node.x, node.y);
        };
        this.edgeT = function edgeT(edge) {
            this._commonEdgeT(edge);
        };

        this.setAttrX = function setAttrX(attribName) {
            this.attr.x = attribName || 'OriginalX';
        };
        this.setAttrY = function setAttrY(attribName) {
            this.attr.y = attribName || 'OriginalY';
        };

        this._setScaler = function _setScaler(axis, scalerType, base, exponent) {
            this.scalers[axis + '_scaler_info'] = {
                scalerType : scalerType,
                base : parseFloat(base),
                exponent : parseFloat(exponent)
            };
        };

        this.setScalerInfoX = _.bind(_.partial(this._setScaler, 'x'), this);
        this.setScalerInfoY = _.bind(_.partial(this._setScaler, 'y'), this);

        function getPlotableValue(node, axis) {

            var value = node.attr[self.attr[axis]], newValue = null;
            if (self.isOrdinal[axis]) {
                newValue = Math.round(self.scalers[axis](value));
            } else {
                newValue = self.scalers[axis](parseFloat(value));
                //console.log(value, newValue);
            }

            if(newValue == null || isNaN(newValue)) {
                console.warn("Invalid getPlotableValue for axis :%s , %s -> %s", axis, value, newValue);
                newValue = 0;
            }
            if(self.isOrdinal[axis]) {
                newValue += _.random(-5,5);
            }
            return newValue;
        }

        function _setAxisAttr(attribName, axis, rangeMin, rangeMax) {
            var scaler, self = this;
            var toInvert = this.mapprSettings['invert' + axis.toUpperCase()];
            var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(attribName);
            self.scalers[axis + '_scaler_info'].shiftInputValBy = 0; // reset shift Info

            // Check whether attribute exists on node
            if (attrInfo) {
                self.attr[axis] = attribName;
                // if numeric, scale linearly
                if (attrInfo.isNumeric) {
                    self.isOrdinal[axis] = false;
                    var scalerInfo = self.scalers[axis + '_scaler_info'];
                    var bounds = attrInfo.bounds;
                    var domain = [bounds.min, bounds.max];
                    var shiftInputVal = false;
                    var shiftInputValBy = 0;

                    switch(scalerInfo.scalerType) {
                    case 'linear' : scaler = d3.scale.linear();
                        break;
                    case 'exponential' : scaler = d3.scale.pow().exponent(+scalerInfo.exponent);
                        break;
                    case 'log' : scaler = d3.scale.log().base(+scalerInfo.base);
                        // `1` lies inside the domain
                        if(domain[0] < 1 && domain[1] > 1) {
                            shiftInputVal = true;
                            shiftInputValBy = (-1 * domain[0]) + 1;
                            domain[1] = domain[1] + shiftInputValBy;
                            domain[0] = 1;
                        }
                        break;
                    default : scaler = d3.scale.linear();
                    }

                    // Invert domain if required
                    if(toInvert) {
                        domain = domain.reverse();
                        // if(shiftInputVal) {
                        //  shiftInputValBy = (-1 * domain[0]) + 1;
                        // }
                    }
                    scaler.domain(domain);
                    scaler.nice();
                    scaler.rangeRound([rangeMin, rangeMax]);

                    if(shiftInputVal) {
                        //log fails if the bounds contain zero, since log 0 is infinity. So move bounds to solve this issue
                        var oldScaler = scaler;
                        scaler = function (val) {
                            return oldScaler(val + shiftInputValBy);
                        };
                        // range -> domain mapping (invert)
                        scaler.invert = function(val) {
                            return oldScaler.invert(val) - shiftInputValBy;
                        };
                    }
                    self.scalers[axis] = scaler;
                    scalerInfo.shiftInputValBy = shiftInputValBy;
                } else {
                    //Build an Ordinal Scale
                    self.isOrdinal[axis] = true;
                    scaler = d3.scale.ordinal();
                    scaler.domain(attrInfo.values);
                    scaler.rangePoints([rangeMin, rangeMax], 0);
                    self.scalers[axis] = scaler;
                    // Invert domain if required
                    if(toInvert) {
                        self.scalers[axis].domain(self.scalers[axis].domain().reverse());
                    }
                }
            } else {
                console.warn('Attribute does not exist on the nodes. attribName: %s, nodes: %O',
                    attribName, dataGraph.getAllNodes());
                console.warn('Reverting to DefaultAttribute on axis:' + axis);
                self.attr[axis] = defaultAttr[axis];
                self.setAxisAttr(self.attr[axis], axis, rangeMin, rangeMax);
            }
        }
    }

    function ClusteredScatterplot() {
        var self = this;
        this.isScatterPlot = true;

        var defaultAttr = {};
        defaultAttr.x = 'OriginalX';
        defaultAttr.y = 'OriginalY';

        this.attr = {};
        var rawLayoutData = this.getRawLayoutData();
        this.attr.xaxis = rawLayoutData.clusterXAttr || defaultAttr.x;
        this.attr.yaxis = rawLayoutData.clusterYAttr || defaultAttr.y;
        this.attr.x = rawLayoutData.nodeXAttr || defaultAttr.x;
        this.attr.y = rawLayoutData.nodeYAttr || defaultAttr.y;
        var clusterInfoAttr = rawLayoutData.settings.nodeClusterAttr;
        this.nodeAttr = {
            x: rawLayoutData.nodeXAttr || defaultAttr.x,
            y: rawLayoutData.nodeYAttr || defaultAttr.y
        };
        
        this.isOrdinal = {};
        this.isOrdinal.x = false;
        this.isOrdinal.y = false;

        this.scalers.x = null;
        this.scalers.y = null;

        this.defCamera.y = - scatterplotOffsetY;

        this.scalers.x_scaler_info = {
            scalerType : rawLayoutData.x_scaler_type || 'linear',
            base : rawLayoutData.x_scaler_base || 10,
            exponent : rawLayoutData.x_scaler_exponent || 2,
            shiftInputValBy : 0 // the amount by which the value has been shifted
        };
        this.scalers.y_scaler_info = {
            scalerType : rawLayoutData.y_scaler_type || 'linear',
            base : rawLayoutData.y_scaler_base || 10,
            exponent : rawLayoutData.y_scaler_exponent || 2,
            shiftInputValBy : 0
        };

        this.scalers.nodeX_scaler_info = {
            scalerType : rawLayoutData.x_scaler_type || 'linear',
            base : rawLayoutData.x_scaler_base || 10,
            exponent : rawLayoutData.x_scaler_exponent || 2,
            shiftInputValBy : 0
        };
        this.scalers.nodeY_scaler_info = {
            scalerType : rawLayoutData.y_scaler_type || 'linear',
            base : rawLayoutData.y_scaler_base || 10,
            exponent : rawLayoutData.y_scaler_exponent || 2,
            shiftInputValBy : 0
        };

        this.recalculateClusters = function () {
            const allNodes = dataGraph.getAllNodes();

            const clusterInfo = allNodes.reduce(function (acc, cv) {
                const clusterAttrValue = cv.attr[clusterInfoAttr];
                const clusterXValue = self.getClusterPlotValue(cv, 'x');
                const clusterYValue = self.getClusterPlotValue(cv, 'y');
                return {
                    ...acc,
                    [clusterAttrValue]: [...(acc[clusterAttrValue] || []), { 
                        x: clusterXValue,
                        y: clusterYValue,
                        nodeX: self.getPlotableValue(cv, 'x'),
                        nodeY: self.getPlotableValue(cv, 'y')
                    }]
                };
            }, {});

            clusterInfo.__calculated = {};
            for(let clusterValue in clusterInfo) {
                if (clusterValue === '__calculated') continue;
                var nodeData = clusterInfo[clusterValue];
                const numberOfData = nodeData ? nodeData.length : 1;
                clusterInfo.__calculated[clusterValue] = {
                    x: _.sum(nodeData, 'x') / numberOfData,
                    y: _.sum(nodeData, 'y') / numberOfData,
                    nodeX: _.sum(nodeData, 'nodeX') / numberOfData,
                    nodeY: _.sum(nodeData, 'nodeY') / numberOfData
                };
            }

            self.clusterInfo = clusterInfo;
        }

        this.setupLayoutFuncs.push(function setupAxisAttrs() {
            var aspect  = this.mapprSettings['scatterAspect'];
            var wd      = window.innerWidth - marginRt - 50 - marginLeft;
            var ht      = (window.innerHeight - marginTop - scatterplotMarginBtm);
            var centerX = wd/2;
            var centerY = (window.innerHeight - marginTop - scatterplotMarginBtm)/2;
            aspect = Math.max(0, Math.min(aspect, 1));  // constrain value
            aspect = Math.pow(2, 2*aspect-1);   // map (0,1) to (1/2, 2) with 1 at center of range
            //aspect = 1;
            var rangeX = aspect * wd;
            var rangeY = 2 * ht;
            if(rangeX > wd) {
                rangeY = rangeY * wd/rangeX;
                rangeX = wd;
            }

            var yRange = rangeY - 500;
            if (yRange < 0) {
                yRange = rangeY / 2;
            }

            this.setAxisAttr(this.attr.xaxis, 'x', centerX - (rangeX - 80), centerX + rangeX/2);
            this.setAxisAttr(this.attr.yaxis, 'y', centerY - rangeY/2, centerY + rangeY/2);
            this.setAxisAttr(this.nodeAttr.x, 'nodeX', centerX - (rangeX - 80), centerX + rangeX/2);
            this.setAxisAttr(this.nodeAttr.y, 'nodeY', centerY - yRange, centerY + yRange);

            this.recalculateClusters();
        });

        this.setAxisAttr = _setAxisAttr;
        this.getPlotableValue = getPlotableValue;

        this.getClusterPlotValue = function(node, axis) {
            var clusteredCenter = node.attr[self.attr[axis + 'axis']], newValue = null;
            if (self.isOrdinal[axis]) {
                newValue = Math.round(self.scalers[axis](clusteredCenter));
            } else {
                newValue = self.scalers[axis](parseFloat(clusteredCenter));
            }

            if(newValue == null || isNaN(newValue)) {
                console.warn("Invalid getPlotableValue for axis :%s , %s -> %s", axis, clusteredCenter, newValue);
                newValue = 0;
            }
            if(self.isOrdinal[axis]) {
                newValue += _.random(-5,5);
            }
            return newValue;
        };

        this.getNodePlotableValue = function (node, axis) {
            var attrValue = node.attr[clusterInfoAttr];
            var clusterData = self.clusterInfo.__calculated[attrValue];
            var clusterCenter = clusterData[axis];
            var nodeCenter = clusterData[`node${axis.toUpperCase()}`];

            var value = self.getPlotableValue(node, axis);
            return value + clusterCenter - nodeCenter;
        }

        this.nodeT = function nodeT (node) {
            this._commonNodeT(node);
            node.x = this.getNodePlotableValue(node, 'x');
            node.y = this.getNodePlotableValue(node, 'y');
            //console.log(node.x, node.y);
        };
        this.edgeT = function edgeT(edge) {
            this._commonEdgeT(edge);
        };

        this.setAttrX = function setAttrX(attribName) {
            // this.attr.x = attribName || 'OriginalX';
        };
        this.setAttrY = function setAttrY(attribName) {
            // this.attr.y = attribName || 'OriginalY';
        };

        this._setScaler = function _setScaler(axis, scalerType, base, exponent) {
            this.scalers[axis + '_scaler_info'] = {
                scalerType : scalerType,
                base : parseFloat(base),
                exponent : parseFloat(exponent)
            };
        };

        this.setScalerInfoX = _.bind(_.partial(this._setScaler, 'x'), this);
        this.setScalerInfoY = _.bind(_.partial(this._setScaler, 'y'), this);

        function getPlotableValue(node, axis) {
            var value = node.attr[self.nodeAttr[axis]], newValue = null;
            if (self.isOrdinal[axis]) {
                newValue = Math.round(self.scalers[`node${axis.toUpperCase()}`](value));
            } else {
                newValue = self.scalers[`node${axis.toUpperCase()}`](parseFloat(value));
                //console.log(value, newValue);
            }

            if(newValue == null || isNaN(newValue)) {
                console.warn("Invalid getPlotableValue for axis :%s , %s -> %s", axis, value, newValue);
                newValue = 0;
            }
            if(self.isOrdinal[axis]) {
                newValue += _.random(-5,5);
            }
            return newValue;
        }

        function _setAxisAttr(attribName, axis, rangeMin, rangeMax) {
            var scaler, self = this;
            var toInvert = this.mapprSettings['invert' + axis.toUpperCase()];
            var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(attribName);
            self.scalers[axis + '_scaler_info'].shiftInputValBy = 0; // reset shift Info

            // Check whether attribute exists on node
            if (attrInfo) {
                self.attr[axis] = attribName;
                // if numeric, scale linearly
                if (attrInfo.isNumeric) {
                    self.isOrdinal[axis] = false;
                    var scalerInfo = self.scalers[axis + '_scaler_info'];
                    var bounds = attrInfo.bounds;
                    var domain = [bounds.min, bounds.max];
                    var shiftInputVal = false;
                    var shiftInputValBy = 0;

                    switch(scalerInfo.scalerType) {
                    case 'linear' : scaler = d3.scale.linear();
                        break;
                    case 'exponential' : scaler = d3.scale.pow().exponent(+scalerInfo.exponent);
                        break;
                    case 'log' : scaler = d3.scale.log().base(+scalerInfo.base);
                        // `1` lies inside the domain
                        if(domain[0] < 1 && domain[1] > 1) {
                            shiftInputVal = true;
                            shiftInputValBy = (-1 * domain[0]) + 1;
                            domain[1] = domain[1] + shiftInputValBy;
                            domain[0] = 1;
                        }
                        break;
                    default : scaler = d3.scale.linear();
                    }

                    // Invert domain if required
                    if(toInvert) {
                        domain = domain.reverse();
                        // if(shiftInputVal) {
                        //  shiftInputValBy = (-1 * domain[0]) + 1;
                        // }
                    }
                    scaler.domain(domain);
                    scaler.nice();
                    scaler.rangeRound([rangeMin, rangeMax / 2]);

                    if(shiftInputVal) {
                        //log fails if the bounds contain zero, since log 0 is infinity. So move bounds to solve this issue
                        var oldScaler = scaler;
                        scaler = function (val) {
                            return oldScaler(val + shiftInputValBy);
                        };
                        // range -> domain mapping (invert)
                        scaler.invert = function(val) {
                            return oldScaler.invert(val) - shiftInputValBy;
                        };
                    }
                    self.scalers[axis] = scaler;
                    scalerInfo.shiftInputValBy = shiftInputValBy;
                } else {
                    //Build an Ordinal Scale
                    self.isOrdinal[axis] = true;
                    scaler = d3.scale.ordinal();
                    scaler.domain(attrInfo.values);
                    scaler.rangePoints([rangeMin, rangeMax], 0);
                    self.scalers[axis] = scaler;
                    // Invert domain if required
                    if(toInvert) {
                        self.scalers[axis].domain(self.scalers[axis].domain().reverse());
                    }
                }
            } else {
                console.warn('Attribute does not exist on the nodes. attribName: %s, nodes: %O',
                    attribName, dataGraph.getAllNodes());
                console.warn('Reverting to DefaultAttribute on axis:' + axis);
                self.attr[axis] = defaultAttr[axis];
                self.setAxisAttr(self.attr[axis], axis, rangeMin, rangeMax);
            }
        }
    }

    function Geo() {
        var prefix = renderGraphfactory.getTweenPrefix();
        this.isGeo = true;
        this.map = null; // the leaflet object
        // This layout requries a valid leaflet object.
        // Until it is not there, this won't function
        this.isBuild = false;

        var defaultAttr = {
            x: 'Latitude',
            y: 'Longitude'
        };

        this.attr = {
            x: this.getRawLayoutData().xaxis || defaultAttr.x,
            y: this.getRawLayoutData().yaxis || defaultAttr.y
        };

        this.setMap = function setMap (map) {
            this.map = map;
            this.isBuild = true;
        };
        this.nodeT = function nodeT (node) {
            console.assert(this.isBuild, 'Geo layout not initialized.');
            this._commonNodeT(node);
            //sanitize lat lon
            var lat = node.attr[this.attr.x] ? parseFloat(node.attr[this.attr.x]) : 0;
            var lng = node.attr[this.attr.y] ? parseFloat(node.attr[this.attr.y]) : 0;

            var p = this.map.latLngToLayerPoint({
                lat: lat,
                lng: lng
            });
            node.x = p.x;
            node.y = p.y;
            // node[prefix+'x'] = p.x;
            // node[prefix+'y'] = p.y;
        };
        this.edgeT = function edgeT(edge) {
            this._commonEdgeT(edge);
        };
        this.setupLayoutFuncs.push(function setupCamera() {
            this.defCamera.x = this.camera.x;
            this.defCamera.y = this.camera.y;
            this.baseCamera = _.clone(this.camera);
        });
        /**
         * Converts lat/long camera to point camera
         * @return {Object} Point camera desc of the lat/long camera
         */
        this.getPointCamera = function() {
            console.assert(this.isBuild, 'Geo layout not initialized.');
            var center = window.L.latLng(this.camera.x, this.camera.y);
            center = this.map.latLngToLayerPoint(center);
            return {
                x : center.x,
                y : center.y,
                ratio : 1
            };
        };

        this.setAttrX = function setAttrX(attribName) {
            this.attr.x = attribName || 'Latitude';
        };
        this.setAttrY = function setAttrY(attribName) {
            this.attr.y = attribName || 'Longitude';
        };
    }

    function serializeCurrent() {
        // var sig = renderGraphfactory.sig();

        var savedLayout = {
            plotType: _currLayout.plotType,
            //Add other graph settings here and update getMapprSettings appropriately
            xaxis: _currLayout.attr.x || 'OriginalX',
            yaxis: _currLayout.attr.y || 'OriginalY',
            gridAttr: _currLayout.gridAttr,
            gridSortAttr: _currLayout.gridSortAttr,
            listAttrs: _currLayout.listAttrs,
            // listSortAttr: _currLayout.listSortAttr,
            // listSortReverse: _currLayout.listSortReverse,
            listSortAttrAr: _currLayout.listSortAttrAr,
            listSortReverseAr: _currLayout.listSortReverseAr,
            listCompareIds: _currLayout.listCompareIds,
            listColSizes: _currLayout.listColSizes,
            x_scaler_type : _.get(_currLayout, 'scalers.x_scaler_info.scalerType', 'linear'),
            x_scaler_base : _.get(_currLayout, 'scalers.x_scaler_info.base', 2),
            x_scaler_exponent : _.get(_currLayout, 'scalers.x_scaler_info.exponent', 2),

            y_scaler_type : _.get(_currLayout, 'scalers.y_scaler_info.scalerType', 'linear'),
            y_scaler_base : _.get(_currLayout, 'scalers.y_scaler_info.base', 2),
            y_scaler_exponent : _.get(_currLayout, 'scalers.y_scaler_info.exponent', 2)
        };
        //console.log('currentlayout.mapprSettings', _currLayout.mapprSettings);
        savedLayout.settings = _.cloneDeep(_currLayout.mapprSettings);

        var crg = dataGraph.getRenderableGraph();
        if(_currLayout.isGeo) {
            savedLayout.settings.savedZoomLevel = _currLayout.map.getZoom();
        } else {
            savedLayout.settings.savedZoomLevel = crg.zoomLevel;
        }
        console.log("Saved Zoom Level : ", savedLayout.settings.savedZoomLevel );
        console.log("Saved xaxis Attr : ", savedLayout.xaxis );
        console.log("Saved yaxis Attr : ", savedLayout.yaxis );
        console.log("Saved grid Attr : ", savedLayout.gridAttr );
        console.log("Saved grid Sorting Attr : ", savedLayout.gridSortAttr );
        console.log("Saved list Attr : ", savedLayout.listAttrs );
        // console.log("Saved list Attr : ", savedLayout.listSortAttr );
        // console.log("Saved list Attr : ", savedLayout.listSortReverse );
        console.log("Saved list Sort Attr Array : ", savedLayout.listSortAttrAr );
        console.log("Saved list Reverse Attr Array : ", savedLayout.listSortReverseAr );
        console.log("Saved list Compare Ids : ", savedLayout.listCompareIds );
        console.log("Saved list Compare Ids : ", savedLayout.listColSizes );
        return savedLayout;
    }

    function createDefaultLayout(layoutType, settings, camera) {
        console.log('Creating new layout of type: ' + layoutType);
        var layout = null;
        if (layoutType === 'scatterplot') {
            layout = _.cloneDeep(defaultScatterPlot);
        } else if(layoutType === 'geo'){
            layout = _.cloneDeep(defaultGeo);
        } else {
            layout = _.cloneDeep(defaultOriginalLayout);
            layout.plotType = layoutType;
        }
        _.assign(layout.settings, settings);
        if(layout.plotType === 'scatterplot') {
            layout.xaxis = 'OriginalX';
            layout.settings.xAxShow = true;
            layout.settings.xAxTickShow = true;

            layout.yaxis = 'OriginalY';
            layout.settings.yAxShow = true;
            layout.settings.yAxTickShow = true;
            layout.settings.invertY = true;
            layout.settings.scatterAspect = 0.5;
        }
        if(layout.plotType =='scatterplot' || layout.plotType == 'original') {
            layout.settings.savedZoomLevel = 0;
        }
        if(layout.plotType === 'geo') {
            layout.settings.minZoomLevel = 2;
            layout.settings.numZoomLevels = 13;
            layout.settings.disableAggregationLevel = 5;
        }
        var l = new Layout(layout, camera);
        l.snapshotId = null;
        return l;
    }

    function upgradeMapprSettings(oldSettings) {
        console.log('UPDATING mapprSettings...');
        var oldKeyNewKeyMap = {
            'nodeColor' : 'nodeColorStrat',
            'defaultNodeColor' : 'nodeColorDefaultValue',
            'nodeCycleCategoryColors' : 'nodeColorCycleCategoryColors',

            'nodeSize' : 'nodeSizeStrat',
            'nodeDefaultSize' : 'nodeSizeDefaultValue',
            'nodeSizeScale' : 'nodeSizeMultiplier',
            'minNodeSize':'nodeSizeMin',
            'maxNodeSize':'nodeSizeMax',
            // edges
            'edgeSize' : 'edgeSizeStrat',
            'edgeDefaultSize' : 'edgeSizeDefaultValue',
            'edgeSizeScale' : 'edgeSizeMultiplier',
            'minEdgeSize':'edgeSizeMin',
            'maxEdgeSize':'edgeSizeMax',

            'edgeColor' : 'edgeColorStrat',
            'defaultEdgeColor' : 'edgeColorDefaultValue',
            'edgeCycleCategoryColors' : 'edgeColorCycleCategoryColors'
        };
        var newSettings = _.mapKeys(oldSettings, function(val, key) {
            return oldKeyNewKeyMap[key] || key;
        });
        newSettings.version = 1.1;
        return newSettings;
    }

}
]);
