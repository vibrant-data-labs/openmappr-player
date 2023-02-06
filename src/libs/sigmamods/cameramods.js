(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined') {
    throw 'sigma is not declared';
  }
  if (typeof sigma.classes.camera === 'undefined'){
    throw 'sigma camera not found is not declared';
  }

// removes zoom-dependent nonlinear node resizing
/**
   * This method takes a graph and computes for each node and edges its
   * coordinates relatively to the center of the camera. Basically, it will
   * compute the coordinates that will be used by the graphic renderers.
   *
   * Since it should be possible to use different cameras and different
   * renderers, it is possible to specify a prefix to put before the new
   * coordinates (to get something like "node.camera1_x")
   *
   * @param  {?string} read    The prefix of the coordinates to read.
   * @param  {?string} write   The prefix of the coordinates to write.
   * @param  {?object} options Eventually an object of options. Those can be:
   *                           - A restricted nodes array.
   *                           - A restricted edges array.
   *                           - A width.
   *                           - A height.
   * @return {camera}        Returns the camera.
   */
   sigma.classes.camera.prototype.applyView = function(read, write, options) {
     options = options || {};
     write = write !== undefined ? write : this.prefix;
     read = read !== undefined ? read : this.readPrefix;

     var nodes = options.nodes || this.graph.nodes(),
         edges = options.edges || this.graph.edges();

     var i,
         l,
         node,
         cos = Math.cos(this.angle),
         sin = Math.sin(this.angle);
     var readx = read + 'x', ready = read + 'y';
     var writex = write + 'x', writey = write + 'y';
     var readsz = read + 'size', writesz = write + 'size';

     for (i = 0, l = nodes.length; i < l; i++) {
       node = nodes[i];
       node[writex] =
         (
           ((node[readx] || 0) - this.x) * cos +
           ((node[ready] || 0) - this.y) * sin
         ) / this.ratio + (options.width || 0) / 2;
       node[writey] =
         (
           ((node[ready] || 0) - this.y) * cos -
           ((node[readx] || 0) - this.x) * sin
         ) / this.ratio + (options.height || 0) / 2;
       node[writesz] = (node[readsz] || 0) / this.ratio;
     }

     for (i = 0, l = edges.length; i < l; i++) {
       edges[i][writesz] = (edges[i][readsz] || 0) / this.ratio;
     }

     return this;
   };

  /**
   * Taking a width and a height as parameters, this method returns the
   * coordinates of the rectangle representing the camera on screen, in the
   * graph's referentiel.
   *
   * To keep displaying labels of nodes going out of the screen, the method
   * keeps a margin around the screen in the returned rectangle.
   *
   * @param  {number} width  The width of the screen.
   * @param  {number} height The height of the screen.
   * @return {object}        The rectangle as x1, y1, x2 and y2, representing
   *                         two opposite points.
   */
  sigma.classes.camera.prototype.getRectangle = function(width, height) {
    var widthVect = this.cameraPosition(width, 0, true),
        heightVect = this.cameraPosition(0, height, true),
        centerVect = this.cameraPosition(width / 2, height / 2, true),
        marginX = this.cameraPosition(width / 10, 0, true).x,
        marginY = this.cameraPosition(0, height / 20, true).y;

    return {
      x1: this.x - centerVect.x - marginX,
      y1: this.y - centerVect.y - marginY,
      x2: this.x - centerVect.x + widthVect.x,
//      x2: this.x - centerVect.x + marginX + widthVect.x,
      y2: this.y - centerVect.y - marginY + widthVect.y,
      height: Math.sqrt(
        Math.pow(heightVect.x, 2) +
        Math.pow(heightVect.y + 2 * marginY, 2)
      )
    };
  };

  // modify camera animation to allow destination coordinates to be retrieved

  /**
   * This function animates a camera. It has to be called with the camera to
   * animate, the values of the coordinates to reach and eventually some
   * options. It returns a number id, that you can use to kill the animation,
   * with the method sigma.misc.animation.kill(id).
   *
   * The available options are:
   *
   *   {?number}            duration   The duration of the animation.
   *   {?function}          onNewFrame A callback to execute when the animation
   *                                   enter a new frame.
   *   {?function}          onComplete A callback to execute when the animation
   *                                   is completed or killed.
   *   {?(string|function)} easing     The name of a function from the package
   *                                   sigma.utils.easings, or a custom easing
   *                                   function.
   *
   * @param  {camera}  camera  The camera to animate.
   * @param  {object}  target  The coordinates to reach.
   * @param  {?object} options Eventually an object to specify some options to
   *                           the function. The available options are
   *                           presented in the description of the function.
   * @return {number}          The animation id, to make it easy to kill
   *                           through the method "sigma.misc.animation.kill".
   */

  sigma.misc.animation.cameraval = undefined;
  
  /**
   * Generates a unique ID for the animation.
   *
   * @return {string} Returns the new ID.
   */
  var _getID = (function() {
    var id = 0;
    return function() {
      return '' + (++id);
    };
  })();

  sigma.misc.animation.camera = function(camera, val, options) {
    if (
      !(camera instanceof sigma.classes.camera) ||
      typeof val !== 'object' ||
      !val
    )
      throw 'animation.camera: Wrong arguments.';

    if (
      typeof val.x !== 'number' &&
      typeof val.y !== 'number' &&
      typeof val.ratio !== 'number' &&
      typeof val.angle !== 'number'
    )
      throw 'There must be at least one valid coordinate in the given val.';

    var fn,
        id,
        anim,
        easing,
        duration,
        initialVal,
        o = options || {},
        start = undefined;

    sigma.misc.animation.cameraval = val;

    // Store initial values:
    initialVal = {
      x: camera.x,
      y: camera.y,
      ratio: camera.ratio,
      angle: camera.angle
    };

    duration = o.duration;
    easing = typeof o.easing !== 'function' ?
      sigma.utils.easings[o.easing || 'quadraticInOut'] :
      o.easing;

    fn = function() {
      var coef, t;
      if( start === undefined ) {
        start = sigma.utils.dateNow();
      }
      t = o.duration ? (sigma.utils.dateNow() - start) / o.duration : 1;

      // If the animation is over:
      if (t >= 1) {
        camera.isAnimated = false;
        camera.goTo({
          x: val.x !== undefined ? val.x : initialVal.x,
          y: val.y !== undefined ? val.y : initialVal.y,
          ratio: val.ratio !== undefined ? val.ratio : initialVal.ratio,
          angle: val.angle !== undefined ? val.angle : initialVal.angle
        });

        cancelAnimationFrame(id);
        delete sigma.misc.animation.running[id];

        // Check callbacks:
        if (typeof o.onComplete === 'function')
          o.onComplete();
        sigma.misc.animation.cameraval = undefined;

      // Else, let's keep going:
      } else {
        coef = easing(t);
        camera.isAnimated = true;
        camera.goTo({
          x: val.x !== undefined ?
            initialVal.x + (val.x - initialVal.x) * coef :
            initialVal.x,
          y: val.y !== undefined ?
            initialVal.y + (val.y - initialVal.y) * coef :
            initialVal.y,
          ratio: val.ratio !== undefined ?
            initialVal.ratio + (val.ratio - initialVal.ratio) * coef :
            initialVal.ratio,
          angle: val.angle !== undefined ?
            initialVal.angle + (val.angle - initialVal.angle) * coef :
            initialVal.angle
        });

        // Check callbacks:
        if (typeof o.onNewFrame === 'function')
          o.onNewFrame();

        anim.frameId = requestAnimationFrame(fn);
      }
    };

    id = _getID();
    anim = {
      frameId: requestAnimationFrame(fn),
      target: camera,
      type: 'camera',
      options: o,
      fn: fn
    };
    sigma.misc.animation.running[id] = anim;

    return id;
  };

  /**
   * Kills a running animation. It triggers the eventual onComplete callback.
   *
   * @param  {number} id  The id of the animation to kill.
   * @return {object}     Returns the sigma.misc.animation package.
   */
  sigma.misc.animation.kill = function(id) {
    if (arguments.length !== 1 || typeof id !== 'number')
      throw 'animation.kill: Wrong arguments.';

    var o = sigma.misc.animation.running[id];

    if (o) {
      cancelAnimationFrame(id);
      delete sigma.misc.animation.running[o.frameId];

      if (o.type === 'camera') {
        o.target.isAnimated = false;
        sigma.misc.animation.cameraval = undefined;
      }
      // Check callbacks:
      if (typeof (o.options || {}).onComplete === 'function')
        o.options.onComplete();
    }

    return this;
  };

}).call(this);
