(function() {
	'use strict';

	var lodash = _;

	function deepOmit (obj, keys) {
		if(_.isArray(obj)) {
			return _.map(obj, function(item) { return deepOmit(item, keys); });
		} else if(_.isObject(obj)) {
			return _.omit(_.mapValues(obj, function(val) {
				return _.isObject(val) ? deepOmit(val, keys) : val;
			}), keys);
		} else {
			return obj;
		}
	}

	// Add only new Methods
	var newFuncs = {
		pushUnique: function(arr, val) {
			if(!_.isArray(arr)) throw new Error('Array expected');
			if(val) {
				if(arr.indexOf(val) === -1) {
					arr.push(val);
				}
			}
			return arr;
		},

		pluckMultiple: function(collection, propList) {
			if(!_.isArray(collection)) throw new Error('Array expected for collection');
			if(!_.isArray(propList)) throw new Error('Array expected for properties');
			return _.map(collection, _.partialRight(_.pick, propList));
		}, 

		deepOmit : deepOmit
	};

	// Add methods that don't pre-exist
	var origLodashFuncNames = Object.keys(_);
	var newLodashFuncNames = _.filter(Object.keys(newFuncs), function(funcName) {
		return origLodashFuncNames.indexOf(funcName) === -1;
	});

	_.each(newLodashFuncNames, function(funcName) {
		lodash[funcName] = newFuncs[funcName];
	});
}());