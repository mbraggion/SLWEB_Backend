"use strict";

const Database = use("Database");
const Helpers = use("Helpers");
const Mail = use("Mail");
const Env = use("Env");
const Drive = use("Drive");
const PdfPrinter = require("pdfmake");
const fs = require("fs");
const toArray = require('stream-to-array')
const { seeToken } = require("../../../Services/jwtServices");
const { PDFGen } = require("../../../../resources/pdfModels/solicitacaoOS_pdfModel");
const moment = require("moment");
const logger = require("../../../../dump/index")
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
class EquipRequestController {
  // retorna os possiveis endereços de entrega para as maquinas e os produtos disponiveis
  async See({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      //busca os endereços dos clientes para entrega
      const endereços = await Database.select(
        "Nome_Fantasia",
        "CNPJss",
        "Logradouro",
        "Número",
        "Complemento",
        "Bairro",
        "CEP",
        "Município",
        "UF"
      )
        .from("dbo.Cliente")
        .where({
          GrpVen: verified.grpven,
          ClienteStatus: 'A'
        })
        .orderBy("Nome_Fantasia");

      //prazo minimo para recebimento das máquinas
      const MinDDL = await Database.select("ParamVlr")
        .from("dbo.Parametros")
        .where({
          ParamId: "SolMaqDDL",
        });

      //textos de ajuda
      const Ajudas = await Database.raw(
        "select * from dbo.Parametros where ParamId like 'ajuda%' order by ParamVlr ASC"
      );

      const newAjudas = [];

      //formato as ajudas pra serem mais "maleaveis" pelo front-end
      Ajudas.map((ajuda) => {
        newAjudas.push({
          name: ajuda.ParamId.replace("ajuda", ""),
          text: ajuda.ParamTxt,
          section: ajuda.ParamVlr,
        });
      });

      //busca tipos de máquina disponiveis para requisição
      const MaquinasDisponiveis = await Database.select("*")
        .from("dbo.OSConfigMaq")
        .where({
          Disponivel: 1,
        });

      //busca bebidas que o cliente pode incluir inicialmente na máquina
      const Bebidas = await Database.select("*")
        .from("dbo.OSBebidas")
        .where({
          Disp: 1,
        })
        .orderBy(
          "Bebida",
          "Qtd",
          "Cod",
          "Un",
          "Medida",
          "Disp",
          "Dominio",
          "Mistura",
          "Pronto"
        );

      //array auxiliar...
      const BebidasNovo = [];
      let templateBebida = null;

      //junta as bebidas iguais no mesmo objeto
      Bebidas.map((bebida) => {
        templateBebida = {
          Cod: bebida.Cod,
          Bebida: bebida.Bebida,
          Un: bebida.Un,
          Qtd: [bebida.Qtd],
          Medida: [bebida.Medida],
          Mistura: bebida.Mistura,
          Pronto: bebida.Pronto,
          ContPronto: bebida.ContPronto,
          ContMist: bebida.ContMist,
          PrecoMaq: 0,
          Selecao: 0,
          configura: false,
          TProd: null,
        };
        if (BebidasNovo.length === 0) {
          BebidasNovo.push(Object.assign(templateBebida));
        } else {
          BebidasNovo.map((aux, i) => {
            if (aux.Bebida === bebida.Bebida) {
              aux.Qtd.push(bebida.Qtd);
              aux.Medida.push(bebida.Medida);
            } else if (i === BebidasNovo.length - 1) {
              BebidasNovo.push(Object.assign(templateBebida));
            }
          });
        }
      });

      //organiza medidas em order crescente
      for (let i = 0; i < BebidasNovo.length; i++) {
        for (let j = 0; j < BebidasNovo[i].Qtd.length; j++) {
          if (BebidasNovo[i].Qtd[j] > BebidasNovo[i].Qtd[j + 1]) {
            BebidasNovo[i].Medida.push(BebidasNovo[i].Medida[j]);
            BebidasNovo[i].Medida.splice(j, 1);
            BebidasNovo[i].Qtd.push(BebidasNovo[i].Qtd[j]);
            BebidasNovo[i].Qtd.splice(j, 1);
          }
        }
      }

      response.status(200).send({
        endereços,
        MaquinasDisponiveis,
        BebidasNovo,
        MinDDL: MinDDL[0].ParamVlr,
        newAjudas,
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.See',
      })
    }
  }

  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      let requisicao = await Database.select("*")
        .from("dbo.OSCtrl")
        .where({ GrpVen: verified.grpven })
        .orderBy("OSCId", "DESC");

