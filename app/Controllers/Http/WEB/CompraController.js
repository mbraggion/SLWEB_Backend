"use strict";
const Database = use("Database");
const { seeToken } = require("../../../POG/index");
const moment = require("moment");

class CompraController {
  async Produtos({ request, response }) {
    const token = request.header("authorization");
    try {
      seeToken(token);

      const Produtos = await Database.raw(queryProdutos);

      let aux = [];

      Produtos.map((element) => aux.push({ ...element, QCompra: 0 }));

      response.status(200).send(aux);
    } catch (err) {
      response.status(400);
    }
  }

  async Contas({ request, response }) {
    const token = request.header("authorization");
    try {
      const verified = seeToken(token);

      const InfoCompras = await Database.raw(queryGigante1, [verified.grpven]);

      const InfoBloqueado = await Database.raw(queryBloqueado, [
        verified.grpven,
      ]);

      const DuplicatasAberto = await Database.raw(
        queryDuplicatas,
        verified.grpven
      );

      const ComprasAoAno = await Database.raw(queryComprasAno, verified.grpven);

      response.status(200).send({
        Geral: Object.assign(InfoCompras[0], InfoBloqueado[0]),
        Duplicatas: DuplicatasAberto,
        ComprasAno: ComprasAoAno,
      });
    } catch (err) {
      response.status(400);
    }
  }

  async Pedidos({ request, response }) {
    const token = request.header("authorization");
    try {
      const verified = seeToken(token);

      const PedidosAbertos = await Database.raw(queryPedidosNaoAtendidos, [
        verified.grpven,
      ]);

      const PedidosFaturados = await Database.raw(queryPedidosAtendidos, [
        verified.grpven,
      ]);

      response.status(200).send({ PedidosAbertos, PedidosFaturados });
    } catch (err) {
      response.status(400);
    }
  }

  async PedidoDet({ request, response, params }) {
    const token = request.header("authorization");
    const PedidoID = params.ID;
    const Status = params.STATUS;

    try {
      const verified = seeToken(token);

      let PedidoDet = [];
      let newPedDet = [];

      let Pedido = {
        Transportadora: null,
        Status: Status,
        Data: null,
        Detalhes: [],
      };

      if (Status === "Faturado") {
        //busca nos pedidos atendidos
        PedidoDet = await Database.raw(queryPedidosAtendidosDet, [
          verified.grpven,
          verified.user_code,
          PedidoID,
        ]);

        if (PedidoDet.length > 0) {
          const transp = await Database.raw(
            "execute ProcNotaTransportadora @Doc = ? , @Filial = '0201'",
            [PedidoDet[0].DOC]
          );

          transp.length > 0
            ? (Pedido.Transportadora = transp[0].A4_NOME)
            : null;

          Pedido.Data = PedidoDet[0].Emissao;
        }

        PedidoDet.map((det) => {
          newPedDet.push({
            id: det.ProdId,
            Produto: det.Produto,
            UN: det.D_UM,
            Quantidade: det.D_QUANT,
            VlrUn: det.D_PRCVEN,
            VlrTotal: det.D_TOTAL,
          });
        });

        Pedido.Detalhes = newPedDet;
      }

      if (Status === "Processando") {
        //busca nos pedidos não atendidos
        PedidoDet = await Database.raw(
          "execute ProcPedidosCompraEmAbertoDet @PedId = ?",
          [PedidoID]
        );

        if (PedidoDet.length > 0) {
          Pedido.Data = PedidoDet[0].Solicitação;
        }

        PedidoDet.map((det) => {
          newPedDet.push({
            id: det.ProdId,
            Produto: det.Produto,
            UN: det.UnMedida,
            Quantidade: det.Qtd,
            VlrUn: det.VlrUnit,
            VlrTotal: det.VlrTotal,
          });
        });

        Pedido.Detalhes = newPedDet;
      }

      response.status(200).send(Pedido);
    } catch (err) {
      response.status(400);
    }
  }

