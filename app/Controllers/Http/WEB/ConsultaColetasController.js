'use strict'

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index")
moment.locale("pt-br");

class ConsultaColetasController {
  /** @param {object} ctx
 * @param {import('@adonisjs/framework/src/Request')} ctx.request
 */
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const coletas = await Database.raw(queryColetas, [verified.grpven, verified.grpven])

      const equipamentos = await Database.raw(queryEquipamentos, [verified.grpven])

      response.status(200).send({
        Coletas: coletas,
        Equipamentos: equipamentos
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'ConsultaColetasController.Show',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const AnxId = params.anxid
    const PdvId = params.pdvid
    const FSeq = params.fseq

    try {
      const verified = seeToken(token);

      const detalhes = await Database.raw(queryColetasDetalhes, [AnxId, PdvId, FSeq, verified.grpven])

      response.status(200).send({
        Detalhes: detalhes
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ConsultaColetasController.See',
      })
    }
  }

  async CalcMin({ request, response, params }) {
    const token = request.header("authorization");
    const Equicod = params.Equicod

    try {
      const verified = seeToken(token);

      const dadosParaCalculoDeMinimo = await Database.raw(queryCalculoDeMinimo, [verified.grpven, Equicod])
      const faixaDeConsumo = await Database.select('*')
        .from('dbo.AnexosFaixasConsumo')
        .where({
          GrpVen: verified.grpven,
          AnxId: dadosParaCalculoDeMinimo[0].AnxId
        })

      response.status(200).send({
        DadosParaCalculoDeMinimo: dadosParaCalculoDeMinimo[0],
        FaixaDeConsumo: faixaDeConsumo.map(f => ({
          Inicio: f.AFCIni,
          Fim: f.AFCFin,
          Porcentagem: f.AFCPorc
        }))
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ConsultaColetasController.CalcMin',
      })
    }
  }

  async NovaColetaOptions({ request, response, params }) {
    const token = request.header("authorization");
    const EquiCod = params.equicod
    const AnxId = params.anxid

    try {
      const verified = seeToken(token);

      const ultimaColeta = await Database.raw(queryUltimaColeta, [verified.grpven, verified.grpven, EquiCod])

      let leiturasDisponiveis

      if (ultimaColeta.length > 0) {
        leiturasDisponiveis = await Database.raw(queryLeiturasDisponiveis, [ultimaColeta[0].LeituraId, EquiCod, verified.grpven, AnxId])
      } else {
        leiturasDisponiveis = await Database.raw(queryLeiturasDisponiveis, ['0', EquiCod, verified.grpven, AnxId])
      }


      response.status(200).send({
        UltColeta: ultimaColeta,
        LeiturasDisponiveis: leiturasDisponiveis
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ConsultaColetasController.NovaColetaOptions',
      })
    }
  }

  async CalcColetas({ request, response, params }) {
    const token = request.header("authorization");
    const leitIniID = params.l1id;
    const leitFimID = params.l2id;
    const AnxId = params.anxid;
    const PdvId = params.pdvid;

    try {
      const verified = seeToken(token);

      const coletaInicial = await Database.raw(queryLeituraDetalhes, [leitIniID, AnxId, PdvId, verified.grpven])
      const coletaFinal = await Database.raw(queryLeituraDetalhes, [leitFimID, AnxId, PdvId, verified.grpven])

      let finalArray = []

      coletaFinal.forEach((element, index) => {
        finalArray.push({
          Selecao: element.Selecao,
          Real: {
            Ant: coletaInicial[index] ? Number(coletaInicial[index].QuantidadeVendaPaga) : 0,
            Agr: Number(element.QuantidadeVendaPaga),
          },
          Teste: {
            Ant: coletaInicial[index] ? Number(coletaInicial[index].QuantidadeVendaTeste) : 0,
            Agr: Number(element.QuantidadeVendaTeste),
          },
          Consumo: {
            Real: Number(element.QuantidadeVendaPaga) - (coletaInicial[index] ? Number(coletaInicial[index].QuantidadeVendaPaga) : 0),
            Teste: Number(element.QuantidadeVendaTeste) - (coletaInicial[index] ? Number(coletaInicial[index].QuantidadeVendaTeste) : 0),
          },
          PV1: element.PvpVvn1,
          PV2: element.PvpVvn2,
          Produto: element.Produto,
          ProdId: element.ProdId,
          TveId: element.TveId
        })
      })

      response.status(200).send({
        Coleta: finalArray
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ConsultaColetasController.CalcColetas',
      })
    }
  }

  async GravaColeta({ request, response }) {
    const token = request.header("authorization");

    const { Detalhes, Doses, Margem, Zerou, Ref } = request.only(['Detalhes', 'Doses', 'Margem', 'Zerou', 'Ref'])

    try {
      const verified = seeToken(token);

      const ultimasSequencia = await Database
        .raw(
          "select MAX(FfmSeq) as MaxSequencia from dbo.FichFatM where GrpVen = ? and PdvId = ? and AnxId = ? and EquiCod = ?",
          [verified.grpven, Detalhes.PdvId, Detalhes.AnxId, Detalhes.EquiCod]
        )

      const ultimasSequenciaMes = await Database
        .raw(
          "select MAX(FfmSeqM) as MaxSequenciaMes from dbo.FichFatM where GrpVen = ? and PdvId = ? and AnxId = ? and EquiCod = ? and FfmRef = CONVERT(smalldatetime, ?, 101)",
          [verified.grpven, Detalhes.PdvId, Detalhes.AnxId, Detalhes.EquiCod, moment(Ref).subtract(3, "hours").toDate()]
        )

      await Database.insert({
        GrpVen: verified.grpven,
        AnxId: Detalhes.AnxId,
        PdvId: Detalhes.PdvId,
        FfmSeq: ultimasSequencia[0] && ultimasSequencia[0].MaxSequencia !== null ? Number(ultimasSequencia[0].MaxSequencia) + 1 : 1,
        FfmRef: moment(Ref).subtract(3, "hours").toDate(),
        FfmSeqM: ultimasSequenciaMes[0] && ultimasSequenciaMes[0].MaxSequenciaMes !== null ? Number(ultimasSequenciaMes[0].MaxSequenciaMes) + 1 : 1,
        CNPJ: String(Detalhes.CNPJ).replace(/([-,./])/g, ''),
        ConId: Detalhes.ConId,
        EquiCod: Detalhes.EquiCod,
        FfmDtGeracao: Margem.ate,
        FfmDtColetaAnt: Detalhes.UltimaColeta,
        FfmDtColeta: Margem.ate,
        FfmCNTAnt: Detalhes.ContadorAnterior === null ? 0 : Detalhes.ContadorAnterior,
        FfmCNT: Margem.ateCont,
        FfmContadorDiferenca: 0,
        FfmSomaGratis: 0,
        FfmSomaPago: 0,
        FfmSomaProva: 0,
        FfmSomaQtdFaturar: 0,
        FfmSelZero: Zerou,
        FfmMoedeiroZero: 'S',
        FfmColeta: 'S',
        LeituraId: Margem.ateID
      }).into('dbo.FichFatM')

      Doses.forEach(async (dose) => {
        await Database.insert({
          GrpVen: verified.grpven,
          AnxId: Detalhes.AnxId,
          PdvId: Detalhes.PdvId,
          FfmSeq: ultimasSequencia[0] && ultimasSequencia[0].MaxSequencia !== null ? Number(ultimasSequencia[0].MaxSequencia) + 1 : 1,
          PvpSel: dose.Selecao,
          FfdGratis: 0,
          FfdPago: dose.Real.Agr,
          FfdProva: dose.Teste.Agr,
          FfdQtdFaturar: Zerou === 'N' ? dose.Consumo.Real : dose.Real.Agr,
          ProdId: dose.ProdId,
          FfdPcr: null,
          FfdVvn: '0.00',
          TveId: dose.TveId,
          PvpVvn1: dose.PV1,
          PvpVvn2: dose.PV2,
          FfdInc: null,
          RecId: null,
          PorcCons: 0
        }).into('dbo.FichFatD')
      });

      response.status(200).send({ message: 'Coleta gravada com sucesso' })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'ConsultaColetasController.GravaColeta',
      })
    }
  }

  async Delete({ request, response, params }) {
    const token = request.header("authorization");

    const { EquiCod, AnxId, PdvId, FfmSeq } = params

    try {
      const verified = seeToken(token);

      await Database.table("dbo.FichFatM")
        .where({
          GrpVen: verified.grpven,
          EquiCod: EquiCod,
          AnxId: AnxId,
          PdvId: PdvId,
          FfmSeq: FfmSeq
        })
        .delete();

      await Database.table("dbo.FichFatD")
        .where({
          GrpVen: verified.grpven,
          AnxId: AnxId,
          PdvId: PdvId,
          FfmSeq: FfmSeq
        })
        .delete();

      response.status(200).send({
        message: 'Coleta deletada com sucesso'
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'ConsultaColetasController.Delete',
      })
    }
  }
}

