'use strict'

const fastProxy = require('..')
const http = require('http')
const get = require('simple-get')
const t = require('tap')

t.plan(10)

const target = http.createServer((req, res) => {
  t.pass('request proxied')
  t.equal(req.method, 'POST')
  t.equal(req.headers['content-type'].startsWith('application/json'), true)
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
t.tearDown(target.close.bind(target))

const source = http.createServer((req, res) => {
  const { proxy } = fastProxy({
    base: `http://localhost:${target.address().port}`
  })
  t.equal(req.method, 'POST')
  proxy(req, res, req.url)
})
t.tearDown(source.close.bind(source))

const instance = source.listen(0, (err) => {
  t.error(err)

  target.listen(0, (err) => {
    t.error(err)

    get.concat({
      url: `http://localhost:${instance.address().port}`,
      method: 'POST',
      body: JSON.stringify({
        hello: 'world'
      }),
      headers: {
        'content-type': 'application/json;charset=utf-8'
      }
    }, (err, res, data) => {
      t.error(err)
      t.equal(res.headers['content-type'], 'application/json')
      t.deepEqual(JSON.parse(data.toString()), { something: 'else' })
    })
  })
})
