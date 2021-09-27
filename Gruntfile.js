module.exports = function(grunt) {
	'use strict';

	require('time-grunt')(grunt); //Time taken by tasks
	require('jit-grunt')(grunt);

	// secrets
	var aws = {
		accessKeyId: 'AKIAYRX73XY266KUGYNR',
		secretAccessKey: '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',
		region: 'us-west-2'
	}

	var atatus = {
		app : {
			stagingToken : '',
			appToken : ''
		},
		player : {
			stagingToken : '',
      appToken : ''
		}
	}

	var mapping = grunt.file.readJSON("mapping.json");
	var APP_VERSION = mapping.version;
	var buildId = 'build-' + APP_VERSION;
	var dev_build_dir = "client/build/dev";
	var prod_build_dir = "client/build/prod/builds/" + buildId;
	var server_prefix_prod = mapping.s3Url + buildId;
	// var mapp_prefix_prod = 'https://s3-us-west-2.amazonaws.com/mappr-public-mapps';
	var view_path_prod = '/views/partials';
	var view_path_dev = '/partials';

	var server_prefix_dev = mapping.sourceUrl + view_path_dev;
    var build_server = 'dev';

    if(/staging/.test(APP_VERSION)) {
        build_server = 'staging'
    }
    else if(/prod/.test(APP_VERSION)) {
        build_server = 'app';
    }

	// Register plugins and load options
	var configObj = {
		includeSource: {
			options: {
				basePath: dev_build_dir,
				baseUrl: '/'
			}
		},

		clean: {},

		compass: {},

		concat: {
			options: {
				separator: '\n',
				stripBanners: true,
				banner: '/* MAPPR Build <%= grunt.template.today("yyyy-mm-dd") %> */\n'
			}
		},

		copy: {},

		cssmin: {},

		preprocess: {},

		jade: {},

		imagemin: {},

		svgmin: {
			options: {
				plugins: [{
					removeViewBox: false
				}]
			}
		},

		jadeUsemin: {},

		uglify: {},

		jshint: {},

		compress: {},

		aws_s3: {
			options: {
			    accessKeyId: aws.accessKeyId,
			    secretAccessKey: aws.secretAccessKey,
			    region: aws.region,
			    uploadConcurrency: 5, // 5 simultaneous uploads
			    downloadConcurrency: 5, // 5 simultaneous downloads
			    differential: true
			 }
		},

		watch: {},

		concurrent: {},

		http_upload: {},

		cacheBust: {}
	};

	grunt.loadNpmTasks('grunt-contrib-compass');
	grunt.loadNpmTasks('grunt-cache-bust');

	function addTask(plugin, task, config) {
		if(arguments.length < 3) {
			console.log('plugin --> ', plugin);
			console.log('task --> ', task);
			console.log('config --> ', config);
			console.log('Not all params passed');
			return;
		}
		if(!configObj[plugin]) {
			console.log(plugin, ' plugin not initialised');
			return;
		}
		if(configObj[plugin][task]) {
			console.log(plugin + ' ' + task + ' already exists');
			return;
		}
		configObj[plugin][task] = config;
	}

	addTask('uglify', 'dev_player', {
		options: (function() {
			var config = {
				mangle: false,
				sourceMap: false,
				compress: {
					drop_console: true,
					drop_debugger: true
				}
			};

			config.sourceMapName = dev_build_dir + '/sourceMaps/player.min.map';
			return config;
		}()),
		files: (function() {
			var obj = {};
			obj[dev_build_dir + '/js/player.min.js'] = [
				'client/src/products/player/app/app.js',

				"client/src/components/core/directives/dirInfiniteScroll.js",
				"client/src/components/core/directives/dirProgressiveRendering.js",
				"client/src/components/core/directives/dirSelectAll.js",
				"client/src/components/core/directives/dirTextTruncate.js",
				"client/src/components/core/filters/filters.js",
				"client/src/components/core/services/AttrInfoService.js",
				"client/src/components/core/services/AttrSanitizeService.js",
				"client/src/components/core/services/BreadCrumbService.js",
				"client/src/components/core/services/PartitionService.js",
				"client/src/components/core/services/SelectionSetService.js",
				"client/src/components/core/services/SelectorService.js",
				"client/src/components/core/services/aggregatorService.js",
				"client/src/components/core/services/attrUIService.js",
				"client/src/components/core/services/browserDetectService.js",
				"client/src/components/core/services/dataService.js",
				"client/src/components/core/services/datagraph.js",
				"client/src/components/core/services/embedlyService.js",
				"client/src/components/core/services/eventBridgeFactory.js",
				"client/src/components/core/services/extAPIService.js",
				"client/src/components/core/services/graphHoverService.js",
				"client/src/components/core/services/graphSelectionService.js",
				"client/src/components/core/services/hoverService.js",
				"client/src/components/core/services/inputMgmtService.js",
				"client/src/components/core/services/labelRenderer.js",
				"client/src/components/core/services/labelService.js",
				"client/src/components/core/services/layoutService.js",
				"client/src/components/core/services/linkService.js",
				"client/src/components/core/services/localStorageFactory.js",
				"client/src/components/core/services/networkService.js",
				"client/src/components/core/services/nodeRenderer.js",
				"client/src/components/core/services/nodeSelectionService.js",
				"client/src/components/core/services/orgFactory.js",
				"client/src/components/core/services/playerFactory.js",
				"client/src/components/core/services/projectFactory.js",
				"client/src/components/core/services/rendergraphfactory.js",
				"client/src/components/core/services/repositionService.js",
				"client/src/components/core/services/searchService.js",
				"client/src/components/core/services/selectService.js",
				"client/src/components/core/services/snapshotService.js",
				"client/src/components/core/services/subsetService.js",
				"client/src/components/core/services/tagService.js",
				"client/src/components/core/services/uiHelper.js",
				"client/src/components/core/services/uiService.js",
				"client/src/components/core/services/urlShortenService.js",
				"client/src/components/core/services/zoomService.js",
				"client/src/components/core/stats/distrCommon.js",
				"client/src/components/core/stats/rankDistr.js",
				"client/src/components/core/stats/sigtest.js",
				"client/src/components/core/stats/statUtils.js",
				"client/src/components/core/stats/tagDistr.js",
				"client/src/components/core/stats/valDistr.js",
				"client/src/components/core/utils/eventSystem.js",
				"client/src/components/project/ctrlLayout.js",
				"client/src/components/project/ctrlRenderGraph.js",
				"client/src/components/project/layouts/geo/dirGeoLayout.js",
				"client/src/components/project/layouts/grid/dirGridCard.js",
				"client/src/components/project/layouts/grid/dirGridLayout.js",
				"client/src/components/project/layouts/list/dirColResizer.js",
				"client/src/components/project/layouts/list/dirListLayout.js",
				"client/src/components/project/layouts/list/dirListRow.js",
				"client/src/components/project/layouts/scatterplot/dirAxes_new.js",
				"client/src/components/project/layouts/sigma/dirSigma.js",
				"client/src/components/project/distributions/filters/dirCheckboxFilter.js",
				"client/src/components/project/distributions/filters/dirRangeFilter.js",
				"client/src/components/project/distributions/filters/dirTagListSort.js",
				"client/src/components/project/distributions/filters/neighborsFilter.js",
				"client/src/components/project/distributions/renderers/dirAttrDistribution.js",
				"client/src/components/project/distributions/renderers/dirAttrRenderer.js",
				"client/src/components/project/distributions/renderers/dirAttrTooltip.js",
				"client/src/components/project/distributions/renderers/dirCategoryList.js",
				"client/src/components/project/distributions/renderers/dirDateTime.js",
				"client/src/components/project/distributions/renderers/dirEmail.js",
				"client/src/components/project/distributions/renderers/dirHistogram.js",
				"client/src/components/project/distributions/renderers/dirInstagramFeed.js",
				"client/src/components/project/distributions/renderers/dirLinkThumb.js",
				"client/src/components/project/distributions/renderers/dirLongText.js",
				"client/src/components/project/distributions/renderers/dirMapEmbed.js",
				"client/src/components/project/distributions/renderers/dirMediaEmbed.js",
				"client/src/components/project/distributions/renderers/dirMediaList.js",
				"client/src/components/project/distributions/renderers/dirNeighbors.js",
				"client/src/components/project/distributions/renderers/dirNeighborsDetail.js",
				"client/src/components/project/distributions/renderers/dirPicture.js",
				"client/src/components/project/distributions/renderers/dirPieChart.js",
				"client/src/components/project/distributions/renderers/dirRankBar.js",
				"client/src/components/project/distributions/renderers/dirRowTagCloud.js",
				"client/src/components/project/distributions/renderers/dirTagCloud.js",
				"client/src/components/project/distributions/renderers/dirTagList.js",
				"client/src/components/project/distributions/renderers/dirTagListSimple.js",
				"client/src/components/project/distributions/renderers/dirTextList.js",
				"client/src/components/project/distributions/renderers/dirTwitterFeed.js",
				"client/src/components/project/distributions/renderers/dirValueBar.js",
				"client/src/components/project/distributions/renderers/dirWideTagCloud.js",
				"client/src/components/project/overlays/dirFocusNode.js",
				"client/src/components/project/overlays/dirScrollOverlayAnchors.js",
				"client/src/components/project/overlays/ext_user_overlay/dirExtUserOverlay.js",
				"client/src/components/project/overlays/node_overlay/MetaAttrFactory.js",
				"client/src/components/project/overlays/node_overlay/ctrlNodeOverlay.js",
				"client/src/components/project/overlays/node_overlay/dirElemReady.js",
				"client/src/components/project/overlays/node_overlay/utils.js",
				"client/src/components/project/overlays/node_pop/ctrlNodePop.js",
				"client/src/components/project/sort_menu/dirSortMenu.js",
				"client/src/components/project/panels/search/ctrlSearchPanel.js",
				"client/src/components/project/panels/right_panel/ctrlRightPanel.js",
				"client/src/components/project/panels/right_panel/def_data_groups/ctrlDataPresentation.js",
				"client/src/components/project/panels/right_panel/distribution_panel/FilterPanelService.js",
				"client/src/components/project/panels/right_panel/distribution_panel/Steps.js",
				"client/src/components/project/panels/right_panel/distribution_panel/ctrlFilterPanel.js",
				"client/src/components/project/panels/right_panel/distribution_panel/ctrlFilterPanelParent.js",
				"client/src/components/project/panels/right_panel/distribution_panel/dirKillTooltipOnScroll.js",
				"client/src/components/project/panels/right_panel/distribution_panel/dirVirtualScroll.js",
				"client/src/components/project/panels/right_panel/info_panel/ctrlInfoPanel.js",
				"client/src/components/project/panels/right_panel/info_panel/dirClusterBrowser.js",
				"client/src/components/project/panels/right_panel/info_panel/dirNeighborClusters.js",
				"client/src/components/project/panels/right_panel/info_panel/dirNeighborNodes.js",
				"client/src/components/project/panels/right_panel/info_panel/dirNetworkInfo.js",
				"client/src/components/project/panels/right_panel/info_panel/dirNodeBrowser.js",
				"client/src/components/project/panels/right_panel/info_panel/dirNodeInfoAttrs.js",
				"client/src/components/project/panels/right_panel/info_panel/dirNodesList.js",
				"client/src/components/project/panels/right_panel/info_panel/dirSelectionInfo.js",
				"client/src/components/project/panels/right_panel/info_panel/dirPanelSelection.js",
				"client/src/components/project/panels/right_panel/info_panel/infoPanelService.js",
				"client/src/products/player/ctrlApp.js",
				"client/src/products/player/ctrlBottomTimeline.js",
				"client/src/products/player/ctrlContextPanel.js",
				"client/src/products/player/ctrlLayoutDropdown.js",
				"client/src/products/player/ctrlRightPanelTabsPlayer.js",
				"client/src/products/player/ctrlSlidePanel.js",
				"client/src/products/player/ctrlSnapshotSidePanel.js",
				"client/src/products/player/ctrlTopMenu.js",
				"client/src/products/player/dirActivateSnapOnScroll.js",
				"client/src/products/player/dirImageOnLoad.js",
				"client/src/products/player/dirSocialShare.js",
				"client/src/products/player/auth/ctrlPlayerAuth.js",
				"client/src/products/player/auth/ctrlSurveyEmailAuth.js",
				"client/src/products/player/analytics/analytics.config.js",
				"client/src/products/player/analytics/analyticsService.js",
			];
			return obj;
		}())
	});

	/**
	* PRODUCTION TASKS
	* Build related
	* Maintain order
	*/
	addTask('clean', 'prod', [prod_build_dir]);

	addTask('compass', 'prod', {
		options: {
			sassDir: 'client/src/style/sass',
			cssDir: 'client/src/style/css',
			environment: 'production'
		}
	});

	addTask('concat', 'prod_css_mappr', {
		src: ['client/src/style/css/sass.css'],
		dest: prod_build_dir + '/css/tmp/mappr.css'
	});

	addTask('concat', 'prod_css_player', {
		src: ['client/src/style/css/player.css'],
		dest: prod_build_dir + '/css/tmp/player.css'
	});

	addTask('cssmin', 'prod', {
		files: [{
			expand: true,
			cwd: prod_build_dir + '/css/tmp',
			src: ['*.css', '!*.min.css'],
			dest: prod_build_dir + '/css',
			ext: '.min.css'
		}]
	});

	addTask('copy', 'prod_data', {
		files: [{
			expand: true,
			cwd: 'client/src/data/',
			src: ['*.zip','*.gexf'],
			dest: prod_build_dir + '/data/'
		}]
	});

	addTask('copy', 'prod_icons', {
		files: [{
			expand: true,
			cwd: 'client/src/img/',
			src: ['*.ico'],
			dest: prod_build_dir + '/img/'
		}]
	});

	addTask('copy', 'prod_css_icons', {
		files: [{
			expand: true,
			cwd: 'client/src/style/css/',
			src: ['mappr-icons/**'],
			dest: prod_build_dir + '/css/'
		}]
	});

	addTask('copy', 'prod_css_fonts', {
		files: [{
			expand: true,
			cwd: 'client/src/style/css/',
			src: ['minimo/**'],
			dest: prod_build_dir + '/css/'
		}]
	});

	addTask('copy', 'prod_fonts', {
		files: [{
			expand: true,
			cwd: 'client/src/style/fonts/',
			src: ['*'],
			dest: prod_build_dir + '/fonts/'
		}]
	});

	addTask('copy', 'prod_fontawesome', {
		files: [{
			expand: true,
			cwd: 'client/src/fonts',
			src: ['*'],
			dest: prod_build_dir + '/fonts/'
		}]
	});

	addTask('imagemin', 'prod', {
		options: {
			optimizationLevel: 3
		},
		files: [{
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.jpg'],
			dest: prod_build_dir + '/img',
			ext: '.jpg'
		}, {
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.png'],
			dest: prod_build_dir + '/img',
			ext: '.png'
		}, {
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.gif'],
			dest: prod_build_dir + '/img',
			ext: '.gif'
		}]
	});

	addTask('jadeUsemin', 'prod_index', {
		options: {
			prefix: '', //optional - add prefix to the path [default='']
			replacePath: {
				'#{env}': prod_build_dir //optional - key value to replace in src path
			},
			tasks: {
				js: ['concat'],
				css: ['concat', 'cssmin']
			}
		},
		files: [
			{src: 'client/src/products/player/index_player.jade'},
			{src: 'client/src/products/sources/index_sources.jade'}
		]
	});

	addTask('copy', 'prod_js_mappr', {
		src: prod_build_dir + '/js/tmp/mappr.min.js',
		dest: prod_build_dir + '/js/mappr.min.js',
		options: {
			processContent: function (content, srcpath) {
		        return content.replace(/#{server_prefix}/g, server_prefix_prod)
		        			.replace(/#{view_path}/g, view_path_prod);
		        			// .replace(/#{mapp_prefix}/g, mapp_prefix_prod);
		    }
		}
	});

	addTask('copy', 'prod_js_player', {
		src: prod_build_dir + '/js/tmp/player.min.js',
		dest: prod_build_dir + '/js/player.min.js',
		options: {
			processContent: function (content, srcpath) {
		        return content.replace(/#{server_prefix}/g, server_prefix_prod)
		        			.replace(/#{view_path}/g, view_path_prod);
		        			// .replace(/#{production}/g, true);
		    }
		}
	});

	addTask('preprocess', 'prod_jade', {
		options: {
			inline: true,
			context: {
				compiled : true,
				production: true,
			}
		},
		files: [{
			expand: true,
			cwd: 'client/src/',
			src: ['components/**/*.jade', 'components/**/*.html', 'products/**/*.jade', 'products/**/*.html',
					// '!features/common/**/*.jade', '!features/common/**/*.html'
				],
			dest: prod_build_dir + '/views/tmp'
		},
		// {
		// 	expand: true,
		// 	cwd: 'client/src/components/features/common/views',
		// 	src: ['**/*.jade','**/*.html'],
		// 	dest: prod_build_dir + '/views/tmp/common',
		// 	flatten: true
		// }
		]
	});

	addTask('jade', 'prod_jade', {
		options: {
			client: false,
			data: {
				server_prefix: server_prefix_prod,
				view_path: view_path_prod
			}
		},
		files: [{
			cwd: prod_build_dir + '/views/tmp/components',
			src: ['**/*.jade'],
			dest: prod_build_dir + '/views/partials/components',
			expand: true,
			ext: '.html'
		},
		{
			cwd: prod_build_dir + '/views/tmp/products/',
			src: ['**/*.jade'],
			dest: prod_build_dir + '/views/partials',
			expand: true,
			ext: '.html'
		}]
	});

	addTask('copy', 'prod_jade', {
		options: {
			processContent: function (content, srcpath) {
		        return content.replace(/#{server_prefix}/g, server_prefix_prod)
		        				.replace(/#{view_path}/g, view_path_prod);
		    }
		},
		files: [
			{src: prod_build_dir + '/views/tmp/products/player/index_player.jade', dest: prod_build_dir + '/views/index_player.jade'},
			{src: prod_build_dir + '/views/tmp/products/sources/index_sources.jade', dest: prod_build_dir + '/views/index_sources.jade'},
			// {
			// 	cwd: prod_build_dir + '/views/tmp/common',
			// 	src: ['**/*.jade'],
			// 	dest: prod_build_dir + '/views',
			// 	expand: true,
			// 	flatten: true
			// }
		]
	});

	addTask('svgmin', 'prod', {
		files: [{
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.svg'],
			dest: prod_build_dir + '/img/',
			ext: '.svg'
		}]
	});

	addTask('clean', 'prod_tmp', [
		prod_build_dir + '/css/tmp',
		prod_build_dir + '/js/tmp',
		prod_build_dir + '/views/tmp'
	]);

	addTask('cacheBust', 'prod', {
		options: {
			baseDir: prod_build_dir,
			assets: ['js/**/*.js']
		},
		src: [prod_build_dir + '/views/index_player.jade',
				prod_build_dir + '/views/index_sources.jade']
	});

	// GZIP related
	addTask('compress', 'prod_gzip_js', {
		options: {
	      mode: 'gzip'
	    },
	    expand: true,
	    cwd: prod_build_dir + '/js/',
	    src: ['**/*.js'],
	    dest: prod_build_dir + '/gzip/js/',
	    rename: function(dest, src) {
	    	return dest + src + '.gz';
	    }
	});

	addTask('compress', 'prod_gzip_css', {
		options: {
	      mode: 'gzip'
	    },
	    expand: true,
	    cwd: prod_build_dir + '/css/',
	    src: ['**/*'],
	    dest: prod_build_dir + '/gzip/css/',
	    rename: function(dest, src) {
	    	return dest + src + '.gz';
	    }
	});

	addTask('compress', 'prod_gzip_views', {
		options: {
	      mode: 'gzip'
	    },
	    expand: true,
	    cwd: prod_build_dir + '/views/partials/',
	    src: ['**/*'],
	    dest: prod_build_dir + '/gzip/views/partials/',
	    rename: function(dest, src) {
	    	return dest + src + '.gz';
	    }
	});

	addTask('clean', 'prod_pre_gzip', [
		prod_build_dir + '/js/',
		prod_build_dir + '/css/',
		prod_build_dir + '/views/partials/'
	]);

	addTask('copy', 'prod_js_move_gzip', {
		files: [{
			expand: true,
			cwd: prod_build_dir + '/gzip/js/',
			src: ['**/*'],
			dest: prod_build_dir + '/js/'
		}]
	});

	addTask('copy', 'prod_css_move_gzip', {
		files: [{
			expand: true,
			cwd: prod_build_dir + '/gzip/css/',
			src: ['**/*'],
			dest: prod_build_dir + '/css/'
		}]
	});

	addTask('copy', 'prod_views_move_gzip', {
		files: [{
			expand: true,
			cwd: prod_build_dir + '/gzip/views/partials/',
			src: ['**/*'],
			dest: prod_build_dir + '/views/partials/'
		}]
	});

	addTask('clean', 'gzip_tmp', [
		prod_build_dir + '/gzip/'
	]);

	addTask('aws_s3', 'prod_upload', {
	    options: {
	        bucket: 'new-mappr-builds',
	        gzipRename: 'ext',
	        // params: {
	        //   ContentEncoding: 'gzip' // applies to all the files!
	        // },
	        // mime: {
	        //   'dist/assets/production/LICENCE': 'text/plain'
	        // },
	        progress: 'progressBar'
	    },
	    files: [
	        {expand: true, cwd: prod_build_dir, src: ['**'], dest: buildId, stream: true}
	        // CacheControl only applied to the assets folder
	        // LICENCE inside that folder will have ContentType equal to 'text/plain'
	      ]
	});

	// Upload sourcemaps to Atatus directly
	addTask('http_upload', 'upload_app_sourcemap_to_atatus', {
		options: (function() {
            var stagingToken = atatus.app.stagingToken,
                appToken = atatus.app.appToken,
                authToken;

            if(build_server == 'staging') { authToken = stagingToken; }
            else if(build_server == 'app') { authToken = appToken; }

			return {
		        url: 'https://api.atatus.com/api/browser/sourcemap',
		        method: 'POST',
		        headers: {
		          'Authorization': 'token ' + authToken
		        },
		        data: {
		          url: server_prefix_prod + '/js/mappr.min.js'
		        },
		        onComplete: function(data) {
		            console.log('Uploaded workbench sourcemap---- ' + data);
		        }
		    };
		}()),
        src: prod_build_dir + '/sourceMaps/mappr.min.map',
        dest: 'sourcemap'
	});

	addTask('http_upload', 'upload_player_sourcemap_to_atatus', {
		options: (function() {
            var stagingToken = atatus.player.stagingToken,
                appToken = atatus.player.appToken,
                authToken;

            if(build_server == 'staging') { authToken = stagingToken; }
            else if(build_server == 'app') { authToken = appToken; }

            return {
                url: 'https://api.atatus.com/api/browser/sourcemap',
                method: 'POST',
                headers: {
                  'Authorization': 'token ' + authToken
                },
                data: {
                  url: server_prefix_prod + '/js/player.min.js'
                },
                onComplete: function(data) {
                    console.log('Uploaded player sourcemap---- ' + data);
                }
            };
        }()),
        src: prod_build_dir + '/sourceMaps/player.min.map',
        dest: 'sourcemap'
	});

	// Make concurrent task lists
	addTask('concurrent', 'prod1', {
		tasks: [
			'uglify:prod_mappr',
			'compass:prod',
			'uglify:prod_player',
			'uglify:prod_sources'
		]
	});

	addTask('concurrent', 'prod2', {
		tasks: [
			'jade:prod_jade',
			'copy:prod_jade'
		]
	});

	addTask('concurrent', 'prod3', {
		tasks: [
			'compress:prod_gzip_js',
			'compress:prod_gzip_css',
			'compress:prod_gzip_views'
		]
	});

	addTask('concurrent', 'prod4', {
		tasks: [
			'copy:prod_js_move_gzip',
			'copy:prod_css_move_gzip',
			'copy:prod_views_move_gzip'
		]
	});

	/**
	* DEV TASKS
	* Build related
	* Maintain order
	*/

	addTask('clean', 'dev', [dev_build_dir]);

	addTask('compass', 'dev', {
		options: {
			sassDir: 'client/src/style/sass',
			cssDir: 'client/src/style/css',
			environment: 'development'
		}
	});

	addTask('concat', 'dev_css_mappr', {
		src: ['client/src/style/css/sass.css'],
		dest: dev_build_dir + '/css/mappr.debug.css'
	});

	addTask('concat', 'dev_css_player', {
		src: ['client/src/style/css/player.css'],
		dest: dev_build_dir + '/css/player.debug.css'
	});

	addTask('copy', 'dev_icons', {
		files: [{
			expand: true,
			cwd: 'client/src/img/',
			src: ['*.ico'],
			dest: dev_build_dir + '/img/'
		}]
	});

	addTask('copy', 'dev_css_icons', {
		files: [{
			expand: true,
			cwd: 'client/src/style/css/',
			src: ['mappr-icons/**'],
			dest: dev_build_dir + '/css/'
		}]
	});

	addTask('copy', 'dev_fonts', {
		files: [{
			expand: true,
			cwd: 'client/src/style/fonts/',
			src: ['*'],
			dest: dev_build_dir + '/fonts/'
		}]
	});

	addTask('copy', 'dev_css_fonts', {
		files: [{
			expand: true,
			cwd: 'client/src/style/css/',
			src: ['minimo/**'],
			dest: dev_build_dir + '/css/'
		}]
	});

	addTask('copy', 'dev_fontawesome', {
		files: [{
			expand: true,
			cwd: 'client/src/fonts',
			src: ['*'],
			dest: dev_build_dir + '/fonts/'
		}]
	});

	addTask('copy', 'dev_js_app', {
		options: {
			process: function (content, srcpath) {
		        return content.replace(/#{player_prefix_index_source}/g, mapping.sourceUrl).replace(/#{player_prefix_index}/g, server_prefix_dev);
		        			// .replace(/#{mapp_prefix}/g, mapp_prefix_dev)
		        			// .replace(/#{production}/g, false);
		    }
		},
		files: [{
			expand: true,
			cwd: 'client/src/',
			src: [	'components/**/*.js',
					'products/player/**/*.js',
					'products/sources/**/*.js'
				],
			dest: dev_build_dir + '/js/'
		}]
	});

	addTask('copy', 'dev_js_app_local', {
		options: {
			process: function (content, srcpath) {
		        return content.replace(/#{player_prefix_index_source}/g, '').replace(/#{player_prefix_index}/g, view_path_dev);
		        			// .replace(/#{mapp_prefix}/g, mapp_prefix_dev)
		        			// .replace(/#{production}/g, false);
		    }
		},
		files: [{
			expand: true,
			cwd: 'client/src/',
			src: [	'components/**/*.js',
					'products/player/**/*.js',
					'products/sources/**/*.js'
				],
			dest: dev_build_dir + '/js/'
		}]
	});

	addTask('copy', 'dev_js_sig', {
		files: [{
			expand: true,
			cwd: 'client/src/libs/sigmamods',
			src: [	'*.js'	],
			dest: dev_build_dir + '/js/lib/sigmamods'
		}]
	});

	addTask('imagemin', 'dev', {
		options: {
			optimizationLevel: 0
		},
		files: [{
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.jpg'],
			dest: dev_build_dir + '/img',
			ext: '.jpg'
		}, {
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.png'],
			dest: dev_build_dir + '/img',
			ext: '.png'
		}, {
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.gif'],
			dest: dev_build_dir + '/img',
			ext: '.gif'
		}]
	});

	addTask('jadeUsemin', 'dev_index', {
		options: {
			prefix: '', //optional - add prefix to the path [default='']
			replacePath: {
				'#{env}': dev_build_dir //optional - key value to replace in src path
			},
			tasks: {
				js: ['concat'],
				css: ['concat']
			}
		},
		files: [
			{src: 'client/src/products/player/index_player.jade'},
			{src: 'client/src/products/sources/index_sources.jade'}
		]
	});

	addTask('preprocess', 'dev_jade', {
		options: {
			inline: true,
			context: {
				compiled : true,
				production: false,
			}
		},
		files: [{
			expand: true,
			cwd: 'client/src/',
			src: ['components/**/*.jade', 'components/**/*.html', 'products/**/*.jade', 'products/**/*.html',
					// '!features/common/**/*.jade', '!features/common/**/*.html'
				],
			dest: dev_build_dir + '/views/tmp'
		},
		// {
		// 	expand: true,
		// 	cwd: 'client/src/components/features/common/views',
		// 	src: ['**/*.jade','**/*.html'],
		// 	dest: dev_build_dir + '/views/tmp/common',
		// 	flatten: true
		// }
		]
	});

	addTask('jade', 'dev_jade', {
		options: {
			client: false,
			pretty: true,
			data: {
				player_prefix_index: server_prefix_dev,
				player_prefix_index_source: mapping.sourceUrl
			}
		},
		files: [{
			cwd: dev_build_dir + '/views/tmp/components',
			src: ['**/*.jade'],
			dest: dev_build_dir + '/views/partials/components',
			expand: true,
			ext: '.html'
		},
		{
			cwd: dev_build_dir + '/views/tmp/products/',
			src: ['**/*.jade'],
			dest: dev_build_dir + '/views/partials',
			expand: true,
			ext: '.html'
		}]
	});

	addTask('jade', 'dev_jade_local', {
		options: {
			client: false,
			pretty: true,
			data: {
				player_prefix_index: view_path_dev,
				player_prefix_index_source: ''
			}
		},
		files: [{
			cwd: dev_build_dir + '/views/tmp/components',
			src: ['**/*.jade'],
			dest: dev_build_dir + '/views/partials/components',
			expand: true,
			ext: '.html'
		},
		{
			cwd: dev_build_dir + '/views/tmp/products/',
			src: ['**/*.jade'],
			dest: dev_build_dir + '/views/partials',
			expand: true,
			ext: '.html'
		}]
	});	

	addTask('copy', 'dev_jade', {
		options: {
			process: function (content, srcpath) {
		        return content.replace(/#{player_prefix_index_source}/g, mapping.sourceUrl).replace(/#{player_prefix_index}/g, server_prefix_dev);
		    }
		},
		files: [
			{src: dev_build_dir + '/views/tmp/products/player/index_player.jade', dest: dev_build_dir + '/views/index_player.jade'},
			{src: dev_build_dir + '/views/tmp/products/sources/index_sources.jade', dest: dev_build_dir + '/views/index_sources.jade'},
			{
				cwd: dev_build_dir + '/views/tmp/common',
				src: ['**/*.jade'],
				dest: dev_build_dir + '/views',
				expand: true,
				flatten: true
			}
		]
	});

	addTask('copy', 'dev_jade_local', {
		options: {
			process: function (content, srcpath) {
		        return content.replace(/#{player_prefix_index_source}/g, '').replace(/#{player_prefix_index}/g, view_path_dev);
		    }
		},
		files: [
			{src: dev_build_dir + '/views/tmp/products/player/index_player.jade', dest: dev_build_dir + '/views/index_player.jade'},
			{src: dev_build_dir + '/views/tmp/products/sources/index_sources.jade', dest: dev_build_dir + '/views/index_sources.jade'},
			{
				cwd: dev_build_dir + '/views/tmp/common',
				src: ['**/*.jade'],
				dest: dev_build_dir + '/views',
				expand: true,
				flatten: true
			}
		]
	});

	addTask('svgmin', 'dev', {
		files: [{
			expand: true,
			cwd: 'client/src/img',
			src: ['**/*.svg'],
			dest: dev_build_dir + '/img/',
			ext: '.svg'
		}]
	});

	addTask('includeSource', 'dev_jade', {
		files: (function() {
			var obj = {};
			obj[dev_build_dir + '/views/index_player.jade'] = dev_build_dir + '/views/index_player.jade';
			obj[dev_build_dir + '/views/index_sources.jade'] = dev_build_dir + '/views/index_sources.jade';
			// obj[dev_build_dir + '/views/survey.jade'] = dev_build_dir + '/views/survey.jade';
			return obj;
		}())
	});

	addTask('clean', 'dev_tmp', [
		dev_build_dir + '/css/tmp',
		dev_build_dir + '/js/tmp',
		dev_build_dir + '/views/tmp'
	]);

addTask('cacheBust', 'dev', {
		options: {
			baseDir: './client/build/dev',
			assets: ['js/**/*.js', 'css/**/*.css']
		},
		src: ['client/build/dev/views/index_player.jade',
			'client/build/dev/views/index_sources.jade']
	});

	addTask('concurrent', 'dev1', {
		tasks: [
			'compass:dev',
			'jade:dev_jade',
		]
	});

	/**
	* DEV TASKS
	* Not build related
	*/

	addTask('jshint', 'dev', [
		dev_build_dir + '/app/**/*.js',
		'Gruntfile.js'
	]);

	addTask('watch', 'dev_js_app', {
		files: [
				   'client/src/components/**/*.js',
				   'client/src/products/**/*.js',
				   'client/src/libs/sigmamods/**/*.js',
			   ],

		tasks: [
			'copy:dev_js_app'
		]
	});

	addTask('watch', 'dev_sass_app', {
		files: ['client/src/style/sass/**/*.scss'],
		tasks: [
				'compass:dev',
				'concat:dev_css_mappr',
				'concat:dev_css_player'
				]
	});

	addTask('watch', 'dev_css_mappr', {
		files: ['client/src/style/css/sass.css'],
		tasks: [
				'concat:dev_css_mappr'
				]
	});

	addTask('watch', 'dev_css_player', {
		files: ['client/src/style/css/player.css'],
		tasks: [
				'concat:dev_css_player'
				]
	});

	addTask('watch', 'dev_jade_app', {
		files: [
			'client/src/components/**/*.jade',
			'client/src/products/**/*.jade'
		],
		tasks: [
			'newer:preprocess:dev_jade',
			'newer:jade:dev_jade',
			'copy:dev_jade',
			'includeSource'
		]
	});

	grunt.initConfig(configObj);


	grunt.event.on('watch', function(action, filepath, target) {
		grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
	});

	var tasks = [
		'clean:dev',
		'compass:dev',
		'concat:dev_css_mappr',
		'concat:dev_css_player',
		'copy:dev_icons',
		'copy:dev_css_icons',
		'copy:dev_css_fonts',
		'copy:dev_fonts',
		'copy:dev_fontawesome',
		'copy:dev_js_sig',
		'copy:dev_js_app',
		'imagemin:dev',
		'jadeUsemin:dev_index',
		// 'jadeUsemin:dev_survey',
		'preprocess:dev_jade',
		'jade:dev_jade',
		'copy:dev_jade',
		'svgmin:dev',
		'includeSource:dev_jade',
		'clean:dev_tmp',
	];

	grunt.registerTask('default', tasks);

	var tasksLocal = [
		'clean:dev',
		'compass:dev',
		'concat:dev_css_mappr',
		'concat:dev_css_player',
		'copy:dev_icons',
		'copy:dev_css_icons',
		'copy:dev_css_fonts',
		'copy:dev_fonts',
		'copy:dev_fontawesome',
		'copy:dev_js_sig',
		'copy:dev_js_app_local',
		'imagemin:dev',
		'jadeUsemin:dev_index',
		// 'jadeUsemin:dev_survey',
		'preprocess:dev_jade',
		'jade:dev_jade_local',
		'copy:dev_jade_local',
		'svgmin:dev',
		'includeSource:dev_jade',
		'clean:dev_tmp',
	];

	grunt.registerTask('local', tasksLocal);
};
