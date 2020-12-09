'use strict'

const { proxy } = require('../index')({
  base: 'http://127.0.0.1:3000',
  undici: {
    connections: 100,
    pipelining: 10
  }
})

const service = require('restana')()
service.all('/service/*', (req, res) => proxy(req, res, req.url, {
  rewriteRequestHeaders (req, headers) {
    delete headers.connection

    return headers
  }
}))

service.start(8080)
