'use strict'

const Fastify = require('fastify')

const gateway = Fastify({
  logger: false
})
gateway.register(require('fastify-reply-from'), {
  base: 'http://127.0.0.1:3000'
})
gateway.get('/service/*', (request, reply) => {
  reply.from(request.req.url)
})
gateway.listen(8080, (err) => {
  if (err) {
    throw err
  }
})
