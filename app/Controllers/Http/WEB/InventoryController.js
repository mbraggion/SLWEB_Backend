"use strict";

const Database = use("Database");
const moment = require('moment')
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class InventoryController {
  async Show({ request, response, params }) {
    const token = request.header("authorization");
    const ref = decodeURI(params.ref)
    const depId = params.depid

    try {
      const verified = seeToken(token);

      const invCab = await Database
        .select('InvConcluido', 'InvId', 'DepId', 'InvDtLanca')
        .from('dbo.InventarioCab')
        .where({
          GrpVen: verified.grpven,
          InvDtMov: ref,
          DepId: depId
        })

      if (invCab.length === 0) {
        response.status(200).send({
          Inventario: {
            referencia: ref,
            status: 'ausente',
            InvId: null,
            InvDepId: null,
            InvDtLancamento: null,
            InvDetalhes: null
          }
        })

        return
      }

      // busco as movimentaçoes dos produtos
      let procMod = await queryInvDet(verified.grpven, depId, moment(ref).get('year'), moment(ref).get('month') + 1, verified.user_code, invCab[0].InvId)

      // busco os detalhes do inv e uno com as movimentacoes
      let invDet = await createDetObj(procMod, verified.grpven, invCab[0].InvId)

      // atualizo o invdet com o saldo dos fim das movimentacoes caso nao tenha nenhum ajuste e o inventário ainda esteja aberto
      for (let index in invDet) {
        if (invDet[index].InvAjQ === null && invCab[0].InvConcluido !== 'S') {
          await Database
            .table("dbo.InventarioDet")
            .where({
              GrpVen: verified.grpven,
              InvId: invCab[0].InvId,
              ProdId: invDet[index].ProdId
            })
            .update({
              InvQtd: invDet[index].Mov.filter(m => m.A1_NOME === "INVENTÁRIO FINAL")[0].SldAtu
            })

          invDet[index].InvQtd = invDet[index].Mov.filter(m => m.A1_NOME === "INVENTÁRIO FINAL")[0].SldAtu
        }
      }

      response.status(200).send({
        Inventario: {
          referencia: ref,
          status: invCab[0].InvConcluido === 'S' ? 'fechado' : 'aberto',
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

  async Store({ request, response, params }) {
    const token = request.header("authorization");
    const ref = decodeURI(params.ref)
    const depId = params.depid

    try {
      const verified = seeToken(token);

      const invCab = await Database
        .select('*')
        .from('dbo.InventarioCab')
        .where({
          GrpVen: verified.grpven,
          InvDtMov: ref,
          DepId: depId
        })

      if (invCab.length > 0) {
        throw new Error('Inventário já existe')
      }

      let proxInvId = null
      let ultInvId = await Database.raw("select MAX(InvId) as MaxInvId from dbo.InventarioCab where GrpVen = ?", [verified.grpven])

      proxInvId = ultInvId.length > 0 ? ultInvId[0].MaxInvId + 1 : 1

      await Database
        .insert({
          GrpVen: verified.grpven,
          InvId: proxInvId,
          DepId: depId,
          InvDtMov: ref,
          InvHrMov: ref,
          InvDesc: '',
          InvDtLanca: null,
          InvConcluido: 'N'
        })
        .into('dbo.InventarioCab')

      // roda proc pra buscar movimentacoes
      // let procMod = await queryInvDet(verified.grpven, depId, moment(ref).get('year'), moment(ref).get('month') + 1, verified.user_code, proxInvId)

      // for (let index in Object.keys(procMod)) {
      //   await Database
      //     .insert({
      //       GrpVen: verified.grpven,
      //       InvId: proxInvId,
      //       ProdId: procMod[Object.keys(procMod)[index]].ProdId,
      //       Produto: procMod[Object.keys(procMod)[index]].Produto,
      //       InvQtd: 0,
      //       InvVlrU: null,
      //       InvVlr: null,
      //       InvAjQ: null,
      //       InvJust: null
      //     })
      //     .into('dbo.InventarioDet')
      // }

      for (let index in prodsDefault) {
        await Database
          .insert({
            GrpVen: verified.grpven,
            InvId: proxInvId,
            ProdId: prodsDefault[index].ProdId,
            Produto: prodsDefault[index].Produto,
            InvQtd: 0,
          })
          .into('dbo.InventarioDet')
      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'InventoryController.Store',
      })
    }
  }

  async Ajustar({ request, response, params }) {
    const token = request.header("authorization");
    const { InvAjQ, InvJust } = request.only(['InvAjQ', 'InvJust'])
    const ref = decodeURI(params.ref)
    const depId = params.depid
    const prodId = params.prodid

    try {
      const verified = seeToken(token);

      const invCab = await Database
        .select('InvConcluido', 'InvId', 'DepId')
        .from('dbo.InventarioCab')
        .where({
          GrpVen: verified.grpven,
          InvDtMov: ref,
          DepId: depId
        })

      if (invCab[0].InvConcluido === 'S') {
        throw new Error('Inventário já concluído')
      }

      await Database.table("dbo.InventarioDet")
        .where({
          GrpVen: verified.grpven,
          InvId: invCab[0].InvId,
          ProdId: prodId
        })
        .update({
          InvAjQ: String(InvAjQ).trim() === '' ? null : InvAjQ,
          InvJust: String(InvJust).trim() === '' ? null : InvJust,
          InvQtd: String(InvAjQ).trim() !== '' && InvAjQ !== null ? InvAjQ : 0
        })

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'InventoryController.Ajustar',
      })
    }
  }

  async FechaInv({ request, response, params }) {
    const token = request.header("authorization");
    const ref = decodeURI(params.ref)
    const depId = params.depid

    try {
      const verified = seeToken(token);

      const invCab = await Database
        .select('*')
        .from('dbo.InventarioCab')
        .where({
          GrpVen: verified.grpven,
          InvDtMov: ref,
          DepId: depId
        })

      if (invCab[0].InvConcluido === 'S') {
        throw new Error('Inventário já concluído')
      }

      await Database
        .table("dbo.InventarioCab")
        .where({
          GrpVen: verified.grpven,
          InvDtMov: ref,
          DepId: depId
        })
        .update({
          InvConcluido: 'S'
        })

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'InventoryController.FechaInv',
      })
    }
    // verifica se o inventário ainda está aberto
    // troca o status do inventario na invcab para fechado
  }
}

