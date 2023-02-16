'use strict'

const Database = use("Database");
const logger = require("../../dump/index")
const { seeToken } = require("../Services/jwtServices")

/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/framework/src/Response')} Response */
/** @typedef {import('@adonisjs/framework/src/View')} View */

class Valid {
  /**
   * @param {object} ctx
   * @param {Request} ctx.request
   * @param {Function} next
   */
  async handle({ request, response, params }, next, properties) {
    const token = request.header("authorization")
    const AccessLevelRequired = properties[0]
    const ScaleLevel = Number(properties[1])

    try {
      const verified = seeToken(token)

      const AccessLevel = await Database.raw(
        "select AccessLevel from dbo.TipoOper as T inner join dbo.Operador as O on O.TopeCod = T.TopeCod where M0_CODFIL = ?",
        [verified.admin_code ? verified.admin_code : verified.user_code]
      )
      
      if (
        (ScaleLevel && Number(AccessLevelRequired) <= Number(AccessLevel[0].AccessLevel)) ||
        (!ScaleLevel && Number(AccessLevelRequired) === Number(AccessLevel[0].AccessLevel))
      ) {
        await next()
      } else {
        response.status(423).send()
      }

    } catch (err) {
      response.status(423).send(err.message)
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'Valid.handle',
      })
    }
  }
}

module.exports = Valid
