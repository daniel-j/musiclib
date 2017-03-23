'use strict'

const config = require('./scripts/config')

// gulp and utilities
const gulp = require('gulp')
const sourcemaps = require('gulp-sourcemaps')
const gutil = require('gulp-util')
const del = require('del')
const gulpif = require('gulp-if')
const plumber = require('gulp-plumber')
const BrowserSync = require('browser-sync')
const Sequence = require('run-sequence')
const watch = require('gulp-watch')
const debug = require('gulp-debug')

// script
const standard = require('gulp-standard')
const webpack = require('webpack')
const webpackConfig = require('./webpack.config.js')

// style
const stylus = require('gulp-stylus')
const nib = require('nib')
const csso = require('gulp-csso')

const browserSync = BrowserSync.create()
const sequence = Sequence.use(gulp)

let sources = {
  style: ['main.styl']
}
let lintES = ['src/script/**/*.js', 'server/**/*.js', 'scripts/**/*.js', 'liq/scripts/**/*.js', 'gulpfile.js', 'webpack.config.js', 'bin/startserver', 'knexfile.js', 'migrations/*.js']
let fonts = []

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

let stylusOpts = {
  use: nib(),
  compress: false
}
let cssoOpts = {
  restructure: true
}

let watchOpts = {
  readDelay: 500,
  verbose: true
}

if (inProduction) {
  webpackConfig.plugins.push(new webpack.optimize.DedupePlugin())
  webpackConfig.plugins.push(new webpack.optimize.OccurenceOrderPlugin(false))
  webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
      screw_ie8: true
    },
    comments: false,
    mangle: {
      screw_ie8: true
    },
    screw_ie8: true,
    sourceMap: false
  }))
}

let wpCompiler = webpack(Object.assign({}, webpackConfig, {
  devtool: inProduction ? null : 'inline-source-map'
}))

function webpackTask (callback) {
  // run webpack
  wpCompiler.run(function (err, stats) {
    if (err) throw new gutil.PluginError('webpack', err)
    gutil.log('[script]', stats.toString({
      colors: true,
      hash: false,
      version: false,
      chunks: false,
      chunkModules: false
    }))
    browserSync.reload()
    if (typeof callback === 'function') callback()
  })
}

function styleTask () {
  return gulp.src(sources.style.map(function (f) { return 'src/style/' + f }))
    .pipe(plumber())
    .pipe(gulpif(!inProduction, sourcemaps.init()))
      .pipe(stylus(stylusOpts))
      .pipe(gulpif(inProduction, csso(cssoOpts)))
    .pipe(gulpif(!inProduction, sourcemaps.write()))
    .pipe(debug({title: '[style]'}))
    .pipe(gulp.dest('build/style/'))
    .pipe(browserSync.stream())
}
function fontTask () {
  return gulp.src(fonts)
    .pipe(gulp.dest('build/style/fonts/'))
}

// Cleanup tasks
gulp.task('clean', () => del('build'))
gulp.task('clean:quick', ['clean:script', 'clean:style'], (done) => {
  done()
})
gulp.task('clean:script', () => {
  return del('build/script')
})
gulp.task('clean:font', () => {
  return del('build/style/fonts')
})
gulp.task('clean:style', () => {
  return del('build/style')
})
gulp.task('clean:icons', () => {
  return del('build/icons')
})

// Main tasks
gulp.task('script', ['clean:script'], webpackTask)
gulp.task('watch:script', () => {
  return watch(['src/script/**/*.js'], watchOpts, webpackTask)
})

gulp.task('style', ['clean:style'], (done) => {
  return sequence('font', 'build:style', done)
})
gulp.task('font', ['clean:font'], fontTask)
gulp.task('build:style', styleTask)
gulp.task('watch:style', () => {
  return watch('src/style/**/*.styl', watchOpts, styleTask)
})

gulp.task('lint', () => {
  return gulp.src(lintES)
    .pipe(standard())
    .pipe(standard.reporter('default', { breakOnError: false }))
})
gulp.task('watch:lint', () => {
  return watch(lintES, watchOpts, function (file) {
    return gulp.src(file.path)
      .pipe(standard())
      .pipe(standard.reporter('default', { breakOnError: false }))
  })
})

gulp.task('browsersync', () => {
  return browserSync.init({
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      target: config.server.host + ':' + config.server.port,
      ws: true
    },
    open: false,
    online: false,
    reloadOnRestart: true,
    ghostMode: false,
    ui: false
  })
})

// Default task
gulp.task('default', (done) => {
  sequence('script', 'style', 'lint', done)
})

// Watch task
gulp.task('watch', (done) => {
  sequence('default', ['watch:lint', 'watch:script', 'watch:style', 'browsersync'], done)
})
