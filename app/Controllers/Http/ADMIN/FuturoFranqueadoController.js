"use strict";

const Database = use("Database");
const Helpers = use("Helpers");
const Drive = use("Drive");
const Mail = use("Mail");
const Env = use("Env");
const PdfPrinter = require("pdfmake");
const fs = require("fs");
const toArray = require('stream-to-array')
const moment = require('moment')
const logger = require("../../../../dump/index")
const { seeToken, dateCheck } = require("../../../Services/jwtServices");
const { PDFGen } = require("../../../../resources/pdfModels/perfilFranqueadoForm_pdfModel");

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
  async RequestCod_V2({ request, response }) {
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

  async FutureCod_V2({ request, response, params }) {
    const cod = params.cod

    try {
      // recuperar respostas já dadas
      let resposta = await Database
      .select('FTR_aberto', 'FTR_secao', 'FTR_respostas')
      .from('dbo.SLWEB_FormularioTipoRespostas')
      .where({ 
        FTR_cod: cod, 
      })

      response.status(200).send({
        SECAO: resposta[0].FTR_secao,
        CONCLUÍDO: !resposta[0].FTR_aberto,
        FORM: resposta[0].FTR_respostas
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

  async Show_V1({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = await seeToken(token);

      if (verified.role === "Franquia") {
        throw new Error('Usuário não autorizado');
      }

      const formularios = await Database
        .select("*")
        .from("dbo.FuturaFranquia")
        .where({
          PREENCHIDO: true
        }).orderBy('DtSolicitacao', 'desc');

      response.status(200).send(formularios);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'FuturoFranqueadoController.Show',
      })
    }
  }

  async GeneratePDF_V1({ request, response, params }) {
    const token = request.header("authorization");
    const CodCandidato = params.CodCandidato;
    const path = Helpers.publicPath(`/tmp`);
    const PathWithName = `${path}/${CodCandidato}-${new Date().getTime()}.pdf`;

    try {
      const verified = await seeToken(token);

      if (verified.role === "Franquia") throw new Error('usuário franqueado');

      const Form = await Database
        .select("*")
        .from("dbo.FuturaFranquia")
        .where({
          CodCandidato: CodCandidato,
        })

      const PDFModel = PDFGen(Form[0]);

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
        err: err,
        handler: 'FuturoFranqueadoController.GeneratePDF',
      })
    }
  }

  async FutureCod_V1({ request, response, params }) {
    const cod = params.cod

    try {
      let resposta = await Database.raw(QUERY_FUTURO_FRANQUEADO, [cod])

      if (resposta.length === 0) {
        throw Error;
      }

      if (resposta[0].Prioridade === null) {
        resposta[0].Prioridade = new Array(11)
      } else {
        resposta[0].Prioridade = resposta[0].Prioridade.split(',')
      }

      response.status(200).send({
        SECAO: resposta[0].SECAO,
        CONCLUÍDO: resposta[0].PREENCHIDO,
        FORM: resposta[0]
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err,
        handler: 'FuturoFranqueadoController.FutureCod',
      })
    }
  }

  async RequestCod_V1({ request, response }) {
    const { email } = request.only(["email"]);

    try {
      //crio um numero aleatório de 6 posições
      const cod = Math.random().toString().slice(2, 8);

      await Database.insert({
        CodCandidato: cod,
        Email: email
      }).into('dbo.FuturaFranquia')

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
        handler: 'FuturoFranqueadoController.RequestCod',
      })
    }
  }

  async FormUpload_V1({ request, response, params }) {
    const { form, secao } = request.only(["form", "secao"]);
    const candidato = params.CodCandidato;
    const path = Helpers.publicPath(`/tmp`);
    const PathWithName = `${path}/${candidato}-${new Date().getTime()}.pdf`;
    let Form

    try {

      Form = await Database
        .select("*")
        .from("dbo.FuturaFranquia")
        .where({
          CodCandidato: candidato,
        })

      await Database.table("dbo.FuturaFranquia")
        .where({ CodCandidato: candidato })
        .update({
          PREENCHIDO: Form[0].SECAO >= 9 || secao >= 9 ? 1 : 0,
          SECAO: Form[0].SECAO < secao ? secao : Form[0].SECAO,
          DtPreenchimento: Form[0].SECAO >= 9 || secao >= 9 ? dateCheck() : null,
          NomeCompleto: String(form.Nome_Completo).slice(0, 250),
          DtNascimento: rawDateToMomentValidObject(form.DtNascimento),
          RG: String(form.RG).slice(0, 250),
          CPF: String(form.CPF).slice(0, 250),
          Logradouro: String(form.Logradouro).slice(0, 250),
          Número: String(form.Número).slice(0, 250),
          Complemento: String(form.Complemento).slice(0, 250),
          Bairro: String(form.Bairro).slice(0, 250),
          Municipio: String(form.Municipio).slice(0, 250),
          Estado: String(form.Estado).slice(0, 250),
          CEP: String(form.CEP).slice(0, 250),
          Email: String(form.Email).slice(0, 250),
          TelResidencial: form.Tel_Residencial,
          Celular: form.Celular,
          EstCivil: form.Est_Civil,
          NomeConj: String(form.Conj_Nome).slice(0, 250),
          DtNascConj: rawDateToMomentValidObject(form.Conj_DtNascimento),
          TempoUni: String(form.TUnião).slice(0, 250),
          CPFConj: form.Conj_CPF,
          RGConj: form.Conj_RG,
          RendMenConj: String(form.Conj_RendMensal).slice(0, 250),
          Profissao: String(form.Profissao).slice(0, 250),
          CLT: form.CLT,
          RendMensal: String(form.Rend_Mensal).slice(0, 250),
          PFilhos: form.Tem_filhos,
          QFilhos: String(form.Qtd_filhos).slice(0, 250),
          IFilhos: form.Idd_filhos,
          TResidencia: form.T_Residencia,
          ValResidencia: String(form.Residencia_Mensal).slice(0, 250),
          PVeiculo: form.P_Veiculo,
          PImovel: form.P_Imovel,
          ExpectRetorno: form.Expect,
          PRecolhimento: form.Recolhimento,
          QRecolhimento: String(form.Recolhimento_QTD).slice(0, 250),
          OrigemCapital: String(form.Origem_Capital).slice(0, 250),
          RendaFamiliar: String(form.Renda_Familiar).slice(0, 250),
          CRendaFamiliar: String(form.Renda_Composta).slice(0, 250),
          DispInvest: String(form.Disp_Invest).slice(0, 250),
          TEmpresaExp: form.T_Empresa,
          EspcEmpresa: String(form.Detalhes_Atividade).slice(0, 250),
          FormEscolar: String(form.Form_Escolar).slice(0, 250),
          UltExp: String(form.Ult_exp).slice(0, 250),
          HavSociedade: form.Sociedade,
          NomeSocio: String(form.Nome_Socio).slice(0, 250),
          VincSocio: String(form.Socio_Vinculo).slice(0, 250),
          TempConhece: String(form.Tempo_ConheceSocio).slice(0, 250),
          Realizacoes: String(form.Realizou_Socio).slice(0, 250),
          TSocio: String(form.Cond_Socio).slice(0, 250),
          SocioInvest: form.Part_invest,
          InvestProp: String(form.Prop_Invest).slice(0, 250),
          TeveSociedade: form.T_Empreendimento,
          SociedadeExp: String(form.Exp_Sociedade).slice(0, 250),
          InvestMenInic: form.Cob_Desp,
          ConhecPilao: String(form.Conhece_Pilao).slice(0, 250),
          Notas: form.Prioridade[0] === null ? null : form.Prioridade.toString(),
          CaracEscolha: String(form.Caracteristica_Peso).slice(0, 250),
          ConcRegras: form.Com_Regra,
          LucroMin: form.Com_Med,
          CompInformar: form.Com_Inf,
          Consultor: form.Consultor,
        });

      //se for o fim do formulário envio os emails
      if (secao === 9 && Form[0].SECAO < 9) {
        await Mail.send(
          "emails.FormFranquiaPreenchidoFF",
          { Destinatario: String(form.Nome_Completo).split(" ")[0] },
          (message) => {
            message
              .to(String(form.Email).slice(0, 250))
              .cc(Env.get("EMAIL_SUPORTE"))
              .from(Env.get("MAIL_USERNAME"), "SLAplic Web")
              .subject("Formulário de Franquia recebido")
          }
        );

        let emailConsultor = null

        switch (form.Consultor) {
          case 'Alessandro':
            emailConsultor = 'alessandro.pinheiro@pilaoprofessional.com.br'
            break;
          case 'Kauê':
            emailConsultor = 'kaue.santos@pilaoprofessional.com.br'
            break;
          case 'Priscila':
            emailConsultor = 'priscila.mattos@pilaoprofessional.com.br'
            break;
          case 'Richard':
            emailConsultor = 'richard.bastos@pilaoprofessional.com.br'
            break;
          case 'Tatiane':
            emailConsultor = 'tatiane.silva@pilaoprofessional.com.br'
            break;
          default:
            emailConsultor = null
            break;
        }

        Form = await Database
          .select("*")
          .from("dbo.FuturaFranquia")
          .where({
            CodCandidato: candidato,
          })

        const PDFModel = PDFGen(Form[0]);

        var pdfDoc = printer.createPdfKitDocument(PDFModel);
        pdfDoc.pipe(fs.createWriteStream(PathWithName));
        pdfDoc.end();

        if (emailConsultor !== null) {
          await Mail.send(
            "emails.FormFranquiaPreenchidoConsultor",
            {
              Consultor: form.Consultor,
              INTERESSADO: String(form.Nome_Completo).split(" ")[0],
              Frontend: Env.get('CLIENT_URL')
            },
            (message) => {
              message
                .to(emailConsultor)
                .cc(Env.get("EMAIL_SUPORTE"))
                .from(Env.get("MAIL_USERNAME"), "SLAplic Web")
                .subject("Formulário de Franquia preenchido")
                .attach(PathWithName, {
                  filename: `Formulário de Perfil_${candidato}.pdf`,
                })
            }
          );
        }
      }

      response.status(201).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err,
        handler: 'FuturoFranqueadoController.FormUpload',
      })
    }
  }

  async FileUpload_V1({ request, response }) {
    const COD = request.input('cod')
    const MULTI = request.input('multiple')
    const DOC = request.input('doc')
    const formData = request.file("formData", {
      types: ["image", "pdf"],
      size: "10mb",
    });
    const path = Helpers.publicPath(`/DOCS/${COD}`);
    let newFileName = ''
    let filenames = [];
    let file = null

    try {
      if (MULTI === 'N') {

        newFileName = `upload-SINGLE-${DOC}-${new Date().getTime()}.${formData.subtype}`;

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
          newFileName = `upload-MULTIPLE-${DOC}-${i + 1}-${new Date().getTime()}.${file.subtype}`;
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
        err: err,
        handler: 'FuturoFranqueadoController.FileUpload',
      })
    }
  }

  //mover isso para outro controller
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

