"use strict";

const Database = use("Database");
const moment = require("moment");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class EquipController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const ativos = await Database.raw(ShowAllAtivosFilial, [verified.grpven, verified.grpven]);

      const clientes = await Database.select('*').from('dbo.Cliente').where({
        GrpVen: verified.grpven,
        ClienteStatus: 'A'
      }).orderBy('Nome_Fantasia', 'ASC')

      response.status(200).send({
        Ativos: ativos,
        Clientes: clientes,
        JaReportou: false,
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'EquipController.Show',
      })
    }
  }

  async See({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const reports = await Database
        .select('EquiCod', 'EqKODesc', 'EqKoTipo', 'EqKoDtAbertura', 'EquiDesc', 'EqKoDtFechamento')
        .from('dbo.EquipamentoKO')
        .where({
          GrpVen: verified.grpven
        }).orderBy('EqKoDtAbertura', 'DESC');

      response.status(200).send({ Reports: reports });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'EquipController.See',
      })
    }
  }

  async Update({ request, response }) {
    const token = request.header("authorization");
    const { oldPdv, newCliente } = request.only(['oldPdv', 'newCliente'])

    try {
      const verified = seeToken(token);

      if (oldPdv.Nome_Fantasia !== '' && oldPdv.Nome_Fantasia !== null) {
        await Database.table("dbo.PontoVenda")
          .where({
            GrpVen: verified.grpven,
            AnxId: oldPdv.AnxId,
            PdvId: oldPdv.PdvId,
          })
          .update({
            PdvStatus: 'I',
            PdvDataEncerramento: new Date(),
            PdvMotivoEncerramento: 'Ponto de Venda inativado pela tela de equipamentos WEB',
          });
      }

      const Contrato = await Database.select('ConId')
        .from('dbo.Contrato')
        .where({
          GrpVen: verified.grpven,
          CNPJ: newCliente.CNPJ,
        })

      let ConId = Contrato.length > 0 ? Contrato[0].ConId : 1;

      if (Contrato.length === 0) {
        await Database.table("dbo.Contrato")
          .insert({
            GrpVen: verified.grpven,
            CNPJ: newCliente.CNPJ,
            ConId: ConId,
            cnpjn: newCliente.CNPJn,
            Dt_Inicio: new Date(),
            Dt_Fim: null,
            ConMesBase: null,
            Nome_Fantasia: newCliente.Nome_Fantasia,
            Contato_Empresa: null,
            Email: null,
            Contato_Empresa_2: null,
            Email_2: null,
            Fone_2: null,
            Contato2: null,
            Obs_Específica_Cliente:
              "Contrato criado automaticamente pela tela Equipamentos web",
            CLIENTE: null,
            CNPJss: newCliente.CNPJss,
          });
      }

      const Anexo = await Database.select('AnxId')
        .from('dbo.Anexos')
        .where({
          GrpVen: verified.grpven,
          CNPJ: newCliente.CNPJ,
          ConId: ConId,
        })

      let newAnxId = Anexo.length > 0 ? Anexo[0].AnxId : 1;

      if (Anexo.length === 0) {
        const lastAnxId = await Database.raw('SELECT MAX(AnxId) AS AnxId FROM dbo.Anexos WHERE GrpVen = ?', [verified.grpven])
        newAnxId = lastAnxId.length > 0 ? Number(lastAnxId[lastAnxId.length - 1].AnxId) + 1 : newAnxId

        await Database.table("dbo.Anexos").insert({
          GrpVen: verified.grpven,
          CNPJ: newCliente.CNPJ,
          CNPJss: newCliente.CNPJss,
          ConId: ConId,
          AnxId: newAnxId,
          AnxDesc: newCliente.Nome_Fantasia,
          CalcFatId: 255,
          AnxDiaFecha: 30,
          AnxProRata: "N",
          AnxCPAG: 0,
          AnxFatMinimo: "N",
          AnxTipMin: "R",
          AnxMinMoeda: "S",
          AnxCalcMinPor: "A",
          ProdId: '9807',
          AnxObs: "Anexo criado automaticamente pela tela Equipamentos web",
        });
      }

      const Pdv = await Database.select("PdvId")
        .from("dbo.PontoVenda")
        .where({
          GrpVen: verified.grpven,
          AnxId: newAnxId,
          EquiCod: oldPdv.EquiCod,
          PdvStatus: 'A',
        })

      let newPdvId = 1

      if (Pdv.length === 0) {
        const lastPdvId = await Database.raw(`SELECT MAX(PdvId) AS PdvId FROM dbo.PontoVenda WHERE GrpVen = ${verified.grpven} AND AnxId = ${newAnxId}`)
        newPdvId = lastPdvId.length > 0 ? Number(lastPdvId[lastPdvId.length - 1].PdvId) + 1 : newPdvId

        await Database.table("dbo.PontoVenda").insert({
          GrpVen: verified.grpven,
          AnxId: newAnxId,
          CNPJ: newCliente.CNPJ,
          ConId: ConId,
          EquiCod: oldPdv.EquiCod,
          IMEI: oldPdv.IMEI,
          PdvId: newPdvId,
          PdvLogradouroPV: newCliente.Logradouro,
          PdvNumeroPV: newCliente.Número,
          PdvComplementoPV: newCliente.Complemento,
          PdvBairroPV: newCliente.Bairro,
          PdvCidadePV: newCliente.Município,
          PdvUfPV: newCliente.UF,
          PdvCEP: newCliente.CEP,
          DepId: 1,
          PdvDataAtivacao: new Date(),
          EquiMatr: oldPdv.EquiCod,
          EQUIPMOD_Desc: oldPdv.EquiDesc,
          AnxDesc: newCliente.Nome_Fantasia,
          CfgId: 1,
          PdvObs: 'Ponto de Venda inserido pela tela de equipamentos web',
          PdvStatus: 'A'
        });

      } else {
        console.log(`Esse trecho não deve executar, mas vou deixar esse log aqui só pra monitorar... Máquina ${oldPdv.EquiCod}, ClienteNovo ${newCliente.CNPJ}`)
      }

      await Database.table("dbo.PVPROD")
        .where({
          GrpVen: verified.grpven,
          AnxId: newAnxId,
          PdvId: newPdvId,
        })
        .delete();

      await Database.raw(updateFirstConfigToPdv, [newAnxId, newPdvId, verified.grpven])

      response.status(200).send({
        NewAnxId: newAnxId, NewPdvId: newPdvId,
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'EquipController.Update',
      })
    }
  }

  async StoreReport({ request, response }) {
    const token = request.header("authorization");
    const { Report } = request.only(['Report']);

    try {
      const verified = seeToken(token);

      await Database.insert({
        GrpVen: verified.grpven,
        EquiCod: Report.ativo,
        EqKODesc: Report.obs,
        EqKoTipo: Report.ocorrencia,
        EqKoDtAbertura: Report.createdAt,
        EquiDesc: Report.modelo,
        EqKoDtFechamento: null,
      }).into("dbo.EquipamentoKO");

      response.status(200).send({ message: 'ok' });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'EquipController.StoreReport',
      })
    }
  }

  async DeleteReport({ request, response }) {
    const token = request.header("authorization");
    const { Report } = request.only(['Report']);

    try {
      const verified = seeToken(token);

      await Database.table("dbo.EquipamentoKO")
        .where({
          GrpVen: verified.grpven,
          EquiCod: Report.EquiCod,
          EqKoDtAbertura: Report.EqKoDtAbertura,
        })
        .update({
          EqKoDtFechamento: new Date(),
        });

      response.status(200).send({ message: 'ok' });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'EquipController.DeleteReport',
      })
    }
  }

  async SeeConfirmInfo({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const enderecos = await Database.raw(endConfirm, [verified.grpven])

      response.status(200).send({ Enderecos: enderecos });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'EquipController.SeeConfirmInfo',
      })
    }
  }

  async ConfirmAddresses({ request, response }) {
    const token = request.header("authorization");
    const { Addresses } = request.only(["Addresses"]);

    let refMes = moment().get('month') + 1
    let refAno = moment().get('year')

    try {
      const verified = seeToken(token);

      for (let i = 0; i < Addresses.length; i++) {

        // await Database.insert({
        //   RepoAno: RefAno,
        //   RepoMes: RefMes,
        //   GrpVen: verified.grpven,
        //   EquiCod: Addresses[i].EquiCod,
        //   CNPJn: Number(Addresses[i].CNPJ),
        //   RepoTMS: moment().format('YYYY-MM-DD HH:mm:ss'),
        // }).into("dbo.RepoEquip");

        await Database.raw(
          "begin tran if exists ( select * from dbo.RepoEquip where GrpVen = ? and RepoAno = ? and RepoMes = ? and EquiCod = ? ) begin update dbo.RepoEquip set CNPJn = ?, RepoTMS = ? where GrpVen = ? and RepoAno = ? and RepoMes = ? and EquiCod = ? end else begin insert into dbo.RepoEquip values (?, ?, ?, ?, ?, ?) end commit tran",
          [verified.grpven, refAno, refMes, Addresses[i].EquiCod, Number(Addresses[i].CNPJ), moment().format('YYYY-MM-DD HH:mm:ss'), verified.grpven, refAno, refMes, Addresses[i].EquiCod, refAno, refMes, verified.grpven, Addresses[i].EquiCod, Number(Addresses[i].CNPJ), moment().format('YYYY-MM-DD HH:mm:ss')]
        )
      }

      await Database.table("dbo.FilialEntidadeGrVenda")
        .where({
          A1_GRPVEN: verified.grpven,
        })
        .update({
          Equip: 'N',
        });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'EquipController.ConfirmAddresses',
      })
    }
  }
}

