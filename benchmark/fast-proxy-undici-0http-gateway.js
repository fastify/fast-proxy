'use strict'

const { proxy } = require('../index')({
  base: 'http://127.0.0.1:3000',
  undici: {
    pipelining: 1
  }
})
const cero = require('0http')
const {
  router,
  server
} = cero()

router.on(['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'], '/service/*', (req, res) => {
  proxy(req, res, req.url, {})
})

server.listen(8080)
