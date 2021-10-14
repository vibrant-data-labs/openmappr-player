(function() {
  'use strict';

  sigma.utils.pkg('sigma.webgl.clusters');

  /**
   * This renderer will display clusters as discs, shaped in triangles with
   * the gl.TRIANGLES display mode. So, to be more precise, to draw one node,
   * it will store three times the center of node, with the color and the size,
   * and an angle indicating which "corner" of the triangle to draw.
   *
   * The fragment shader does not deal with anti-aliasing, so make sure that
   * you deal with it somewhere else in the code (by default, the WebGL
   * renderer will oversample the rendering through the webglOversamplingRatio
   * value).
   */
  sigma.webgl.clusters.def = {
    POINTS: 3,
    ATTRIBUTES: 5,
    addCluster: function(cluster, data, i, prefix, settings) {
      if (!cluster.nodes.length) return;

      var node = cluster.nodes[0];
      var color = sigma.utils.floatColor(
        node.colorStr || settings('nodeColorDefaultValue')
      );

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

      data[i++] = center.x;
      data[i++] = center.y;
      data[i++] = size; //node[prefix + 'size'];
      data[i++] = color;
      data[i++] = 0;

      data[i++] = center.x;
      data[i++] = center.y;
      data[i++] = size;
      data[i++] = color;
      data[i++] = 2 * Math.PI / 3;

      data[i++] = center.x;
      data[i++] = center.y;
      data[i++] = size;
      data[i++] = color;
      data[i++] = 4 * Math.PI / 3;
    },
    render: function(gl, program, data, params) {
      var buffer;
      var border = params.settings('drawBorder') ? params.settings('borderRatio') : 0;

      // Define attributes:
      var positionLocation =
            gl.getAttribLocation(program, 'a_position'),
          sizeLocation =
            gl.getAttribLocation(program, 'a_size'),
          colorLocation =
            gl.getAttribLocation(program, 'a_color'),
          angleLocation =
            gl.getAttribLocation(program, 'a_angle'),
          resolutionLocation =
            gl.getUniformLocation(program, 'u_resolution'),
          matrixLocation =
            gl.getUniformLocation(program, 'u_matrix'),
          ratioLocation =
            gl.getUniformLocation(program, 'u_ratio'),  // camera ratio
          scaleLocation =
            gl.getUniformLocation(program, 'u_scale'),  // oversampling ratio
          borderLocation =
            gl.getUniformLocation(program, 'u_border');

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

      gl.uniform2f(resolutionLocation, params.width, params.height);
      gl.uniform1f(ratioLocation, params.ratio);
      gl.uniform1f(scaleLocation, params.scalingRatio);
      gl.uniform1f(borderLocation, border);
      gl.uniformMatrix3fv(matrixLocation, false, params.matrix);

      gl.enableVertexAttribArray(positionLocation);
      gl.enableVertexAttribArray(sizeLocation);
      gl.enableVertexAttribArray(colorLocation);
      gl.enableVertexAttribArray(angleLocation);

      gl.vertexAttribPointer(
        positionLocation,
        2,
        gl.FLOAT,
        false,
        this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
        0
      );
      gl.vertexAttribPointer(
        sizeLocation,
        1,
        gl.FLOAT,
        false,
        this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
        8
      );
      gl.vertexAttribPointer(
        colorLocation,
        1,
        gl.FLOAT,
        false,
        this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
        12
      );
      gl.vertexAttribPointer(
        angleLocation,
        1,
        gl.FLOAT,
        false,
        this.ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT,
        16
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
          'attribute vec2 a_position;',
          'attribute float a_size;',
          'attribute float a_color;',
          'attribute float a_angle;',

          'uniform vec2 u_resolution;',
          'uniform float u_ratio;',
          'uniform float u_scale;',
          'uniform mat3 u_matrix;',

          'varying vec4 color;',
          'varying float u;',
          'varying float v;',
          'varying float pxScale;',

          'void main(void) {',
            // re-scale radius
            'float radius = a_size / u_ratio;',

            // Scale from [[-1 1] [-1 1]] to the container:
            'vec2 position = (u_matrix * vec3(a_position, 1)).xy;',
            'position = position + 2.0 * radius * vec2(cos(a_angle), sin(a_angle));',
            'position = (2.0 * position / u_resolution - 1.0) * vec2(1, -1);',

            'gl_Position = vec4(position, 0, 1);',
            // set up u, v coordinates
            'if(a_angle == 0.0) {',
              'u = 2.0;',
              'v = 0.0;',
            '} else {',
              'u = -1.0;',
              'v = sqrt(3.0);',
              'if(a_angle > 3.0) {',
                'v = -v;',
              '}',
            '}',

            'pxScale = 1.0/radius;',

            // Extract the color:
            'float c = a_color;',
            'color.b = mod(c, 256.0); c = floor(c / 256.0);',
            'color.g = mod(c, 256.0); c = floor(c / 256.0);',
            'color.r = mod(c, 256.0); c = floor(c / 256.0); color /= 255.0;',
            'color.a = 1.0;',
          '}'
        ].join('\n'),
        gl.VERTEX_SHADER,
        console.log.bind(console)
      );

      fragmentShader = sigma.utils.loadShader(
        gl,
        [
          'precision mediump float;',

          'uniform float u_border;',
          'varying vec4 color;',
          'varying float u;',
          'varying float v;',
          'varying float pxScale;',

          'void main(void) {',
            'vec4 color1;',

            'float normR = sqrt(u*u + v*v);',   // normalized distance from the center
            'float diff = 1.0 - normR;',        // compute fractional distance from edge
            // throw out pixels to draw a disc instead of a triangle
            'if(diff > 0.0) {',
               // darken color to make the border color
               // antialias darkening on inner edge of border
              'float aa = pxScale;',        // relative antialiasing width
              'float darken = max(0.0, 0.3 * ((diff/aa > 2.0-aa) ? (-u_border)/aa : 1.0));',
              // 'float darken = max(0.0, 0.3 * ((diff > u_border - aa) ? (u_border - diff)/aa : 1.0));',
              'color1.b = max(0.0, color.b);',
              'color1.g = max(0.0, color.g);',
              'color1.r = max(0.0, color.r);',
              'color1.a = darken > 0.0? 0.7 : 0.0;',  // linear blend antialiasing on outer edge of disk
              //'color1.a = (diff < aa) ? 1.0 : 0.0;',  // linear blend antialiasing on outer edge of disk
              'gl_FragColor = color1;',
            '} else',
//              'gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);',   // draw exterior of triangle red for debugging
              'discard;',
          '}'
        ].join('\n'),
        gl.FRAGMENT_SHADER,
        console.log.bind(console)
      );

      program = sigma.utils.loadProgram(gl, [vertexShader, fragmentShader]);

      return program;
    }
  };
})();
