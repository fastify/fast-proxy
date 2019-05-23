const { proxy } = require('../index')({})
const cero = require('0http')
const {
  router,
  server
} = cero()

router.on(['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'], '/service/*', (req, res) => {
  proxy(req, res, 'http://127.0.0.1:3000' + req.url, {})
})

server.listen(8080)
