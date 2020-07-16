/* global describe, it */
'use strict'

const request = require('supertest')
const bodyParser = require('body-parser')
const { expect } = require('chai')
let gateway, service, close, proxy, gHttpServer

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
    gateway.use(bodyParser.json())
    gateway.use(bodyParser.urlencoded({ extended: true }))
    gateway.use(bodyParser.text())

    gateway.all('/service/*', function (req, res) {
      proxy(req, res, req.url, {})
    })

    gHttpServer = await gateway.start(8080)
  })

  it('should fail 404 on GET "Not Found" route from gateway', async () => {
    await request(gHttpServer)
      .get('/404')
      .expect(404)
  })

  it('should fail 503 on remote service unavailable', async () => {
    await request(gHttpServer)
      .get('/service/get')
      .expect(503)
  })

  it('init & start remote service', async () => {
    // init remote service
    service = require('restana')()
    service.use(bodyParser.json())
    service.use(bodyParser.urlencoded({ extended: true }))
    service.use(bodyParser.text())
    service.get('/service/get', (req, res) => res.send('Hello World!'))
    service.post('/service/post', (req, res) => {
      res.send(req.body)
    })
    service.post('/service/post/urlencoded', (req, res) => {
      res.send(req.body)
    })
    service.post('/service/post/text', (req, res) => {
      res.send(req.body)
    })
    service.get('/service/headers', (req, res) => {
      res.setHeader('x-agent', 'fast-proxy')
      res.setHeader('host', req.headers.host)
      res.setHeader('x-forwarded-host', req.headers['x-forwarded-host'])

      res.send()
    })

    await service.start(3000)
  })

  it('should 404 if 404 on remote', async () => {
    await request(gHttpServer)
      .get('/service/404')
      .expect(404)
  })

  it('should 200 on GET to valid remote endpoint', async () => {
    await request(gHttpServer)
      .get('/service/get')
      .expect(200)
  })

  it('should 200 on POST plain/text to valid remote endpoint', async () => {
    await request(gHttpServer)
      .post('/service/post/text')
      .set('content-type', 'text/plain')
      .send('name is john')
      .expect(200)
      .then((res) => {
        expect(res.text).to.equal('name is john')
      })
  })

  it('should 200 on POST application/json to valid remote endpoint', async () => {
    await request(gHttpServer)
      .post('/service/post')
      .send({ name: 'john' })
      .expect(200)
      .then((res) => {
        expect(res.body.name).to.equal('john')
      })
  })

  it('should 200 on POST application/x-www-form-urlencoded to valid remote endpoint', async () => {
    await request(gHttpServer)
      .post('/service/post/urlencoded')
      .send('name=john')
      .expect(200)
      .then((res) => {
        expect(res.body.name).to.equal('john')
      })
  })

  it('should 200 on GET /servive/headers', async () => {
    await request(gHttpServer)
      .get('/service/headers?query=string')
      .expect(200)
      .then((response) => {
        expect(response.headers['x-agent']).to.equal('fast-proxy')
        expect(response.headers.host).to.equal('127.0.0.1:3000')
        expect(response.headers['x-forwarded-host']).to.equal('127.0.0.1:8080')
      })
  })

  it('close all', async () => {
    close()
    await gateway.close()
    await service.close()
  })
})
