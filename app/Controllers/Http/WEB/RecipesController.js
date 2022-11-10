"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class RecipesController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const rec = await Database
        .select('RecId', 'RecDesc', 'RecStatus')
        .from('dbo.Receita')
        .where({
          GrpVen: verified.grpven
        })

      const GrupoInsumos = await Database
        .select('*')
        .from('dbo.GruposInsumo')

      response.status(200).send({
        Receitas: rec,
        GrupoInsumos
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'RecipesController.Show',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const recid = params.recid

    try {
      const verified = seeToken(token);

      let rec = await Database.raw(
        QUERY_REC_DET,
        [verified.grpven, recid]
      )

      if (rec.length === 0) {
        throw new Error('receita não tem detalhes')
      }

      rec = {
        RecId: rec[0].RecId,
        RecNome: rec[0].RecDesc,
        Insumos: rec.map(r => ({
          Insumo: r.GprdDesc,
          Un: r.GprdUn,
          Qtd: r.RdetQtd
        }))
      }

      response.status(200).send({
        Receita: rec,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'RecipesController.See',
      })
    }
  }
}

module.exports = RecipesController;

const QUERY_REC_DET = "select R.RecId, R.RecDesc, RT.RdetQtd, GI.GprdDesc, GI.GprdUn from dbo.Receita as R right join dbo.ReceitaDet as RT on (R.RecId = RT.RecId and R.GrpVen = RT.GrpVen) right join dbo.GruposInsumo as GI on RT.GprdId = GI.GprdId where R.GrpVen = ? and R.RecId = ?"