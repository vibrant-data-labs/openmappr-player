(function() {
    'use strict';

    angular.module('common')
    .filter('anyInvalidDirtyFields', function() {

        return function(form) {
            for (var prop in form) {
                if (form.hasOwnProperty(prop)) {
                    if (form[prop].$invalid && form[prop].$dirty) {
                        return true;
                    }
                }
            }
            return false;
        };
    })
    //only works one level deep and if circular object, then problems
    .filter('neighboursFilter', function() {
        return function(input, term) {
            var regex = new RegExp(term || '', 'i');
            var obj = {};
            angular.forEach(input, function(v, i){
                var node = v.neighbourNode;
                var str = _.chain(node.attr).map(function(v) {
                    if(v.value) {
                        return v.value;
                    } else {
                        return false;
                    }
                }).value().toString() + " " + node.label;
                if(regex.test(str + '')){
                    obj[i]=v;
                }
            });
            return obj;
        };
    })
    //for binding unsafe html
    .filter('trustHtml', ['$sce', function($sce){
        return function(text) {
            return $sce.trustAsHtml(text);
        };
    }])
    .filter('trustUrl', ['$sce', function($sce){
        return function(url) {
            return $sce.trustAsResourceUrl(url);
        };
    }])
    .filter('toArray', function() {
        return function(obj) {
            if (!(obj instanceof Object)) return obj;
            return _.map(obj, function(val, key) {
                return Object.defineProperty(val, '$key', {
                    __proto__: null,
                    value: key
                });
            });
        };
    })
    .filter('reverse', function() {
        return function(items) {
            if(typeof items !== "undefined")
                return items.slice().reverse();
        };
    })
    .filter('space_to_underscore', function() {
        return function (input) {
            return input.replace(/ /g, '_');
        };
    })
    .filter('highlight_query', function() {
        return function(text, search_query) {
            // Used with ng-bind-html
            if(typeof text == 'number') { text += ''; }
            if (text && search_query) {
                text = text.replace(new RegExp('('+search_query+')', 'gi'), '<span class="highlight-text">$1</span>');
            }
            return text;
        };
    });

}());
