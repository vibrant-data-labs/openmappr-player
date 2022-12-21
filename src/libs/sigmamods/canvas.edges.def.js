(function() {
	'use strict';

	sigma.utils.pkg('sigma.canvas.edges');
	sigma.utils.pkg('sigma.canvas.funcs');


	/**
	 * The default edge renderer. It renders the edge as a simple line.
	 *
	 * @param  {object}                   edge         The edge object.
	 * @param  {object}                   source node  The edge source node.
	 * @param  {object}                   target node  The edge target node.
	 * @param  {CanvasRenderingContext2D} context      The canvas context.
	 * @param  {configurable}             settings     The settings function.
	 */
	sigma.canvas.edges.def = function(edge, source, target, context, settings, displayScale) {
		var testFinite = function(val)
		{
		    return typeof val === "number" && isFinite(val);
		}
		//console.log(edge);
		
		var funcs = sigma.canvas.funcs;
		var drawLineTo = funcs.drawLineTo,
			drawQuadraticCurveTo = funcs.drawQuadraticCurveTo,
			moveTo = funcs.moveTo;

		var color = edge.colorStr,
			prefix = settings('prefix') || '',
			edgeColorStrat = settings('edgeColorStrat'),
			nodeColorDefaultValue = settings('nodeColorDefaultValue'),
			edgeColorDefaultValue = settings('edgeColorDefaultValue'),
			edgeAlpha = +settings('edgeSaturation'),
			nodeSizeMultiplier = 1,
			edgeTaper = settings('edgeTaper'),
			edgeTaperScale = +settings('edgeTaperScale') || 0.5,
			isEdgeSizeFixed = settings('edgeSizeStrat') === 'fixed',
			edgeSizeDefaultValue = +settings('edgeSizeDefaultValue');

//		if (source.inHover || source.isSelected) {
//			nodeSizeMultiplier = nodeSizeMultiplier * (+settings('highlightRatio') || 1);
//		}

		var sourceCol = (source) ? source.colorStr : 'rgb(0,0,0)';
		var targetCol = (target) ? target.colorStr : 'rgb(0,0,0)';

		var x1 = source[prefix + 'x']*displayScale,
			y1 = source[prefix + 'y']*displayScale,
			x2 = target[prefix + 'x']*displayScale,
			y2 = target[prefix + 'y']*displayScale,
			w = (isEdgeSizeFixed ? edgeSizeDefaultValue*edge[prefix + 'size']/edge['size'] : (edge[prefix + 'size'] || 1)) * displayScale,
			x1a = 0,
			x1b = 0,
			y1a = 0,
			y1b = 0;

		if(!testFinite(x1) || !testFinite(y1) ||!testFinite(x2) ||!testFinite(y2)) {
			return;
		}

		var curvature = settings('edgeCurvature') * 1.33;
		// Which Color mode to use
		switch (edgeColorStrat) {
			case 'source':
				color = source.colorStr || nodeColorDefaultValue;
				break;
			case 'target':
				color = target.colorStr || nodeColorDefaultValue;
				break;
			case 'attr' :
				color = edge.colorStr;
				break;
			case 'gradient' :
				var lineargradient = context.createLinearGradient(x1, y1, x2, y2);
				lineargradient.addColorStop(0, sourceCol);
				lineargradient.addColorStop(1, targetCol);
				color = lineargradient;
				break;
			default: // for 'select'
				color = edgeColorDefaultValue;
				break;
		}

		var currAlpha = context.globalAlpha ? context.globalAlpha : 1.0;
		context.globalAlpha = edgeAlpha;


		if (edgeTaperScale > 0.1 && edgeTaper) {
			context.fillStyle = color;

			// compute normal to path between nodes
			var dx = x2 - x1, dy = y2 - y1;
			var len = Math.sqrt(dx*dx + dy*dy);
			var nx = -dy/len, ny = dx/len;
			// compute offset points
			var w1 = w * (0.1 + edgeTaperScale);	// width at node 1
			x1a = x1 + w1*nx;
			y1a = y1 + w1*ny;
			x1b = x1 - w1*nx;
			y1b = y1 - w1*ny;
			context.beginPath();
			moveTo(context, x1a, y1a);
			if (curvature != 0) {
				drawQuadraticCurveTo(context, (x1a + x2) / 2 + curvature * (y2 - y1a) / 4, (y1a + y2) / 2 + curvature * (x1a - x2) / 4,
					x2, y2);
			} else {
				drawLineTo(context, x2, y2);
			}
			//drawLineTo(context, x2, y2);
			if (curvature != 0) {
				drawQuadraticCurveTo(context, (x1b + x2) / 2 + curvature * (y2 - y1b) / 4, (y1b + y2) / 2 + curvature * (x1b - x2) / 4,
					x1b, y1b);
			} else {
				drawLineTo(context, x1b, y1b);					
			}
			context.fill();
		} else {		// no taper
			context.beginPath();
			context.strokeStyle = color;
			context.lineWidth = w; //Math.max(0.2, w);   //edge[prefix + 'size']);
			moveTo(context, x1, y1);
			if (curvature != 0) {
				drawQuadraticCurveTo(context, (x1 + x2) / 2 + curvature * (y2 - y1) / 4, (y1 + y2) / 2 + curvature * (x1 - x2) / 4,
					x2,	y2);
			} else {
				drawLineTo(context, x2,	y2);
			}
			context.stroke();
			context.closePath();
		}

		context.globalAlpha = currAlpha;
	};

	sigma.canvas.funcs.drawLineTo = function drawLineTo(ctx, x1, y1) {
		//ctx.lineTo(x1 * mc.ratio + mc.stageX, (height - y1) * mc.ratio + mc.stageY);
		ctx.lineTo(x1, y1);
	};

	sigma.canvas.funcs.drawQuadraticCurveTo = function drawQuadraticCurveTo(ctx, x1, y1, x2, y2) {
		//ctx.quadraticCurveTo(x1 * mc.ratio + mc.stageX, (height - y1) * mc.ratio + mc.stageY, x2 * mc.ratio + mc.stageX, (height - y2) * mc.ratio + mc.stageY);
		ctx.quadraticCurveTo(x1, y1, x2, y2);
	};
	sigma.canvas.funcs.moveTo = function moveTo(ctx, x0, y0) {
		//ctx.moveTo(x0 * mc.ratio + mc.stageX, (height - y0) * mc.ratio + mc.stageY);
		ctx.moveTo(x0, y0);
	};

})();