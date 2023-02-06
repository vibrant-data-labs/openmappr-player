(function() {
    'use strict';

    sigma.utils.pkg('mappr');

    /**
     *  Statistical test of significance
     */

    mappr.stats = mappr.stats || {};
    mappr.stats.sigtest = {};

    (function() {
        var defaultIter = 100;

        // randomization test of sample of numerical values
        // return true if sample is unlikely to have been drawn from the distribution
        // test by computing mean and variance of nIter (100) random draws from the full distribution
        // and comparing sample mean and variance to the mean and variance of these random draws.
        // Draws are done without replacement.
        // Returns true if mean or variance of sample is an outlier compared
        // to the mean or variance of the random draws.
        //
        // sample is an array of numbers
        // distr is an array of numbers
        // significance is < 1, typically 0.05
        function isSignificantNumeric(sample, distr, significance, nIter) {
            if (sample.length < distr.length) {
                var sampleMn, sampleVar;
                var sum, sumsq;
                nIter = nIter | defaultIter;
                sum = 0, sumsq = 0;
                for (var i = 0; i < sample.length; i++) {
                    var val = sample[i];
                    sum += val;
                    sumsq += val * val;
                }
                // compute sample mean and variance
                sampleMn = sum / sample.length;
                sampleVar = sumsq / sample.length - sampleMn * sampleMn;
                // compute mean and variance of nIter random draws and sort
                var means = [];
                var vars = [];
                for (var i = 0; i < nIter; i++) {
                    sum = 0, sumsq = 0;
                    var rndArray = mappr.stats.utils.getRandomArrayNoReplace(sample.length, distr.length);
                    for (var j = 0; j < rndArray.length; j++) {
                        var val = distr[rndArray[j]];
                        sum += val;
                        sumsq += val * val;
                    }
                    var mean = sum / sample.length;
                    var variance = sumsq / sample.length - mean * mean;
                    means.push(mean);
                    vars.push(variance);
                }
                means.sort(function(a, b) {
                    return a - b;
                });
                vars.sort(function(a, b) {
                    return a - b;
                });
                // find place of sample in sorted lists of random draws
                var meanIdx = _.sortedIndex(means, sampleMn);
                var varIdx = _.sortedIndex(vars, sampleVar);
                var loSig = significance * nIter / 2,
                    hiSig = (1 - significance / 2) * nIter;
                // sample is an outlier if either mean or variance is an outlier
                return meanIdx <= loSig || meanIdx >= hiSig || varIdx <= loSig || varIdx >= hiSig;
            } else {
                return false;
            }
        }

        // randomization test of sample of categorical values
        // return true if sample is unlikely to have been drawn from the distribution.
        // Test by computing log likelihood of 100 random draws from the full distribution
        // and comparing sample log likelihood to the log likelihood of these random draws.
        // Draws are done without replacement.
        // Returns true if sample is very likely or unlikely (higher/lower log likelihood than most of the draws)
        //
        // distr is {val: count}
        // sample is [val]
        // significance is < 1, typically 0.05
        function _likelihoodRatioRandomization(sample, distr, significance, nIter) {
            // function to compute log likelihood of a sample (array of values)
            var lnLike = function(s) {
                var result = 0;
                for (var i = 0; i < s.length; i++) {
                    result += lnp[s[i]];
                }
                return result;
            };

            var lnp = {};
            var nVal = 0;
            var distrVals = [];
            // use distribution to compute probability of each value
            // and accumulate values into an array
            _.each(distr, function(count, val) {
                var start = nVal;
                nVal += count;
                for (var i = start; i < nVal; i++) {
                    distrVals[i] = val;
                }
            });
            _.each(distr, function(count, val) {
                lnp[val] = Math.log(count / nVal);
            });
            // compute sample log likelihood
            var sampleLnL = lnLike(sample);
            // compute log likelihood of nIter draws from distr
            var lnLs = [];
            nIter = nIter | defaultIter;
            for (var i = 0; i < nIter; i++) {
                var draw = [];
                var rndArray = mappr.stats.utils.getRandomArrayNoReplace(sample.length, nVal);
                for (var j = 0; j < rndArray.length; j++) {
                    draw[j] = distrVals[rndArray[j]];
                }
                lnLs.push(lnLike(draw));
            }
            lnLs.sort(function(a, b) {
                return a - b;
            });
            // find place of sample in sorted list of random draws
            var idx = _.sortedIndex(lnLs, sampleLnL);
            // sample is an outlier if log-likelihood of drawing that sample is an outlier
            return idx <= nIter * significance / 2 || idx >= nIter * (1 - significance / 2);
        }

        // distr is {val: count}
        // sample is [val]
        // significance is < 1, typically 0.05
        function isSignificantCategorical(sample, nValues, distr, significance, nIter) {
            if (sample.length < nValues) {
                return _likelihoodRatioRandomization(sample, distr, significance, nIter);
            } else {
                return false;
            }
        }

        // randomization test of sample of tag (multiple string) values
        // distr is {tagval: count}
        // sample is [vals []]
        // significance is < 1, typically 0.05
        function isSignificantTag(sample, nValues, distr, significance, nIter) {
            if (sample.length < nValues) {
                var values = [];
                for (var i = 0; i < sample.length; i++) {
                    var vals = sample[i];
                    for (var j = 0; j < vals.length; j++) {
                        values.push(vals[j]);
                    }
                }
                return _likelihoodRatioRandomization(values, distr, significance, nIter);
            } else {
                return false;
            }
        }

        this.isSignificantNumeric = isSignificantNumeric;
        this.isSignificantCategorical = isSignificantCategorical;
        this.isSignificantTag = isSignificantTag;
    }).call(mappr.stats.sigtest);
})();
