(function() {
    'use strict';

    sigma.utils.pkg('mappr');

    mappr.stats = mappr.stats || {};
    mappr.stats.distr = mappr.stats.distr || {};

    (function() {

        //Don't change. Make a copy, change and pass around
        // var defaults = {
        //     barHt: 10,
        //     markerHt: 14,
        //     markerHalfWd: 7,
        //     marginX: 5,
        //     marginBtm: 0,
        //     multiDistrHt: 16,
        //     singleDistrHt: 30,
        //     barColor: "#bbb",
        //     multibarColor: "#ddd",
        //     binColor: "#222",       // color of bins in full dataset value distribution
        //     hiliteColor: "#666",
        //     textColor: "#000",
        //     lineColor: "#ddd",
        //     popupDelay: 500
        // };

        //changed because overall style of things changed
        var defaults = {
            barHt: 30,
            multiBarHt: 15,
            markerHt: 14,
            //markerHalfWd: 7,
            markerHalfWd: 1.5,
            marginX: 7,
            marginBtm: 0,
            multiDistrHt: 30,
            singleDistrHt: 30,
            barColor: "#bbb",
            multibarColor: "#ddd",
            binColor: "#4F4F4F", // color of bins in full dataset value distribution
            // binColor: "#222",       // color of bins in full dataset value distribution
            hiliteColor: "#666",
            textColor: "#000",
            lineColor: "#fff",
            popupDelay: 500
        };

        /*
         * Utility functions
         */

        function offsetX(e) {
            var e = e || window.event;
            return e.offsetX || e.layerX;
        }

        function offsetY(e) {
            var e = e || window.event;
            return e.offsetY || e.layerY;
        }

        function offsetXY(e) {
            var e = e || window.event;
            return {
                offsetX: e.offsetX || e.layerX,
                offsetY: e.offsetY || e.layerY
            };
        }

        // trigger an event in a Snap object
        //
        function triggerEvent(obj, eventName, ev) {
            //            console.log('Trigger ' + eventName);
            for (var i = 0, len = obj.events.length; i < len; i++) {
                if (obj.events[i].name == eventName) {
                    obj.events[i].f.call(obj, ev);
                }
            }
        }

        /*
         *  shared drawing functions
         */

        function drawMarker(canvas, barWd, markerX, opts) {
            //            var colorFromString = function(str) {
            //                var rgb = d3.rgb(str);
            //                return[rgb.r, rgb.g, rgb.b];
            //            };

            //           var markerBtm = opts.distrHt - opts.barHt - opts.marginBtm;
            //            var marker = canvas.path("M" + markerX + "," + markerBtm
            //                                  + "L" + (markerX - opts.markerHalfWd) + "," + (markerBtm - opts.markerHt)
            //                                  + "L" + (markerX + opts.markerHalfWd) + "," + (markerBtm - opts.markerHt)
            //                                  + "Z");
            //            marker.attr({
            //                fill: opts.nodeColorStr,
            //                stroke: mappr.utils.darkenColor(colorFromString(opts.nodeColorStr))
            //            });
            var markerBtm = opts.distrHt - opts.barHt - opts.marginBtm;

            var marker = canvas.rect(markerX - opts.markerHalfWd, markerBtm, 2 * opts.markerHalfWd, opts.barHt);
            marker.attr({
                fill: opts.nodeColorStr,
                stroke: opts.nodeColorStr
            });
            return marker;
        }

        function setupMarkerEvents(marker, attr, opts) {
            // set up marker event handlers
            var debHover = opts.callbacks.hover;
            var throttledIn = _.throttle(inHandler, 50);

            marker.hover(throttledIn, outHandler).mousemove(throttledIn).click(markerClickHandler);

            function inHandler(ev) { // in/move handler
                debHover(attr.id, attr.value, $.Event(ev));
            }

            function outHandler() { // out handler
                opts.callbacks.unhover();
            }

            function markerClickHandler(ev) {
                opts.callbacks.select(attr.id, attr.value, $.Event(ev));
                ev.stopPropagation();
            }
        }
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.offsetXY = offsetXY;
        this.defaults = defaults;
        this.triggerEvent = triggerEvent;
        this.drawMarker = drawMarker;
        this.setupMarkerEvents = setupMarkerEvents;
    }).call(mappr.stats.distr);
})();
