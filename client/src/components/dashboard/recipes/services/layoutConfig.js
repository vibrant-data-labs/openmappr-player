angular.module('mappr')
.service('layoutConfig', ['athenaService',
function (athenaService) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getLayouts = getLayouts;


    /*************************************
    ********* Local Data *****************
    **************************************/
    var layouts = [{
        name: "Original",
        plotType: 'original',
        options: {
            primary: [],
            optional: []
        }
    }, {
        name: "ScatterPlot",
        plotType: 'scatterplot',
        options: {
            primary: [{
                key: 'xAttr',
                title: 'xAttr',
                type: 'attr-select',
                class: 'node-setting',
                tooltip: 'Attribute to use for X-Axis',
                input_value: 'OriginalX',
                enabled: true
            }, {
                key: 'yAttr',
                title: 'yAttr',
                type: 'attr-select',
                class: 'node-setting',
                tooltip: 'Attribute to use for Y-Axis',
                input_value: 'OriginalY',
                enabled: true
            }, {
                key: 'xScaleType',
                title: 'X-Axis Scale Strategy',
                type: 'select',
                //values: ['linear', 'log', 'exponential'],
                values: ['linear', 'log'],
                class: 'node-setting',
                tooltip: 'Scaler to use for generating values',
                input_value: 'linear',
                enabled: true
            }, {
                key: 'xScaleExponent',
                title: 'X-Axis Scale exponent(power)',
                type: 'input',
                class: 'node-setting',
                tooltip: 'Define the exponent for exponential scaling',
                input_value: 2,
                enabled: false
            }, {
                key: 'xScaleBase',
                title: 'X-Axis Log scale Base',
                type: 'input',
                class: 'node-setting',
                tooltip: 'Define the base for log scaling',
                input_value: 10,
                enabled: false
            }, {
                key: 'yScaleType',
                title: 'Y-Axis Scale Strategy',
                type: 'select',
                //values: ['linear', 'log', 'exponential'],
                values: ['linear', 'log'],
                class: 'node-setting',
                tooltip: 'Scaler to use for generating values',
                input_value: 'linear',
                enabled: true
            }, {
                key: 'yScaleExponent',
                title: 'Y-Axis Scale exponent(power)',
                type: 'input',
                class: 'node-setting',
                tooltip: 'Define the exponent for exponential scaling',
                input_value: 2,
                enabled: false
            }, {
                key: 'yScaleBase',
                title: 'Y-Axis Log scale Base',
                type: 'input',
                class: 'node-setting',
                tooltip: 'Define the base for log scaling',
                input_value: 10,
                enabled: false
            }],
            optional: [{
                key: 'xAxShow',
                title: 'Show X-Axis',
                type: 'bool',
                class: 'stage-setting',
                tooltip: 'Show the X-Axis',
                enabled: true
            }, {
                key: 'xAxTickShow',
                title: 'Show X-Divs',
                type: 'bool',
                class: 'stage-setting',
                tooltip: 'Show the X-Axis Divisions',
                enabled: true
            }, {
                key: 'xAxLabel',
                title: 'X-Label',
                type: 'text-input',
                class: 'stage-setting',
                tooltip: 'Show the X-Axis Label',
                enabled: true
            }, {
                key: 'xAxTooltip',
                title: 'X-Tooltip',
                type: 'text-input',
                class: 'stage-setting',
                tooltip: 'The Tooltip for the X-Axis',
                enabled: true
            }, {
                key: 'invertX',
                title: 'Invert X',
                type: 'bool',
                class: 'stage-setting',
                tooltip: 'Invert the X-Axis Divisions',
                enabled: true
            }, {
                key: 'yAxShow',
                title: 'Show Y-Axis',
                type: 'bool',
                class: 'stage-setting',
                tooltip: 'Show the Y-Axis',
                enabled: true
            }, {
                key: 'yAxTickShow',
                title: 'Show Y-Divs',
                type: 'bool',
                class: 'stage-setting',
                tooltip: 'Show the Y-Axis Divisions',
                enabled: true
            }, {
                key: 'yAxLabel',
                title: 'Y-Label',
                type: 'text-input',
                class: 'stage-setting',
                tooltip: 'Show the Y-Axis Label',
                enabled: true
            }, {
                key: 'yAxTooltip',
                title: 'Y-Tooltip',
                type: 'text-input',
                class: 'stage-setting',
                tooltip: 'The Tooltip for the Y-Axis',
                enabled: true
            }, {
                key: 'invertY',
                title: 'Invert Y',
                type: 'bool',
                class: 'stage-setting',
                tooltip: 'Invert the Y-Axis Divisions',
                enabled: true
            }, {
                key: 'scatterAspect',
                title: 'Aspect ratio',
                type: 'scale',
                min: 0,
                max: 1,
                multiplier: 1,
                class: 'stage-setting',
                tooltip: 'Scatterplot aspect ratio',
                enabled: true
            }]
        }
    }, {
        name: 'Geospatial',
        plotType: 'geo',
        options: {
            primary: [],
            optional: [{
                key: 'mapboxMapID',
                title: 'Map Style',
                type: 'select',
                values: ['vibrantdata.ioeefmpb', 'vibrantdata.j5c7ofm2', 'vibrantdata.ic45fi91', 'vibrantdata.jjkpgbkp', 'vibrantdata.oidk9gmi'],
                class: 'stage-setting',
                tooltip: 'The ID for the Mapbox Tiles',
                enabled: true
            }]
        }
    }];

    /*************************************
    ********* Core Functions *************
    **************************************/

    //copied directly from ctrlLayoutPanel
    function convert_athena_opts_to_graphStyle_opts(opt) {
        opt.class = 'stage-setting';
        opt.tooltip = opt.description;
        opt.enabled = true;
    }

    function getLayouts() {
        return athenaService.fetchAlgos()
            .then(function (algos) {
                var layoutAlgos = _.filter(algos, function (algo) {
                    return algo.name.indexOf('layout') !== -1; // all athena algos which contain 'layout' are layout algos
                });

                _.each(layoutAlgos, function (algo) {
                    var options = _.cloneDeep(algo.options);
                    // init options here
                    _.each(options, function (opt) {
                        convert_athena_opts_to_graphStyle_opts(opt);
                        //may want to add these defaults into this file (instead of in mapprSettings)
                        // if (opt.default != null) {
                        //     if (algo.name == 'layout_clustered' && opt.key == 'clustering') {
                        //         opt.input_value = _.get($scope.mapprSettings, 'nodeColorAttr') || opt.default;
                        //     } else {
                        //         opt.input_value = opt.default;
                        //     }
                        // }
                    });
                    layouts.push({
                        name: algo.title,
                        plotType: "layout_generator_" + algo.name,
                        options: {
                            primary: options
                        },
                        //unsure if needed, but in layoutpanel
                        algo: algo
                    });
                });

                return layouts;

            });
    }


}
]);
