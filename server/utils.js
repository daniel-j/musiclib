
const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')

// Writes a file. Creates directory if it does not exist. Accepts buffers only
module.exports.writeFile = function (file, buffer) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, buffer, (err) => {
      if (err) {
        return mkdirp(path.dirname(file), (err) => {
          if (err) return reject(err)
          fs.writeFile(file, buffer, (err) => {
            if (err) return reject(err)
            resolve()
          })
        })
      }
      resolve()
    })
  })
}