  async Comprar({ request, response }) {
    const token = request.header("authorization");
    const { Items, Obs } = request.only(["Items", "Obs"]);

    try {
      const verified = seeToken(token);

      //verifico se o pedido tem pelo menos 1 item
      if (Items.length === 0) {
        throw new Error;
      }

      //testar se o cara tem limite
      const limite = await Database.raw(queryLimiteDisponivel, [
        verified.grpven,
      ]);
      if (limite[0] && limite[0].LimiteAtual <= 0) {
        throw new Error;
      }

      //testo se o cara ta bloqueado
      const bloqueado = await Database.raw(queryBloqueado, [verified.grpven]);
      if (bloqueado[0] && bloqueado[0].Bloqueado === "N") {
        throw new Error;
      }

      //busco dados do franqueado
      // const Franqueado = await Database.select("A1_COD", "A1_LOJA")
      //   .from("dbo.FilialEntidadeGrVenda")
      //   .where({
      //     A1_GRPVEN: verified.grpven,
      //   });

      //busco o número do último pedido
      // const UltPedidoID = await Database.raw(
      //   "select MAX(PedidoID) as UltPedido from dbo.PedidosVenda",
      //   []
      // );

      //salvo o pedido nas tabelas
      // await Database.insert({
      //   GrpVen: verified.grpven,
      //   PedidoID: Number(UltPedidoID[0]) + 1,
      //   STATUS: null,
      //   Filial: "0201",
      //   CpgId: "003",
      //   DataCriacao: moment().format(),
      // }).into("dbo.PedidosCompraCab");

      // Items.forEach(
      //   async (item, i) =>
      //     await Database.insert({
      //       EMISS: "00",
      //       SERIE: "1",
      //       PedidoID: Number(UltPedidoID[0]) + 1,
      //       PedidoItemID: i + 1,
      //       CodigoCliente: Franqueado[0].A1_COD,
      //       LojaCliente: Franqueado[0].A1_LOJA,
      //       CodigoDL: " ",
      //       LojaDL: " ",
      //       Filial: "0201",
      //       CodigoTabelaPreco: "462",
      //       CodigoVendedor: "000026",
      //       CodigoCondicaoPagto: "003",
      //       TipoFrete: "C",
      //       MsgNotaFiscal: null,
      //       MsgPadrao: null,
      //       DataEntrega: null,
      //       CodigoProduto: item.Cód,
      //       QtdeVendida: item.QCompra * item.FatConversao,
      //       PrecoUnitarioLiquido: item.VlrUn,
      //       PrecoTotal: item.QCompra * item.FatConversao * item.VlrUn,
      //       Limite: null,
      //       CodigoTotvs: null,
      //       DataCriacao: moment().format(),
      //       DataIntegracao: null,
      //       GrpVen: verified.grpven,
      //       MsgBO: Obs,
      //       NATUREZA: null,
      //       TipOp: "01",
      //     }).into("dbo.PedidosVenda")
      // );

      response.status(200).send(bloqueado[0].Bloqueado);
    } catch (err) {
      response.status(200).send(err);
    }
  }
}

module.exports = CompraController;

const queryProdutos =
  "SELECT dbo.PrecoCompra.ProdId AS Cód, dbo.PrecoCompra.Produto, dbo.Produtos.ProdQtMinCompra AS QtMin, dbo.Produtos.PrCompra AS VlrUn, [ProdQtMinCompra]*[PrCompra] AS Vlr, dbo.Produtos.FatConversao FROM dbo.PrecoCompra INNER JOIN dbo.Produtos ON dbo.PrecoCompra.ProdId = dbo.Produtos.ProdId WHERE dbo.Produtos.Compra = 'S' ORDER BY dbo.PrecoCompra.Produto";

const queryGigante1 =
  "SELECT dbo.FilialEntidadeGrVenda.LimiteCredito, dbo.FilialEntidadeGrVenda.LimExtraCredito, dbo.FilialEntidadeGrVenda.Retira, dbo.FilialEntidadeGrVenda.VlrMinCompra, SE1_GrpVenT.Avencer, SE1_GrpVenT.Vencida, SE1_ComprasNVencidas.Compras, IIf([Compras]>0,[LimiteCredito]+[LimExtraCredito]-[Compras],[LimiteCredito]) AS LimiteAtual FROM ((dbo.FilialEntidadeGrVenda LEFT JOIN ( SELECT dbo.SE1_GrpVen.GrpVen, Sum(IIf([SE1DtVencR] > GETDATE(), 0,[E1_SALDO])) AS Avencer, Sum(IIf([SE1DtVencR] < GETDATE(), [E1_SALDO],0)) AS Vencida FROM (dbo.SE1_GrpVen INNER JOIN SE1_Class ON (dbo.SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (dbo.SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO)) LEFT JOIN dbo.SE1DtVenc ON dbo.SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc GROUP BY dbo.SE1_GrpVen.GrpVen ) as SE1_GrpVenT ON dbo.FilialEntidadeGrVenda.A1_GRPVEN = SE1_GrpVenT.GrpVen) LEFT JOIN ( SELECT dbo.SE1_GrpVen.GrpVen, Sum(dbo.SE1_GrpVen.E1_SALDO) AS Compras FROM (dbo.SE1_GrpVen INNER JOIN SE1_Class ON (dbo.SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) AND (dbo.SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO)) LEFT JOIN dbo.SE1DtVenc ON dbo.SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc WHERE (((SE1_Class.E1Desc)='Compra') AND ((IIf([SE1DtVenc] Is Null,[DtVenc],[SE1DtVencR]))>=GETDATE())) GROUP BY dbo.SE1_GrpVen.GrpVen ) as SE1_ComprasNVencidas ON dbo.FilialEntidadeGrVenda.A1_GRPVEN = SE1_ComprasNVencidas.GrpVen) WHERE (((dbo.FilialEntidadeGrVenda.Inatv) Is Null) and dbo.FilialEntidadeGrVenda.A1_GRPVEN = ?)";

const queryBloqueado =
  "SELECT IIF(SUM(dbo.SE1_GrpVen.E1_VALOR) > 0, 'S', 'N') as Bloqueado FROM (dbo.SE1_GrpVen INNER JOIN SE1_Class  ON (dbo.SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (dbo.SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO))  LEFT JOIN dbo.SE1DtVenc ON dbo.SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc  where dbo.SE1_GrpVen.GrpVen = ? and DtVenc < GETDATE()";

