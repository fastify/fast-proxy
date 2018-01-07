'use strict'

const fp = require('fastify-plugin')
const http = require('http')
const URL = require('url').URL

// TODO add a URL object cache

module.exports = fp(function (fastify, opts, next) {
  const agent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: opts.keepAliveMsecs || 60 * 1000, // 1 minute
    maxSockets: opts.maxSockets || 2048,
    maxFreeSockets: opts.maxFreeSockets || 2048
  })

  fastify.decorateReply('forward', function (dest) {
    const req = this.request.req
    const url = new URL(dest)
    const opts = {
      method: req.method,
      port: url.port,
      hostname: url.hostname,
      headers: req.headers,
      agent: agent
    }

    // TODO support HTTPS
    const internal = http.request(opts)

    // TODO support different content-types
    internal.end(JSON.stringify(this.request.body))

    // TODO what about trailers?
    internal.on('error', (err) => {
      this.send(err)
    })
    internal.on('response', (res) => {
      copyHeaders(res, this)

      this
        .code(res.statusCode)
        .send(res)
    })
  })

  fastify.onClose((fastify, next) => {
    agent.destroy()
    // let the event loop do a full run so that it can
    // actually destroy those sockets
    setImmediate(next)
  })

  next()
}, '>= 0.37.0')

function copyHeaders (res, reply) {
  const headers = res.headers
  const headersKeys = Object.keys(headers)

  var i
  var header

  for (i = 0; i < headersKeys.length; i++) {
    header = headersKeys[i]
    reply.header(header, headers[header])
  }
}