      requisicao = requisicao.map(req => {
        return {
          OSCId: req.OSCId,
          OSTId: req.OSTId,
          GrpVen: req.GrpVen,
          OSCStatus: req.OSCStatus,
          Stage: showStatus(req),
          Responsavel: getActualActor(req),

          Datas: {
            OSCDtSolicita: req.OSCDtSolicita,
            OSCDtPretendida: req.OSCDtPretendida,
            OSCDtFechamento: req.OSCDtFechamento,
          },
          Assinaturas: {
            OSCComDtVisualizada: req.OSCComDtVisualizada,
            OSCComDtValidação: req.OSCComDtValidação,
            OSCComAceite: req.OSCComAceite,
            OSCComMotivo: req.OSCComMotivo,

            OSCTecDtVisualizada: req.OSCTecDtVisualizada,
            OSCTecDtValidação: req.OSCTecDtValidação,
            OSCTecAceite: req.OSCTecAceite,
            OSCTecMotivo: req.OSCTecMotivo,
            OSCTecDtPrevisao: req.OSCTecDtPrevisao,

            OSCExpDtVisualizada: req.OSCExpDtVisualizada,
            OSCExpDtPrevisao: req.OSCExpDtPrevisao,
          },
          InfoEq: {
            EquipCod: req.EquipCod,
            SLRaspyNum: req.SLRaspyNum,
            TelemetriaNum: req.TelemetriaNum,
          },
          Entrega: {
            OSCnpjDest: req.OSCnpjDest,
            OSCDestino: req.OSCDestino,
            OSCEmail: req.OSCEmail,
            OSCTelCont: req.OSCTelCont,
            OSCcontato: req.OSCcontato,
          },
          OSCPDF: req.OSCPDF,
        }
      })

