const fs = require('fs'),
        path = require('path'),
        AWS = require('aws-sdk'),
        { argv } = require('yargs'),
        digitalOceanConfig = require('./config/digitalOcean');

const spacesEndpoint = new AWS.Endpoint(digitalOceanConfig.spacesEndpoint);
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: digitalOceanConfig.accessKeyId,
    secretAccessKey: digitalOceanConfig.secretAccessKey,
});

const rootDirectory = argv.rootDirectory;
const bucket = argv.bucket;
const acl = argv.acl;
const staticFilesOnly = argv.staticFilesOnly;
const dataOnly = argv.dataOnly;

var filesCollection = [];
const directoriesToSkip = [];

if (staticFilesOnly) {
    directoriesToSkip.push('data');
}

if (dataOnly) {
    directoriesToSkip.push('css');
}

function readDirectorySynchronously(directory) {
    var currentDirectorypath = directory;
    var currentDirectory = fs.readdirSync(currentDirectorypath, 'utf8');

    currentDirectory.forEach(file => {
        var fileShouldBeSkipped = directoriesToSkip.indexOf(file) > -1;
        var pathOfCurrentItem = path.join(directory + '/' + file);
        if (!fileShouldBeSkipped && fs.statSync(pathOfCurrentItem).isFile()) {
            filesCollection.push(pathOfCurrentItem);
        }
        else if (!fileShouldBeSkipped) {
            var directorypath = path.join(directory + '/' + file);
            readDirectorySynchronously(directorypath);
        }
    });
}

const rootFolder = __dirname.split(path.sep);
rootFolder.pop();
readDirectorySynchronously(path.join(...rootFolder, 'publish'));

console.log(`Found ${filesCollection.length} files`);

let processedFiles = 0;
// for(let i = 0; i < filesCollection.length; i++) {
//     var fileKey = filesCollection[i].split(path.sep).reverse();
//     var lastItem = fileKey.pop();
//     while (lastItem !== 'publish') {
//         lastItem = fileKey.pop();
//     }

//     fileKey = path.join(...fileKey.reverse());
//     fileKey = fileKey.replace(path.sep, '/');
//     s3.putObject({
//         bucket: bucket,
//         key: rootDirectory ? (rootDirectory + '/' + fileKey) : fileKey,
//         Body: fs.readFileSync(filesCollection[i]),
//         ACL: acl || 'private',
//     }, function (err, data) {
//         processedFiles++;
//         if (err) console.log(err, err.stack);
//         else console.log(data);

//         if (processedFiles === filesCollection.length) {
//             process.exit(0);
//         }
//     });
// }