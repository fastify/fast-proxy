'use strict'

const URL = require('url').URL
const toArray = require('stream-to-array')
const lru = require('tiny-lru')
const querystring = require('querystring')
const Stream = require('stream')
const buildRequest = require('./lib/request')
const {
  filterPseudoHeaders,
  copyHeaders,
  stripHttp1ConnectionHeaders
} = require('./lib/utils')

module.exports = (opts) => {
  const { request, close } = buildRequest({
    http2: !!opts.http2,
    base: opts.base,
    keepAliveMsecs: opts.keepAliveMsecs,
    maxFreeSockets: opts.maxFreeSockets,
    maxSockets: opts.maxSockets,
    rejectUnauthorized: opts.rejectUnauthorized
  })

  const cache = lru(opts.cacheURLs || 100)
  const base = opts.base

  return {
    close,
    proxy (req, res, source, opts) {
      opts = opts || {}
      const onResponse = opts.onResponse
      const rewriteHeaders = opts.rewriteHeaders || headersNoOp

      if (!source) {
        source = req.url
      }

      // we leverage caching to avoid parsing the destination URL
      let url = cache.get(source)
      if (!url) {
        url = new URL(source, base)
        cache.set(source, url)
      }

      const sourceHttp2 = req.httpVersionMajor === 2
      const headers = sourceHttp2 ? filterPseudoHeaders(req.headers) : req.headers
      headers.host = url.hostname
      const qs = getQueryString(url.search, req.url, opts)
      let body = ''

      if (req.body) {
        if (req.body instanceof Stream) {
          body = req.body
        } else {
          body = JSON.stringify(req.body)
          headers['content-length'] = Buffer.byteLength(body)
          headers['content-type'] = 'application/json'
        }
      }

      // according to https://tools.ietf.org/html/rfc2616#section-4.3
      // fastify ignore message body when it's a GET or HEAD request
      // when proxy this request, we should reset the content-length to make it a valid http request
      if (req.method === 'GET' || req.method === 'HEAD') {
        // body will be populated here only if opts.body is passed.
        // if we are doing that with a GET or HEAD request is a programmer error
        // and as such we can throw immediately.
        if (body) {
          throw new Error('Rewriting the body when doing a GET is not allowed')
        }
        headers['content-length'] = 0
      }

      request({ method: req.method, url, qs, headers, body }, async (err, { headers, statusCode, stream }) => {
        if (err) {
          if (!res.sent) {
            if (err.code === 'ERR_HTTP2_STREAM_CANCEL') {
              res.statusCode = 503
              res.end('Service Unavailable')
            } else {
              res.statusCode = 500
              res.end(err.message)
            }
          }
          return
        }

        // convert response stream to buffer
        const buffer = Buffer.concat(await toArray(stream))

        if (sourceHttp2) {
          copyHeaders(
            rewriteHeaders(stripHttp1ConnectionHeaders(headers)),
            res
          )
        } else {
          copyHeaders(rewriteHeaders(headers), res)
        }

        if (onResponse) {
          onResponse(req, res, buffer)
        } else {
          res.statusCode = statusCode
          res.end(buffer)
        }
      })
    }
  }
}

function getQueryString (search, reqUrl, opts) {
  if (opts.queryString) {
    return '?' + querystring.stringify(opts.queryString)
  }

  if (search.length > 0) {
    return search
  }

  const queryIndex = reqUrl.indexOf('?')

  if (queryIndex > 0) {
    return reqUrl.slice(queryIndex)
  }

  return ''
}

function headersNoOp (headers) {
  return headers
}
