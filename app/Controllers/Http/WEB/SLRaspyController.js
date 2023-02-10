"use strict";
const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index")
const GerarExcel = require("../../../Services/excelExportService");
const Drive = use("Drive");
const Helpers = use("Helpers");

class SLRaspyController {
  async Show({ request, response, params }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const Anexos = await Database
        .select('AnxDesc', 'AnxId')
        .from('dbo.Anexos')
        .where({
          GrpVen: verified.grpven
        })

      response.status(200).send({
        anxs: Anexos
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'SLRaspyController.Show',
      })
    }
  }

  async Leituras({ request, response, params }) {
    const token = request.header("authorization");
    const anxid = params.anxid

    try {
      const verified = seeToken(token);

      const leit = await Database.raw(QUERY_LEITURAS_DISPONIVEIS, [anxid, verified.grpven])

      response.status(200).send({
        leituras: leit
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'SLRaspyController.Leituras',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const anxid = params.anxid
    const p1 = params.p1
    const p2 = params.p2

    try {
      const verified = seeToken(token);

      const raspyMes = await Database.raw("execute SLAPLIC.dbo.sp_VendasSLraspMes @GrpVen = ?, @AnxId = ?, @PedidoId1 = ?, @PedidoId2 = ?", [verified.grpven, anxid, p1, p2])
      const raspyDia = await Database.raw("execute SLAPLIC.dbo.sp_VendasSLraspDia @GrpVen = ?, @AnxId = ?, @PedidoId1 = ?, @PedidoId2 = ?", [verified.grpven, anxid, p1, p2])

      let raspyComTratamento = []

      raspyMes.forEach(rst => {
        const i = raspyComTratamento.findIndex(item => item.EquiCod === rst.EquiCod)

        if (i < 0) {
          raspyComTratamento.push({
            EquiCod: rst.EquiCod,
            Selecoes: [
              {
                Sel: rst.SEL,
                ProdId: rst.ProdId,
                Produto: rst.Produto,
                Qtd: rst.Qtd,
                Vlr: rst.Valor
              }
            ]
          })
        } else {
          let y = raspyComTratamento[i].Selecoes.findIndex(sel => sel.Sel === rst.SEL)

          // se já tem um produto com o mesmo ProdId
          if (y < 0) {
            raspyComTratamento[i]
              .Selecoes
              .push({
                Sel: rst.SEL,
                ProdId: rst.ProdId,
                Produto: rst.Produto,
                Qtd: rst.Qtd,
                Vlr: rst.Valor
              })
          } else {
            raspyComTratamento[i]
              .Selecoes[y] = {
              ...raspyComTratamento[i].Selecoes[y],
              Qtd: raspyComTratamento[i].Selecoes[y].Qtd + rst.Qtd,
              Vlr: raspyComTratamento[i].Selecoes[y].Vlr + rst.Valor
            }
          }
        }
      })

      raspyComTratamento.forEach((rct) => {
        rct.Selecoes.forEach((s) => {
          s.Hist = raspyDia
            .filter(rd =>
              rct.EquiCod === rd.EquiCod &&
              s.Sel === rd.SEL
            ).map(h => ({
              Dia: h.Dia,
              Mes: h.Mes,
              Ano: h.Ano,
              Qtd: h.Qtd,
              Vlr: h.Valor
            }))
        })
      })

      response.status(200).send({
        raspy: raspyComTratamento
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'SLRaspyController.See',
      })
    }
  }

  async GenExcel({ request, response, params }) {
    const token = request.header("authorization");
    const anxid = params.anxid
    const p1 = params.p1
    const p2 = params.p2

    try {
      const verified = seeToken(token);
      const filePath = Helpers.publicPath(`/tmp/RASPY_${verified.user_code}.xlsx`);
      let objToExcel = []

      const raspyMes = await Database.raw("execute SLAPLIC.dbo.sp_VendasSLraspMes @GrpVen = ?, @AnxId = ?, @PedidoId1 = ?, @PedidoId2 = ?", [verified.grpven, anxid, p1, p2])
      const raspyDia = await Database.raw("execute SLAPLIC.dbo.sp_VendasSLraspDia @GrpVen = ?, @AnxId = ?, @PedidoId1 = ?, @PedidoId2 = ?", [verified.grpven, anxid, p1, p2])
      const raspyDet = await Database.raw("execute SLAPLIC.dbo.sp_VendasSLraspDet @GrpVen = ?, @AnxId = ?, @PedidoId1 = ?, @PedidoId2 = ?", [verified.grpven, anxid, p1, p2])

      objToExcel.push({
        workSheetName: 'Vendas - Agrupadas por mês',
        workSheetColumnNames: ['Equipamento', 'Referência', 'Seleção', 'Produto ID', 'Produto', 'Qtd. Vendida', 'Vlr. Vendido'],
        workSheetData: raspyMes.map(r => ([r.EquiCod, `${r.Mes}/${r.Ano}`, r.SEL, r.ProdId, r.Produto, r.Qtd, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.Valor)]))
      })

      objToExcel.push({
        workSheetName: 'Vendas - Agrupadas por dia',
        workSheetColumnNames: ['Equipamento', 'Referência', 'Seleção', 'Produto ID', 'Produto', 'Qtd. Vendida', 'Vlr. Vendido'],
        workSheetData: raspyDia.map(r => ([r.EquiCod, `${r.Dia}/${r.Mes}/${r.Ano}`, r.SEL, r.ProdId, r.Produto, r.Qtd, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.Valor)])),
      })

      objToExcel.push({
        workSheetName: 'Vendas - Individuais',
        workSheetColumnNames: ['Equipamento', 'Referência', 'Seleção', 'Produto ID', 'Produto', 'Vlr. Vendido'],
        workSheetData: raspyDet.map(r => ([r.EquiCod, `${moment(r.DataPedido).format('L')}`, r.SEL, r.ProdId, r.Produto, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.Valor)])),
      })

      await GerarExcel(
        objToExcel,
        filePath
      )

      const location = await Drive.get(filePath);

      response.status(200).send(location);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'SLRaspyController.GerarExcel',
      })
    }
  }
}

module.exports = SLRaspyController;

const QUERY_LEITURAS_DISPONIVEIS = "select DtVenda, MIN(PedidoId) as PedidoId from SLAPLIC.dbo.SLRaspyPedido  as raspy inner join SLAPLIC.dbo.PontoVenda as PV on raspy.Matricula = PV.EquiCod and PV.AnxId = ? and PV.GrpVen = ? and raspy.DataPedido >= PV.PdvDataAtivacao GROUP BY DtVenda order by DtVenda desc"