      response.status(200).send(requisicao);
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.Show',
      })
    }
  }

  async SearchDefaultConfig({ request, response, params }) {
    const token = request.header("authorization");
    const MaqId = params.id;

    try {
      const configPadrao = await Database.raw(
        "select B.Cod, C.MaqConfigId, M.MaqModelo, C.MaqConfigNome , C.Selecao, B.Un,B.Bebida, B.Qtd as Qtd_Def, B.Medida as Medida_Def, IIF(C.Pront1Mist2 = 1, 'Pronto', 'Mistura') as TProd, IIF(C.Pront1Mist2 = 1, B.ContPronto, B.ContMist) as Contenedor from dbo.OSMaqConfPadrao as C left join dbo.OSBebidas as B on C.CodBebida = B.Cod left join dbo.OSConfigMaq as M on M.MaqModId = C.MaqModId where M.MaqModId = ?",
        [MaqId]
      );

      let configPadraoNovo = [];

      //formato/separo as configurações
      configPadrao.map((bebida) => {
        if (typeof configPadraoNovo[bebida.MaqConfigId] == "undefined") {
          configPadraoNovo[bebida.MaqConfigId] = [];
          configPadraoNovo[bebida.MaqConfigId].push(bebida);
        } else {
          configPadraoNovo[bebida.MaqConfigId].push(bebida);
        }
        return;
      });

      //removo qualquer indice do array que seja null
      let filtered = configPadraoNovo.filter(function (el) {
        return el != null;
      });

      response.status(200).send(filtered);
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.SearchDefaultConfig',
      })
    }
  }

  async All({ request, response }) {
    const token = request.header("authorization");

    try {
      let requisicoes = await Database.raw("select F.M0_CODFIL , O.* from dbo.OSCtrl as O inner join dbo.FilialEntidadeGrVenda as F on O.GrpVen = F.A1_GRPVEN order by OSCId DESC", [])

      requisicoes = requisicoes.map(req => {
        return {
          OSCId: req.OSCId,
          OSTId: req.OSTId,
          M0_CODFIL: req.M0_CODFIL,
          GrpVen: req.GrpVen,
          OSCStatus: req.OSCStatus,
          Stage: showStatus(req),
          Responsavel: getActualActor(req),

          Datas: {
            OSCDtSolicita: req.OSCDtSolicita,
            OSCDtPretendida: req.OSCDtPretendida,
            OSCDtFechamento: req.OSCDtFechamento,
          },
          Assinaturas: {
            OSCComDtVisualizada: req.OSCComDtVisualizada,
            OSCComDtValidação: req.OSCComDtValidação,
            OSCComAceite: req.OSCComAceite,
            OSCComMotivo: req.OSCComMotivo,

            OSCTecDtVisualizada: req.OSCTecDtVisualizada,
            OSCTecDtValidação: req.OSCTecDtValidação,
            OSCTecAceite: req.OSCTecAceite,
            OSCTecMotivo: req.OSCTecMotivo,
            OSCTecDtPrevisao: req.OSCTecDtPrevisao,

            OSCExpDtVisualizada: req.OSCExpDtVisualizada,
            OSCExpDtPrevisao: req.OSCExpDtPrevisao,
          },
          InfoEq: {
            EquipCod: req.EquipCod,
            SLRaspyNum: req.SLRaspyNum,
            TelemetriaNum: req.TelemetriaNum,
          },
          Entrega: {
            OSCnpjDest: req.OSCnpjDest,
            OSCDestino: req.OSCDestino,
            OSCEmail: req.OSCEmail,
            OSCTelCont: req.OSCTelCont,
            OSCcontato: req.OSCcontato,
          },
          OSCPDF: req.OSCPDF,
        }
      })

      response.status(200).send(requisicoes);
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.All',
      })
    }
  }

  async Store({ request, response }) {
    const token = request.header("authorization");
    const { Solicitacao } = request.only(["Solicitacao"]);
    const path = Helpers.publicPath(`/OS`);

    const verified = seeToken(token);

    try {
      //buscando ultima id de OS
      const OSCID = await Database.select("OSCId")
        .from("dbo.OSCtrl")
        .orderBy("OSCId", "DESC");

      let ID = 0;

      if (OSCID.length > 0) {
        ID = parseFloat(OSCID[0].OSCId) + 1;
      } else {
        ID = 1;
      }

      //crio variavel com o endereço completo do PDF
      const PathWithName = `${path}/ORDEM-${verified.grpven
        }-${`000000${ID}`.slice(-6)}.pdf`;

      const Dados = await Database.select("GrupoVenda", "M0_CGC", 'Email')
        .from("dbo.FilialEntidadeGrVenda")
        .where({ A1_GRPVEN: verified.grpven });

      // Salva as informações cabeçalho da OS
      await Database.insert({
        OSTId: Solicitacao.Maquina === "" ? 2 : 1,
        OSCStatus: "Ativo",
        GrpVen: verified.grpven,
        OSCDtSolicita: moment().subtract(3, "hours").toDate(),
        OSCDtPretendida: Solicitacao.Data_Entrega_Desejada,
        OSCDtFechamento: null,
        OSCTecDtVisualizada: null,
        OSCTecDtValidação: null,
        OSCTecAceite: null,
        OSCTecMotivo: null,
        OSCTecDtPrevisao: null,
        OSCComDtVisualizada: null,
        OSCComDtValidação: null,
        OSCComAceite: null,
        OSCComMotivo: null,
        OSCExpDtVisualizada: null,
        OSCExpDtPrevisao: null,
        OSCnpjDest: Solicitacao.CNPJ_Destino,
        OSCDestino: Solicitacao.Endereço_Entrega,
        OSCPDF: `ORDEM-${verified.grpven}-${`000000${ID}`.slice(-6)}.pdf`,
        OSCEmail: Dados[0].Email,
        OSCTelCont: Solicitacao.Telefone_Contato,
        OSCcontato: Solicitacao.Contato,
      }).into("dbo.OSCtrl");

      //Salva as configurações de bebida da máquina
      await Solicitacao.Configuracao.map(async (bebida) => {
        await Database.insert({
          OSCId: ID,
          Selecao: bebida.selecao,
          BebidaId: bebida.id,
          UnMedida: bebida.medida,
          GrpVen: verified.grpven,
          PrecoMaq: bebida.valor,
          PrecoRep: bebida.valor2,
          TProduto: bebida.tipo,
          Ativa: bebida.configura,
        }).into("dbo.OSCtrlDet");
      });

      //salva as especificações da máquina
      await Database.insert({
        OSCId: ID,
        GrpVen: verified.grpven,
        MaqId: Solicitacao.MaquinaId,
        THidrico: Solicitacao.Abastecimento,
        InibCopos: Solicitacao.InibirCopos,
        Gabinete:
          typeof Solicitacao.Gabinete == "undefined" ||
            Solicitacao.Gabinete === ""
            ? false
            : Solicitacao.Gabinete,
        SisPag: Solicitacao.Pagamento,
        TComunic: Solicitacao.Chip,
        Antena: Solicitacao.AntExt,
        ValidadorCond: Solicitacao.TipoValidador,
        ValidadorVal: Solicitacao.Validador.toString(),
        MaqCorp: Solicitacao.Corporativa,
        OSObs: Solicitacao.Observacao,
      }).into("dbo.OSCtrlSpec");

      const PDFModel = PDFGen(Solicitacao, ID, Dados, verified);

      var pdfDoc = printer.createPdfKitDocument(PDFModel);
      pdfDoc.pipe(fs.createWriteStream(PathWithName));
      pdfDoc.end();

      //enviar email de nova solicitação
      Mail.send(
        "emails.OSnew",
        { verified, ID, Frontend: Env.get("CLIENT_URL") },
        (message) => {
          message
            .to(Dados[0].Email)
            .cc([
              Env.get("EMAIL_SUPORTE"),
              Env.get("EMAIL_COMERCIAL_1"),
              Env.get("EMAIL_COMERCIAL_2"),
            ])
            .from(Env.get("MAIL_USERNAME"), "SLWEB")
            .subject("Nova ordem de serviço")
            .attach(PathWithName);
        }
      );

      const file = await Drive.get(`${PathWithName}`);
      Drive.put(
        `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\OS\\ORDEM-${verified.grpven
        }-${`000000${ID}`.slice(-6)}.pdf`,
        file
      );

      response.status(201).send("ok");
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.Store',
      })
    }

  }

  async RetriveOS({ request, response, params }) {
    const token = request.header("authorization");
    const OSID = params.osid
    const path = Helpers.publicPath(`/OS`);

    let PathWithName = ''

    let cab
    let contenedores
    let det
    let Dados

    try {
      const verified = seeToken(token);

      cab = await Database.raw(CabeçalhoDaOS, [OSID])
      contenedores = await Database.raw(ContenedoresDaOS, [OSID])
      det = await Database.raw(DetalhesDaOS, [OSID])
      Dados = await Database.select("GrupoVenda", "M0_CGC", 'Email', 'M0_CODFIL')
        .from("dbo.FilialEntidadeGrVenda")
        .where({ A1_GRPVEN: cab[0].GrpVen });
      PathWithName = `${path}/${cab[0].OSCPDF}`

      const Solicitacao = {
        ...cab[0],
        Contenedor: ContenedoresDB2PDF(contenedores),
        Validador: String(cab[0].Validador).split(','),
        Configuracao: [...det],
      }

      const ModVerified = {
        ...verified,
        user_name: Dados[0].GrupoVenda,
        user_code: Dados[0].M0_CODFIL
      }

      const PDFModel = PDFGen(Solicitacao, OSID, Dados, ModVerified, cab[0].DataSolicitada);

      var pdfDoc = printer.createPdfKitDocument(PDFModel);
      pdfDoc.pipe(fs.createWriteStream(PathWithName));
      pdfDoc.end();

      const enviarDaMemóriaSemEsperarSalvarNoFS = await toArray(pdfDoc).then(parts => {
        return Buffer.concat(parts);
      })

      response.status(201).send(enviarDaMemóriaSemEsperarSalvarNoFS);
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.RetriveOS',
      })
    }
  }

  async ViewCheck({ request, response }) {
    const token = request.header("authorization");
    const { ID } = request.only(["ID"]);

    try {
      const verified = seeToken(token);

      switch (verified.role) {
        case "BackOffice":
          await Database.raw(
            "IF (select OSCComDtVisualizada from dbo.OSCtrl where OSCId = ?) IS NULL UPDATE dbo.OSCtrl SET OSCComDtVisualizada = CONVERT(datetime, ?, 121) where OSCId = ?",
            [ID, moment().subtract(3, "hours").toDate(), ID]
          );

          break;

        case "Técnica Pilão" || "Técnica Bianchi":
          await Database.raw(
            "IF (select OSCTecDtVisualizada from dbo.OSCtrl where OSCId = ?) IS NULL UPDATE dbo.OSCtrl SET OSCTecDtVisualizada = CONVERT(datetime, ?, 121) where OSCId = ?",
            [ID, moment().subtract(3, "hours").toDate(), ID]
          );
          break;

        case "Expedição":
          await Database.raw(
            "IF (select OSCExpDtVisualizada from dbo.OSCtrl where OSCId = ?) IS NULL UPDATE dbo.OSCtrl SET OSCExpDtVisualizada = CONVERT(datetime, ?, 121) where OSCId = ?",
            [ID, moment().subtract(3, "hours").toDate(), ID]
          );
          break;

        default:
          break;
      }
      response.status(200).send();
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.ViewCheck',
      })
    }
  }

  async ValidateOS({ request, response }) {
    const token = request.header("authorization");
    const { OSID, action, reject, prev } = request.only([
      "OSID",
      "action",
      "reject",
      "prev",
    ]);
    let dados = [];

    try {
      const verified = seeToken(token);

      switch (verified.role) {
        case "BackOffice":
          await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCComDtValidação: moment().subtract(3, "hours").toDate(),
              OSCComAceite: action === "accept" ? true : false,
              OSCComMotivo: action === "accept" ? '' : reject,
            });

          dados = await Database.select("*")
            .from("dbo.OSCtrl")
            .where({ OSCId: OSID });

          if (action === "accept") {
            Mail.send(
              "emails.OSComValida",
              {
                ID: OSID,
                Dt: moment(dados[0].OSCDtPretendida).format("LL"),
                Frontend: Env.get("CLIENT_URL"),
              },
              (message) => {
                message
                  .to(Env.get("EMAIL_SUPORTE"))
                  .cc([
                    Env.get("EMAIL_TECNICA_1"),
                    Env.get("EMAIL_TECNICA_2"),
                    Env.get("EMAIL_TECNICA_3"),
                    Env.get("EMAIL_2BTECH_ATENDIMENTO"),
                  ])
                  .from(Env.get("MAIL_USERNAME"), "SLWEB")
                  .subject("OS Validada pela Pilão")
                  .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                    filename: dados[0].OSCPDF,
                  });
              }
            );
          } else if (action === "reject") {
            Mail.send(
              "emails.OSRejeicao",
              {
                ID: OSID,
                Dep: "Comercial",
                Motivo: reject,
              },
              (message) => {
                message
                  .to(Env.get("EMAIL_SUPORTE"))
                  .from(Env.get("MAIL_USERNAME"), "SLWEB")
                  .subject("OS Rejeitada")
                  .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                    filename: dados[0].OSCPDF,
                  });
              }
            );
          }

          response.status(200).send();
          break;
        case "Técnica Pilão":
          await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCTecDtValidação: moment().subtract(3, "hours").toDate(),
              OSCTecAceite: action === "accept" ? true : false,
              OSCTecMotivo: action === "accept" ? '' : reject,
              OSCTecDtPrevisao:
                prev !== null
                  ? moment(prev).subtract(3, "hours").toDate()
                  : null,
            });

          dados = await Database.select("*")
            .from("dbo.OSCtrl")
            .where({ OSCId: OSID });
          if (action === "accept") {
            Mail.send(
              "emails.OSTecValida",
              {
                ID: OSID,
                DtC: moment(dados[0].OSCDtPretendida).format("LL"),
                DtT: moment(prev).format("LL"),
                Frontend: Env.get("CLIENT_URL"),
              },
              (message) => {
                message
                  .to(Env.get("EMAIL_SUPORTE"))
                  .cc([
                    Env.get("EMAIL_EXPEDICAO_1"),
                    Env.get("EMAIL_EXPEDICAO_2"),
                  ])
                  .from(Env.get("MAIL_USERNAME"), "SLWEB")
                  .subject("OS Validada pela Técnica")
                  .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                    filename: dados[0].OSCPDF,
                  });
              }
            );
          } else if (action === "reject") {
            Mail.send(
              "emails.OSRejeicao",
              {
                ID: OSID,
                Dep: "Técnica",
                Motivo: reject,
              },
              (message) => {
                message
                  .to(Env.get("EMAIL_SUPORTE"))
                  .from(Env.get("MAIL_USERNAME"), "SLWEB")
                  .subject("OS Rejeitada")
                  .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                    filename: dados[0].OSCPDF,
                  });
              }
            );
          }

          response.status(200).send();
          break;
        case "Técnica Bianchi":
          await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCTecDtValidação: moment().subtract(3, "hours").toDate(),
              OSCTecAceite: action === "accept" ? true : false,
              OSCTecMotivo: action === "accept" ? '' : reject,
              OSCTecDtPrevisao:
                prev !== null
                  ? moment(prev).subtract(3, "hours").toDate()
                  : null,
            });

          dados = await Database.select("*")
            .from("dbo.OSCtrl")
            .where({ OSCId: OSID });
          if (action === "accept") {
            Mail.send(
              "emails.OSTecValida",
              {
                ID: OSID,
                DtC: moment(dados[0].OSCDtPretendida).format("LL"),
                DtT: moment(prev).format("LL"),
                Frontend: Env.get("CLIENT_URL"),
              },
              (message) => {
                message
                  .to(Env.get("EMAIL_SUPORTE"))
                  .cc([
                    Env.get("EMAIL_EXPEDICAO_1"),
                    Env.get("EMAIL_EXPEDICAO_2"),
                  ])
                  .from(Env.get("MAIL_USERNAME"), "SLWEB")
                  .subject("OS Validada pela Técnica")
                  .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                    filename: dados[0].OSCPDF,
                  });
              }
            );
          } else if (action === "reject") {
            Mail.send(
              "emails.OSRejeicao",
              {
                ID: OSID,
                Dep: "Técnica",
                Motivo: reject,
              },
              (message) => {
                message
                  .to(Env.get("EMAIL_SUPORTE"))
                  .from(Env.get("MAIL_USERNAME"), "SLWEB")
                  .subject("OS Rejeitada")
                  .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                    filename: dados[0].OSCPDF,
                  });
              }
            );
          }

          response.status(200).send();
          break;
        case "Expedição":
          await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCExpDtPrevisao:
                prev !== null
                  ? moment(prev).subtract(3, "hours").toDate()
                  : null,
            });

          dados = await Database.select("*")
            .from("dbo.OSCtrl")
            .where({ OSCId: OSID });

          Mail.send(
            "emails.OSExpValida",
            {
              ID: OSID,
              Dt: moment(prev).format("LL"),
              Tel: dados[0].OSCTelCont,
              Frontend: Env.get("CLIENT_URL"),
            },
            (message) => {
              message
                .to(dados[0].OSCEmail)
                .cc([
                  Env.get("EMAIL_SUPORTE"),
                  Env.get("EMAIL_COMERCIAL_1"),
                  Env.get("EMAIL_COMERCIAL_2"),
                ])
                .from(Env.get("MAIL_USERNAME"), "SLWEB")
                .subject("Previsão de entrega da OS")
                .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                  filename: dados[0].OSCPDF,
                });
            }
          );
          response.status(200).send();
          break;
        case "Franquia":
          await Database.table("dbo.OSCtrl")
            .where({
              GrpVen: verified.grpven,
              OSCId: OSID,
              OSCStatus: "Ativo",
            })
            .update({
              OSCStatus: action === "accept" ? "Concluido" : "Cancelado",
              OSCDtFechamento: moment().subtract(3, "hours").toDate(),
            });

          if (action === "accept") {
            const eqInfoTec = await Database
              .select('EquipCod', 'GrpVen')
              .from('dbo.OSCtrl')
              .where({
                OSCId: OSID
              })

            // verifica se o EquiCod foi informado pela técnica
            if (eqInfoTec[0] && eqInfoTec[0].EquipCod !== null && String(eqInfoTec[0].EquipCod).trim() !== '') {

              const jaExisteEq = await Database
                .select('*')
                .from('dbo.Equipamento')
                .where({
                  EquiCod: eqInfoTec[0].EquipCod
                })

              // verifica se o EquiCod está em Equipamento
              if (jaExisteEq.length > 0) {
                // atualiza o registro em Equipamento

                await Database
                  .table("dbo.Equipamento")
                  .where({
                    EquiCod: eqInfoTec[0].EquipCod,
                  })
                  .update({
                    GrpVen: eqInfoTec[0].GrpVen,
                  });

                // Inativa PDV's anteriores em PontoVenda
                await Database
                  .table("dbo.PontoVenda")
                  .where({
                    EquiCod: eqInfoTec[0].EquipCod,
                  })
                  .update({
                    PdvStatus: 'I',
                  });
              } else {
                // inclui o EquiCod em Equipamento

                await Database.insert({
                  GrpVen: eqInfoTec[0].GrpVen,
                  EquiCod: eqInfoTec[0].EquipCod,
                  EquiDesc: 'LEI SA',
                  EquiMatr: eqInfoTec[0].EquipCod,
                  EquiCodn: Number(eqInfoTec[0].EquipCod),
                  EquiStatus: 'A',
                  EquiPatrimonio: eqInfoTec[0].EquipCod,
                  IMEI: null,
                  EquiTipo: 'BQ'
                }).into("dbo.Equipamento");
              }
            }

          }


          dados = await Database.select("*")
            .from("dbo.OSCtrl")
            .where({ OSCId: OSID });

          if (action === "reject") {
            Mail.send("emails.OScancel", { verified, ID: OSID }, (message) => {
              message
                .to(Env.get("EMAIL_SUPORTE"))
                .cc([
                  Env.get("EMAIL_COMERCIAL_1"),
                  Env.get("EMAIL_COMERCIAL_2"),
                ])
                .from(Env.get("MAIL_USERNAME"), "SLWEB")
                .subject("Cancelamento de OS")
                .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
                  filename: dados[0].OSCPDF,
                });
            });
          }
          response.status(200).send();
          break;
      }
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.ValidateOS',
      })
    }
  }

  async TecInfEqData({ request, response }) {
    const token = request.header("authorization");
    const { EqCod, RaspyCod, TelemetriaCod, OSID } = request.only(["EqCod", "TelemetriaCod", "RaspyCod", "OSID"]);

    try {
      await Database.table("dbo.OSCtrl")
        .where({
          OSCId: OSID,
        })
        .update({
          EquipCod: EqCod ? String(EqCod).substring(0, 8) : null,
          SLRaspyNum: RaspyCod ? String(RaspyCod).substring(0, 50) : null,
          TelemetriaNum: TelemetriaCod ? String(TelemetriaCod).substring(0, 50) : null,
        });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.TecInfEqData',
      })
    }

  }

  async SistemOptions({ request, response }) {
    const token = request.header("authorization");
    const { action, OSID } = request.only(["action", "OSID"]);
    let S;

    try {

      switch (action) {
        case "Cancelar": //cancelar OS
          S = await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCStatus: "Cancelado",
              OSCDtFechamento: moment().subtract(3, "hours").toDate(),
            });

          if (S < 1) {
            response.status(400).send('Não atualizado')
            return
          }

          response.status(200).send();
          break;
        case "Concluir": //concluir OS
          S = await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCStatus: "Concluido",
              OSCDtFechamento: moment().subtract(3, "hours").toDate(),
            });

          const eqInfoTec = await Database
            .select('EquipCod', 'GrpVen')
            .from('dbo.OSCtrl')
            .where({
              OSCId: OSID
            })

          // verifica se o EquiCod foi informado pela técnica
          if (eqInfoTec[0] && eqInfoTec[0].EquipCod !== null && String(eqInfoTec[0].EquipCod).trim() !== '') {

            const jaExisteEq = await Database
              .select('*')
              .from('dbo.Equipamento')
              .where({
                EquiCod: eqInfoTec[0].EquipCod
              })

            // verifica se o EquiCod está em Equipamento
            if (jaExisteEq.length > 0) {
              // atualiza o registro em Equipamento

              await Database
                .table("dbo.Equipamento")
                .where({
                  EquiCod: eqInfoTec[0].EquipCod,
                })
                .update({
                  GrpVen: eqInfoTec[0].GrpVen,
                });

              // Inativa PDV's anteriores em PontoVenda
              await Database
                .table("dbo.PontoVenda")
                .where({
                  EquiCod: eqInfoTec[0].EquipCod,
                })
                .update({
                  PdvStatus: 'I',
                });
            } else {
              // inclui o EquiCod em Equipamento

              await Database.insert({
                GrpVen: eqInfoTec[0].GrpVen,
                EquiCod: eqInfoTec[0].EquipCod,
                EquiDesc: 'LEI SA',
                EquiMatr: eqInfoTec[0].EquipCod,
                EquiCodn: Number(eqInfoTec[0].EquipCod),
                EquiStatus: 'A',
                EquiPatrimonio: eqInfoTec[0].EquipCod,
                IMEI: null,
                EquiTipo: 'BQ'
              }).into("dbo.Equipamento");
            }

          }

          if (S < 1) {
            response.status(400).send('Não atualizado')
            return
          }

          response.status(200).send();
          break;
        case "Ativar": //Ativar OS
          S = await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCStatus: "Ativo",
              OSCDtFechamento: null,
            });

          if (S < 1) {
            response.status(400).send('Não atualizado')
            return
          }

          response.status(200).send();
          break;
        case "RT": //retirar técnica
          const B = await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCTecDtValidação: null,
              OSCTecAceite: null,
              OSCTecMotivo: null,
              OSCTecDtPrevisao: null,
            });

          if (B < 1) {
            response.status(400).send('Não atualizado')
            return
          }

          response.status(200).send();
          break;
        case "RC": //retirar comercial
          const C = await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCComDtValidação: null,
              OSCComAceite: null,
              OSCComMotivo: null,
            });

          if (C < 1) {
            response.status(400).send('Não atualizado')
            return
          }

          response.status(200).send();
          break;
        case "RE": //retirar expedição
          const E = await Database.table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCExpDtPrevisao: null,
            });

          if (E < 1) {
            response.status(400).send('Não atualizado')
            return
          }

          response.status(200).send();
          break;
      }

    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.SistemOptions',
      })
    }
  }

  async GetInformation({ request, response, params }) {
    const token = request.header("authorization");
    const type = params.type

    try {
      let information = ''
      let aux

      switch (type) {
        case 'card':
          aux = await Database
            .select('ParamTxt')
            .from('dbo.Parametros')
            .where({
              GrpVen: '000000',
              ParamId: 'INSTRUCOESCARTAO',
            })


          information = aux[0].ParamTxt
          break
        case 'privatelabel':
          aux = await Database
            .select('ParamTxt')
            .from('dbo.Parametros')
            .where({
              GrpVen: '000000',
              ParamId: 'INSTRUCOESPRIVATELABEL',
            })

          information = aux[0].ParamTxt
          break
      }

      response.status(200).send({
        Instrucoes: information
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'EquipRequestController.GetInformation',
      })
    }
  }
}

