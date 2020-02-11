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

function populateHeaders (headers, body, contentType) {
  headers['content-length'] = Buffer.byteLength(body)

  // only populate content-type if not present
  if (!headers['content-type']) {
    headers['content-type'] = contentType
  }
}

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
      const headers = { ...sourceHttp2 ? filterPseudoHeaders(req.headers) : req.headers }
      headers['x-forwarded-host'] = req.headers.host
      headers.host = `${url.hostname}:${url.port}`

      const qs = getQueryString(url.search, req.url, opts)

      let body = null
      // according to https://tools.ietf.org/html/rfc2616#section-4.3
      // proxy should ignore message body when it's a GET or HEAD request
      // when proxy this request, we should reset the content-length to make it a valid http request
      if (req.method === 'GET' || req.method === 'HEAD') {
        headers['content-length'] = 0
      } else {
        if (req.body) {
          if (req.body instanceof Stream) {
            body = req.body
          } else if (typeof req.body === 'string') {
            body = req.body
            populateHeaders(headers, body, 'text/plain')
          } else {
            body = JSON.stringify(req.body)
            populateHeaders(headers, body, 'application/json')
          }
        } else {
          body = req
        }
      }

      request({ method: req.method, url, qs, headers, body, request: reqOpts }, async (err, response) => {
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
