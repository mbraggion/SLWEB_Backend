"use strict";
const Database = use("Database");
const Drive = use("Drive");
const Mail = use("Mail");
const Env = use("Env");
const Helpers = use("Helpers");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index")
const PdfPrinter = require("pdfmake");
const toArray = require('stream-to-array')
const fs = require("fs");
const { PDFGen } = require("../../../../resources/pdfModels/detalhesCompra_pdfModel");

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

class CompraController {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Produtos({ request, response }) {
    const token = request.header("authorization");

    try {
      seeToken(token);

      Database.raw('execute dbo.sp_AcertaPedCompra')

      const Produtos = await Database.raw(queryProdutos);
      const Desconto = await Database
        .select('ParamVlr')
        .from('dbo.Parametros')
        .where({
          ParamId: 'DESCONTO_COMPRA_GERAL'
        })

      let aux = [];

      Produtos.map((element) => aux.push({ ...element, QCompra: 0 }));

      response.status(200).send({
        Produtos: aux,
        Desconto: Desconto[0].ParamVlr > 1 ? 0 : Desconto[0].ParamVlr,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'CompraController.Produtos',
      })
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

      const PedidosNaoFaturados = await Database.raw(queryPedidosAFaturar, [verified.grpven]);

      const ComprasAoAno = await Database.raw(queryComprasAno, verified.grpven);

      const Reputacao = await Database.select('Confiavel').from('dbo.FilialEntidadeGrVenda').where({
        A1_GRPVEN: verified.grpven
      })

      const Geral = {
        ...Object.assign(InfoCompras[0], InfoBloqueado[0]),
        Compras: InfoCompras[0].Compras + PedidosNaoFaturados[0].Total,
        LimiteAtual: InfoCompras[0].LimiteAtual - PedidosNaoFaturados[0].Total,
      };

      let nCompensa = []

      if (!Reputacao[0].Confiavel) {
        nCompensa = await Database
          .select('E1Prefixo as E1_PREFIXO', 'E1Num as E1_NUM', 'E1Parcela as E1_PARCELA')
          .from('dbo.SE1_exc')
          .where({
            GrpVen: verified.grpven
          })
      }

      response.status(200).send({
        Geral: Geral,
        Duplicatas: DuplicatasAberto,
        ComprasAno: ComprasAoAno,
        AFaturar: PedidosNaoFaturados,
        Confiavel: Reputacao[0].Confiavel,
        NaoCompensavel: nCompensa
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'CompraController.Contas',
      })
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
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'CompraController.Pedidos',
      })
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
        PedidoDet = await Database.raw(
          `execute ProcPedidosCompraAtendidosDet @GrpVen=?, @Filial=?, @PedidoId=?`,
          [verified.grpven, verified.user_code, PedidoID]
        );

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

