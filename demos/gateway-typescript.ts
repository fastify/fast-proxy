'use strict'

import fastProxy from '..'
import restana from 'restana'

const { proxy } = fastProxy({
  base: 'http://127.0.0.1:3000'
})

const service = restana()
service.all('/service/*', (req, res) => proxy(req, res, req.url, {}))

service.start(8080)