module.exports = InventoryController;

const QUERY_PROC_GEN_INV = "declare @grpven VARCHAR(6) = ? declare @depid INT = ? declare @ano INT = ? declare @mes INT = ? declare @filial VARCHAR(4) = ? declare @invid INT = ? SELECT InvKardexBase.ProdId, InvKardexBase.Produto, InvKardexBase.DtMov, InvKardexBase.Descr, InvKardexBase.SldAnt, InvKardexBase.[E], InvKardexBase.S, InvKardexBase.SldAtu, InvKardexBase.DOC, InvKardexBase.A1_NOME FROM ( SELECT DepId, ProdId, Produto, DtMov, 'INVENTÁRIO INICIAL' as Descr, SldAnt, [E], [S], SldAtu, 0 as DOC, 'INVENTÁRIO INICIAL' as A1_NOME FROM ( SELECT dbo.InventarioCab.DepId, dbo.InventarioDet.ProdId, dbo.InventarioDet.Produto, [InvDtMov] AS DtMov, dbo.InventarioDet.InvQtd AS SldAnt, 0 AS E, 0 AS S, 0 AS SldAtu, dbo.InventarioCab.InvId, dbo.InventarioCab.GrpVen, dbo.Referencia.RefAno, dbo.Referencia.RefMes FROM dbo.Referencia INNER JOIN ( dbo.InventarioCab INNER JOIN dbo.InventarioDet ON ( dbo.InventarioCab.InvId = dbo.InventarioDet.InvId ) AND ( dbo.InventarioCab.GrpVen = dbo.InventarioDet.GrpVen ) ) ON dbo.Referencia.RefUdMesAnt = dbo.InventarioCab.InvDtMov WHERE ( ((dbo.InventarioCab.DepId) = @depid) AND ((dbo.InventarioCab.GrpVen) = @grpven) AND ((dbo.Referencia.RefAno) = @ano) AND ((dbo.Referencia.RefMes) = @mes) ) ) as InvKardexIni UNION SELECT DepId, ProdId, Produto, DtMov, Produto, 0, iif([Tipo] = 'E', [Quant], 0) as E, iif([Tipo] = 'S', [Quant], 0) as S, 0, DOC, A1_NOME FROM ( SELECT dbo.SDBase.D_FILIAL, dbo.SDBase.M0_TIPO AS Tipo, dbo.SDBase.C5_ZZADEST, dbo.Deposito.DepId, dbo.Deposito.GrpVen, dbo.SDBase.DOC, dbo.SDBase.DtEmissao AS DtMov, dbo.SDBase.D_EMISSAO AS EMISSAO, dbo.SDBase.A1_NOME, dbo.SDBase.D_COD, dbo.SDBase.ProdId, dbo.SDBase.Produto, dbo.SDBase.D_UM AS UM, dbo.SDBase.D_QUANT AS Quant, dbo.SDBase.D_PRCVEN AS PRCVEN, dbo.SDBase.D_TOTAL AS TOTAL, dbo.SDBase.D_DESC AS Desconto, dbo.SDBase.PvnVlr, dbo.SDBase.PvnRoy, dbo.SDBase.VENVLR, dbo.SDBase.D_PRCVEN AS PrUnCompra, dbo.SDBase.A1_CGC, dbo.SDBase.PvTipo, dbo.SDBase.DEPDEST, dbo.SDBase.DepOri FROM dbo.SDBase INNER JOIN dbo.Deposito ON dbo.SDBase.GRPVEN = dbo.Deposito.GrpVen WHERE ( ( (dbo.SDBase.C5_ZZADEST) Is Null Or (dbo.SDBase.C5_ZZADEST) = '0' Or (dbo.SDBase.C5_ZZADEST) = ' ' ) AND ((dbo.Deposito.DepId) = @depid) AND ((dbo.Deposito.GrpVen) = @grpven) AND ((Year([DtEmissao])) = @ano) AND ((Month([DtEmissao])) = @mes) ) OR ( ((dbo.SDBase.D_FILIAL) = @filial) AND ((dbo.SDBase.PvTipo) = 'R') AND ((dbo.SDBase.DEPDEST) = [DepDL]) AND ((Year([DtEmissao])) = @ano) AND ((Month([DtEmissao])) = @mes) ) OR ( ((dbo.SDBase.D_FILIAL) = @filial) AND ((dbo.SDBase.PvTipo) = 'R') AND ((dbo.SDBase.DepOri) = [DepDL]) AND ((Year([DtEmissao])) = @ano) AND ((Month([DtEmissao])) = @mes) ) ) as MovEstFull where @depid = @depid and year(DtMov) = @ano and month(DtMov) = @mes UNION SELECT DepId, ProdId, Produto, DtMov, Produto, 0 AS Expr1, IIf([Tipo] = 'E', [Quant], 0) AS E, IIf([Tipo] = 'S', [Quant], 0) AS S, 0 AS Expr2, DOC, NREDUZ FROM ( SELECT @filial AS DFILIAL, 'E' AS Tipo, dbo.SDBase.C5_ZZADEST, dbo.Deposito.DepId, dbo.Deposito.GrpVen, dbo.SDBase.DOC, dbo.SDBase.DtEmissao AS DtMov, dbo.SDBase.D_EMISSAO AS EMISSAO, FE1.NREDUZ, dbo.SDBase.D_COD, dbo.SDBase.ProdId, dbo.SDBase.Produto, dbo.SDBase.D_UM AS UM, dbo.SDBase.D_QUANT AS Quant, dbo.SDBase.D_PRCVEN AS PRCVEN, dbo.SDBase.D_TOTAL AS TOTAL, dbo.SDBase.D_DESC AS Desconto, dbo.SDBase.PvnVlr, dbo.SDBase.PvnRoy, dbo.SDBase.VENVLR, dbo.SDBase.D_PRCVEN AS PrUnCompra, dbo.SDBase.A1_CGC, dbo.SDBase.PvTipo, dbo.SDBase.DEPDEST, dbo.SDBase.DepOri FROM dbo.FilialEntidadeGrVenda AS FE1 INNER JOIN ( ( dbo.SDBase INNER JOIN dbo.FilialEntidadeGrVenda ON ( dbo.SDBase.A1_LOJA = dbo.FilialEntidadeGrVenda.A1_LOJA ) AND ( dbo.SDBase.A1_COD = dbo.FilialEntidadeGrVenda.A1_COD ) ) INNER JOIN dbo.Deposito ON dbo.FilialEntidadeGrVenda.A1_GRPVEN = dbo.Deposito.GrpVen ) ON FE1.M0_CODFIL = dbo.SDBase.D_FILIAL WHERE ( ((dbo.Deposito.DepId) = @depid) AND ((dbo.Deposito.GrpVen) = @grpven) AND ((dbo.SDBase.D_QUANT) <> 0) AND ((dbo.SDBase.D_FILIAL) <> @filial) AND ((dbo.SDBase.M0_TIPO) = 'S') AND ((Year([DtEmissao])) = @ano) AND ((Month([DtEmissao])) = @mes) ) ) AS EF WHERE ( ((EF.[DepId]) = @depid) AND ((Year([DtMov])) = @ano) AND ((Month([DtMov])) = @mes) ) UNION SELECT DepId, ProdId, Produto, DtMov, 'INVENTÁRIO FINAL' as Descr, SldAnt, [E], [S], SldAtu, 0 as DOC, 'INVENTÁRIO FINAL' as A1_NOME FROM ( SELECT dbo.InventarioCab.DepId, dbo.InventarioDet.ProdId, dbo.InventarioDet.Produto, [InvDtMov] AS DtMov, 0 AS SldAnt, 0 AS E, 0 AS S, dbo.InventarioDet.InvQtd AS SldAtu FROM dbo.Referencia INNER JOIN ( dbo.InventarioCab INNER JOIN dbo.InventarioDet ON ( dbo.InventarioCab.InvId = dbo.InventarioDet.InvId ) AND ( dbo.InventarioCab.GrpVen = dbo.InventarioDet.GrpVen ) ) ON dbo.Referencia.RefUd = dbo.InventarioCab.InvDtMov WHERE ( ((dbo.InventarioCab.DepId) = @depid) AND ((dbo.InventarioCab.GrpVen) = @grpven) AND ((dbo.Referencia.RefAno) = @ano) AND ((dbo.Referencia.RefMes) = @mes) AND ((dbo.InventarioCab.InvId) = @invid) ) ) as InvKardexFin ) as InvKardexBase ORDER BY InvKardexBase.DtMov ASC"

