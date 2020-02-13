'use strict'

const { proxy } = require('../index')({
  base: 'http://127.0.0.1:3000'
})

const service = require('restana')()
service.all('/service/*', (req, res) => proxy(req, res, req.url, {}))

service.start(8080)
