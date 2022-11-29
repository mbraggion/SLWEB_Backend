"use strict";

const Database = use("Database");
const logger = require("../../../../dump/index")

class ReferenceController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const refs = await Database.select('*').from('dbo.Referencia').orderBy('Refdt', 'desc')

      response.status(200).send({
        Referencias: refs
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'ReferenceController.Show',
      })
    }
  }
}

module.exports = ReferenceController;
