"use strict";

const Database = use("Database");
const Drive = use('Drive');
const Helpers = use('Helpers');
const Mail = use("Mail");
const Env = use("Env");

const fs = require("fs");
const logger = require("../../../../dump/index")
const { seeToken } = require("../../../Services/jwtServices");
const moment = require("moment");
moment.locale("pt-br");

class MailerController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const log = await Database.select("*")
        .from("dbo.LogAvisos")
        .orderBy("DataOcor", "DESC");

      response.status(200).send({
        History: log,
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'MailerController.Show',
      })
    }
  }

  async See({ request, response }) {
    const token = request.header("authorization");

    try {
      const recipients = await Database
        .raw("select A1_GRPVEN, M0_CODFIL, Email from dbo.FilialEntidadeGrVenda where Inatv IS NULL and M0_CODFIL <> '0201' and M0_CODFIL <> '0203' order by A1_GRPVEN ASC")

      const templates = await Database.select("*")
        .from('dbo.SLWebModeloDeEmails')
        .where({
          Ativo: true
        })

      const templatesWithConvertedHTML = []

      templates.forEach(template => {
        templatesWithConvertedHTML.push({
          ...template,
          rawHTML: FromEdgeFormatToRaw(ReadFileContentFromLocal(Helpers.resourcesPath(`/views/emails/custom/${template.ModeloArquivoEdgeNome}`)))
        })
      })

      response.status(200).send({
        AvailableRecipients: recipients,
        Templates: templatesWithConvertedHTML
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'MailerController.See',
      })
    }
  }

  async DispatchEmail({ request, response }) {
    const token = request.header("authorization");

    const {
      subject,
      body,
      recipients,
      salvarNovoTemplate,
      nomeNovoTemplate,
      template
    } = request.only(['subject', 'body', 'recipients', 'salvarNovoTemplate', 'nomeNovoTemplate', 'template'])

    try {
      //converter texto bruto para edge(html) com as tags
      const rawBodyToEdge = FromRawMailToEdgeFormat(body);
      let templateName = null
      let templateCaminho = null

      if (salvarNovoTemplate) {
        console.log('salvar e enviar')

        //se o template for null é um novo modelo e eu crio as paradas, senão eu atualizo o modelo e o sql
        if (template === null) {
          templateName = `${nomeNovoTemplate}`
          templateCaminho = Helpers.resourcesPath(`/views/emails/custom/${templateName}.edge`)

          await Database.insert({
            Ativo: true,
            ModeloNome: subject,
            CriadoEm: moment().subtract(3, 'hours').toDate(),
            AtualizadoEm: null,
            ModeloArquivoEdgeNome: `${templateName}.edge`
          }).into('dbo.SLWebModeloDeEmails')

          await Drive.put(templateCaminho, Buffer.from(rawBodyToEdge))

        } else {
          templateName = `${nomeNovoTemplate}`
          templateCaminho = Helpers.resourcesPath(`/views/emails/custom/${templateName}`)

          await Database.table("dbo.SLWebModeloDeEmails")
            .where({
              ModeloID: template
            })
            .update({
              AtualizadoEm: moment().subtract(3, 'hours').toDate()
            });

          await Drive.put(templateCaminho, Buffer.from(rawBodyToEdge))
        }

        //envio os emails
        for (let i = 0; i < recipients.length; i++) {
          try {
            await Mail.connection("smtp_mass").send(
              `emails.custom.${templateName}`,
              null,
              (message) => {
                message
                  .to(recipients[i].Email)
                  .from(Env.get("MASS_SMTP_DOM"), "Pilão Professional")
                  .subject(subject);
              }
            );

            await Database.insert({
              DataOcor: moment().subtract(3, 'hours').toDate(),
              A1_GRPVEN: recipients[i].A1_GRPVEN,
              M0_CODFIL: recipients[i].M0_CODFIL,
              Email: recipients[i].Email,
              msg: `Envio em massa pelo site, assunto: ${subject}`,
              origem: 'SLWEB'
            }).into('dbo.LogAvisos')

          } catch (err) {
            console.log({
              message: `Falha ao enviar email para filial ${recipients[i].M0_CODFIL}(${recipients[i].Email})`,
              err
            })
          }
        }
      } else {
        console.log('somente enviar')

        for (let i = 0; i < recipients.length; i++) {
          try {
            await Mail.connection("smtp_mass").raw(
              rawBodyToEdge,
              (message) => {
                message
                  .to(recipients[i].Email)
                  .from(Env.get("MASS_SMTP_DOM"), "Pilão Professional")
                  .subject(subject);
              }
            );

            await Database.insert({
              DataOcor: moment().subtract(3, 'hours').toDate(),
              A1_GRPVEN: recipients[i].A1_GRPVEN,
              M0_CODFIL: recipients[i].M0_CODFIL,
              Email: recipients[i].Email,
              msg: `Envio em massa pelo site, assunto: ${subject}`,
              origem: 'SLWEB'
            }).into('dbo.LogAvisos')
          } catch (err) {
            console.log({
              message: `Falha ao enviar email para filial ${recipients[i].M0_CODFIL}(${recipients[i].Email})`,
              err
            })
          }
        }
      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'MailerController.DispararEmail',
      })
    }
  }
}

module.exports = MailerController;

function FromRawMailToEdgeFormat(rawBody) {
  let Formated = '<label>' + String(rawBody)

  Formated = Formated.replace(/\n/g, "</label><br><label>")

  Formated = Formated.concat("</label>")

  //coloca os links em um <a>
  Formated = linkify(Formated)

  return Formated
}

function linkify(text) {
  var urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlRegex, function (url) {
    return '<a href="' + url + '">' + url + '</a>';
  });
}

function FromEdgeFormatToRaw(edgeFormat) {
  let Formated = edgeFormat.replace(/<br>/g, "\n")

  Formated = Formated.replace(/<\/label>/g, "")

  Formated = Formated.replace(/<label>/g, "")

  Formated = unlinkify(Formated)

  return Formated
}

function unlinkify(text) {
  //se Deus quiser eu não volto aqui nunca mais!...

  //regex para separar string tirando os <a> e </a> no processo
  let regex = /<a([\s\S]*?)<\/a>/

  //aqui nenhum link tem <a> e </a> mas ainda tem href com outro link por exemplo
  let stringSeparada = text.split(regex)
  let result = ''

  //agora eu percorro o array e se a string for parte(deformada) de um link dou um tratamento, se não cai no else e retorna a string(provavelmente vai ser só um texto comum)
  stringSeparada.forEach((stringzinha) => {
    //aqui eu tiro o href que sobrou da tag <a>
    let SepararLadoEsquerdoDoLink = stringzinha.split(' href="')

    //se o split anterior caiu em um falecido <a> aqui é onde eu trato o resto da tag, se não vai retornar a mesma string no else
    if (SepararLadoEsquerdoDoLink.length > 1) {
      let link = SepararLadoEsquerdoDoLink[1].split('">http')[0]

      result = result + link
    } else {
      result = result + SepararLadoEsquerdoDoLink[0]
    }
  })

  return result
}

function ReadFileContentFromLocal(path) {
  try {
    const data = fs.readFileSync(path, 'utf8')
    return data

  } catch (err) {
    console.log(err)
    return ''
  }
}