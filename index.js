'use strict'

const URL = require('url').URL
const pump = require('pump')
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
    ...opts
  })

  const cache = lru(opts.cacheURLs || 100)
  const base = opts.base

  return {
    close,
    proxy (req, res, source, opts) {
      opts = opts || {}
      const reqOpts = opts.request || {}
      const onResponse = opts.onResponse
      const rewriteHeaders = opts.rewriteHeaders || headersNoOp
      const rewriteRequestHeaders = opts.rewriteRequestHeaders || requestHeadersNoOp

      if (!source) {
        source = req.url
      }

      // we leverage caching to avoid parsing the destination URL
      const reqBase = opts.base || base
      const cacheKey = reqBase + source
      let url = cache.get(cacheKey)
      if (!url) {
        url = new URL(source, reqBase)
        cache.set(cacheKey, url)
      }

      const sourceHttp2 = req.httpVersionMajor === 2
      const headers = { ...sourceHttp2 ? filterPseudoHeaders(req.headers) : req.headers }
      headers['x-forwarded-host'] = req.headers.host
      headers.host = `${url.hostname}:${url.port}`

      const qs = getQueryString(url.search, req.url, opts)

      let body = ''

      // according to https://tools.ietf.org/html/rfc2616#section-4.3
      // proxy should ignore message body when it's a GET or HEAD request
      // when proxy this request, we should reset the content-length to make it a valid http request
      if (req.method === 'GET' || req.method === 'HEAD') {
        headers['content-length'] = 0
      } else {
        if (req.body) {
          if (req.body instanceof Stream) {
            body = req.body
          } else {
            // Per RFC 7231 §3.1.1.5 if this header is not present we MAY assume application/octet-stream
            const contentType = req.headers['content-type'] || 'application/octet-stream'
            // detect if body should be encoded as JSON
            // supporting extended content-type header formats:
            // - https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
            const shouldEncodeJSON = contentType.toLowerCase().indexOf('application/json') === 0
            // transparently support JSON encoding
            body = shouldEncodeJSON ? JSON.stringify(req.body) : req.body
            // update origin request headers after encoding
            headers['content-length'] = Buffer.byteLength(body)
            headers['content-type'] = contentType
          }
        } else {
          body = req
        }
      }

      const requestHeaders = rewriteRequestHeaders(req, headers)

      request({ method: req.method, url, qs, headers: requestHeaders, body, request: reqOpts }, (err, response) => {
        if (err) {
          if (!res.sent) {
            if (err.code === 'ECONNREFUSED' || err.code === 'ERR_HTTP2_STREAM_CANCEL') {
              res.statusCode = 503
              res.end('Service Unavailable')
            } else if (err.code === 'ECONNRESET') {
              res.statusCode = 504
              res.end(err.message)
            } else {
              res.statusCode = 500
              res.end(err.message)
            }
          }

          return
        }

        // destructing response from remote
        const { headers, statusCode, stream } = response

        if (sourceHttp2) {
          copyHeaders(
            rewriteHeaders(stripHttp1ConnectionHeaders(headers)),
            res
          )
        } else {
          copyHeaders(rewriteHeaders(headers), res)
        }

        if (onResponse) {
          onResponse(req, res, stream)
        } else {
          res.statusCode = statusCode
          pump(stream, res)
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

function requestHeadersNoOp (originalReq, headers) {
  return headers
}
