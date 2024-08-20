;(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw 'sigma is not declared';

  sigma.utils.pkg('sigma.renderers.common');

  /**
   * This function is the constructor of the webgl sigma's renderer.
   *
   * @param  {sigma.classes.graph}            graph    The graph to render.
   * @param  {sigma.classes.camera}           camera   The camera.
   * @param  {configurable}           settings The sigma instance settings
   *                                           function.
   * @param  {object}                 object   The options object.
   * @return {sigma.renderers.canvas}          The renderer instance.
   */
  sigma.renderers.webgl = function(graph, camera, settings, options) {
    sigma.renderers.extend(sigma.renderers.webgl);
    if (typeof options !== 'object')
      throw 'sigma.renderers.webgl: Wrong arguments.';

    if (!(options.container instanceof HTMLElement))
      throw 'Container not found.';

    var k,
        i,
        l,
        a,
        fn,
        _self = this;

    sigma.classes.dispatcher.extend(this);

    Object.defineProperty(this, 'conradId', {
      value: sigma.utils.id()
    });

    // Initialize main attributes:
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

    // Find the prefix:
    this.options.readPrefix = this.camera.readPrefix;
    this.options.prefix = this.camera.prefix;
    //this.options.prefix = 'renderer' + this.conradId + ':';

    // Initialize programs hash
    Object.defineProperty(this, 'nodePrograms', {
      value: {}
    });
    Object.defineProperty(this, 'edgePrograms', {
      value: {}
    });
    Object.defineProperty(this, 'clusterPrograms', {
      value: {}
    });
    Object.defineProperty(this, 'nodeFloatArrays', {
      value: {}
    });
    Object.defineProperty(this, 'edgeFloatArrays', {
      value: {}
    });
    Object.defineProperty(this, 'clusterFloatArrays', {
      value: {}
    });

    // Initialize the DOM elements:
//    if ( !this.settings('batchEdgesDrawing') ) {
      this.initDOM('canvas', 'scene', true);
      this.contexts.edges = this.contexts.scene;
      this.contexts.nodes = this.contexts.scene;
      this.contexts.clusters = this.contexts.scene;
//    } else {
//      this.initDOM('canvas', 'edges', true);
//      this.initDOM('canvas', 'scene', true);
//      this.contexts.nodes = this.contexts.scene;
//    }

    this.commonInitialization();
  };

  // get correct edge renderer, clear shader programs if there's been a change in renderer
  //
  sigma.renderers.webgl.prototype.getEdgeRenderer = function(t) {
    if( t == 'def' ) {
      var k, isCurved = this.settings('edgeCurvature') > 0;
      if( isCurved != this.isCurved ) {
        this.isCurved = isCurved;
        // Empty edge programs:
        for (k in this.edgePrograms)
          delete this.edgePrograms[k];
      }
      return isCurved ? sigma.webgl.edges.curved : sigma.webgl.edges.straight;
    }
    return sigma.webgl.edges[a];
  };

  /**
   * This method will generate the nodes and edges float arrays. This step is
   * separated from the "render" method, because to keep WebGL efficient, since
   * all the camera and middlewares are modelised as matrices and they do not
   * require the float arrays to be regenerated.
   *
   * Basically, when the user moves the camera or applies some specific linear
   * transformations, this process step will be skipped, and the "render"
   * method will efficiently refresh the rendering.
   *
   * And when the user modifies the graph colors or positions (applying a new
   * layout or filtering the colors, for instance), this "process" step will be
   * required to regenerate the float arrays.
   *
   * @return {sigma.renderers.webgl} Returns the instance itself.
   */
  sigma.renderers.webgl.prototype.process = function() {
    var MAXEDGES = 5000;
    var a,
        i,
        l,
        k,
        n,
        renderer,
        graph = this.graph,
        options = sigma.utils.extend(options, this.options);

    // Find which nodes and edges are on screen:
    var nodesOnScreen = this.camera.quadtree.area(
      this.camera.getRectangle(this.width, this.height)
    );
    var nodesOnScreenIndex = {};
    _.each(nodesOnScreen, function(n) {
        nodesOnScreenIndex[n.id] = n;
    });

    // calculate cluster circles depending on the nodes on screen
    var clusterAttr = this.settings(options, 'nodeClusterAttr');
    var clustersOnScreen = graph.nodes().reduce((acc, node) => {
      const key = node.attr[clusterAttr];
      let item = acc.find(x => x.key === key);
      if (!item) {
        item = { key: key, nodes: [node] };
        acc.push(item);
      } else {
        item.nodes.push(node);
      }

      return acc;
    }, []);

    // calculate subcluster circles depending on the nodes on screen
    var subClusterAttr = this.settings(options, 'nodeSubclusterAttr');
    var subClustersOnScreen = [];
    if (subClusterAttr) {
      subClustersOnScreen = graph.nodes().reduce((acc, node) => {
        const clusterKey = node.attr[clusterAttr];
        const key = node.attr[subClusterAttr];
        let item = acc.find(x => x.clusterKey === clusterKey && x.key === key);
        if (!item) {
          item = { key: key, clusterKey: clusterKey, nodes: [node] };
          acc.push(item);
        } else {
          item.nodes.push(node);
        }
  
        return acc;
      }, []);
    }

    // only draw edge if one end is on the screen
    for (a = graph.edges(), i = 0, l = a.length; i < l; i++) {
      var e = a[i];
      e.onScreen = (nodesOnScreenIndex[e.source] !== undefined || nodesOnScreenIndex[e.target] !== undefined);
    }

    // Empty float arrays:
    for (k in this.nodeFloatArrays)
      delete this.nodeFloatArrays[k];

    for (k in this.edgeFloatArrays)
      delete this.edgeFloatArrays[k];

    for (k in this.clusterFloatArrays)
      delete this.clusterFloatArrays[k];

    // Sort edges and nodes per types:
    for (a = graph.edges(), i = 0, n = 0, l = a.length; i < l && n < MAXEDGES; i++) {
      k = (a[i].type && sigma.webgl.edges[a[i].type]) ? a[i].type : 'def';

      if (!this.edgeFloatArrays[k])
        this.edgeFloatArrays[k] = {
          edges: []
        };

      if(a[i].onScreen) {
        this.edgeFloatArrays[k].edges.push(a[i]);
        n++;
      }
    }

    for (a = graph.nodes(), i = 0, l = a.length; i < l; i++) {
      k = (a[i].type && sigma.webgl.nodes[a[i].type]) ? k : 'def';

      if (!this.nodeFloatArrays[k])
        this.nodeFloatArrays[k] = {
          nodes: []
        };

      this.nodeFloatArrays[k].nodes.push(a[i]);
    }

    for (a = clustersOnScreen, i = 0, l = a.length; i < l; i++) {
      k = sigma.webgl.clusters.def;

      if (!this.clusterFloatArrays[k])
        this.clusterFloatArrays[k] = {
          clusters: []
        };

      this.clusterFloatArrays[k].clusters.push(a[i]);
    }

    for (a = subClustersOnScreen, i = 0, l = a.length; i < l; i++) {
      k = sigma.webgl.clusters.def;

      if (!this.clusterFloatArrays[k])
        this.clusterFloatArrays[k] = {
          clusters: []
        };

      this.clusterFloatArrays[k].clusters.push(a[i]);
    }

    if (this.settings('drawClustersCircle')) {
      // push clusters
      for(k in this.clusterFloatArrays) {
        renderer = sigma.webgl.clusters.def;

        for (a = this.clusterFloatArrays[k].clusters, i = 0, l = a.length; i < l; i++) {
          if (!this.clusterFloatArrays[k].array)
            this.clusterFloatArrays[k].array = new Float32Array(
              a.length * renderer.POINTS * renderer.ATTRIBUTES
            );
  
            renderer.addCluster(
              a[i],
              this.clusterFloatArrays[k].array,
              i * renderer.POINTS * renderer.ATTRIBUTES,
              options.readPrefix,
              this.settings
            );
        }
      }
    }

    // Push edges:
    for (k in this.edgeFloatArrays) {
      renderer = this.getEdgeRenderer(k);

      for (a = this.edgeFloatArrays[k].edges, i = 0, l = a.length; i < l; i++) {
        if (!this.edgeFloatArrays[k].array)
          this.edgeFloatArrays[k].array = new Float32Array(
            a.length * renderer.POINTS * renderer.ATTRIBUTES
          );

        // Just check that the edge and both its extremities are visible:
        if (
          !a[i].hidden &&
          !graph.nodes(a[i].source).hidden &&
          !graph.nodes(a[i].target).hidden
        )
          renderer.addEdge(
            a[i],
            graph.nodes(a[i].source),
            graph.nodes(a[i].target),
            this.edgeFloatArrays[k].array,
            i * renderer.POINTS * renderer.ATTRIBUTES,
            options.readPrefix,
            this.settings
          );
      }
    }

    // Push nodes:
    for (k in this.nodeFloatArrays) {
      renderer = sigma.webgl.nodes[k];

      for (a = this.nodeFloatArrays[k].nodes, i = 0, l = a.length; i < l; i++) {
        if (!this.nodeFloatArrays[k].array)
          this.nodeFloatArrays[k].array = new Float32Array(
            a.length * renderer.POINTS * renderer.ATTRIBUTES
          );

        // Just check that the node is visible:
        if (
          !a[i].hidden
        )
          renderer.addNode(
            a[i],
            this.nodeFloatArrays[k].array,
            i * renderer.POINTS * renderer.ATTRIBUTES,
            options.readPrefix,
            this.settings
          );
      }
    }

    return this;
  };

  /**
   * This method renders the graph. It basically calls each program (and
   * generate them if they do not exist yet) to render nodes and edges, batched
   * per renderer.
   *
   * As in the canvas renderer, it is possible to display edges, nodes and / or
   * labels in batches, to make the whole thing way more scalable.
   *
   * @param  {?object}               params Eventually an object of options.
   * @return {sigma.renderers.webgl}        Returns the instance itself.
   */
  sigma.renderers.webgl.prototype.render = function(params) {
    var a,
        i,
        l,
        k,
        o,
        index = {},
        program,
        renderer,
        self = this,
        graph = this.graph,
        nodes = this.graph.nodes,
        nodesGl = this.contexts.nodes,
        edgesGl = this.contexts.edges,
        clustersGl = this.contexts.clusters,
        matrix = this.camera.getMatrix(),
        options = sigma.utils.extend(params, this.options),
        drawLabels = this.settings(options, 'drawLabels'),
        drawEdges = this.settings(options, 'drawEdges'),
        drawNodes = this.settings(options, 'drawNodes'),
        drawClusters = this.settings(options, 'drawClustersCircle'),
        drawGrid = this.settings(options, 'drawGrid'),
        drawBorder = this.settings('drawBorder'),
        tweening = this.settings(options, 'tweening'),
        isMoving = (this.camera.isAnimated || this.camera.isMoving),
        scalingRatio = this.displayScale * this.settings('webglOversamplingRatio'),
//        scalingRatio = this.settings('webglOversamplingRatio'),
        optimize = false, // If camera is moving or other stuff happening, then optimize draw calls
        embedSettings = this.settings.embedObjects(options, {
          prefix: this.options.prefix,
          inSelMode: _.any(nodes(),'isSelected'),
          inPop: _.any(nodes(),'inPop')
        });

    // Check for tweening or 'hideEdgesOnMove':
    if (tweening || (this.settings(options, 'hideEdgesOnMove') && isMoving) ) {
      drawLabels = false;
    //  drawEdges = false;
      optimize = true;
    }

    if( !isMoving || embedSettings('inPop') ) {   // compute things needed if the camera is stationary so non-webgl components are rendered
      // Find which nodes are on screen:
      this.nodesOnScreen = this.camera.quadtree.area(
        this.camera.getRectangle(this.width, this.height)
      );
      // Apply the camera's view:
      this.camera.applyView(
        undefined,
        this.options.prefix,
        {
          width: this.width,
          height: this.height
        }
      );

      for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++)
        index[a[i].id] = a[i];
      // Round off node canvas positions and sizes. Otherwise D3 provides incorrect positions
      for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++) {
        var n = a[i];
        n[this.options.prefix + 'x'] = Math.round(n[this.options.prefix + 'x']);
        n[this.options.prefix + 'y'] = Math.round(n[this.options.prefix + 'y']);
        n[this.options.prefix + 'size'] = Math.round(n[this.options.prefix + 'size']);
      }

    }

    // Clear and resize canvases:
    this.clear();

    // Translate matrix to [width/2, height/2]:
    matrix = sigma.utils.matrices.multiply(
      matrix,
      sigma.utils.matrices.translation(this.width / 2, this.height / 2)
    );

    var drawNodesFn = function() {
      // Enable blending:
      nodesGl.blendFunc(nodesGl.SRC_ALPHA, nodesGl.ONE_MINUS_SRC_ALPHA);
      nodesGl.enable(nodesGl.BLEND);
      //nodesGl.disable(nodesGl.DEPTH_TEST);
      for (k in this.nodeFloatArrays) {
        renderer = sigma.webgl.nodes[k];

        // Check program:
        if (!this.nodePrograms[k])
          this.nodePrograms[k] = renderer.initProgram(nodesGl);
        // Render
        if (this.nodeFloatArrays[k]) {
          nodesGl.useProgram(this.nodePrograms[k]);
          renderer.render(
            nodesGl,
            this.nodePrograms[k],
            this.nodeFloatArrays[k].array,
            {
              settings: this.settings,
              matrix: matrix,
              width: this.width,
              height: this.height,
              ratio: this.camera.ratio,
              scalingRatio: scalingRatio,
              drawBorder: drawBorder,
              displayScale: this.displayScale
            }
          );
        }
      }
    };

    if (drawClusters) {
      // Enable blending:
      clustersGl.blendFunc(clustersGl.SRC_ALPHA, clustersGl.ONE_MINUS_SRC_ALPHA);
      clustersGl.enable(clustersGl.BLEND);
      for (k in this.clusterFloatArrays) {
        renderer = sigma.webgl.clusters.def;

        // Check program:
        if (!this.clusterPrograms[k])
          this.clusterPrograms[k] = renderer.initProgram(clustersGl);
        // Render
        if (this.clusterFloatArrays[k]) {
          clustersGl.useProgram(this.clusterPrograms[k]);
          renderer.render(
            clustersGl,
            this.clusterPrograms[k],
            this.clusterFloatArrays[k].array,
            {
              settings: this.settings,
              matrix: matrix,
              width: this.width,
              height: this.height,
              ratio: this.camera.ratio,
              scalingRatio: scalingRatio,
              drawBorder: drawBorder,
              displayScale: this.displayScale
            }
          );
        }
      }
    }

    if (drawEdges) {
      // Enable blending:
      edgesGl.blendFunc(edgesGl.SRC_ALPHA, edgesGl.ONE_MINUS_SRC_ALPHA);
      edgesGl.enable(edgesGl.BLEND);
      //edgesGl.disable(edgesGl.DEPTH_TEST);

      var a,
          k,
          i,
          arr,
          end,
          start,
          renderer,
          currentProgram;

      a = Object.keys(this.edgeFloatArrays);
      if (a.length) {
        i = 0;
        renderer = this.getEdgeRenderer(a[i]);
        arr = this.edgeFloatArrays[a[i]].array;
        if( arr !== undefined ) {
          start = 0;
          end = arr.length / renderer.ATTRIBUTES;
          // Check program:
          if (!this.edgePrograms[a[i]])
            this.edgePrograms[a[i]] = renderer.initProgram(edgesGl);
          if (start < end) {
            edgesGl.useProgram(this.edgePrograms[a[i]]);
            renderer.render(
              edgesGl,
              this.edgePrograms[a[i]],
              arr,
              {
                settings: this.settings,
                matrix: matrix,
                width: this.width,
                height: this.height,
                ratio: this.camera.ratio,
                scalingRatio: scalingRatio,
                start: start,
                count: end - start
              }
            );
          }
        }
      }
    }

    if (drawNodes ) {
      drawNodesFn.call(this);
    }
    // render labels in D3
    return sigma.renderers.common.prototype.render.call(this, drawLabels, optimize, embedSettings);
  };

  /**
   * This method clears each canvas.
   *
   * @return {sigma.renderers.webgl} Returns the instance itself.
   */
  sigma.renderers.webgl.prototype.clear = function(clearAll) {
    sigma.renderers.common.prototype.clear.call(this, clearAll);
    this.contexts.nodes.clear(this.contexts.nodes.COLOR_BUFFER_BIT);
    this.contexts.edges.clear(this.contexts.edges.COLOR_BUFFER_BIT);
    return this;
  };

  sigma.utils.pkg('sigma.webgl.nodes');
  sigma.utils.pkg('sigma.webgl.edges');
  sigma.utils.pkg('sigma.webgl.clusters');

  // If WebGL is enabled, set new default renderer
  if (!!window.WebGLRenderingContext) {
    var canvas = document.createElement('canvas');
    if( !!(canvas.getContext('webgl', { preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true })) ) {
      sigma.renderers.def = sigma.renderers.webgl;
    }
  }

}).call(this);
