const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
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
        replaceWith: '/partials/components',
    }, {
        pathPrefix: './src/products/player',
        replaceWith: '/partials/player'
    }
]

const templateParameters = {
    player_prefix_index_source: isProduction ? mapping.sourceUrl : '',
    player_prefix_index: isProduction ? `${mapping.sourceUrl}/partials` : '/partials',
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

const extraChunks = [
    'jquery',
    'angular',
    'angular-loading-bar',
    'angular-touch',
    'angular-route',
    'angular-sanitize',
    'angular-animate',
    'angular-cookies',
    'angular-ui-bootstrap',
    'angular-simple-logger',
    'angular-scroll',
    'ng-device-detector',
    'angular-audio',
    'angular-vs-repeat',
    'angular-intro.js']

module.exports = {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'eval-cheap-source-map',
    entry: {
        player: './src/player.js',
        vendor: './src/vendor.js',
        worker: './src/worker/searchWorker.js',
        ...extraChunks.reduce((acc, cur) => {
            return {
                ...acc,
                [cur]: cur,
            }
        }, {}),
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
                    getReplaceLoader(/#{player_prefix_index}/g, isProduction ? `${mapping.sourceUrl}/partials` : '/partials'),
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
                            player_prefix_index: isProduction ? `${mapping.sourceUrl}/partials` : '/partials',
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
    devServer: {
        static: {
            directory: path.join(__dirname, 'build'),
        },
        hot: true,
        compress: true,
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
                { from: 'assets/data', to: 'data' },
            ]
        })
    ]
}