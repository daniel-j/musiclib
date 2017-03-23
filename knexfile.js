const path = require('path')
const config = require(path.join(__dirname, 'scripts/config'))

const client = config.server.datastore
const connection = config[client]
client.charset = 'utf8'

module.exports = {
  client,
  connection,
  debug: false,
  useNullAsDefault: client === 'sqlite'
}
