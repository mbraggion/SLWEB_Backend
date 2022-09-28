"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const axios = require("axios").default;
const logger = require("../../../../dump/index")

class ContractController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const contracts =  await Database
      .select("CNPJ", "ConId", "Dt_Inicio", "Dt_Fim", "Nome_Fantasia", "Contato_Empresa", "Email", "Contato_Empresa_2", "Email_2", "Fone_2", "Contato2", "Obs_Específica_Cliente", "ConPDF")
      .from("dbo.Contrato")
      .where({
        GrpVen: verified.grpven
      })

      response.status(200).send({ contracts: contracts });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'ContractController.Show',
      })
    }
  }
}

module.exports = ContractController;
