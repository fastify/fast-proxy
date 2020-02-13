'use strict'

const remote = require('restana')()
remote.get('/service/hi', (req, res) => res.send('Hello World!'))
remote.start(3000)
