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
  async handle({ request, response }, next) {
    const token = request.header('authorization')
    try {
      if (!token) {
        throw new Error('token não fornecido')
      }

      const verified = seeToken(token)

      if(!verified.grpven){
        throw new Error('token inválido')
      }

      await next()
    } catch (err) {
      response.status(498).send()
      // logger.error({
      //   token: token,
      //   params: null,
      //   payload: request.body,
      //   err: err.message,
      //   handler: 'TokenValidate.handle',
      // })
    }
  }
}

module.exports = TokenValidate
