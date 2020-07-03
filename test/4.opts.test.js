/* global describe, it */
'use strict'

const request = require('supertest')
const bodyParser = require('body-parser')
const expect = require('chai').expect
const pump = require('pump')
let gateway, service, close, proxy, gHttpServer

const nock = require('nock')

nock('http://dev.com')
  .get('/service/headers?age=33')
  .reply(200, {
  }, {
    url: 'http://dev.com'
  })

describe('fast-proxy smoke', () => {
  it('init', async () => {
    const fastProxy = require('../index')({
      base: 'http://127.0.0.1:3000'
    })
    close = fastProxy.close
    proxy = fastProxy.proxy

    expect(proxy instanceof Function).to.equal(true)
    expect(close instanceof Function).to.equal(true)
  })

  it('init & start gateway', async () => {
    // init gateway
    gateway = require('restana')()

    gateway.all('/service/*', function (req, res) {
      proxy(req, res, req.url, {
        base: req.headers.base,
        queryString: { age: 33 },
        onResponse (req, res, stream) {
          pump(stream, res)
        }
      })
    })

    gHttpServer = await gateway.start(8080)
  })

  it('init & start remote service', async () => {
    // init remote service
    service = require('restana')()
    service.use(bodyParser.json())

    service
      .get('/service/headers', (req, res) => {
        res.setHeader('url', req.url)
        res.send()
      })
      .get('/service/302', (req, res) => {
        res.statusCode = 302
        res.end()
      })

    await service.start(3000)
  })

  it('should 200 on GET /servive/headers + opts', async () => {
    await request(gHttpServer)
      .get('/service/headers')
      .expect(200)
      .then((response) => {
        expect(response.headers.url).to.equal('/service/headers?age=33')
      })
  })

  it('should overwrite global base', async () => {
    await request(gHttpServer)
      .get('/service/headers')
      .set('base', 'http://localhost:3000')
      .expect(200)
      .then((response) => {
        expect(response.headers.url).to.equal('/service/headers?age=33')
      })
  })

  it('should overwrite global base 2', async () => {
    await request(gHttpServer)
      .get('/service/headers')
      .set('base', 'http://dev.com')
      .then((response) => {
        expect(response.headers.url).to.equal('http://dev.com')
      })
  })

  it('should retrieve http status from origin', async () => {
    await request(gHttpServer)
      .get('/service/302')
      .expect(302)
  })

  it('close all', async () => {
    close()
    await gateway.close()
    await service.close()
  })
})
