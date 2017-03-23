const path = require('path')
const Koa = require('koa')
const logger = require('koa-logger')
const range = require('koa-range')
const serve = require('koa-static')
const mount = require('koa-mount')

const app = new Koa()

app.use(logger())
app.use(range)

app.use(mount('/build', serve(path.join(__dirname, '../build'))))
app.use(serve(path.join(__dirname, '../static')))

module.exports = app