      if (Status === "DOC") {
        //busca nos pedidos atendidos
        PedidoDet = await Database.raw(queryPedidosAtendidosDetPorDocNum, [
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

      Pedido.PedidoId = PedidoID;

      response.status(200).send(Pedido);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'CompraController.PedidoDet',
      })
    }
  }

  async Comprar({ request, response }) {
    const token = request.header("authorization");
    const { Items, Obs, Retira, AVista, Desconto } = request.only(["Items", "Obs", "Retira", 'AVista', 'Desconto']);

    try {
      const verified = seeToken(token);

      //verifico se o pedido tem pelo menos 1 item
      if (Items.length === 0) {
        throw new Error();
      }

      //testar se o cara tem limite
      const limite = await Database.raw(queryLimiteDisponivel, [
        verified.grpven,
      ]);

      const PedidosNaoFaturados = await Database.raw(
        "SELECT IIF(Sum(dbo.PedidosVenda.PrecoTotal) is null, 0, Sum(dbo.PedidosVenda.PrecoTotal)) AS Total FROM dbo.PedidosVenda INNER JOIN dbo.PedidosCompraCab ON (     dbo.PedidosVenda.Filial = dbo.PedidosCompraCab.Filial ) AND (     dbo.PedidosVenda.PedidoID = dbo.PedidosCompraCab.PedidoId ) WHERE (     ((dbo.PedidosCompraCab.NroNF) Is Null)     AND ((dbo.PedidosCompraCab.GrpVen) = ?)     AND (    (dbo.PedidosVenda.STATUS) <> 'C'    Or (dbo.PedidosVenda.STATUS) Is Null and dbo.PedidosCompraCab.STATUS <> 'C' or dbo.PedidosCompraCab.STATUS is null     ) )",
        [verified.grpven]
      );

      let TotalDoPedido = 0;
      Items.map(
        (item) =>
        (TotalDoPedido +=
          Number(item.QCompra) * (Number(item.QtMin) * (Number(item.VlrUn) * ((AVista ? 0.95 : 1) + (Desconto && item.ProdRoy === 1 ? Desconto : 1) - 1))))
      );

      if (
        limite[0].LimiteAtual - PedidosNaoFaturados[0].Total - TotalDoPedido <=
        0
      ) {
        throw new Error();
      }


      //testo se o cara ta bloqueado
      const bloqueado = await Database.raw(queryBloqueado, [verified.grpven]);
      if (bloqueado[0] && bloqueado[0].Bloqueado === "S") {
        throw new Error();
      }

      //busco dados do franqueado
      const Franqueado = await Database.select("A1_COD", "A1_LOJA", "CondPag")
        .from("dbo.FilialEntidadeGrVenda")
        .where({
          A1_GRPVEN: verified.grpven,
        });

      //busco o número do último pedido
      const UltPedidoID = await Database.raw(
        "select MAX(PedidoID) as UltPedido from dbo.PedidosVenda",
        []
      );

      const ProxId = Number(UltPedidoID[0].UltPedido) + 1;

      //salvo o pedido nas tabelas
      await Database.insert({
        GrpVen: verified.grpven,
        PedidoId: ProxId,
        STATUS: null,
        Filial: "0201",
        CpgId: AVista ? '001' : Franqueado[0].CondPag,
        DataCriacao: new Date(moment().subtract(3, "hours").format()),
      }).into("dbo.PedidosCompraCab");

      Items.forEach(
        async (item, i) =>
          await Database.insert({
            EMISS: "00",
            SERIE: "1",
            PedidoID: ProxId,
            PedidoItemID: i + 1,
            CodigoCliente: Franqueado[0].A1_COD,
            LojaCliente: Franqueado[0].A1_LOJA,
            CodigoDL: " ",
            LojaDL: " ",
            Filial: "0201",
            CodigoTabelaPreco: "462",
            CodigoVendedor: "000026",
            CodigoCondicaoPagto: AVista ? '001' : Franqueado[0].CondPag,
            TipoFrete: "C",
            MsgNotaFiscal: null,
            MsgPadrao: null,
            DataEntrega: null,
            CodigoProduto: `00000${item.Cód}`.slice(-5),
            QtdeVendida: item.QCompra * item.QtMin,
            PrecoUnitarioLiquido: item.VlrUn * ((AVista ? 0.95 : 1) + (Desconto && item.ProdRoy === 1 ? Desconto : 1) - 1),
            PrecoTotal: item.QCompra * (item.QtMin * item.VlrUn) * ((AVista ? 0.95 : 1) + (Desconto && item.ProdRoy === 1 ? Desconto : 1) - 1),
            Limite: null,
            CodigoTotvs: null,
            DataCriacao: new Date(moment().subtract(3, "hours").format()),
            DataIntegracao: null,
            GrpVen: verified.grpven,
            MsgBO: Retira ? Obs.concat(" *FRANQUEADO RETIRA*") : Obs,
            NATUREZA: 10117,
            TipOp: "01",
            TES: String(item.Cód) === "03994" ? "674" : null,
          }).into("dbo.PedidosVenda")
      );

      response.status(200).send(TotalDoPedido);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'CompraController.Comprar',
      })
    }
  }

  async Cancelar({ request, response, params }) {
    const token = request.header("authorization");
    const PedidoId = params.ID;

    try {
      seeToken(token);

      const pedidoCab = await Database.select("STATUS")
        .from("dbo.PedidosCompraCab")
        .where({
          PedidoId: PedidoId,
        });

      const pedidoVenda = await Database.select("DataIntegracao")
        .from("dbo.PedidosVenda")
        .where({
          PedidoID: PedidoId,
        });

      if (pedidoCab[0].STATUS === "C") {
        response.status(400).send({ message: "Pedido já cancelado" });
      } else if (pedidoVenda[0].DataIntegracao !== null) {
        response.status(400).send({ message: "Pedido em processamento" });
      } else {
        await Database.table("dbo.PedidosCompraCab")
          .where({
            PedidoId: PedidoId,
          })
          .update({
            STATUS: "C",
          });

        await Database.table("dbo.PedidosVenda")
          .where({
            PedidoID: PedidoId,
          })
          .update({
            STATUS: "C",
            DataIntegracao: new Date(moment().subtract(3, "hours").format()),
          });
        response.status(200).send({ message: "ok" });
      }
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'CompraController.Cancelar',
      })
    }
  }

  async RetriveBoleto({ request, response, params }) {
    const token = request.header("authorization");
    const PedidoId = params.ID;
    const Parcela = params.P;

    try {
      seeToken(token);

      const path = `\\\\192.168.1.248\\totvs12\\Producao\\protheus_data\\DANFE_FRANQUIA\\0201\\boleto_${PedidoId}${Parcela === 'UNICA' ? '' : `_${Parcela}`}.pdf`

      const Imagem = await Drive.exists(path) ? await Drive.get(path) : { message: 'File not found' };

      response.status(200).send(Imagem);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'CompraController.RetriveBoleto',
      })
    }
  }

  async RetriveNota({ request, response, params }) {
    const token = request.header("authorization");
    const PedidoId = params.ID;

    try {
      seeToken(token);

      const path = `\\\\192.168.1.248\\totvs12\\Producao\\protheus_data\\DANFE_FRANQUIA\\0201\\nf\\nf_${PedidoId}.pdf`

      const Imagem = await Drive.exists(path) ? await Drive.get(path) : { message: 'File not found' };

      response.status(200).send(Imagem);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'CompraController.RetriveNota',
      })
    }
  }

  async Compensar({ request, response }) {
    const folderName = request.input('folderName')
    const multiples = request.input('multiple')
    const nf = request.input('nf')
    const serie = request.input('serie')
    const parcela = request.input('parcela')
    const valor = request.input('valor')
    const token = request.header("authorization");
    const formData = request.file("formData", {
      types: ["image", "pdf"],
      size: "10mb",
    });
    const verified = seeToken(token);
    let path = Helpers.publicPath(`/COMPROVANTES/${verified.user_code}/${folderName}`);
    let newFileName = ''
    let filenames = []
    let file = null

    try {
      if (multiples === 'N') {

        newFileName = `comprovante-1-${new Date().getTime()}.${formData.subtype}`;

        await formData.move(path, {
          name: newFileName,
          overwrite: true,
        });

        if (!formData.moved()) {
          return formData.errors();
        }

        file = await Drive.get(`${path}/${newFileName}`);
        Drive.put(
          `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\COMPROVANTES\\${verified.user_code}\\${folderName}\\${newFileName}`,
          file
        );
      } else {
        await formData.moveAll(path, (file, i) => {
          newFileName = `comprovante-${i + 1}-${new Date().getTime()}.${file.subtype}`;
          filenames.push(newFileName);

          return {
            name: newFileName,
            overwrite: true,
          };
        });

        if (!formData.movedAll()) {
          return formData.errors();
        }

        filenames.map(async (name) => {
          file = await Drive.get(`${path}/${name}`);
          Drive.put(
            `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\COMPROVANTES\\${verified.user_code}\\${folderName}\\${name}`,
            file
          );
        });
      }

      const exists = await Database
        .select("*")
        .from('dbo.SE1_exc')
        .where({
          E1Prefixo: serie,
          E1Num: nf,
          E1Parcela: parcela
        })

      if (exists.length === 0) {
        await Database.insert({
          E1Prefixo: serie,
          E1Num: nf,
          E1Parcela: parcela,
          DtInserido: moment().subtract(3, "hours").toDate(),
          Origem: 'SLWEB',
          EmailFinanceiro: false,
          GrpVen: verified.grpven
        }).into('dbo.SE1_exc')
      }

      const franqueado = await Database
        .select('A1_COD', 'A1_LOJA', 'GrupoVenda')
        .from('dbo.FilialEntidadeGrVenda')
        .where({
          A1_GRPVEN: verified.grpven,
        })

      await Mail.send(
        "emails.CompensacaoDeDuplicata",
        {
          FRANQUEADO: franqueado[0].GrupoVenda,
          CODIGO: franqueado[0].A1_COD,
          LOJA: franqueado[0].A1_LOJA,
          DUPLICATA: nf,
          SERIE: serie,
          PARCELA: String(parcela).trim() === '' ? 1 : String(parcela).trim(),
          Frontend: Env.get("CLIENT_URL"),
          VALOR: valor
        },
        (message) => {
          message
            .to([Env.get("EMAIL_FINANCEIRO_1"), Env.get("EMAIL_FINANCEIRO_2")])
            .cc([Env.get("EMAIL_COMERCIAL_1"), Env.get("EMAIL_SUPORTE")])
            .from(Env.get("MAIL_USERNAME"), "SLWEB")
            .subject(`Baixa de título do(a) franqueado(a) ${String(franqueado[0].GrupoVenda).split(' ')[0]} - ${franqueado[0].A1_COD}/${franqueado[0].A1_LOJA} - R$ ${valor}`)
            .attach(`${path}/${newFileName}`)
        }
      );

      await Database.table("dbo.SE1_exc")
        .where({
          E1Prefixo: serie,
          E1Num: nf,
          E1Parcela: parcela,
        })
        .update({
          EmailFinanceiro: true,
        });

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'CompraController.Compensar',
      })
    }
  }

  async GenPDFCompra({ request, response, params }) {
    const token = request.header("authorization");
    const pedidoid = params.pedidoid;
    const status = params.status;
    const path = Helpers.publicPath(`/tmp`);
    const PathWithName = `${path}/${pedidoid}-${new Date().getTime()}.pdf`;

    try {
      const verified = seeToken(token);

      let compraCab = []
      let compraDet = []

      if (status === 'Processando') {
        compraCab = await Database.raw("select C.Nome_Fantasia, PC.PedidoId as PvcID, C.CNPJss, PC.DataCriacao, C.TPessoa from dbo.PedidosCompraCab as PC inner join dbo.Cliente as C on PC.GrpVen = C.GrpVen and C.A1_SATIV1 = '000113' and A1Tipo = 'R' where PC.PedidoId = ? and PC.GrpVen = ?", [pedidoid, verified.grpven]);

        compraDet = await Database.raw("select PV.CodigoProduto as ProdId, P.Produto, PV.QtdeVendida as PvdQtd, PV.PrecoUnitarioLiquido as PvdVlrUnit, P.PrCompra,PV.PrecoTotal as PvdVlrTotal from dbo.PedidosVenda as PV inner join dbo.Produtos as P on PV.CodigoProduto = P.ProdId where PV.PedidoID = ? and PV.GrpVen = ? order by PV.PedidoItemID ASC", [pedidoid, verified.grpven])
      } else if (status === 'Faturado') {
        compraCab = await Database.raw("select C.Nome_Fantasia, PC.PedidoId as PvcID, C.CNPJss, PC.DataCriacao, C.TPessoa from dbo.PedidosCompraCab as PC inner join dbo.Cliente as C on PC.GrpVen = C.GrpVen and C.A1_SATIV1 = '000113' and A1Tipo = 'R' where PC.C5NUM = ? and PC.GrpVen = ?", [pedidoid, verified.grpven])

        if (!compraCab[0]) {
          compraCab = await Database.raw("SELECT distinct C.Nome_Fantasia, S.Pedido as PvcID, C.CNPJss, S.DtEmissao as DataCriacao, C.TPessoa FROM dbo.SDBase as S inner join dbo.Cliente as C on S.SA1_GRPVEN = C.GrpVen and C.A1_SATIV1 = '000113' and C.A1Tipo = 'R' WHERE S.Pedido = ? and S.GRPVEN = ? order by D_ITEM ASC", [pedidoid, verified.grpven])
        }

        compraDet = await Database.raw("select S.D_COD as ProdId, P.Produto, S.D_QUANT as PvdQtd, S.D_PRCVEN PvdVlrUnit, P.PrCompra, S.D_TOTAL as PvdVlrTotal from dbo.SDBase as S inner join dbo.Produtos as P on S.ProdId = P.ProdId where Pedido = ? and GRPVEN = ?", [pedidoid, verified.grpven])
      }

      const PDFModel = PDFGen(compraCab[0], compraDet);

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
        err: err,
        handler: 'CompraController.GenPDFCompra',
      })
    }
  }

  async ConsultaRota({ request, response, params }) {
    const token = request.header("authorization");
    let CEPManual = params.CEP
    let CEPDefault = null
    let CEPTarget = null

    try {
      const verified = seeToken(token);

      if (CEPManual === 'WYSI') {
        CEPDefault = await Database.raw(
          "select C.CEP, F.UF, C.Município from dbo.FilialEntidadeGrVenda as F left join dbo.Cliente as C on F.A1_COD = C.A1_COD and F.A1_GRPVEN = C.GrpVen and C.TPessoa = 'J' where F.M0_CODFIL = ?",
          [verified.user_code]
        )

        if (String(CEPDefault[0].UF).trim() !== 'SP') {
          CEPTarget = null
        } else {
          CEPTarget = CEPDefault[0].CEP
        }
      } else {
        CEPTarget = CEPManual
      }

      if (CEPTarget === null) {
        response.status(200).send({
          Faturamento: {
            CEP: CEPDefault[0].CEP,
            Regiao: CEPDefault[0].Município,
            Faturamento: 'Sem previsão',
            Rota: 'Sem rota',
            PrevFaturamento: '',
            PrevRota: ''
          }
        });
        return
      }

      const rotas = await Database.select('*').from('dbo.SLWEB_Rotas')

      const matchIndexes = matchCEPWithRanges(CEPTarget, rotas.map(rota => rota.range_CEP))

      if (matchIndexes.length === 0) {
        console.log('nenhum match para o CEP:' + CEPTarget)
        //fazer alguma coisa caso a gente não encontre nenhuma rota automaticamente
      }

      response.status(200).send({
        Faturamento: {
          CEP: CEPTarget,
          Regiao: rotas[matchIndexes[0]].desc_CEP,
          Faturamento: rotas[matchIndexes[0]].faturamento,
          Rota: rotas[matchIndexes[0]].rota,
          PrevFaturamento: returnNextAvailableDate(rotas[matchIndexes[0]].faturamento).format('LL'),
          PrevRota: returnNextAvailableDate(rotas[matchIndexes[0]].rota, returnNextAvailableDate(rotas[matchIndexes[0]].faturamento)).format('LL')
        }
      });

    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'CompraController.ConsultaRota',
      })
    }
  }
}

