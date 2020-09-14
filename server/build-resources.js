'use strict';

const _    = require('lodash'),
      Promise  = require("bluebird"),
      mongoose = require('mongoose'),
      fs       = require('fs'),
      DSModel        = require('./datasys/datasys_model'),
      projModel      = require("./project/proj_model"),
      dataUtils      = require("./utils/dataUtils"),
      AppConfig = require('./services/AppConfig'),
      express = require('express'),
      serverInit = require('./main_server'),
      http = require('http'),
      { execSync } = require('child_process'),
      { argv } = require('yargs');

const player_model = require('./player/player_model');

const projId = argv.projId;
const publishDataPath = argv.path;
const dataOnly = argv.dataOnly;
const staticFilesOnly = argv.staticFilesOnly;
console.log('args!!!!', argv);
let hasError = false;
if (!dataOnly && !publishDataPath) {
  console.error('Argument --path should be provided!');
  hasError = true;
}

if (!staticFilesOnly && !projId) {
  console.error('Argument --projId should be provided!');
  hasError = true;
}

if (!dataOnly && !staticFilesOnly && (!projId || !publishDataPath)) {
  console.error('Arguments --projId and --path should be provided!');
  hasError = true;
}

if (hasError) {
  process.exit(1);
}

if (dataOnly) {
  console.warn('--dataOnly is passed, generating data files only...');
}

if (staticFilesOnly) {
  console.warn('--staticFilesOnly is passed, generating static resources only...');
}

var config = AppConfig.init({
  get: function(key) {
    return process.env[key];
  }
});

if (!dataOnly || staticFilesOnly) {
  console.log('Running grunt...');
  if (process.env.NODE_ENV === 'local') {
    console.warn('Local environment detected, forcing...');
    execSync('grunt --force');
  } else {
    execSync('grunt');
  }
}

const outputPath = './client/build/dev/';
const dataPath = outputPath +'data/';

if (!fs.existsSync(dataPath)){
  fs.mkdirSync(dataPath);
}

mongoose.connect(config.dbUrl, function(error) {
  console.log('MONGO CONNECT ERR', error);
});

var playerSettings = null;

async function buildResources() {
  if (!staticFilesOnly) {

    const proj = await projModel.listByIdAsync(projId);
    const player = await new Promise(resolve => player_model.listByProjectId(projId, function (err, data) { resolve(data); }));

    console.log('BUILD-RESOURCES', proj.dataset.ref);
    playerSettings = player;
    const projData = JSON.stringify({ ...proj._doc, player }, null, 4);
    fs.writeFileSync(dataPath + 'settings.json', projData);

    const datasetRef = proj.dataset.ref;
    const dataset = await DSModel.readDataset(datasetRef, false);

    console.log("Found ds with %s datapoints", dataset.datapoints.length);
    const data = JSON.stringify(dataset, null, 4);
    fs.writeFileSync(dataPath + 'nodes.json', data);

    var networks = [];
    for (let i = 0; i < proj.networks.length; i++) {
      let nw = await DSModel.readNetwork(proj.networks[i].ref, false, false);

      if (nw.networkInfo.properlyParsed && !_shouldSanitizeClusterInfo(nw)) {
        console.log("[getAllNetworks] Network pure, returning as it is");
      }
      else {
        if (!nw.networkInfo.properlyParsed) {
          console.log("[getAllNetworks]network is impure, sanitizing it");
          nw = dataUtils.sanitizeNetwork(nw);
        }
        if (_shouldSanitizeClusterInfo(nw)) {
          console.log("[getAllNetworks] sanitizing cluster info");
          nw = dataUtils.sanitizeClusterInfo(nw);
        }
        nw = await DSModel.updateNetwork(nw);
      }

      networks.push(nw);
    }

    const networksData = JSON.stringify(networks, null, 4);
    fs.writeFileSync(dataPath + 'links.json', networksData);
  }

  if (!dataOnly) {
    const html = await buildIndex()
    console.log("HTML fetched.");
    fs.writeFileSync(outputPath + 'index.html', html.text);

    console.log("HTML is rendered.");
    await prepareToPublish();
  } else {
    const { ncp } = require('ncp');
    const publishOutputPath = './publish';
    ncp(outputPath + '/data', publishOutputPath + '/data', function () {
      console.log("JSON data is saved.");
      process.exit(0)
    });
  }
}

function buildIndex() {
  var app  = express();
    
  return new Promise((resolve) => {
    serverInit(app, function() {
      console.log('Rendering index.html...');
      const request = require('supertest');
      const client = request(app);
      client.get('/play/' + (!staticFilesOnly ? playerSettings.playerUrl : 'ten-years-of-ted-talks') + "?data_path=" + publishDataPath).then((val) => resolve(val));
    });
  });
}

async function prepareToPublish() {
  console.log('Preparing items to publish...');
  const publishOutputPath = './publish';
  if (fs.existsSync(publishOutputPath)){
    const del = require('del');
    await del(publishOutputPath);
  }

  fs.mkdirSync(publishOutputPath);

  const { ncp } = require('ncp');

  let i = 0;
  const callbackHandler = function(err) {
    if (++i == 7) process.exit(0);
  };

  ncp(outputPath + '/css', publishOutputPath + '/css', callbackHandler);
  ncp(outputPath + '/data', publishOutputPath + '/data', callbackHandler);
  ncp(outputPath + '/fonts', publishOutputPath + '/fonts', callbackHandler);
  ncp(outputPath + '/img', publishOutputPath + '/img', callbackHandler);
  ncp(outputPath + '/js', publishOutputPath + '/js', callbackHandler);
  ncp(outputPath + '/views/partials', publishOutputPath + '/partials', callbackHandler);
  ncp(outputPath + '/index.html', publishOutputPath + '/index.html', callbackHandler);
}

function _shouldSanitizeClusterInfo(nw) {
  return _.isEmpty(nw.clusterInfo) || !_.get(nw, 'clusterInfo[0].clusters[0].linkingAttrName');
}


buildResources().catch((err) =>  {
  console.error('[Build error]: ' + err);
  process.exit(1);
});