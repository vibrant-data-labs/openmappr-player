const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
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

const jadeTemplateFiles = glob.sync('./src/**/!(index).jade').map(name => {
    const outputName = jadeReplacer
        .reduce((acc, cv) => acc.replace(cv.pathPrefix, cv.replaceWith), name)
        .replace(/\.jade$/, '.html');

    return new HtmlWebpackPlugin({
        template: `${name}`,
        filename: outputName,
        chunks: ['player'],
        inject: false,
    })
});

const extraChunks = [
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
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    entry: {
        player: {
            import: './src/player.js',
            dependOn: extraChunks,
        },
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
    optimization: {
        runtimeChunk: 'single',
        minimize: isProduction,
        minimizer: [
            new CssMinimizerPlugin(),
        ]
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
                    { loader: "css-loader" }
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: "css-loader" },
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
                loader: 'file-loader',
            },
            {
                test: /\.(png|jpg)$/,
                use: "file-loader",
            }
        ]
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
            templateParameters: {
                player_prefix_index_source: isProduction ? mapping.sourceUrl : '',
                player_prefix_index: isProduction ? `${mapping.sourceUrl}/partials` : '/partials',
                gtag_id: mapping.gtag,
                playerTitle: 'network visualization',
                backgroundColor: '#fff',
                colorTheme: 'light',
            },
        }),
        ...jadeTemplateFiles,
        new MiniCssExtractPlugin({
            filename: (pathData) => {
                return cssOutputMapping[pathData.chunk.name] ?? 'css/[name].min.css';
            }
        }),
    ]
}