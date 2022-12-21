(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined') {
    throw 'sigma is not declared';
  }

  // Initialize packages:
  sigma.utils.pkg('sigma.canvas.labels');

  /**
   * This label renderer will just display the label on the right of the node.
   *
   * @param  {object}                   node     The node object.
   * @param  {CanvasRenderingContext2D} context  The canvas context.
   * @param  {configurable}             settings The settings function.
   */
  sigma.canvas.labels.def = function(node, context, settings) {
    var fontSize,
        prefix = settings('prefix') || '',
        size = node[prefix + 'size'],
        label = settings('labelFunc')(node);

        if(settings('isHover')) {
          size = size * (+settings('highlightRatio') || 1);
        }
        if(settings('isSelected')) {
          size = size * (+settings('selectionSizeRatio') || 1);
        }


    if (size < settings('labelThreshold')) {
      return;
    }

    if (typeof label !== 'string') {
      return;
    }

    fontSize = (settings('labelSize') === 'fixed') ?
      settings('defaultLabelSize') :
      settings('labelSizeRatio') * size;

    context.font = (settings('fontStyle') ? settings('fontStyle') + ' ' : '') +
      fontSize + 'px ' + settings('font');
    context.fillStyle = (settings('labelColor') === 'node') ?
      (node.colorStr || settings('nodeColorDefaultValue')) :
      settings('defaultLabelColor');

    context.fillText(
      label,
      Math.round(node[prefix + 'x'] + size + 3),
      Math.round(node[prefix + 'y'] + fontSize / 3)
    );
  };
}).call(this);
