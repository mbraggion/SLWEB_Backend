"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class PontosDeVendaController {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const pdvs = await Database.raw(QUERY_PDVS, [verified.grpven])

      response.status(200).send({
        PDVs: pdvs,
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'PontosDeVendaController.Show',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const type = params.type
    const PdvId = params.pdvid
    const AnxId = params.anxid

    try {
      const verified = seeToken(token);

      let data = null

      switch (type) {
        case 'basic':
          const infoBasica = await Database.raw(QUERY_PDV, [verified.grpven, verified.grpven, PdvId, AnxId])
          const depositos = await Database.select('*').from('dbo.Deposito').where({ GrpVen: verified.grpven })
          const configuracoes = await Database.select('*').from('dbo.CfgCad').where({ GrpVen: verified.grpven })

          data = {
            cadastro: infoBasica[0],
            depositos: depositos,
            configuracoes: configuracoes,
          }
          break
        case 'config':
          let cpdv = await Database.raw(QUERY_CONFIG_PDV, [verified.grpven, PdvId, AnxId])
          let ccab = await Database.select('CfgId', 'CfgDesc').from('dbo.CfgCad').where({ GrpVen: verified.grpven, CfgStatus: 'A' })
          let cdet = await Database.select('CfgId', 'PvpSel as Sel', 'ProdId', 'TveId as TipoVenda', 'RecId').from('dbo.CfgDet').where({ GrpVen: verified.grpven })

          let prodPCfg = await Database.raw(QUERY_PRODUTOS_CONFIGURACAO)
          let tiposVenda = await Database.select('TveId', 'TveDesc').from('dbo.TipoVenda')
          let receitas = await Database.select('RecId', 'RecDesc').from('dbo.Receita').where({ GrpVen: verified.grpven, RecStatus: 'A' })

          for(let i = 0; i < receitas.length; i++) {
            let aux = await Database.raw('select G.GprdDesc, R.RdetQtd, G.GprdUn from dbo.ReceitaDet as R inner join dbo.GruposInsumo as G on R.GprdId = G.GprdId where GrpVen = ? and R.RecId = ?',[verified.grpven, receitas[i].RecId])
          
            receitas[i].det = aux
          }

          data = {
            CfgPdv: cpdv,
            CfgPadrao: ccab.map(cab => { return ({ ...cab, Produtos: cdet.filter(det => det.CfgId === cab.CfgId) }) }),
            Produtos: prodPCfg,
            TiposVenda: tiposVenda,
            Receitas: receitas
          }
          break
        case 'equip':
          const EquipsDisp = await Database.raw(QUERY_EQSDISP, [verified.grpven])

          data = { EqsDisp: EquipsDisp }
          break
      }

      response.status(200).send({
        Dados: data
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'PontosDeVendaController.See',
      })
    }
  }

  async InativPDV({ request, response }) {
    const token = request.header("authorization");
    const { PdvId, AnxId, Status } = request.only(['PdvId', 'AnxId', 'Status'])

    try {
      const verified = seeToken(token);

      const hoje = new Date()

      //se for ativar, verificar se já não tem outro PDV com aquele EQ
      const pdvsAtivosComEq = await Database.raw(QUERY_PDVS_ATIVOS_COM_EQCOD, [verified.grpven, AnxId, PdvId])

      if (pdvsAtivosComEq[0].MaxPdvsAtivosComEquiCod > 0 && Status === 'A') {
        throw new Error()
      }

      await Database.table("dbo.PontoVenda")
        .where({
          GrpVen: verified.grpven,
          PdvId: PdvId,
          AnxId: AnxId,
        })
        .update({
          PdvStatus: Status,
          PdvDataAlteracao: hoje,
          PdvDtSolicEncerra: Status === 'I' ? hoje : null,
          PdvDataEncerramento: Status === 'I' ? hoje : null,
        });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'PontosDeVendaController.InativPDV',
      })
    }
  }

  async Update({ request, response, params }) {
    const token = request.header("authorization");

    const PdvId = params.pdvid
    const AnxId = params.anxid
    const type = params.type

    const { UpdatedData } = request.only(['UpdatedData'])

    try {
      const verified = seeToken(token);
      let retorno = null

      switch (type) {
        case 'basic':
          await Database.table("dbo.PontoVenda")
            .where({
              GrpVen: verified.grpven,
              PdvId: PdvId,
              AnxId: AnxId,
            })
            .update({
              DepId: UpdatedData.PDV.DepId,
              CfgId: UpdatedData.PDV.CfgId,
              PdvLogradouroPV: UpdatedData.PDV.PdvLogradouroPV,
              PdvNumeroPV: UpdatedData.PDV.PdvNumeroPV,
              PdvComplementoPV: UpdatedData.PDV.PdvComplementoPV,
              PdvBairroPV: UpdatedData.PDV.PdvBairroPV,
              PdvCidadePV: UpdatedData.PDV.PdvCidadePV,
              PdvUfPV: UpdatedData.PDV.PdvUfPV,
              PdvCEP: UpdatedData.PDV.PdvCEP,
              PdvDepartamento: UpdatedData.PDV.PdvDepartamento,
              PdvObs: UpdatedData.PDV.PdvObs,
              PdvMotivoEncerramento: UpdatedData.PDV.PdvMotivoEncerramento,
              PdvConsMin: UpdatedData.PDV.PdvConsMin,
              PdvConsValor: UpdatedData.PDV.PdvConsValor,
              PdvConsDose: UpdatedData.PDV.PdvConsDose,
              PdvSomaCompartilhado: UpdatedData.PDV.PdvSomaCompartilhado,
              PdvDataAlteracao: new Date()
            });

          await Database.table("dbo.Anexos")
            .where({
              GrpVen: verified.grpven,
              AnxId: AnxId,
            })
            .update({
              AnxFatMinimo: UpdatedData.PDV.AnxFatMinimo,
              AnxCalcMinPor: UpdatedData.PDV.AnxCalcMinPor,
              AnxTipMin: UpdatedData.PDV.AnxTipMin,
            });
          break;
        case 'config':
          await Database.table("dbo.PVPROD")
            .where({
              GrpVen: verified.grpven,
              PdvId: PdvId,
              AnxId: AnxId,
            })
            .delete();

          UpdatedData.CFG.forEach(async (cfg) => {
            await Database.insert({
              GrpVen: verified.grpven,
              AnxId: AnxId,
              PdvId: PdvId,
              PvpSel: Number.parseInt(cfg.Sel),
              ProdId: Number.parseInt(cfg.ProdId),
              TveId: Number.parseInt(cfg.TipoVenda),
              PvpVvn1: Number.parseFloat(cfg.Valor_1),
              PvpVvn2: Number.parseFloat(cfg.Valor_2),
              FlgAlt: 'N',
              RecId: Number.parseInt(cfg.RecId),
            }).into('dbo.PVPROD');
          })

          break;
        case 'equip':
          const equi = await Database
            .select('*')
            .from('dbo.Equipamento')
            .where({
              EquiCod: UpdatedData.NewEquip
            })

          //inativa pdv's com a máquina
          await Database.table("dbo.PontoVenda")
            .where({
              EquiCod: UpdatedData.NewEquip,
            })
            .update({
              PdvStatus: "I",
            })

          //inativa pdv com a máquina atual
          await Database.table("dbo.PontoVenda")
            .where({
              GrpVen: verified.grpven,
              PdvId: PdvId,
              AnxId: AnxId,
            })
            .update({
              PdvStatus: "I",
            })

          //encontra o numero do proximo pdv
          const maxPdvId = await Database.raw("select IIF(MAX(PdvId) is null, '1',MAX(PdvId)+1) as MaxPdvId from dbo.PontoVenda where GrpVen = ? and AnxId = ?", [verified.grpven, AnxId])
          const hoje = new Date()
          retorno = maxPdvId[0].MaxPdvId

          //copia o pdv novo
          await Database.raw(
            QUERY_UPDATE_PDV_1,
            [maxPdvId[0].MaxPdvId, AnxId, equi[0].EquiCod, equi[0].IMEI, equi[0].EquiCod, equi[0].EquiDesc, verified.grpven, PdvId, AnxId]
          )

          //atualiza alguns dados no pdv novo
          await Database.raw(
            QUERY_UPDATE_PDV_2,
            [hoje, hoje, hoje, verified.grpven, maxPdvId[0].MaxPdvId, AnxId]
          )

          //copia a config do pdv antigo para o novo
          await Database.raw(
            QUERY_UPDATE_PDV_3,
            [AnxId, maxPdvId[0].MaxPdvId, verified.grpven, PdvId, AnxId]
          )

          break;
      }

      response.status(200).send({
        payback: retorno
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'PontosDeVendaController.Update',
      })
    }
  }
}

