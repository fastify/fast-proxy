const bodyParser = require('body-parser')
const { proxy } = require('../index')({})

const service = require('restana')()
service.use(bodyParser.json())
service.use(bodyParser.text())

service.all('/service/*', function (req, res) {
  proxy(req, res, 'http://127.0.0.1:3000' + req.url, {})
})
service.start(8080)
