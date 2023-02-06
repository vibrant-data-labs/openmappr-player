const fs = require('fs'),
    path = require('path'),
    AWS = require('aws-sdk'),
    glob = require('glob'),
    cliProgress = require('cli-progress'),
    mime = require('mime-types'),
    { argv } = require('yargs'),
    _ = require('lodash');

require('dotenv').config();
const purgeCache = require('./purgeCache');

const bucketName = process.env.BUCKET;
/**
 * @type {'player' | 'project' | 'all'}
 */
const deployMode = argv.deployMode || 'player';

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
});

const configureBucket = async (bucket, isNewBucket) => {
    const awsBucketParams = { Bucket: bucket, ACL: 'public-read' };
    if (isNewBucket) {
        await s3.createBucket(awsBucketParams).promise();
    } else {
        await s3.putBucketAcl(awsBucketParams).promise();
    }

    await s3.putBucketWebsite({
        Bucket: bucket,
        WebsiteConfiguration: {
            ErrorDocument: {
                Key: 'index.html'
            },
            IndexDocument: {
                Suffix: 'index.html',
            },
        }
    }).promise();

    await s3.putBucketCors({
        Bucket: bucket,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedMethods: ["GET", "POST"],
                    AllowedOrigins: ["*"],
                    AllowedHeaders: ["*"]
                }
            ]
        }
    }).promise();
}

const getFiles = async (paths) => {
    const fileResult = await Promise.all(
        paths.map(async (p) => {
            return new Promise((resolve, reject) => glob(`build/${p}`, function (err, res) { resolve(res); }));
        })
    )

    return _.flatten(fileResult);
}


const getPublishFiles = () => {
    return {
        player: [
            'css/**/*',
            'fonts/**/*',
            'img/**/*',
            'js/**/*',
            'partials/**/*',
            'index.html',
        ],
        project: [
            'data/**/*',
            'index.html'
        ],
        all: [
            'css/**/*',
            'data/**/*',
            'fonts/**/*',
            'img/**/*',
            'js/**/*',
            'partials/**/*',
            'index.html',
        ]
    }[deployMode] || [];
}

const readFilesAndUpload = async () => {
    const buckets = await s3.listBuckets().promise();
    const isNewBucket = !buckets.Buckets.find(x => x.Name === bucketName);

    await configureBucket(bucketName, isNewBucket);

    const paths = getPublishFiles();
    const files = await getFiles(paths);

    const perChunk = 50;
    const chunks = files.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / perChunk)

        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = [] // start a new chunk
        }

        resultArray[chunkIndex].push(item)

        return resultArray
    }, []);

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(files.length, 0);

    const uploadPromises = chunks.reduce((acc, chunk, idx) => {
        const uploadTask = Promise.all(
            chunk.map(item => {
                if (!fs.lstatSync(item).isFile()) return Promise.resolve();

                const params = {
                    Body: fs.readFileSync(item),
                    Bucket: bucketName,
                    ContentType: mime.lookup(item),
                    Key: item.replace(/^build\//, ''),
                    ACL: 'public-read'
                };
                return new Promise((resolve, reject) => s3.putObject(params, function (err, data) {
                    if (err) reject(err);
                    else resolve(data);
                })).catch(console.error);
            })
        );

        return acc.then(() => {
            progressBar.update(idx * perChunk);
            return uploadTask;
        }).then(uploadTask);
    }, Promise.resolve());

    await uploadPromises;
    progressBar.update(files.length);
    progressBar.stop();

    console.log('Site is served on ' + `http://${bucketName}.s3-website-${s3.config.region || 'us-east-1'}.amazonaws.com/`);

    return bucketName;
};

readFilesAndUpload()
    .then(bn => purgeCache(bn))
    .then(() => {
        console.log('All files have been published');
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });