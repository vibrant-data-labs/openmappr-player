(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined') {
    throw 'sigma is not declared';
  }
  if (typeof sigma.classes.camera === 'undefined'){
    throw 'sigma camera not found is not declared';
  }

  /**
   * This method calls the "render" method of each renderer, with the same
   * arguments than the "render" method, but will also check if the renderer
   * has a "process" method, and call it if it exists.
   *
   * It is useful for quadtrees or WebGL processing, for instance.
   *
   * @return {sigma} Returns the instance itself.
   */
  sigma.prototype.refresh = function(movingCamera) {
    var i,
        l,
        k,
        a,
        c,
        bounds,
        prefix = 0;

    if( !movingCamera ) {
      // Call each middleware:
      a = this.middlewares || [];
      for (i = 0, l = a.length; i < l; i++)
        a[i].call(
          this,
          (i === 0) ? '' : 'tmp' + prefix + ':',
          (i === l - 1) ? 'ready:' : ('tmp' + (++prefix) + ':')
        );

      // Then, for each camera, call the "rescale" middleware, unless the
      // settings specify not to:
      for (k in this.cameras) {
        c = this.cameras[k];
        if (
          c.settings('autoRescale') &&
          this.renderersPerCamera[c.id] &&
          this.renderersPerCamera[c.id].length
        )
          sigma.middlewares.rescale.call(
            this,
            a.length ? 'ready:' : '',
            c.readPrefix,
            {
              width: this.renderersPerCamera[c.id][0].width,
              height: this.renderersPerCamera[c.id][0].height
            }
          );
        else
          sigma.middlewares.copy.call(
            this,
            a.length ? 'ready:' : '',
            c.readPrefix
          );

        // Find graph boundaries:
        bounds = sigma.utils.getBoundaries(
          this.graph,
          c.readPrefix
        );

        // Refresh quadtree:
        c.quadtree.index(this.graph.nodes(), {
          prefix: c.readPrefix,
          bounds: {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY
          }
        });
      }
    }

    if( !movingCamera ) {
      // Call each renderer's process method:
      a = Object.keys(this.renderers);
      for (i = 0, l = a.length; i < l; i++) {
        if (this.renderers[a[i]].process) {
          if (this.settings('skipErrors'))
            try {
              this.renderers[a[i]].process();
            } catch (e) {
              console.log(
                'Warning: The renderer "' + a[i] + '" crashed on ".process()"'
              );
            }
          else
            this.renderers[a[i]].process();
        }
      }
    }

    this.render();

    return this;
  };

  /**
   * This method calls the "render" method of each renderer that is bound to
   * the specified camera. To improve the performances, if this method is
   * called too often, the number of effective renderings is limitated to one
   * per frame, unless you are using the "force" flag.
   *
   * @param  {sigma.classes.camera} camera The camera to render.
   * @param  {?boolean}             force  If true, will render the camera
   *                                       directly.
   * @return {sigma}                       Returns the instance itself.
   */
  sigma.prototype.renderCamera = function(camera, force) {
    var i,
        l,
        a,
        self = this;
    var moving = (camera.isAnimated || camera.isMoving);

    if (force) {
      a = this.renderersPerCamera[camera.id];
      for (i = 0, l = a.length; i < l; i++)
        if (this.settings('skipErrors'))
          try {
            self.refresh(moving);
          } catch (e) {
            if (this.settings('verbose')) {
              console.log(
                'Warning: The renderer "' + a[i].id + '" crashed on ".render()"'
              );
            }
          }
        else {
          self.refresh(moving);
        }
    } else {
      if (!this.cameraFrames[camera.id]) {
        a = this.renderersPerCamera[camera.id];
        for (i = 0, l = a.length; i < l; i++)
          if (this.settings('skipErrors'))
            try {
              self.refresh(moving);
            } catch (e) {
              if (this.settings('verbose')) {
                console.log(
                  'Warning: The renderer "' +
                    a[i].id +
                    '" crashed on ".render()"'
                );
              }
            }
          else {
            self.refresh(moving);
          }

        this.cameraFrames[camera.id] = requestAnimationFrame(function() {
          delete self.cameraFrames[camera.id];
        });
      }
    }

    return this;
  };

}).call(this);
