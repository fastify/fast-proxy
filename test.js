'use strict'

const test = require('tap').test
const Fastify = require('fastify')
const From = require('.')
const http = require('http')
const get = require('simple-get').concat
const fs = require('fs')
const path = require('path')
const https = require('https')
const Transform = require('stream').Transform
const certs = {
  key: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.key')),
  cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'fastify.cert'))
}

test('from a GET request', (t) => {
  t.plan(10)

  const instance = Fastify()
  instance.register(From)

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/hello')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/', (request, reply) => {
    reply.from(`http://localhost:${target.address().port}/hello`)
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

test('from a POST request', (t) => {
  t.plan(8)

  const instance = Fastify()
  instance.register(From, {
    rejectUnauthorized: false
  })

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
    reply.from(`http://localhost:${target.address().port}`)
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

test('from a GET request over HTTPS', (t) => {
  t.plan(9)

  const instance = Fastify({
    https: certs
  })
  instance.register(From)

  t.tearDown(instance.close.bind(instance))

  const target = https.createServer(certs, (req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/', (request, reply) => {
    reply.from(`https://localhost:${target.address().port}`)
  })

  t.tearDown(target.close.bind(target))

  instance.listen(0, (err) => {
    t.error(err)

    target.listen(0, (err) => {
      t.error(err)

      get({
        url: `https://localhost:${instance.server.address().port}`,
        rejectUnauthorized: false
      }, (err, res, data) => {
        t.error(err)
        t.equal(res.headers['content-type'], 'text/plain')
        t.equal(res.headers['x-my-header'], 'hello!')
        t.equal(res.statusCode, 205)
        t.equal(data.toString(), 'hello world')
      })
    })
  })
})

test('transform a response', (t) => {
  t.plan(9)

  const instance = Fastify()
  instance.register(From)

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
    reply.from(`http://localhost:${target.address().port}`, {
      onResponse: (res) => {
        reply.send(res.pipe(new Transform({
          transform: function (chunk, enc, cb) {
            this.push(chunk.toString().toUpperCase())
            cb()
          }
        })))
      }
    })
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
        t.equal(data.toString(), 'HELLO WORLD')
      })
    })
  })
})

test('rewrite headers', (t) => {
  t.plan(10)

  const instance = Fastify()
  instance.register(From)

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
    reply.from(`http://localhost:${target.address().port}`, {
      rewriteHeaders: (headers) => {
        t.pass('rewriteHeaders called')
        return {
          'content-type': headers['content-type'],
          'x-another-header': 'so headers!'
        }
      }
    })
  })

  t.tearDown(target.close.bind(target))

  instance.listen(0, (err) => {
    t.error(err)

    target.listen(0, (err) => {
      t.error(err)

      get(`http://localhost:${instance.server.address().port}`, (err, res, data) => {
        t.error(err)
        t.equal(res.headers['content-type'], 'text/plain')
        t.equal(res.headers['x-another-header'], 'so headers!')
        t.notOk(res.headers['x-my-header'])
        t.equal(res.statusCode, 205)
      })
    })
  })
})

test('base', (t) => {
  t.plan(10)

  const instance = Fastify()

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/', (request, reply) => {
    reply.from()
  })

  t.tearDown(target.close.bind(target))

  target.listen(0, (err) => {
    t.error(err)

    instance.register(From, {
      base: `http://localhost:${target.address().port}`
    })

    instance.listen(0, (err) => {
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

test('querystrings with base', (t) => {
  t.plan(10)

  const instance = Fastify()

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/hello?a=b')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/hello', (request, reply) => {
    reply.from()
  })

  t.tearDown(target.close.bind(target))

  target.listen(0, (err) => {
    t.error(err)

    instance.register(From, {
      base: `http://localhost:${target.address().port}`
    })

    instance.listen(0, (err) => {
      t.error(err)

      get(`http://localhost:${instance.server.address().port}/hello?a=b`, (err, res, data) => {
        t.error(err)
        t.equal(res.headers['content-type'], 'text/plain')
        t.equal(res.headers['x-my-header'], 'hello!')
        t.equal(res.statusCode, 205)
        t.equal(data.toString(), 'hello world')
      })
    })
  })
})

test('querystrings without base', (t) => {
  t.plan(10)

  const instance = Fastify()

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/world?a=b')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/hello', (request, reply) => {
    reply.from(`http://localhost:${target.address().port}/world`)
  })

  t.tearDown(target.close.bind(target))

  target.listen(0, (err) => {
    t.error(err)

    instance.register(From)

    instance.listen(0, (err) => {
      t.error(err)

      get(`http://localhost:${instance.server.address().port}/hello?a=b`, (err, res, data) => {
        t.error(err)
        t.equal(res.headers['content-type'], 'text/plain')
        t.equal(res.headers['x-my-header'], 'hello!')
        t.equal(res.statusCode, 205)
        t.equal(data.toString(), 'hello world')
      })
    })
  })
})

test('querystrings override /1 ', (t) => {
  t.plan(10)

  const instance = Fastify()

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/world?b=c')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/hello', (request, reply) => {
    reply.from(`http://localhost:${target.address().port}/world?b=c`)
  })

  t.tearDown(target.close.bind(target))

  target.listen(0, (err) => {
    t.error(err)

    instance.register(From)

    instance.listen(0, (err) => {
      t.error(err)

      get(`http://localhost:${instance.server.address().port}/hello?a=b`, (err, res, data) => {
        t.error(err)
        t.equal(res.headers['content-type'], 'text/plain')
        t.equal(res.headers['x-my-header'], 'hello!')
        t.equal(res.statusCode, 205)
        t.equal(data.toString(), 'hello world')
      })
    })
  })
})

test('querystrings override with an option', (t) => {
  t.plan(10)

  const instance = Fastify()

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'GET')
    t.equal(req.url, '/world?b=c')
    res.statusCode = 205
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('x-my-header', 'hello!')
    res.end('hello world')
  })

  instance.get('/hello', (request, reply) => {
    reply.from(`http://localhost:${target.address().port}/world`, {
      queryString: { b: 'c' }
    })
  })

  t.tearDown(target.close.bind(target))

  target.listen(0, (err) => {
    t.error(err)

    instance.register(From)

    instance.listen(0, (err) => {
      t.error(err)

      get(`http://localhost:${instance.server.address().port}/hello?a=b`, (err, res, data) => {
        t.error(err)
        t.equal(res.headers['content-type'], 'text/plain')
        t.equal(res.headers['x-my-header'], 'hello!')
        t.equal(res.statusCode, 205)
        t.equal(data.toString(), 'hello world')
      })
    })
  })
})

test('override body', (t) => {
  t.plan(9)

  const instance = Fastify()
  instance.register(From)

  t.tearDown(instance.close.bind(instance))

  const target = http.createServer((req, res) => {
    t.pass('request proxied')
    t.equal(req.method, 'POST')
    t.equal(req.headers['content-type'], 'application/json')
    t.equal(req.headers['content-length'], '20')
    var data = ''
    req.setEncoding('utf8')
    req.on('data', (d) => {
      data += d
    })
    req.on('end', () => {
      t.deepEqual(JSON.parse(data), { something: 'else' })
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ hello: 'fastify' }))
    })
  })

  instance.post('/', (request, reply) => {
    reply.from(`http://localhost:${target.address().port}`, {
      body: {
        something: 'else'
      }
    })
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
        t.deepEqual(data, { hello: 'fastify' })
      })
    })
  })
})
