"use strict";
const Env = use("Env");
const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index");
const GerarExcel = require("../../../Services/excelExportService");
const Drive = use("Drive");
const Helpers = use("Helpers");

class ApontaConsumoController {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Leituras({ request, response, params }) {
    const token = request.header("authorization");

    const anxid = params.anxid;
    const ref = decodeURI(params.ref);
    const equicod = params.equicod;

    try {
      const verified = seeToken(token);

      const leit = await Database.raw(QUERY_LEITURAS_DISPONIVEIS, [
        moment(ref).toDate(),
        moment(ref).toDate(),
        equicod,
        verified.grpven,
        anxid,
      ]);

      response.status(200).send({
        Leituras: leit,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: "ApontaConsumoController.Leituras",
      });
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");

    const AnxId = params.anxid;
    const PdvId = params.pdvid;
    const leituraIdInit = params.letini;
    const leituraIdEnc = params.letenc;
    const DepId = Number(params.depid);
    const Ref = params.ref;
    const EquiCod = params.equicod;

    try {
      const verified = seeToken(token);

      // verifico se os detalhes da leitura já foram importados pro DB da AWS
      let temDetAWS = [];
      temDetAWS = await Database.raw(
        "select distinct LeituraId from SLAPLIC.dbo.SLTEL_LeituraSelecaoA where LeituraId in (?, ?)",
        [leituraIdInit, leituraIdEnc]
      );

      if (temDetAWS.length < 2) {

        // verifico se os detalhes da leitura estão pelo menos já no DB da Pilão
        let temDetPilao = [];
        //"select distinct LeituraId from SLCafes.SLAPLIC.dbo.SLTEL_LeituraSelecaoT where LeituraId in (?, ?)",
        temDetPilao = await Database.raw(
          "select distinct LeituraId from " + Env.get('SLCAFES_SLAPLIC') + ".dbo.SLTEL_LeituraSelecaoT where LeituraId in (?, ?)",
          [leituraIdInit, leituraIdEnc]
        );

        // se sim eu importo do DB da Pilao pro da AWS
        if (temDetPilao.length >= 2) {
          await Database.raw(
            "insert into SLAPLIC.dbo.SLTEL_LeituraSelecaoA select * from SLCafes.SLAPLIC.dbo.SLTEL_LeituraSelecaoT where LeituraId in (?, ?) and LeituraId not in (select LeituraId from SLAPLIC.dbo.SLTEL_LeituraSelecaoA)",
            [leituraIdInit, leituraIdEnc]
          );
        } else {
          // se não, lanço um erro
          throw new Error('o detalhe de uma ou ambas leituras não pode ser importado para o SLWEB')
        }
      }

      const produtos = await Database.raw(
        "execute dbo.sp_ApontaConsumo1 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?",
        [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc]
      );
      const consumos = await Database.raw(
        "execute dbo.sp_ApontaConsumo2 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?",
        [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc]
      );

      let history = await getPastEntries(verified.grpven, DepId, EquiCod);

      response.status(200).send({
        Produtos: produtos,
        Consumos: consumos,
        consumoHistory: history,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: "ApontaConsumoController.See",
      });
    }
  }

