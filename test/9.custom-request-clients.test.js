/* global describe, it, after */
'use strict'

const request = require('supertest')
const expect = require('chai').expect

let service

describe('fast-proxy custom request clients/agents', () => {
  it('init & start remote service', async () => {
    // init remote service
    service = require('restana')()

    service.get('/service/redirect', (req, res) => {
      res.setHeader('location', '/service/redirected')
      res.send(301)
    })
    service.get('/service/redirected', (req, res) => {
      res.setHeader('url', req.url)
      res.send()
    })

    await service.start(3000)
  })

  describe('with default request clients', () => {
    let gateway, close, proxy, gHttpServer

    it('init proxy', async () => {
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
        proxy(req, res, req.url, {})
      })

      gHttpServer = await gateway.start(8080)
    })

    it('should 301 on redirected url', async () => {
      await request(gHttpServer)
        .get('/service/redirect')
        .expect(301)
        .then((response) => {
          expect(response.headers.url).not.to.equal('/service/redirected')
        })
    })

    after(async () => {
      close()
      await gateway.close()
    })
  })

  describe('with custom request clients that follow redirects', () => {
    let gateway, close, proxy, gHttpServer

    it('init proxy', async () => {
      const fastProxy = require('../index')({
        base: 'http://127.0.0.1:3000',
        requests: {
          http: require('follow-redirects/http'),
          https: require('follow-redirects/https')
        }
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
        proxy(req, res, req.url, {})
      })

      gHttpServer = await gateway.start(8081)
    })

    it('should 200 on redirected url', async () => {
      await request(gHttpServer)
        .get('/service/redirect')
        .expect(200)
        .then((response) => {
          expect(response.headers.url).to.equal('/service/redirected')
        })
    })

    after(async () => {
      close()
      await gateway.close()
    })
  })

  after(async () => {
    await service.close()
  })
})
