'use strict'

const semver = require('semver')
const http = require('http')
const https = require('https')
const eos = require('end-of-stream')
const pump = require('pump')
const { stripHttp1ConnectionHeaders } = require('./utils')
const undici = require('undici')

function buildRequest (opts) {
  const isHttp2 = !!opts.http2
  const isUndici = !!opts.undici
  const requests = {
    'http:': opts.requests && opts.requests.http ? opts.requests.http : http,
    'https:': opts.requests && opts.requests.https ? opts.requests.https : https
  }
  const baseUrl = opts.base
  const rejectUnauthorized = opts.rejectUnauthorized
  let h2client
  let agents
  let http2
  let pool

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
  } else if (isUndici) {
    if (typeof opts.undici !== 'object') {
      opts.undici = {}
    }
    pool = new undici.Pool(baseUrl, opts.undici)

    return { request: handleUndici, close }
  } else {
    return { request: handleHttp1Req, close }
  }

  function close () {
    if (isUndici) {
      pool.destroy()
    } else if (!isHttp2) {
      agents['http:'].destroy()
      agents['https:'].destroy()
    } else if (h2client) {
      h2client.destroy()
    }
  }

  function handleUndici (opts, done) {
    const req = {
      path: opts.url.pathname + opts.qs,
      method: opts.method,
      headers: opts.headers,
      body: opts.body
    }

    pool.request(req, function (err, res) {
      if (err) {
        done(err)
      } else {
        setImmediate(() => done(null, { statusCode: res.statusCode, headers: res.headers, stream: res.body }))
      }
    })
  }

  function handleHttp1Req (opts, done) {
    const req = requests[opts.url.protocol].request({
      ...opts.request,
      method: opts.method,
      port: opts.url.port,
      path: opts.url.pathname + opts.qs,
      hostname: opts.url.hostname,
      headers: opts.headers,
      agent: agents[opts.url.protocol]
    })
    req.on('error', done)
    req.on('timeout', () => req.abort())
    req.on('response', res => {
      setImmediate(() => done(null, { statusCode: res.statusCode, headers: res.headers, stream: res }))
    })
    end(req, opts.body, done)
  }

  function handleHttp2Req (opts, done) {
    if (!h2client || h2client.destroyed) {
      h2client = http2.connect(baseUrl, { rejectUnauthorized })
      h2client.once('error', done)
      // we might enqueue a large number of requests in this connection
      // before it's connected
      h2client.setMaxListeners(0)
      h2client.on('connect', () => {
        // reset the max listener to 10 on connect
        h2client.setMaxListeners(10)
        h2client.removeListener('error', done)
      })
    }

    const req = h2client.request({
      ':method': opts.method,
      ':path': opts.url.pathname + opts.qs,
      ...stripHttp1ConnectionHeaders(opts.headers)
    })
    if (opts.request && opts.request.timeout) {
      req.setTimeout(opts.request.timeout)
    }

    const isGet = opts.method === 'GET' || opts.method === 'get'
    if (!isGet) {
      end(req, opts.body, done)
    }
    eos(req, err => {
      if (err) done(err)
    })
    req.on('timeout', () => {
      const err = new Error('socket hang up')
      err.code = 'ECONNRESET'

      req.destroy(err)
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
    keepAliveMsecs: 60 * 1000, // 1 minute
    maxSockets: 2048,
    maxFreeSockets: 2048,
    ...opts
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
