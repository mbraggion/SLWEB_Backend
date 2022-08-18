"use strict";

const Database = use("Database");
const moment = require("moment");
const Helpers = use("Helpers");
const Drive = use("Drive");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")
const GerarExcel = require("../../../Services/excelExportService");

class DreController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const refs = await Database.select('*').from('dbo.Referencia').orderBy('Refdt', 'desc')

      response.status(200).send({
        Referencias: refs
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'DreController.Show',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const ano = params.ano
    const mes = params.mes

    try {
      const verified = seeToken(token);

      const formatedTargetRef = moment().set('year', ano).set('month', mes - 1).startOf('month').subtract(3, 'hours').toDate()

      const genDRE = await Database.raw(
        "execute dbo.GerarDRE @GrpVen = ?, @Ano = ?, @Mes = ?",
        [verified.grpven, ano, mes]
      )

      let TemDre = await Database.select('*').from('dbo.DRE').where({
        GrpVen: verified.grpven,
        DReRef: formatedTargetRef,
      })

      let DreJaGravado = []

      if (TemDre.length > 0) {
        for (let i = 0; i < genDRE.length; i++) {
          await Database.table("dbo.DRE")
            .where({
              DreCod: genDRE[i].DreCod,
              GrpVen: verified.grpven,
              DReRef: formatedTargetRef
            })
            .update({
              DreVlr: genDRE[i].DreVlr !== null ? genDRE[i].DreVlr : 0,
              DrePorc: genDRE[i].DrePorc !== null ? genDRE[i].DrePorc : 0
            });
        }

        DreJaGravado = genDRE
      } else {
        for (let i = 0; i < genDRE.length; i++) {
          await Database.insert({
            GrpVen: verified.grpven,
            DReRef: formatedTargetRef,
            DreCod: genDRE[i].DreCod,
            DreDesc: genDRE[i].DreDesc,
            DreTipo: null,
            DreVlr: 0,
            DrePorc: 0
          }).into('dbo.DRE')
        }

        DreJaGravado = await Database.raw(
          "execute dbo.GerarDRE @GrpVen = ?, @Ano = ?, @Mes = ?",
          [verified.grpven, ano, mes]
        )
      }

      const DovJaGravado = await Database.select('*').from('dbo.DOV').where({
        GrpVen: verified.grpven,
        DOVRef: formatedTargetRef,
      })

      response.status(200).send({
        DRE: DreJaGravado,
        DOV: DovJaGravado,
        Type: 'Gerado'
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'DreController.See',
      })
    }
  }

  async UpdateDRE({ request, response }) {
    const token = request.header("authorization");
    const { ano, mes, cod, vlr, porc } = request.only(['ano', 'mes', 'cod', 'vlr', 'porc'])

    const verified = seeToken(token);
    const formatedTargetRef = moment().set('year', ano).set('month', mes - 1).startOf('month').subtract(3, 'hours').toDate()

    try {
      await Database.table("dbo.DRE")
        .where({
          DreCod: cod,
          GrpVen: verified.grpven,
          DReRef: formatedTargetRef
        })
        .update({
          DreVlr: vlr,
          DrePorc: porc
        });

      const genDRE = await Database.raw(
        "execute dbo.GerarDRE @GrpVen = ?, @Ano = ?, @Mes = ?",
        [verified.grpven, ano, mes]
      )

      const DovJaGravado = await Database.select('*').from('dbo.DOV').where({
        GrpVen: verified.grpven,
        DOVRef: formatedTargetRef,
      })

      response.status(200).send({
        DRE: genDRE,
        DOV: DovJaGravado,
        Type: 'Gerado'
      });
    } catch (err) {
      const subDRE = await Database.raw("execute dbo.GerarDRE @GrpVen = ?, @Ano = ?, @Mes = ?", [verified.grpven, ano, mes])
      const subDOV = await Database.select('*').from('dbo.DOV').where({ GrpVen: verified.grpven, DOVRef: formatedTargetRef, })

      response.status(400).send({
        DRE: subDRE,
        DOV: subDOV,
        Type: 'Gerado'
      });

      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'DreController.UpdateDRE',
      })
    }
  }

  async UpdateDOV({ request, response }) {
    const token = request.header("authorization");
    const { ano, mes, cod, vlr, desc } = request.only(['ano', 'mes', 'cod', 'vlr', 'desc'])

    const verified = seeToken(token);
    const formatedTargetRef = moment().set('year', ano).set('month', mes - 1).startOf('month').subtract(3, 'hours').toDate()

    try {

      const jaTemODOV = await Database
        .select('*')
        .from('dbo.DOV')
        .where({
          GrpVen: verified.grpven,
          DOVRef: formatedTargetRef,
          DOVCod: cod
        })

      if (jaTemODOV.length > 0) {
        await Database.table("dbo.DOV")
          .where({
            GrpVen: verified.grpven,
            DOVRef: formatedTargetRef,
            DOVCod: cod
          })
          .update({
            DOVDesc: desc,
            DOVVlr: vlr
          });
      } else {
        await Database.insert({
          GrpVen: verified.grpven,
          DOVRef: formatedTargetRef,
          DOVCod: cod,
          DOVDesc: desc,
          DOVTipo: null,
          DOVVlr: vlr
        }).into('dbo.DOV')
      }

      const genDRE = await Database.raw(
        "execute dbo.GerarDRE @GrpVen = ?, @Ano = ?, @Mes = ?",
        [verified.grpven, ano, mes]
      )

      const DovJaGravado = await Database.select('*').from('dbo.DOV').where({
        GrpVen: verified.grpven,
        DOVRef: formatedTargetRef,
      })

      response.status(200).send({
        DRE: genDRE,
        DOV: DovJaGravado,
        Type: 'Gerado'
      });
    } catch (err) {
      const subDRE = await Database.raw("execute dbo.GerarDRE @GrpVen = ?, @Ano = ?, @Mes = ?", [verified.grpven, ano, mes])
      const subDOV = await Database.select('*').from('dbo.DOV').where({ GrpVen: verified.grpven, DOVRef: formatedTargetRef, })

      response.status(400).send({
        DRE: subDRE,
        DOV: subDOV,
        Type: 'Gerado'
      });

      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'DreController.UpdateDOV',
      })
    }
  }

  async GenExcelBaseRoyalties({ request, response, params }) {
    const token = request.header("authorization");
    const ano = params.ano
    const mes = params.mes
    let objToExcel = [
      {
        workSheetName: null,
        workSheetColumnNames: null,
        workSheetData: null,
      }
    ]

    try {
      const verified = seeToken(token);
      const filePath = Helpers.publicPath(`/tmp/base_${verified.user_code}_${ano}_${mes}_${new Date().getTime()}.xlsx`);

      const jaTemBaseRoy = await Database
        .select('*')
        .from('dbo.BaseRoy')
        .where({
          GrpVen: verified.grpven,
          Ano: ano,
          Mes: mes
        })

      let roy = []

      if (jaTemBaseRoy.length > 0) {
        roy = await Database.raw(QUERY_ROY_JA_LANCADO, [ano, mes, verified.user_code])
      } else {
        roy = await Database.raw(QUERY_ROY_NAO_LANCADO, [verified.grpven, ano, mes])
      }

      objToExcel[0].workSheetColumnNames = jaTemBaseRoy.length > 0 ? ['DtEmissao', 'Razão_Social', 'DOC', 'D_Item', 'ProdId', 'Produto', 'Qtd', 'QtdOK', 'PvnRoy', 'VlrMin', 'Vlr', 'TotalVenda', 'TotalCorrigido'] : ['DataCriacao', 'RazãoSocial', 'Pedido-NF', 'Serie', 'PVSDesc', 'PvdID', 'ProdId', 'Produto', 'PvdQtd', 'Vlr', 'VlrRoy', 'PvdVlrUnit', 'ProdRoy', 'PrVenda']
      objToExcel[0].workSheetData = roy.map(r => Object.values(r))
      objToExcel[0].workSheetName = `Base Royalties ${ano}_${mes}`

      await GerarExcel(
        objToExcel,
        filePath
      )

      const location = await Drive.get(filePath);

      response.status(200).send(location);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'DreController.GenExcelBaseRoyalties',
      })
    }
  }

  async GenExcelDRE({ request, response, params }) {
    const token = request.header("authorization");
    const ano = params.ano
    const mes = params.mes
    let objToExcel = [
      {
        workSheetName: null,
        workSheetColumnNames: null,
        workSheetData: null,
      }
    ]
    const formatedTargetRef = moment().set('year', ano).set('month', mes - 1).startOf('month').subtract(3, 'hours').toDate()

    try {
      const verified = seeToken(token);
      const filePath = Helpers.publicPath(`/tmp/DRE_${verified.user_code}_${ano}_${mes}_${new Date().getTime()}.xlsx`);

      const genDRE = await Database.raw(
        "execute dbo.GerarDRE @GrpVen = ?, @Ano = ?, @Mes = ?",
        [verified.grpven, ano, mes]
      )

      const DovJaGravado = await Database.select('DOVCod', 'DOVDesc', 'DOVVlr').from('dbo.DOV').where({
        GrpVen: verified.grpven,
        DOVRef: formatedTargetRef,
      })

      const concatDREeDOV = [
        ...genDRE.map(r => Object.values({
          ...r,
          DreVlr: new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(r.DreVlr),
          DrePorc: String(Number(r.DrePorc * 100).toFixed(2)) + '%'
        })),
        ['', '', '', ''],
        ...DovJaGravado.map(r => Object.values({
          DOVCod: r.DOVCod,
          DOVDesc: r.DOVDesc,
          DOVVlr: new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(r.DOVVlr),
          DOVPorc: String(0) + '%'
        }))
      ]

      objToExcel[0].workSheetColumnNames = ['Item', 'Descrição', 'Valor(R$)', 'Porcentagem(%)']
      objToExcel[0].workSheetData = concatDREeDOV
        objToExcel[0].workSheetName = `DRE ${ano}_${mes}`

      await GerarExcel(
        objToExcel,
        filePath
      )

      const location = await Drive.get(filePath);

      response.status(200).send(location);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err,
        handler: 'DreController.GenExcelDRE',
      })
    }
  }
}

