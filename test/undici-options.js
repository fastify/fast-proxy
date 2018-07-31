'use strict'

const t = require('tap')
const Fastify = require('fastify')
const proxyquire = require('proxyquire')

t.plan(2)

class Pool {
  constructor (url, opts) {
    t.strictEqual(url, 'http://path/to/somewhere')
    t.strictDeepEqual(opts, {
      connections: 42,
      pipeling: 24,
      timeout: 4242
    })
  }
}

// original setup in the undici module
// needed to test a bug
function undici () {}
undici.Pool = Pool

const buildRequest = proxyquire('../lib/request.js', {
  undici
})

const From = proxyquire('..', {
  './lib/request.js': buildRequest
})

const instance = Fastify()

instance.register(From, {
  base: 'http://path/to/somewhere',
  undici: {
    connections: 42,
    pipeling: 24,
    timeout: 4242
  }
})

instance.ready()
