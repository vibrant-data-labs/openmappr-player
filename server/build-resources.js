'use strict';

const _ = require('lodash'),
  Promise = require("bluebird"),
  mongoose = require('mongoose'),
  fs = require('fs'),
  DSModel = require('./datasys/datasys_model'),
  projModel = require("./project/proj_model"),
  dataUtils = require("./utils/dataUtils"),
  AppConfig = require('./services/AppConfig'),
  { execSync } = require('child_process'),
  { argv } = require('yargs'),
  jade = require('jade'),
  inquirer = require('inquirer'),
  sass = require('sass');

const player_model = require('./player/player_model');

const dataOnly = argv.dataOnly;
const staticFilesOnly = argv.staticFilesOnly;
let projId;
let publishDataPath;

var config = AppConfig.init({
  get: function (key) {
    return process.env[key];
  }
});

function compileScss() {
  console.log('Compiling SCSS...');
  const playerResult = sass.renderSync({
    file: './client/src/style/sass/player.scss'
  });
  fs.writeFileSync('./client/src/style/css/player.css', playerResult.css);

  const mapprResult = sass.renderSync({
    file: './client/src/style/sass/sass.scss'
  });
  fs.writeFileSync('./client/src/style/css/sass.css', mapprResult.css);
}

function runGrunt() {
  console.log('Running grunt...');
  execSync('grunt --force');
}

const outputPath = './client/build/dev/';
const dataPath = outputPath + 'data/';

var playerSettings = null;

async function buildResources() {
  if (dataOnly || (!dataOnly && !staticFilesOnly)) {
    console.log('Fetching projects...');
    await mongoose.connect(config.dbUrl, { useNewUrlParser: true, useUnifiedTopology: true}, function(error) {
      if (!error) return;
      console.error('MONGO CONNECT ERR', error);
      process.exit(1);
    });

    const projects = await projModel.listAllAsync();
    const res = await inquirer.prompt([
      {
        type: 'list',
        name: 'projId',
        message: 'Select the project',
        choices: projects.map(r => ({ name: r.projName, value: r._id.toString() })),
        filter: function (val) {
          return val.toLowerCase();
        },
      },
    ]);

    if (!res || !res.projId) {
      console.error('project was not selected');
      process.exit(2);
    }

    projId = res.projId;
  }

  if (staticFilesOnly || (!dataOnly && !staticFilesOnly)) {
    const res = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: 'Enter the relative path to generated json files (default /data/)',
      },
    ]);

    publishDataPath = res && res.path ? res.path : '/data/';
    compileScss();
    runGrunt();
  }

  if (!staticFilesOnly || (!dataOnly && !staticFilesOnly)) {

    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }

    const proj = await projModel.listByIdAsync(projId);
    const player = await new Promise(resolve => player_model.listByProjectId(projId, function (err, data) { resolve(data); }));

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
    fs.writeFileSync(outputPath + 'index.html', html);

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
  const playerTemplate = outputPath + '/views/index_player.jade';

  const contents = fs.readFileSync(playerTemplate);
  const options = {
    client: true,
    compileDebug: false,
    filename: outputPath + '/views/index.html',
    playerLoadInfo: JSON.stringify({
      isPublicPlayer: true,
      playerBuildVer: process.version,
      directAccess: true,
      isFinal: false
    }),
    playerTitle: 'Enter the title here',
    backgroundColor: '#fff',
    colorTheme: 'light',
    snapshotImg: '/img/openmappr_socialmedia.png',
    playerDataPath: publishDataPath,
    player_prefix_index: ''
  };

  return new Promise((resolve) => {
    resolve(jade.renderFile(outputPath + '/views/index_player.jade', options));
  });
}

async function prepareToPublish() {
  console.log('Preparing items to publish...');
  const publishOutputPath = './publish';
  if (fs.existsSync(publishOutputPath)) {
    const del = require('del');
    await del(publishOutputPath);
  }

  fs.mkdirSync(publishOutputPath);

  const { ncp } = require('ncp');

  let i = 0;
  const callbackHandler = function (err) {
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


buildResources().catch((err) => {
  console.error('[Build error]: ' + err);
  process.exit(1);
});