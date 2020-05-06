const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: {
		main: path.resolve(__dirname, 'src/js/lib/main.wpjs'),
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'static/js/lib/'),
	},
	module: {
		rules: [
			{
				test: /\.s?[ac]ss$/i,
				use: [
					{
						loader: 'file-loader',
						options: {
							name: '../../css/[name].css',
						}
					},
					{
						loader: 'extract-loader'
					},
					{
						loader: 'css-loader?-url'
					},
					{
						loader: 'postcss-loader'
					},
					{
						loader: 'sass-loader'
					}
				],
			},
		]
	},
	plugins: [
		new CopyPlugin([
		  { from: 'src/js/views/', to: '../../js/views/' },
		  { from: 'src/js/controllers/', to: '../../js/controllers/' },
		  { from: 'src/js/form-validators/', to: '../../js/form-validators/' },
		  { from: 'src/webfonts/', to: '../../webfonts/' },
		  { from: 'src/img/', to: '../../img/' }
		]),
	]
};