  async Store({ request, response, params }) {
    const token = request.header("authorization");
    const { Consumo, Zerado, IMEI, EquiCod, ref1, ref2, QtdCon } = request.only(
      ["Consumo", "Zerado", "IMEI", "EquiCod", "ref1", "ref2", "QtdCon"]
    );
    let DepId = params.depid;
    const Ref = params.ref;

    try {
      const verified = seeToken(token);

      // verificar se o pdv tem depid
      if (DepId === null) {
        response.status(400).send("ID do depósito indefinido");
        return;
      }

      DepId = Number(DepId);

      // verificar se o cara não está tentando lançar movimentação no depósito 1
      if (DepId === 1) {
        response
          .status(400)
          .send("Não é possivel fazer apontamento de consumo no depósito 1");
        return;
      }

      let DOC = null;

      let lastDOC = await Database.raw(
        "SELECT Max(S.DOC) AS DOC FROM dbo.SDBase as S WHERE ( ((S.F_SERIE) = 'CON') AND ((S.M0_TIPO) = 'S') AND ((S.PvTipo) = 'C') AND ((S.D_FILIAL) = ?) )",
        [verified.user_code]
      );

      DOC = lastDOC.length > 0 ? Number(lastDOC[0].DOC) + 1 : 1;

      let LeiturasConsumoMatPrimaPK = {
        D_FILIAL: verified.user_code,
        F_SERIE: "CON",
        DOC: DOC,
        M0_TIPO: "S",
        Consumo: null,
      };

      await Database.raw(
        "DELETE FROM dbo.SDBase where (M0_TIPO = ?) AND (DOC = ?) AND (F_SERIE = ?) AND (D_FILIAL = ?)",
        [
          LeiturasConsumoMatPrimaPK.M0_TIPO,
          LeiturasConsumoMatPrimaPK.DOC,
          LeiturasConsumoMatPrimaPK.F_SERIE,
          LeiturasConsumoMatPrimaPK.D_FILIAL,
        ]
      );

      for (let index in Consumo) {
        await Database.insert({
          D_FILIAL: LeiturasConsumoMatPrimaPK.D_FILIAL,
          F_SERIE: LeiturasConsumoMatPrimaPK.F_SERIE,
          DOC: LeiturasConsumoMatPrimaPK.DOC,
          D_DOC: LeiturasConsumoMatPrimaPK.DOC,
          D_ITEM: Consumo[index].GprdId,
          M0_TIPO: LeiturasConsumoMatPrimaPK.M0_TIPO,
          PvTipo: "C",
          DepOri: DepId,
          DEPDEST: 0,
          DtEmissao: Ref,
          ProdId: Consumo[index].ProdId,
          Produto: Consumo[index].Produto,
          D_COD: Consumo[index].ProdId,
          D_UM: Consumo[index].GprdUn,
          D_QUANT:
            Zerado === "S" ? Consumo[index].TotalConsumo : Consumo[index].Con,
          D_EMISSAO: moment().format("DDMMYYYY"),
          D_TOTAL: 0,
          D_PRCVEN: 0,
          GRPVEN: verified.grpven,
          C5_ZZADEST: 0,
          A1_NOME: `Cons. Eq.: ${EquiCod} ${QtdCon} doses entre ${moment(
            ref1
          ).format("DD/MM/YYYY hh:mm:ss")} e ${moment(ref2).format(
            "DD/MM/YYYY hh:mm:ss"
          )}`,
          EquiCod: EquiCod,
          IMEI: IMEI,
          RefDt: Ref,
        }).into("dbo.SDBase");
      }

      const history = await getPastEntries(verified.grpven, DepId, EquiCod);

      response.status(200).send({
        consumoHistory: history,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: "ApontaConsumoController.Store",
      });
    }
  }

  async Destroy({ request, response, params }) {
    const token = request.header("authorization");
    let DepId = params.depid;
    let Ref = params.ref;
    let EquiCod = params.equicod;
    let DOC = params.doc;

    try {
      const verified = seeToken(token);

      // verificar se o pdv tem depid
      if (DepId === null) {
        response.status(400).send("ID do depósito indefinido");
        return;
      }

      DepId = Number(DepId);

      await Database.table("dbo.SDBase")
        .where({
          GRPVEN: verified.grpven,
          F_SERIE: "CON",
          M0_TIPO: "S",
          PvTipo: "C",
          DepOri: DepId,
          EquiCod: EquiCod,
          RefDt: Ref,
          DOC: DOC,
        })
        .delete();

      const history = await getPastEntries(verified.grpven, DepId, EquiCod);

      response.status(200).send({
        consumoHistory: history,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: "ApontaConsumoController.Destroy",
      });
    }
  }

