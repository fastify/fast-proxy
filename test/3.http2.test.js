/* global describe, it */
'use strict'

const h2url = require('h2url')
const bodyParser = require('body-parser')
const expect = require('chai').expect
let gateway, service, close, proxy
const pem = require('pem')
const pump = require('pump')
const serviceKey = require('fs').readFileSync(__dirname + '/private_key.pem').toString()

describe('http2', () => {
  it('init should fail if base is missing', (done) => {
    try {
      require('..')({
        rejectUnauthorized: false,
        http2: true
      })
    } catch (err) {
      expect(err.message).to.equal('Option base is required when http2 is true')
      done()
    }
  })

  it('init', async () => {
    const fastProxy = require('..')({
      base: 'https://localhost:3000',
      rejectUnauthorized: false,
      http2: true
    })
    close = fastProxy.close
    proxy = fastProxy.proxy

    expect(proxy instanceof Function).to.equal(true)
    expect(close instanceof Function).to.equal(true)
  })

  it('init & start gateway', (done) => {
    // init gateway
    pem.createCertificate({
      serviceKey,
      days: 1,
      selfSigned: true
    }, (_, keys) => {
      gateway = require('restana')({
        server: require('http2').createSecureServer({
          key: keys.serviceKey,
          cert: keys.certificate
        })
      })

      gateway.all('/service/*', function (req, res) {
        proxy(req, res, req.url, {
          request: {
            timeout: 100
          }
        })
      })

      gateway.start(8080).then(server => {
        done()
      })
    })
  })

  it('init & start remote service', (done) => {
    // init remote service
    pem.createCertificate({
      serviceKey,
      days: 1,
      selfSigned: true
    }, (_, keys) => {
      service = require('restana')({
        server: require('http2').createSecureServer({
          key: keys.serviceKey,
          cert: keys.certificate
        })
      })
      service.use(bodyParser.text())

      service.post('/service/post', (req, res) => {
        pump(req, res)
      })

      service.get('/service/longop', (req, res) => {
        setTimeout(() => {
          res.send('Hello World!')
        }, 500)
      })

      service.get('/service/headers', (req, res) => {
        res.setHeader('x-agent', 'fast-proxy')
        res.setHeader('x-forwarded-host', req.headers['x-forwarded-host'])

        res.send()
      })

      service.start(3000).then(() => done())
    })
  })

  it('should 200 on GET headers', async () => {
    const { headers } = await h2url.concat({
      url: 'https://localhost:8080/service/headers',
      headers: {
        ':authority': 'nodejs.org:443'
      }
    })
    expect(headers[':status']).to.equal(200)
    expect(headers['x-agent']).to.equal('fast-proxy')
    expect(headers['x-forwarded-host']).to.equal('nodejs.org:443')
  })

  it('should timeout on GET /service/longop', async () => {
    const { headers } = await h2url.concat({
      url: 'https://localhost:8080/service/longop'
    })
    expect(headers[':status']).to.equal(504)
  })

  it('should 200 on POST', async () => {
    const { body } = await h2url.concat({
      url: 'https://localhost:8080/service/post',
      method: 'POST',
      headers: {
        'x-header': 'hello',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ 'x-agent': 'fast-proxy' })
    })

    expect(JSON.parse(body)['x-agent']).to.equal('fast-proxy')
  })

  it('close all', async () => {
    close()
    await gateway.close()
    await service.close()
  })
})
