(function() {
	'use strict';

	sigma.utils.pkg('sigma.webgl.edges');

	/**
	 * This edge renderer will display edges as lines going from the source node
	 * to the target node. To deal with edge thicknesses, the lines are made of
	 * two triangles forming rectangles, with the gl.TRIANGLES drawing mode.
	 *
	 * It is expensive, since drawing a single edge requires 6 points, each
	 * having 7 attributes (source position, target position, thickness, color
	 * and a flag indicating which vertex of the rectangle it is).
	 */
	sigma.webgl.edges.straight = {
		POINTS: 6,
		ATTRIBUTES: 7,
		addEdge: function(edge, source, target, data, i, prefix, settings) {
			var edgeTaper = settings('edgeTaper');
			var edgeTaperScale = +settings('edgeTaperScale') || 0.5;
			var edgeColorStrat = settings('edgeColorStrat');
			var nodeColorDefaultValue = settings('nodeColorDefaultValue');
			var edgeColorDefaultValue = settings('edgeColorDefaultValue');
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
				color1 = color2 = edgeColorDefaultValue;
				break;
			}
			var w1 = (isEdgeSizeFixed ? edgeSizeDefaultValue : edge[prefix + 'size'] || 1) / 2,
				w2 = (edgeTaper ? (0.1 + edgeTaperScale) : 1) * w1,
				x1 = source[prefix + 'x'],
				y1 = source[prefix + 'y'],
				x2 = target[prefix + 'x'],
				y2 = target[prefix + 'y']

			// Normalize color:
			color1 = sigma.utils.floatColor(color1);
			color2 = sigma.utils.floatColor(color2);

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = 0.0;
			data[i++] = color1;

			data[i++] = x2;
			data[i++] = y2;
			data[i++] = x1;
			data[i++] = y1;
			data[i++] = w2;
			data[i++] = 1.0;
			data[i++] = color2;

			data[i++] = x2;
			data[i++] = y2;
			data[i++] = x1;
			data[i++] = y1;
			data[i++] = w2;
			data[i++] = 0.0;
			data[i++] = color2;

			data[i++] = x2;
			data[i++] = y2;
			data[i++] = x1;
			data[i++] = y1;
			data[i++] = w2;
			data[i++] = 0.0;
			data[i++] = color2;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = 1.0;
			data[i++] = color1;

			data[i++] = x1;
			data[i++] = y1;
			data[i++] = x2;
			data[i++] = y2;
			data[i++] = w1;
			data[i++] = 0.0;
			data[i++] = color1;
		},

		render: function(gl, program, data, params) {
			var buffer;

			// Define attributes:
			var colorLocation =
						gl.getAttribLocation(program, 'a_color'),
					positionLocation1 = gl.getAttribLocation(program, 'a_position1'),
					positionLocation2 = gl.getAttribLocation(program, 'a_position2'),
					thicknessLocation = gl.getAttribLocation(program, 'a_thickness'),
					minusLocation = gl.getAttribLocation(program, 'a_minus'),
					resolutionLocation = gl.getUniformLocation(program, 'u_resolution'),
					matrixLocation = gl.getUniformLocation(program, 'u_matrix'),
					matrixHalfPiLocation = gl.getUniformLocation(program, 'u_matrixHalfPi'),
					matrixHalfPiMinusLocation =	gl.getUniformLocation(program, 'u_matrixHalfPiMinus'),
					scaleLocation =	gl.getUniformLocation(program, 'u_scale'),
					ratioLocation =	gl.getUniformLocation(program, 'u_ratio'),
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
			gl.uniform1f(desatLocation, desat);
			gl.uniformMatrix3fv(matrixLocation, false, params.matrix);
			gl.uniformMatrix2fv(
				matrixHalfPiLocation,
				false,
				sigma.utils.matrices.rotation(Math.PI / 2, true)
			);
			gl.uniformMatrix2fv(
				matrixHalfPiMinusLocation,
				false,
				sigma.utils.matrices.rotation(-Math.PI / 2, true)
			);

			gl.enableVertexAttribArray(colorLocation);
			gl.enableVertexAttribArray(positionLocation1);
			gl.enableVertexAttribArray(positionLocation2);
			gl.enableVertexAttribArray(thicknessLocation);
			gl.enableVertexAttribArray(minusLocation);

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
			gl.vertexAttribPointer(thicknessLocation,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				16
			);
			gl.vertexAttribPointer(minusLocation,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				20
			);
			gl.vertexAttribPointer(colorLocation,
				1,
				gl.FLOAT,
				false,
				this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
				24
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
					'attribute float a_thickness;',
					'attribute float a_minus;',
					'attribute float a_color;',

					'uniform vec2 u_resolution;',
					'uniform float u_scale;',
					'uniform float u_ratio;',
					'uniform float u_desat;',
					'uniform mat3 u_matrix;',
					'uniform mat2 u_matrixHalfPi;',
					'uniform mat2 u_matrixHalfPiMinus;',

					'varying vec4 color;',

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
						'float wd = max(a_thickness, 0.25 * u_ratio/u_scale);',
						// Find the good point:
						'vec2 position = wd * normalize(a_position2 - a_position1);',	// vector between points
						'mat2 matrix = a_minus * u_matrixHalfPiMinus +',		// to compute normal to vector between points
							'(1.0 - a_minus) * u_matrixHalfPi;',

						'position = matrix * position + a_position1;',			// offset by line width

						// Scale from [[-1 1] [-1 1]] to the container:
						'gl_Position = vec4(',
							'((u_matrix * vec3(position, 1)).xy /',
								'u_resolution * 2.0 - 1.0) * vec2(1, -1),',
							'0,',
							'1',
						');',

						// Extract the color:
						'float c = a_color;',
						'color.b = mod(c, 256.0); c = floor(c / 256.0);',
						'color.g = mod(c, 256.0); c = floor(c / 256.0);',
						'color.r = mod(c, 256.0); c = floor(c / 256.0); color /= 255.0;',
						'color.a = 0.9;',
						'color.rgb = shiftColor(color.rgb, u_desat);',
					'}'
				].join('\n'),
				gl.VERTEX_SHADER
			);

			fragmentShader = sigma.utils.loadShader(
				gl,
				[
					'precision mediump float;',

					'varying vec4 color;',

					'void main(void) {',
						'gl_FragColor = color;',
					'}'
				].join('\n'),
				gl.FRAGMENT_SHADER
			);

			program = sigma.utils.loadProgram(gl, [vertexShader, fragmentShader]);

			return program;
		}
	};
})();
