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
    let zerados = params.zerados

    try {
      const verified = seeToken(token);

      // busco dados do cab do inventario
      const invCab = await Database
        .select('InvConcluido', 'InvId', 'DepId', 'InvDtLanca')
        .from('dbo.InventarioCab')
        .where({
          GrpVen: verified.grpven,
          InvDtMov: ref,
          DepId: depId
        })

      // se nem existir cab desse inventario
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
      let { lancados: invDet, naoLancados: invNotDet } = await createDetObj(procMod, verified.grpven, invCab[0].InvId)

      // se receber I como paramentro pra zerados, o frontend só quer saber do status do zerado no último lançamento e não passar uma ação pro backend
      if (zerados === 'I') {
        let foiZeradoAnteriormente = invDet.filter(
          iv =>
            Number(iv.InvQtd) === 0 &&
            iv.Mov.filter(
              m =>
                m.A1_NOME !== 'INVENTÁRIO INICIAL' &&
                m.A1_NOME !== 'INVENTÁRIO FINAL'
            ).length === 0
        ).length > 0

        zerados = foiZeradoAnteriormente ? 'S' : 'N'
      }

      // se o cara não quiser ver zerados e o inventário ainda estiver disponivel
      if (zerados === 'N' && invCab[0].InvConcluido !== 'S') {

        // removo do BD tudo que não tem saldo, e nem movimentação
        for (let index in invDet) {
          if (
            invDet[index].InvQtd === 0 &&
            invDet[index].Mov.filter(
              m => m.A1_NOME !== 'INVENTÁRIO INICIAL' && m.A1_NOME !== 'INVENTÁRIO FINAL'
            ).length === 0
          ) {
            await Database
              .table("dbo.InventarioDet")
              .where({
                GrpVen: verified.grpven,
                InvId: invCab[0].InvId,
                ProdId: invDet[index].ProdId
              })
              .delete();
          }
        }

        // atualizo o invDet removendo os items sem saldo e movimentação
        invDet = invDet.filter(inv => inv.InvQtd !== 0 || inv.Mov.filter(
          m => m.A1_NOME !== 'INVENTÁRIO INICIAL' && m.A1_NOME !== 'INVENTÁRIO FINAL'
        ).length > 0)
      }

      // produto que ainda não foram lançados no invdet mas tem mov
      let invNotDetCM = invNotDet.filter(ind =>
        ind.InvQtd !== 0 ||
        ind.Mov.filter(
          m => m.A1_NOME !== 'INVENTÁRIO INICIAL' && m.A1_NOME !== 'INVENTÁRIO FINAL'
        ).length > 0
      )

      // produto que ainda não foram lançados no invdet e não tem mov
      let invNotDetSM = invNotDet.filter(ind =>
        ind.InvQtd === 0 &&
        ind.Mov.filter(
          m => m.A1_NOME !== 'INVENTÁRIO INICIAL' && m.A1_NOME !== 'INVENTÁRIO FINAL'
        ).length === 0
      )

      // insiro no db oque ainda não está lá, mas com o critério se tem ou não que ter as paradas zeradas
      if (invCab[0].InvConcluido !== 'S') {
        invNotDet = zerados === 'S' ? [...invNotDetCM, ...invNotDetSM] : [...invNotDetCM]

        for (let index in invNotDet) {
          let updsald = invNotDet[index].Mov.filter(m => m.A1_NOME === "INVENTÁRIO FINAL").length > 0
            ? invNotDet[index].Mov.filter(m => m.A1_NOME === "INVENTÁRIO FINAL")[0].SldAtu
            : invNotDet[index].Mov[invNotDet[index].Mov.length - 1].SldAtu

          await Database
            .insert({
              GrpVen: verified.grpven,
              InvId: invNotDet[index].InvId,
              ProdId: invNotDet[index].ProdId,
              Produto: invNotDet[index].Produto,
              InvQtd: updsald
            })
            .into('dbo.InventarioDet')

          invNotDet[index].InvQtd = updsald
        }
      }

      // atualizo o invdet com o saldo dos fim das movimentacoes caso nao tenha nenhum ajuste e o inventário ainda esteja aberto
      for (let index in invDet) {
        if (invDet[index].InvAjQ === null && invCab[0].InvConcluido !== 'S') {
          let updSld = invDet[index].Mov.filter(m => m.A1_NOME === "INVENTÁRIO FINAL")[0].SldAtu

          await Database
            .table("dbo.InventarioDet")
            .where({
              GrpVen: verified.grpven,
              InvId: invCab[0].InvId,
              ProdId: invDet[index].ProdId
            })
            .update({
              InvQtd: updSld
            })

          invDet[index].InvQtd = updSld
        }
      }

      response.status(200).send({
        Inventario: {
          referencia: ref,
          status: invCab[0].InvConcluido === 'S' ? 'fechado' : 'aberto',
          InvId: invCab.length > 0 ? invCab[0].InvId : null,
          InvDepId: invCab.length > 0 ? invCab[0].DepId : null,
          InvDtLancamento: invCab.length > 0 ? invCab[0].InvDtLanca : null,
          InvDetalhes: invCab[0].InvConcluido !== 'S' ? [...invDet, ...invNotDet] : invDet,
        },
        InvZerado: zerados
      })
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
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
  }
}

module.exports = InventoryController;

const QUERY_PROC_GEN_INV = "execute dbo.MovimentacoesFilial @grpven = ?, @depid = ?, @ano = ?, @mes = ?, @filial = ?, @invid = ?"

const calcActualAmount = (act, ant) => {
  if (act.A1_NOME === 'INVENTÁRIO INICIAL') {
    return +Number(act.SldAnt).toFixed(2)
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
    // só guardo a movimentação do que não for DOSE ou ROYALTIES
    if (!String(proc[p].Produto).toUpperCase().startsWith('DOSE')) {
      procMod[proc[p].ProdId] = {
        ProdId: proc[p].ProdId,
        Produto: proc[p].Produto,
        Mov: procMod[proc[p].ProdId]
          ? [...procMod[proc[p].ProdId].Mov, proc[p]]
          : [proc[p]]
      }
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

  let prodsForaDoDet = []

  Object.keys(procMod).forEach(ProdId => {
    let encontrou = false

    invDet.forEach(det => {
      if (Number(det.ProdId) === Number(ProdId)) {
        encontrou = true
      }
    })

    if (!encontrou) {
      prodsForaDoDet.push(procMod[ProdId])
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

  prodsForaDoDet.forEach((pfd, x) => {
    prodsForaDoDet[x].InvId = invId
    prodsForaDoDet[x].InvQtd = 0,
      prodsForaDoDet[x].InvAjQ = null,
      prodsForaDoDet[x].InvJust = null,

      pfd.Mov.forEach((m, y) => {
        prodsForaDoDet[x].Mov[y] = {
          ...m,

          SldAtu: calcActualAmount(m, prodsForaDoDet[x].Mov[y - 1] ? prodsForaDoDet[x].Mov[y - 1] : null),
          SldAnt: calcAntAmount(m, prodsForaDoDet[x].Mov[y - 1] ? prodsForaDoDet[x].Mov[y - 1] : null)
        }
      })
  })

  return { lancados: invDet, naoLancados: prodsForaDoDet }
}
