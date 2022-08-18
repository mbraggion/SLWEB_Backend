"use strict";

const Database = use("Database");

const logger = require("../../../../dump/index")
const { seeToken } = require("../../../Services/jwtServices");

class FranquiasController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      if (verified.role === "Franquia") {
        throw new Error('Usuário não autorizado');
      }

      const filiais = await Database.raw(QUERY_TODAS_FILIAIS)

      response.status(200).send(filiais);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'FranquiasController.Show',
      })
    }
  }

  async Store({ request, response }) {
    const token = request.header("authorization");
    const { FormData } = request.only(["FormData"]);

    try {
      const verified = seeToken(token);

      if (verified.role === "Franquia") {
        throw new Error('Usuário não autorizado');
      }

      await Database.insert({
        A1_GRPVEN: String(FormData.GrpVen).trim().substring(0, 6),
        A1_COD: String(FormData.CodTOTVs).trim().substring(0, 50),
        A1_LOJA: String(FormData.LojaTOTVs).trim().substring(0, 2),
        M0_CODFIL: String(FormData.Filial).trim().substring(0, 12),
        GrupoVenda: String(FormData.Franqueado).trim().substring(0, 255),
        M0_FILIAL: String(FormData.RazaoSocial).trim().substring(0, 41),
        M0_CGC: String(FormData.CNPJ).trim().substring(0, 14),
        NREDUZ: String(FormData.NomeFantasia).trim().substring(0, 40),
        Inatv: null,
        Email: String(FormData.Email).trim().substring(0, 255),
        TUPP: null,
        Consultor: String(FormData.Consultor).trim().substring(0, 250),
        LimiteCredito: Number.parseFloat(String(FormData.Credito).trim().substring(0, 10)),
        LimExtraCredito: null,
        PDF: 'N',
        DtExtraCredito: null,
        QtEq_BQ: null,
        QtEq_SN: null,
        CNAE: String(FormData.CNAE).trim().substring(0, 7),
        DtEmissaoUltNF: null,
        M0_TIPO: 'S',
        EmiteNF: FormData.EmiteNF ? 'S' : 'N',
        NASAJON: 'S',
        Equip: 'N',
        Dominio: null,
        CPF1: null,
        CPF2: null,
        CPF3: null,
        STATUS: 'MANTER',
        UF: String(FormData.UF).trim().substring(0, 2),
        VlrMinCompra: FormData.minCompra === 0 ? 0 : FormData.minCompra === 50 ? 600 : FormData.minCompra === 100 ? 1200 : null,
        Retira: FormData.retira ? 'S' : 'N',
        NroFranquias: null,
        MaxLeads: 5,
        Confiavel: FormData.confiavel,
        CondPag: String(FormData.CondPag).trim().substring(0, 6),
        DtCadastro: new Date()
      }).into('dbo.FilialEntidadeGrVenda')

      await Database.insert({
        M0_CODIGO: '01',
        M0_EmiteNF: FormData.EmiteNF ? 'S' : 'N',
        M0_CODFIL: String(FormData.Filial).trim().substring(0, 12),
        M0_TIPO: 'S',
        M0_FILIAL: String(FormData.NomeFantasia).trim().substring(0, 41),
        M0_NOME: 'Grupo Elleva',
        M0_NOMECOM: String(FormData.RazaoSocial).trim().substring(0, 60),
        M0_ENDCOB: String(FormData.Logradouro).trim().substring(0, 60),
        M0_CIDCOB: String(FormData.Municipio).trim().substring(0, 60),
        M0_ESTCOB: String(FormData.UF).trim().substring(0, 2),
        M0_CEPCOB: String(FormData.CEP).trim().substring(0, 8),
        M0_ENDENT: String(FormData.Logradouro).trim().substring(0, 60),
        M0_CIDENT: String(FormData.Municipio).trim().substring(0, 60),
        M0_ESTENT: String(FormData.UF).trim().substring(0, 2),
        M0_CEPENT: String(FormData.CEP).trim().substring(0, 8),
        M0_CGC: String(FormData.CNPJ).trim().substring(0, 14),
        M0_INSC: String(FormData.IE).trim().substring(0, 14),
        M0_TEL: String(FormData.TelCel).trim().substring(0, 14),
        M0_BAIRCOB: String(FormData.Bairro).trim().substring(0, 35),
        M0_BAIRENT: String(FormData.Bairro).trim().substring(0, 35),
        M0_COMPCOB: String(FormData.Complemento).trim().substring(0, 25),
        M0_COMPENT: String(FormData.Complemento).trim().substring(0, 25),
        M0_TPINSC: 2,
        M0_CNAE: String(FormData.CNAE).trim().substring(0, 7),
        M0_FPAS: String(FormData.FPAS).trim().substring(0, 4),
        M0_CODMUN: null,
        M0_NATJUR: String(FormData.NATJUR).trim().substring(0, 4),
        M0_NIRE: String(FormData.NIRE).trim().substring(0, 4),
      }).into('dbo.SIGAMAT')

      await Database.insert({
        TopeCod: 3,
        M0_CODFIL: String(FormData.Filial).trim().substring(0, 12),
        GrpVen: String(FormData.GrpVen).trim().substring(0, 6),
        OperNome: String(FormData.Franqueado).trim().substring(0, 100),
      }).into('dbo.Operador')

      await Database.insert({
        GrpVen: String(FormData.GrpVen).trim().substring(0, 6),
        M0_CODFIL: String(FormData.Filial).trim().substring(0, 12),
        Senha: String(FormData.Senha).trim().substring(0, 6),
      }).into('dbo.FilialAcesso')

      await Database.insert({
        GrpVen: String(FormData.GrpVen).trim().substring(0, 6),
        ParamId: 'IMPOSTOS',
        ParamTxt: 'PERCENTUAL',
        ParamVlr: 0.06
      }).into('dbo.Parametros')

      await Database.insert({
        GrpVen: String(FormData.GrpVen).trim().substring(0, 10),
        CNPJn: Number(FormData.CNPJ),
        A1_COD: String(FormData.CodTOTVs).trim().substring(0, 10),
        A1_LOJA: String(FormData.LojaTOTVs).trim().substring(0, 10),
        CNPJ: String(FormData.CNPJ).trim().substring(0, 14),
        CNPJss: FormData.CNPJss,
        Nome_Fantasia: String(FormData.NomeFantasia).trim().substring(0, 255),
        Razão_Social: String(FormData.RazaoSocial).trim().substring(0, 255),
        IE: String(FormData.IE).trim().substring(0, 20),
        Logradouro: String(FormData.Logradouro).trim().substring(0, 255),
        Número: '',
        Complemento: String(FormData.Complemento).trim().substring(0, 255),
        Bairro: String(FormData.Bairro).trim().substring(0, 255),
        CEP: String(FormData.CEP).trim().substring(0, 9),
        Município: String(FormData.Municipio).trim().substring(0, 255),
        UF: String(FormData.UF).trim().substring(0, 2),
        Contato_Empresa: String(FormData.Franqueado).trim().substring(0, 255),
        Email: String(FormData.Email).trim().substring(0, 255),
        DDD: '',
        Fone: String(FormData.TelCel).trim().substring(0, 12),
        A1_SATIV1: '000113',
        NIRE: Number(String(FormData.NIRE).trim().substring(0, 11)),
        FPAS: String(FormData.FPAS).trim().substring(0, 3),
        NIREDt: null,
        DtSolicita: new Date(),
        DtCadastro: new Date(),
        TPessoa: String(FormData.Tipo).trim().substring(0, 1),
        A1Tipo: 'R',
        TipoLogradouro: null,
        Ibge: null,
        ClienteStatus: 'A'
      }).into('dbo.Cliente')

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'FranquiasController.Store',
      })
    }
  }
}

module.exports = FranquiasController;

const QUERY_TODAS_FILIAIS = "select A1_GRPVEN, A1_COD, M0_CODFIL, GrupoVenda, M0_FILIAL, M0_CGC, NREDUZ, Inatv, Consultor, UF, DtCadastro from dbo.FilialEntidadeGrVenda where A1_GRPVEN <> '990201' and A1_GRPVEN <> '990203' and A1_GRPVEN <> '000000' order by M0_CODFIL"