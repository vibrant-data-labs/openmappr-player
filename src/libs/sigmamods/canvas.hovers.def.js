(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined') {
    throw 'sigma is not declared';
  }

  // Initialize packages:
  sigma.utils.pkg('sigma.canvas.hovers');

  /**
   * This hover renderer will basically display the label with a background.
   *
   * @param  {object}                   node     The node object.
   * @param  {CanvasRenderingContext2D} context  The canvas context.
   * @param  {configurable}             settings The settings function.
   */
  sigma.canvas.hovers.def = function(node, context, settings, displayScale) {
    var x,
        y,
        w,
        h,
        e,
        drawlabels = settings('drawLabels'),
        fontStyle = settings('hoverFontStyle') || settings('fontStyle'),
        prefix = settings('prefix') || '',
        size = node[prefix + 'size'],
        fontSize = (settings('labelSize') === 'fixed') ?
          settings('defaultLabelSize') :
          settings('labelSizeRatio') * size,
        label = sigma.labels.labelFunc(settings('hoverLabelFunc'))(node),
        nodeBorderSize = +settings('borderSize'),
        hoverScale = +settings('highlightRatio') || 1;

    var embedSettings = settings.embedObjects({
        isHover: true
      });

    drawlabels = drawlabels && label.toString().length > 0;
    size = size * hoverScale;
    if(settings('isSelected')) {
      size = size * (+settings('selectionSizeRatio') || 1);
    }
    if(drawlabels) {
      // Label background:
      context.font = (fontStyle ? fontStyle + ' ' : '') +
        fontSize + 'px ' + (settings('hoverFont') || settings('font'));

      context.beginPath();
      context.fillStyle = settings('labelHoverBGColor') === 'node' ?
        (node.colorStr || settings('nodeColorDefaultValue')) :
        settings('defaultHoverLabelBGColor');

      if (settings('labelHoverShadow')) {
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = 8;
        context.shadowColor = settings('labelHoverShadowColor');
      }

      if (typeof label === 'string') {
        x = Math.round(node[prefix + 'x'] - fontSize / 2 - 2);
        y = Math.round(node[prefix + 'y'] - fontSize / 2 - 2);
        w = Math.round(
          context.measureText(label).width + fontSize / 2 + size + 7 + nodeBorderSize
        );
        h = Math.round(fontSize + 4);
        e = Math.round(fontSize / 2 + 2);

        context.moveTo(x, y + e);
        context.arcTo(x, y, x + e, y, e);
        context.lineTo(x + w, y);
        context.lineTo(x + w, y + h);
        context.lineTo(x + e, y + h);
        context.arcTo(x, y + h, x, y + h - e, e);
        context.lineTo(x, y + e);

        context.closePath();
        context.fill();

        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = 0;
      }
    }

    // Node border:
    if (settings('borderSize') > 0) {
      context.beginPath();
      context.fillStyle = settings('nodeBorderColor') === 'node' ?
        (node.colorStr || settings('nodeColorDefaultValue')) :
        settings('defaultNodeBorderColor');
      context.arc(
        node[prefix + 'x'],
        node[prefix + 'y'],
        size + settings('borderSize'),
        0,
        Math.PI * 2,
        true
      );
      context.closePath();
      context.fill();
    }

    // Node:
    var nodeRenderer = sigma.canvas.nodes[node.type] || sigma.canvas.nodes.def;
    nodeRenderer(node, context, embedSettings, displayScale);

    // Display the label:
    if(drawlabels) {
      if (typeof label === 'string') {
        context.fillStyle = (settings('labelHoverColor') === 'node') ?
          (node.colorStr || settings('nodeColorDefaultValue')) :
          settings('defaultLabelHoverColor');

        context.fillText(
          label,
          Math.round(node[prefix + 'x'] + size + 3 + nodeBorderSize),
          Math.round(node[prefix + 'y'] + fontSize / 3)
        );
      }
    }
  };
}).call(this);
