
const m = require('mithril')
const app = require('./app')

const Layout = {
  view (vnode) {
    return m('.layout', 'Layout!', vnode.children)
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

    return [
      m('h2', 'Track'),
      m('audio', {src: '/api/track/' + attrs.id + '/stream', controls: true, style: {width: '600px'}}),
      m('img', {src: '/api/track/' + attrs.id + '/art', width: 200, align: 'left'}),
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

const render = (vnode) => m(Layout, vnode)

m.route(document.getElementById('app'), '/404', {
  '/': {
    render: () => render(m(IndexPage))
  },
  '/track/:id': {
    onmatch (attrs) {
      return m.request('/api/track/' + attrs.id).then((track) => {
        attrs.track = track
        return TrackPage
      }).catch(() => NotFoundPage)
    },
    render
  },
  '/tracks': {
    onmatch (attrs) {
      return m.request('/api/tracks').then((tracks) => {
        attrs.tracks = tracks
        return TracksPage
      }).catch(() => NotFoundPage)
    },
    render
  },
  '/:path...': {
    render: () => render(m(NotFoundPage))
  }
})
