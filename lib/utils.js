'use strict'

function filterPseudoHeaders (headers) {
  const dest = {}
  const headersKeys = Object.keys(headers)

  if (headers[':authority']) {
    // see: https://nodejs.org/api/http2.html#http2_note_on_authority_and_host
    dest.host = headers[':authority']
  }

  let header
  let i
  for (i = 0; i < headersKeys.length; i++) {
    header = headersKeys[i]
    if (header.charCodeAt(0) !== 58) { // fast path for indexOf(':') === 0
      dest[header.toLowerCase()] = headers[header]
    }
  }

  return dest
}

function copyHeaders (headers, res) {
  const headersKeys = Object.keys(headers)

  let header
  let i
  for (i = 0; i < headersKeys.length; i++) {
    header = headersKeys[i]
    if (header.charCodeAt(0) !== 58) { // fast path for indexOf(':') === 0
      res.setHeader(header, headers[header])
    }
  }
}

function stripHttp1ConnectionHeaders (headers) {
  const headersKeys = Object.keys(headers)
  const dest = {}

  let header
  let i
  for (i = 0; i < headersKeys.length; i++) {
    header = headersKeys[i].toLowerCase()

    switch (header) {
      case 'connection':
      case 'upgrade':
      case 'http2-settings':
      case 'te':
      case 'transfer-encoding':
      case 'proxy-connection':
      case 'keep-alive':
      case 'host':
        break
      default:
        dest[header] = headers[header]
        break
    }
  }
  return dest
}

function filterHeaders (headers, filter) {
  const headersKeys = Object.keys(headers)
  const dest = {}

  let header
  let i
  for (i = 0; i < headersKeys.length; i++) {
    header = headersKeys[i].toLowerCase()
    if (header !== filter) {
      dest[header] = headers[header]
    }
  }
  return dest
}

/**
 * Sanitize and build a URL object from a source URL string.
 *
 * For security reasons, schemeless source URLs are sanitized. Any additional
 * leading slashes will be stripped and replaced with a single leading slash.
 * {@link https://github.com/fastify/fast-proxy/issues/42}. This operation is
 * performed without the use of regular expressions to optimize performance.
 *
 * @param {string=} source The absolute or relative input URL to parse.
 * @param {string|undefined} reqBase The base URL to resolve against if the input is not absolute
 * @returns {module:url.URL}
 */
function buildURL (source = '', reqBase) {
  let i = 0
  while (source[i] === '/') {
    i++
  }
  const cleanSource = i > 0 ? '/' + source.substring(i) : source

  return new URL(cleanSource, reqBase)
}

module.exports = {
  copyHeaders,
  stripHttp1ConnectionHeaders,
  filterPseudoHeaders,
  filterHeaders,
  buildURL
}
