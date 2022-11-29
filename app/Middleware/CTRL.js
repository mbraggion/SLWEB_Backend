'use strict'

const Database = use("Database");
const logger = require("../../dump/index")

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

class CTRL {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({ request, response, params }, next, properties) {
    try {
      const webFechado = await Database
      .select('FechaSite')
      .from('dbo.CTRL')

      if (typeof webFechado != 'undefined' && webFechado[0].FechaSite === false) {
        await next()
      } else {
        response.status(423).send()
      }
    } catch (err) {
      response.status(423).send(err.message)
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'CTRL.handle',
      })
    }
  }
}

module.exports = CTRL