const calcActualAmount = (act, ant) => {
  if (act.A1_NOME === 'INVENTÁRIO INICIAL') {
    return Number(act.SldAnt).toFixed(2)
  } else if (ant === null) {
    return +Number(act.SldAnt + act.E - act.S).toFixed(2)
  } else {
    if (act.E !== 0) {
      return +Number(ant.SldAtu + act.E).toFixed(2)
    } else if (act.S !== 0) {
      return +Number(ant.SldAtu - act.S).toFixed(2)
    } else if (act.A1_NOME === 'INVENTÁRIO FINAL' && ant === null) {
      return Number(act.SldAnt)
    } else {
      return Number(ant.SldAtu)
    }
  }
}

const calcAntAmount = (act, ant) => {
  if (act.A1_NOME === 'INVENTÁRIO INICIAL') {
    return Number(act.SldAnt)
  } if (act.A1_NOME === 'INVENTÁRIO FINAL' && ant === null) {
    return Number(act.SldAtu)
  } else if (ant === null) {
    return Number(act.SldAnt)
  } else {
    return Number(ant.SldAtu)
  }
}

const queryInvDet = async (grpven, depid, year, month, user_code, invid) => {
  const proc = await Database.raw(QUERY_PROC_GEN_INV, [grpven, depid, year, month, user_code, invid])

  let procMod = {}

  for (let p in proc) {
    procMod[proc[p].ProdId] = {
      ProdId: proc[p].ProdId,
      Produto: proc[p].Produto,
      Mov: procMod[proc[p].ProdId]
        ? [...procMod[proc[p].ProdId].Mov, proc[p]]
        : [proc[p]]
    }
  }

  return procMod
}