module.exports = DreController;

const QUERY_ROY_JA_LANCADO = "SELECT dbo.BaseRoyDet.DtEmissao, dbo.Cliente.Razão_Social, dbo.BaseRoyDet.DOC, dbo.BaseRoyDet.D_Item, dbo.BaseRoyDet.ProdId, dbo.BaseRoyDet.Produto, dbo.BaseRoyDet.D_QUANT AS Qtd, dbo.BaseRoyDet.QtdOK, dbo.BaseRoyDet.PvnRoy, dbo.BaseRoyDet.VENVLR AS VlrMin, dbo.BaseRoyDet.D_PRCVEN AS Vlr, dbo.BaseRoyDet.D_TOTAL AS TotalVenda, dbo.BaseRoyDet.Total AS TotalCorrigido FROM ( dbo.PedidosVendaCab INNER JOIN dbo.BaseRoyDet ON ( dbo.BaseRoyDet.SERIE = dbo.PedidosVendaCab.PvcSerie ) AND ( dbo.BaseRoyDet.DOC = dbo.PedidosVendaCab.PvcID ) AND ( dbo.PedidosVendaCab.Filial = dbo.BaseRoyDet.M0_CODFIL ) ) INNER JOIN dbo.Cliente ON ( dbo.PedidosVendaCab.CNPJ = dbo.Cliente.CNPJ ) AND ( dbo.PedidosVendaCab.GrpVen = dbo.Cliente.GrpVen ) WHERE ( ((dbo.BaseRoyDet.Ano) = ?) AND ((dbo.BaseRoyDet.Mes) = ?) AND ((dbo.BaseRoyDet.M0_CODFIL) = ?) ) ORDER BY dbo.BaseRoyDet.DtEmissao, dbo.BaseRoyDet.DOC, dbo.BaseRoyDet.D_Item;"
const QUERY_ROY_NAO_LANCADO = "SELECT Vc.DataCriacao, Trim([Razão_Social]) AS RazãoSocial, IIf([Vc].[NroNF] Is Null, [Vc].[PvcID], [NroNF]) AS [Pedido-NF], IIf([Vc].[SerieNF] Is Null, [Vc].[PvcSerie], [SerieNF]) AS Serie, dbo.PVStatus.PVSDesc, Vd.PvdID, Vd.ProdId, dbo.Produtos.Produto, Vd.PvdQtd, Vd.PvdVlrTotal AS Vlr, IIf( [PrVenda] <> 0, ([PvdQtd] * PrVenda), ([PvdQtd] * PvdVlrUnit) ) AS VlrRoy, Vd.PvdVlrUnit, dbo.Produtos.ProdRoy, dbo.Produtos.PrVenda FROM ( ( dbo.PVStatus INNER JOIN ( dbo.PedidosVendaCab AS Vc INNER JOIN dbo.PedidosVendaDet AS Vd ON (Vc.GrpVen = Vd.GrpVen) AND (Vc.PvcSerie = Vd.PvcSerie) AND (Vc.PvcID = Vd.PvcID) ) ON dbo.PVStatus.PVSCod = Vc.STATUS ) INNER JOIN dbo.Produtos ON Vd.ProdId = dbo.Produtos.ProdId ) LEFT JOIN dbo.Cliente ON (Vc.CNPJ = dbo.Cliente.CNPJ) AND (Vc.GrpVen = dbo.Cliente.GrpVen) WHERE ( ((Vc.GrpVen) = ?) AND ( (Vc.PvTipo) = 'V' Or (Vc.PvTipo) Is Null ) AND ((Year(Vc.DataCriacao)) = ?) AND ((Month(Vc.DataCriacao)) = ?) AND ((dbo.PVStatus.DRE) = 'S') ) ORDER BY Vc.DataCriacao, IIf([Vc].[NroNF] Is Null, [Vc].[PvcID], [NroNF]), Vd.PvdID;"