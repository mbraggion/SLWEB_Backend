"use strict";
const Database = use("Database");
const Env = use("Env");
const Drive = use("Drive");
const Helpers = use("Helpers");
const logger = require("../../../../dump/index")
const moment = require("moment");
const PdfPrinter = require("pdfmake");
const toArray = require('stream-to-array')
const fs = require("fs");
const { seeToken } = require("../../../Services/jwtServices");
const { PDFGen } = require("../../../../resources/pdfModels/detalhesVenda_pdfModel");
moment.locale("pt-br");

var fonts = {
  Roboto: {
    normal: Helpers.resourcesPath("fonts/OpenSans-Regular.ttf"),
    bold: Helpers.resourcesPath("fonts/OpenSans-Bold.ttf"),
    italics: Helpers.resourcesPath("fonts/OpenSans-RegularItalic.ttf"),
    bolditalics: Helpers.resourcesPath("fonts/OpenSans-BoldItalic.ttf"),
  },
};

const printer = new PdfPrinter(fonts);
class VendaController {
  async Produtos({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const Produtos = await Database.raw(queryListaDeProdutos, []);

      const Clientes = await Database
      .select("*")
      .from("dbo.Cliente")
      .where({
        GrpVen: verified.grpven,
        ClienteStatus: 'A'
      }).orderBy('Nome_Fantasia', 'ASC');

      const CodPag = await Database.select("CpgDesc", "CpgId")
        .from("dbo.CondicaoPagamento")
        .where({ GrpVen: "000000" })
        .orderBy("CpgDesc", "ASC");

      const Depositos = await Database.select("*").from("dbo.Deposito").where({
        GrpVen: verified.grpven,
      });

      let aux = [];

      Produtos.map((element) =>
        aux.push({ ...element, QVenda: 0, VVenda: element.PrVenda, DVenda: 0 })
      );

      response.status(200).send({ Produtos: aux, Clientes, CodPag, Depositos });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.Produtos',
      })
    }
  }

  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const pedidos = await Database.raw(
        "execute dbo.ProcPedidosVendaCab @GrpVen = ?",
        [verified.grpven]
      );

      response.status(200).send({ Pedidos: pedidos });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.Show',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const serie = params.serie;
    const pvc = params.pvc;

    try {
      const verified = seeToken(token);

      const detalhes = await Database.raw(
        "execute dbo.ProcPedidosVendaDet @GrpVen = ?, @Serie = ?, @Doc = ?",
        [verified.grpven, serie, pvc]
      );

      response.status(200).send(detalhes);
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.See',
      })
    }
  }

  async Store({ request, response }) {
    const token = request.header("authorization");

    const { Pedido } = request.only(["Pedido"]);

    try {
      const verified = seeToken(token);

      const ultPvcId = await Database.raw("select MAX(PvcID) as UltimoID from dbo.PedidosVendaCab where GrpVen = ?", [verified.grpven]);

      const actualDate = moment().subtract(3, "hours").toDate()

      await Database.insert({
        GrpVen: verified.grpven,
        PvcSerie: 'F',
        PvcID: Number(ultPvcId[0].UltimoID) + 1,
        CNPJ: Pedido.Cliente.CNPJ,
        Filial: verified.user_code,
        CpgId: Pedido.CondPag,
        DataCriacao: actualDate,
        DataIntegracao: null,
        DepId: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 1 : Pedido.RemOrigem : 0,
        DepIdDest: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 0 : Pedido.RemDestino : 0,
        PvTipo: Pedido.TipoVenda,
        STATUS: 'P',
        MsgNF: Pedido.OBS
      }).into("dbo.PedidosVendaCab");

      Pedido.Carrinho.forEach(async (item, i) => {
        await Database.insert({
          GrpVen: verified.grpven,
          PvcSerie: 'F',
          PvcID: Number(ultPvcId[0].UltimoID) + 1,
          PvdID: i + 1,
          ProdId: item.ProdId,
          PvdQtd: item.FatConversao !== null ? item.QVenda * item.FatConversao : item.QVenda,
          PvdVlrUnit: item.VVenda,
          PvdVlrTotal: item.FatConversao !== null ? (item.QVenda * item.FatConversao) * (item.VVenda - item.DVenda) : item.QVenda * (item.VVenda - item.DVenda),
          DataCriacao: actualDate,
          PdvVlrDesc: item.DVenda
        }).into("dbo.PedidosVendaDet");

        await Database.insert({
          D_FILIAL: String(verified.user_code).slice(0, 4),
          F_SERIE: 'F',
          DOC: Number(ultPvcId[0].UltimoID) + 1,
          D_ITEM: i + 1,
          M0_TIPO: 'S',
          PvTipo: String(Pedido.TipoVenda).slice(0, 10),
          D_DOC: `000000000${Number(ultPvcId[0].UltimoID) + 1}`.slice(-9),
          DEPDEST: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 0 : String(Pedido.RemOrigem).slice(0, 3) : String(0),
          DtEmissao: moment().subtract(3, "hours").toDate(),
          D_TES: '0',
          C5_ZZADEST: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 0 : String(Pedido.RemOrigem).slice(0, 3) : String(0),
          D_COD: String(item.CodFab).slice(0, 15),
          ProdId: String(item.ProdId).slice(0, 4),
          Produto: String(item.Produto).slice(0, 100),
          D_UM: String(item.UnMedida).slice(0, 2),
          D_QUANT: item.FatConversao !== null ? item.QVenda * item.FatConversao : item.QVenda,
          D_SEGUM: String(item.UnMedida).slice(0, 2),
          Pedido: Number(ultPvcId[0].UltimoID) + 1,
          D_EMISSAO: String(moment().subtract(3, "hours").format('YYYY/MM/DD').replace(/([/])/g, "")).slice(0, 8),
          A1_SATIV1: String(Pedido.Cliente.A1_SATIV1).slice(0, 6),
          A1_NREDUZ: String(Pedido.Cliente.Nome_Fantasia).slice(0, 40),
          A1_NOME: String(Pedido.Cliente.Razão_Social).slice(0, 100),
          A1_CGC: String(Pedido.Cliente.CNPJ).replace(/([-,./])/g, "").slice(0, 14),
          A1_COD: String(Pedido.Cliente.A1_COD).slice(0, 6),
          A1_LOJA: String(Pedido.Cliente.A1_LOJA).slice(0, 2),
          GRPVEN: String(verified.grpven).slice(0, 6),
          VENVLR: item.PrVenda,
          PvnRoy: item.ProdRoy,
          D_PRCVEN: item.VVenda,
          D_TOTAL: item.FatConversao !== null ? (item.QVenda * item.FatConversao) * (item.VVenda - item.DVenda) : item.QVenda * (item.VVenda - item.DVenda),
          D_DESC: item.DVenda,
          C5_CONDPAG: String(Pedido.CondPag).slice(0, 3)
        }).into("dbo.SDBase")
      });

      response.status(200).send();
    } catch (err) {
      response.status(200).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.Store',
      })
    }
  }

  async Update({ request, response, params }) {
    const token = request.header("authorization");
    const pvc = params.pvc;
    const { Pedido } = request.only(["Pedido"]);

    try {
      const verified = seeToken(token);

      const actualDate = new Date(moment().format())
      const ultPvcId = await Database.raw("select MAX(PvcID) as UltimoID from dbo.PedidosVendaCab where PvcSerie = 'F' and GrpVen = ?", [verified.grpven]);

      await Database.table('dbo.PedidosVendaCab')
        .where({
          PvcID: pvc,
          PvcSerie: 'F',
          GrpVen: verified.grpven,
          STATUS: 'P'
        })
        .update({
          STATUS: 'C',
          PvcSerie: 'A',
          DataIntegracao: new Date()
        });

      await Database.table('dbo.PedidosVendaDet')
        .where({
          PvcID: pvc,
          PvcSerie: 'F',
          GrpVen: verified.grpven,
        })
        .update({
          PvcSerie: 'A'
        });

      await Database.table('dbo.SDBase')
        .where({
          DOC: pvc,
          F_SERIE: 'F',
          D_FILIAL: verified.user_code
        })
        .update({
          F_SERIE: 'A'
        });

      await Database.insert({
        GrpVen: verified.grpven,
        PvcSerie: 'F',
        PvcID: Number(ultPvcId[0].UltimoID) + 1,
        CNPJ: Pedido.Cliente.CNPJ,
        Filial: verified.user_code,
        CpgId: Pedido.CondPag,
        DataCriacao: actualDate,
        DataIntegracao: null,
        DepId: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 1 : Pedido.RemOrigem : 0,
        DepIdDest: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 0 : Pedido.RemOrigem : 0,
        PvTipo: Pedido.TipoVenda,
        STATUS: 'P',
        MsgNF: Pedido.OBS
      }).into("dbo.PedidosVendaCab");

      Pedido.Carrinho.forEach(async (item, i) => {
        await Database.insert({
          GrpVen: verified.grpven,
          PvcSerie: 'F',
          PvcID: Number(ultPvcId[0].UltimoID) + 1,
          PvdID: i + 1,
          ProdId: item.ProdId,
          PvdQtd: item.FatConversao !== null ? item.QVenda * item.FatConversao : item.QVenda,
          PvdVlrUnit: item.VVenda,
          PvdVlrTotal: item.FatConversao !== null ? (item.QVenda * item.FatConversao) * (item.VVenda - item.DVenda) : item.QVenda * (item.VVenda - item.DVenda),
          DataCriacao: actualDate,
          PdvVlrDesc: item.DVenda
        }).into("dbo.PedidosVendaDet");

        await Database.insert({
          D_FILIAL: String(verified.user_code).slice(0, 4),
          F_SERIE: 'F',
          DOC: Number(ultPvcId[0].UltimoID) + 1,
          D_ITEM: i + 1,
          M0_TIPO: 'S',
          PvTipo: String(Pedido.TipoVenda).slice(0, 10),
          D_DOC: `000000000${Number(ultPvcId[0].UltimoID) + 1}`.slice(-9),
          DEPDEST: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 0 : String(Pedido.RemOrigem).slice(0, 3) : String(0),
          DtEmissao: moment().subtract(3, "hours").toDate(),
          D_TES: '0',
          C5_ZZADEST: Pedido.TipoVenda !== 'B' ? Pedido.TipoVenda === 'V' ? 0 : String(Pedido.RemOrigem).slice(0, 3) : String(0),
          D_COD: String(item.CodFab).slice(0, 15),
          ProdId: String(item.ProdId).slice(0, 4),
          Produto: String(item.Produto).slice(0, 100),
          D_UM: String(item.UnMedida).slice(0, 2),
          D_QUANT: item.FatConversao !== null ? item.QVenda * item.FatConversao : item.QVenda,
          D_SEGUM: String(item.UnMedida).slice(0, 2),
          Pedido: Number(ultPvcId[0].UltimoID) + 1,
          D_EMISSAO: String(moment().subtract(3, "hours").format('YYYY/MM/DD').replace(/([/])/g, "")).slice(0, 8),
          A1_SATIV1: String(Pedido.Cliente.A1_SATIV1).slice(0, 6),
          A1_NREDUZ: String(Pedido.Cliente.Nome_Fantasia).slice(0, 40),
          A1_NOME: String(Pedido.Cliente.Razão_Social).slice(0, 100),
          A1_CGC: String(Pedido.Cliente.CNPJ).replace(/([-,./])/g, "").slice(0, 14),
          A1_COD: String(Pedido.Cliente.A1_COD).slice(0, 6),
          A1_LOJA: String(Pedido.Cliente.A1_LOJA).slice(0, 2),
          GRPVEN: String(verified.grpven).slice(0, 6),
          VENVLR: item.PrVenda,
          PvnRoy: item.ProdRoy,
          D_PRCVEN: item.VVenda,
          D_TOTAL: item.FatConversao !== null ? (item.QVenda * item.FatConversao) * (item.VVenda - item.DVenda) : item.QVenda * (item.VVenda - item.DVenda),
          D_DESC: item.DVenda,
          C5_CONDPAG: String(Pedido.CondPag).slice(0, 3)
        }).into("dbo.SDBase")
      });

      response.status(200).send({ message: "ok" });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.Update',
      })
    }
  }

  async CancelVenda({ request, response, params }) {
    const token = request.header("authorization");
    const serie = params.serie;
    const pvc = params.pvc;

    try {
      const verified = seeToken(token);

      await Database.table('dbo.PedidosVendaCab')
        .where({
          PvcID: pvc,
          PvcSerie: serie,
          GrpVen: verified.grpven,
          STATUS: 'P'
        })
        .update({
          STATUS: 'C',
          DataIntegracao: new Date()
        });

      await Database.table('dbo.SDBase')
        .where({
          D_FILIAL: verified.user_code,
          F_SERIE: 'F',
          DOC: pvc,
        })
        .update({
          D_QUANT: 0,
          D_PRCVEN: 0,
          D_TOTAL: 0
        });

      response.status(200).send({ message: 'ok' })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.CancelVenda',
      })
    }
  }

  async RequestNFeGeneration({ request, response, params }) {
    const token = request.header("authorization");
    const PvcID = params.pvc;
    const PvcSerie = params.serie;

    try {
      const verified = seeToken(token);

      //verificar no sigamat se o cara pode faturar
      const Sigamat = await Database.select("M0_EmiteNF")
        .from("dbo.SIGAMAT")
        .where({
          M0_CODFIL: verified.user_code,
        });
      if (Sigamat[0].M0_EmiteNF === "N") throw new Error();

      //verifico se a nota já foi gerada, foi cancelada ou já foi solicitada.
      const NotaGerada = await Database.select("*")
        .from("dbo.PedidosVendaCab")
        .where({
          PvcID: PvcID,
          PvcSerie: PvcSerie,
          GrpVen: verified.grpven,
        });

      if (
        NotaGerada[0].STATUS === "C" ||
        NotaGerada[0].STATUS === "S" ||
        NotaGerada[0].STATUS === "F"
      ) {
        throw new Error();
      }

      //um update se for bonificacao
      if (NotaGerada[0].PvTipo === "B") {
        await Database.table('dbo.PedidosVendaDet')
          .where({
            GrpVen: verified.grpven,
            PvcSerie: PvcSerie,
            PvcID: PvcID
          })
          .update({
            PvdTES: '511'
          });
      }

      //alguns updates no pedido de remessa
      if (NotaGerada[0].PvTipo === "R") {
        //update o pedido de remessa com o CNPJ do próprio franqueado
        await Database.raw(
          "UPDATE dbo.PedidosVendaCab SET CNPJ = (select top(1) M0_CGC from dbo.FilialEntidadeGrVenda where A1_GRPVEN = ?) WHERE GrpVen = ? AND P.PvcSerie= ? AND P.PvcID = ?",
          [verified.grpven, verified.grpven, PvcSerie, PvcID]
        );

        //update de tes no pedido
        await Database.raw(
          "UPDATE dbo.PedidosVendaDet SET PvdTES = '979' WHERE GrpVen = ? AND PvcSerie = ? AND PvcID = ?",
          [verified.grpven, PvcSerie, PvcID]
        );
      }

      //updates diversos
      await Database.raw(
        "UPDATE P SET P.PvdTES = [TES] FROM ( dbo.FilialEntidadeGrVenda AS F INNER JOIN dbo.FilialTES AS T ON F.M0_CODFIL = T.FILIAL ) INNER JOIN dbo.PedidosVendaDet AS P ON F.A1_GRPVEN = P.GrpVen WHERE P.PvcSerie = 'F' AND P.PvdTES Is Null",
        []
      );

      await Database.raw(
        "UPDATE P SET P.PvdTES = [TES] FROM ( dbo.FilialEntidadeGrVenda AS F INNER JOIN dbo.PedidosVendaDet AS P ON F.A1_GRPVEN = P.GrpVen ) INNER JOIN dbo.FilialProdIdTES AS T ON (P.ProdId = T.ProdId) AND (F.M0_CODFIL = T.FILIAL) WHERE ( ((P.PvdTES) Is Null) AND ((P.PvcSerie) = 'F') )",
        []
      );

      await Database.raw(
        "UPDATE P SET P.PvdTES = [TES] FROM dbo.PedidosVendaDet AS P INNER JOIN dbo.ProdIdTES AS T ON P.ProdId = T.ProdId WHERE ( ((P.PvcSerie) = 'F') AND ((P.PvdTES) Is Null) )",
        []
      );

      await Database.raw(
        "UPDATE P SET P.PvdNatureza = [NATUREZA] FROM ( dbo.PedidosVendaDet AS P INNER JOIN dbo.FilialEntidadeGrVenda AS F ON P.GrpVen = F.A1_GRPVEN ) INNER JOIN FilialProdIdNatureza AS N ON (P.ProdId = N.ProdId) AND (F.M0_CODFIL = N.FILIAL) WHERE P.PvdNatureza Is Null AND P.PvcSerie = 'F'",
        []
      );

      await Database.raw(
        "UPDATE P SET P.PvdNatureza = [NATUREZA] FROM dbo.PedidosVendaDet AS P INNER JOIN ProdIdNatureza AS N ON P.ProdId = N.ProdId WHERE P.PvdNatureza Is Null AND P.PvcSerie = 'F'",
        []
      );

      const UltimoIDPedido = await Database.raw('select MAX(PedidoID) as UltimoID from dbo.PedidosVenda', [])
      const NovoIDPedido = Number(UltimoIDPedido[0].UltimoID) + 1

      const PedidoParaFaturar = await Database.raw(queryPedidosParaFaturar, [NovoIDPedido, verified.grpven, PvcID])

      if (PedidoParaFaturar.length < 1) {
        throw new Error('Não há itens à faturar na pedidosVendaDet')
      }

      PedidoParaFaturar.forEach(async (item, i) => {
        await Database.insert({
          GrpVen: verified.grpven,
          Filial: verified.user_code,
          PedidoID: NovoIDPedido,
          PedidoItemID: i + 1,
          CodigoCliente: item.A1_COD,
          LojaCliente: item.A1_LOJA,
          CodigoTabelaPreco: item.TNF_TblPreco,
          CodigoVendedor: item.TNF_CodVnd,
          CodigoCondicaoPagto: item.CPag,
          TipoFrete: item.TNF_Frete,
          CodigoProduto: item.CodFab,
          QtdeVendida: item.PvdQtd,
          PrecoUnitarioLiquido: item.PvdVlrUnit,
          PrecoTotal: item.PvdVlrTotal,
          DataCriacao: item.DataCriacao,
          TipOp: item.TNF_TipOp,
          TES: item.PvdTES,
          NATUREZA: item.TNF_NATUREZA,
          MsgNotaFiscal: item.MsgNF,
          VlrDesconto: item.PdvVlrDesc
        }).into('dbo.PedidosVenda')
      })

      await Database.table('dbo.PedidosVendaCab')
        .where({
          GrpVen: verified.grpven,
          PvcSerie: PvcSerie,
          PvcID: PvcID
        })
        .update({
          STATUS: 'S',
          PedidoId: NovoIDPedido
        });

      response.status(200).send({ message: 'ok', pedido: NovoIDPedido });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.RequestNFeGeneration',
      })
    }
  }

  async RecoverDocs({ request, response, params }) {
    const token = request.header("authorization");
    const serie = params.serie;
    const pvc = params.pvc;
    const doctype = params.doctype;
    let retorno = { message: "Vazio" };

    try {
      const verified = seeToken(token);

      const numeroExterno = await Database.select('PedidoId', 'PedidoN')
        .from("dbo.PedidosVendaCab")
        .where({
          GrpVen: verified.grpven,
          PvcSerie: serie,
          PvcID: pvc,
        });

      const NFe = await Database.connection("pg")
        .select("num_pedido", "chave_de_acesso")
        .from("swvix.pedido")
        .where({
          num_externo: numeroExterno[0].PedidoId,
          status: "1",
          localestoque: verified.user_code,
        });

      const nfeTarget = NFe.length > 0 ? NFe[0].num_pedido : numeroExterno[0].PedidoN

      const prefixoCancelamento = "110111";
      const prefixoCartaDeCorrecao = "110110";
      /*o 01 é a ordem do evento, 
      cancelamento(110111) sempre tem a ordem 01(não da pra cancelar duas vezes a mesma nota),
      já carta de correcao pode ter 02, 03...
      */
      const sulfixoComum = "01-procEventoNFe.xml";

      const names = {
        nomeDanfe:
          `000000000000000000000000000000${nfeTarget}_nfe_-DANFE.pdf`.slice(
            -45
          ),
        nomeXml:
          `000000000000000000000000000000${nfeTarget}_nfe_.xml`.slice(
            -39
          ),
        nomeCancelamento: `${prefixoCancelamento}${NFe[0].chave_de_acesso}${sulfixoComum}`,
        nomeCartaDeCorrecao: `${prefixoCartaDeCorrecao}${NFe[0].chave_de_acesso}${sulfixoComum}`,
      };
      //pegar nota de devolucao tambem?

      const paths = {
        toDANFE: `${Env.get("NSJ_DOCDIR")}\\Xml\\Emissao\\Resposta\\${names.nomeDanfe}`,
        toXML: `${Env.get("NSJ_DOCDIR")}\\Xml\\Emissao\\Resposta\\${names.nomeXml}`,
        toCancelamento: `${Env.get("NSJ_DOCDIR")}\\Docs\\${names.nomeCancelamento}`,
        toCCorrecao: `${Env.get("NSJ_DOCDIR")}\\Docs\\${names.nomeCartaDeCorrecao}`,
      };

      switch (doctype) {
        case "DANFE":
          retorno =
            (await Drive.exists(paths.toDANFE)) &&
            (await Drive.get(paths.toDANFE));
          break;
        case "XML":
          retorno =
            (await Drive.exists(paths.toXML)) && (await Drive.get(paths.toXML));
          break;
        case "CANCELAMENTO":
          retorno =
            (await Drive.exists(paths.toCancelamento)) &&
            (await Drive.get(paths.toCancelamento));
          break;
        case "CC":
          retorno =
            (await Drive.exists(paths.toCCorrecao)) &&
            (await Drive.get(paths.toCCorrecao));
          break;
      }

      response.status(200).send(retorno);
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.RecoverDocs',
      })
    }
  }

  async GenPDFVenda({ request, response, params }) {
    const token = request.header("authorization");
    const serie = params.serie;
    const pvc = params.pvc;
    const path = Helpers.publicPath(`/tmp`);
    const PathWithName = `${path}/${pvc}-${serie}-${new Date().getTime()}.pdf`;

    try {
      const verified = seeToken(token);

      const vendaCab = await Database.raw('select C.Nome_Fantasia, PC.PvcID, PC.PvTipo, C.CNPJss, PC.DataCriacao, C.TPessoa from dbo.PedidosVendaCab as PC inner join dbo.Cliente as C on PC.CNPJ = C.CNPJ where PC.GrpVen = ? and PC.PvcID = ? and PC.PvcSerie = ?',
        [verified.grpven, pvc, serie])

      const vendaDet = await Database.raw('select PD.ProdId, P.Produto, PD.PvdQtd, PD.PvdVlrUnit, PD.PvdVlrTotal from dbo.PedidosVendaDet as PD inner join dbo.Produtos as P on PD.ProdId = P.ProdId where GrpVen = ? and PD.PvcID = ? and PD.PvcSerie = ?',
        [verified.grpven, pvc, serie])

      const PDFModel = PDFGen(vendaCab[0], vendaDet);

      var pdfDoc = printer.createPdfKitDocument(PDFModel);
      pdfDoc.pipe(fs.createWriteStream(PathWithName));
      pdfDoc.end();

      const enviarDaMemóriaSemEsperarSalvarNoFS = await toArray(pdfDoc).then(parts => {
        return Buffer.concat(parts);
      })

      response.status(200).send(enviarDaMemóriaSemEsperarSalvarNoFS)
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'VendaController.GenPDFVenda',
      })
    }
  }
}