module.exports = ConsultaColetasController

const queryColetas = 'SELECT dbo.FichFatM.GrpVen, dbo.FichFatM.AnxId, dbo.FichFatM.PdvId, dbo.FichFatM.EquiCod, dbo.FichFatM.FfmSeq, dbo.FichFatM.FfmRef AS Ref, dbo.FichFatM.FfmSeqM AS SeqMês, dbo.Anexos.AnxDesc AS Anexo, dbo.Anexos.CNPJ AS CNPJ,dbo.CalculaFat.CalcFatDesc AS Cálculo, dbo.FichFatM.FfmDtColetaAnt AS ColeteAnterior, dbo.FichFatM.FfmDtColeta AS DataColeta, dbo.FichFatM.FfmCNTAnt AS ContAnterior, dbo.FichFatM.FfmCNT AS Contador, dbo.FichFatM.FfmSelZero FROM ( dbo.FichFatM INNER JOIN dbo.Anexos ON dbo.FichFatM.AnxId = dbo.Anexos.AnxId ) INNER JOIN dbo.CalculaFat ON dbo.Anexos.CalcFatId = dbo.CalculaFat.CalcFatId WHERE dbo.FichFatM.GrpVen = ? AND dbo.Anexos.GrpVen = ? ORDER BY Ref DESC, SeqMês DESC'

