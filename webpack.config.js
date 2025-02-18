const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const { CleanPlugin } = require('webpack');
const mapping = require('./mapping.json');
const glob = require('glob')
const sass = require('sass');

const getReplaceLoader = (search, replace) => ({
    loader: 'string-replace-loader',
    options: {
        search,
        replace,
    }
});

const isProduction = process.env.NODE_ENV === 'production';

const jsOutputMapping = {
    'player': '/js/[name].min.js',
    'vendor': '/js/player/[name].js',
    'worker': '/js/worker/searchWorker.js',
}

const cssOutputMapping = {
    'vendor': '/css/vendor.css',
    'player': '/css/player.debug.css',
}

const jadeReplacer = [
    {
        pathPrefix: './src/components',
        replaceWith: 'partials/components',
    }, {
        pathPrefix: './src/products/player',
        replaceWith: 'partials/player'
    }
]

const templateParameters = {
    player_prefix_index_source: isProduction ? mapping.sourceUrl : '',
    player_prefix_index: isProduction ? `${mapping.sourceUrl}/partials` : 'partials',
    gtag_id: mapping.gtag,
    playerTitle: 'network visualization',
    backgroundColor: '#fff',
    colorTheme: 'light',
    playerDataPath: 'data/'
};

const jadeTemplateFiles = glob.sync('./src/**/!(index).jade').map(name => {
    const outputName = jadeReplacer
        .reduce((acc, cv) => acc.replace(cv.pathPrefix, cv.replaceWith), name)
        .replace(/\.jade$/, '.html');

    return new HtmlWebpackPlugin({
        template: `${name}`,
        filename: outputName,
        chunks: ['player'],
        inject: false,
        templateParameters,
    })
});

const externalLibs = {
    'libs/es5-shim.min.js': './node_modules/es5-shim/es5-shim.min.js',
    'libs/jquery.min.js': './node_modules/jquery/dist/jquery.min.js',
    'libs/jquery-ui.min.js': './node_modules/jquery-ui/dist/jquery-ui.min.js',
    'libs/angular.min.js': './node_modules/angular/angular.min.js',
    'libs/angular-resource.min.js': './node_modules/angular-resource/angular-resource.min.js',
    'libs/angular-cookies.min.js': './node_modules/angular-cookies/angular-cookies.min.js',
    'libs/angular-sanitize.min.js': './node_modules/angular-sanitize/angular-sanitize.min.js',
    'libs/angular-scroll.min.js': './node_modules/angular-scroll/angular-scroll.min.js',
    'libs/angular-route.min.js': './node_modules/angular-route/angular-route.min.js',
    'libs/angular-animate.min.js': './node_modules/angular-animate/angular-animate.min.js',
    'libs/angular-touch.min.js': './node_modules/angular-touch/angular-touch.min.js',
    'libs/angular-simple-logger.min.js': './node_modules/angular-simple-logger/dist/angular-simple-logger.min.js',
    'libs/angular-ui-bootstrap.min.js': './node_modules/angular-ui-bootstrap/dist/ui-bootstrap-tpls.js',
    'libs/angular-vs-repeat.min.js': './node_modules/angular-vs-repeat/src/angular-vs-repeat.min.js',
    'libs/json3.min.js': './node_modules/json3/lib/json3.min.js',
    'libs/lodash.min.js': './node_modules/lodash/index.js',
    'libs/leaflet.js': './node_modules/leaflet/dist/leaflet.js',
    'libs/angular-leaflet-directive.min.js': './node_modules/angular-leaflet-directive/dist/angular-leaflet-directive.min.js',
    'libs/angular-loading-bar.min.js': './node_modules/angular-loading-bar/build/loading-bar.min.js',
    'libs/d3.min.js': './node_modules/d3/d3.min.js',
    'libs/snap.svg-min.js': './node_modules/snapsvg/dist/snap.svg-min.js',
    'libs/ng-infinite-scroll.min.js': './node_modules/ng-infinite-scroll/build/ng-infinite-scroll.min.js',
    'libs/re-tree.min.js': './node_modules/re-tree/re-tree.min.js',
    'libs/slider.min.js': './node_modules/angular-ui-slider/src/slider.js',
    'libs/ng-device-detector.min.js': './node_modules/ng-device-detector/ng-device-detector.min.js',
    'libs/bootstrap-notify.min.js': './node_modules/bootstrap-notify/bootstrap-notify.min.js',
    'libs/toastr.min.js': './node_modules/toastr/build/toastr.min.js',
    'libs/moment.min.js': './node_modules/moment/min/moment.min.js',
    'libs/twix.min.js': './node_modules/twix/dist/twix.min.js',
    'libs/angular.audio.js': './node_modules/angular-audio/app/angular.audio.js',
    'libs/intro.min.js': './node_modules/intro.js/minified/intro.min.js',
    'libs/angular-intro.js': './node_modules/angular-intro.js/build/angular-intro.min.js',
    'libs/html2canvas.min.js': './node_modules/html2canvas/dist/html2canvas.min.js',
    'libs/mappr-components.js': './src/libs/mappr-components.umd.js',
    'react': './node_modules/react/index.js',
    'react-dom': './node_modules/react-dom/index.js',
}