module.exports = EquipController;

const ShowAllAtivosFilial = "select E.*, P.Nome_Fantasia, P.CNPJss, P.AnxId, P.PdvId, P.CNPJn from dbo.Equipamento as E left join (SELECT dbo.PontoVenda.EquiCod, dbo.Cliente.Nome_Fantasia, dbo.Cliente.CNPJss, dbo.PontoVenda.AnxId, dbo.PontoVenda.PdvId, dbo.Cliente.CNPJn FROM ( ( dbo.Cliente INNER JOIN dbo.Contrato ON (dbo.Cliente.CNPJ = dbo.Contrato.CNPJ) AND (dbo.Cliente.GrpVen = dbo.Contrato.GrpVen) ) INNER JOIN dbo.Anexos ON (dbo.Contrato.CNPJ = dbo.Anexos.CNPJ) AND (dbo.Contrato.ConId = dbo.Anexos.ConId) AND (dbo.Contrato.GrpVen = dbo.Anexos.GrpVen) ) INNER JOIN dbo.PontoVenda ON (dbo.Anexos.AnxId = dbo.PontoVenda.AnxId) AND ( dbo.Anexos.GrpVen = dbo.PontoVenda.GrpVen ) WHERE ( ((dbo.Cliente.GrpVen) = ?) AND ((dbo.PontoVenda.PdvStatus) = 'A') )) as P on E.EquiCod = P.EquiCod where E.GrpVen = ?"

