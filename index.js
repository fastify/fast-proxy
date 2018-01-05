'use strict'

const fp = require('fastify-plugin')
const http = require('http')
const URL = require('url').URL

module.exports = fp(function (fastify, opts, next) {
  const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: opts.keepAliveMsecs || 60 * 1000, // 1 minute
    maxSockets: opts.maxSockets || 2048,
    maxFreeSockets: opts.maxFreeSockets || 2048
  })

  fastify.decorateReply('forward', function (dest) {
    const url = new URL(dest)
    url.method = 'GET'
    url.agent = agent
    const internal = http.request(url)
    internal.end() // TODO support posts

    internal.on('error', (err) => {
      this.send(err)
    })
    internal.on('response', (res) => {
      this
        .code(res.statusCode)
        .send(res)
    })
    internal.on('headers', function (headers) {
      // TODO
    })
  })

  next()
}, '>= 0.37.0')
