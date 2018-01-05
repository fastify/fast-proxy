'use strict'

const test = require('tap').test
const Fastify = require('fastify')
const Forward = require('.')
const http = require('http')
const get = require('simple-get').concat

test('forward a request', (t) => {
  t.plan(6)

  const instance = Fastify()
  instance.register(Forward)

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    res.statusCode = 205
    res.end('hello world')
  })

  instance.get('/', (request, reply) => {
    reply.forward(`http://localhost:${target.address().port}`)
  })

  t.tearDown(target.close.bind(target))

  instance.listen(0, (err) => {
    t.error(err)

    target.listen(0, (err) => {
      t.error(err)

      get(`http://localhost:${instance.server.address().port}`, (err, res, data) => {
        t.error(err)
        t.equal(res.statusCode, 205)
        t.equal(data.toString(), 'hello world')
      })
    })
  })
})
