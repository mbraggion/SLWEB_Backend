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
    const DepId = Number(params.depid)
    const Ref = params.ref
    const EquiCod = params.equicod

    try {
      const verified = seeToken(token);

      const produtos = await Database.raw("execute dbo.sp_ApontaConsumo1 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?", [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc])
      const consumos = await Database.raw("execute dbo.sp_ApontaConsumo2 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?", [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc])

      const consumoGravado = await Database
        .select('ProdId', 'Produto', 'D_QUANT')
        .from('dbo.SDBase')
        .where({
          GRPVEN: verified.grpven,
          F_SERIE: 'CON',
          DEPDEST: DepId,
          RefDt: Ref,
          M0_TIPO: 'S',
          PvTipo: 'C',
          EquiCod: EquiCod
        })

      response.status(200).send({
        Produtos: produtos,
        Consumos: consumos,
        consumoGravado: consumoGravado.length > 0,
        consumoGravadoQtds: consumoGravado
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
    const { Consumo, Zerado, IMEI, EquiCod, ref1, ref2 } = request.only(['Consumo', 'Zerado', 'IMEI', 'EquiCod', 'ref1', 'ref2'])
    let DepId = params.depid
    const Ref = params.ref

    try {
      const verified = seeToken(token);

      // verificar se o pdv tem depid
      if (DepId === null) {
        throw new Error('ID do depósito indefinido')
      }

      DepId = Number(DepId)

      // verificar se o cara não está tentando lançar movimentação no depósito 1
      if (DepId === 1) {
        throw new Error('Não é possivel fazer apontamento de consumo no depósito 1')
      }

      let DOC = null

      let lastDOC = await Database.raw("SELECT Max(S.DOC) AS DOC FROM dbo.SDBase as S WHERE ( ((S.F_SERIE) = 'CON') AND ((S.M0_TIPO) = 'S') AND ((S.PvTipo) = 'C') AND ((S.D_FILIAL) = ?) )", [verified.user_code])

      DOC = lastDOC.length > 0 ? Number(lastDOC[0].DOC) + 1 : 1

      let LeiturasConsumoMatPrimaPK = {
        D_FILIAL: verified.user_code,
        F_SERIE: 'CON',
        DOC: DOC,
        M0_TIPO: 'S',
        Consumo: null,
      }

      await Database.raw("DELETE FROM dbo.SDBase where (M0_TIPO = ?) AND (DOC = ?) AND (F_SERIE = ?) AND (D_FILIAL = ?)", [LeiturasConsumoMatPrimaPK.M0_TIPO, LeiturasConsumoMatPrimaPK.DOC, LeiturasConsumoMatPrimaPK.F_SERIE, LeiturasConsumoMatPrimaPK.D_FILIAL])

      for (let index in Consumo) {
        let aGravar = {
          D_FILIAL: LeiturasConsumoMatPrimaPK.D_FILIAL,
          F_SERIE: LeiturasConsumoMatPrimaPK.F_SERIE,
          DOC: LeiturasConsumoMatPrimaPK.DOC,
          D_DOC: LeiturasConsumoMatPrimaPK.DOC,
          D_ITEM: Consumo[index].GprdId,
          M0_TIPO: LeiturasConsumoMatPrimaPK.M0_TIPO,
          PvTipo: 'C',
          DEPDEST: DepId,
          DtEmissao: moment().toDate(),
          ProdId: Consumo[index].ProdId,
          Produto: Consumo[index].Produto,
          D_UM: Consumo[index].GprdUn,
          D_QUANT: Zerado === 'S' ? Consumo[index].TotalConsumo : Consumo[index].Con,
          D_EMISSAO: moment().format('DDMMYYYY'),
          D_TOTAL: 0,
          D_PRCVEN: 0,
          GRPVEN: verified.grpven,
          C5_ZZADEST: DepId,
          A1_NOME: `Equipamento: ${EquiCod}(consumo de ${moment(ref1).format('DD/MM/YYYY')} a ${moment(ref2).format('DD/MM/YYYY')})`,
          EquiCod: EquiCod,
          IMEI: IMEI,
          RefDt: Ref
        }


        await Database.insert(aGravar).into('dbo.SDBase')
      }

      const consumoGravado = await Database
        .select('ProdId', 'Produto', 'D_QUANT')
        .from('dbo.SDBase')
        .where({
          GRPVEN: verified.grpven,
          F_SERIE: 'CON',
          DEPDEST: DepId,
          RefDt: Ref,
          M0_TIPO: 'S',
          PvTipo: 'C',
          EquiCod: EquiCod
        })

      response.status(200).send({
        consumoGravadoQtds: consumoGravado
      });
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

  async Destroy({ request, response, params }) {
    const token = request.header("authorization");
    let DepId = params.depid
    const Ref = params.ref
    const EquiCod = params.equicod

    try {
      const verified = seeToken(token);

      // verificar se o pdv tem depid
      if (DepId === null) {
        throw new Error('ID do depósito indefinido')
      }

      DepId = Number(DepId)

      await Database.table("dbo.SDBase")
        .where({
          GRPVEN: verified.grpven,
          F_SERIE: 'CON',
          M0_TIPO: 'S',
          PvTipo: 'C',
          DEPDEST: DepId,
          EquiCod: EquiCod,
          RefDt: Ref
        })
        .delete()

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ApontaConsumoController.Destroy',
      })
    }
  }
}

module.exports = ApontaConsumoController;

const QUERY_LEITURAS_DISPONIVEIS = "SELECT LeiturasVerifica.LeituraId, LeiturasVerifica.DataLeitura, LeiturasVerifica.Contador FROM ( SELECT dbo.SLTELLeitura.LeituraId, dbo.SLTELLeitura.DataLeitura, dbo.SLTELLeitura.QuantidadeTotal AS Contador FROM dbo.SLTELLeitura INNER JOIN dbo.PontoVenda ON dbo.SLTELLeitura.Matricula = dbo.PontoVenda.EquiCod WHERE ( ( (dbo.SLTELLeitura.DataLeitura) >= DateAdd(d, -15, ?) And (dbo.SLTELLeitura.DataLeitura) <= DateAdd(d, 45, ?) ) AND ((dbo.PontoVenda.EquiCod) = ?) AND ((dbo.PontoVenda.GrpVen) = ?) AND ((dbo.PontoVenda.PdvStatus) = 'A') AND ((dbo.PontoVenda.AnxId) = ?) ) ) as LeiturasVerifica ORDER BY LeiturasVerifica.DataLeitura"