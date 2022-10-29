"use strict";
const Database = use("Database");
const Drive = use("Drive");
const Mail = use("Mail");
const Env = use("Env");
const Helpers = use("Helpers");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index")
const PdfPrinter = require("pdfmake");
const toArray = require('stream-to-array')
const fs = require("fs");
const { PDFGen } = require("../../../../resources/pdfModels/detalhesCompra_pdfModel");

class ApontaConsumoController {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Leituras({ request, response, params }) {
    const token = request.header("authorization");

    const anxid = params.anxid
    const ref = decodeURI(params.ref)
    const equicod = params.equicod

    try {
      const verified = seeToken(token);

      const leit = await Database.raw(
        QUERY_LEITURAS_DISPONIVEIS,
        [
          moment(ref).toDate(),
          moment(ref).toDate(),
          equicod,
          verified.grpven,
          anxid
        ])

      response.status(200).send({
        Leituras: leit
      });
    } catch (err) {
      response.status(400).send();
      console.log(err.message)
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ApontaConsumoController.Leituras',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");

    const AnxId = params.anxid
    const PdvId = params.pdvid
    const leituraIdInit = params.letini
    const leituraIdEnc = params.letenc

    try {
      const verified = seeToken(token);

      const produtos = await Database.raw("execute dbo.sp_ApontaConsumo1 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?", [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc])
      const consumos = await Database.raw("execute dbo.sp_ApontaConsumo2 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?", [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc])

      response.status(200).send({
        Produtos: produtos,
        Consumos: consumos
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ApontaConsumoController.See',
      })
    }
  }

  async Store({ request, response, params }) {
    const token = request.header("authorization");

    const DepId = params.depid
    const Ref = params.ref

    try {
      const verified = seeToken(token);


      if (DepId === 1) {
        // verificar se o cara não está tentando lançar movimentação no depósito 1

        throw new Error('Não é possivel fazer apontamento de consumo no depósito 1')
      }

      let DOC = null

      let lastDOC = await Database.raw("SELECT Max(S.DOC) AS DOC FROM dbo.SDBase as S WHERE ( ((S.F_SERIE) = 'CON') AND ((S.M0_TIPO) = 'S') AND ((S.PvTipo) = 'C') AND ((S.D_FILIAL) = ?) )", [verified.user_code])

      DOC = lastDOC.length > 0 ? Number(lastDOC[0].DOC) + 1 : 1

      
      /*       
      DoCmd.RunSQL "UPDATE LeiturasConsumoMatPrima SET DOC = " & v + 1 & ";"
      
       DoCmd.RunSQL "delete from LeiturasConsumoMatPrimaPK;"
      
       S = "INSERT INTO LeiturasConsumoMatPrimaPK ( D_FILIAL, DOC ) "
       S = S & "SELECT USER.UserFilial, " & v + 1 & " FROM [USER];"
       DoCmd.RunSQL S
      
       S = "DELETE S.* FROM dbo_SDBase_srv AS S INNER JOIN LeiturasConsumoMatPrimaPK AS C "
       S = S & "ON (S.M0_TIPO = C.M0_TIPO) AND (S.DOC = C.DOC) AND (S.F_SERIE = C.F_SERIE) AND (S.D_FILIAL = C.D_FILIAL);"
       DoCmd.RunSQL S
      
       DoCmd.OpenQuery "LeiturasConsumoGeraSD" 
       */

      response.status(400).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ApontaConsumoController.Store',
      })
    }
  }
}

module.exports = ApontaConsumoController;

const QUERY_LEITURAS_DISPONIVEIS = "SELECT LeiturasVerifica.LeituraId, LeiturasVerifica.DataLeitura, LeiturasVerifica.Contador FROM ( SELECT dbo.SLTELLeitura.LeituraId, dbo.SLTELLeitura.DataLeitura, dbo.SLTELLeitura.QuantidadeTotal AS Contador FROM dbo.SLTELLeitura INNER JOIN dbo.PontoVenda ON dbo.SLTELLeitura.Matricula = dbo.PontoVenda.EquiCod WHERE ( ( (dbo.SLTELLeitura.DataLeitura) >= DateAdd(d, -15, ?) And (dbo.SLTELLeitura.DataLeitura) <= DateAdd(d, 45, ?) ) AND ((dbo.PontoVenda.EquiCod) = ?) AND ((dbo.PontoVenda.GrpVen) = ?) AND ((dbo.PontoVenda.PdvStatus) = 'A') AND ((dbo.PontoVenda.AnxId) = ?) ) ) as LeiturasVerifica ORDER BY LeiturasVerifica.DataLeitura"