module.exports = PontosDeVendaController;

const QUERY_PDVS = "select P.PdvId, P.AnxId, P.AnxDesc, P.EquiCod, P.PdvDataAtivacao, P.PdvStatus from dbo.PontoVenda as P where P.GrpVen = ? order by PdvDataAtivacao DESC"

const QUERY_PDV = "select P.PdvStatus, A.CNPJss, P.DepId, P.CfgId, P.EQUIPMOD_Desc, P.EquiCod, P.IMEI, P.AnxDesc, P.PdvLogradouroPV, P.PdvNumeroPV, P.PdvBairroPV, P.PdvDepartamento, P.PdvComplementoPV, P.PdvCidadePV, P.PdvUfPV, P.PdvCEP, P.PdvObs, P.PdvDataAtivacao, P.PdvDataEncerramento, P.PdvDataAlteracao, P.PdvMotivoEncerramento, P.PdvConsMin, P.PdvConsValor, P.PdvConsDose, P.PdvSomaCompartilhado, A.AnxFatMinimo, A.AnxCalcMinPor, A.AnxTipMin from dbo.PontoVenda as P inner join dbo.Anexos as A on P.AnxId = A.AnxId and A.GrpVen = ? where P.GrpVen = ? and P.PdvId = ? and P.AnxId = ?"
const QUERY_EQSDISP = "select EquiCod, EquiDesc from dbo.Equipamento where EquiCod not in ( select EquiCod from dbo.PontoVenda where PdvStatus = 'A' ) and GrpVen = ?"
const QUERY_CONFIG_PDV = "select PvpSel as Sel, ProdId, TveId as TipoVenda, PvpVvn1 as Valor_1, PvpVvn2 as Valor_2, RecId from dbo.PVPROD where GrpVen = ? and PdvId = ? and AnxId = ?"
const QUERY_PRODUTOS_CONFIGURACAO = "SELECT dbo.Produtos.ProdId, dbo.Produtos.Produto, dbo.Produtos.RecId FROM dbo.Produtos WHERE (((dbo.Produtos.PrGrupo) Like 'DOSE%') AND ((dbo.Produtos.Venda)='S')) OR (((dbo.Produtos.ProdId)='12709') AND ((dbo.Produtos.Venda)='S'))"
const QUERY_PDVS_ATIVOS_COM_EQCOD = "select COUNT(EquiCod) as MaxPdvsAtivosComEquiCod from dbo.PontoVenda where EquiCod = ( select EquiCod from dbo.PontoVenda where GrpVen = ? and AnxId = ? and PdvId = ? ) and PdvStatus = 'A'"

