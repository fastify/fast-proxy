'use strict'

const fp = require('fastify-plugin')
const http = require('http')
const https = require('https')
const URL = require('url').URL
const lru = require('tiny-lru')
const querystring = require('querystring')
const Stream = require('stream')
const pump = require('pump')
const requests = {
  'http:': http,
  'https:': https
}

module.exports = fp(function from (fastify, opts, next) {
  const agents = {
    // with a colon, so that it matches url.protocol
    // and we can avoid string manipulation at runtime
    'http:': new http.Agent(agentOption(opts)),
    'https:': new https.Agent(agentOption(opts))
  }
  const cache = lru(opts.cacheURLs || 100)
  const base = opts.base

  fastify.decorateReply('from', function (dest, opts) {
    opts = opts || {}
    const req = this.request.req
    const onResponse = opts.onResponse
    const rewriteHeaders = opts.rewriteHeaders

    if (!dest) {
      dest = req.url
    }

    // we leverage caching to avoid parsing the destination URL
    const url = cache.get(dest) || new URL(dest, base)
    cache.set(dest, url)

    var headers = req.headers
    const queryString = getQueryString(url.search, req.url, opts)
    var body = ''

    if (opts.body) {
      if (typeof opts.body.pipe === 'function') {
        throw new Error('sending a new body as a stream is not supported yet')
      }

      if (opts.contentType) {
        body = opts.body
      } else {
        body = JSON.stringify(opts.body)
        opts.contentType = 'application/json'
      }

      headers = Object.assign(headers, {
        'content-length': Buffer.byteLength(body),
        'content-type': opts.contentType
      })
    } else if (this.request.body) {
      if (this.request.body instanceof Stream) {
        body = this.request.body
      } else {
        body = JSON.stringify(this.request.body)
      }
    }

    req.log.info({ dest }, 'fechting from remote server')

    const details = {
      method: req.method,
      port: url.port,
      path: url.pathname + queryString,
      hostname: url.hostname,
      headers,
      agent: agents[url.protocol]
    }

    const internal = requests[url.protocol].request(details)

    if (body instanceof Stream) {
      pump(body, internal, (err) => {
        if (err) {
          this.send(err)
        }
      })
    } else {
      internal.end(body)
    }

    internal.on('error', this.send.bind(this))
    internal.on('response', (res) => {
      req.log.info('response received')

      var headers = res.headers
      if (rewriteHeaders) {
        headers = rewriteHeaders(headers)
      }

      copyHeaders(headers, this)

      this.code(res.statusCode)

      if (onResponse) {
        onResponse(res)
      } else {
        this.send(res)
      }
    })
  })

  fastify.onClose((fastify, next) => {
    agents['http:'].destroy()
    agents['https:'].destroy()
    // let the event loop do a full run so that it can
    // actually destroy those sockets
    setImmediate(next)
  })

  next()
}, '>= 0.39.0')

function copyHeaders (headers, reply) {
  const headersKeys = Object.keys(headers)

  var i
  var header

  for (i = 0; i < headersKeys.length; i++) {
    header = headersKeys[i]
    reply.header(header, headers[header])
  }
}

function agentOption (opts) {
  return {
    keepAlive: true,
    keepAliveMsecs: opts.keepAliveMsecs || 60 * 1000, // 1 minute
    maxSockets: opts.maxSockets || 2048,
    maxFreeSockets: opts.maxFreeSockets || 2048,
    rejectUnauthorized: opts.rejectUnauthorized
  }
}

function getQueryString (search, reqUrl, opts) {
  if (search.length > 0) {
    return search
  }

  if (opts.queryString) {
    return '?' + querystring.stringify(opts.queryString)
  }

  const queryIndex = reqUrl.indexOf('?')

  if (queryIndex > 0) {
    return reqUrl.slice(queryIndex)
  }

  return ''
}
