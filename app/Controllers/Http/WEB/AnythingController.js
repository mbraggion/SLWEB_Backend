"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index");
moment.locale("pt-br");

class AnythingController {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Filiais({ request, response }) {
    const token = request.header("authorization");

    try {
      const franqueados = await Database.select("M0_CODFIL", "GrupoVenda")
        .from("dbo.FilialEntidadeGrVenda")
        .orderBy("M0_CODFIL", "ASC");

      response.status(200).send(franqueados);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: "AnythingController.Filiais",
      });
    }
  }

  async CheckPendencias({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const DeveConfirmacaoDeLocalizacao = await Database.select("Equip")
        .from("dbo.FilialEntidadeGrVenda")
        .where({
          M0_CODFIL: verified.user_code,
        });

      const DeveConfirmacaoDeRecebimento = await Database.raw(
        "select * from OSCtrl where OSCStatus = 'Ativo' and GrpVen = ? and OSCExpDtPrevisao is not null and OSCExpDtPrevisao < GETDATE()",
        [verified.grpven]
      );

      response.status(200).send({
        Equip: DeveConfirmacaoDeLocalizacao[0]
          ? DeveConfirmacaoDeLocalizacao[0].Equip === "S"
          : false,
        Deliver: DeveConfirmacaoDeRecebimento,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: "AnythingController.CheckPendencias",
      });
    }
  }
}

module.exports = AnythingController;