module.exports = EquipRequestController;

const CabeçalhoDaOS = "select OC.GrpVen, OS.MaqId as MaquinaId, OSC.MaqModelo as Maquina, OC.OSCDtSolicita as DataSolicitada, OS.SisPag as Pagamento, OS.ValidadorVal as Validador, OS.ValidadorCond as TipoValidador, OS.InibCopos as InibirCopos, OS.MaqCorp as Corporativa, OS.Gabinete as Gabinete, OS.THidrico as Abastecimento, OS.TComunic as Chip, OS.Antena as AntExt, C.Nome_Fantasia as Cliente_Destino, OC.OSCnpjDest as CNPJ_Destino, OC.OSCDestino as Endereço_Entrega, OC.OSCDtPretendida as Data_Entrega_Desejada, OC.OSCcontato as Contato, OC.OSCEmail as Email_Acompanhamento, OC.OSCTelCont as Telefone_Contato, OS.OSObs as Observacao, OC.OSCPDF, OC.EquipCod, OC.SLRaspyNum, OC.TelemetriaNum from dbo.OSCtrl as OC inner join dbo.OSCtrlSpec as OS on OC.OSCId = OS.OSCId left join dbo.OSConfigMaq as OSC on OS.MaqId = OSC.MaqModId left join dbo.Cliente as C on C.CNPJss = OC.OSCnpjDest and C.GrpVen = OC.GrpVen where OC.OSCId = ?"

