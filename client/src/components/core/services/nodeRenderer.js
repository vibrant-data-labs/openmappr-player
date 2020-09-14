/**
* Node rendering APIs for graph
*/
angular.module('common')
.service('nodeRenderer', [function() {

    "use strict";


    /*************************************
    *************** API ******************
    **************************************/
    this.d3NodeHighlightCreate = d3NodeHighlightCreate;
    this.d3NodeHighlightRender = d3NodeHighlightRender;




    /*************************************
    ********* Local Data *****************
    **************************************/

    //
    // Collection of node renderers for each node state. each renderer takes
    // 1) node
    // 2) canvas / d3 elem
    // 3) settings
    //

    //////////////////////
    // Enable pie rendering of aggregations
    //////////////////////
    var enablePieRendering = true;

    var nodeClasses = {
        classDefault            : 'sigma-d3-node',
        classSelected           : 'sigma-d3-node-selected',
        classSelectedNeighbour  : 'sigma-d3-node-selected-neighbour',
        classHover              : 'sigma-d3-node-hover',
        classUnhover            : 'sigma-d3-node-unhover',
        classHide               : 'sigma-d3-hide',
        classPop                : 'sigma-d3-pop'
    };


    /*************************************
    ********* Core Functions *************
    **************************************/

    //Function references
    var toPx = window.mappr.utils.toPx,
        darkenColor = window.mappr.utils.darkenColor;
        // nodeId = window.mappr.utils.nodeId,
        // isSpecial = window.mappr.utils.isSpecial,
        // invert = window.mappr.utils.invert,
        // multi = window.mappr.utils.multi,
        // add = window.mappr.utils.add,
        // plucker = window.mappr.utils.plucker,
        // lightenColor = window.mappr.utils.lightenColor;


    // function nodeStateClassMap (nodeState) {
    //  var classMap = {
    //      'default' : nodeClasses.classDefault,
    //      'highlighted' : nodeClasses.classHover,
    //      'selected' : nodeClasses.classSelected,
    //      'pop' : nodeClasses.classPop
    //  };
    //  return classMap[nodeState] ? classMap[nodeState] : nodeClasses.classDefault;
    // }

    //
    // D3 renderers
    // canvas is a svg elem
    // d3 specific renderers have different create and render funcs since structure creation and rendering it are
    // different process in d3
    //

    function d3NodeHighlightCreate (node, canvas, settings) {
        var sel = canvas.append('svg');
        var n = node;
        var prefix = settings('prefix'),
            showImage = settings("nodeImageShow"),
            imageAttr = settings("nodeImageAttr");
        console.assert(prefix.length > 6, 'prefix must be correct');

        var clipId = _.uniqueId('clip_');

        if(enablePieRendering && n.isAggregation) {
            sel = sel.append('g');
            // node base
            sel.append('circle').classed('node-main', true);
            sel.append('g').classed('node-aggr-donut', true); // path group
            sel.append('text');
            //border
            sel.append('circle')
            .classed('node-border', true);

        } else {
            // main circle
            sel.append('circle').classed('node-main', true);

            if (node.inHover || node.isSelected) {
                // node image filter
                if (showImage && node.attr[imageAttr] && node.attr[imageAttr].length > 5) {
                    sel.append("svg:clipPath")
                        .attr('id', clipId)
                        .append('circle');
                    // image
                    sel.append('svg:image').classed('node-img', true)
                        .attr('clip-path', 'url(#' + clipId + ')');
                }
                // hover border
                sel.append('circle').classed('node-hover-border', true);
            }

            //border
            sel.append('circle').classed('node-border', true);
        }
    }
    function d3NodeHighlightRender (node, canvas, settings, borderType) {
        if (borderType == null) borderType = 'hover';
        var svg = canvas.select('svg');
        var n = node;
        var prefix = settings('prefix'),
            showImage = settings("nodeImageShow"),
            imageAttr = settings("nodeImageAttr");
        var size = nodeSize(n, settings, prefix),
            borderRadius = size + borderRadiusOffset(n, settings),
            strokeWidth = borderStrokeWidth(n, settings, borderType),
            border = borderRadius + strokeWidth,
            hoverBorderRadius = size + hoverBorderRadiusOffset(n, settings),
            hoverStrokeWidth = hoverBorderStrokeWidth(n, settings),
            hoverBorder = hoverBorderRadius + hoverStrokeWidth;
        var sz = Math.max(border, hoverBorder);
        var isDark = settings('theme') == 'dark';

        canvas
            .style('top', function(n) { return toPx(nodeY(n, prefix) - sz); })
            .style('left', function(n){ return toPx(nodeX(n, prefix) - sz); });

        var classMap = {};
        classMap[nodeClasses.classDefault] = true;
        classMap[nodeClasses.classSelected] = node.isSelected || borderType == 'select';
        classMap[nodeClasses.classSelectedNeighbour] = !node.isSelected && node.isSelectedNeighbour;
        classMap[nodeClasses.classHover] = node.inHover && borderType != 'select';

        canvas.classed(classMap);

        if(enablePieRendering && n.isAggregation) {
            renderAggregate(svg, n, settings);
        } else {
            svg.
                attr('width', 2 * sz)
                .attr('height', 2 * sz)
                .style('float', 'left');

            svg.select('.node-main')
                .attr("cx", sz)
                .attr("cy", sz)
                .attr("r", size)
                .style('stroke-width',  strokeWidth + 'px')
                //.style('stroke-width', '1px')
                .style("fill", n.colorStr);

            if(showImage && node.attr[imageAttr] && node.attr[imageAttr].length > 5) {
                // update clip path
                svg.select('clipPath').select('circle')
                    .attr("cx", sz)
                    .attr("cy", sz)
                    .attr("r", size)
                    .style("fill", n.colorStr);

                svg.select('.node-img')
                    .attr("xlink:href", node.attr[imageAttr])
                    .attr("width", 2 * sz)
                    .attr("height", 2 * sz)
                    .attr("x", 0)
                    .attr("y", 0);
            }

            // border stuff
            var nodeBorder = svg.select('.node-border')
                .attr("cx", sz)
                .attr("cy", sz)
                .attr("r", borderRadius)
                .style('fill', 'transparent')
                .style("stroke", function(n){ return darkenColor(n.color);});

                if (borderType == 'hover' || borderType == 'select') {
                    nodeBorder.style('stroke-width',  strokeWidth + 'px');
                }
            // hover border stuff
            
            if (borderType == "hover") {
                svg.select('.node-hover-border')
                    .attr("cx", sz)
                    .attr("cy", sz)
                    .attr("r", hoverBorderRadius)
                    .style('stroke-width',  hoverStrokeWidth + 'px')
                    .style('fill', 'transparent')
                    .style("stroke", function(n){ return isDark ? n.colorStr : darkenColor(n.color);});
            }
        }
    }

    // function d3NodeSelectedCreate(node, canvas, settings) {
    //     d3NodeHighlightCreate(node, canvas, settings);
    // }
    // function d3NodeSelectedRender(node, canvas, settings) {
    //     d3NodeHighlightRender(node, canvas, settings);
    // }

    // function d3NodePopCreate(node, canvas, settings) {
    //     d3NodeHighlightCreate(node, canvas, settings);
    // }
    // function d3NodePopRender(node, canvas, settings) {
    //     d3NodeHighlightRender(node, canvas, settings);
    // }

    ///
    /// Common funcs
    ///
    //render aggregate into the svg.
    function renderAggregate (svg, n, settings) {
        // All elements are rendered into a single group, for easy transformation
        var g = svg.select('g');
        var pie = d3.layout.pie()
            .sort(null);
        var prefix = settings('prefix');
        var size = nodeSize(n, settings, prefix),
            borderRadius = size + borderRadiusOffset(n, settings),
            strokeWidth = borderStrokeWidth(n, settings),
            border = borderRadius + strokeWidth;

        // Setup the svg element to the center of div
        svg
            .style('float', 'left')
            .attr('width', border * 2)
            .attr('height', border * 2);
        // move the group into the center of the svg
        g.attr("transform", function() {
            return "translate("  + border + "," + border + ")";
        });

        g.select('.node-border')
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", borderRadius)
            .style('stroke-width',  strokeWidth + 'px')
            .style('fill', 'transparent')
            .style("stroke", function(n){ return darkenColor(n.color);});

        /// Render the circle
        g.select('.node-main')
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", size)
            .style("fill", aggBackgroundColor(n))
            .style('stroke-width', '0px');

        g.select('text').text(function(n) {
            if(n.aggregatedNodes && settings('aggNodeShowCount'))
                return '' + n.aggregatedNodes.length;
            else
                return;
        })
        .attr('x', 0)
        .attr('y', 0)
        .attr('dy', '0.35em')
        .attr('font-size', toPx(settings('aggFontSize')))
        .attr('text-anchor','middle');

        //donut styles
        function outerRadiusMultiplier() {
            var val = 0;
            switch (aggNodeRenderStyleMap(settings)) {
            case 0:
            case 1: //thin donut
                val = 1; break;
            case 2: //thick donut
                val = 1; break;
            case 3: //full donut
                val = 1; break;
            default:
                val = 1;break;
            }
            return val;
        }

        function innerRadiusMultiplier() {
            var val = 0;
            switch (aggNodeRenderStyleMap(settings)) {
            case 0:
            case 1: //thin donut
                val = 0.77;break;
            case 2: //thick donut
                val = 0.5;break;
            case 3: //full donut
                val = 0.01;break;
            default:
                val = 0.5;break;
            }
            return val;
        }

        function aggBackgroundColor(n){
            switch (aggNodeRenderStyleMap(settings)) {
            case 0:
            case 1:
            case 2:
                return settings('aggNodeBackgroundColor');
            case 3:
            default: return darkenColor(n.color);
            }
        }


        g.each(function(n) {
            var elem = d3.select(this);
            var ds = dataSet(n);
            var arc = d3.svg.arc()
                    .outerRadius(size * outerRadiusMultiplier())
                    .innerRadius(size * innerRadiusMultiplier());

            var s = elem.select('g').selectAll("path").data(pie(ds.wedges));
            s.enter()
                .append("path")
                .attr("fill", function(d, i) { return ds.colors[i];})
                .attr("d", arc);
            s.exit().remove();
        });
    }

    function aggNodeRenderStyleMap (settings) {
        var map2Int = {
            'thin-donut' : 1,
            'thick-donut': 2,
            'full-donut' : 3
        };
        var val = settings('aggNodeRenderStyle');
        return map2Int[val] ? map2Int[val] : 0;
    }

    function dataSet(node){
        var data = {wedges:[],colors:[]};
        if(node.aggregatedColorArray){
            for (var i = node.aggregatedColorArray.length - 1; i >= 0; i--) {
                data.wedges.push(100/node.aggregatedColorArray.length);
                data.colors.push(node.aggregatedColorArray[i]);
            }
        }
        return data;
    }

    function nodeY(node, prefix) {
        return node[prefix + 'y'];
    }
    function nodeX(node, prefix) {
        return node[prefix + 'x'];
    }
    //Scaling factor for nodeSize
    function nodeScale (node, settings) {
        var nodeSelectionRatio = settings('nodeSelectionRatio') || 1;
        var nodeHighlightRatio = settings('nodeHighlightRatio') || 1;
        var scale = 1;

        if(node.isSelected && node.inHover) {
            scale *= Math.max(nodeSelectionRatio, nodeHighlightRatio);
        } else if(node.inHover && settings('inHoverMode')) {
            scale *= nodeHighlightRatio;
        } else if(node.isSelected) {
            scale *= nodeSelectionRatio;
        }
        return scale;
    }
    function nodeSize (node, settings, prefix) {
        var size = node[prefix + 'size'];
        //console.log('size - ',node[prefix + 'size']);
        return size * nodeScale(node, settings);
    }

    // calc hover border radius offset
    function hoverBorderRadiusOffset (node, settings) {
        var offset = 0;
        if(node.inHover && settings('inHoverMode'))
            offset = +settings('nodeHighlightBorderOffset');
        return offset;
    }
    function hoverBorderStrokeWidth (node, settings) {
        var width = 0;
        if(node.inHover && settings('inHoverMode')) {
            width = +settings('nodeHighlightBorderWidth');
        }
        return width;
    }

    // calc border radius offset
    function borderRadiusOffset (node, settings) {
        var offset = 0;
        if(node.isSelected)
            offset = +settings('nodeSelectionBorderOffset');
        return offset;
    }
    function borderStrokeWidth (node, settings, borderType) {
        var width = 1;
        if(node.isSelected || borderType == 'select')
            width = +settings('nodeSelectionBorderWidth');
        return width;
    }


}
]);