const createDetObj = async (procMod, grpven, invId) => {
  let invDet = await Database
    .select('InvId', 'ProdId', 'Produto', 'InvQtd', 'InvAjQ', 'InvJust')
    .from('dbo.InventarioDet')
    .where({
      GrpVen: grpven,
      InvId: invId
    })

  // uno os det do inv com as mov de cada item
  invDet = invDet.map(invd => {
    if (typeof procMod[invd.ProdId] != 'undefined') {
      return {
        ...invd,
        Mov: procMod[invd.ProdId].Mov
      }
    } else {
      return {
        ...invd,
        Mov: []
      }
    }
  })

  // recalculo os saldo iniciais de finais de cada movimentacao de produto pq nao da pra confiar no que vem do BD...
  invDet.forEach((id, x) => {
    id.Mov.forEach((m, y) => {
      invDet[x].Mov[y] = {
        ...m,

        SldAtu: calcActualAmount(m, invDet[x].Mov[y - 1] ? invDet[x].Mov[y - 1] : null),
        SldAnt: calcAntAmount(m, invDet[x].Mov[y - 1] ? invDet[x].Mov[y - 1] : null)
      }
    })
  })

  return invDet
}

const prodsDefault = [
  {
    Produto: 'ACHOCOLATADO PILAO PROFESSIONAL',
    ProdId: 2631
  },
  {
    Produto: 'CAPPUCCINO PILAO PROF 1KG',
    ProdId: 2641
  },
  {
    Produto: 'CHA LIMAO PILAO PROF 1KG',
    ProdId: 2643
  },
  {
    Produto: 'LEITE EMBARE (400G)',
    ProdId: 2652
  },
  {
    Produto: 'CAFE PILAO EXPRESSO GOURMET KG',
    ProdId: 2664
  },
  {
    Produto: 'CAFE PILAO EXPRESSO PREMIUM KG',
    ProdId: 2665
  },
  {
    Produto: 'PP CAFE C/ LEITE PILAO PROF 1K',
    ProdId: 2667
  },
  {
    Produto: 'LEITE PILAO COMPOSTO 500G',
    ProdId: 4148
  },
  {
    Produto: 'CAFE PILAO EXPRESSO INST KG',
    ProdId: 4433
  },
  {
    Produto: 'CAFÉ DO PONTO EXPRESSO',
    ProdId: 5843
  },
]