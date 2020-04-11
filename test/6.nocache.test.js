/* global describe, it */
'use strict'

const request = require('supertest')
const bodyParser = require('body-parser')
const expect = require('chai').expect
const pump = require('pump')
let gateway, service, close, proxy, gHttpServer

describe('no URLs cache', () => {
  it('init', async () => {
    const fastProxy = require('../index')({
      base: 'http://127.0.0.1:3000',
      cacheURLs: 0
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

    service.get('/service/headers', (req, res) => {
      res.setHeader('url', req.url)
      res.send()
    })

    await service.start(3000)
  })

  it('should 200 on GET /servive/headers', async () => {
    await request(gHttpServer)
      .get('/service/headers')
      .expect(200)
      .then((response) => {
        expect(response.headers.url).to.equal('/service/headers')
      })
  })

  it('close all', async () => {
    close()
    await gateway.close()
    await service.close()
  })
})
