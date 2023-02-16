"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class DepositsController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const dep = await Database
      .select('DepId', 'DepNome')
      .from('dbo.Deposito')
      .where({
        GrpVen: verified.grpven,
      })

      response.status(200).send({
        depositos: dep
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'DepositsController.Show',
      })
    }
  }
}

module.exports = DepositsController;
