const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');

const outputDirectory = 'dist';

module.exports = {
    entry: './src/client/index.js',
    output: {
        path: path.join(__dirname, outputDirectory),
        filename: 'bundle.js'
    },
    module: {
        rules: [{
                test: /\.js$/,
                exclude: /node_modules/,
                 loader: 'babel-loader',
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|woff|woff2|eot|ttf|svg)$/,
                loader: 'url-loader?limit=100000'
            }
        ]
    },
    plugins: [
        new CleanWebpackPlugin([outputDirectory]),
        new HtmlWebpackPlugin({
            template: './public/index.html',
            favicon: './public/favicon.ico'
        }),
        new HtmlWebpackPlugin({
            filename: 'error.html',
            template: './public/error.html'
        }),
        new HtmlWebpackPlugin({
            filename: 'grade_settings_error.html',
            template: './public/grade_settings_error.html'
        }),
        new HtmlWebpackPlugin({
            filename: 'access_denied.html',
            template: './public/access_denied.html'
	}),
        new HtmlWebpackPlugin({
            filename: 'non_gradables.html',
            template: './public/non_gradables.html'
        })

    ]
};