module.exports = CompraController;

const matchCEPWithRanges = (targetCEP, CEPRanges) => {
  const matchIndex = []

  CEPRanges.forEach((range, index) => {
    let result = testCEPMatch(targetCEP, range)

    if (result === true) {
      matchIndex.push(index)
    }

  })

  return matchIndex
}

const testCEPMatch = (targetCEP, CEPRange) => {
  //tem "a"
  let isRange = String(CEPRange).includes('a') || String(CEPRange).includes('A')

  //tem "/"
  let isMultipleExact = String(CEPRange).includes('/')

  //cep exato
  let isSingleExact = !String(CEPRange).includes('/') && !String(CEPRange).includes('a') && !String(CEPRange).includes('A') && String(CEPRange).trim() !== '' && CEPRange !== null && typeof CEPRange !== 'undefined'

  //tem "a" e "/"
  let isRangeAndExact = String(CEPRange).includes('/') && (String(CEPRange).includes('a') || String(CEPRange).includes('A'))

  let aux = null
  let deuMatch = false

  if (isRangeAndExact) {
    let secondaryRange = []

    aux = String(CEPRange).split('/')

    aux.forEach((item, index) => {
      if (String(item).includes('a') || String(item).includes('A')) {
        secondaryRange.push(item)
        aux.splice(index, 1)
      }
    })

    aux.forEach((item) => {
      if (String(targetCEP).includes(String(item))) {
        deuMatch = true
      }
    })

    if (Number(formatCEP(secondaryRange[0].split(/[a]/i)[0].trim())) <= Number(formatCEP(targetCEP)) && Number(formatCEP(secondaryRange[0].split(/[a]/i)[1].trim())) >= Number(formatCEP(targetCEP))) {
      deuMatch = true
    }

    return deuMatch
  } else if (isMultipleExact || isSingleExact) {
    aux = String(CEPRange).split('/')

    aux.forEach((item) => {
      if (String(targetCEP).includes(item)) {
        deuMatch = true
      }
    })

    return deuMatch
  } else if (isRange) {
    aux = String(CEPRange).split(/[a]/i)

    if (Number(formatCEP(aux[0].trim())) <= Number(formatCEP(targetCEP)) && Number(formatCEP(aux[1].trim())) >= Number(formatCEP(targetCEP))) {
      deuMatch = true
    }

    return deuMatch
  } else {
    return deuMatch
  }
}

