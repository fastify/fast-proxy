'use strict'

const t = require('tap')
const Fastify = require('fastify')
const From = require('..')
const get = require('simple-get').concat

const instance = Fastify()

t.plan(9)
t.tearDown(instance.close.bind(instance))

instance.get('*', (request, reply) => {
  reply.from()
})

instance.register(From, {
  base: 'http://httpbin.org/ip'
})

instance.listen(0, (err) => {
  t.error(err)

  get(`http://localhost:${instance.server.address().port}`, (err, res, data) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictEqual(typeof JSON.parse(data).origin, 'string')
  })

  get(`http://localhost:${instance.server.address().port}/ip`, (err, res, data) => {
    t.error(err)
    t.strictEqual(res.statusCode, 200)
    t.strictEqual(res.headers['content-type'], 'application/json')
    t.strictEqual(typeof JSON.parse(data).origin, 'string')
  })
})
