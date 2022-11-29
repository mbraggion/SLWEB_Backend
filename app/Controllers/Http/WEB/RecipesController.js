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
        err: err.message,
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
        RecStatus: rec[0].RecStatus,
        Insumos: rec.map(r => ({
          GrupoProduto: r.GprdId,
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
        err: err.message,
        handler: 'RecipesController.See',
      })
    }
  }

  async Store({ request, response }) {
    const token = request.header("authorization");
    const { recipeName, recipeDetails } = request.only(['recipeName', 'recipeDetails'])

    try {
      const verified = seeToken(token)

      const ultimaRecId = await Database.raw("select MAX(RecId) as MaxID from SLAPLIC.dbo.Receita where GrpVen = ?", [verified.grpven])

      const proxRecId = ultimaRecId.length > 0 ? ultimaRecId[0].MaxID + 1 : 1

      await Database
        .insert({
          GrpVen: verified.grpven,
          RecId: proxRecId,
          RecDesc: recipeName,
          RecStatus: 'A'
        })
        .into('dbo.Receita')

      for (let index in recipeDetails) {
        await Database
          .insert({
            GrpVen: verified.grpven,
            RecId: proxRecId,
            GprdId: recipeDetails[index].GrupoProduto,
            RdetQtd: recipeDetails[index].Qtd,
            RDetH2O: null
          })
          .into('dbo.ReceitaDet')
      }

      response.status(200).send({
        id: proxRecId,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'RecipesController.Store',
      })
    }
  }

  async Update({ request, response }) {
    const token = request.header("authorization");
    const { recipeName, recipeDetails, RecId } = request.only(['recipeName', 'recipeDetails', 'RecId'])

    try {
      const verified = seeToken(token)

      await Database
        .table("dbo.Receita")
        .where({
          GrpVen: verified.grpven,
          RecId: RecId,
        })
        .update({
          RecDesc: recipeName,
        });

      await Database
        .table("dbo.ReceitaDet")
        .where({
          GrpVen: verified.grpven,
          RecId: RecId,
        })
        .delete();

      for (let index in recipeDetails) {
        await Database
          .insert({
            GrpVen: verified.grpven,
            RecId: RecId,
            GprdId: recipeDetails[index].GrupoProduto,
            RdetQtd: recipeDetails[index].Qtd,
            RDetH2O: null
          })
          .into('dbo.ReceitaDet')
      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'RecipesController.Update',
      })
    }
  }

  async Inativar({ request, response }) {
    const token = request.header("authorization");
    const { RecId, RecStatus } = request.only(['RecId', 'RecStatus'])

    try {
      const verified = seeToken(token)

      await Database
        .table("dbo.Receita")
        .where({
          GrpVen: verified.grpven,
          RecId: RecId,
        })
        .update({
          RecStatus: RecStatus === 'A' ? 'I' : 'A',
        });

      response.status(200).send({
        updStatus: RecStatus === 'A' ? 'I' : 'A'
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'RecipesController.Inativar',
      })
    }
  }
}

module.exports = RecipesController;

const QUERY_REC_DET = "select R.RecId, R.RecDesc, R.RecStatus, RT.RdetQtd, GI.GprdId, GI.GprdDesc, GI.GprdUn from dbo.Receita as R right join dbo.ReceitaDet as RT on (R.RecId = RT.RecId and R.GrpVen = RT.GrpVen) right join dbo.GruposInsumo as GI on RT.GprdId = GI.GprdId where R.GrpVen = ? and R.RecId = ?"