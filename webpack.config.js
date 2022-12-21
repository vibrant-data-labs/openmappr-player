const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin');
const { CleanPlugin } = require('webpack');
const mapping = require('./mapping.json');
const glob = require('glob')

const getReplaceLoader = (search, replace) => ({
    loader: 'string-replace-loader',
    options: {
        search,
        replace,
    }
});

const isProduction = process.env.NODE_ENV === 'production';

const outputMapping = {
    'player': '/js/[name].min.js',
    'vendor': '/js/player/[name].js',
    'worker': '/js/worker/searchWorker.js',
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
        chunks: ['player']
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
            return outputMapping[pathData.chunk.name] ?? '/libs/[name].js';
        },
    },
    optimization: {
        runtimeChunk: 'single',
    },
    module: {
        rules: [
            {
                test: /\.js|\.jade$/,
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
                use: [
                    'jade-loader'
                ]
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
            inject: false
        }),
        ...jadeTemplateFiles,
    ]
}