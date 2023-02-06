;(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw 'sigma is not declared';

  // Initialize packages:
  sigma.utils.pkg('sigma.middlewares');

  /**
   * This middleware will just copy the graphic properties and resize the size attribute.
   *
   * @param {?string} readPrefix  The read prefix.
   * @param {?string} writePrefix The write prefix.
   */
  sigma.middlewares.resize = function(readPrefix, writePrefix) {
    var i,
        l,
        a;

    var nodeSizeMultiplier = +this.settings('nodeSizeMultiplier') || 1;
    var edgeSizeMultiplier = +this.settings('edgeSizeMultiplier') || 1;
    var aggNodeSizeScale = +this.settings('aggNodeSizeScale') || 1;

    var fixNodeSizes = this.settings('nodeSizeStrat') && this.settings('nodeSizeStrat') === 'fixed';
    var nodeSizeDefaultValue = +this.settings('nodeSizeDefaultValue');
    
    var fixEdgeSizes = this.settings('edgeSizeStrat') && this.settings('edgeSizeStrat') === 'fixed';
    
    var readx = readPrefix + 'x', ready = readPrefix + 'y';
    var writex = writePrefix + 'x', writey = writePrefix + 'y';
    var readsz = readPrefix + 'size', writesz = writePrefix + 'size';

    a = this.graph.nodes();
    for (i = 0, l = a.length; i < l; i++) {
      var n = a[i];
      n[writex] = n[readx];
      n[writey] = n[ready];
      if(n.isAggregation)
        n[writesz] = n[readsz] * aggNodeSizeScale;
      else
        n[writesz] = fixNodeSizes ? nodeSizeDefaultValue : n[readsz] * nodeSizeMultiplier;
    }

    a = this.graph.edges();
    for (i = 0, l = a.length; i < l; i++)
      a[i][writesz] = fixEdgeSizes ? a[i][readsz] : a[i][readsz] * edgeSizeMultiplier;
  };
}).call(this);