module.exports = VendaController;

const queryListaDeProdutos = "select Pr.* from dbo.PrecoVenda as PV inner join dbo.Produtos as Pr on PV.ProdId = Pr.ProdId where Pr.Venda = 'S' and PV.GrpVen = '000000' and PV.AnxId = 0 and PV.PdvId = 0 and Pr.Atv2Inat1 = 2 order by Pr.Produto";

const queryPedidosParaFaturar = "SELECT dbo.PedidosVendaCab.GrpVen, dbo.FilialEntidadeGrVenda.M0_CODFIL, ? AS PedidoId, dbo.PedidosVendaDet.PvdID, dbo.Cliente.A1_COD, dbo.Cliente.A1_LOJA, dbo.TipoNF.TNF_TblPreco, dbo.TipoNF.TNF_CodVnd, dbo.CondicaoPagamento.E4_CODIGO AS CPag, dbo.TipoNF.TNF_Frete, dbo.Produtos.CodFab, dbo.PedidosVendaDet.PvdQtd, dbo.PedidosVendaDet.PvdVlrUnit, dbo.PedidosVendaDet.PvdVlrTotal, dbo.PedidosVendaCab.DataCriacao, dbo.TipoNF.TNF_TipOp, dbo.PedidosVendaDet.PvdTES, dbo.TipoNF.TNF_NATUREZA, dbo.PedidosVendaCab.MsgNF, dbo.PedidosVendaDet.PdvVlrDesc FROM ( ( ( ( dbo.Cliente INNER JOIN ( dbo.PedidosVendaCab INNER JOIN dbo.PedidosVendaDet ON ( dbo.PedidosVendaCab.PvcID = dbo.PedidosVendaDet.PvcID ) AND ( dbo.PedidosVendaCab.PvcSerie = dbo.PedidosVendaDet.PvcSerie ) AND ( dbo.PedidosVendaCab.GrpVen = dbo.PedidosVendaDet.GrpVen ) ) ON ( dbo.Cliente.GrpVen = dbo.PedidosVendaCab.GrpVen ) AND ( dbo.Cliente.CNPJ = dbo.PedidosVendaCab.CNPJ ) ) INNER JOIN dbo.FilialEntidadeGrVenda ON dbo.PedidosVendaCab.GrpVen = dbo.FilialEntidadeGrVenda.A1_GRPVEN ) INNER JOIN dbo.CondicaoPagamento ON dbo.PedidosVendaCab.CpgId = dbo.CondicaoPagamento.CpgId ) INNER JOIN dbo.Produtos ON dbo.PedidosVendaDet.ProdId = dbo.Produtos.ProdId ) INNER JOIN dbo.TipoNF ON dbo.PedidosVendaCab.PvTipo = dbo.TipoNF.TNFCod WHERE ( ((dbo.PedidosVendaCab.GrpVen) = ?) AND ((dbo.CondicaoPagamento.GrpVen) = '000000') AND ((dbo.PedidosVendaCab.PvcID) = ?) AND ((dbo.PedidosVendaCab.PvcSerie) = 'F'))"