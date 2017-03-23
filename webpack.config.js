'use strict'
const path = require('path')

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

module.exports = {
  entry: {
    main: ['./src/script/main']
  },
  output: {
    path: __dirname,
    filename: './build/script/[name].js',
    chunkFilename: './build/script/[id].js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          sourceMaps: inProduction,
          presets: ['es2015'],
          plugins: ['transform-strict-mode']
        }
      }
    ]
  },

  resolve: {
    extensions: ['.js', '.json'],
    modules: [
      path.join(__dirname, '/src/script'),
      'node_modules'
    ]
  },

  plugins: [],

  devtool: 'inline-source-map'
}
