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
const mediainfo = require('mediainfoq')
const child_process = require('child_process')
const base64 = require('base64-stream')

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
  let info = await mediainfo('--Language=raw', fullname)
  if (!info || !info[0]) {
    return false
  }
  let hash = await pify(checksum.file)(fullname)
  info = info[0]
  let duration = null
  if (info.duration_string) {
    let d = info.duration_string.match(/^(?:(\d*) ?h)?\s?(?:(\d*) ?mi?n)?\s?(?:(\d*) ?s)?\s?(?:(\d*) ?ms)?$/)
    if (d) {
      let dur = Math.round((d[1] || 0) * 60 * 60 + (d[2] || 0) * 60 + (d[3] || 0) * 1 + (d[4] || 0) * 0.001)
      if (dur > 0) {
        duration = dur
      }
    }
  }

  await Track.query().insert({
    file,
    checksum: hash,
    title: info.track || null,
    artist: info.performer || null,
    album: info.album || null,
    albumartist: info.album_performer || null,
    bitrate: info.overallbitrate_string ? parseInt(info.overallbitrate_string.replace(/\s/g, ''), 10) : null,
    duration,
    position: parseInt(info.track_position, 10) || null,
    year: parseInt(info.recorded_date, 10) || null,
    genre: info.genre || null,
    comment: info.comment || null,
    has_artwork: info.cover === 'Yes',
    format: info.format,
    bpm: info.bpm || null
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
  }
  $afterGet () {
    this.time_added = new Date(this.time_added * 1000)
    this.time_updated = this.time_updated ? new Date(this.time_updated * 1000) : null
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
    } else if (track.deleted) {
      await Track.query().patch({deleted: 0}).where('file', file)
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
    ctx.body = 'not found'
    return
  }
  let file = tracks[0].file
  ctx.attachment(path.basename(file))
  await send(ctx, file, {root: path.resolve(config.general.musicdir)})
})
router.get('/track/:id/stream', async (ctx, next) => {
  let tracks = await Track.query().select('file').where('rowid', ctx.params.id)
  console.log(ctx.params)
  if (!tracks || !tracks[0]) {
    ctx.body = 'not found'
    return
  }
  let file = tracks[0].file
  let fullname = path.resolve(config.general.musicdir, file)
  let stat = await pify(fs.stat)(fullname)
  ctx.attachment(path.basename(file))
  ctx.length = stat.size
  ctx.lastModified = stat.mtime
  ctx.body = fs.createReadStream(fullname)
})
router.get('/track/:id/art', async (ctx, next) => {
  let tracks = await Track.query().select('file').where('rowid', ctx.params.id).andWhere('has_artwork', 1)
  if (!tracks || !tracks[0]) {
    ctx.body = 'not found'
    return
  }
  let file = tracks[0].file
  let fullname = path.resolve(config.general.musicdir, file)
  let mime = await pify(child_process.execFile)('mediainfo', ['--Output=General;%Cover_Mime%', fullname])
  let mi = child_process.spawn('mediainfo', ['--Output=General;%Cover_Data%', fullname])
  ctx.type = mime.trim()
  ctx.body = mi.stdout.pipe(base64.decode())
})

app.use(router.routes())

app.use(async (ctx) => {
  await send(ctx, 'index.html', {root: path.join(__dirname, '../static')})
})

app.listen(config.server.port)