module.exports = {
    mode: isProduction ? 'production' : 'development',
    devtool: 'eval-cheap-source-map',
    entry: {
        player: './src/player.js',
        vendor: './src/vendor.js',
        worker: './src/worker/searchWorker.js',
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: (pathData) => {
            return jsOutputMapping[pathData.chunk.name] ?? '/libs/[name].js';
        },
    },
    module: {
        rules: [
            {
                test: /\.js|\.jade|\.(s?)css$/,
                use: [
                    getReplaceLoader(/#{player_prefix_index_source}/g, isProduction ? mapping.sourceUrl : ''),
                    getReplaceLoader(/#{player_prefix_index}/g, isProduction ? `${mapping.sourceUrl}/partials` : 'partials'),
                    getReplaceLoader(/#{gtag_id}/g, mapping.gtag),
                    getReplaceLoader(/#{playerTitle}/g, 'network visualization'),
                    getReplaceLoader(/#{backgroundColor}/g, '#fff'),
                    getReplaceLoader(/#{colorTheme}/g, 'light'),
                ]
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            },
            {
                test: /\.jade$/,
                use: {
                    loader: 'jade-loader',
                    options: {
                        locals: {
                            player_prefix_index_source: isProduction ? mapping.sourceUrl : '',
                            player_prefix_index: isProduction ? `${mapping.sourceUrl}/partials` : 'partials',
                            gtag_id: mapping.gtag,
                            playerTitle: 'network visualization',
                            backgroundColor: '#fff',
                            colorTheme: 'light',
                        },
                    }
                }
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: "css-loader",
                        options: {
                            modules: false
                        }
                    }
                ]
            },
            {
                test: /\.scss$/,
                type: 'asset/resource',
                generator: {
                    filename: 'css/player.debug.css',
                },
                use: [
                    {
                        loader: "sass-loader",
                        options: {
                            sassOptions: {
                                functions: {
                                    'deployedUrl($path)': function (path) {
                                        const deployedUrl = isProduction ? mapping.sourceUrl : '';
                                        return new sass.types.String('url(' + deployedUrl + path.getValue() + ')');
                                    }
                                }
                            }
                        }
                    }
                ]
            },
            {
                test: /\.(ttf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
                type: 'asset/resource',
            },
            {
                test: /\.(png|jpg)$/,
                type: 'asset/resource',
            }
        ]
    },
    optimization: {
        minimize: true,
        minimizer: [
            new CssMinimizerPlugin(),
            new TerserPlugin({
                test: /\.js(\?.*)?$/i,
            })
        ]
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'build'),
        },
        hot: true,
        compress: true,
        allowedHosts: "all",
        client: {
            overlay: {
                warnings: false,
            },
        },
        port: 9090,
    },
    plugins: [
        new CleanPlugin({
            cleanOnceBeforeBuildPatterns: [
                '**/*',
                path.join(process.cwd(), 'build/**/*')
            ]
        }),
        new HtmlWebpackPlugin({
            template: "./src/index.jade",
            inject: false,
            templateParameters,
        }),
        ...jadeTemplateFiles,
        new MiniCssExtractPlugin({
            filename: (pathData) => {
                return cssOutputMapping[pathData.chunk.name] ?? 'css/[name].min.css';
            }
        }),
        new CopyPlugin({
            patterns: [
                { from: 'assets/style/css/mappr-icons/style.css', to: 'css/mappr-icons/style.css' },
                { from: 'assets/fonts', to: 'fonts' },
                { from: 'assets/img', to: 'img' },
                !isProduction ? { from: 'assets/data', to: 'data' } : undefined,
                ...Object.keys(externalLibs).map((key) => ({ from: externalLibs[key], to: key }))
            ].filter(Boolean)
        })
    ]
}