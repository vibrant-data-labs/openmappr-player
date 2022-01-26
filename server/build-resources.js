'use strict';

const _ = require('lodash'),
  Promise = require("bluebird"),
  mongoose = require('mongoose'),
  fs = require('fs'),
  DSModel = require('./datasys/datasys_model'),
  projModel = require("./project/proj_model"),
  dataUtils = require("./utils/dataUtils"),
  AppConfig = require('./services/AppConfig'),
  indexConfig = require('./config/index_config'),
  { execSync } = require('child_process'),
  { argv } = require('yargs'),
  jade = require('jade'),
  inquirer = require('inquirer'),
  sass = require('sass'),
  s3Config = require('./config/s3Config'),
  { ncp } = require('ncp'),
  minify = require('minify'),
  glob = require('glob');
const getLastCommit = require('./publish-player');

const bucketPrefix = "mappr-player";
const player_model = require('./player/player_model');

const dataOnly = argv.dataOnly;
const staticFilesOnly = argv.staticFilesOnly;
const indexOnly = argv.indexOnly;
const noData = argv.noData;
const withDate = argv.withDate;

let projId;
let publishDataPath;

var config = AppConfig.init({
  get: function (key) {
    return process.env[key];
  }
});

function compileScss(deployedUrl) {
  console.log('Compiling SCSS...');
  const playerResult = sass.renderSync({
    file: './client/src/style/sass/player.scss',
    functions: {
      'deployedUrl($path)': function (path) {
        return new sass.types.String('url(' + deployedUrl + path.getValue() + ')');
      }
    }
  });
  fs.writeFileSync('./client/src/style/css/player.css', playerResult.css);

  const mapprResult = sass.renderSync({
    file: './client/src/style/sass/sass.scss',
    functions: {
      'deployedUrl($path)': function (path) {
        return new sass.types.String('url("' + deployedUrl + path.getValue() + '")');
      }
    }
  });
  fs.writeFileSync('./client/src/style/css/sass.css', mapprResult.css);
}

const getDirectories = async function (src, ignore) {
  return new Promise((resolve, reject) => glob(src + '/**/*', { ignore: ignore }, function (err, res) { resolve(res); }));
};

const outputPath = './client/build/dev/';
const dataPath = outputPath + 'data/';

async function runGrunt(isLocal) {
  console.log('Running grunt...');
  if (isLocal) {
    execSync('grunt local --force');
  } else {
    execSync('grunt default --force');
  }

  console.log('Minifying files...');
  const files = require('./config/minifyConfig');

  const outputMinifiedFile = outputPath + '/js/player.min.js';
  for (let file of files) {
    const filePath = outputPath + file;
    try {
      const data = await minify(filePath, {
        js: {
          compress: true,
          mangle: false,
          ecma: 2015,
        }
      });

      fs.appendFileSync(outputMinifiedFile, data);
    }
    catch (err) {
    }
  }
}

var playerSettings = null;
var playerBuildPrefix = '';
var bucketName = '';

async function buildResources() {
  if (dataOnly || (!dataOnly && !staticFilesOnly)) {
    console.log('Fetching projects...');
    await mongoose.connect(config.dbUrl, { useNewUrlParser: true, useUnifiedTopology: true }, function (error) {
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
    let jsonData;
    if (!dataOnly && !staticFilesOnly) {
      const mappingData = fs.readFileSync('./mapping.json');
      jsonData = JSON.parse(mappingData);
    } else {
      const lastCommitInfo = await getLastCommit();
      const lastCommitDate = lastCommitInfo.toString().substring(0, 10);
      bucketName = bucketPrefix + (withDate ? `-${lastCommitDate}` : '');

      const mappingData = fs.readFileSync('./mapping.json');
      jsonData = JSON.parse(mappingData);
      if (process.env.MAPPR_DEBUG) {
        jsonData.sourceUrl = '';
      }
      playerBuildPrefix = jsonData.sourceUrl;
    }

    publishDataPath = '/data/';
    compileScss(jsonData.sourceUrl);
    await runGrunt(!jsonData.sourceUrl);
  }

  if (!staticFilesOnly || (!dataOnly && !staticFilesOnly)) {

    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }

    const proj = await projModel.listByIdAsync(projId);
    const player = await new Promise(resolve => player_model.listByProjectId(projId, function (err, data) { resolve(data); }));

    // set default search algorithm
    player.settings.searchAlg = 'matchSorter';

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
    const publishOutputPath = './publish';
    ncp(outputPath + '/data', publishOutputPath + '/data', function () {
      console.log("JSON data is saved.");
      process.exit(0)
    });
  }
}

function buildIndex() {
  const playerTemplate = outputPath + '/views/index_player.jade';

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
    ...indexConfig,
    player_prefix_index_source: playerBuildPrefix,
    playerDataPath: publishDataPath,
  };

  return new Promise((resolve) => {
    resolve(jade.renderFile(playerTemplate, options));
  });
}

async function prepareToPublish() {
  console.log('Preparing items to publish...');
  const publishOutputPath = './publish';
  if (fs.existsSync(publishOutputPath)) {
    const del = require('del');
    await del([`${publishOutputPath}/**/*`, `!${publishOutputPath}/data`]);
  } else {
    fs.mkdirSync(publishOutputPath);
  }

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


if (indexOnly) {
  (async function () {
    publishDataPath = '/data/';
    const lastCommitInfo = await getLastCommit();
    const lastCommitDate = lastCommitInfo.toString().substring(0, 10);
    bucketName = bucketPrefix + (withDate ? `-${lastCommitDate}` : '');

    const mappingData = fs.readFileSync('./mapping.json');
    const jsonData = JSON.parse(mappingData);

    compileScss(jsonData.sourceUrl);
    await runGrunt(!jsonData.sourceUrl);

    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }

    const publishOutputPath = './publish';
    if (fs.existsSync(publishOutputPath)) {
      const del = require('del');
      await del([`${publishOutputPath}/**/*`]);
    } else {
      fs.mkdirSync(publishOutputPath);
    }
    if (!noData) {
      console.log('Fetching projects...');
      await mongoose.connect(config.dbUrl, { useNewUrlParser: true, useUnifiedTopology: true }, function (error) {
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

      const proj = await projModel.listByIdAsync(projId);
      const player = await new Promise(resolve => player_model.listByProjectId(projId, function (err, data) { resolve(data); }));

      playerSettings = player;
      // set default search algorithm
      player.settings.searchAlg = 'matchSorter';

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

      console.log("HTML is rendered.");
      console.log('Preparing items to publish...');

      await new Promise((resolve) => ncp(outputPath + '/data', publishOutputPath + '/data', () => resolve()));
    }

    const html = await buildIndex()
    console.log("HTML fetched.");
    fs.writeFileSync(outputPath + 'index.html', html);
    await new Promise((resolve) => ncp(outputPath + '/index.html', publishOutputPath + '/index.html', () => resolve()));
  })().then(() => process.exit(0));

} else {
  buildResources().catch((err) => {
    console.error('[Build error]: ' + err);
    process.exit(1);
  });
}