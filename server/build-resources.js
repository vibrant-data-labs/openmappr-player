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


const player_model = require('./player/player_model');

const dataOnly = argv.dataOnly;
const staticFilesOnly = argv.staticFilesOnly;
const indexOnly = argv.indexOnly;
const noData = argv.noData;
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

async function runGrunt() {
  console.log('Running grunt...');
  execSync('grunt --force');

  console.log('Minifying files...');
  const files = ["/js/products/player/app/app.js",
    "/js/lib/sigmamods/cameramods.js",
    "/js/lib/sigmamods/canvas.edges.def.js",
    "/js/lib/sigmamods/canvas.hovers.def.js",
    "/js/lib/sigmamods/canvas.labels.def.js",
    "/js/lib/sigmamods/canvas.nodes.aggr.js",
    "/js/lib/sigmamods/canvas.nodes.def.js",
    "/js/lib/sigmamods/captors.mouse.js",
    "/js/lib/sigmamods/graphmods.js",
    "/js/lib/sigmamods/mappr.utils.js",
    "/js/lib/sigmamods/middlewares.resize.js",
    "/js/lib/sigmamods/misc.bindLeafletEvents.js",
    "/js/lib/sigmamods/misc.drawHovers.js",
    "/js/lib/sigmamods/renderers.canvas.js",
    "/js/lib/sigmamods/renderers.common.js",
    "/js/lib/sigmamods/renderers.webgl.js",
    "/js/lib/sigmamods/sigma.plugins.animate.js",
    "/js/lib/sigmamods/sigma.renderers.snapshot.js",
    "/js/lib/sigmamods/sigmamods.js",
    "/js/lib/sigmamods/webgl.edges.curved.js",
    "/js/lib/sigmamods/webgl.edges.def.js",
    "/js/lib/sigmamods/webgl.nodes.def.js",
    "/js/components/core/directives/dirInfiniteScroll.js",
    "/js/components/core/directives/dirProgressiveRendering.js",
    "/js/components/core/directives/dirSelectAll.js",
    "/js/components/core/directives/dirTextTruncate.js",
    "/js/components/core/filters/filters.js",
    "/js/components/core/services/AttrInfoService.js",
    "/js/components/core/services/AttrSanitizeService.js",
    "/js/components/core/services/BreadCrumbService.js",
    "/js/components/core/services/PartitionService.js",
    "/js/components/core/services/SelectionSetService.js",
    "/js/components/core/services/SelectorService.js",
    "/js/components/core/services/aggregatorService.js",
    "/js/components/core/services/attrUIService.js",
    "/js/components/core/services/browserDetectService.js",
    "/js/components/core/services/dataService.js",
    "/js/components/core/services/datagraph.js",
    "/js/components/core/services/embedlyService.js",
    "/js/components/core/services/eventBridgeFactory.js",
    "/js/components/core/services/extAPIService.js",
    "/js/components/core/services/graphHoverService.js",
    "/js/components/core/services/graphSelectionService.js",
    "/js/components/core/services/hoverService.js",
    "/js/components/core/services/inputMgmtService.js",
    "/js/components/core/services/labelRenderer.js",
    "/js/components/core/services/labelService.js",
    "/js/components/core/services/layoutService.js",
    "/js/components/core/services/linkService.js",
    "/js/components/core/services/localStorageFactory.js",
    "/js/components/core/services/networkService.js",
    "/js/components/core/services/nodeRenderer.js",
    "/js/components/core/services/nodeSelectionService.js",
    "/js/components/core/services/orgFactory.js",
    "/js/components/core/services/playerFactory.js",
    "/js/components/core/services/projectFactory.js",
    "/js/components/core/services/rendergraphfactory.js",
    "/js/components/core/services/repositionService.js",
    "/js/components/core/services/searchService.js",
    "/js/components/core/services/selectService.js",
    "/js/components/core/services/snapshotService.js",
    "/js/components/core/services/subsetService.js",
    "/js/components/core/services/tagService.js",
    "/js/components/core/services/uiHelper.js",
    "/js/components/core/services/uiService.js",
    "/js/components/core/services/urlShortenService.js",
    "/js/components/core/services/zoomService.js",
    "/js/components/core/stats/distrCommon.js",
    "/js/components/core/stats/rankDistr.js",
    "/js/components/core/stats/sigtest.js",
    "/js/components/core/stats/statUtils.js",
    "/js/components/core/stats/tagDistr.js",
    "/js/components/core/stats/valDistr.js",
    "/js/components/core/utils/eventSystem.js",
    "/js/components/project/ctrlLayout.js",
    "/js/components/project/ctrlRenderGraph.js",
    "/js/components/project/layouts/geo/dirGeoLayout.js",
    "/js/components/project/layouts/grid/dirGridCard.js",
    "/js/components/project/layouts/grid/dirGridLayout.js",
    "/js/components/project/layouts/list/dirColResizer.js",
    "/js/components/project/layouts/list/dirListLayout.js",
    "/js/components/project/layouts/list/dirListRow.js",
    "/js/components/project/layouts/scatterplot/dirAxes_new.js",
    "/js/components/project/layouts/sigma/dirSigma.js",
    "/js/components/project/distributions/filters/dirCheckboxFilter.js",
    "/js/components/project/distributions/filters/dirRangeFilter.js",
    "/js/components/project/distributions/filters/dirTagListSort.js",
    "/js/components/project/distributions/filters/neighborsFilter.js",
    "/js/components/project/distributions/renderers/dirAttrDistribution.js",
    "/js/components/project/distributions/renderers/dirAttrRenderer.js",
    "/js/components/project/distributions/renderers/dirAttrTooltip.js",
    "/js/components/project/distributions/renderers/dirCategoryList.js",
    "/js/components/project/distributions/renderers/dirDateTime.js",
    "/js/components/project/distributions/renderers/dirEmail.js",
    "/js/components/project/distributions/renderers/dirHistogram.js",
    "/js/components/project/distributions/renderers/dirInstagramFeed.js",
    "/js/components/project/distributions/renderers/dirLinkThumb.js",
    "/js/components/project/distributions/renderers/dirLongText.js",
    "/js/components/project/distributions/renderers/dirMapEmbed.js",
    "/js/components/project/distributions/renderers/dirMediaEmbed.js",
    "/js/components/project/distributions/renderers/dirMediaList.js",
    "/js/components/project/distributions/renderers/dirNeighbors.js",
    "/js/components/project/distributions/renderers/dirNeighborsDetail.js",
    "/js/components/project/distributions/renderers/dirPicture.js",
    "/js/components/project/distributions/renderers/dirPieChart.js",
    "/js/components/project/distributions/renderers/dirRankBar.js",
    "/js/components/project/distributions/renderers/dirRowTagCloud.js",
    "/js/components/project/distributions/renderers/dirTagCloud.js",
    "/js/components/project/distributions/renderers/dirTagList.js",
    "/js/components/project/distributions/renderers/dirTagListSimple.js",
    "/js/components/project/distributions/renderers/dirTextList.js",
    "/js/components/project/distributions/renderers/dirTwitterFeed.js",
    "/js/components/project/distributions/renderers/dirValueBar.js",
    "/js/components/project/distributions/renderers/dirWideTagCloud.js",
    "/js/components/project/overlays/dirFocusNode.js",
    "/js/components/project/overlays/dirScrollOverlayAnchors.js",
    "/js/components/project/overlays/ext_user_overlay/dirExtUserOverlay.js",
    "/js/components/project/overlays/node_overlay/MetaAttrFactory.js",
    "/js/components/project/overlays/node_overlay/ctrlNodeOverlay.js",
    "/js/components/project/overlays/node_overlay/dirElemReady.js",
    "/js/components/project/overlays/node_overlay/utils.js",
    "/js/components/project/overlays/node_pop/ctrlNodePop.js",
    "/js/components/project/sort_menu/dirSortMenu.js",
    "/js/components/project/panels/search/ctrlSearchPanel.js",
    "/js/components/project/panels/right_panel/ctrlRightPanel.js",
    "/js/components/project/panels/right_panel/def_data_groups/ctrlDataPresentation.js",
    "/js/components/project/panels/right_panel/distribution_panel/FilterPanelService.js",
    "/js/components/project/panels/right_panel/distribution_panel/Steps.js",
    "/js/components/project/panels/right_panel/distribution_panel/ctrlFilterPanel.js",
    "/js/components/project/panels/right_panel/distribution_panel/ctrlFilterPanelParent.js",
    "/js/components/project/panels/right_panel/distribution_panel/dirKillTooltipOnScroll.js",
    "/js/components/project/panels/right_panel/distribution_panel/dirVirtualScroll.js",
    "/js/components/project/panels/right_panel/info_panel/ctrlInfoPanel.js",
    "/js/components/project/panels/right_panel/info_panel/dirClusterBrowser.js",
    "/js/components/project/panels/right_panel/info_panel/dirNeighborClusters.js",
    "/js/components/project/panels/right_panel/info_panel/dirNeighborNodes.js",
    "/js/components/project/panels/right_panel/info_panel/dirNetworkInfo.js",
    "/js/components/project/panels/right_panel/info_panel/dirNodeBrowser.js",
    "/js/components/project/panels/right_panel/info_panel/dirNodeInfoAttrs.js",
    "/js/components/project/panels/right_panel/info_panel/dirNodesList.js",
    "/js/components/project/panels/right_panel/info_panel/dirSelectionInfo.js",
    "/js/components/project/panels/right_panel/info_panel/infoPanelService.js",
    "/js/products/player/ctrlApp.js",
    "/js/products/player/ctrlBottomTimeline.js",
    "/js/products/player/ctrlContextPanel.js",
    "/js/products/player/ctrlLayoutDropdown.js",
    "/js/products/player/ctrlRightPanelTabsPlayer.js",
    "/js/products/player/ctrlSlidePanel.js",
    "/js/products/player/ctrlSnapshotSidePanel.js",
    "/js/products/player/ctrlTopMenu.js",
    "/js/products/player/dirActivateSnapOnScroll.js",
    "/js/products/player/dirImageOnLoad.js",
    "/js/products/player/dirSocialShare.js",
    "/js/products/player/auth/ctrlPlayerAuth.js",
    "/js/products/player/auth/ctrlSurveyEmailAuth.js",
    "/js/products/player/analytics/analytics.config.js",
    "/js/products/player/analytics/analyticsService.js"];

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
    if (!dataOnly && !staticFilesOnly) {
      const mappingData = fs.readFileSync('./mapping.json');
      const jsonData = JSON.parse(mappingData);
      jsonData.sourceUrl = '';
      fs.writeFileSync('./mapping.json', JSON.stringify(jsonData), { flag: 'w' });
    } else {
      const lastCommitInfo = await getLastCommit();
      const lastCommitDate = lastCommitInfo.toString().substring(0, 10);
      playerBuildPrefix = 'http://' + s3Config.bucketDefaultPrefix + lastCommitDate + '.s3.us-east-1.amazonaws.com';
      const mappingData = fs.readFileSync('./mapping.json');
      const jsonData = JSON.parse(mappingData);
      jsonData.sourceUrl = playerBuildPrefix;
      fs.writeFileSync('./mapping.json', JSON.stringify(jsonData), { flag: 'w' });
    }

    publishDataPath = '/data/';
    compileScss(playerBuildPrefix);
    await runGrunt();
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
    ...indexConfig,
    player_prefix_index_source: playerBuildPrefix,
    playerDataPath: publishDataPath,
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
    playerBuildPrefix = 'http://' + s3Config.bucketDefaultPrefix + lastCommitDate + '.s3.us-east-1.amazonaws.com'
    const mappingData = fs.readFileSync('./mapping.json');
    const jsonData = JSON.parse(mappingData);
    jsonData.sourceUrl = playerBuildPrefix;
    fs.writeFileSync('./mapping.json', JSON.stringify(jsonData), { flag: 'w' });

    compileScss(playerBuildPrefix);
    await runGrunt();

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