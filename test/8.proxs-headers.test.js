/* global describe, it */
'use strict'

const request = require('supertest')
const expect = require('chai').expect
const nock = require('nock')
let gateway, close, proxy, gHttpServer

nock('http://service1.com')
  .get('/service1/health')
  .reply(200)
nock('https://service2.com:4443')
  .get('/service2/health')
  .reply(200)

describe('proxy headers', () => {
  let host, xForwardedHost

  it('init', async () => {
    const fastProxy = require('../index')({
    })
    close = fastProxy.close
    proxy = fastProxy.proxy

    expect(proxy instanceof Function).to.equal(true)
    expect(close instanceof Function).to.equal(true)
  })

  it('init & start gateway', async () => {
    // init gateway
    gateway = require('restana')()
    gateway.get('/service1/health', function (req, res) {
      proxy(req, res, req.url, {
        base: 'http://service1.com',
        rewriteRequestHeaders: (req, headers) => {
          host = headers.host
          xForwardedHost = headers['x-forwarded-host']

          return headers
        }
      })
    })
    gateway.get('/service2/health', function (req, res) {
      proxy(req, res, req.url, {
        base: 'https://service2.com:4443',
        rewriteRequestHeaders: (req, headers) => {
          host = headers.host
          xForwardedHost = headers['x-forwarded-host']

          return headers
        }
      })
    })

    gHttpServer = await gateway.start(8080)
  })

  it('should properly set proxy headers on default port', async () => {
    await request(gHttpServer)
      .get('/service1/health')
      .expect(200)
      .then((response) => {
        expect(host).to.equal('service1.com')
        expect(xForwardedHost).to.equal('127.0.0.1:8080')
      })
  })

  it('should properly set proxy headers on custom port', async () => {
    await request(gHttpServer)
      .get('/service2/health')
      .expect(200)
      .then((response) => {
        expect(host).to.equal('service2.com:4443')
        expect(xForwardedHost).to.equal('127.0.0.1:8080')
      })
  })

  it('close all', async () => {
    close()
    await gateway.close()
  })
})
