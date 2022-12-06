"use strict";
const Database = use("Database");
const Drive = use("Drive");
const jwt = require("jsonwebtoken");
const { seeToken } = require('../../../Services/jwtServices')
const { spawn } = require('child_process');
const Helpers = use("Helpers");

const logger = require("../../../../dump/index")

class AwsController {
  async Show({ request, response, params }) {
    const token = request.header("authorization");
    const filetype = params.type
    let file = null

    try {
      const verified = seeToken(token);

      if (filetype === 'ovpn') {
        const nomeOVPN = `Pilao_${verified.user_code}_Pilao.ovpn`

        file = await Drive.get(`\\\\192.168.1.250\\dados\\SLTEC\\NUVEM\\VPN\\${nomeOVPN}`)
      } else if (filetype === 'pritunl') {
        file = await Drive.get(`\\\\192.168.1.250\\dados\\SLTEC\\NUVEM\\Pritunl.exe`)
      }

      response.status(200).send(file);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'AwsController.Show',
      })
    }
  }

  async See({ request, response }) {
    const token = request.header("authorization");
    const verified = seeToken(token);

    try {
      const awsData = await Database
        .select('VPN_pin')
        .from('dbo.AcessosAWS')
        .where({
          Filial: verified.user_code
        })

      response.status(200).send({
        vpn_pin: awsData[0] ? awsData[0].VPN_pin : null
      })
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'AwsController.See',
      })
    }
  }

  async GatoCompras({ response }) {
    try {
      let pedidosPendentesNaAWS = await Database.connection("mssql").raw("SELECT * FROM dbo.PedidosVenda WHERE CodigoTotvs is null and STATUS is null and Filial = '0201' and DataCriacao >= '2022-11-03 00:00:00.000'")
      let pedidosPendentesNaAWSMasQueJaSubiramPraPilao = []
      let pedidosPendentesNaAWSEForaDaPilao = []

      let contInsert = 0
      let contUpdate = 0

      for (let index in pedidosPendentesNaAWS) {
        let info = await Database.connection("old_mssql").raw("SELECT * FROM dbo.PedidosVenda WHERE PedidoID = ? and PedidoItemID = ?", [pedidosPendentesNaAWS[index].PedidoID, pedidosPendentesNaAWS[index].PedidoItemID])

        if (info.length === 0) {
          pedidosPendentesNaAWSEForaDaPilao.push(pedidosPendentesNaAWS[index])

          // fazer insert na Pilao aqui
          try {
            await Database
              .connection("old_mssql")
              .insert({
                Filial: pedidosPendentesNaAWS[index].Filial,
                PedidoID: pedidosPendentesNaAWS[index].PedidoID,
                PedidoItemID: pedidosPendentesNaAWS[index].PedidoItemID,
                CodigoCliente: pedidosPendentesNaAWS[index].CodigoCliente,
                LojaCliente: pedidosPendentesNaAWS[index].LojaCliente,
                CodigoDL: pedidosPendentesNaAWS[index].CodigoDL,
                LojaDL: pedidosPendentesNaAWS[index].LojaDL,
                CodigoTabelaPreco: pedidosPendentesNaAWS[index].CodigoTabelaPreco,
                CodigoVendedor: pedidosPendentesNaAWS[index].CodigoVendedor,
                CodigoCondicaoPagto: pedidosPendentesNaAWS[index].CodigoCondicaoPagto,
                TipoFrete: pedidosPendentesNaAWS[index].TipoFrete,
                MsgNotaFiscal: pedidosPendentesNaAWS[index].MsgNotaFiscal,
                MsgPadrao: pedidosPendentesNaAWS[index].MsgPadrao,
                DataEntrega: pedidosPendentesNaAWS[index].DataEntrega,
                CodigoProduto: pedidosPendentesNaAWS[index].CodigoProduto,
                QtdeVendida: pedidosPendentesNaAWS[index].QtdeVendida,
                PrecoUnitarioLiquido: pedidosPendentesNaAWS[index].PrecoUnitarioLiquido,
                PrecoTotal: pedidosPendentesNaAWS[index].PrecoTotal,
                Limite: pedidosPendentesNaAWS[index].Limite,
                CodigoTotvs: pedidosPendentesNaAWS[index].CodigoTotvs,
                DataCriacao: pedidosPendentesNaAWS[index].DataCriacao,
                DataIntegracao: pedidosPendentesNaAWS[index].DataIntegracao,
                GrpVen: pedidosPendentesNaAWS[index].GrpVen,
                MsgBO: pedidosPendentesNaAWS[index].MsgBO,
                TipOp: pedidosPendentesNaAWS[index].TipOp,
                TES: pedidosPendentesNaAWS[index].TES,
                NATUREZA: pedidosPendentesNaAWS[index].NATUREZA,
                STATUS: pedidosPendentesNaAWS[index].STATUS,
                CFO: pedidosPendentesNaAWS[index].CFO,
                SERIE: pedidosPendentesNaAWS[index].SERIE,
                EMISS: pedidosPendentesNaAWS[index].EMISS,
                CNPJi: pedidosPendentesNaAWS[index].CNPJi,
                VlrDesconto: pedidosPendentesNaAWS[index].VlrDesconto,
                Peso: pedidosPendentesNaAWS[index].Peso,
                QtdVolumes: pedidosPendentesNaAWS[index].QtdVolumes,
                TipoVolume: pedidosPendentesNaAWS[index].TipoVolume,
                Transportadora: pedidosPendentesNaAWS[index].Transportadora
              }).into('dbo.PedidosVenda')

            contInsert = contInsert + 1

          } catch (err) {
            console.log({
              message: `Falha no insert do item ${pedidosPendentesNaAWS[index].PedidoItemID} pedido ${pedidosPendentesNaAWS[index].PedidoID} dentro da base da Pilão`,
              error: err.message
            })
          }

        } else {
          pedidosPendentesNaAWSMasQueJaSubiramPraPilao.push(info[0])

          // fazer upd na aws aqui
          try {
            await Database
              .connection("mssql")
              .table('dbo.PedidosVenda')
              .where({
                PedidoItemID: info[0].PedidoItemID,
                PedidoID: info[0].PedidoID
              })
              .update({
                Filial: info[0].Filial,
                PedidoID: info[0].PedidoID,
                PedidoItemID: info[0].PedidoItemID,
                CodigoCliente: info[0].CodigoCliente,
                LojaCliente: info[0].LojaCliente,
                CodigoDL: info[0].CodigoDL,
                LojaDL: info[0].LojaDL,
                CodigoTabelaPreco: info[0].CodigoTabelaPreco,
                CodigoVendedor: info[0].CodigoVendedor,
                CodigoCondicaoPagto: info[0].CodigoCondicaoPagto,
                TipoFrete: info[0].TipoFrete,
                MsgNotaFiscal: info[0].MsgNotaFiscal,
                MsgPadrao: info[0].MsgPadrao,
                DataEntrega: info[0].DataEntrega,
                CodigoProduto: info[0].CodigoProduto,
                QtdeVendida: info[0].QtdeVendida,
                PrecoUnitarioLiquido: info[0].PrecoUnitarioLiquido,
                PrecoTotal: info[0].PrecoTotal,
                Limite: info[0].Limite,
                CodigoTotvs: info[0].CodigoTotvs,
                DataCriacao: info[0].DataCriacao,
                DataIntegracao: info[0].DataIntegracao,
                GrpVen: info[0].GrpVen,
                MsgBO: info[0].MsgBO,
                TipOp: info[0].TipOp,
                TES: info[0].TES,
                NATUREZA: info[0].NATUREZA,
                STATUS: info[0].STATUS,
                CFO: info[0].CFO,
                SERIE: info[0].SERIE,
                EMISS: info[0].EMISS,
                CNPJi: info[0].CNPJi,
                VlrDesconto: info[0].VlrDesconto,
                Peso: info[0].Peso,
                QtdVolumes: info[0].QtdVolumes,
                TipoVolume: info[0].TipoVolume,
                Transportadora: info[0].Transportadora
              })

            contUpdate = contUpdate + 1

          } catch (err) {
            console.log({
              message: `Falha no update do item ${info[0].PedidoItemID} pedido ${info[0].PedidoID} dentro da base da AWS`,
              error: err.message
            })
          }

        }
      }

      if (contInsert > 0) {
        // await Database.connection("mssql").raw("INSERT INTO SLCafes.SLAPLIC.dbo.PedidosCompraCab ( [GrpVen], [PedidoId], [STATUS], [Filial], [CpgId], [DataCriacao], [DataIntegracao], [NroNF], [SerieNF], [DtEmissNF], [ChaveNF], [MsgNF], [C5NUM] ) SELECT * from dbo.PedidosCompraCab where dbo.PedidosCompraCab.PedidoId not in ( select PedidoId from SLCafes.SLAPLIC.dbo.PedidosCompraCab )")

        var ls = spawn(Helpers.publicPath('Carga_Pedidos_Compra_Para_TOTVs.bat'))

        ls.stdout.on('data', function (data) {
          console.log('execução: ' + data);
        })

        ls.stderr.on('data', function (data) {
          console.log('erro: ' + data);
        })

        ls.on('exit', function (code) {
          console.log('child process exited with code: ' + code);
        })
      }

      response.status(200).send({
        pedidosPendentesNaAWS: pedidosPendentesNaAWS,
        pedidosPendentesNaAWSMasQueJaSubiramPraPilao: pedidosPendentesNaAWSMasQueJaSubiramPraPilao,
        pedidosPendentesNaAWSEForaDaPilao: pedidosPendentesNaAWSEForaDaPilao,
        linhasInseridasNaBasePilao: contInsert,
        linhasAtualizadasNaBaseAWS: contUpdate,
      })
    } catch (err) {
      response.status(400).send({
        error: err.message
      })
    }
  }

  async GatoLeituras({ response }) {
    try {
      // executar proc no 248
      await Database.connection("old_mssql").raw("execute dbo.sp_SLTELLeituraApp")

      // copiar leituras pra aws
      await Database.connection("mssql").raw("insert into SLAPLIC.dbo.SLTELLeitura select * from SLCafes.SLAPLIC.dbo.SLTELLeitura where LeituraId not in ( select LeituraId from SLAPLIC.dbo.SLTELLeitura )")

      response.status(200).send()
    } catch (err) {
      response.status(400).send({
        error: err.message
      })
    }
  }

  async temp({ response }) {
    try {

      response.status(200).send()
    } catch (err) {
      response.status(400).send({ message: err.message })
    }
  }
}

module.exports = AwsController;
