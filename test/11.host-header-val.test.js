/* global describe, it */
'use strict'

const request = require('supertest')
let gateway, close, proxy, gHttpServer

describe('Host header validation', () => {
  it('init', async () => {
    const fastProxy = require('../index')({
      base: 'http://127.0.0.1:3000'
    })

    proxy = fastProxy.proxy
    close = fastProxy.close
  })

  it('init & start gateway', async () => {
    // init gateway
    gateway = require('restana')()

    gateway.all('/service/*', function (req, res) {
      delete req.headers.host
      proxy(req, res, req.url, {})
    })

    gHttpServer = await gateway.start(8080)
  })

  it('should fail with Bad Request when Host header is missing', async () => {
    await request(gHttpServer)
      .get('/service/headers')
      .expect(400)
  })

  it('close all', async () => {
    close()
    await gateway.close()
  })
})
