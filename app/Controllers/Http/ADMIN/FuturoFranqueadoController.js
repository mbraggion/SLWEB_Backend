"use strict";

const Database = use("Database");
const Drive = use("Drive");
const Mail = use("Mail");
const Env = use("Env");
const moment = require('moment')
const logger = require("../../../../dump/index")

moment.locale("pt-br");
class FuturoFranqueadoController {
  async RequestCod({ request, response }) {
    const { email, formType } = request.only(["email", "formType"]);

    try {
      let cod = null
      let achouCod = []

      do {
        //crio um numero aleatório de 6 posições
        cod = Math.random().toString().slice(2, 8);

        //verifico se já não foi usado
        achouCod = await Database
          .select('*')
          .from('dbo.SLWEB_FormularioTipoRespostas')
          .where({
            FTR_cod: cod
          })

      } while (achouCod.length > 0);

      const formTypeId = await Database
        .select('FT_id')
        .from('dbo.SLWEB_FormularioTipo')
        .where({
          FT_nome: formType
        })

      await Database.insert({
        FT_id: formTypeId[0].FT_id ?? 0,
        FTR_cod: cod,
        FTR_aberto: true,
        FTR_secao: 1,
        FTR_respostas: null,
      }).into('dbo.SLWEB_FormularioTipoRespostas')

      await Mail.send(
        "emails.CodForm",
        { Codigo: cod, FRONTEND: Env.get('CLIENT_URL') },
        (message) => {
          message
            .to(email.trim())
            .cc([
              Env.get("EMAIL_COMERCIAL_2"),
              Env.get("EMAIL_COMERCIAL_3"),
              Env.get("EMAIL_SUPORTE"),
            ])
            .from(Env.get("MAIL_USERNAME"), "SLAplic Web")
            .subject("Código de acesso ao Formulário");
        }
      );

      response.status(201).send('ok');
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err,
        handler: 'FuturoFranqueadoController.RequestCod_V2',
      })
    }
  }

  async FutureCod({ request, response, params }) {
    const cod = params.cod

    try {
      // recuperar respostas já dadas
      let resposta = await Database
        .select('FT_id', 'FTR_aberto', 'FTR_secao', 'FTR_respostas')
        .from('dbo.SLWEB_FormularioTipoRespostas')
        .where({
          FTR_cod: cod,
        })

      let perguntas = await Database
        .select('FTP_id', 'FTP_slug', 'FTP_q', 'FTP_t', 'FTP_i', 'FTP_s', 'FTP_d')
        .from('dbo.SLWEB_FormularioTipoPerguntas')
        .where({
          FT_id: resposta[0].FT_id
        })

      let form = {
        NC: []
      }

      perguntas.forEach(pergunta => {
        let prevAnswer = resposta[0].FTR_respostas !== null
          ? JSON.parse(resposta[0].FTR_respostas)
            .filter(ans => Number(ans.id) === Number(pergunta.FTP_id))
          : null

        prevAnswer = Array.isArray(prevAnswer) && prevAnswer.length > 0 ? prevAnswer[0].value : null

        let p = {
          questionId: pergunta.FTP_id,
          question: pergunta.FTP_q,
          answer: prevAnswer,
          answerComponentType: pergunta.FTP_t,
          invalidMessage: pergunta.FTP_i,
          dependences: JSON.parse(pergunta.FTP_d),
        }


        if (pergunta.FTP_s === null) {
          //se nao tiver sessao
          form.NC = [...form.NC, p]
        } else if (pergunta.FTP_s !== null && pergunta.FTP_s in form) {
          //se tiver sessao e ela ja existir no form
          form[pergunta.FTP_s] = [...form[pergunta.FTP_s], p]
        } else {
          //se tiver sessao e ela nao existir no form
          form[pergunta.FTP_s] = [p]
        }
      })

      response.status(200).send({
        SECAO: resposta[0].FTR_secao,
        CONCLUÍDO: !resposta[0].FTR_aberto,
        FORM: form
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err,
        handler: 'FuturoFranqueadoController.FutureCod_V2',
      })
    }
  }

  async RetriveWORDFORM({ response }) {
    try {
      // PUXO O FORMULÁRIO DA REDE
      const formulario = await Drive.get(
        `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\QUESTIONARIO_PERFIL_ATUALIZADO.doc`
      );
      response.status(200).send(formulario);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: null,
        err: err,
        handler: 'FuturoFranqueadoController.RetriveWORDFORM',
      })
    }
  }
}

module.exports = FuturoFranqueadoController;
