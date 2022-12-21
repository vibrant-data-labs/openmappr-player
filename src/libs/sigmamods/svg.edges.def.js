; (function () {
  'use strict';

  sigma.utils.pkg('sigma.svg.edges');

  /**
   * The default edge renderer. It renders the node as a simple line.
   */
  sigma.svg.edges.def = {

    /**
     * SVG Element creation.
     *
     * @param  {object}                   edge       The edge object.
     * @param  {object}                   source     The source node object.
     * @param  {object}                   target     The target node object.
     * @param  {configurable}             settings   The settings function.
     */
    create: function (edge, source, target, settings, svg) {
      var color = edge.colorStr,
        prefix = settings('prefix') || '',
        edgeColor = settings('edgeColorStrat'),
        defaultNodeColor = settings('nodeColorDefaultValue'),
        defaultEdgeColor = settings('edgeColorDefaultValue'),
        fillId = '';

      var sourceCol = (source) ? source.colorStr : 'rgb(0,0,0)';
      var targetCol = (target) ? target.colorStr : 'rgb(0,0,0)';
      var x1 = source[prefix + 'x'],
      y1 = source[prefix + 'y'],
      x2 = target[prefix + 'x'],
      y2 = target[prefix + 'y'];

        switch (edgeColor) {
          case 'source':
            color = source.colorStr || defaultNodeColor;
            break;
          case 'target':
            color = target.colorStr || defaultNodeColor;
            break;
          case 'attr':
            color = edge.colorStr;
            break;
          case 'gradient':
            fillId = this.createGradient(
              source.colorStr || defaultNodeColor,
              target.colorStr || defaultNodeColor,
            edge.id, svg, x1, y1, x2, y2);
            break;
          default:
            color = defaultEdgeColor;
            break;
        }

      var line;

      var curvature = settings('edgeCurvature');
      if (curvature > 0) {
        curvature = curvature * 1.33;
        line = document.createElementNS(settings('xmlns'), 'path');
        var path = {
          M: [x1, y1],
          Q: [
            (x1 + x2) / 2 + curvature * (y2 - y1) / 4,
            (y1 + y2) / 2 + curvature * (x1 - x2) / 4,
          ],
          T: [x2, y2]
        }
        line.setAttributeNS(null, 'd',
        `M${path.M.join(',')} Q${path.Q.join(',')} ${path.T.join(',')}`
        );

        line.setAttributeNS(null, "fill", "transparent");

      } else {
        line = document.createElementNS(settings('xmlns'), 'line');
      }

      // Attributes
      line.setAttributeNS(null, 'data-edge-id', edge.id);
      if (fillId) {
        line.setAttributeNS(null, 'stroke', 'url(#' + fillId + ')');
      } else {
        line.setAttributeNS(null, 'stroke', color);
        line.setAttributeNS(null, 'class', settings('classPrefix') + '-edge');
      }

      return line;
    },

    createGradient: function(col1, col2, id, svg, x1, y1, x2, y2) {
      var defs = svg.querySelector('defs');
      var fillId = 'col' + id;

      var gradientElement = document.createElementNS(null, 'linearGradient');
      defs.appendChild(gradientElement);

      var gradAttrs = {
        id: fillId,
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        gradientUnits: 'userSpaceOnUse'
      };

      var keys = Object.keys(gradAttrs);
      for(var i = 0; i < keys.length; i++) {
        gradientElement.setAttributeNS(null, keys[i], gradAttrs[keys[i]]);
      }

      var colors = [col1, col2];
      for(var i = 0; i < colors.length; i++) {
        var stopItem = document.createElement('stop');
        gradientElement.appendChild(stopItem);
        stopItem.setAttributeNS(null, 'offset', ((i / colors.length) * 100) + '%');
        stopItem.setAttributeNS(null, 'style', 'stop-color: ' + colors[i]);
      }

      return fillId;
    },

    /**
     * SVG Element update.
     *
     * @param  {object}                   edge       The edge object.
     * @param  {DOMElement}               line       The line DOM Element.
     * @param  {object}                   source     The source node object.
     * @param  {object}                   target     The target node object.
     * @param  {configurable}             settings   The settings function.
     */
    update: function (edge, line, source, target, settings) {
      var prefix = settings('prefix') || '';

      line.setAttributeNS(null, 'stroke-width', edge[prefix + 'size'] || 1);
      line.setAttributeNS(null, 'x1', source[prefix + 'x']);
      line.setAttributeNS(null, 'y1', source[prefix + 'y']);
      line.setAttributeNS(null, 'x2', target[prefix + 'x']);
      line.setAttributeNS(null, 'y2', target[prefix + 'y']);

      // Showing
      line.style.display = '';

      return this;
    }
  };
})();
