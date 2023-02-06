;(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw 'sigma is not declared';

  if (typeof conrad === 'undefined')
    throw 'conrad is not declared';

  // Initialize packages:
  sigma.utils.pkg('sigma.renderers.common');

  /**
   * This function is the constructor of the canvas sigma's renderer.
   *
   * @param  {sigma.classes.graph}            graph    The graph to render.
   * @param  {sigma.classes.camera}           camera   The camera.
   * @param  {configurable}           settings The sigma instance settings
   *                                           function.
   * @param  {object}                 object   The options object.
   * @return {sigma.renderers.canvas}          The renderer instance.
   */
  sigma.renderers.canvas = function(graph, camera, settings, options) {
    sigma.renderers.extend(sigma.renderers.canvas);
    if (typeof options !== 'object')
      throw 'sigma.renderers.canvas: Wrong arguments.';

    if (!(options.container instanceof HTMLElement))
      throw 'Container not found.';

    var k,
        i,
        l,
        a,
        fn,
        self = this;

    sigma.classes.dispatcher.extend(this);

    // Initialize main attributes:
    Object.defineProperty(this, 'conradId', {
      value: sigma.utils.id()
    });
    this.graph = graph;
    this.camera = camera;
    this.contexts = {};
    this.domElements = {};
    this.d3Sel = {};
    this.options = options;
    this.container = this.options.container;
    this.settings = (
        typeof options.settings === 'object' &&
        options.settings
      ) ?
        settings.embedObjects(options.settings) :
        settings;

    // Node indexes:
    this.nodesOnScreen = [];
    this.edgesOnScreen = [];

//    this.shiftKey = false;

    // Conrad related attributes:
    this.jobs = {};

    // Find the prefix:
    this.options.prefix = 'renderer' + this.conradId + ':';

    // Initialize the DOM elements:
    if ( !this.settings('batchEdgesDrawing') ) {
      this.initDOM('canvas', 'scene');
      this.contexts.edges = this.contexts.scene;
      this.contexts.nodes = this.contexts.scene;
      this.contexts.labels = this.contexts.scene;
    } else {
      this.initDOM('canvas', 'edges');
      this.initDOM('canvas', 'scene');
      this.contexts.nodes = this.contexts.scene;
      this.contexts.labels = this.contexts.scene;
    }
    /*
    this.initDOM('canvas', 'selections'); // For selections
    //d3 stuff
    this.initDOM('div', 'd3-selections');
    this.initDOM('div', 'd3-labels');
    this.initDOM('div', 'd3-hovers');

    this.d3Sel.labels = _.once(function() {
      return d3.select(self.domElements['d3-labels']);
    });
    this.d3Sel.selections = _.once(function() {
      return d3.select(self.domElements['d3-selections']);
    });
    this.d3Sel.hovers = _.once(function() {
      return d3.select(self.domElements['d3-hovers']);
    });
    
    this.initDOM('canvas', 'mouse');
    this.contexts.hover = this.contexts.mouse;

    // Initialize captors:
    this.captors = [];
    a = this.options.captors || [sigma.captors.mouse2, sigma.captors.touch];
    for (i = 0, l = a.length; i < l; i++) {
      fn = typeof a[i] === 'function' ? a[i] : sigma.captors[a[i]];
      this.captors.push(
        new fn(
          this.domElements.mouse,
          this.camera,
          this.settings
        )
      );
    }

    // Bind resize:
    window.addEventListener(
      'resize',
      this.boundResize = this.resize.bind(this),
      false
    );

    // Deal with sigma events:
    sigma.misc.bindEvents.call(this, this.options.prefix);
    sigma.misc.bindLeafletEvents.call(this, this.options.prefix);
    //sigma.misc.drawOnlyHovers.call(this, this.options.prefix);
    //sigma.misc.drawSelected.call(this, this.options.prefix);

    // Bind zoomIn zoomOut Events
    for (i = 0, l = this.captors.length; i < l; i++) {
      this.captors[i].bind('zoomIn', function(e) {
        self.dispatchEvent('zoomIn', e.data);
      });
      this.captors[i].bind('zoomOut', function(e) {
        self.dispatchEvent('zoomOut', e.data);
      });
    }
    this.resize(false);
    */
    this.commonInitialization();
  };

  /**
   * This method renders the graph on the canvases.
   *
   * @param  {?object}                options Eventually an object of options.
   * @return {sigma.renderers.canvas}         Returns the instance itself.
   */
  sigma.renderers.canvas.prototype.render = function(options) {
    sigma.renderers.extend(sigma.renderers.canvas);
    options = options || {};

    var a,
        i,
        k,
        l,
        o,
        id,
        end,
        job,
        start,
        edges,
        renderers,
        rendererType,
        batchSize,
        timestart,
        index = {},
        graph = this.graph,
        nodes = this.graph.nodes,
        prefix = this.options.prefix || '',
        drawEdges = this.settings(options, 'drawEdges'),
        drawNodes = this.settings(options, 'drawNodes'),
        drawLabels = this.settings(options, 'drawLabels'),
        drawGrid = this.settings(options, 'drawGrid'),
        tweening = this.settings(options, 'tweening'),
        optimize = false, // If camera is moving or other stuff happening, then optimize draw calls
        embedSettings = this.settings.embedObjects(options, {
          prefix: this.options.prefix,
          inSelMode: _.any(nodes(),'isSelected')
        });

    // Check the 'hideEdgesOnMove' setting:
    if (this.settings(options, 'hideEdgesOnMove'))
      if (this.camera.isAnimated || this.camera.isMoving) {
        drawEdges = false;
        optimize = true;
      }
    if(tweening) {
      drawEdges = false;
      optimize = true;
    }

    // Apply the camera's view:
    this.camera.applyView(
      undefined,
      this.options.prefix,
      {
        width: this.width,
        height: this.height
      }
    );

    // Clear canvases:
    this.clear();

    // Kill running jobs:
    for (k in this.jobs)
      if (conrad.hasJob(k))
        conrad.killJob(k);

    // Find which nodes are on screen:
    this.edgesOnScreen = [];
    this.nodesOnScreen = this.camera.quadtree.area(
      this.camera.getRectangle(this.width, this.height)
    );

    for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++)
      index[a[i].id] = a[i];
    // Round off node canvas positions and sizes. Otherwise D3 provides incorrect positions
    for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++) {
      a[i][this.options.prefix + 'x'] = Math.round(a[i][this.options.prefix + 'x']);
      a[i][this.options.prefix + 'y'] = Math.round(a[i][this.options.prefix + 'y']);
      a[i][this.options.prefix + 'size'] = Math.round(a[i][this.options.prefix + 'size']);
    }

    // Draw edges:
    // - If settings('batchEdgesDrawing') is true, the edges are displayed per
    //   batches. If not, they are drawn in one frame.
    if (drawEdges) {
      //console.log('[renderer]Drawing edges');
      // First, let's identify which edges to draw. To do this, we just keep
      // every edges that have at least one extremity displayed according to
      // the quadtree and the "hidden" attribute. We also do not keep hidden
      // edges.
      for (a = graph.edges(), i = 0, l = a.length; i < l; i++) {
        o = a[i];
        if (
          (index[o.source] || index[o.target]) &&
          //(index[o.source][prefix +'size'] && index[o.target][prefix +'size']) &&
          (!o.hidden && !nodes(o.source).hidden && !nodes(o.target).hidden)
        )
          this.edgesOnScreen.push(o);
      }

      // If the "batchEdgesDrawing" settings is true, edges are batched:
      if (this.settings(options, 'batchEdgesDrawing')) {
        id = 'edges_' + this.conradId;
        batchSize = embedSettings('canvasEdgesBatchSize');

        edges = this.edgesOnScreen;
        l = edges.length;

        start = 0;
        end = Math.min(edges.length, start + batchSize);

        job = function() {
          renderers = sigma.canvas.edges;
          for (i = start; i < end; i++) {
            o = edges[i];
            (renderers[o.type] || renderers.def)(
              o,
              index[o.source] || nodes(o.source),
              index[o.target] || nodes(o.target),
              //graph.nodes(o.source),
              //graph.nodes(o.target),
              this.contexts.edges,
              embedSettings,
              this.displayScale
            );
          }

          // Catch job's end:
          if (end === edges.length) {
            delete this.jobs[id];
            return false;
          }

          start = end + 1;
          end = Math.min(edges.length, start + batchSize);
          return true;
        };

        this.jobs[id] = job;
        conrad.addJob(id, job.bind(this));

      // If not, they are drawn in one frame:
      } else {
        renderers = sigma.canvas.edges;
        for (a = this.edgesOnScreen, i = 0, l = a.length; i < l; i++) {
          o = a[i];
          (renderers[o.type] || renderers.def)(
            o,
            graph.nodes(o.source),
            graph.nodes(o.target),
            this.contexts.edges,
            embedSettings,
            this.displayScale
          );
        }
      }
    }

    if(drawGrid) {
      var _ctx = this.contexts.nodes;
      _ctx.beginPath();
      // center x 
      _ctx.moveTo(0,this.height / 2);
      _ctx.lineTo(this.width,this.height / 2);

      _ctx.moveTo(0,this.height / 4);
      _ctx.lineTo(this.width,this.height / 4);

      _ctx.moveTo(this.width / 2 , 0);
      _ctx.lineTo(this.width / 2,this.height);

      _ctx.moveTo(this.width / 4 , 0);
      _ctx.lineTo(this.width / 4,this.height);
      _ctx.stroke();
    }
    
    // - No batching
    if (drawNodes) {
      renderers = sigma.canvas.nodes;
      for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++)
        if (!a[i].hidden)
          (renderers[a[i].type] || renderers.def)(
            a[i],
            this.contexts.nodes,
            embedSettings,
            this.displayScale
          );
    }
    //console.log('Render graph: Node finish: %i', Date.now()-timestart);
    
    //Draw Labels in D3. Reject aggregated nodes
    return sigma.renderers.common.prototype.render.call(this, drawLabels, optimize, embedSettings);
  };

  sigma.utils.pkg('sigma.canvas.nodes');
  sigma.utils.pkg('sigma.canvas.edges');

  // If WebGL is enabled, set new default renderer
  var gotWebGL = false;
  if (!!window.WebGLRenderingContext) {
    var canvas = document.createElement('canvas');
    if( !!(canvas.getContext('webgl', { preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true })) ) {
      gotWebGL = true;
    }
  }
  if( gotWebGL == false ) {
    sigma.renderers.def = sigma.renderers.canvas;    
  }

}).call(this);
