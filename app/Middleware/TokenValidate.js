'use strict'
const { seeToken } = require("../Services/jwtServices");

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

class TokenValidate {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({ request, response, params }, next) {
    const token = request.header('authorization')
    try {
      if (!token) {
        response.status(498).send('token não fornecido')
        return
      }

      const verified = seeToken(token)

      if (!verified.grpven) {
        response.status(498).send('token inválido')
        return
      }

      await next()
    } catch (err) {
      response.status(498).send('Erro')
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'TokenValidate.handle',
      })
    }
  }
}

module.exports = TokenValidate
