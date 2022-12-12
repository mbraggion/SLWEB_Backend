"use strict";

const Database = use("Database");

const logger = require("../../../../dump/index")

class FranquiasController {
  async Show({ request, response }) {
    try {
      const filiais = await Database.raw(QUERY_TODAS_FILIAIS)

      response.status(200).send(filiais);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'FranquiasController.Show',
      })
    }
  }

  async See({ request, response, params }) {
    const grpven = params.grpven

    try {
      const FEGV = await Database.raw(QUERY_FEGV, [grpven])

      if (FEGV.length === 0) throw new Error('Franquia não consta em FEGV')

      const FranqEEmpresa = await Database.raw(QUERY_FEE, [FEGV[0].A1_COD, grpven])

      const Franqueados = FranqEEmpresa.filter(f => f.A1_SATIV1 === '000113' && f.TPessoa === 'F')
      const Empresa = FranqEEmpresa.filter(f => f.A1_SATIV1 === '000113' && f.TPessoa === 'J')

      const PF = Franqueados.map(f => ({
        Nome: f.Razão_Social,
        CPF: f.CNPJ,
        Email: f.Email,
        Telefone: `${f.DDD}${f.Fone}`,
        Logradouro: f.Logradouro,
        Numero: f.Número,
        Complemento: f.Complemento,
        Bairro: f.Bairro,
        CEP: f.CEP,
        Municipio: f.Município,
        UF: f.UF
      }))

      const PJ = Empresa.map(e => ({
        RazaoSocial: e.Razão_Social,
        CNPJ: e.CNPJ,
        Email: e.Email,
        Telefone: `${e.DDD}${e.Fone}`,
        Logradouro: e.Logradouro,
        Numero: e.Número,
        Complemento: e.Complemento,
        Bairro: e.Bairro,
        CEP: e.CEP,
        Municipio: e.Município,
        UF: e.UF
      }))

      const DIST_CLI = await Database.raw(QUERY_CLIENTES_DIST, [grpven])

      let DIST_EQ = await Database.raw(QUERY_EQUIPAMENTOS, [grpven, grpven, grpven])
      let LEIT_S = await Database.raw(QUERY_LEIT_STATUS, [grpven])

      const bloqueado = await Database.raw(QUERY_BLOQUEADO, [grpven])

      response.status(200).send({
        PF,
        PJ,
        FIN: {
          EmiteNF: FEGV[0].EmiteNF,
          Limite: FEGV[0].LimiteCredito,
          LimiteExtra: FEGV[0].LimExtraCredito,
          DtExtraConcedido: FEGV[0].DtExtraCredito,
          MinCompra: FEGV[0].VlrMinCompra,
          Confiavel: FEGV[0].Confiavel,
          PodeRetirar: FEGV[0].Retira,
          Bloqueado: bloqueado[0].Bloqueado,
          CondicaoPagPadrao: FEGV[0].CondPag
        },
        CAR: {
          Clientes: DIST_CLI,
          LimiteLeads: FEGV[0].MaxLeads,
          AtivosStatus: LEIT_S,
          AtivosDist: DIST_EQ
        },
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'FranquiasController.See',
      })
    }
  }

  async Store({ request, response }) {
    const { FormData } = request.only(["FormData"]);

    try {
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

      await Database.insert({
        GrpVen: String(FormData.GrpVen).trim().substring(0, 6),
        DepId: 1,
        DepNome: 'CENTRAL',
        DepTipo: null,
        Inativo: null,
        DepDL: null
      }).into('dbo.Deposito')

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'FranquiasController.Store',
      })
    }
  }
}

module.exports = FranquiasController;

