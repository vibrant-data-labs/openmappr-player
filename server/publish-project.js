'use strict';

const npm = require('npm');

function publishProject() {
    console.log('Running build:static...');
    npm.load(() => {
        npm.run('build:static', (err) => {
            console.log('AFTER SCRIPT 1');
            npm.run('publish-resources:player', (err) => {
                console.log('AFTER SCRIPT 2');
                process.exit(0);
            });
        });
        
    });
    
}

publishProject();