;(function() {
  'use strict';

  sigma.utils.pkg('sigma.svg.clusters');

  /**
   * The default cluster renderer. It renders the node as a simple disc.
   */
  sigma.svg.clusters.def = {

    /**
     * SVG Element creation.
     *
     * @param  {object}                   cluster     The cluster object.
     * @param  {configurable}             settings The settings function.
     */
    create: function(cluster, settings) {
      if (!cluster.nodes.length) return;
      var node = cluster.nodes[0];

      var prefix = settings('prefix') || '',
          circle = document.createElementNS(settings('xmlns'), 'circle');

      // Defining the node's circle
      circle.setAttributeNS(null, 'data-node-id', cluster.key);
      circle.setAttributeNS(null, 'class', settings('classPrefix') + '-cluster');
      circle.setAttributeNS(
        null, 'fill', 'transparent');
      circle.setAttributeNS(
        null, 'stroke', mappr.utils.darkenColor(node.color || settings('defaultNodeColor'))
      );
      circle.setAttributeNS(
        null, 'stroke-width', 2
      );

      // Returning the DOM Element
      return circle;
    },

    /**
     * SVG Element update.
     *
     * @param  {object}                   node     The node object.
     * @param  {DOMElement}               circle   The node DOM element.
     * @param  {configurable}             settings The settings function.
     */
    update: function(cluster, circle, settings) {
      if (!cluster.nodes.length) return;

      var node = cluster.nodes[0];
      var prefix = settings('prefix') || '';

      var minMax = cluster.nodes.reduce((acc, cv) => {
        const nodeX = cv[prefix + 'x'];
        const nodeY = cv[prefix + 'y'];

        if (acc.minX > nodeX) {
          acc.minX = nodeX;
        }

        if (acc.maxX < nodeX) {
          acc.maxX = nodeX;
        }

        if (acc.minY > nodeY) {
          acc.minY = nodeY;
        }

        if (acc.maxY < nodeY) {
          acc.maxY = nodeY;
        }

        return acc;
      }, { 
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
       });

      var center = {
        x: minMax.minX + (minMax.maxX - minMax.minX) / 2,
        y: minMax.minY + (minMax.maxY - minMax.minY) / 2,
      };

      var size = cluster.nodes.reduce((acc, cv) => {
        const nodeX = cv[prefix + 'x'];
        const nodeY = cv[prefix + 'y'];

        var res = (nodeX - center.x) * (nodeX - center.x) + (nodeY - center.y) * (nodeY - center.y);

        if (acc > res) {
          return acc;
        }

        return res;
      }, 0);

      size = Math.sqrt(size) + node[prefix + 'size'];
      // Applying changes
      // TODO: optimize - check if necessary
      circle.setAttributeNS(null, 'cx', center.x);
      circle.setAttributeNS(null, 'cy', center.y);
      circle.setAttributeNS(null, 'r', size);

      // Showing
      circle.style.display = '';

      return this;
    }
  };
})();