const QUERY_UPDATE_PDV_1 = "INSERT INTO dbo.PontoVenda ( GrpVen, PdvId, AnxId, ConId, AnxDesc, CNPJ, PdvStatus, EquiCod, IMEI, PdvDepartamento, PdvLogradouroPV, PdvNumeroPV, PdvComplementoPV, PdvBairroPV, PdvCidadePV, PdvUfPV, PdvCEP, DepId, CfgId, PdvConsMin, PdvConsValor, PdvConsDose, PdvDataSolicitacao, PdvDataInclusao, PdvDataAtivacao, PdvDataAlteracao, PdvDtSolicEncerra, PdvDataEncerramento, PdvDtEmisUFat, PdvDataUltFat, PdvMotivoEncerramento, PdvObs, GfaId, GsaId, PdvEmiteFicha, PdvAluguelVlr, pdvCodAnt, PdvGeraUltFat, PdvVlrAcessorios, PdvFoiTroca, PdvIniciaAutoCobraMin, PdvDtIniciaAutoCobraMin, CcuID, PdvTabelaPrecoSnacks, PdvSeq, PdvSomaCompartilhado, TAS_Id, TFC_ID, FlgAlt, POS, TprId, EquiMatr, EQUIPMOD_Desc ) SELECT P.GrpVen, ?, ?, P.ConId, P.AnxDesc, P.CNPJ, 'A', ?, ?, P.PdvDepartamento, P.PdvLogradouroPV, P.PdvNumeroPV, P.PdvComplementoPV, P.PdvBairroPV, P.PdvCidadePV, P.PdvUfPV, P.PdvCEP, P.DepId, P.CfgId, P.PdvConsMin, P.PdvConsValor, P.PdvConsDose, P.PdvDataSolicitacao, P.PdvDataInclusao, P.PdvDataAtivacao, P.PdvDataAlteracao, P.PdvDtSolicEncerra, P.PdvDataEncerramento, P.PdvDtEmisUFat, P.PdvDataUltFat, P.PdvMotivoEncerramento, P.PdvObs, P.GfaId, P.GsaId, P.PdvEmiteFicha, P.PdvAluguelVlr, P.pdvCodAnt, P.PdvGeraUltFat, P.PdvVlrAcessorios, P.PdvFoiTroca, P.PdvIniciaAutoCobraMin, P.PdvDtIniciaAutoCobraMin, P.CcuID, P.PdvTabelaPrecoSnacks, P.PdvSeq, P.PdvSomaCompartilhado, P.TAS_Id, P.TFC_ID, P.FlgAlt, P.POS, P.TprId, ?, ? FROM dbo.PontoVenda AS P WHERE P.GrpVen = ? AND P.PdvId = ? AND P.AnxId = ?"
const QUERY_UPDATE_PDV_2 = "UPDATE dbo.PontoVenda SET PdvDataSolicitacao = ?, PdvDataInclusao = ?, PdvDataAtivacao = ?, PdvObs = 'Inserido pelo SLWEB', PdvMotivoEncerramento = '', PdvDataEncerramento = NULL WHERE GrpVen = ? AND PdvId = ? AND AnxId = ?"
const QUERY_UPDATE_PDV_3 = "INSERT INTO dbo.PVPROD( GrpVen, AnxId, PdvId, PvpSel, ProdId, TveId, PvpVvn1, PvpVvn2, FlgAlt, RecId ) SELECT PV.GrpVen, ?, ?, PV.PvpSel, PV.ProdId, PV.TveId, PV.PvpVvn1, PV.PvpVvn2, PV.FlgAlt, PV.RecId FROM dbo.PVPROD AS PV WHERE PV.GrpVen = ? AND PV.PdvId = ? AND PV.AnxId = ?"