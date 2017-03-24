
const m = require('mithril')
const app = require('./app')

const Layout = {
  view (vnode) {
    return m('#layout', [
      // m(nav),
      m('#content', vnode.children),
      // m(player)
    ])
  }
}

const IndexPage = {
  view () {
    return m('h1', 'Index')
  }
}

const TrackPage = {
  view ({attrs}) {
    let track = attrs.track
    let trackInfo = null
    if (track) {
      trackInfo = []
      for (let key in track) {
        trackInfo.push(m('tr', m('td', {align: 'right'}, key), m('td', track[key])))
      }
      trackInfo = m('table', {border: 1}, trackInfo)
    }

    let coverPath = '/api/track/' + attrs.id + '/cover'

    return [
      m('h2', 'Track'),
      m('audio', {src: '/api/track/' + attrs.id + '/download', controls: true, preload: 'none', style: {width: '600px'}}),
      m('a', {href: coverPath, target: '_blank'}, m('img', {src: coverPath, width: 200, align: 'left'})),
      trackInfo
    ]
  }
}

const TracksPage = {
  view ({attrs}) {
    let tracks = attrs.tracks
    return [
      m('h2', 'Tracks'),
      m('table', tracks.map((track) => {
        return m('tr',
          m('td', track.title),
          m('td', track.artist),
          m('td', m('a', {href: '/track/' + track.rowid, oncreate: m.route.link}, track.file)),
          m('td', track.time_added)
        )
      }))
    ]
  }
}

const NotFoundPage = {
  view ({attrs}) {
    return [
      m('h1', '404 Not found'),
      m('code', m.route.get())
    ]
  }
}

m.route.prefix('')

function transformRoutes (routes) {
  for (let key in routes) {
    let route = routes[key]
    routes[key] = {
      onmatch: (attrs) => Promise.resolve(
        typeof route === 'function' ? route(attrs) : route
      ).catch(() => m(NotFoundPage)),
      render: (vnode) => m(Layout, vnode)
    }
  }
  return routes
}

m.route(document.getElementById('app'), '/404', transformRoutes({
  '/': IndexPage,
  '/track/:id': (attrs) => {
    return m.request('/api/track/' + attrs.id).then((track) => {
      attrs.track = track
      return TrackPage
    })
  },
  '/tracks': (attrs) => {
    return m.request('/api/tracks').then((tracks) => {
      attrs.tracks = tracks
      return TracksPage
    })
  },
  '/:path...': NotFoundPage
}))
