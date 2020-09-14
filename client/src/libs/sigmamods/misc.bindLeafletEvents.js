(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw 'sigma is not declared';

  // Initialize packages:
  sigma.utils.pkg('sigma.misc');

  /**
   * This helper builds the leaftlet binder for sigma. The different between misc.BindEvents and this is 
   * 1) getNodes customised for leaflet data
   * 2) instead of binding to captor, it binds to a renderer
   * 3) Only works if layoutType is 'geo'
   *
   * It has to be called in the scope of the related renderer.
   */
  sigma.misc.bindLeafletEvents = function(prefix) {
    var i,
      l,
      mX,
      mY,
      self = this;

    function getNodes(e) {
      if (e) {
        mX = 'x' in e.data.containerPoint ? e.data.containerPoint.x : mX;
        mY = 'y' in e.data.containerPoint ? e.data.containerPoint.y : mY;
        
        mX = mX - self.width / 2;
        mY = mY - self.height / 2;
      }


      var i,
          j,
          l,
          n,
          x,
          y,
          s,
          inserted,
          selected = [],
          modifiedX = mX + self.width / 2,
          modifiedY = mY + self.height / 2,
          point = self.camera.cameraPosition(
            mX,
            mY
          ),
          nodes = self.camera.quadtree.point(
            point.x,
            point.y
          );


      if (nodes.length)
        for (i = 0, l = nodes.length; i < l; i++) {
          n = nodes[i];
          x = n[prefix + 'x'];
          y = n[prefix + 'y'];
          s = n[prefix + 'size'];

          if (
            !n.hidden &&
            modifiedX > x - s &&
            modifiedX < x + s &&
            modifiedY > y - s &&
            modifiedY < y + s &&
            Math.sqrt(
              Math.pow(modifiedX - x, 2) +
              Math.pow(modifiedY - y, 2)
            ) < s
          ) {
            // Insert the node:
            inserted = false;

            for (j = 0; j < selected.length; j++)
              if (n.size > selected[j].size) {
                selected.splice(j, 0, n);
                inserted = true;
                break;
              }

            if (!inserted)
              selected.push(n);
          }
        }

      return selected;
    }

    function bindCaptor(captor) {
      var nodes,
          over = {};

      function onClick(e) {
        if (!self.settings('eventsEnabled') || self.settings('layoutType') !== 'geo')
          return;

        self.dispatchEvent('click', e.data);

        nodes = getNodes(e);

        if (nodes.length) {
          self.dispatchEvent('clickNode', {
            node: nodes[0],
            shiftKey: e.data.originalEvent.shiftKey,
            ctrlKey: e.data.originalEvent.ctrlKey,
            metaKey: e.data.originalEvent.metaKey
          });
          self.dispatchEvent('clickNodes', {
            node: nodes,
            shiftKey: e.data.originalEvent.shiftKey,
            ctrlKey: e.data.originalEvent.ctrlKey,
            metaKey: e.data.originalEvent.metaKey
          });
        } else
          self.dispatchEvent('clickStage');
      }

      function onDoubleClick(e) {
        if (!self.settings('eventsEnabled') || self.settings('layoutType') !== 'geo')
          return;

        self.dispatchEvent('doubleClick', e.data);

        nodes = getNodes(e);

        if (nodes.length) {
          self.dispatchEvent('doubleClickNode', {
            node: nodes[0]
          });
          self.dispatchEvent('doubleClickNodes', {
            node: nodes
          });
        } else
          self.dispatchEvent('doubleClickStage');
      }

      function onOut(e) {
        if (!self.settings('eventsEnabled') || self.settings('layoutType') !== 'geo')
          return;

        var k,
            i,
            l,
            out = [];

        for (k in over)
          out.push(over[k]);

        over = {};
        // Dispatch both single and multi events:
        for (i = 0, l = out.length; i < l; i++)
          self.dispatchEvent('outNode', {
            node: out[i]
          });
        if (out.length)
          self.dispatchEvent('outNodes', {
            nodes: out
          });
      }

      function onMove(e) {
        if (!self.settings('eventsEnabled') || self.settings('layoutType') !== 'geo')
          return;

        nodes = getNodes(e);

        var i,
            k,
            n,
            newOut = [],
            newOvers = [],
            currentOvers = {},
            l = nodes.length;

        // Check newly overred nodes:
        for (i = 0; i < l; i++) {
          n = nodes[i];
          currentOvers[n.id] = n;
          if (!over[n.id]) {
            newOvers.push(n);
            over[n.id] = n;
          }
        }

        // Check no more overred nodes:
        for (k in over)
          if (!currentOvers[k]) {
            newOut.push(over[k]);
            delete over[k];
          }

        // Dispatch both single and multi events:
        for (i = 0, l = newOvers.length; i < l; i++)
          self.dispatchEvent('overNode', {
            node: newOvers[i]
          });
        for (i = 0, l = newOut.length; i < l; i++)
          self.dispatchEvent('outNode', {
            node: newOut[i]
          });
        if (newOvers.length)
          self.dispatchEvent('overNodes', {
            nodes: newOvers
          });
        if (newOut.length)
          self.dispatchEvent('outNodes', {
            nodes: newOut
          });
      }

      // Bind events:
      captor.bind('leafletDirectiveMap.click', onClick);
      captor.bind('leafletDirectiveMap.mouseup', onMove);
      captor.bind('leafletDirectiveMap.mousedown', onMove);
      captor.bind('leafletDirectiveMap.mousemove', onMove);
      captor.bind('leafletDirectiveMap.mouseout', onOut);
      captor.bind('leafletDirectiveMap.dblclick', onDoubleClick);
      //self.bind('render', onMove);
    }
    bindCaptor(self);
  };
}).call(this);
