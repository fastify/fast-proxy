'use strict'

const test = require('tap').test
const Fastify = require('fastify')
const Forward = require('.')
const http = require('http')
const get = require('simple-get').concat

test('forward a GET request', (t) => {
  t.plan(9)

  const instance = Fastify()
  instance.register(Forward)

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
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
        t.equal(res.headers['content-type'], 'text/plain')
        t.equal(res.headers['x-my-header'], 'hello!')
        t.equal(res.statusCode, 205)
        t.equal(data.toString(), 'hello world')
      })
    })
  })
})

test('forward a POST request', (t) => {
  t.plan(8)

  const instance = Fastify()
  instance.register(Forward)

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'POST')
    t.equal(req.headers['content-type'], 'application/json')
    var data = ''
    req.setEncoding('utf8')
    req.on('data', (d) => {
      data += d
    })
    req.on('end', () => {
      t.deepEqual(JSON.parse(data), { hello: 'world' })
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ something: 'else' }))
    })
  })

  instance.post('/', (request, reply) => {
    reply.forward(`http://localhost:${target.address().port}`)
  })

  t.tearDown(target.close.bind(target))

  instance.listen(0, (err) => {
    t.error(err)

    target.listen(0, (err) => {
      t.error(err)

      get({
        url: `http://localhost:${instance.server.address().port}`,
        method: 'POST',
        json: true,
        body: {
          hello: 'world'
        }
      }, (err, res, data) => {
        t.error(err)
        t.deepEqual(data, { something: 'else' })
      })
    })
  })
})
