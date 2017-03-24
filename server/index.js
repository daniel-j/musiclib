const fs = require('fs')
const path = require('path')
const app = require('./app')
const config = require('../scripts/config')
const objection = require('./db').objection

const Router = require('koa-router')
const send = require('koa-send')
const busboy = require('async-busboy')
const mv = require('mv')
const pify = require('pify')
const checksum = require('checksum')
const mediainfo = require('./mediainfo')
const id3genre = require('id3-genre')
const child_process = require('child_process')
const writeFile = require('./utils').writeFile

// recursively list files in a directory
async function walk (dir, options = {}) {
  let results = []
  let list = await pify(fs.readdir)(dir)
  for (let i = 0; i < list.length; i++) {
    let basename = list[i]
    if (basename.startsWith('.')) continue
    let file = path.join(dir, basename)
    let stat = await pify(fs.stat)(file)
    if (stat && stat.isDirectory()) {
      let res = await walk(file, options)
      results = results.concat(res)
    } else {
      if (options.handle) {
        let ret = await options.handle(file, basename)
        if (!ret) {
          console.log('ignored: ' + file)
        } else {
          results.push(ret)
        }
      } else {
        results.push(file)
      }
    }
  }
  return results
}

async function addTrack (fullname, file, basename) {
  let info = await mediainfo(fullname)
  if (!info || !info[0]) {
    return false
  }
  let hash = await pify(checksum.file)(fullname)
  info = info[0]
  let stat = await pify(fs.stat)(fullname)

  genre = info.genre
  if (genre) {
    let m = genre.match(/^Genre_(\d*)$/)
    if (m) {
      genre = id3genre(parseInt(m[1], 10))
    }
  }

  let coverName = null
  if (info.cover_data) {
    let coverData = Buffer.from(info.cover_data, 'base64')
    let coverHash = checksum(coverData)
    coverName = 'cover_' + coverHash
    let coverPath = path.join(config.general.cachedir, coverName)
    let exists = false
    try {
      await pify(fs.access)(coverPath)
      exists = true
    } catch (err) {}
    if (!exists) {
      console.log('Saving cover', coverPath)
      await writeFile(coverPath, coverData)
    }
  }

  await Track.query().insert({
    file,
    checksum: hash,
    last_modified: Math.floor(stat.mtime.getTime() / 1000),
    title: info.title || info.track || null,
    artist: info.performer || null,
    album: info.album || null,
    albumartist: info.album_performer || null,
    composer: info.composer || null,
    original_artist: info.original_performer || null,
    duration: Math.ceil(info.duration / 1000) || null,
    year: parseInt(info.recorded_date, 10) || null,
    url: info.url || null,
    comment: info.comment || null,
    copyright: info.copyright || null,
    track: parseInt(info.track_position, 10) || null,
    track_total: parseInt(info.track_position_total, 10) || null,
    disc: parseInt(info.part_position, 10) || null,
    genre: genre || null,
    bpm: parseInt(info.bpm, 10) || null,
    bitrate: Math.round(info.overallbitrate / 1000) || null,
    format: info.format,
    cover_mime: info.cover_mime || null,
    cover_name: coverName
  })

  return true
}

class Track extends objection.Model {
  static get tableName () {
    return 'tracks'
  }
  $beforeInsert () {
    this.time_added = Math.floor(Date.now() / 1000)
  }
  $beforeUpdate () {
    this.time_updated = Math.floor(Date.now() / 1000)
    delete this.time_added
  }
  $afterGet () {
    this.time_added = new Date(this.time_added * 1000)
    this.time_updated = this.time_updated ? new Date(this.time_updated * 1000) : null
    this.last_modified = new Date(this.last_modified * 1000)
  }
}

config.general.musicdir = path.resolve(config.general.musicdir)
let prefixLen = config.general.musicdir.length + 1
let extensions = config.general.extensions

walk(config.general.musicdir, {
  handle: async (fullname, basename) => {
    let ext = path.extname(basename).substring(1).toLowerCase()
    if (!extensions.includes(ext)) return false

    let file = fullname.substring(prefixLen)
    let [track] = await Track.query().where('file', file)
    if (!track) {
      await addTrack(fullname, file, basename)
    } else if (track.deleted) { // track was deleted but is now back
      await Track.query().patch({deleted: 0}).where('file', file)
    } else {

    }
    return file
  }
})
.then(async (files) => {
  // mark files not found as deleted
  await Track.query().patch({deleted: 1}).whereNotIn('file', files)
  console.log('scan complete')
})
.catch((err) => {
  console.error('walk failed: ', err)
})

class Upload extends objection.Model {
  static get tableName () {
    return 'upload'
  }
  $beforeInsert () {
    this.time_uploaded = Math.floor(Date.now() / 1000)
  }
}

async function handleFile (file) {
  let filepath = path.join(config.general.uploaddir, file.filename)
  console.log(filepath)
  await pify(mv)(file.path, filepath, {mkdirp: true, clobber: false})
  let hash = await pify(checksum.file)(filepath)
  await Upload.query().insert({
    file: file.filename,
    checksum: hash
  })
}

let router = Router({prefix: '/api'})

router.post('/upload', async (ctx, next) => {
  const {files, fields} = await busboy(ctx.req)
  for (let file of files) {
    if (!file.filename) continue
    try {
      await handleFile(file)
    } catch (err) {
      console.error(err + '')
      try {
        await pify(fs.unlink)(file.path)
      } catch (err) {}
    }
  }
  console.log(fields)
  ctx.body = 'hello'
})

router.get('/tracks', async (ctx, next) => {
  let tracks = await Track.query().select('rowid', 'file', 'title', 'artist', 'time_added').where('deleted', 0)
  ctx.body = tracks
})
router.get('/track/:id', async (ctx, next) => {
  let tracks = await Track.query().where('rowid', ctx.params.id)
  let track = tracks[0]
  if (!track) {
    ctx.status = 404
    return
  }
  ctx.body = track
})
router.get('/track/:id/download', async (ctx, next) => {
  let tracks = await Track.query().select('file').where('rowid', ctx.params.id)
  if (!tracks || !tracks[0]) {
    ctx.status = 404
    ctx.body = 'not found'
    return
  }
  let file = tracks[0].file
  ctx.attachment(path.basename(file))
  await send(ctx, file, {root: path.resolve(config.general.musicdir)})
})
router.get('/track/:id/cover', async (ctx, next) => {
  let tracks = await Track.query().select('cover_mime', 'cover_name').where('rowid', ctx.params.id).whereNotNull('cover_name')
  if (!tracks || !tracks[0]) {
    ctx.status = 404
    ctx.body = 'not found'
    return
  }
  let track = tracks[0]
  let coverPath = path.resolve(config.general.cachedir, track.cover_name)
  let stat = await pify(fs.stat)(coverPath)
  ctx.length = stat.size
  ctx.lastModified = stat.mtime
  ctx.body = fs.createReadStream(coverPath)
  ctx.type = track.cover_mime
})

app.use(router.routes())

app.use(async (ctx) => {
  if (!ctx.accepts('text/html')) return
  await send(ctx, 'index.html', {root: path.join(__dirname, '../static')})
})

app.listen(config.server.port)