const formatCEP = (CEP) => {
  let newCEP = String(CEP)

  if (newCEP.length < 5) {
    newCEP = newCEP.padStart(5, '0')
  }

  if (newCEP.length < 8) {
    newCEP = newCEP.padEnd(8, '0')
  }

  return newCEP
}

const convertWeekDayToInteger = (weekday) => {
  switch (weekday) {
    case 'SEGUNDA':
      return 1
    case 'TERÇA':
      return 2
    case 'QUARTA':
      return 3
    case 'QUINTA':
      return 4
    case 'SEXTA':
      return 5
  }
}

const returnNextAvailableDate = (rawWeekday, countSince = null) => {
  let today

  if (countSince === null) {
    today = moment().isoWeekday();
  } else {
    today = countSince.isoWeekday()
  }

  if (today < convertWeekDayToInteger(rawWeekday) && countSince !== null) {
    return countSince.isoWeekday(convertWeekDayToInteger(rawWeekday));
  } else if (today < convertWeekDayToInteger(rawWeekday)) {
    return moment().isoWeekday(convertWeekDayToInteger(rawWeekday));
  } else if (countSince !== null) {
    return countSince.add(1, 'weeks').isoWeekday(convertWeekDayToInteger(rawWeekday));
  } else {
    return moment().add(1, 'weeks').isoWeekday(convertWeekDayToInteger(rawWeekday));
  }
}

