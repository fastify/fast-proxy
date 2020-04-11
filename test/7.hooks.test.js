/* global describe, it */
'use strict'

const request = require('supertest')
const bodyParser = require('body-parser')
const expect = require('chai').expect
let gateway, service, close, proxy, gHttpServer

describe('hooks', () => {
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
        rewriteHeaders: (headers) => {
          headers['x-reponse-hook'] = '1'

          return headers
        },
        rewriteRequestHeaders: (req, headers) => {
          headers['x-request-hook'] = req.path

          return headers
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
      res.setHeader('x-request-hook', req.headers['x-request-hook'])
      res.end()
    })

    await service.start(3000)
  })

  it('should modify headers using hooks', async () => {
    await request(gHttpServer)
      .get('/service/headers')
      .expect(200)
      .then((response) => {
        expect(response.headers['x-reponse-hook']).to.equal('1')
        expect(response.headers['x-request-hook']).to.equal('/service/headers')
      })
  })

  it('close all', async () => {
    close()
    await gateway.close()
    await service.close()
  })
})
