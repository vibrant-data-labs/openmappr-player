'use strict';
// optionnal
// var extra = {
//     apiKey: 'YOUR_API_KEY', // for Mapquest, OpenCage, Google Premier
//     formatter: null         // 'gpx', 'string', ...
// };

var geocoderProvider = 'google';
var httpAdapter = 'http';
var geocoder = require('node-geocoder').getGeocoder(geocoderProvider, httpAdapter);
var geoScanner = null;

function GeoScanner () {
    var self = this;
    this.rateLimits = {
        maxLimit : 10,
        currentLimit : 10,
        interval : 1000
    };
    this.queries = [];
    this.intervalStartTime = 0;
    this.lastTimeout = null;

    this.execTasks = function execTask () {
        while(self.rateLimits.currentLimit > 0 || self.queries.length > 0) {
            var nextFn = self.queries.shift();
            self.rateLimits.currentLimit--;
            nextFn();
        }
    };

    this.enqueue = function enqueue (fn) {
        this.queries.push(fn);
        // if rate interval is over, reset
        if(Date.now() - this.intervalStartTime > this.rateLimits.interval) {
            this.intervalStartTime = Date.now();
            this.rateLimits.currentLimit = this.rateLimits.maxLimit;
        }
        if(this.rateLimits.currentLimit > 0) {
            this.execTasks();
        } else {
            setTimeout(function() {self.execTasks();},
                this.rateLimits.interval - (this.intervalStartTime % this.rateLimits.interval));
        }
    };
}
geoScanner = new GeoScanner();

function getScanner () {
    return geoScanner;
}

function findLatLong(location, callback){
    getScanner.enqueue(function() {
        geocoder.geocode(location, function (err, result) {
            if(err){
                callback(err);
            }
            else {
                callback(null, result);
            }
        });
    });
}

module.exports = {
    geoScanner : geoScanner,
    findLatLong: findLatLong
};