const queryProdutos =
  "SELECT dbo.Produtos.ProdId AS Cód, dbo.Produtos.Produto, dbo.Produtos.ProdQtMinCompra AS QtMin, dbo.Produtos.PrCompra AS VlrUn, [ProdQtMinCompra] * [PrCompra] AS Vlr, dbo.Produtos.FatConversao, dbo.Produtos.ProdRoy FROM dbo.Produtos WHERE dbo.Produtos.Compra = 'S' ORDER BY dbo.Produtos.Produto";

const queryGigante1 =
  "SELECT dbo.FilialEntidadeGrVenda.LimiteCredito, IIF( IIF( dbo.FilialEntidadeGrVenda.DtExtraCredito is null, DATEADD(HOUR, -24, GETDATE()), DATEDIFF( hour, dbo.FilialEntidadeGrVenda.DtExtraCredito, GETDATE() ) ) > 24, 0, IIF( dbo.FilialEntidadeGrVenda.LimExtraCredito is null, 0, dbo.FilialEntidadeGrVenda.LimExtraCredito ) ) as LimExtraCredito, dbo.FilialEntidadeGrVenda.Retira, dbo.FilialEntidadeGrVenda.VlrMinCompra, SE1_GrpVenT.Avencer, SE1_GrpVenT.Vencida, SE1_ComprasNVencidas.Compras, IIf( [Compras] > 0, [LimiteCredito] + IIF( IIF( dbo.FilialEntidadeGrVenda.DtExtraCredito is null, DATEADD(HOUR, -24, GETDATE()), DATEDIFF( hour, dbo.FilialEntidadeGrVenda.DtExtraCredito, GETDATE() ) ) > 24, 0, dbo.FilialEntidadeGrVenda.LimExtraCredito ) - [Compras], [LimiteCredito] + IIF( IIF( dbo.FilialEntidadeGrVenda.DtExtraCredito is null, DATEADD(HOUR, -24, GETDATE()), DATEDIFF( hour, dbo.FilialEntidadeGrVenda.DtExtraCredito, GETDATE() ) ) > 24, 0, IIF( dbo.FilialEntidadeGrVenda.LimExtraCredito is null, 0, dbo.FilialEntidadeGrVenda.LimExtraCredito ) ) ) AS LimiteAtual FROM ( ( dbo.FilialEntidadeGrVenda LEFT JOIN ( SELECT SE1_GrpVen.GrpVen, Sum(IIf([SE1DtVencR] > GETDATE(), 0, [E1_SALDO])) AS Avencer, Sum(IIf([SE1DtVencR] < GETDATE(), [E1_SALDO], 0)) AS Vencida FROM ( SE1_GrpVen INNER JOIN SE1_Class ON (SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) ) LEFT JOIN dbo.SE1DtVenc ON SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc GROUP BY SE1_GrpVen.GrpVen ) as SE1_GrpVenT ON dbo.FilialEntidadeGrVenda.A1_GRPVEN = SE1_GrpVenT.GrpVen ) LEFT JOIN ( SELECT SE1_GrpVen.GrpVen, Sum(SE1_GrpVen.E1_SALDO) AS Compras FROM ( SE1_GrpVen INNER JOIN SE1_Class ON (SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) AND (SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) ) LEFT JOIN dbo.SE1DtVenc ON SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc WHERE (((SE1_Class.E1Desc = 'Compra' ))) GROUP BY SE1_GrpVen.GrpVen ) as SE1_ComprasNVencidas ON dbo.FilialEntidadeGrVenda.A1_GRPVEN = SE1_ComprasNVencidas.GrpVen ) WHERE (dbo.FilialEntidadeGrVenda.A1_GRPVEN = ?)";

