'use strict';

const npm = require('npm'),
    https = require('https');

function getLastCommit() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/vibrant-data-labs/openmappr-player/branches/master',
            method: 'GET'
        }
    
        const req = https.request(options, res => {
            let rawData = '';
    
            res.on('data', d => {
                rawData += d;
            });
    
            res.on('end', () => {
                const data = JSON.parse(rawData);
                resolve(data.commit.commit.author.date);
            });
        })
    
        req.setHeader('User-Agent', 'javascript');
    
        req.on('error', error => {
            console.error(error);
            reject(error);
        })
    
        req.end();
    });
    
}

module.exports = getLastCommit;