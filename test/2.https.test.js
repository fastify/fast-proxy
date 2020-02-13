/* global describe, it */
'use strict'

const request = require('supertest')
const bodyParser = require('body-parser')
const expect = require('chai').expect
let gateway, service, close, proxy, gHttpServer
const pem = require('pem')

describe('https', () => {
  it('init', async () => {
    const fastProxy = require('..')({
      base: 'https://127.0.0.1:3000',
      rejectUnauthorized: false
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
        request: {
          timeout: 100
        }
      })
    })

    gHttpServer = await gateway.start(8080)
  })

  it('init & start remote service', (done) => {
    // init remote service
    pem.createCertificate({
      days: 1,
      selfSigned: true
    }, (_, keys) => {
      service = require('restana')({
        server: require('https').createServer({
          key: keys.serviceKey,
          cert: keys.certificate
        })
      })
      service.use(bodyParser.json())

      service.get('/service/get', (req, res) => res.send('Hello World!'))
      service.get('/service/longop', (req, res) => {
        setTimeout(() => {
          res.send('Hello World!')
        }, 500)
      })
      service.post('/service/post', (req, res) => {
        res.send(req.body)
      })
      service.get('/service/headers', (req, res) => {
        res.setHeader('x-agent', 'fast-proxy')
        res.send()
      })

      service.start(3000).then(() => done())
    })
  })

  it('should 200 on GET to valid remote endpoint', async () => {
    await request(gHttpServer)
      .get('/service/get')
      .expect(200)
  })

  it('should timeout on GET /service/longop', async () => {
    await request(gHttpServer)
      .get('/service/longop')
      .expect(504)
  })

  it('should 200 on POST to valid remote endpoint', async () => {
    await request(gHttpServer)
      .post('/service/post')
      .send({ name: 'john' })
      .expect(200)
      .then((res) => {
        expect(res.body.name).to.equal('john')
      })
  })

  it('should 200 on GET /servive/headers', async () => {
    await request(gHttpServer)
      .get('/service/headers')
      .expect(200)
      .then((response) => {
        expect(response.headers['x-agent']).to.equal('fast-proxy')
      })
  })

  it('close all', async () => {
    close()
    await gateway.close()
    await service.close()
  })
})
