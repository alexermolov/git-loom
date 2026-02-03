const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  target: 'web',
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    fallback: {
      'path': false,
      'fs': false,
      'events': require.resolve('events/')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html'
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ],
  devServer: {
    port: 3000,
    hot: true
  }
};
