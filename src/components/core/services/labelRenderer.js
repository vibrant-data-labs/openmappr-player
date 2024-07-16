angular.module('common')
.service('labelRenderer', ['$q', 'renderGraphfactory', 'hoverService',
function($q, renderGraphfactory, hoverService) {

    "use strict";
    var _service = this;
    //
    // Collection of label renderers for each node state. each renderer takes
    // 1) node
    // 2) d3 elem
    // 3) settings
    //
    var classes = {
        baseCssClass :'node-label', // the css class to apply for node labels
        cssHoverClass :'node-label-hover', // the css class to apply for node labels in hover
        cssHoverHideClass :'node-label-hover-hide', // the css class to apply for labels NOT in hover
        cssSelClass : 'node-label-sel', // the css class to apply for labels in selection
        cssSelNeighbourClass : 'node-label-sel-neigh', // the css class to apply for labels in selection
        cssGroupClass : 'group-label', // the css class to apply for group labels
        cssDarkThemeClass : 'dark-group-label'
    };

    /*************************************
    *************** API ******************
    **************************************/
    this.isGroupLabelHover = false;
    this.d3NodeLabelDefRender = d3NodeLabelDefRender;
    this.labelSizeFuncFactory = labelSizeFuncFactory;
    this.getLabel = getLabel;
    this.classes = classes;
    this.labelX = labelX;
    this.labelY = labelY;
    this.labelSizeFn = labelSizeFn;



    /*************************************
    ********* Local Data *****************
    **************************************/


    var hoverTimer;
    var hoverData;

    ///
    /// Common funcs
    ///
    var toPx = window.mappr.utils.toPx;
        // nodeId = window.mappr.utils.nodeId,
        // isSpecial = window.mappr.utils.isSpecial,
        // invert = window.mappr.utils.invert,
        // multi = window.mappr.utils.multi,
        // add = window.mappr.utils.add,
        // plucker = window.mappr.utils.plucker,
        // darkenColor = window.mappr.utils.darkenColor,
        // lightenColor = window.mappr.utils.lightenColor;





    /*************************************
    ********* Core Functions *************
    **************************************/
    function getLabel(node, settings) {
        var shorten = function(text, maxLength) {
            var ret = text;
            if (ret && ret.length > maxLength) {
                ret = ret.substr(0,maxLength-3) + "...";
            }
            return ret;
        };

        var labelAttr = settings('labelAttr') || 'OriginalLabel'; // the default label
        var txt;
        if(node.isGroup) {
            txt = node.title;
        } else {
            txt = node.attr[labelAttr] ? node.attr[labelAttr] : "";
        }
        return (node.isGroup && !(node.inHover || node.inHoverNeighbor))? shorten(txt, settings('labelMaxLength') || 35) : txt;
    }

    function labelSizeFuncFactory (prefix, settings) {
        function popFn(node) {
            return (node.inPop && !node.inPop.neighbor) ? 2 : 1;
        }
        var func = _.noop;
        if(settings('labelSize') === 'fixed') {
            var val = Math.max(settings('minLabelSize'), settings('defaultLabelSize'));
            func = function fixedLabel (node) {
                var pop = popFn(node);
                return pop * val;
            };
        }
        else if(settings('labelSize') === 'proportional') {
            func = function propLabel (node) {
                var pop = popFn(node);
                return pop * Math.min(settings('maxLabelSize'), Math.max(settings('minLabelSize'), settings('labelSizeRatio') * node[prefix + 'size']));
            };
        } else {
            func = function propLabel (node) {
                var pop = popFn(node);
                return pop * Math.min(settings('maxLabelSize'), Math.max(settings('minLabelSize'), settings('labelSizeRatio') * node.baseSize));
            };
        }
        return func;
    }

    // label event handlers
    //

    function _clearTimer() {
        if(hoverTimer !== undefined) {
            clearTimeout(hoverTimer);
            hoverTimer = undefined;
        }
    }

    function labelClick(d) {
        _clearTimer();
        d.isSelected = true;
        hoverService.unhover();
        renderGraphfactory.sig().dispatchEvent('clickNodes', {node: d.nodes, labelId: d.id, degree: 0, all: true, genBy:'labelClick'});
    }

    function labelHover(d) {
        var hoverFn = function() {
            _service.isGroupLabelHover = true;
            hoverService.hoverNodes({ attr: renderGraphfactory.getRenderer().settings('nodeClusterAttr'), value: d.id });
            hoverTimer = undefined;
        };
        _clearTimer();
        hoverData = d;
        hoverTimer = setTimeout(hoverFn, 300);
    }

    function labelUnHover(d) {
        _clearTimer();
        _service.isGroupLabelHover = false;
        // if(!d.isSelected) {
        //     hoverService.unhover();
        // }
        renderGraphfactory.sig().dispatchEvent('outNodes', {nodes: d.nodes});
    }

    //
    // D3 renderers
    // canvas is a svg elem
    // d3 specific renderers have different create and render funcs since structure creation and rendering it are
    // different process in d3
    //
    // function d3NodeDefCreate (node, canvas, settings) {
    //  // body...
    // }
    function d3NodeLabelDefRender (node, canvas, settings) {
        var prefix = settings('prefix');
        var inSelMode = settings('inSelMode');

        //HACK To set group-label css - when the label-outline-color is black, .dark class to group-label.
        //Better way is to associate group label styling with 'theme'.
        var labelOutlineColor = settings('labelOutlineColor');

        var toShow = true;
        var labelSizeFunc = labelSizeFuncFactory(prefix, settings);
            // labelAttr =     settings('labelAttr') || 'OriginalLabel'; // the default label
            // sellabelAttr =  settings('labelClickAttr') || labelAttr; // which label attr to use for selections.
        var fontSize = labelSizeFunc(node);

        if(inSelMode) {
            toShow = (!!node.isSelected || !!node.isSelectedNeighbour) && !node.isGroup;
        }

        var selD3 = canvas.attr('data-node-id', node.id).select('p');
        // set the label text
        selD3.text(function(node) {
            if(node.isAggregation) { return null; }
            else { return getLabel(node, settings); }
        });
        // set label size as needed
        //if( !node.isGroup && (node.inHover || node.inHoverNeighbor) ) {   // include +2 to "pop" label on hover
        //  fontSize = Math.min(Math.max(settings('minLabelSize')/*+2*/,fontSize),settings('maxLabelSize'));
        //}
        var newSizeStyle = toPx(fontSize);
        var oldSizeStyle = selD3[0][0].style['font-size'];
        if( oldSizeStyle.length > 0 ) { // already has size style
            if( oldSizeStyle != newSizeStyle ) {
                //selD3.transition().duration(200)
                selD3.style('font-size', newSizeStyle);
            }
        } else {
            selD3.style('font-size', newSizeStyle);
        }
        var x = labelX(canvas, node, settings),
            y = labelY(canvas, node, settings);
            // size = node[prefix + 'size'];

        canvas.style('top', toPx(Math.floor(y)))
            .style('left', toPx(Math.floor(x)))
            // Set the classes.
            .classed(classes.cssHoverClass, false)
            .classed(classes.cssHoverHideClass, !toShow) // hide labels in Sel mode
            .classed(classes.cssSelClass, node.isSelected && !node.isGroup)
            .classed(classes.cssSelNeighbourClass, node.isSelectedNeighbour && !node.isSelected)
            .classed(classes.cssDarkThemeClass, (labelOutlineColor=='#000000')) //HACK - see above 112
            .style('color', function() {
                return node.isGroup ? node.clusterColorStr : undefined;
            });

        // set event handlers on visible group labels
        if(node.isGroup) {
            canvas.on("click", toShow ? labelClick : null)
                .on("mouseover", toShow ? labelHover : null)
                .on("mouseout", toShow ? labelUnHover : null);
            selD3.style({'pointer-events' : (toShow ? 'auto' : 'none')});
            canvas.style({'pointer-events' : (toShow ? 'auto' : 'none')});
        }
    }

    // Get the final canvas positions
    function labelX(elem, node, settings) {
        var prefix = settings('prefix') || '';
        var size = node[prefix + 'size']/2;
        var x = Math.floor(node[prefix + 'x'] + size);
        if(node.inPop ) {
            if( !node.inPop.neighbor) {
                x += settings('nodePopSize')/10*75 + size;
            } else if(node.inPop.left) {    // shift label of popped neighbor to left
                var len;
                if( elem ) {
                    len = elem.node().getBoundingClientRect().width;
                } else {
                    var labelSizeFunc = labelSizeFuncFactory(prefix, settings);
                    len = labelSizeFn(getLabel(node, settings), labelSizeFunc(node)).wd;
                }
                x -= size + len;
            }
        } else if(node.inHover) {
            x += size;
        }
        return x;
    }

    function labelY(elem, node, settings) {
        var prefix = settings('prefix') || '';
        return Math.floor(node[prefix + 'y'] - node[prefix + 'size'] * ((!node.isGroup && !node.inPop && node.inHover) ? 1.5 : 0.5));
    }

    function labelSizeFn(txt, fontSize) {
        // var maxWd = 350;
        var wd = txt.length * fontSize*0.8;
        var ht = fontSize*1.2;
        if( wd > 236 ) {
            ht *= Math.ceil(wd/350);
            wd = 236;
        }
        return {wd: wd, ht:26};
    }


}
]);
