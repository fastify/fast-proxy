'use strict'

const semver = require('semver')
const http = require('http')
const https = require('https')
const eos = require('end-of-stream')
const pump = require('pump')
const { stripHttp1ConnectionHeaders } = require('./utils')

function buildRequest (opts) {
  const isHttp2 = !!opts.http2
  const requests = {
    'http:': http,
    'https:': https
  }
  const baseUrl = opts.base
  const rejectUnauthorized = opts.rejectUnauthorized
  let http2Client
  let agents
  let http2

  if (isHttp2) {
    if (semver.lt(process.version, '9.0.0')) {
      throw new Error('Http2 support requires Node version >= 9.0.0')
    }
    if (!opts.base) throw new Error('Option base is required when http2 is true')
  } else {
    agents = {
      'http:': new http.Agent(agentOption(opts)),
      'https:': new https.Agent(agentOption(opts))
    }
  }

  if (isHttp2) {
    http2 = getHttp2()
    return { request: handleHttp2Req, close }
  } else {
    return { request: handleHttp1Req, close }
  }

  function close () {
    if (!isHttp2) {
      agents['http:'].destroy()
      agents['https:'].destroy()
    } else if (http2Client) {
      http2Client.destroy()
    }
  }

  function handleHttp1Req (opts, done) {
    const req = requests[opts.url.protocol].request({
      method: opts.method,
      port: opts.url.port,
      path: opts.url.pathname + opts.qs,
      hostname: opts.url.hostname,
      headers: opts.headers,
      agent: agents[opts.url.protocol]
    })
    req.on('error', done)
    req.on('response', res => {
      setImmediate(() => done(null, { statusCode: res.statusCode, headers: res.headers, stream: res }))
    })
    end(req, opts.body, done)
  }

  function handleHttp2Req (opts, done) {
    if (!http2Client || http2Client.destroyed) {
      http2Client = http2.connect(baseUrl, { rejectUnauthorized })
      http2Client.once('error', done)
      // we might enqueue a large number of requests in this connection
      // before it's connected
      http2Client.setMaxListeners(0)
      http2Client.on('connect', () => {
        // reset the max listener to 10 on connect
        http2Client.setMaxListeners(10)
        http2Client.removeListener('error', done)
      })
    }
    const req = http2Client.request({
      ':method': opts.method,
      ':path': opts.url.pathname + opts.qs,
      ...stripHttp1ConnectionHeaders(opts.headers)
    })
    const isGet = opts.method === 'GET' || opts.method === 'get'
    if (!isGet) {
      end(req, opts.body, done)
    }
    eos(req, err => {
      if (err) done(err)
    })
    req.on('response', headers => {
      setImmediate(() => {
        const statusCode = headers[':status']
        done(null, { statusCode, headers, stream: req })
      })
    })
  }
}

module.exports = buildRequest

function agentOption (opts) {
  return {
    keepAlive: true,
    keepAliveMsecs: opts.keepAliveMsecs || 60 * 1000, // 1 minute
    maxSockets: opts.maxSockets || 2048,
    maxFreeSockets: opts.maxFreeSockets || 2048,
    rejectUnauthorized: opts.rejectUnauthorized
  }
}

function end (req, body, cb) {
  if (!body || typeof body === 'string') {
    req.end(body)
  } else {
    pump(body, req, err => {
      if (err) cb(err)
    })
  }
}

// neede to avoid the experimental warning
function getHttp2 () {
  return require('http2')
}
