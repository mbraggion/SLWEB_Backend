"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class InventoryController {
  async See({ request, response, params }) {
    const token = request.header("authorization");
    const ref = decodeURI(params.ref)

    try {
      const verified = seeToken(token);

      const invCab = await Database
        .select('InvConcluido', 'InvId', 'DepId', 'InvDtLanca')
        .from('dbo.InventarioCab')
        .where({
          GrpVen: verified.grpven,
          InvDtMov: ref
        })

      let invDet = null

      if (invCab.length > 0) {
        invDet =  await Database
        .select('InvId', 'ProdId', 'Produto', 'InvQtd', 'InvAjQ', 'InvJust')
        .from('dbo.InventarioDet')
        .where({
          GrpVen: verified.grpven,
          InvId: invCab[0].InvId
        })
      }

      response.status(200).send({
        Inventario: {
          referencia: ref,
          status: invCab.length === 0 ? 'nao existe' : invCab[0].InvConcluido === 'S' ? 'fechado' : 'aberto',
          InvId: invCab.length > 0 ? invCab[0].InvId : null,
          InvDepId: invCab.length > 0 ? invCab[0].DepId : null,
          InvDtLancamento: invCab.length > 0 ? invCab[0].InvDtLanca : null,
          InvDetalhes: invDet
        }
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'InventoryController.Show',
      })
    }
  }
}

module.exports = InventoryController;
