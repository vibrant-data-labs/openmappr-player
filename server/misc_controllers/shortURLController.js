'use strict';

var _ = require("lodash");

var googl = require('goo.gl'), //https://www.npmjs.com/package/goo.gl
    AppConfig = require('../services/AppConfig');

var urlShortenerCfg = _.get(AppConfig.get(), 'urlShortener');

googl.setKey(urlShortenerCfg.ACCESS_KEY);

function getShortUrl(req, res){
    console.log('[shortUrlController] url to shorten:',req.body.longUrl);
    if(req.body.longUrl){
        googl.shorten(req.body.longUrl)
             .then(function(shortUrl) {
                 res.status(200).json({url: shortUrl, longUrl: req.body.longUrl});
             })
             .catch(function(err) {
                 console.log('[shortUrlController] err:', err);
                 res.status(500).send(err);
             });
    } else {
        res.status(500).send('longUrl not found in body');
    }
}

module.exports = {
    getShortUrl: getShortUrl
};