const QUERY_TODAS_FILIAIS = "select A1_GRPVEN, A1_COD, M0_CODFIL, GrupoVenda, M0_FILIAL, M0_CGC, NREDUZ, Inatv, Consultor, UF, DtCadastro from dbo.FilialEntidadeGrVenda where A1_GRPVEN <> '990201' and A1_GRPVEN <> '990203' and A1_GRPVEN <> '000000' order by M0_CODFIL"
const QUERY_FEGV = "select Consultor, Inatv, [STATUS], A1_COD, MaxLeads, EmiteNF, LimiteCredito, LimExtraCredito, DtExtraCredito, VlrMinCompra, Confiavel, Retira, CondPag from dbo.FilialEntidadeGrVenda where A1_GRPVEN = ?"
const QUERY_FEE = "select Razão_Social, A1_SATIV1, CNPJ, Email, DDD, Fone, Logradouro, Número, Complemento, Bairro, CEP, Município, UF, TPessoa from dbo.Cliente where A1_COD = ? and GrpVen = ?"
const QUERY_CLIENTES_DIST = "select ClienteStatus as Status, COUNT(ClienteStatus) as Qtd from dbo.Cliente where GrpVen = ? group by ClienteStatus"
const QUERY_EQUIPAMENTOS = "select 'Max' as PdvStatus, COUNT(EquiCod) as Qtd from dbo.Equipamento where GrpVen = ? union select P.PdvStatus as E, COUNT(*) as Qtd from dbo.Equipamento as E left join ( SELECT dbo.PontoVenda.EquiCod, dbo.PontoVenda.PdvStatus, dbo.PontoVenda.DepId, dbo.Cliente.Nome_Fantasia, dbo.Cliente.CNPJss, dbo.PontoVenda.AnxId, dbo.PontoVenda.PdvId, dbo.Cliente.CNPJn, dbo.Deposito.DepNome FROM ( ( dbo.Cliente INNER JOIN dbo.Contrato ON (dbo.Cliente.CNPJ = dbo.Contrato.CNPJ) AND (dbo.Cliente.GrpVen = dbo.Contrato.GrpVen) ) INNER JOIN dbo.Anexos ON (dbo.Contrato.CNPJ = dbo.Anexos.CNPJ) AND (dbo.Contrato.ConId = dbo.Anexos.ConId) AND (dbo.Contrato.GrpVen = dbo.Anexos.GrpVen) ) INNER JOIN dbo.PontoVenda ON (dbo.Anexos.AnxId = dbo.PontoVenda.AnxId) AND (dbo.Anexos.GrpVen = dbo.PontoVenda.GrpVen) INNER JOIN dbo.Deposito on dbo.Deposito.DepId = dbo.PontoVenda.DepId and dbo.Deposito.GrpVen = dbo.PontoVenda.GrpVen WHERE ( ((dbo.Cliente.GrpVen) = ?) AND ((dbo.PontoVenda.PdvStatus) = 'A') ) ) as P on E.EquiCod = P.EquiCod where E.GrpVen = ? group by P.PdvStatus"
const QUERY_LEIT_STATUS = "select B.EquiCod, B.LeitOk, P.PdvLogradouroPV as Logradouro, P.PdvNumeroPV as Numero, P.PdvComplementoPV as Complemento, P.PdvBairroPV as Bairro, P.PdvCidadePV as Municipio, P.PdvUfPV as UF, P.PdvCEP as CEP from dbo.bogf_Leituras_QtdGrpT as B left join dbo.PontoVenda as P on P.EquiCod = B.EquiCod and P.PdvStatus = 'A' where B.GrpVen = ?"
const QUERY_BLOQUEADO = "SELECT IIF(SUM(SE1_GrpVen.E1_SALDO) > 0, 'S', 'N') as Bloqueado FROM ( SE1_GrpVen INNER JOIN SE1_Class ON (SE1_GrpVen.E1_PREFIXO = SE1_Class.E1_PREFIXO) AND (SE1_GrpVen.E1_TIPO = SE1_Class.E1_TIPO) ) LEFT JOIN dbo.SE1DtVenc ON SE1_GrpVen.DtVenc = dbo.SE1DtVenc.SE1DtVenc where SE1_GrpVen.GrpVen = ? and CAST(DtVenc as date) < CAST(GETDATE() as date) and (SE1_Class.E1Desc = 'Compra' or SE1_Class.E1Desc = 'Royalties')";
