"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index");
moment.locale("pt-br");

class DashboardController {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async ShowNews({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const news = await Database.raw(queryNews, [verified.grpven]);

      const duplicatas = await Database.raw(queryDuplicatas, [verified.grpven]);
      const performance = await Database.raw(queryTelemetrias, [
        verified.grpven,
      ]);

      const entregaDeOs = await Database.raw(queryEntregaDeOS, [
        verified.grpven,
      ]);
      const faturamentoClientes = await Database.raw(
        queryFaturamentoDosClientes,
        [verified.grpven]
      );

      const datas = [];

      // datas.push({
      //   date: moment().startOf("month").toDate(),
      //   type: "InvFranq",
      // });
      datas.push({
        date: moment()
          .subtract(1, "month")
          .endOf("month")
          .subtract(1, "day")
          .subtract(3, "h")
          .toDate(),
        type: "InvPilao",
      });
      datas.push({
        date: moment()
          .subtract(1, "month")
          .endOf("month")
          .subtract(3, "h")
          .toDate(),
        type: "InvPilao",
      });
      datas.push({
        date: moment().startOf("month").toDate(),
        type: "InvPilao",
      });
      datas.push({
        date: moment().startOf("month").add(1, "day").toDate(),
        type: "InvPilao",
      });

      duplicatas.forEach((d) => {
        datas.push({ date: d.DtVenc, type: "compra" });
      });

      entregaDeOs.forEach((eo) => {
        datas.push({ date: eo.OSCExpDtPrevisao, type: "OS" });
      });

      faturamentoClientes.forEach((fc) => {
        const ultimoDiaDoMes = moment().endOf("month").get("date");

        if (ultimoDiaDoMes < fc.AnxDiaFecha) {
          datas.push({
            date: moment().endOf("month").subtract(3, "hours").toDate(),
            type: "Cliente",
          });
        } else {
          datas.push({
            date: moment().date(fc.AnxDiaFecha).toDate(),
            type: "Cliente",
          });
        }
      });

      response.status(200).send({
        News: news,
        Titulos: duplicatas,
        Performance: [...performance.slice(0, 10)],
        Datas: datas,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: "DashboardController.News",
      });
    }
  }

  async StoreNews({ request, response }) {
    const token = request.header("authorization");
    const { news } = request.only(["news"]);

    try {
      await Database.insert({
        BannerTitle: news.BannerTitle,
        BannerDescription: news.BannerDescription,
        BannerAlign: news.BannerAlign,
        ModalHeaderTitle: news.ModalHeaderTitle,
        ModalContent: news.ModalContent,
        BannerStatus: "A",
        ReadConfirm: news.Comfirm,
        ModalPrompt: news.Prompt,
      }).into("dbo.NewsSLWEB");

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: "DashboardController.StoreNews",
      });
    }
  }

  async DestroyNews({ request, response, params }) {
    const token = request.header("authorization");
    const id = params.id;

    try {
      await Database.table("dbo.NewsSLWEB")
        .where({
          NewsId: id,
        })
        .update({
          BannerStatus: "I",
        });

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: "DashboardController.Destroy",
      });
    }
  }

  async CheckNews({ request, response }) {
    const token = request.header("authorization");
    const { newsId } = request.only(["newsId"]);

    try {
      const verified = seeToken(token);

      const hoje = new Date();

      const jaChecou = await Database.select("*")
        .from("dbo.NewsSLWEBConfirmacao")
        .where({
          GrpVen: verified.grpven,
          NewsId: newsId,
        });

      if (jaChecou.length === 0) {
        await Database.insert({
          GrpVen: verified.grpven,
          NewsId: newsId,
          DtVisualizacao: hoje,
          DtConfirmacao: hoje,
        }).into("dbo.NewsSLWEBConfirmacao");
      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: "DashboardController.CheckNews",
      });
    }
  }
}

module.exports = DashboardController;

const queryNews =
  "select NS.*, NSC.DtConfirmacao from dbo.NewsSLWEB as NS left join dbo.NewsSLWEBConfirmacao as NSC on NS.NewsId = NSC.NewsId and NSC.GrpVen = ? where NS.BannerStatus = 'A' order by NS.NewsId DESC";

const queryDuplicatas =
  "SELECT E1_NUM, E1Desc, DtVenc, E1_SALDO FROM ( SE1_GrpVen INNER JOIN SE1_Class ON (SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) ) LEFT JOIN dbo.SE1DtVenc ON SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc WHERE SE1_GrpVen.GrpVen = ?";

const queryTelemetrias =
  "SELECT bog.GrpVen, bog.EquiCod, P.AnxDesc, bog.Prd3, bog.Prd2, bog.Prd1, bog.Prd, (ISNULL(bog.Prd3, 0) + ISNULL(bog.Prd2, 0) + ISNULL(bog.Prd1, 0) + ISNULL(bog.Prd, 0)) as Total FROM dbo.bogf_Leituras_QtdGrpT as bog left join dbo.PontoVenda as P on P.EquiCod = bog.EquiCod and P.PdvStatus = 'A' WHERE (((bog.GrpVen) = ?)) group by bog.GrpVen, bog.EquiCod, P.AnxDesc, bog.MáxDeDataLeitura, bog.[Ql-4], bog.[Ql-3], bog.[Ql-2], bog.[Ql-1], bog.Ql0, bog.[Con-4], bog.[Con-3], bog.[Con-2], bog.[Con-1], bog.Con0, bog.Prd3, bog.Prd2, bog.Prd1, bog.Prd, bog.LeitOk, P.PdvLogradouroPV, P.PdvNumeroPV, P.PdvBairroPV, P.PdvComplementoPV, P.PdvCidadePV, P.PdvUfPV, P.PdvCEP order by Total DESC";

const queryEntregaDeOS =
  "select OSCId, OSCExpDtPrevisao from SLAPLIC.dbo.OSCtrl where GrpVen = ? and OSCExpDtPrevisao is not null";

const queryFaturamentoDosClientes =
  "select C.Nome_Fantasia, A.AnxDiaFecha from SLAPLIC.dbo.Contrato as C inner join SLAPLIC.dbo.Anexos as A on C.ConId = A.ConId and A.CNPJ = C.CNPJ and C.GrpVen = A.GrpVen where A.GrpVen = ? and C.ConStatus = 'A'";