const queryBloqueado =
  "SELECT IIF(SUM(SE1_GrpVen.E1_SALDO) > 0, 'S', 'N') as Bloqueado FROM ( SE1_GrpVen INNER JOIN SE1_Class ON (SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) ) LEFT JOIN dbo.SE1DtVenc ON SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc where SE1_GrpVen.GrpVen = ? and CAST(DtVenc as date) < CAST(GETDATE() as date) and (SE1_Class.E1Desc = 'Compra' or SE1_Class.E1Desc = 'Royalties')";

const queryDuplicatas =
  "SELECT * FROM ( SE1_GrpVen INNER JOIN SE1_Class ON (SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) ) LEFT JOIN dbo.SE1DtVenc ON SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc WHERE SE1_GrpVen.GrpVen = ?";

const queryComprasAno =
  "SELECT * FROM ( SELECT dbo.SE1_GrpVenT.GrpVen, dbo.SE1_GrpVenT.MesE, dbo.SE1_GrpVenT.E1_VALOR FROM dbo.SE1_GrpVenT INNER JOIN SE1_Class ON (dbo.SE1_GrpVenT.E1_TIPO = SE1_Class.E1_TIPO) AND ( dbo.SE1_GrpVenT.E1_PREFIXO = SE1_Class.E1_PREFIXO ) WHERE ( ((dbo.SE1_GrpVenT.GrpVen) = ?) AND (SE1_Class.E1Desc = 'Compra' ) AND ((dbo.SE1_GrpVenT.AnoE) = Year(GETDATE())) ) ) t PIVOT ( Sum(t.E1_VALOR) FOR t.MesE IN( [1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12] ) ) p";

