'use strict'

const bodyParser = require('body-parser')

const service = require('restana')()
service.use(bodyParser.json())

service.get('/service/get', (req, res) => res.send('Hello World!'))

service.post('/service/post', (req, res) => res.send(req.body))

service.start(3000)