const ContenedoresDaOS = "select distinct IIF(OD.TProduto = 'Pronto', OB.ContPronto, OB.ContMist) as Contenedor from dbo.OSCtrlDet as OD inner join dbo.OSBebidas as OB on OD.BebidaId = OB.Cod where OD.OSCId = ?"

const DetalhesDaOS = "select OD.BebidaId as id, OD.Selecao as selecao, OB.Bebida as bebida, TRIM(OD.UnMedida) as medida, OD.TProduto as tipo, IIF(OD.TProduto = 'Pronto', OB.ContPronto, OB.ContMist) as contenedor, OD.Ativa as configura, OD.PrecoMaq as valor, OD.PrecoRep as valor2 from dbo.OSCtrlDet as OD left join dbo.OSBebidas as OB on OD.BebidaId = OB.Cod where OSCId = ? order by OD.Selecao ASC"

const ContenedoresDB2PDF = (contenedoresFromDB) => {
  let newContenedores = []

  contenedoresFromDB.forEach((contenedor) => {
    if (contenedor.Contenedor !== null) {
      newContenedores = [...newContenedores, ...JSON.parse(
        "[" +
        String(contenedor.Contenedor).replace(/0/g, ",") +
        "]"
      )]
    }
  })

  const newContenedoresSemRepeticao = newContenedores.filter((item, index) => {
    return (newContenedores.indexOf(item) == index)
  })

  return newContenedoresSemRepeticao
}

