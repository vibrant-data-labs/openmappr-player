;(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw 'sigma is not declared';

  if (typeof conrad === 'undefined')
    throw 'conrad is not declared';

  // Initialize packages:
  sigma.utils.pkg('sigma.renderers.common');
  sigma.utils.pkg('sigma.labels');

  var leftPanelWidth = 432;

  //
  // Label Functions
  //
  var labelFuncCache = {};
  function defLabelFunc(node){
    return node.label;
  }
  function labelFunc(labelAttribName) {
    var fn = defLabelFunc;

    if(labelAttribName && labelAttribName !== 'OriginalSize'){
        //No need to recreate thousands of similar functions
        if(labelFuncCache[labelAttribName]) {
            labelFuncCache[labelAttribName] = function attribLabelFunc (node) {
                return node.attr[labelAttribName].value;
            };
        }
        fn = labelFuncCache[labelAttribName];
    }

    return fn;
  }
  sigma.labels.labelFuncCache = labelFuncCache;
  sigma.labels.labelFunc = labelFunc;

  // function serializeCbs(nodes, fn_err_success, onFinish) {
  //   var results = [];
  //   results.length = nodes.length;
  //   function _runner (idx) {
  //     if(idx < nodes.length) {
  //       fn_err_success(nodes[idx], function(err, success) {
  //         if(success) {
  //           results.push(nodes[idx]);
  //         }
  //         _runner(idx + 1);
  //       });
  //     } else {
  //       onFinish(results);
  //     }
  //   }
  //   _runner(0);
  // }

  // reuse webgl canvas when new networks are loaded
  // this means there can be only one sigma object at a time
  // but works around bug with webGl contexts not being cleared out when canvas is discarded
  //
  sigma.renderers.webglcanvas = undefined;

  sigma.renderers.getGLCanvas = function() {
    if(!sigma.renderers.webglcanvas) {
      sigma.renderers.webglcanvas = document.createElement('canvas');
    }
    var gl = sigma.renderers.webglcanvas.getContext('webgl', { preserveDrawingBuffer: true });
    gl.clear(gl.COLOR_BUFFER_BIT);
    return sigma.renderers.webglcanvas;
  };

  sigma.renderers.extend = function(target) {
      var k;
      for (k in sigma.renderers.common.prototype)
        if (!(k in target.prototype) && sigma.renderers.common.prototype.hasOwnProperty(k))
          target.prototype[k] = sigma.renderers.common.prototype[k];
  };

  sigma.renderers.common.prototype = {};

  /**
   *  render the d3 parts of the graph (hovered or selected nodes and edges, labels), common to canvas or webgl rendering
   */
  sigma.renderers.common.prototype.render = function(drawLabels, optimize, embedSettings) {
    //Draw Labels in D3. Reject aggregated nodes
    if(drawLabels && !optimize) {
      if(this.domElements['d3-labels'].style.display === 'none')
        this.domElements['d3-labels'].style.display = '';
      // defined in labelService
      sigma.d3.labels.def(_.reject(_.reject(this.nodesOnScreen, 'hidden'), 'isAggregation'), this.graph.nodes(), this.d3Sel.labels(), embedSettings);

    } else {
      this.domElements['d3-labels'].style.display = 'none';
    }
    if( optimize ) { //&& !embedSettings('inPop')) {
      if(!embedSettings('inPop')) {
        this.greyout(false);
      }
      this.domElements['selections'].style.display = 'none';
      this.domElements['hovers'].style.display = 'none';
      this.domElements['d3-selections'].style.display = 'none';
      this.domElements['d3-hovers'].style.display = 'none';
      this.domElements['d3-annotations'].style.display = 'none';
      this.domElements['d3-subset'].style.display = 'none';
    } else {
      this.domElements['selections'].style.display = '';
      this.domElements['hovers'].style.display = '';
      this.domElements['d3-selections'].style.display = '';
      this.domElements['d3-hovers'].style.display = '';
      this.domElements['d3-annotations'].style.display = '';
      this.domElements['d3-subset'].style.display = '';
      this.dispatchEvent('render');   // render selected and hovered nodes and edges
    }
    return this;
  };

  // initialization common to canvas and webgl renderers
  sigma.renderers.common.prototype.commonInitialization = function() {
    var self = this;
    this.initDOM('canvas', 'selections'); // For edges between neighbors of selections
    this.initDOM('canvas', 'hovers'); // For edges between neighbors when hovering
    this.initDOM('canvas', 'subset');
    //d3 stuff
    this.initDOM('div', 'd3-annotations');
    this.initDOM('div', 'd3-selections');
    this.initDOM('div', 'd3-subset');
    this.initDOM('div', 'd3-hovers');

    this.initDOM('canvas', 'mouse');
    this.contexts.hover = this.contexts.mouse;
    // initialize after mouse layer so labels get mouse events first
    this.initDOM('div', 'd3-labels');

    this.d3Sel.labels = _.once(function() {
      return d3.select(self.domElements['d3-labels']);
    });
    this.d3Sel.selections = _.once(function() {
      return d3.select(self.domElements['d3-selections']);
    });
    this.d3Sel.subset = _.once(function() {
      return d3.select(self.domElements['d3-subset']);
    });    
    this.d3Sel.hovers = _.once(function() {
      return d3.select(self.domElements['d3-hovers']);
    });
    this.d3Sel.annotations = _.once(function() {
      return d3.select(self.domElements['d3-annotations']);
    });
    // force mouse events through when not on a label
    self.domElements['d3-labels'].style["pointer-events"] = "none";
    self.domElements['d3-annotations'].style["pointer-events"] = "none";

    // Initialize captors:
    this.captors = [];
    var i, a = this.options.captors || [sigma.captors.mouse2, sigma.captors.touch];
    for (i = 0; i < a.length; i++) {
      var fn = typeof a[i] === 'function' ? a[i] : sigma.captors[a[i]];
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
    for (i = 0; i < this.captors.length; i++) {
      this.captors[i].bind('zoom:start', function(e) {
        self.dispatchEvent('zoom:start', e.data);
      });
      this.captors[i].bind('zoom:end', function(e) {
        self.dispatchEvent('zoom:end', e.data);
      });
    }
    this.resize(false);
  };

  /**
   * This method creates a DOM element of the specified type, switches its
   * position to "absolute", references it to the domElements attribute, and
   * finally appends it to the container.
   *
   * @param  {string}   tag   The label tag.
   * @param  {string}   id    The id of the element (to store it in
   *                          "domElements").
   * @param  {?boolean} webgl Will init the WebGL context if true.
   */
  sigma.renderers.common.prototype.initDOM = function(tag, id, webgl) {
    var gl, dom = webgl ? sigma.renderers.getGLCanvas() : document.createElement(tag);

    dom.style.position = 'absolute';
    dom.style.overflow = 'hidden';
    dom.setAttribute('class', 'sigma-' + id);

    this.domElements[id] = dom;
    this.container.appendChild(dom);

    if (tag.toLowerCase() === 'canvas')
      this.contexts[id] = dom.getContext(webgl ? 'experimental-webgl' : '2d', {
        preserveDrawingBuffer: false
      });
  };

  /**
   * This method resizes each DOM elements in the container and stores the new
   * dimensions. Then, it renders the graph.
   *
   * @param  {?number}               width  The new width of the container.
   * @param  {?number}               height The new height of the container.
   * @return {sigma.renderers.webgl}        Returns the instance itself.
   */
  sigma.renderers.common.prototype.resize = function(w, h) {
    var k,
        oldWidth = this.width,
        oldHeight = this.height;

    if (this.settings('highRes')) {
      var context = this.contexts.nodes
      var devicePixelRatio = window.devicePixelRatio || 1;
      var backingStoreRatio = context.webkitBackingStorePixelRatio ||
                            context.mozBackingStorePixelRatio ||
                            context.msBackingStorePixelRatio ||
                            context.oBackingStorePixelRatio ||
                            context.backingStorePixelRatio || 1;
      this.displayScale = devicePixelRatio / backingStoreRatio;
    } else {
      this.displayScale = 1;
    }
    this.settings('displayScale', this.displayScale);
    if (w !== undefined && h !== undefined) {
      this.width = w;
      this.height = h;
    } else {
      // w = this.width = this.container.offsetWidth;
      w = this.width = window.innerWidth - leftPanelWidth; // hardcoded width / heights
      h = this.height = window.innerHeight;
      // h = this.height = this.container.offsetHeight;
    }
    if (oldWidth !== this.width || oldHeight !== this.height) {
      for (k in this.domElements) {
        var elem = this.domElements[k];
        elem.style.width = w + 'px';
        elem.style.height = h + 'px';

        if (elem.tagName.toLowerCase() === 'canvas') {
          // 2D canvas
          if (this.contexts[k] && this.contexts[k].scale) {
            elem.setAttribute('width', w*this.displayScale + 'px');
            elem.setAttribute('height', h*this.displayScale + 'px');
            this.contexts[k].scale(this.displayScale, this.displayScale);
          } else {  // webgl canvas
            elem.setAttribute('width', (w * this.displayScale * this.settings('webglOversamplingRatio')) + 'px');
            elem.setAttribute('height', (h * this.displayScale * this.settings('webglOversamplingRatio')) + 'px');
            var gl = elem.getContext('webgl', { preserveDrawingBuffer: true });
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          }
        }
      }
    }
    this.dispatchEvent('resize');
    return this;
  };

  /**
   * This method clears each canvas.
   *
   * @return {sigma.renderers.webgl} Returns the instance itself.
   */
  sigma.renderers.common.prototype.clear = function(clearAll) {
    var k;
    for (k in this.domElements) {
      if (this.domElements[k].tagName === 'CANVAS')
        this.domElements[k].width = this.domElements[k].width;
      if (this.domElements[k].tagName === 'DIV' && clearAll)
        this.domElements[k].style.display = 'none';

    }
    return this;
  };

  /**
   * This method kills contexts and other attributes.
   */
  sigma.renderers.common.prototype.kill = function() {
    var k,
        captor;

    // Unbind resize:
    window.removeEventListener('resize', this.boundResize);

    // Kill captors:
    while ((captor = this.captors.pop()))
      captor.kill();
    delete this.captors;

    // Kill contexts:
    for (k in this.domElements) {
      if( this.domElements[k].parentNode ) {
        this.domElements[k].parentNode.removeChild(this.domElements[k]);
      }
      delete this.domElements[k];
      delete this.contexts[k];
    }
    delete this.domElements;
    delete this.contexts;
  };

  /**
   * Applies opacity for the selection canvas
   * @return {[type]} [description]
   */
  sigma.renderers.common.prototype.greyout  = function(enable, source) {
    var nodeOpacity = this.settings('nodeUnselectedOpacity'),// || 0.3,
    edgeOpacity = this.settings('edgeUnselectedOpacity');// || 0.3;
    if( source !== undefined ) {
      // grey if either hover or select have requested it
      if(source == 'hover') {
        this.hoverGrey = enable;
        this.selectGrey = false;
      }
      else if(source == 'select') {
        this.selectGrey = enable;
        this.popGrey = false
      }
      else if(source == 'pop') {
        this.popGrey = enable;
        this.selectGrey = false;
      } else if(source == 'subset') {
        nodeOpacity /= 4;
        edgeOpacity /= 4;
        this.selectGrey = enable;
      }
      enable = this.hoverGrey || this.popGrey || this.selectGrey;
      if(!this.selectGrey) {  // hovering or pop
        nodeOpacity *= 2;   // nodes and edges are less faded
        edgeOpacity *= 2;
      }
    }
    if(!enable) {
      // not in selection mode, add opacity.
      $(this.domElements.scene).stop().fadeTo(this.inDelay, 1)
      this.settings('inSelectionMode', true);
      if(this.domElements.edges)
        $(this.domElements.edges).stop().fadeTo(this.inDelay, 1);
    } else {
      this.settings('inSelectionMode', false);
      // not in selection mode, remove opacity.
      $(this.domElements.scene).stop().fadeTo(this.outDelay, nodeOpacity)
      if(this.domElements.edges)
        $(this.domElements.edges).stop().fadeTo(this.outDelay, edgeOpacity)
    }
  };

  sigma.renderers.common.prototype.greyoutSubset  = function(enable, source) {
    var nodeOpacity = this.settings('nodeUnselectedOpacity'),// || 0.3,
    edgeOpacity = this.settings('edgeUnselectedOpacity');// || 0.3;
    if( source !== undefined ) {
      // grey if either hover or select have requested it
      if(source == 'hover')
        this.hoverGrey = enable;
      else if(source == 'select') {
        this.selectGrey = enable;
        this.popGrey = false
      }
      else if(source == 'pop') {
        this.popGrey = enable;
        this.selectGrey = false;
      }
      enable = this.hoverGrey || this.popGrey || this.selectGrey;
      if(!this.selectGrey) {  // hovering or pop
        nodeOpacity *= 2;   // nodes and edges are less faded
        edgeOpacity *= 2;
      }
    }
    if(!enable) {
      // not in selection mode, add opacity.
      $(this.domElements['d3-subset']).stop().fadeTo(this.inDelay, 1)
      this.settings('inSelectionMode', true);
      if(this.domElements.subset)
        $(this.domElements.subset).stop().fadeTo(this.inDelay, 1);
    } else {
      this.settings('inSelectionMode', false);
      // not in selection mode, remove opacity.
      $(this.domElements['d3-subset']).stop().fadeTo(this.outDelay, nodeOpacity)
      if(this.domElements.subset)
        $(this.domElements.subset).stop().fadeTo(this.outDelay, edgeOpacity)
    }
  };
  /**
   * Clears the selection state and canvas if required
   * @return {[type]} [description]
   */
  sigma.renderers.common.prototype.clearSelection  = function clearSelection() {
    throw 'Method Obsolete';
    var n = null;
    for(n in this.nodesSelected) {
      this.nodesSelected[n].isSelected = false;
    }
    for(n in this.nodeNeighboursOfSelected) {
      this.nodeNeighboursOfSelected[n].isNeighbourOfSelected = false;
    }

    this.nodesSelected = {};
    this.nodeNeighboursOfSelected = {};
    this.edgesToDraw = {};
    this.contexts.selections.canvas.width = this.contexts.selections.canvas.width;  // clear the selection canvas
  };
  //
  // Select a node.
  //
  sigma.renderers.common.prototype.selectNode  = function selectNode(n, degree, haltDispatchEvent) {
    throw 'Method Obsolete';
    var self = this,
      addNeigh = +this.settings('nodeSelectionDegree') === 1;
      if(typeof degree !== 'undefined')
        addNeigh = degree == 1;

    n.isSelected = true;
    self.nodesSelected[n.id] = n;
    self.nodeNeighboursOfSelected[n.id] = n; // self is a neighbour of self.
    //Get neighbours and their edges
    if(addNeigh)
      _.forEach(self.graph.getNodeNeighbours(n.id), function addTargetNode(edgeInfo, targetId){
        self.nodeNeighboursOfSelected[targetId] = self.graph.getNodeWithId(targetId);
        _.forEach(edgeInfo, function addConnEdge(edge, edgeId) {
          self.edgesToDraw[edgeId] = edge;
        });
      });
    // Mark as neighbours
    _.each(self.nodeNeighboursOfSelected, function(node) {node.isNeighbourOfSelected = true;});

    if(!haltDispatchEvent) {
      console.log('[renderers.canvas]Sending nodeSelected event');
      self.dispatchEvent('nodeSelected', {
        nodesSelected: _.values(self.nodesSelected),
        nodeNeighboursOfSelected: _.values(self.nodeNeighboursOfSelected),
        edges: _.values(self.edgesToDraw)
      });
    } else {
      console.log('[renderers.canvas]NOT Sending nodeSelected event');
    }
  };
  // Selects a bunch of nodes, and clears others
  sigma.renderers.common.prototype.onlySelectNodes  = function onlySelectNode(nodes, haltDispatchEvent) {
    throw 'Method Obsolete';
    var n;
    // If nothing to select, return
    if(nodes.length === 0 && this.nodesSelected.length === 0)
      return;
    // Check if there is a change in selection
    var noSelChange = nodes.length === this.nodesSelected.length && _.every(nodes, function(n1) {
      return _.any(this.nodesSelected, function(n2) { return n1.id === n2.id;});
    }, this);
    // If no change, do nothing
    if(noSelChange)
      return;

    // clear current selections if any previously selected node is not be to selected again
    var shouldClear = _.any(this.nodesSelected, function(prevNode) {
      // returns true if prevNode does not exist in node
      return _.all(nodes, function(n) {
        return n.id !== prevNode.id;
      });
    });
    this.clearSelection(shouldClear);
    _.each(nodes, function(n) {
      this.selectNode(n, this.settings('nodeSelectionDegree'), true);
    },this);
  };
  /**
   * Generates dataURL
   * @param  {Int} width  width of the final image
   * @param  {Int} height height of the final image
   * @return {DataUrl}        Base64 encoded img
   */
  sigma.renderers.common.prototype.getDataURL  = function getDataURL(width, height) {
    this.initDOM('canvas','screenshot');

    var screenshot = this.domElements.screenshot;
        screenshot.height = height; screenshot.width = width;
        var contextScreenshot = this.contexts.screenshot;
        // aspect ratio scaling
        var scene = this.domElements.scene;
        var ratio = Math.max(
            scene.height / screenshot.height,
            scene.width / screenshot.width
          );

        contextScreenshot.fillStyle = 'rgb(255,255,255)';
        contextScreenshot.fillRect(0,0, screenshot.width, screenshot.height);

        // Draw the layers in order
        if(this.domElements.edges)
          contextScreenshot.drawImage(this.domElements.edges, 0, 0, scene.width / ratio, scene.height / ratio);
        if(this.domElements.scene)
          contextScreenshot.drawImage(this.domElements.scene, 0, 0, scene.width / ratio, scene.height / ratio);
        if(this.domElements.selections)
          contextScreenshot.drawImage(this.domElements.selections, 0, 0, scene.width / ratio, scene.height / ratio);

        // Save to a data URL as a jpeg quality 9
        var imgUrl = screenshot.toDataURL("image/png", 0.9);
        this.domElements.screenshot.parentNode.removeChild(this.domElements.screenshot);
        delete this.domElements.screenshot;
        delete this.contexts.screenshot;
        return imgUrl;
  };

  sigma.renderers.common.prototype.inDelay = 500;
  sigma.renderers.common.prototype.outDelay = 300;

  sigma.utils.pkg('sigma.canvas.labels');

}).call(this);
