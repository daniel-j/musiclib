const Knex = require('knex')
const objection = require('objection')
const knexconfig = require('../knexfile')

const knex = Knex(knexconfig)
objection.Model.knex(knex)

module.exports = { objection, knex }
