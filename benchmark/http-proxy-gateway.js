const proxy = require('http-proxy').createProxyServer({})
const http = require('http')

const gateway = http.createServer(function (req, res) {
  proxy.web(req, res, { target: 'http://127.0.0.1:3000' })
})

gateway.listen(8080)
