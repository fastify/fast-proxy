'use strict'

const fastProxy = require('..')
const http = require('http')
const get = require('simple-get').concat
const t = require('tap')

t.plan(9)

const target = http.createServer((req, res) => {
  t.pass('request proxied')
  t.equal(req.method, 'GET')
  res.statusCode = 205
  res.setHeader('Content-Type', 'text/plain')
  res.end(req.headers.host)
})
t.tearDown(target.close.bind(target))

const source = http.createServer((req, res) => {
  const base = `http://localhost:${target.address().port}`
  const { proxy } = fastProxy({
    base
  })
  proxy(req, res, req.url, {
    rewriteRequestHeaders: (originalReq, headers) => {
      t.pass('rewriteRequestHeaders called')
      return Object.assign(headers, { host: 'host-override' })
    }
  })
})
t.tearDown(source.close.bind(source))

const instance = source.listen(0, (err) => {
  t.error(err)

  target.listen(0, (err) => {
    t.error(err)

    get(`http://localhost:${instance.address().port}`, (err, res, data) => {
      t.error(err)
      t.equal(res.headers['content-type'], 'text/plain')
      t.equal(res.statusCode, 205)
      t.equal(data.toString(), 'host-override')
    })
  })
})
