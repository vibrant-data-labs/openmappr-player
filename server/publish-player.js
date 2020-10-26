'use strict';

const npm = require('npm'),
    https = require('https');

function getLastCommit() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/ericberlow/openmappr-player-static/branches/master',
            method: 'GET'
        }
    
        const req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`);
            let rawData = '';
    
            res.on('data', d => {
                rawData += d;
            });
    
            res.on('end', () => {
                const data = JSON.parse(rawData);
                console.log('data', data);
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

function publishPlayer() {
    console.log('Running build:data...');
    npm.load(() => {
        npm.run('build:data', (err) => {
            console.log('AFTER SCRIPT 1');
            npm.run('publish-resources:map', (err) => {
                console.log('AFTER SCRIPT 2');
                process.exit(0);
            });
        });
        
    });
    
}

//publishPlayer();

getLastCommit().then((lastCommitDate) => {
    console.log('Last commit date', lastCommitDate);
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});