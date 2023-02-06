;(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw 'sigma is not declared';

  // Initialize packages:
  sigma.utils.pkg('sigma.captors');

  /**
   * The user inputs default captor. It deals with mouse events, keyboards
   * events and touch events.
   *
   * @param  {DOMElement}   target   The DOM element where the listeners will be
   *                                 bound.
   * @param  {camera}       camera   The camera related to the target.
   * @param  {configurable} settings The settings function.
   * @return {sigma.captor}          The fresh new captor instance.
   */
  sigma.captors.mouse2 = function(target, camera, settings) {
    var _self = this,
        _target = target,
        _camera = camera,
        _settings = settings,

        // CAMERA MANAGEMENT:
        // ******************
        // The camera position when the user starts dragging:
        _startCameraX,
        _startCameraY,
        _startCameraAngle,

        // The latest stage position:
        _lastCameraX,
        _lastCameraY,
        _lastCameraAngle,
        _lastCameraRatio,

        // MOUSE MANAGEMENT:
        // *****************
        // The mouse position when the user starts dragging:
        _startMouseX,
        _startMouseY,

        _isMouseDown,
        _isMoving,
        _isDragEnd = false, // click event fired only when this is false
        _movingTimeoutId,
        _isShiftKeyPressed = false

    sigma.classes.dispatcher.extend(this);

    sigma.utils.doubleClick(_target, 'click', _doubleClickHandler);
    _target.addEventListener('DOMMouseScroll', _wheelHandler, false);
    _target.addEventListener('mousewheel', _wheelHandler, false);
    _target.addEventListener('mousemove', _moveHandler, false);
    _target.addEventListener('mousedown', _downHandler, false);
    _target.addEventListener('click', _clickHandler, false);
    _target.addEventListener('mouseout', _outHandler, false);
    document.addEventListener('mouseup', _upHandler, false);




    /**
     * This method unbinds every handlers that makes the captor work.
     */
    this.kill = function() {
      sigma.utils.unbindDoubleClick(_target, 'click');
      _target.removeEventListener('DOMMouseScroll', _wheelHandler);
      _target.removeEventListener('mousewheel', _wheelHandler);
      _target.removeEventListener('mousemove', _moveHandler);
      _target.removeEventListener('mousedown', _downHandler);
      _target.removeEventListener('click', _clickHandler);
      _target.removeEventListener('mouseout', _outHandler);
      document.removeEventListener('mouseup', _upHandler);
    };




    // MOUSE EVENTS:
    // *************

    /**
     * The handler listening to the 'move' mouse event. It will effectively
     * drag the graph.
     *
     * @param {event} e A mouse event.
     */
    function _moveHandler(e) {
      var x,
          y,
          pos;

      if(_settings('panLock') || _isShiftKeyPressed) return;
      // Dispatch event:
      if (_settings('mouseEnabled'))
        _self.dispatchEvent('mousemove', {
          x: sigma.utils.getX(e) - e.target.clientWidth / 2,
          y: sigma.utils.getY(e) - e.target.clientHeight / 2
        });

      if (_settings('mouseEnabled') && _isMouseDown) {
        _isMoving = true;

        if (_movingTimeoutId)
          clearTimeout(_movingTimeoutId);

        _movingTimeoutId = setTimeout(function() {
          _isMoving = false;
        }, _settings('dragTimeout'));

        sigma.misc.animation.killAll(_camera);

        _camera.isMoving = true;
        pos = _camera.cameraPosition(
          sigma.utils.getX(e) - _startMouseX,
          sigma.utils.getY(e) - _startMouseY,
          true
        );

        x = _startCameraX - pos.x;
        y = _startCameraY - pos.y;

        if (x !== _camera.x || y !== _camera.y) {
          _lastCameraX = _camera.x;
          _lastCameraY = _camera.y;

          _camera.goTo({
            x: x,
            y: y
          });
        }

        if (e.preventDefault)
          e.preventDefault();
        else
          e.returnValue = false;

        e.stopPropagation();
        return false;
      }
    }

    /**
     * The handler listening to the 'up' mouse event. It will stop dragging the
     * graph.
     *
     * @param {event} e A mouse event.
     */
    function _upHandler(e) {
      if (_settings('mouseEnabled') && _isMouseDown) {
        _isMouseDown = false;
        if (_movingTimeoutId)
          clearTimeout(_movingTimeoutId);

        _isDragEnd = _camera.isMoving;
        _camera.isMoving = false;

        var x = sigma.utils.getX(e),
            y = sigma.utils.getY(e);

        if (_isMoving) {
          sigma.misc.animation.killAll(_camera);
          sigma.misc.animation.camera(
            _camera,
            {
              x: _camera.x +
                _settings('mouseInertiaRatio') * (_camera.x - _lastCameraX),
              y: _camera.y +
                _settings('mouseInertiaRatio') * (_camera.y - _lastCameraY)
            },
            {
              easing: 'quadraticOut',
              duration: _settings('mouseInertiaDuration')
            }
          );
        } else if (
          _startMouseX !== x ||
          _startMouseY !== y
        )
          _camera.goTo({
            x: _camera.x,
            y: _camera.y
          });

        _self.dispatchEvent('mouseup', {
          x: x - e.target.clientWidth / 2,
          y: y - e.target.clientHeight / 2
        });

        // Update _isMoving flag:
        _isMoving = false;
      }
    }

    /**
     * The handler listening to the 'down' mouse event. It will start observing
     * the mouse position for dragging the graph.
     *
     * @param {event} e A mouse event.
     */
    function _downHandler(e) {
      if (e.shiftKey) {
        _isShiftKeyPressed = true;
        return;
      }
      if (_settings('mouseEnabled')) {
        _isMouseDown = true;
        _isDragEnd = false;

        _startCameraX = _camera.x;
        _startCameraY = _camera.y;

        _lastCameraX = _camera.x;
        _lastCameraY = _camera.y;

        _startMouseX = sigma.utils.getX(e);
        _startMouseY = sigma.utils.getY(e);

        _self.dispatchEvent('mousedown', {
          x: _startMouseX - e.target.clientWidth / 2,
          y: _startMouseY - e.target.clientHeight / 2
        });
      }
    }

    /**
     * The handler listening to the 'out' mouse event. It will just redispatch
     * the event.
     *
     * @param {event} e A mouse event.
     */
    function _outHandler(e) {
      if (_settings('mouseEnabled'))
        _self.dispatchEvent('mouseout');
    }

    /**
     * The handler listening to the 'click' mouse event. It will redispatch the
     * click event, but with normalized X and Y coordinates.
     *
     * @param {event} e A mouse event.
     */
    function _clickHandler(e) {
      if (_isShiftKeyPressed) {
        _isShiftKeyPressed = false;
        return;
      }
      if ((_settings('mouseEnabled') || _settings('mouseClickEnabled')) && !_isDragEnd)
        _self.dispatchEvent('click', {
          x: sigma.utils.getX(e) - e.target.clientWidth / 2,
          y: sigma.utils.getY(e) - e.target.clientHeight / 2,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });

      if (e.preventDefault)
        e.preventDefault();
      else
        e.returnValue = false;

      e.stopPropagation();
      return false;
    }

    /**
     * The handler listening to the double click custom event. It will
     * basically zoom into the graph.
     *
     * @param {event} e A mouse event.
     */
    function _doubleClickHandler(e) {
      var pos,
          count,
          ratio,
          newRatio;

      if (_settings('mouseEnabled')) {
/*        ratio = 1 / _settings('doubleClickZoomingRatio');

        // Deal with min / max:
        newRatio = Math.max(
          _settings('zoomMin'),
          Math.min(
            _settings('zoomMax'),
            _camera.ratio * ratio
          )
        );
        ratio = newRatio / _camera.ratio;*/
//        _settings('isShiftKey', e.shiftKey);
        _self.dispatchEvent('doubleclick', {
          x: _startMouseX - e.target.clientWidth / 2,
          y: _startMouseY - e.target.clientHeight / 2,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey
        });

        // Check that the new ratio is different from the initial one:
/*        if (_settings('doubleClickEnabled') && (newRatio !== _camera.ratio)) {
          count = sigma.misc.animation.killAll(_camera);

          pos = _camera.cameraPosition(
            sigma.utils.getX(e) - e.target.width / 2,
            sigma.utils.getY(e) - e.target.height / 2,
            true
          );

          sigma.misc.animation.camera(
            _camera,
            {
              x: pos.x * (1 - ratio) + _camera.x,
              y: pos.y * (1 - ratio) + _camera.y,
              ratio: newRatio
            },
            {
              easing: count ? 'quadraticOut' : 'quadraticInOut',
              duration: _settings('doubleClickZoomDuration')
            }
          );
        }*/

        if (e.preventDefault)
          e.preventDefault();
        else
          e.returnValue = false;

        e.stopPropagation();
        return false;
      }
    }

    var timeDelta = 0, prevTime = 0, currTime = 0;
    var wheelArray = [];

    /**
     * The handler listening to the 'wheel' mouse event. It will basically zoom
     * in or not into the graph.
     *
     * @param {event} e A mouse event.
     */

    var zoomTimer;
    var zoomDoneFn = function() {
      zoomTimer = undefined;
      _camera.isMoving = false;
      _camera.dispatchEvent('coordinatesUpdated');
    };

    function _wheelHandler(e) {
      var smoothZoom = _settings('disableAggregation') && !_settings('isGeo');
      var pos,
          ratio,
          eventType,
          animation;

      if(_settings('zoomLock')) return;

      if (_settings('mouseEnabled')) {
        var delta = sigma.utils.getDelta(e);
        if( smoothZoom ) {
          ratio = 1 - delta/300;
        } else {
          ratio = _settings('zoomingRatio')
          ratio = delta > 0 ? 1 / ratio : ratio;
        }
        eventType = delta > 0 ? 'zoomIn' : 'zoomOut';

        pos = _camera.cameraPosition(
          sigma.utils.getX(e) - (e.target.width / _settings("displayScale"))/ 2,
          sigma.utils.getY(e) - (e.target.height / _settings("displayScale"))/ 2,
          true
        );
        _camera.isMoving = true;

        animation = {
          duration: smoothZoom ? 0 : _settings('mouseZoomDuration'),
          onComplete : function() {
            if( smoothZoom ) {
              if(zoomTimer !== undefined ) {
                clearTimeout(zoomTimer);
              }
              zoomTimer = setTimeout(zoomDoneFn, 300);
            } else {
              zoomDoneFn();
            }
            _self.dispatchEvent('zoom:end', {
              eventType : eventType,
              ratio : ratio,
              pos : pos
            });
          }
        };
        _self.dispatchEvent('zoom:start', {
          eventType : eventType,
          ratio : ratio,
          pos : pos
        });
        sigma.utils.zoomTo(_camera, pos.x, pos.y, ratio, animation);

        if (e.preventDefault)
          e.preventDefault();
        else
          e.returnValue = false;

        e.stopPropagation();
        return false;
      }
    }
  };
}).call(this);