const rawDateToMomentValidObject = (rawDate) => {
  if (rawDate === null || typeof rawDate === 'undefined' || String(rawDate).trim() === '') {
    return null
  }

  if (moment(rawDate).isValid()) {
    return moment(rawDate).format('DD/MM/YYYY')
  } else {
    const MomentValidObj = moment()
    const destructecRawDate = String(rawDate).split('/')

    MomentValidObj.date(destructecRawDate[0])
    MomentValidObj.month(destructecRawDate[1] - 1)
    MomentValidObj.year(destructecRawDate[2])

    return MomentValidObj.format('DD/MM/YYYY')
  }
}

module.exports = FuturoFranqueadoController;

const QUERY_FUTURO_FRANQUEADO = "select PREENCHIDO, SECAO, NomeCompleto as Nome_Completo, DtNascimento as DtNascimento, RG as RG, CPF as CPF, Logradouro as Logradouro, Número as Número, Complemento as Complemento, Bairro as Bairro, Municipio as Municipio, Estado as Estado, CEP as CEP, Email as Email, TelResidencial as Tel_Residencial, Celular as Celular, EstCivil as Est_Civil, NomeConj as Conj_Nome, DtNascConj as Conj_DtNascimento, TempoUni as TUnião, CPFConj as Conj_CPF, RGConj as Conj_RG, RendMenConj as Conj_RendMensal, Profissao as Profissao, CLT as CLT, RendMensal as Rend_Mensal, PFilhos as Tem_filhos, QFilhos as Qtd_filhos, IFilhos as Idd_filhos, TResidencia as T_Residencia, ValResidencia as Residencia_Mensal, PVeiculo as P_Veiculo, PImovel as P_Imovel, ExpectRetorno as Expect, PRecolhimento as Recolhimento, QRecolhimento as Recolhimento_QTD, OrigemCapital as Origem_Capital, RendaFamiliar as Renda_Familiar, CRendaFamiliar as Renda_Composta, DispInvest as Disp_Invest, TEmpresaExp as T_Empresa, EspcEmpresa as Detalhes_Atividade, FormEscolar as Form_Escolar, UltExp as Ult_exp, HavSociedade as Sociedade, NomeSocio as Nome_Socio, VincSocio as Socio_Vinculo, TempConhece as Tempo_ConheceSocio, Realizacoes as Realizou_Socio, TSocio as Cond_Socio, SocioInvest as Part_invest, InvestProp as Prop_Invest, TeveSociedade as T_Empreendimento, SociedadeExp as Exp_Sociedade, InvestMenInic as Cob_Desp, ConhecPilao as Conhece_Pilao, Notas as Prioridade, CaracEscolha as Caracteristica_Peso, ConcRegras as Com_Regra, LucroMin as Com_Med, CompInformar as Com_Inf, Consultor as Consultor from dbo.FuturaFranquia where CodCandidato = ?"