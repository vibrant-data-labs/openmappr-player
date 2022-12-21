(function() {
	'use strict';

	sigma.utils.pkg('sigma.webgl.edges');

	/**
	 * This edge renderer will display edges as lines going from the source node
	 * to the target node. To deal with curvature and tapering edges but minimize
	 * the amount of data passed to the GPU, trianglular
	 * enclosing regions are defined and then pixels are excluded in the fragment shader 
	 */

	sigma.webgl.edges.curved = {
		POINTS: 9,
		ATTRIBUTES: 9,
		
		addEdge: function(edge, source, target, data, i, prefix, settings) {
      		var edgeTaper = settings('edgeTaper');
		    var edgeTaperScale = +settings('edgeTaperScale') || 0.5;
			var edgeColorStrat = settings('edgeColorStrat');
			var nodeColorDefaultValue = settings('nodeColorDefaultValue');
			var edgeColorStratDefaultValue = settings('edgeColorStratDefaultValue');
			var isEdgeSizeFixed = settings('edgeSizeStrat') === 'fixed';
			var edgeSizeDefaultValue = +settings('edgeSizeDefaultValue');
			var color1, color2;
			// Which Color mode to use
			switch (edgeColorStrat) {
			case 'source':
				color1 = color2 = source.colorStr || nodeColorDefaultValue;
				break;
			case 'target':
				color1 = color2 = target.colorStr || nodeColorDefaultValue;
				break;
			case 'attr' :
				color1 = color2 = edge.colorStr;
				break;
			case 'gradient' :
				color1 = (source) ? source.colorStr : 'rgb(0,0,0)';
				color2 = (target) ? target.colorStr : 'rgb(0,0,0)';
				break;
			default: // for 'select'
				color1 = color2 = edgeColorStratDefaultValue;
				break;
			}
			var w = (isEdgeSizeFixed ? edgeSizeDefaultValue : (edge[prefix + 'size'] || 1));
//			var w = edge[prefix + 'size'] || 1;
			var w1 = w * (edgeTaper ? (0.1 + edgeTaperScale) : 0.5),
				w2 = w * (edgeTaper ? 0.0 : 0.5),
				x1 = source[prefix + 'x'],
				y1 = source[prefix + 'y'],
				x2 = target[prefix + 'x'],
				y2 = target[prefix + 'y'],

			// Normalize color:
			color1 = sigma.utils.floatColor(color1);
			color2 = sigma.utils.floatColor(color2);

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.5;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.0;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.25;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.5;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.25;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.75;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.5;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 0.75;
			data[i++] = color1;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = w2;
			data[i++] = 1.0;
			data[i++] = color1;
			data[i++] = color2;
		},

		render: function(gl, program, data, params) {
			var buffer;

			// Define attributes:
			var color1Location = gl.getAttribLocation(program, 'a_color1'),
					color2Location = gl.getAttribLocation(program, 'a_color2'),
					positionLocation1 = gl.getAttribLocation(program, 'a_position1'),
					positionLocation2 = gl.getAttribLocation(program, 'a_position2'),
					thicknessLocation1 = gl.getAttribLocation(program, 'a_thickness1'),
					thicknessLocation2 = gl.getAttribLocation(program, 'a_thickness2'),
					tLocation = gl.getAttribLocation(program, 'a_t'),
					resolutionLocation = gl.getUniformLocation(program, 'u_resolution'),
					matrixLocation = gl.getUniformLocation(program, 'u_matrix'),
					scaleLocation =	gl.getUniformLocation(program, 'u_scale'),
					ratioLocation =	gl.getUniformLocation(program, 'u_ratio'),
					curvatureLocation = gl.getUniformLocation(program, 'u_curvature'),
					desatLocation = gl.getUniformLocation(program, 'u_desat');
			var desat = params.settings('edgeSaturation'), bgColor = params.settings('backgroundColor');
			if( desat == undefined ) {
				desat = 1.0;
			} else if( desat != 1 && mappr.utils.isDarkColor(bgColor) ) {
				desat += 1.0;
			}

			buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

			gl.uniform2f(resolutionLocation, params.width, params.height);
			gl.uniform1f(scaleLocation, params.scalingRatio);
		    gl.uniform1f(ratioLocation, params.ratio);
			gl.uniform1f(curvatureLocation, params.settings('edgeCurvature')/3);
			gl.uniform1f(desatLocation, desat);
			gl.uniformMatrix3fv(matrixLocation, false, params.matrix);

			gl.enableVertexAttribArray(color1Location);
			gl.enableVertexAttribArray(color2Location);
			gl.enableVertexAttribArray(positionLocation1);
			gl.enableVertexAttribArray(positionLocation2);
			gl.enableVertexAttribArray(thicknessLocation1);
			gl.enableVertexAttribArray(thicknessLocation2);
			gl.enableVertexAttribArray(tLocation);

			gl.vertexAttribPointer(positionLocation1,
				2,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				0
			);
			gl.vertexAttribPointer(positionLocation2,
				2,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				8
			);
			gl.vertexAttribPointer(thicknessLocation1,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				16
			);
			gl.vertexAttribPointer(thicknessLocation2,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				20
			);
			gl.vertexAttribPointer(tLocation,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				24
			);
			gl.vertexAttribPointer(color1Location,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				28
			);
			gl.vertexAttribPointer(color2Location,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				32
			);

			gl.drawArrays(
				gl.TRIANGLES,
				params.start || 0,
				params.count || (data.length / this.ATTRIBUTES)
			);
		},
		initProgram: function(gl) {
			var vertexShader,
					fragmentShader,
					program;

			vertexShader = sigma.utils.loadShader(
				gl,
				[
					'attribute vec2 a_position1;',
					'attribute vec2 a_position2;',
					'attribute float a_thickness1;',
					'attribute float a_thickness2;',
					'attribute float a_t;',
					'attribute float a_color1;',
					'attribute float a_color2;',

					'uniform vec2 u_resolution;',
					'uniform float u_scale;',
					'uniform float u_ratio;',
					'uniform float u_curvature;',
					'uniform float u_desat;',
					'uniform mat3 u_matrix;',

					'varying vec4 color1;',
					'varying vec4 color2;',
					'varying float u;',
					'varying float v;',
					'varying float pxScale;',	// pixel scale in v corrdinate units
					'varying float vmax;',		// max v value at center (u == 0.5)
					'varying float vmin;',		// min v value at center (u == 0.5)
					'varying float w1;',
					'varying float w2;',

					'vec3 rgb2hsv(vec3 c) {',
					    'vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);',
					    'vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));',
					    'vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));',
						'float d = q.x - min(q.w, q.y);',
					    'float e = 1.0e-10;',
					    'return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);',
					'}',

					'vec3 hsv2rgb(vec3 c) {',
					    'vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
					    'vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
					    'return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
					'}',

					'vec3 shiftColor(vec3 color, float desat) {',
						'vec3 hsv = rgb2hsv(color);',
						'hsv.y *= min(desat, 1.0);',
						'hsv.z = step(1.0, desat)*(1.0 - desat)*(2.0*hsv.z - 1.0) + (desat*(hsv.z - 1.0) + 1.0);',
						'return hsv2rgb(hsv);',
					'}',

					'void main() {',
						'vec2 position;',
						'float vecLen = length(a_position2 - a_position1);',	// length of edge
						'float cpOffset = u_curvature * vecLen;',				// control point offset distance
						'float slope = 2.0*cpOffset/vecLen;',
						'float halfWd;',	// half width (normal to line) of line
						'float halfHt;',	// half height (normal to edge) of line at nodes						
						'float relWd;',		// line width as fraction of control point offset
						'float relHt;',		// line width as fraction of control point offset
						'float wd1 = a_thickness1, wd2 = a_thickness2;',
						'float factor;',	// multiplier used to compute offset of endpoints
						'float factor2;',
						'vec2 edgeVec;',
						'vec2 normVec;',
						'vec2 wdVec;',
						'vec2 htVec;',
						'vec2 endVec;',

						// force minimum edge width
						'wd1 = max(a_thickness1, 0.25 * u_ratio/u_scale);',
						'wd2 = max(a_thickness2, 0.25 * u_ratio/u_scale);',
						'halfWd = halfWd = max(wd1, wd2);',
						'halfHt = halfWd * sqrt(1.0 + slope*slope);',		// half height (normal to edge) of line at nodes						
						'factor = (3.0*cpOffset + 2.0*(halfHt - halfWd))/(cpOffset - 2.0*(halfHt - halfWd));',
						'factor2 = (cpOffset - 2.0*(halfHt - halfWd))/cpOffset;',
						'relWd = halfWd/cpOffset;',						// line width as fraction of control point offset
						'relHt = halfHt/cpOffset;',						// line width as fraction of control point offset
						'edgeVec = normalize(a_position2 - a_position1);',
						'normVec = vec2(-edgeVec.y, edgeVec.x);',
						'wdVec = halfWd * normVec;',
						'htVec = halfHt * normVec;',
						'endVec = edgeVec * halfHt * 2.0 * vecLen/(cpOffset - 2.0*(halfHt - halfWd));',
						
						'if(a_t == 0.0) {',		// set variables at end 1 (B)
							'position = a_position1 + factor * htVec - endVec;',
							'u = -2.0 * relHt / (1.0 - 2.0*(relHt - relWd));',
							'v = -relHt * factor;',
						'} else if(a_t == 1.0) {',	// set variables at end 2 (E)
							'position = a_position2 + factor * htVec + endVec;',
							'u = 1.0 + 2.0 * relHt / (1.0 - 2.0*(relHt - relWd));',
							'v = -relHt * factor;',
						'} else if(a_t == 0.25) {',				// set variables at point (C)
							'u = 0.25 * factor2;',
							'position = ((1.0 - u) * a_position1 + u * a_position2) - cpOffset * normVec/2.0 - wdVec;',
							'v = 0.5 + relWd;',
						'} else if(a_t == 0.75) {',				// set variables at point (D)
							'u = 1.0 - 0.25 * factor2;',
							'position = ((1.0 - u) * a_position1 + u * a_position2) - cpOffset * normVec/2.0 - wdVec;',
							'v = 0.5 + relWd;',
						'} else {',				// set variables at fan point (A)
							'position = (a_position1 + a_position2)/2.0 - cpOffset * normVec/2.0 + wdVec;',
							'u = 0.5;',
							'v = 0.5 - relWd;',
						'}',
						// compute geometry variables passed to fragment shader
						'pxScale = u_ratio/cpOffset;',	
						'vmax = 0.5 + relWd;',	
						'vmin = 0.5 - relWd;',
						'w1 = wd1/cpOffset;',	// relative thickness
						'w2 = wd2/cpOffset;',

						// Scale vertex position from [[-1 1] [-1 1]] to the container:
            			'position = ((u_matrix * vec3(position, 1)).xy / u_resolution * 2.0 - 1.0) * vec2(1, -1);',
			            'gl_Position = vec4(position, 0, 1);',

						// Extract the colors:
						'float c = a_color1;',
						'color1.b = mod(c, 256.0); c = floor(c / 256.0);',
						'color1.g = mod(c, 256.0); c = floor(c / 256.0);',
						'color1.r = mod(c, 256.0); c = floor(c / 256.0);',
						'color1 /= 255.0;',
						'color1.a = 0.9;',
						'c = a_color2;',
						'color2.b = mod(c, 256.0); c = floor(c / 256.0);',
						'color2.g = mod(c, 256.0); c = floor(c / 256.0);',
						'color2.r = mod(c, 256.0); c = floor(c / 256.0);',
						'color2 /= 255.0;',
						'color2.a = 0.9;',
						'color1.rgb = shiftColor(color1.rgb, u_desat);',
						'color2.rgb = shiftColor(color2.rgb, u_desat);',
					'}'
				].join('\n'),
				gl.VERTEX_SHADER,
		        console.log.bind(console)	// for shader compiler error output
			);

			fragmentShader = sigma.utils.loadShader(
				gl,
				[
					'precision mediump float;',

					'varying vec4 color1;',
					'varying vec4 color2;',
					'varying float u;',
					'varying float v;',
					'varying float pxScale;',
					'varying float vmax;',
					'varying float vmin;',
					'varying float w1;',		// line width in v-coord
					'varying float w2;',

					'void main(void) {',
						'float wd = (1.0 - u) * w1 + u * w2;',		// line half-width in v coord
						'if(u < 0.0 || u > 1.0 || v > vmax )',	// toss out the obviously superfluous pixels
//			            	'gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);',   // draw exterior pink for debugging
							'discard;',
						'else {',
							'float ht = max(w1, w2) * 1.4142136;',
				            'float aa = 0.5 * pxScale;',        // relative antialiasing width
							'float val = 2.0*u*(1.0 - u);',				// quad spline v value
							'float delta1 = v - (val - wd - aa/2.0);',	// delta from lower edge
							'float delta2 = (val + wd + aa/2.0) - v;',	// delta from upper edge
							'if(delta1 > 0.0 && delta2 > 0.0) {',		// keep points in the arc
								'gl_FragColor = (1.0 - u) * color1 + u * color2;',
								// antialias by lowering transparency near edge
								'float d1 = min(delta1, aa);',
								'float d2 = min(delta2, aa);',
								'gl_FragColor.a = 2.0*min(d1, d2)/(d1 + d2);',
							'}',
							'else',
//				            	'gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);',   // draw exterior red for debugging
								'discard;',
						'}',
					'}'
				].join('\n'),
				gl.FRAGMENT_SHADER,
		        console.log.bind(console)	// for shader compiler error output
			);

			program = sigma.utils.loadProgram(gl, [vertexShader, fragmentShader]);

			return program;
		}
	};

})();
