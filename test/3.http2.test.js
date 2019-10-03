/* global describe, it */
const h2url = require('h2url')
const bodyParser = require('body-parser')
const expect = require('chai').expect
let gateway, service, close, proxy
const pem = require('pem')
const pump = require('pump')

describe('http2', () => {
  it('init should fail if base is missing', (done) => {
    try {
      require('../index')({
        rejectUnauthorized: false,
        http2: true
      })
    } catch (err) {
      expect(err.message).to.equal('Option base is required when http2 is true')
      done()
    }
  })

  it('init', async () => {
    const fastProxy = require('../index')({
      base: 'https://127.0.0.1:3000',
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
        proxy(req, res, req.url, {})
      })

      gateway.start(8080).then(server => {
        done()
      })
    })
  })

  it('init & start remote service', (done) => {
    // init remote service
    pem.createCertificate({
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
      service.get('/service/headers', (req, res) => {
        res.setHeader('x-agent', 'fast-proxy')
        res.send()
      })

      service.start(3000).then(() => done())
    })
  })

  it('should 200 on GET headers', async () => {
    const { headers } = await h2url.concat({
      url: 'https://127.0.0.1:8080/service/headers'
    })
    expect(headers[':status']).to.equal(200)
    expect(headers['x-agent']).to.equal('fast-proxy')
  })

  it('should 200 on POST', async () => {
    const { body } = await h2url.concat({
      url: 'https://127.0.0.1:8080/service/post',
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