const getActualActor = (OS) => {
  if (OS === null) return [];

  if (OS.OSCComAceite === false || OS.OSCTecAceite === false) {
    return ["Sistema"];
  } else if (OS.OSCComAceite === null && OS.OSCStatus === "Ativo") {
    return ["BackOffice", "Sistema"];
  } else if (OS.OSCTecAceite === null && OS.OSCStatus === "Ativo") {
    return ["Técnica Pilão", "Sistema"];
  } else if (OS.OSCExpDtPrevisao === null && OS.OSCStatus === "Ativo") {
    return ["Expedição", "Sistema"];
  } else if (OS.OSCExpDtPrevisao !== null && OS.OSCStatus === "Ativo") {
    return ["Sistema"];
  } else if (OS.OSCStatus === "Cancelado") {
    return ["Sistema"];
  } else if (OS.OSCStatus === "Concluido") {
    return ["Sistema"];
  } else {
    return [];
  }
}

const showStatus = (OS) => {
  if (OS === null) return;

  if (OS.OSCComAceite === false || OS.OSCTecAceite === false) {
    return "Supervisão";
  } else if (OS.OSCComAceite === null && OS.OSCStatus === "Ativo") {
    return "Comercial";
  } else if (OS.OSCTecAceite === null && OS.OSCStatus === "Ativo") {
    return "Técnica";
  } else if (OS.OSCExpDtPrevisao === null && OS.OSCStatus === "Ativo") {
    return "Transporte";
  } else if (OS.OSCExpDtPrevisao !== null && OS.OSCStatus === "Ativo") {
    return "Entrega";
  } else if (OS.OSCStatus === "Cancelado") {
    return "Nenhuma";
  } else if (OS.OSCStatus === "Concluido") {
    return "Nenhuma";
  } else {
    return "Desconhecido";
  }
}
