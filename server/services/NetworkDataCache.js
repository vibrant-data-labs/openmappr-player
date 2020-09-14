'use strict';
var fs  = require('fs'),
    zlib    = require('zlib'),
    path    = require('path'),
    streamifier      = require("streamifier"),
    generateShortUID6 = require('../services/UIDUtils').generateShortUID6,
    Promise = require("bluebird");

var config = require("./AppConfig").get();

// a cache from Id -> networkData (filepath for now)
var networkDataCache = {};
var tempDirectory = config.file_system.temp_dir;

function deleteFolderRecursive(path) {
    if(fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index) {
            var curPath = path + "/" + file;

            if(fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            }
            else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

deleteFolderRecursive(tempDirectory);
deleteFolderRecursive("./final_players");
fs.mkdir(tempDirectory);

process.on('exit', function(code) { // remove files on server shutdown
    deleteFolderRecursive(tempDirectory);
});

function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (directoryExists(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

function directoryExists(path) {
    try {
        return fs.statSync(path).isDirectory();
    } catch (err) {
        return false;
    }
}

module.exports = {
    ensureDirectoryExistence : ensureDirectoryExistence,
    genTempFilePath : function(prefix, suffix) { return tempDirectory + `${prefix}${generateShortUID6()}${suffix}`; },
    isKeyValid: function(key){
        return !!networkDataCache[key];
    },
    /**
     * Caches networkData and returns the key
     * @param  {[type]} networkData [description]
     * @return {[String]}            [The id which can be used to get the data]
     */
    cacheNetworkData : function(networkData) {
        console.log("[NetworkDataCache] Started Caching of network data");
        var key = Math.round(Math.random()*Date.now());
        var filePath = tempDirectory + 'parsed-' + key + 'data.json';

        networkDataCache[key] = filePath;

        return new Promise(function(resolve, reject) {
            fs.writeFile(filePath, JSON.stringify(networkData), function(writeErr) {
                if(writeErr){
                    reject(writeErr);
                }
                else {
                    console.log("[NetworkDataCache] Finished Caching of network data");
                    resolve(key);
                }
            });
        });
    },
    getNetworkDataFromCache : function(key) {
        return Promise.fromNode(function(cb) {
            fs.readFile(networkDataCache[key], cb);
        }).then(function(data) { return JSON.parse(data); });
    },
    removeDataFromCache: function(key){
        if(networkDataCache[key])
            delete networkDataCache[key];
    },

    writeFileAsync: function(path, content, shouldGZip) {
        if(shouldGZip) {
            var gzip = zlib.createGzip();
            var wrStream = fs.createWriteStream(path);

            return new Promise(function(resolve, reject) {
                streamifier
                    .createReadStream(content)
                    .pipe(gzip)
                    .pipe(wrStream)
                    .on('finish', function() {
                        resolve();
                    })
                    .on('error', function(err) {
                        reject(err);
                    });
            });

        }
        else {
            return Promise.fromNode(function(cb) {fs.writeFile(path, content, cb); });
        }
    },
    deleteFolderRecursive : deleteFolderRecursive
};