  async GenExcel({ request, response, params }) {
    const token = request.header("authorization");

    const AnxId = params.anxid;
    const PdvId = params.pdvid;
    const leituraIdInit = params.letini;
    const leituraIdEnc = params.letenc;

    let objToExcel = [];

    try {
      const verified = seeToken(token);
      const filePath = Helpers.publicPath(
        `/tmp/CONSUMO_${verified.user_code}_${moment(leituraIdInit).format(
          "DD-MM-YYYY"
        )}_a_${moment(leituraIdEnc).format("DD-MM-YYYY")}.xlsx`
      );

      const produtos = await Database.raw(
        "execute dbo.sp_ApontaConsumo1 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?",
        [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc]
      );
      const consumos = await Database.raw(
        "execute dbo.sp_ApontaConsumo2 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?",
        [verified.grpven, AnxId, PdvId, leituraIdInit, leituraIdEnc]
      );

      objToExcel.push({
        workSheetName: "Consumo de doses",
        workSheetColumnNames: [
          "Seleção",
          "Dose",
          "Receita",
          "Contenedor Inicial",
          "Contenedor Final",
          "Consumo",
        ],
        workSheetData: produtos.map((p) => [
          p.PvpSel,
          p.Produto,
          p.RecDesc,
          p.QtdI,
          p.QtdF,
          p.QtdF - p.QtdI,
        ]),
      });

      objToExcel.push({
        workSheetName: "Consumo de insumos",
        workSheetColumnNames: [
          "Tipo",
          "Código",
          "Produto",
          "Unidade",
          "Consumido",
        ],
        workSheetData: consumos.map((c) => [
          c.GprdDesc,
          c.ProdId,
          c.Produto,
          c.GprdUn,
          c.Con,
        ]),
      });

      await GerarExcel(objToExcel, filePath);

      const location = await Drive.get(filePath);

      response.status(200).send(location);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: "ApontaConsumoController.GenExcel",
      });
    }
  }
}

module.exports = ApontaConsumoController;

const QUERY_LEITURAS_DISPONIVEIS =
  "SELECT LeiturasVerifica.LeituraId, LeiturasVerifica.DataLeitura, LeiturasVerifica.Contador FROM ( SELECT dbo.SLTELLeitura.LeituraId, dbo.SLTELLeitura.DataLeitura, dbo.SLTELLeitura.QuantidadeTotal AS Contador FROM dbo.SLTELLeitura INNER JOIN dbo.PontoVenda ON dbo.SLTELLeitura.Matricula = dbo.PontoVenda.EquiCod WHERE ( ( (dbo.SLTELLeitura.DataLeitura) >= DateAdd(d, -15, ?) And (dbo.SLTELLeitura.DataLeitura) <= DateAdd(d, 45, ?) ) AND ((dbo.PontoVenda.EquiCod) = ?) AND ((dbo.PontoVenda.GrpVen) = ?) AND ((dbo.PontoVenda.PdvStatus) = 'A') AND ((dbo.PontoVenda.AnxId) = ?) ) ) as LeiturasVerifica ORDER BY LeiturasVerifica.DataLeitura";

const extrairDataDaDescr = (desc, IouF) => {
  if (IouF === "Inicial") {
    return String(desc).split("e ")[1].slice(0, -1);
  } else if ("Final") {
    return String(desc).split("e ")[2];
  } else {
    return null;
  }
};

const getPastEntries = async (grpven, depid, equicod) => {
  let consumoGravado = await Database.raw(
    "select ProdId, Produto, D_QUANT, DOC, A1_NOME from dbo.SDBase where  GRPVEN = ? and F_SERIE = ? and DepOri = ? and M0_TIPO = ? and PvTipo = ? and EquiCod = ? ORDER BY DOC DESC",
    [grpven, "CON", depid, "S", "C", equicod]
  );

  let consumoGravadoFormatado = [];

  for (let index in consumoGravado) {
    if (
      consumoGravadoFormatado.filter(
        (cgf) => cgf.DOC === consumoGravado[index].DOC
      ).length === 0
    ) {
      consumoGravadoFormatado.push({
        DOC: consumoGravado[index].DOC,
        DtIni: extrairDataDaDescr(consumoGravado[index].A1_NOME, "Inicial"),
        DtFim: extrairDataDaDescr(consumoGravado[index].A1_NOME, "Final"),
        Det: [
          {
            ProdId: consumoGravado[index].ProdId,
            Produto: consumoGravado[index].Produto,
            D_QUANT: consumoGravado[index].D_QUANT,
          },
        ],
      });
    } else {
      let yx = null;

      consumoGravadoFormatado.forEach((cgf, i) => {
        if (cgf.DOC === consumoGravado[index].DOC) {
          yx = i;
        }
      });

      consumoGravadoFormatado[yx] = {
        ...consumoGravadoFormatado[yx],
        Det: [
          ...consumoGravadoFormatado[yx].Det,
          {
            ProdId: consumoGravado[index].ProdId,
            Produto: consumoGravado[index].Produto,
            D_QUANT: consumoGravado[index].D_QUANT,
          },
        ],
      };
    }
  }

  return consumoGravadoFormatado;
};
