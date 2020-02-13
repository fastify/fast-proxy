'use strict'

const fastProxy = require('..')
const http = require('http')
const get = require('simple-get').concat
const t = require('tap')

t.plan(10)

const target = http.createServer((req, res) => {
  t.pass('request proxied')
  t.equal(req.method, 'POST')
  t.equal(req.headers['content-type'], 'text/plain')
  var data = ''
  req.setEncoding('utf8')
  req.on('data', (d) => {
    data += d
  })
  req.on('end', () => {
    const str = data.toString()
    t.deepEqual(str, 'this is plain text')
    res.statusCode = 200
    res.setHeader('content-type', 'text/plain')
    res.end(str)
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

    get({
      url: `http://localhost:${instance.address().port}`,
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'this is plain text'
    }, (err, res, data) => {
      t.error(err)
      t.equal(res.headers['content-type'], 'text/plain')
      t.deepEqual(data.toString(), 'this is plain text')
    })
  })
})
