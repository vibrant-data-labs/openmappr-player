'use strict';
var Promise = require("bluebird"),
    NodeCache = require( "node-cache" );

///
/// Caching system for mappr
///

//Errors
//Thrown when the item does not exist in the cache
function ItemNotFound(message) {
    this.message = message;
    this.name = "ItemNotFound";
    Error.captureStackTrace(this, ItemNotFound);
}
ItemNotFound.prototype = Object.create(Error.prototype);
ItemNotFound.prototype.constructor = ItemNotFound;


// caches

var _masterCache = {};


//
// Simple cache system
function ItemCache(name) {
    this.name = name;
    this._cache = new NodeCache({stdTTL : 100, useClones : false});
    this.stats = {
        hits : 0, miss : 0
    };
}
ItemCache.prototype.insert = function(itemId, item) {
    if(!item) { return item; }
    var id = sanitizedId(itemId);
    this._cache.set(id, item);
    return item;
};
// returns a promise of the value. If not found, returns a Promise.reject
ItemCache.prototype.get = function(itemId) {
    var id = sanitizedId(itemId);
    var item = this._cache.get(id);
    if(item) {
        // console.log(`[CacheMaster.get][${this.name}] Cache Hit. Total hits!: `, ++this.stats.hits);
        return Promise.resolve(item);
    } else {
        // console.log(`[CacheMaster.get][${this.name}] Cache Miss. Total Miss!: `,++this.stats.miss);
        return Promise.reject(new ItemNotFound(`Item does not exist in cache: ${this.name}: CacheId: ${itemId}`));
    }
};
ItemCache.prototype.remove = function(itemId) {
    var id = sanitizedId(itemId);
    var item = this._cache[id];
    this._cache.del(id);
    return item;
};
function sanitizedId (id) {
    var _id = id;
    if("object" === typeof id)
        _id = id.toString();
    return _id;
}


function getCacheFor (cacheName) {
    var c = _masterCache[cacheName];
    if(c) return c;
    else {
        _masterCache[cacheName] = new ItemCache(cacheName);
        return _masterCache[cacheName];
    }
}

function getForOrgs () {
    return getCacheFor("orgs");
}

function getForUsers () {
    return getCacheFor("users");
}

function getForNetworks () {
    return getCacheFor("networks");
}

function getForDatasets () {
    return getCacheFor("datasets");
}

module.exports = {
    getCacheFor : getCacheFor,
    getForOrgs : getForOrgs,
    getForNetworks : getForNetworks,
    getForDatasets : getForDatasets,
    getForUsers : getForUsers,
    ItemNotFound : ItemNotFound
};