const queryPedidosNaoAtendidos =
  "SELECT 'Processando' AS Status, dbo.PedidosCompraCab.DataCriacao AS Solicitacao, dbo.PedidosCompraCab.PedidoId as Pedido, '' as NF, '' as Serie, Sum(dbo.PedidosVenda.PrecoTotal) AS Total, Count(dbo.PedidosVenda.Item) AS QtItems FROM dbo.PedidosVenda  INNER JOIN dbo.PedidosCompraCab ON (dbo.PedidosVenda.Filial = dbo.PedidosCompraCab.Filial) AND (dbo.PedidosVenda.PedidoID = dbo.PedidosCompraCab.PedidoId)  WHERE (((dbo.PedidosCompraCab.NroNF) Is Null) AND ((dbo.PedidosCompraCab.GrpVen)=?) AND ((dbo.PedidosVenda.STATUS)<>'C' Or (dbo.PedidosVenda.STATUS) Is Null and dbo.PedidosCompraCab.STATUS <> 'C' or dbo.PedidosCompraCab.STATUS is null))  GROUP BY dbo.PedidosCompraCab.STATUS, dbo.PedidosCompraCab.DataCriacao, dbo.PedidosCompraCab.PedidoId, dbo.PedidosVenda.CodigoTotvs  ORDER BY dbo.PedidosCompraCab.DataCriacao DESC";

