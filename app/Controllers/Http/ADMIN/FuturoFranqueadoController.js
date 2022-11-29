"use strict";

const Database = use("Database");
const Drive = use("Drive");
const Mail = use("Mail");
const Env = use("Env");
const fs = require("fs");
const toArray = require('stream-to-array')
const Helpers = use("Helpers");
const archiver = require('archiver');
const moment = require('moment')
const logger = require("../../../../dump/index")
const PdfPrinter = require("pdfmake");
const { PDFGen } = require('../../../../resources/pdfModels/perfilFranqueadoForm_pdfModel_novo')

var fonts = {
  Roboto: {
    normal: Helpers.resourcesPath("fonts/OpenSans-Regular.ttf"),
    bold: Helpers.resourcesPath("fonts/OpenSans-Bold.ttf"),
    italics: Helpers.resourcesPath("fonts/OpenSans-RegularItalic.ttf"),
    bolditalics: Helpers.resourcesPath("fonts/OpenSans-BoldItalic.ttf"),
  },
};

const printer = new PdfPrinter(fonts);
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
          FT_nome: formType,
          FT_status: true
        })

      await Database.insert({
        FT_id: formTypeId[0].FT_id ? formTypeId[0].FT_id : 0,
        FTR_cod: cod,
        FTR_aberto: true,
        FTR_secao: 1,
        FTR_respostas: JSON.stringify([]),
        FTR_email: email.trim(),
        FTR_DtSolicitado: moment().toDate(),
        FTR_DtPreenchido: null
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
            .from(Env.get("MAIL_USERNAME"), "SLWEB")
            .subject("Código de acesso ao Formulário");
        }
      );

      response.status(201).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'FuturoFranqueadoController.RequestCod_V2',
      })
    }
  }

  async FutureCod({ request, response, params }) {
    const cod = params.cod

    try {

      let resposta = await Database
        .select('FT_id', 'FTR_aberto', 'FTR_secao', 'FTR_respostas')
        .from('dbo.SLWEB_FormularioTipoRespostas')
        .where({
          FTR_cod: cod,
        })

      let perguntas = await Database
        .select('FTP_id', 'FTP_slug', 'FTP_q', 'FTP_o', 'FTP_t', 'FTP_i', 'FTP_s', 'FTP_d')
        .from('dbo.SLWEB_FormularioTipoPerguntas')
        .where({
          FT_id: resposta[0].FT_id
        })
        .orderBy('FTP_ordem', 'asc')

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
          slug: pergunta.FTP_slug,
          question: pergunta.FTP_q,
          questionOptions: JSON.parse(pergunta.FTP_o),
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
        err: err.message,
        handler: 'FuturoFranqueadoController.FutureCod_V2',
      })
    }
  }

  async UpdateForm({ request, response, params }) {
    const { form, secao } = request.only(["form", "secao"]);
    const candidato = params.CodCandidato;

    const path = Helpers.publicPath(`/tmp`);
    const PathWithName = `${path}/${candidato}-${new Date().getTime()}.pdf`;

    try {
      let respostas = []

      for (let s = 1; s < Object.keys(form).length; s++) {

        for (let q = 0; q < form[Object.keys(form)[s]].length; q++) {
          respostas.push({
            id: form[Object.keys(form)[s]][q].questionId,
            value: form[Object.keys(form)[s]][q].answer
          })
        }
      }

      await Database
        .table('dbo.SLWEB_FormularioTipoRespostas')
        .where({
          FTR_cod: candidato,
          FTR_aberto: true,
        })
        .update({
          FTR_aberto: secao === null ? false : true,
          FTR_respostas: JSON.stringify(respostas),
          FTR_secao: secao,
          FTR_DtPreenchido: secao === null ? moment().toDate() : null
        })

      if (Object.keys(form)[secao] === 'Encerramento') {
        const info = await Database
          .select('FTR_email')
          .from('dbo.SLWEB_FormularioTipoRespostas')
          .where({
            FTR_cod: candidato,
            FTR_aberto: true,
          })

        let nomeDest = null
        let consultorDest = null

        // encontro o nome do candidato
        for (let s = 1; s < Object.keys(form).length; s++) {
          for (let q = 0; q < form[Object.keys(form)[s]].length; q++) {
            if (form[Object.keys(form)[s]][q].slug === 'Nome') {
              nomeDest = form[Object.keys(form)[s]][q].answer
            }
          }
        }

        // encontro o consultor ref
        for (let s = 1; s < Object.keys(form).length; s++) {
          for (let q = 0; q < form[Object.keys(form)[s]].length; q++) {
            if (form[Object.keys(form)[s]][q].slug === 'Consultor') {
              consultorDest = form[Object.keys(form)[s]][q].answer
            }
          }
        }

        // envio email pro candidato que preencheu
        await Mail.send(
          "emails.FormFranquiaPreenchidoFF",
          { Destinatario: String(nomeDest).split(" ")[0] },
          (message) => {
            message
              .to(String(info[0].FTR_email).slice(0, 250))
              .cc(Env.get("EMAIL_SUPORTE"))
              .from(Env.get("MAIL_USERNAME"), "SLWEB")
              .subject("Formulário de Perfil")
          }
        );

        let emailConsultor = null

        switch (consultorDest) {
          case 'Alessandro':
            emailConsultor = 'alessandro.pinheiro@pilaoprofessional.com.br'
            break;
          case 'Iris':
            emailConsultor = 'iris.moreno@pilaoprofessional.com.br'
            break;
          case 'Andrea':
            emailConsultor = 'andrea.milos@pilaoprofessional.com.br'
            break;
          default:
            emailConsultor = null
            break;
        }

        // se consultor !== null
        if (emailConsultor !== null) {

          // gero PDF do questionário
          const PDFModel = PDFGen(form);

          var pdfDoc = printer.createPdfKitDocument(PDFModel);
          pdfDoc.pipe(fs.createWriteStream(PathWithName));
          pdfDoc.end();

          // envio email pro consultor que indicou a franquia
          await Mail.send(
            "emails.FormFranquiaPreenchidoConsultor",
            {
              Consultor: consultorDest,
              INTERESSADO: nomeDest,
              Frontend: Env.get('CLIENT_URL')
            },
            (message) => {
              message
                .to(emailConsultor)
                .cc(Env.get("EMAIL_SUPORTE"))
                .from(Env.get("MAIL_USERNAME"), "SLWEB")
                .subject("Formulário de Franquia preenchido")
                .attach(PathWithName, {
                  filename: `Formulário de Perfil_${candidato}.pdf`,
                })
            }
          );
        }

      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'FuturoFranqueadoController.UpdateForm',
      })
    }
  }

  async FileUpload({ request, response }) {
    const COD = request.input('cod')
    const MULTI = request.input('multiple')
    const formData = request.file("formData", { types: ["image", "pdf"], size: "10mb" });
    const qId = request.input(('qId'))

    const path = Helpers.publicPath(`/DOCS/${COD}`);
    let newFileName = ''
    let filenames = [];
    let file = null

    try {

      if (MULTI === 'N') {

        newFileName = `upload-SINGLE-${COD}-${new Date().getTime()}.${formData.subtype}`;

        await formData.move(path, {
          name: newFileName,
          overwrite: true,
        });

        if (!formData.moved()) {
          return formData.errors();
        }

        file = await Drive.get(`${path}/${newFileName}`);

        Drive.put(
          `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\DOCS\\${COD}\\${newFileName}`,
          file
        );
      } else {
        await formData.moveAll(path, (file, i) => {
          newFileName = `upload-MULTIPLE-${COD}-${i + 1}-${new Date().getTime()}.${file.subtype}`;
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
            `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\DOCS\\${COD}\\${name}`,
            file
          );
        });
      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'FuturoFranqueadoController.FileUpload',
      })
    }
  }

  async Show({ request, response }) {
    const token = request.header("authorization");

    try {

      let fixedForm = []
      const Form = await Database.raw(QUERY_SHOW_ALL_FORMS)

      Form.forEach(f => {
        if (fixedForm.filter(ff => ff.Cod === f.Codigo).length === 0) {
          fixedForm.push({
            Cod: f.Codigo,
            Email: f.email,
            FormId: f["ID Form"],
            FormName: f["Nome Form"],
            FormOpen: f.Aberto,
            FormLastSection: f.Secao,
            FormDtRequest: f["Dt. Solicitado"],
            FormDtFulfilled: f["Dt. Preenchido"],
            Questions: {}
          })
        }
      })

      fixedForm.forEach((ff, i) => {
        let qs = Form.filter(f => ff.Cod === f.Codigo)
        let sectionNames = []

        // selecionar nomes de sessoes distintas
        qs.forEach(q => {
          sectionNames = [...sectionNames, q.Segmento]
        })

        // criar uma propriedade para cada nome de sessao
        sectionNames.forEach(sn => {
          fixedForm[i].Questions = { ...fixedForm[i].Questions, [sn]: [] }
        })

        // popular as sessoes com as respectivas questoes && atribuir respostas as questoes
        qs.forEach(q => {
          let prevAnswer = q.respostas !== null
            ? JSON.parse(q.respostas)
              .filter(ans => Number(ans.id) === Number(q["ID Questao"]))
            : null

          prevAnswer = Array.isArray(prevAnswer) && prevAnswer.length > 0 ? prevAnswer[0].value : null


          fixedForm[i].Questions[q.Segmento].push({
            QuestionId: q["ID Questao"],
            QuestionSlug: q.Slug,
            QuestionAnswer: prevAnswer,
            QuestionType: q.Tipo
          })
        })
      })

      response.status(200).send({
        Form: fixedForm
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'FuturoFranqueadoController.Show',
      })
    }
  }

  async GeneratePDF({ request, response, params }) {
    const token = request.header("authorization");
    const CodCandidato = params.CodCandidato;
    const path = Helpers.publicPath(`/tmp`);
    const PathWithName = `${path}/${CodCandidato}-${new Date().getTime()}.pdf`;

    try {
      let resposta = await Database
        .select('FT_id', 'FTR_aberto', 'FTR_secao', 'FTR_respostas')
        .from('dbo.SLWEB_FormularioTipoRespostas')
        .where({
          FTR_cod: CodCandidato,
        })

      let perguntas = await Database
        .select('FTP_id', 'FTP_slug', 'FTP_q', 'FTP_o', 'FTP_t', 'FTP_i', 'FTP_s', 'FTP_d')
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
          slug: pergunta.FTP_slug,
          question: pergunta.FTP_q,
          questionOptions: JSON.parse(pergunta.FTP_o),
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

      const PDFModel = PDFGen(form);

      var pdfDoc = printer.createPdfKitDocument(PDFModel);
      pdfDoc.pipe(fs.createWriteStream(PathWithName));
      pdfDoc.end();


      const enviarDaMemóriaSemEsperarSalvarNoFS = await toArray(pdfDoc).then(parts => {
        return Buffer.concat(parts);
      })

      response.status(200).send(enviarDaMemóriaSemEsperarSalvarNoFS);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'FuturoFranqueadoController.GeneratePDF',
      })
    }
  }

  async GenerateZip({ request, response, params }) {
    const token = request.header("authorization");
    const CodCandidato = params.CodCandidato;

    const path = Helpers.publicPath(`/tmp`);
    const outPath = `${path}/${CodCandidato}-${new Date().getTime()}.zip`;
    const sourcePath = `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\DOCS\\${CodCandidato}`

    try {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const stream = fs.createWriteStream(outPath);

      await new Promise((resolve, reject) => {
        archive
          .directory(sourcePath, false)
          .on('error', err => reject(err))
          .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
      })

      response.status(200).attachment(outPath);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'FuturoFranqueadoController.GeneratePDF',
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
        err: err.message,
        handler: 'FuturoFranqueadoController.RetriveWORDFORM',
      })
    }
  }
}

module.exports = FuturoFranqueadoController;

const QUERY_SHOW_ALL_FORMS = 'select FT.FT_id as "ID Form", FT.FT_nome as "Nome Form", FTP.FTP_id as "ID Questao", FTP.FTP_slug as "Slug", FTP.FTP_s as "Segmento", FTR.FTR_aberto as "Aberto", FTR.FTR_secao as "Secao", FTR.FTR_respostas as "respostas", FTR.FTR_cod as "Codigo", FTR.FTR_DtSolicitado as "Dt. Solicitado", FTR.FTR_email  as "email", FTP.FTP_t as Tipo , FTR.FTR_DtPreenchido as "Dt. Preenchido" from dbo.SLWEB_FormularioTipo as FT right join dbo.SLWEB_FormularioTipoPerguntas as FTP on FT.FT_id = FTP.FT_id right join dbo.SLWEB_FormularioTipoRespostas as FTR on FTP.FT_id = FTR.FT_id order by FTR.FTR_DtSolicitado desc'