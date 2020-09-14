angular.module('common')
.factory('renderGraphfactory', ['$q',
function ($q) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    var API = {
        initGraph: initGraph,
        getSig: function() {
            return sigDefer.promise;
        },
        //Do not use.
        sig : function() {
            if(sig) {
                return sig;
            } else {
                throw 'Sigma not initialized';
            }
        },
        sigKill: function(){
            sig.kill();
            sig = null;
            sigDefer = $q.defer();
        },
        getGraph: function() {
            return sig.graph;
        },
        getDefaultSettings: function(){
            return settings;
        },
        updateSettings: function(settings){
            sig.settings(settings);
            sig.settings('defaultNodeColor', settings.nodeColorDefaultValue);
            sig.settings('nodeDefaultSize', settings.nodeSizeDefaultValue);
            sig.settings('minNodeSize', settings.nodeSizeMin);
            sig.settings('maxNodeSize', settings.nodeSizeMax);

            sig.settings('defaultEdgeColor', settings.edgeColorDefaultValue);
            sig.settings('edgeDefaultSize', settings.edgeSizeDefaultValue);
            sig.settings('minEdgeSize', settings.edgeSizeMin);
            sig.settings('maxEdgeSize', settings.edgeSizeMax);

            return sig;
        },
        redrawGraph: function(){
            if (sig) {
                sig.refresh();
            }
        },
        getRenderer: function() {
            if(sig) {
                return sig.renderers.graph;
            } else {
                throw 'sigma not initialized!';
            }
        },
        getRendererPrefix: function() {
            if(sig) {
                return sig.renderers.graph.options.prefix;
            } else {
                throw 'sigma not initialized!';
            }
        },
        updateCamera: function(camOpts) {
            if(sig) {
                _.extend(sig.cameras.cam1, camOpts);
            } else {
                sigDefer.promise.then(function(s) {
                    _.extend(s.cameras.cam1, camOpts);
                });
            }
        },
        // Enable / disable mouse
        disableMouse: function(){
            sig.settings('mouseEnabled', false);
            sig.settings('mouseClickEnabled', false);
        },
        enableMouse: function(){
            sig.settings('mouseEnabled', true);
            sig.settings('mouseClickEnabled', true);
        },
        disableMouseClick: function(){
            sig.settings('mouseClickEnabled', false);
        },
        enableMouseClick: function(){
            sig.settings('mouseClickEnabled', true);
        },
        registerInitHandler: function(name, func){
            handlers[name] = func;
        },
        /**
         * Gets the base64 encoded img of the scene.
         * BUG: Selections don't work correctly
         * TODO: Failes on webGL
         * @param  {Int} width  width of final image
         * @param  {Int} height [description]
         * @return {String}     base64 encoded dataURL of jpg 0.9
         */
        getDataURL: function(width,height){
            var url = "";
            try {
                url = this.getRenderer().getDataURL(width, height);
                return url;
            } catch (err) {
                console.error('Unable to capture image. Not supported for WebGL');
                return url;
            }
        },
        getTweenPrefix: function() {
            return 'tween_';
        }
    };




    /*************************************
    ********* Local Data *****************
    **************************************/
    var colorStr = window.mappr.utils.colorStr;

    var sig = null;
    var sigDefer = $q.defer();

    //Id of selects and graph renderers
    var graphId = 'graph';//, selectsId = 'selects';
    var cameraId = 'cam1';
    // var captors = ['mouse'];
    var handlers = {}; // Funcs which are executed post creation

    /**
     * Default sigma settings customized for mappr
     * @type {Object}
     */
    //LayoutService overrides these. need cleanup
    //Merged from dirSigma and plotter.js
    var settings = {
        drawGrid: false, // used to test whether the axis show correct values.
        autoRescale: false,
        enableCamera: true,
        doubleClickEnabled: false, // double click zoom removed.
        enableSelections: true,


        defaultLabelColor: colorStr([0, 0, 0]),
        labelHoverShadow: true,
        labelHoverShadowColor: colorStr([0, 255, 0]),
        labelHoverBGColor: 'default', // or 'node'
        defaultHoverLabelBGColor: colorStr([255, 255, 255]),
        labelHoverColor: 'default', //or 'node'
        defaultLabelHoverColor: colorStr([0, 0, 255]),

        //Active labels
        //   Label active background color:
        //   - 'node'
        //   - default (then defaultActiveLabelBGColor
        //              will be used instead)
        labelActiveBGColor: 'default',
        defaultActiveLabelBGColor: colorStr([255, 255, 255]), //'#fff',
        //   Label active shadow:
        labelActiveShadow: true,
        labelActiveShadowColor: colorStr([255, 0, 0]), //'#000',
        //   Label active color:
        //   - 'node'
        //   - default (then defaultLabelActiveColor
        //              will be used instead)
        labelActiveColor: 'default',
        defaultLabelActiveColor: colorStr([0, 255, 0]), //#000',
        activeFontStyle: '',

        //Node
        // nodeSizeScale: 1, //Node size scaling
        highlightRatio:  1.5, // Node scaling on hover
        selectionSizeRatio: 1.5, // Node scaling on selection  Doesn't work for now!

        //Hovered nodes
        drawNodes : false,
        drawBorder: true,
        borderSize: 2,
        // defaultNodeColor: colorStr([200, 200, 200]),
        defaultNodeBorderColor: colorStr([255, 255, 255]),
        nodeHoverColor: 'node', //or default
        defaultNodeHoverColor: colorStr([255, 255, 255]),

        // nodeCycleCategoryColors: true,
        // nodeCategoryColorsCount: 14,     // if > 0, number of category colors to use before cycling or switching to gray


        batchEdgesDrawing: true,
        hideEdgesOnMove: true,
        canvasEdgesBatchSize: 500,
        webglEdgesBatchSize: 10000,
        webglOversamplingRatio: 2,

        //Rescale settings
        scalingMode: 'outside',
        sideMargin: 0,

        //Captor settings
        mouseEnabled: true,
        mouseClickEnabled: true,
        mouseInertiaRatio: 1.1,
        zoomMax : 2,     // these are graph dependent now
        zoomMin : 0.01, // These are graph dependent now

        nodesPowRatio: 0.2,
        edgesPowRatio: 0.2
    };





    /*************************************
    ********* Core Functions *************
    **************************************/

    function initGraph(sigRoot, mapprSettings) {
        var createNewDefer = !sig;

        //initialize sigma
        sig = new sigma({
            renderers: [{
                id: graphId,
                container: sigRoot[0],
                //type: renderingEngine,
                //type: 'canvas',
                camera: cameraId
            }],
            middlewares: ['resize'],
            settings: settings
        });
        if(mapprSettings) {
            sig.settings(mapprSettings);
        }

        //sigma.misc.drawSelected.call(sig.renderers.selects, sig.renderers.selects.options.prefix);
        if(createNewDefer) {
            console.log('creating new defer');
            sigDefer.resolve(sig);
            sigDefer = $q.defer();
        }
        // Call each handler
        _.each(handlers,function(fn) {
            console.log('updating Handlers');
            fn(sig);
        });
        sigDefer.resolve(sig);
        return sig;
    }

    /**
     * Converts node's x,y to canvas x,y
     * @param  {[type]} node [description]
     * @return {[{x:, y:}]}      [Object containing x,y co-ordinates corresponding to canvas]
     */
    // function nodePosOnCanvas(node) {
    //     if(sig) {
    //         return sig.cameras[cameraId].cameraPosition(node.x, node.y);
    //     }
    // }

    // Public API here
    return API;
}
]);
