"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
const logger = require("../../../../dump/index")

class LeadController {
  async Show({ request, response }) {
    try {
      const token = request.header("authorization");

      const verified = seeToken(token);

      //da o vencimento aos contatos vencidos
      // await Database.raw(
      //   "update dbo.LeadsAttr set Ativo = 0, Expirou = 1, DataFechamento = GETDATE() where GETDATE() > DATEADD(HH, (select ParamVlr as MaxHoras from dbo.Parametros where ParamId = 'LeadMaxHoras'), DataHora) AND Ativo = 1"
      // );

      //busca leads disponiveis
      const LeadsGeral = await Database.raw(
        "select L.Id, L.Nome_Fantasia, L.Razao_Social, L.Estado, L.Municipio, L.AtividadeDesc, L.Mensagem, L.Insercao from ( select * from dbo.Leads as L left join( select LeadId, COUNT(GrpVen) as Atribuicoes from dbo.LeadsAttr where Ativo = 1 or (Ativo = 0 and Negociacao = 1) group by LeadId ) as C on L.Id = C.LeadId left join( select ParamVlr as MaxAtribuicoes from dbo.Parametros where ParamId = 'LeadMax' ) as P on P.MaxAtribuicoes <> 0 where Atribuicoes IS NULL OR Atribuicoes < MaxAtribuicoes and L.Disponivel = 1 ) as L inner join dbo.FilialEntidadeGrVenda as F on F.A1_GRPVEN = ? where L.Id not in ( select LeadId from dbo.LeadsAttr where GrpVen = ? group by LeadId ) and L.Insercao <= ( SELECT DATETIMEFROMPARTS( DATEPART(YY, GETDATE()), DATEPART(MM, GETDATE()), DATEPART(DD, GETDATE()), ( select top(1) ParamVlr from dbo.Parametros where ParamId = 'LeadLiberacaoHora' ), 00, 00, 000 ) ) and DATEDIFF(D, L.Insercao, GETDATE()) <= 45 and( F.UF = L.Estado OR F.M0_CODFIL = '0201' OR F.M0_CODFIL = '0203' ) and L.Disponivel = 1 order by L.Insercao DESC",
        [verified.grpven, verified.grpven]
      );

      //busca leads assumidos pelo franqueado
      const LeadsFranqueado = await Database.raw(
        "select L.Id, L.Nome_Fantasia, L.Razao_Social, L.Estado, L.Municipio, L.AtividadeDesc, L.Mensagem, L.Contato, L.Fone_1, L.Fone_2, L.Email, A.DataHora, A.Ativo, A.Desistiu, A.Expirou, A.Negociacao, A.DataFechamento, L.Insercao from dbo.Leads as L inner join dbo.LeadsAttr as A on L.Id = A.LeadId where A.GrpVen = ? and (A.Ativo = 1 or (A.Ativo = 0 and A.DataFechamento >= (SELECT DATETIMEFROMPARTS(DATEPART(YY, GETDATE()),DATEPART(MM, GETDATE()), DATEPART(DD, GETDATE()), (select top(1) ParamVlr from dbo.Parametros where ParamId = 'LeadLiberacaoHora'), 00, 00, 000))))",
        [verified.grpven]
      );

      const Limites = await Database.raw(
        "select * from (select COUNT(GrpVen) as Tentativas from dbo.LeadsAttr where GrpVen = ? and (Ativo = 1 or (Ativo = 0 and DataFechamento >= (SELECT DATETIMEFROMPARTS(DATEPART(YY, GETDATE()),DATEPART(MM, GETDATE()), DATEPART(DD, GETDATE()), (select top(1) ParamVlr from dbo.Parametros where ParamId = 'LeadLiberacaoHora'), 00, 00, 000))))) as A join (select MaxLeads as MaxTentativas from dbo.FilialEntidadeGrVenda where A1_GRPVEN = ?) as P on P.MaxTentativas >= 0 join (select ParamVlr as MaxHoras from dbo.Parametros where ParamId = 'LeadMaxHoras') as J on J.MaxHoras >= 0",
        [verified.grpven, verified.grpven]
      );

      response.status(200).send({
        LeadsGeral: LeadsGeral.map(lead => ({ ...lead, status: 'Disponivel' })),
        LeadsFranqueado: LeadsFranqueado.map(lead => {
          if (lead.Ativo === true) {
            return ({ ...lead, status: 'Resgatado' })
          } else if (lead.Desistiu === true) {
            return ({ ...lead, status: 'Desistido' })
          } else if (lead.Expirou === true) {
            return ({ ...lead, status: 'Expirado' })
          } else if (lead.Negociacao === true) {
            return ({ ...lead, status: 'Negociando' })
          }
        }),
        Limites
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'LeadController.Show',
      })
    }
  }

