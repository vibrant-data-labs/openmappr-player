(function() {
    'use strict';

    sigma.utils.pkg('mappr');

    mappr.stats = mappr.stats || {};
    mappr.stats.utils = {};

    (function() {

        // get random number, end points are inclusive
        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        // get count random numbers in range [0, from)
        function getRandomArray(count, from) {
            var array = [];
            for (var i = 0; i < count; i++) {
                array[i] = getRandomInt(0, from - 1);
            }
            return array;
        }

        // uses modified (partial) Fisher–Yates shuffle
        // to get count random numbers in range [0, from)
        // without replacement
        function getRandomArrayNoReplace(count, from) {
            var i, result = [];
            if (count < from) {
                var end = from - 1,
                    array = [];
                // initialize array with all possible values
                for (i = 0; i < from; i++) {
                    array[i] = i;
                }
                for (i = 0; i < count; i++) {
                    var idx = getRandomInt(i, end);
                    // get next value
                    result[i] = array[idx];
                    // swap value to end and decrement end so it is never picked again
                    var temp = array[idx];
                    array[idx] = array[end];
                    array[end] = temp;
                    end--;
                }
            } else { // count too big - just return every number in [0, count)
                for (i = 0; i < count; i++) {
                    result[i] = i;
                }
            }
            return result;
        }

        this.getRandomArray = getRandomArray;
        this.getRandomArrayNoReplace = getRandomArrayNoReplace;
    }).call(mappr.stats.utils);
})();
