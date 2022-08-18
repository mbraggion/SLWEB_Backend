'use strict'

const Database = use("Database");
const Mail = use("Mail");
const Env = use("Env");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index")
moment.locale("pt-br");

class MonitorController {
  /** @param {object} ctx
 * @param {import('@adonisjs/framework/src/Request')} ctx.request
 */
  async Telemetrias({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const telemetrias = await Database.raw(QueryTelemetrias, [verified.grpven])

      response.status(200).send(telemetrias)
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'MonitorController.Telemetrias',
      })
    }
  }

  async AbrirChamado({ request, response }) {
    const token = request.header("authorization");
    let { DTO } = request.only(['DTO']);

    try {
      const verified = seeToken(token);

      DTO = {
        ...DTO,
        Filial: verified.user_code,
        Frontend: Env.get("CLIENT_URL")
      }

      await Database.insert({
        GrpVen: verified.grpven,
        EquiCod: DTO.Ativo,
        DtSolicitada: moment().subtract(3, "hours").toDate(),
        ChamadoAberto: false,
        Origem: 'SLWEB',
        UltLeitura: DTO.UltLeitura,
        Email: DTO.Email,
        Telefone: DTO.Contato,
        Cliente: DTO.Cliente,
        Logradouro: DTO.Endereco.Logradouro,
        Numero: DTO.Endereco.Numero,
        Complemento: DTO.Endereco.Complemento,
        Bairro: DTO.Endereco.Bairro,
        Municipio: DTO.Endereco.Cidade,
        UF: DTO.Endereco.UF,
        CEP: DTO.Endereco.CEP,
        ChamadoFechado: false,
        DtChamadoFechado: null
      }).into('dbo.ChamadosSL2MiFix')

      await Mail.send(
        "emails.ChamadoMIFIX",
        DTO,
        (message) => {
          message
            .to('helpdesk@2btech.com.br')
            .cc([Env.get("EMAIL_ADMIN_1"), Env.get("EMAIL_SUPORTE")])
            .from(Env.get("MAIL_USERNAME"), "SLWEB")
            .subject("PROBLEMAS COM TELEMETRIA")
        }
      );

      await Database.table("dbo.ChamadosSL2MiFix")
        .where({
          GrpVen: verified.grpven,
          EquiCod: DTO.Ativo,
          DtAberturaChamado: null,
          ChamadoAberto: false,
          ChamadoFechado: false
        })
        .update({
          DtAberturaChamado: moment().subtract(3, "hours").toDate(),
          ChamadoAberto: true,
        });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'MonitorController.AbrirChamado',
      })
    }
  }

  async FecharChamado({ request, response }) {
    const token = request.header("authorization");
    const { ID } = request.only(['ID'])

    try {
      const verified = seeToken(token);

      await Database.table("dbo.ChamadosSL2MiFix")
        .where({
          Id: ID,
          GrpVen: verified.grpven,
        })
        .update({
          ChamadoFechado: true,
          DtChamadoFechado: new Date()
        });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'MonitorController.FecharChamado',
      })
    }
  }
}

module.exports = MonitorController

const QueryTelemetrias = "SELECT bog.GrpVen, bog.EquiCod, P.AnxDesc, bog.MáxDeDataLeitura, bog.[Ql-4], bog.[Ql-3], bog.[Ql-2], bog.[Ql-1], bog.Ql0, bog.[Con-4], bog.[Con-3], bog.[Con-2], bog.[Con-1], bog.Con0, bog.Prd3, bog.Prd2, bog.Prd1, bog.Prd, bog.LeitOk, F.GrupoVenda, F.Email, E.EquiDesc, P.PdvLogradouroPV, P.PdvNumeroPV, P.PdvBairroPV, P.PdvComplementoPV, P.PdvCidadePV, P.PdvUfPV, P.PdvCEP, MAX(C.DtAberturaChamado) as UltChamado, C.Id FROM dbo.bogf_Leituras_QtdGrpT as bog inner join dbo.FilialEntidadeGrVenda as F on F.A1_GRPVEN = bog.GrpVen inner join dbo.Equipamento as E on E.EquiCod = bog.EquiCod left join dbo.PontoVenda as P on P.EquiCod = bog.EquiCod and P.PdvStatus = 'A' left join (select distinct EquiCod, MAX(Id) as Id, MAX(DtAberturaChamado) as DtAberturaChamado from dbo.ChamadosSL2MiFix where ChamadoFechado = 0 and ChamadoAberto = 1 group by EquiCod) as C on C.EquiCod = bog.EquiCod WHERE (((bog.GrpVen) = ?)) group by bog.GrpVen, bog.EquiCod, P.AnxDesc, bog.MáxDeDataLeitura, bog.[Ql-4], bog.[Ql-3], bog.[Ql-2], bog.[Ql-1], bog.Ql0, bog.[Con-4], bog.[Con-3], bog.[Con-2], bog.[Con-1], bog.Con0, bog.Prd3, bog.Prd2, bog.Prd1, bog.Prd, bog.LeitOk, F.GrupoVenda, F.Email, E.EquiDesc, P.PdvLogradouroPV, P.PdvNumeroPV, P.PdvBairroPV, P.PdvComplementoPV, P.PdvCidadePV, P.PdvUfPV, P.PdvCEP, C.Id order by EquiCod DESC"