  async ShowADM({ request, response }) {
    const token = request.header("authorization");

    try {
      let Leads = []

      Leads = await Database.raw("select L.Id, Nome_Fantasia, Razao_Social, Estado, Municipio, AtividadeDesc, Mensagem, Insercao, Disponivel, LA.Filial from dbo.Leads as L left join (select * from dbo.LeadsAttr where Ativo = 1 or Negociacao = 1) as LA on LA.LeadId = L.Id order by Insercao DESC", [])

      response.status(200).send({
        Leads: Leads
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'LeadController.ShowADM',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const LeadId = params.lead

    try {
      const verified = seeToken(token);

      const historico = await Database.raw('select LeadId, Motivo, DataFechamento from dbo.LeadsAttr where Desistiu = 1 and LeadId = ? order by DataFechamento DESC', [LeadId])

      response.status(200).send(historico)
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'LeadController.See',
      })
    }
  }

  async SeeADM({ request, response, params }) {
    const token = request.header("authorization");
    const LeadId = params.lead

    try {
      let info = null
      let hist = null

      info = await Database
        .select('*')
        .from('dbo.Leads')
        .where({
          Id: LeadId
        })

      hist = await Database
        .select('LeadId', 'Filial', 'DataHora', 'Ativo', 'Desistiu', 'Motivo', 'Expirou', 'Negociacao', 'DataFechamento')
        .from('dbo.LeadsAttr')
        .where({
          LeadId: LeadId
        })
        .orderBy('DataHora', 'DESC')

      response.status(200).send({
        Info: info[0],
        Historico: hist
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'LeadController.SeeADM',
      })
    }
  }

  async Update({ request, response }) {
    const token = request.header("authorization");
    const { ID, type, motivo } = request.only(["ID", "type", "motivo"]);

    try {
      const verified = seeToken(token);

      if (type === "hold") {
        const Limites = await Database.raw(
          "select COUNT(L.GrpVen) as Tentativas, F.MaxLeads as MaxTentativas from dbo.LeadsAttr as L inner join dbo.FilialEntidadeGrVenda as F on F.A1_GRPVEN = ? where L.GrpVen = ? and (L.Ativo = 1 or (L.Ativo = 0 and L.DataFechamento >= (SELECT DATETIMEFROMPARTS(DATEPART(YY, GETDATE()),DATEPART(MM, GETDATE()), DATEPART(DD, GETDATE()), (select top(1) ParamVlr from dbo.Parametros where ParamId = 'LeadLiberacaoHora'), 00, 00, 000)))) group by F.MaxLeads",
          [verified.grpven, verified.grpven]
        );

        if (
          typeof Limites[0] != "undefined" &&
          Limites[0].Tentativas >= Limites[0].MaxTentativas
        ) {
          response.status(401).send();
        } else {
          await Database.raw('IF NOT EXISTS (select * from dbo.LeadsAttr where LeadId = ? AND Ativo = 1) INSERT INTO dbo.LeadsAttr (LeadId, Filial, GrpVen) VALUES (?, ?, ?)',
            [ID, ID, verified.user_code, verified.grpven])

          const endereco = await Database.raw('select Contato, Fone_1, Fone_2, Email from dbo.Leads as L inner join dbo.LeadsAttr as A on L.Id = A.LeadId where L.Id = ? and A.GrpVen = ? and A.Ativo = 1',
            [ID, verified.grpven])

          if (endereco.length > 0) {
            response.status(200).send(endereco);
          } else {
            response.status(409).send(409)
            return
          }
        }
      } else if (type === "release") {
        moment.locale("pt-br");
        await Database.table("dbo.LeadsAttr")
          .where({
            GrpVen: verified.grpven,
            LeadId: ID,
          })
          .update({
            Ativo: false,
            Desistiu: true,
            Motivo: motivo,
            DataFechamento: moment().subtract(3, "hours").toDate(),
          });

        response.status(200).send();
      } else if (type === 'confirm') {
        moment.locale("pt-br");
        await Database.table("dbo.LeadsAttr")
          .where({
            GrpVen: verified.grpven,
            LeadId: ID,
          })
          .update({
            Ativo: false,
            Desistiu: false,
            Negociacao: true,
            Motivo: null,
            DataFechamento: moment().subtract(3, "hours").toDate(),
          });

        response.status(200).send();
      }

    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'LeadController.Update',
      })
    }
  }

  async ActiveInactive({ request, response, params }) {
    const token = request.header("authorization");
    const LeadId = params.lead
    const Status = params.status

    try {
      await Database.table("dbo.Leads")
        .where({ Id: LeadId })
        .update({
          Disponivel: Status === 'A' ? true : false
        })

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'LeadController.SeeADM',
      })
    }
  }

  async Store({ request, response }) {
    const token = request.header("authorization");
    const { lead } = request.only(["lead"]);

    try {
      await Database.insert({
        Nome_Fantasia: lead.NomeFantasia,
        Razao_Social: lead.RazaoSocial,
        Estado: lead.Estado,
        Municipio: lead.Municipio,
        Contato: lead.Contato,
        Fone_1: lead.Fone1,
        Fone_2: lead.Fone2,
        Email: lead.Email,
        AtividadeDesc: lead.Desc,
        Mensagem: lead.Msg,
        Disponivel: true,
      }).into("dbo.Leads");

      response.status(201).send();
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'LeadController.Store',
      })
    }
  }
}

module.exports = LeadController;