const queryPedidosAtendidos =
  "SELECT 'Faturado' as Status, S.DtEmissao as Faturado, S.Pedido as Pedido, S.DOC as NF, S.F_SERIE as Serie, SUM(S.D_TOTAL) as Total, COUNT(S.D_ITEM) as QtItems FROM dbo.SDBase as S WHERE S.GRPVEN = ? AND S.M0_TIPO='E' AND S.Pedido<>'0' GROUP BY S.D_FILIAL, S.Pedido, S.F_SERIE, S.DOC, S.DtEmissao ORDER BY S.Pedido DESC , S.DtEmissao DESC;";

const queryPedidosAtendidosDetPorPedidoID =
  "SELECT GRPVEN, D_EMISSAO, F_SERIE, DOC, Pedido, D_ITEM, ProdId, Produto, D_UM, D_QUANT, D_PRCVEN, D_TOTAL, DtEmissao AS Emissao, DEPDEST FROM dbo.SDBase WHERE (((GRPVEN)=?) AND ((D_FILIAL)<>?) AND ((M0_TIPO)='E')) AND ((Pedido) = ?) AND F_SERIE = '1' ORDER BY D_EMISSAO DESC";

const queryPedidosAtendidosDetPorDocNum =
  "SELECT GRPVEN, D_EMISSAO, F_SERIE, DOC, Pedido, D_ITEM, ProdId, Produto, D_UM, D_QUANT, D_PRCVEN, D_TOTAL, DtEmissao AS Emissao, DEPDEST FROM dbo.SDBase WHERE (((GRPVEN)=?) AND ((D_FILIAL)<>?) AND ((M0_TIPO)='E')) AND ((DOC) = ?) AND F_SERIE = '1' ORDER BY D_EMISSAO DESC";

const queryLimiteDisponivel =
  "SELECT IIf( [Compras] > 0, [LimiteCredito] + IIF( IIF( dbo.FilialEntidadeGrVenda.DtExtraCredito is null, DATEADD(HOUR, -24, GETDATE()), DATEDIFF( hour, dbo.FilialEntidadeGrVenda.DtExtraCredito, GETDATE() ) ) > 24, 0, dbo.FilialEntidadeGrVenda.LimExtraCredito ) - [Compras], [LimiteCredito] + IIF( IIF( dbo.FilialEntidadeGrVenda.DtExtraCredito is null, DATEADD(HOUR, -24, GETDATE()), DATEDIFF( hour, dbo.FilialEntidadeGrVenda.DtExtraCredito, GETDATE() ) ) > 24, 0, IIF( dbo.FilialEntidadeGrVenda.LimExtraCredito is null, 0, dbo.FilialEntidadeGrVenda.LimExtraCredito ) ) ) AS LimiteAtual FROM dbo.FilialEntidadeGrVenda LEFT JOIN ( SELECT SE1_GrpVen.GrpVen, Sum(SE1_GrpVen.E1_SALDO) AS Compras FROM ( SE1_GrpVen INNER JOIN SE1_Class ON (SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) AND (SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) ) LEFT JOIN dbo.SE1DtVenc ON SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc WHERE (((SE1_Class.E1Desc = 'Compra' ))) GROUP BY SE1_GrpVen.GrpVen ) as SE1_ComprasNVencidas ON dbo.FilialEntidadeGrVenda.A1_GRPVEN = SE1_ComprasNVencidas.GrpVen WHERE ( ((dbo.FilialEntidadeGrVenda.Inatv) Is Null) and dbo.FilialEntidadeGrVenda.A1_GRPVEN = ? )";

const queryPedidosAFaturar = "SELECT IIF(Sum(dbo.PedidosVenda.PrecoTotal) is null, 0, Sum(dbo.PedidosVenda.PrecoTotal)) AS Total FROM dbo.PedidosVenda INNER JOIN dbo.PedidosCompraCab ON (     dbo.PedidosVenda.Filial = dbo.PedidosCompraCab.Filial ) AND (     dbo.PedidosVenda.PedidoID = dbo.PedidosCompraCab.PedidoId ) WHERE (     ((dbo.PedidosCompraCab.NroNF) Is Null)     AND ((dbo.PedidosCompraCab.GrpVen) = ?)     AND (    (dbo.PedidosVenda.STATUS) <> 'C'    Or (dbo.PedidosVenda.STATUS) Is Null and dbo.PedidosCompraCab.STATUS <> 'C' or dbo.PedidosCompraCab.STATUS is null     ) )"