const queryDuplicatas =
  "SELECT * FROM (dbo.SE1_GrpVen INNER JOIN SE1_Class  ON (dbo.SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (dbo.SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO))  LEFT JOIN dbo.SE1DtVenc ON dbo.SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc WHERE dbo.SE1_GrpVen.GrpVen = ?";

const queryComprasAno =
  "SELECT * FROM ( SELECT dbo.SE1_GrpVenT.GrpVen, dbo.SE1_GrpVenT.MesE, dbo.SE1_GrpVenT.E1_VALOR FROM dbo.SE1_GrpVenT INNER JOIN SE1_Class ON (dbo.SE1_GrpVenT.E1_TIPO = SE1_Class.E1_TIPO) AND (dbo.SE1_GrpVenT.E1_PREFIXO = SE1_Class.E1_PREFIXO) WHERE (((dbo.SE1_GrpVenT.GrpVen)= ?) AND ((SE1_Class.E1Desc)='Compra') AND ((dbo.SE1_GrpVenT.AnoE)=Year(GETDATE()))) ) t PIVOT (   Sum(t.E1_VALOR)   FOR t.MesE   IN([1], [2], [3], [4],[5],[6],[7],[8],[9],[10],[11],[12]) ) p";

const queryPedidosNaoAtendidos =
  "SELECT 'Processando' AS Status, dbo.PedidosCompraCab.DataCriacao AS Solicitacao, dbo.PedidosCompraCab.PedidoId as Pedido, '' as NF, '' as Serie, Sum(dbo.PedidosVenda.PrecoTotal) AS Total, Count(dbo.PedidosVenda.Item) AS QtItems FROM dbo.PedidosVenda  INNER JOIN dbo.PedidosCompraCab ON (dbo.PedidosVenda.Filial = dbo.PedidosCompraCab.Filial) AND (dbo.PedidosVenda.PedidoID = dbo.PedidosCompraCab.PedidoId)  WHERE (((dbo.PedidosCompraCab.NroNF) Is Null) AND ((dbo.PedidosCompraCab.GrpVen)=?) AND ((dbo.PedidosVenda.STATUS)<>'C' Or (dbo.PedidosVenda.STATUS) Is Null))  GROUP BY dbo.PedidosCompraCab.STATUS, dbo.PedidosCompraCab.DataCriacao, dbo.PedidosCompraCab.PedidoId, dbo.PedidosVenda.CodigoTotvs  ORDER BY dbo.PedidosCompraCab.DataCriacao DESC";

const queryPedidosAtendidos =
  "SELECT 'Faturado' as Status, S.DtEmissao as Faturado, S.Pedido as Pedido, S.DOC as NF, S.F_SERIE as Serie, SUM(S.D_TOTAL) as Total, COUNT(S.D_ITEM) as QtItems FROM dbo.SDBase as S WHERE S.GRPVEN = ? AND S.M0_TIPO='E' AND S.Pedido<>'0' AND S.F_SERIE = '1' GROUP BY S.D_FILIAL, S.Pedido, S.F_SERIE, S.DOC, S.DtEmissao ORDER BY S.Pedido DESC , S.DtEmissao DESC;";

const queryPedidosAtendidosDet =
  "SELECT GRPVEN, D_EMISSAO, F_SERIE, DOC, Pedido, D_ITEM, ProdId, Produto, D_UM, D_QUANT, D_PRCVEN, D_TOTAL, DtEmissao AS Emissao, DEPDEST FROM dbo.SDBase WHERE (((GRPVEN)=?) AND ((D_FILIAL)<>?) AND ((M0_TIPO)='E')) AND ((Pedido) = ?) AND F_SERIE = '1' ORDER BY D_EMISSAO DESC";

const queryLimiteDisponivel =
  "SELECT IIf([Compras]>0,[LimiteCredito]+[LimExtraCredito]-[Compras],[LimiteCredito]) AS LimiteAtual FROM dbo.FilialEntidadeGrVenda LEFT JOIN (SELECT dbo.SE1_GrpVen.GrpVen, Sum(dbo.SE1_GrpVen.E1_SALDO) AS Compras FROM (dbo.SE1_GrpVen INNER JOIN SE1_Class ON (dbo.SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) AND (dbo.SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO)) LEFT JOIN dbo.SE1DtVenc ON dbo.SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc WHERE (((SE1_Class.E1Desc)='Compra') AND ((IIf([SE1DtVenc] Is Null,[DtVenc],[SE1DtVencR]))>=GETDATE())) GROUP BY dbo.SE1_GrpVen.GrpVen) as SE1_ComprasNVencidas ON dbo.FilialEntidadeGrVenda.A1_GRPVEN = SE1_ComprasNVencidas.GrpVen WHERE (((dbo.FilialEntidadeGrVenda.Inatv) Is Null) and dbo.FilialEntidadeGrVenda.A1_GRPVEN = ?)";
