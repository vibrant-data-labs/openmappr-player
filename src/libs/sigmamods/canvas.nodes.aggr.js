(function() {
	'use strict';

	sigma.utils.pkg('sigma.canvas.nodes');

	/**
	 * The Aggregation node renderer. It renders the node as a simple donut.
	 *
	 * @param  {object}                   node     The node object.
	 * @param  {CanvasRenderingContext2D} context  The canvas context.
	 * @param  {configurable}             settings The settings function.
	 */
	sigma.canvas.nodes.aggr = function(node, context, settings, displayScale) {
		//console.log('aggregatedNode', node);
		//console.assert(node.isAggregation, 'Node should be aggregated for this renderer to work');
		var prefix = settings('prefix') || '';
		//color stuff
		var aggregationColor = settings('aggregationColor') || 'rgb(0,0,0)';
		var nodeColorDefaultValue = settings('nodeColorDefaultValue');
		var darkenColor = mappr.utils.darkenColor;
		var lightenColor = mappr.utils.lightenColor;

		function aggregationDisk(color) {
			var colArr = color;
			return 'rgba(' + colArr[0] + ',' + colArr[1] + ',' + colArr[2] + ',' + '0.3' + ')';
		}
		//sizes
		var nodeSizeScale = 1;

		if (node.inHover || node.isSelected) {
			nodeSizeScale = nodeSizeScale * (+settings('highlightRatio') || 1);
		}
		//var size = node[prefix + 'size'] * nodeSizeScale;
		var x = node[prefix + 'x']*displayScale, y = node[prefix + 'y']*displayScale, size = node[prefix + 'size']*displayScale;
		

		// // Render the selection ring
		// if (node.isSelected && settings('renderSelection')) {
		// 	context.fillStyle = lightenColor(node.color, 0.8); //'rgb(255,0,0)';
		// 	//context.lineWidth = 2;
		// 	context.beginPath();
		// 	context.arc(
		// 		node[prefix + 'x'],
		// 		node[prefix + 'y'],
		// 		node[prefix + 'size'] + 4, // + Math.max(5, size / 2),
		// 		0,
		// 		Math.PI * 2,
		// 		true
		// 	);
		// 	context.closePath();
		// 	context.fill();
		// }

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
		if (node.isAggregation) {
			context.fillStyle = node.colorStr || nodeColorDefaultValue;

			context.beginPath();
			context.arc(
				x,y,size,
				0,
				Math.PI * 2,
				true
			);
			context.closePath();
			context.fill();
		}

		//drawDonut(node);

		//helper function : draw the donut one wedge at a time
		var totalArc = 0;

		function drawDonut(node) {
			totalArc = -Math.PI/2;
			var nodeColorArrs = node['aggregatedColorArray'];//node.aggregatedNodes;
			for (var i = nodeColorArrs.length - 1; i >= 0; i--) {
				drawWedge(100/nodeColorArrs.length, nodeColorArrs[i].darker());//nodeColorArrs[i].colorStr);
			}
			// cut out an inner-circle for donut
			context.beginPath();
			context.moveTo(x, y);
			context.fillStyle = node.colorStr;//aggregationDisk(node.color);//'rgb(255,255,255)';
			context.arc(x, y, size * 0.80, 0, 2 * Math.PI, false);
			context.fill();
		}

		//helper function: draw wedge
		function drawWedge(percent, color) {
			var arcRadians = (percent / 100) *  2 * Math.PI;
			context.save();
			context.beginPath();
			context.moveTo(x, y);
			context.arc(x, y, size, totalArc, totalArc + arcRadians, false);
			context.closePath();
			context.fillStyle = color.toString();
			context.fill();
			context.restore();
			totalArc += arcRadians;
		}
	};
})();