/* global describe, it */
'use strict'

const expect = require('chai').expect
const { buildURL } = require('./../lib/utils')

describe('buildURL', () => {
  it('should produce invalid URL - //10.0.0.10/', function () {
    const url = new URL('//10.0.0.10/', 'http://localhost')
    expect(url.origin).to.equal('http://10.0.0.10')
    expect(url.pathname).to.equal('/')
    expect(url.href).to.equal('http://10.0.0.10/')
  })

  it('should produce invalid URL - //httpbin.org/hi', function () {
    const url = new URL('//httpbin.org/hi', 'http://localhost')
    expect(url.origin).to.equal('http://httpbin.org')
    expect(url.pathname).to.equal('/hi')
    expect(url.href).to.equal('http://httpbin.org/hi')
  })

  it('should produce valid URL (2 params)', function () {
    const url = buildURL('/hi', 'http://localhost')

    expect(url.origin).to.equal('http://localhost')
    expect(url.pathname).to.equal('/hi')
    expect(url.href).to.equal('http://localhost/hi')
  })

  it('should not strip double slashes from query parameters', function () {
    const url = buildURL('/hi?bye=https%3A//example.com', 'http://localhost')

    expect(url.origin).to.equal('http://localhost')
    expect(url.pathname).to.equal('/hi')
    expect(url.href).to.equal('http://localhost/hi?bye=https%3A//example.com')
  })

  it('should produce valid URL (1 param)', function () {
    const url = buildURL('http://localhost/hi')

    expect(url.origin).to.equal('http://localhost')
    expect(url.pathname).to.equal('/hi')
    expect(url.href).to.equal('http://localhost/hi')
  })

  it('should sanitize invalid source (2 params) - //10.0.0.10/hi', function () {
    const url = buildURL('//10.0.0.10/hi', 'http://localhost')

    expect(url.origin).to.equal('http://localhost')
    expect(url.pathname).to.equal('/10.0.0.10/hi')
    expect(url.href).to.equal('http://localhost/10.0.0.10/hi')
  })

  it('should sanitize invalid source (2 params) - //httpbin.org/hi', function () {
    const url = buildURL('//httpbin.org/hi', 'http://localhost')

    expect(url.origin).to.equal('http://localhost')
    expect(url.pathname).to.equal('/httpbin.org/hi')
    expect(url.href).to.equal('http://localhost/httpbin.org/hi')
  })
})
