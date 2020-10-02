const fs = require('fs'),
    path = require('path'),
    AWS = require('aws-sdk'),
    s3Config = require('./config/s3Config'),
    glob = require('glob'),
    cliProgress = require('cli-progress'),
    inquirer = require('inquirer'),
    mime = require('mime-types'),
    { argv } = require('yargs');

const dataOnly = argv.dataOnly;
const staticFilesOnly = argv.staticFilesOnly;

const s3 = new AWS.S3({
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
});

const getDirectories = async function (src, ignore) {
    return new Promise((resolve, reject) => glob(src + '/**/*', { ignore: ignore }, function (err, res) { resolve(res); }));
};

const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

async function readFilesAndUpload() {
    const buckets = await s3.listBuckets().promise();
    const res = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'useExisting',
            message: 'Do you want to use existing bucket?',
        },
        {
            type: 'input',
            name: 'newBucket',
            message: 'Enter the bucket name',
            when: function (answers) {
                return !answers.useExisting;
            }
        },
        {
            type: 'list',
            name: 'bucket',
            message: 'Select the bucket',
            choices: buckets.Buckets.map(r => ({ name: r.Name, value: r.Name })),
            when: function (answers) {
                return !!answers.useExisting;
            }
        },
    ]);

    let bucketName = '';
    if (res.useExisting) {
        bucketName = res.bucket;
        await s3.putBucketAcl({ Bucket: bucketName, ACL: 'public-read' }).promise();
    } else {
        await s3.createBucket({ Bucket: res.newBucket, ACL: 'public-read' }).promise();
        bucketName = res.newBucket;
    }

    await s3.putBucketWebsite({
        Bucket: bucketName,
        WebsiteConfiguration: {
            ErrorDocument: {
                Key: 'index.html'
            },
            IndexDocument: {
                Suffix: 'index.html',
            },
        }
    }).promise();

    let path = 'publish';
    let excludedFiles = [];
    if (dataOnly) {
        path = 'publish/data';
    } else if (staticFilesOnly) {
        excludedFiles = [
            'publish/data/**/*'
        ]
    }

    const files = await getDirectories(path, excludedFiles);
    bar1.start(files.length, 0);
    let i = 0;
    for (let i = 0; i < files.length; i += 5) {
        bar1.update(i);
        let items = files.slice(i, i + 5);
        await Promise.all(
            items.map(item => {
                if (!fs.lstatSync(item).isFile()) return Promise.resolve();

                var params = {
                    Body: fs.readFileSync(item),
                    Bucket: bucketName,
                    ContentType: mime.lookup(item),
                    Key: item.replace(/^publish\//, ''),
                    ACL: 'public-read'
                };
                return new Promise((resolve, reject) => s3.putObject(params, function (err, data) {
                    if (err) reject(err);
                    else resolve(data);
                })).catch(console.error);
            })
        );
    }
    bar1.update(files.length);
    bar1.stop();

    console.log('Site is served on ' + `http://${bucketName}.s3-website-${s3.config.region || 'us-east-1'}.amazonaws.com/`)
};

readFilesAndUpload().then(() => {
    console.log('All files have been published');
    process.exit(0);
}).catch(error => {
    console.error(error);
    process.exit(1);
});