const updateFirstConfigToPdv = "INSERT INTO dbo.PVPROD ( GrpVen, AnxId, PdvId, PvpSel, ProdId, TveId, PvpVvn1, PvpVvn2, FlgAlt, RecId ) SELECT C.GrpVen,  ? ,  ? , C.PvpSel, C.ProdId, C.TveId, 0 AS PvpVvn1, 0 AS PvpVvn2, 'N', P.RecId FROM dbo.CfgDet AS C INNER JOIN dbo.Produtos AS P ON C.ProdId = P.ProdId WHERE C.CfgId=1 AND C.GrpVen=?"

const confirmEquipPeriod = "SELECT ParametrosOpcoes1.ParamId, ParametrosOpcoes1.ParamDate AS de, dbo_ParametrosOpcoes_srv2.ParamDate AS ate, DateDiff(D, [ParametrosOpcoes1].[ParamDate], GETDATE()) AS di FROM dbo.ParametrosOpcoes AS ParametrosOpcoes1 INNER JOIN dbo.ParametrosOpcoes AS dbo_ParametrosOpcoes_srv2 ON ParametrosOpcoes1.ParamId = dbo_ParametrosOpcoes_srv2.ParamId WHERE ( ((ParametrosOpcoes1.ParamId) = 'equip') AND ( ( DateDiff(D, [ParametrosOpcoes1].[ParamDate], GETDATE()) ) >= -7 And ( DateDiff(D, [ParametrosOpcoes1].[ParamDate], GETDATE()) ) <= 45 ) AND ((ParametrosOpcoes1.ParOId) = 1) AND ((dbo_ParametrosOpcoes_srv2.ParOId) = 2) )"

const endConfirm = "select P.AnxDesc, P.CNPJ, P.EquiCod, P.PdvLogradouroPV, P.PdvNumeroPV, P.PdvBairroPV, P.PdvCidadePV, P.PdvUfPV, P.PdvCEP, P.PdvComplementoPV from dbo.Equipamento as E left join dbo.PontoVenda as P on E.EquiCod = P.EquiCod where E.GrpVen = ? and P.PdvStatus = 'A'"