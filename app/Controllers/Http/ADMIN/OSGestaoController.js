"use strict";

const Database = use("Database");
const Helpers = use("Helpers");
const Mail = use("Mail");
const Env = use("Env");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index")
moment.locale("pt-br");

const { getActualActor, showStatus } = require('../../../Services/OsHelper')

class OSGestaoController {
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
            OSCTecDtTermino: req.OSCTecDtTermino,

            OSCExpDtVisualizada: req.OSCExpDtVisualizada,
            OSCExpDtPrevisao: req.OSCExpDtPrevisao,
          },
          InfoEq: {
            EquipCod: req.EquipCod,
            SLRaspyNum: req.SLRaspyNum,
            TelemetriaNum: req.TelemetriaNum,
            EquipPatr: req.EquipPatr
          },
          Entrega: {
            OSCnpjDest: req.OSCnpjDest,
            OSCDestino: req.OSCDestino,
            OSCEmail: req.OSCEmail,
            OSCTelCont: req.OSCTelCont,
            OSCcontato: req.OSCcontato,
            NF: req.OSCExpNF
          },
          OSCPDF: req.OSCPDF,
        }
      })

      const stages = requisicoes.reduce((acc, act) => {
        switch (act.Stage) {
          case 'Supervisão':
            return { ...acc, Supervisao: acc.Supervisao + 1 }
          case 'Comercial':
            return { ...acc, Comercial: acc.Comercial + 1 }
          case 'Técnica (1)':
            return { ...acc, Tecnica: acc.Tecnica + 1 }
          case 'Técnica (2)':
            return { ...acc, Montagem: acc.Montagem + 1 }
          case 'Transporte':
            return { ...acc, Expedicao: acc.Expedicao + 1 }
          case 'Entrega':
            return { ...acc, Entregando: acc.Entregando + 1 }
          default:
            return acc
        }
      }, {
        Total: requisicoes.length,
        Ativas: requisicoes.filter(r => r.OSCStatus === 'Ativo').length,
        Concluidas: requisicoes.filter(r => r.OSCStatus === 'Concluido').length,
        Canceladas: requisicoes.filter(r => r.OSCStatus === 'Cancelado').length,

        Supervisao: 0,
        Comercial: 0,
        Tecnica: 0,
        Montagem: 0,
        Expedicao: 0,
        Entregando: 0,
      })

      // response.status(200).send(requisicoes);
      response.status(200).send({
        oss: requisicoes,
        status: stages
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'OSGestaoController.All',
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
        handler: 'OSGestaoController.ViewCheck',
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
          await Database
            .table("dbo.OSCtrl")
            .where({
              OSCId: OSID,
            })
            .update({
              OSCComDtValidação: moment().subtract(3, "hours").toDate(),
              OSCComAceite: action === "accept" ? true : false,
              OSCComMotivo: action === "accept" ? '' : reject,
            });

          dados = await Database
            .select("*")
            .from("dbo.OSCtrl")
            .where({ OSCId: OSID });


          if (action === "accept") {

            const pagamento = await Database
              .select('SisPag')
              .from('dbo.OSCtrlSpec')
              .where({
                OSCId: OSID
              })

            const abencoado = await Database
              .select('GrupoVenda')
              .from('dbo.FilialEntidadeGrVenda')
              .where({
                A1_GRPVEN: dados[0].GrpVen
              })

            const deveAcompanhar = String(pagamento[0].SisPag).includes('Cartão') || String(pagamento[0].SisPag).includes('Private Label')
              ? '2BPay & 2BTel'
              : '2BTel'

            Mail.send(
              "emails.OSComValida",
              {
                ID: OSID,
                Dt: moment(dados[0].OSCDtPretendida).format("LL"),
                Frontend: Env.get("CLIENT_URL"),
                sispag: pagamento[0].SisPag,
                acomp: deveAcompanhar,
                franqueado: abencoado[0].GrupoVenda
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
                  .subject(`OS Validada pela Pilão - ${String(abencoado[0].GrupoVenda).trim()}`)
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
        handler: 'OSGestaoController.ValidateOS',
      })
    }
  }

  async TecInfEqData({ request, response }) {
    const token = request.header("authorization");
    const { EqCod, NumPatrimonio, RaspyCod, TelemetriaCod, DtTerminal, OSID } = request.only(["EqCod", "NumPatrimonio", "TelemetriaCod", "DtTerminal", "RaspyCod", "OSID"]);

    try {
      await Database.table("dbo.OSCtrl")
        .where({
          OSCId: OSID,
        })
        .update({
          EquipCod: EqCod ? String(EqCod).substring(0, 8).trim() : null,
          EquipPatr: NumPatrimonio ? String(NumPatrimonio).substring(0, 20).trim() : null,
          SLRaspyNum: RaspyCod ? String(RaspyCod).substring(0, 50).trim() : null,
          TelemetriaNum: TelemetriaCod ? String(TelemetriaCod).substring(0, 50).trim() : null,
          OSCTecDtTermino: DtTerminal ? DtTerminal : null
        });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'OSGestaoController.TecInfEqData',
      })
    }

  }

  async ExpInfEntrega({ request, response }) {
    const token = request.header("authorization");
    const { OSID, Previsao, NumNF } = request.only(["OSID", "Previsao", "NumNF"]);

    try {
      await Database
        .table("dbo.OSCtrl")
        .where({
          OSCId: OSID,
        })
        .update({
          OSCExpDtPrevisao: moment(Previsao).hours(0).minutes(0).seconds(0).subtract(3, 'hours').toDate(),
          OSCExpNF: NumNF
        });

      const dados = await Database
        .select("OSCEmail", 'OSCPDF')
        .from("dbo.OSCtrl")
        .where({
          OSCId: OSID
        });

      Mail.send("emails.OSprevisao",
        {
          ID: OSID,
          Prev: moment(Previsao).format('dddd, DD [de] MMMM [de] YYYY'),
          NFe: NumNF
        },
        (message) => {
          message
            .to(dados[0].OSCEmail)
            .cc([
              Env.get("EMAIL_SUPORTE")
            ])
            .from(Env.get("MAIL_USERNAME"), "SLWEB")
            .subject("Previsão de entrega")
            .attach(Helpers.publicPath(`OS/${dados[0].OSCPDF}`), {
              filename: dados[0].OSCPDF,
            });
        })

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'OSGestaoController.ExpInfEntrega',
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
        handler: 'OSGestaoController.SistemOptions',
      })
    }
  }
}

module.exports = OSGestaoController;