const queryEquipamentos = "SELECT dbo.Anexos.GrpVen, dbo.Anexos.AnxDesc, dbo.Anexos.CNPJss, dbo.PontoVenda.EquiCod, dbo.PontoVenda.IMEI, dbo.PontoVenda.PdvDataAtivacao, dbo.PontoVenda.PdvStatus, dbo.PontoVenda.AnxId, dbo.PontoVenda.PdvId, dbo.PontoVenda.ConId FROM dbo.Anexos INNER JOIN dbo.PontoVenda ON (dbo.Anexos.AnxId = dbo.PontoVenda.AnxId) AND ( dbo.Anexos.GrpVen = dbo.PontoVenda.GrpVen ) WHERE ( ((dbo.Anexos.GrpVen) = ?) AND ((dbo.PontoVenda.PdvStatus) = 'A') ) ORDER BY dbo.Anexos.AnxDesc, dbo.PontoVenda.EquiCod"

const queryColetasDetalhes = 'SELECT D.AnxId, D.PdvId, D.FfmSeq, D.PvpSel, D.FfdPago, D.FfdQtdFaturar, D.ProdId, D.TveId, D.PvpVvn1, D.PvpVvn2, P.Produto FROM FichFatD AS D left join dbo.Produtos as P on P.ProdId = D.ProdId WHERE D.AnxId=? AND D.PdvId=? AND D.FfmSeq=? and GrpVen = ?'

const queryUltimaColeta = "SELECT top(1) dbo.FichFatM.FfmDtColeta AS UltimaColeta, SUM(dbo.FichFatM.FfmSeq + 1) as ProximaColeta, dbo.FichFatM.FfmCNT as ContadorAnterior, SUM(dbo.FichFatM.FfmSeqM + 1) as ProximaColetaMes, dbo.FichFatM.FfmSelZero as Zerou, dbo.FichFatM.LeituraId FROM ( dbo.FichFatM INNER JOIN dbo.Anexos ON dbo.FichFatM.AnxId = dbo.Anexos.AnxId ) INNER JOIN dbo.CalculaFat ON dbo.Anexos.CalcFatId = dbo.CalculaFat.CalcFatId WHERE dbo.FichFatM.GrpVen = ? AND dbo.Anexos.GrpVen = ? AND dbo.FichFatM.EquiCod = ? group by dbo.FichFatM.FfmDtColeta, dbo.FichFatM.FfmCNT, dbo.FichFatM.FfmSelZero, dbo.FichFatM.LeituraId order by dbo.FichFatM.FfmDtColeta desc"

const queryLeiturasDisponiveis = "SELECT dbo.SLTELLeitura.LeituraId, dbo.SLTELLeitura.DataLeitura, dbo.SLTELLeitura.QuantidadeTotal AS Contador FROM dbo.SLTELLeitura INNER JOIN dbo.PontoVenda ON dbo.SLTELLeitura.Matricula = dbo.PontoVenda.EquiCod WHERE ( ((dbo.SLTELLeitura.LeituraId) >= ?) AND ((dbo.PontoVenda.EquiCod) = ?) AND ((dbo.PontoVenda.GrpVen) = ?) AND ((dbo.PontoVenda.PdvStatus) = 'A') AND ((dbo.PontoVenda.AnxId) = ?) ) order by LeituraId ASC"

const queryLeituraDetalhes = "SELECT LS.Selecao, LS.QuantidadeVendaPaga, LS.QuantidadeVendaTeste, PV.PvpVvn1, PV.PvpVvn2, P.Produto, P.ProdId, PV.TveId FROM dbo.SLTEL_LeituraSelecao AS LS left join dbo.PVPROD as PV on LS.Selecao = PV.PvpSel left join dbo.Produtos as P on PV.ProdId  = P.ProdId WHERE LS.LeituraId = ? and PV.AnxId = ? and PV.PdvId = ? AND PV.GrpVen = ?"

const queryCalculoDeMinimo = "select A.AnxId, P.PdvConsMin, P.PdvConsValor, P.PdvConsDose, P.PdvSomaCompartilhado, A.CalcFatId, A.AnxDiaFecha, A.AnxProRata, A.AnxFatMinimo, A.AnxCalcMinPor, A.AnxTipMin, A.AnxMinMoeda, A.ProdId,A.AnxVlrUnitMin from dbo.PontoVenda as P inner join dbo.Anexos as A on P.AnxId = A.AnxId and P.GrpVen = A.GrpVen where P.GrpVen = ? and P.PdvStatus = 'A' and P.EquiCod = ?"
