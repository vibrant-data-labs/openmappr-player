(function() {
    'use strict';

    sigma.utils.pkg('mappr');

  /**
   *  Utility functions in mappr app.
   */
  mappr.utils = {};
  (function() {

    // Node Attr stuff
    /**
     * Check to see if the nodeAttr is numeric or not. 
     * @param  {[type]}  attribName [description]
     * @param  {[type]}  nodes      [description]
     * @return {Boolean}            [description]
     */
    function isNodeAttrNumeric(attribName, nodes) {
      var attrObj = nodes[0].attr[attribName];
      return attrObj && _.isFinite(Number(attrObj.value));
    }
    function getNodeAttrValues(attribName, nodes) {
      //console.log(dataGraph.getAllNodes());
      //console.log(_.pluck(dataGraph.getAllNodes(), 'attr'));
      //console.log(_.pluck(_.pluck(_.pluck(dataGraph.getAllNodes(), 'attr'), attribName)));
      return _.unique(_.pluck(_.pluck(_.pluck(nodes, 'attr'), attribName), 'value'));
    }
    function getNodeAttrValueBounds(attribName, nodes) {
      var valuesStrs = _.compact(_.pluck(_.pluck(_.pluck(nodes, 'attr'), attribName), 'value'));
      var values = _.map(valuesStrs, parseFloat);
      
      return {
        max: _.max(values),
        min: _.min(values)
      };
    }
    this.isNodeAttrNumeric = isNodeAttrNumeric;
    this.getNodeAttrValues = getNodeAttrValues;
    this.getNodeAttrValueBounds = getNodeAttrValueBounds;
    //
    // Common Render stuff
    // 
    
    // color array to string 
    function colorStr(colorArr) {
      if (colorArr) {
        return 'rgb(' + colorArr[0] + ',' + colorArr[1] + ',' + colorArr[2] + ')';
      } else {
        return colorArr;
      }
    }

    function darkenColor(color, k) {
      if (!color) {
        return color;
      }

      if (k){
        var colArr = [Math.max(0, color[0]*k), Math.max(0, color[1]*k), Math.max(0, color[2]*k)];
        return 'rgb(' + colArr[0] + ',' + colArr[1] + ',' + colArr[2] + ')';
      } else {
        var colArr = [Math.max(0, color[0]-80), Math.max(0, color[1]-80), Math.max(0, color[2]-80)];
        //console.log(color, '->', colArr);
        return 'rgb(' + colArr[0] + ',' + colArr[1] + ',' + colArr[2] + ')';
      }
    }

    function lightenColor(color, opacity) {
      var colArr = [Math.min(255, color[0] + 80), Math.min(255, color[1] + 80), Math.min(255, color[2] + 80)];
      if(opacity !== undefined ) 
        return 'rgba(' + colArr[0] + ',' + colArr[1] + ',' + colArr[2] + ',' + opacity + ')';
      else
        return 'rgb(' + colArr[0] + ',' + colArr[1] + ',' + colArr[2] + ')';
    }

    function prepareColorArrayForRainbow(colorObjArr){
      return _.map(colorObjArr, function(obj){
        return (obj.col).substring(1, obj.col.length);
      });
    }

    function getDarkColorStr(color, k) {
      return d3.rgb(color).darker(k).toString();
    }

    function getLightColorStr(color, k) {
      return d3.rgb(color).brighter(k).toString();
    }

    function opaqueColor(colArr, opacity) {
      return 'rgba(' + colArr[0] + ',' + colArr[1] + ',' + colArr[2] + ',' + opacity + ')';
    }

    // color is a hex or rgb string
    //
    var isDarkColor = function(color) {
      var c = d3.rgb(color);
      var val = 0.21*c.r + 0.71*c.g + 0.08*c.b;
      return val < 128;
    }

    this.colorStr = colorStr;
    this.darkenColor = darkenColor;
    this.lightenColor = lightenColor;
    this.isDarkColor = isDarkColor;
    this.opaqueColor = opaqueColor;
    this.prepareColorArrayForRainbow = prepareColorArrayForRainbow;
    this.getDarkColorStr = getDarkColorStr;
    this.getLightColorStr = getLightColorStr;

    // 
    // D3 specific funcs
    // Used in d3.
    function nodeId (node) {
      return node.id;
    }
    function isSpecial (node) {
      return node.isSelected || node.isNeighbourOfSelected || node.inHover;
    }

    function toPx(value) {
      return '' + Math.round(value) + 'px';
    }
    this.nodeId = nodeId;
    this.isSpecial = isSpecial;
    this.toPx = toPx;

    //
    // Mathematical and value modifiers
    //
    
    function limitValue(value, min, max) {
      return Math.max(Math.min(value, max), min);
    }

    //Inverts the result of a boolean function
    function invert(booleanF) {
      return function(d) {
        return !booleanF(d);
      };
    }
    //multiplies the result of the function with the number
    function multi(num, numericF) {
      return function(d) {
        return num * numericF(d);
      };
    }
    //adds to  the result of the function with the number
    function add(num, numericF) {
      return function(d) {
        return num + numericF(d);
      };
    }

    function isNumeric(n) {
      return !isNaN(n) && isFinite(n);
    }

    // produce a nicely trunncated numeric string for display
    //
    function numericString(val) {
      val = parseFloat(val);
      if( !isNumeric(val) || val % 1 == 0) {
        return val.toString();
      }
      var v = Math.abs(val);
      if( v < 10 ) {
        return val.toPrecision(3);
      } else {
        v = Math.floor(Math.log10(v)) + (val % 1 == 0 ? 1 : 2);
        return val.toPrecision(v);
      }
    }

    this.limitValue = limitValue;
    this.invert = invert;
    this.multi = multi;
    this.add = add;
    this.isNumeric = isNumeric;
    this.numericString = numericString;
    
    //
    // Function factories
    //
    
    // A cache of manufactured functions
    var funcCache = {};
    window.funcCache = funcCache; // introspection

    // Manufactures a function to pluck attributes out of objects.
    function plucker(attribName) {
      var name = 'plucker_' + attribName;
      var f = funcCache[name];

      if(!f) {
        f = function(obj) {
          return obj[attribName];
        };
        funcCache[name] = f;
      }
      return f;
    }

    // A builds a predicate function which returns true if the object attribute,'attribName', is greater than 'compareTo'
    function greaterThan(attribName, compareTo) {
      var name = 'greaterThan_' + attribName + '_' + compareTo;
      var f = funcCache[name];

      if(!f) {
        f = function(obj) {
          return obj[attribName] > compareTo;
        };
        funcCache[name] = f;
      }
      return f;
    }
    // A builds a predicate function which returns true if the object attribute,'attribName', is lesser than 'compareTo'
    function lesserThan(attribName, compareTo) {
      var name = 'lesserThan_' + attribName + '_' + compareTo;
      var f = funcCache[name];

      if(!f) {
        f = function(obj) {
          return obj[attribName] < compareTo;
        };
        funcCache[name] = f;
      }
      return f;
    }

    this.plucker = plucker;
    this.lesserThan = lesserThan;
    this.greaterThan = greaterThan;
    
  }).call(mappr.utils);
})();
