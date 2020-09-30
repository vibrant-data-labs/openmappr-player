const fs = require('fs'),
    path = require('path'),
    AWS = require('aws-sdk'),
    digitalOceanConfig = require('./config/digitalOcean'),
    glob = require('glob'),
    cliProgress = require('cli-progress'),
    inquirer = require('inquirer');

const spacesEndpoint = new AWS.Endpoint(digitalOceanConfig.spacesEndpoint);
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: digitalOceanConfig.accessKeyId,
    secretAccessKey: digitalOceanConfig.secretAccessKey,
});

const getDirectories = async function (src) {
    return new Promise((resolve, reject) => glob(src + '/**/*', function (err, res) { resolve(res); }));
};

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

async function readFilesAndUpload() {
    const res = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Enter the relative path to directory you want to publish',
        },
        {
            type: 'input',
            name: 'bucket',
            message: 'Enter the name of the bucket',
          },
      ]);

    const files = await getDirectories(res.path);
    bar1.start(files.length, 0);
    let i = 0;
    for (let item of files) {
        i++;
        bar1.update(i);
        if (!fs.lstatSync(item).isFile()) continue;

        var params = {
            Body: fs.readFileSync(item),
            Bucket: res.bucket,
            Key: item.replace(/^publish\//, ''),
        };
        await new Promise((resolve, reject) => s3.putObject(params, function(err, data) {
            if (err) reject(err);
            else  resolve(data);
        })).catch(console.error);
    }
    bar1.stop();
};


readFilesAndUpload().then(() => {
    console.log('All files were published');
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});