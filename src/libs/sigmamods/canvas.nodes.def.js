(function() {
	'use strict';

	sigma.utils.pkg('sigma.canvas.nodes');

	/**
	 * The default node renderer. It renders the node as a simple disc.
	 *
	 * @param  {object}                   node     The node object.
	 * @param  {CanvasRenderingContext2D} context  The canvas context.
	 * @param  {configurable}             settings The settings function.
	 */
	sigma.canvas.nodes.def = function(node, context, settings, displayScale) {
		console.assert(!node.isAggregation, 'This renderer is not for aggregated nodes');
		var prefix = settings('prefix') || '';

		//color stuff

		var darkenColor = mappr.utils.darkenColor,
			lightenColor = mappr.utils.lightenColor,
			nodeColorDefaultValue = settings('nodeColorDefaultValue'),
			nodeOpacityStrategy = settings('nodeOpacityStrategy'),
			nodeAlpha = +settings('nodeOpacity');

		var nodeSizeScale = 1;

		if (node.inHover || node.isSelected) {
			nodeSizeScale = nodeSizeScale * (+settings('highlightRatio') || 1);
		}

		var x = node[prefix + 'x']*displayScale, y = node[prefix + 'y']*displayScale, size = node[prefix + 'size']*displayScale;

		//if (node.inHover) console.debug('node-hover-x,y', node[prefix + 'x'], node[prefix + 'y']);

		context.save();
		context.globalAlpha = (nodeOpacityStrategy == 'fixed') ? nodeAlpha : 1;

		// Render the selection ring
		if ((node.inHover) && settings('renderSelection')) {
			context.fillStyle = lightenColor(node.color, 0.3); //'rgb(255,0,0)';
			context.lineWidth = 2;
			context.beginPath();
			context.arc(
				x,
				y,
				size + 4*displayScale, // + Math.max(5, size / 2),
				0,
				Math.PI * 2,
				true
			);
			context.closePath();
			context.fill();
		}

		if( settings('drawBorder') ) {
			context.fillStyle = darkenColor(node.color);

			context.beginPath();
			context.arc(
				x,
				y,
				size,
				0,
				Math.PI * 2,
				true
			);
			context.closePath();
			context.fill();
			//size -= displayScale;		
		}
		if (!node.isAggregation) {
			context.fillStyle = node.colorStr || nodeColorDefaultValue;
			context.beginPath();
			context.arc(
				x,
				y,
				size,
				0,
				Math.PI * 2,
				true
			);
			context.closePath();
			context.fill();
		}

		context.restore();
	};
})();