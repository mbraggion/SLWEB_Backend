"use strict";

const Database = use("Database");
const Env = use("Env");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")
const { spawn } = require('child_process');

class PedidosDeCompra {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Show({ request, response, params }) {
    const token = request.header("authorization");
    const timediff = params.diff;
    let diffConverted = 0

    try {
      switch (timediff) {
        case 'today':
          diffConverted = 1
          break
        case 'week':
          diffConverted = 7
          break
        case 'month':
          diffConverted = 30
          break
      }

      let pedidosDeCompraEmAberto = await Database.raw(QUERY_PEDIDOS_DE_COMPRA_EM_ABERTO, [diffConverted])

      for (let i = 0; i < pedidosDeCompraEmAberto.length; i++) {
        let d = await Database.raw("select PedidoItemID, CodigoProduto, Produto, QtdeVendida, PrecoUnitarioLiquido, PrecoTotal from dbo.PedidosVenda left join dbo.Produtos on dbo.PedidosVenda.CodigoProduto = dbo.Produtos.ProdId where Filial = '0201' and PedidoID = ? order by PedidoItemID ASC", [pedidosDeCompraEmAberto[i].PedidoID])

        pedidosDeCompraEmAberto[i] = {
          ...pedidosDeCompraEmAberto[i],
          Detalhes: d
        }
      }

      //let transportadoras = await Database.raw('select A4_COD, A4_NREDUZ from SLCafes.SDBP12.dbo.SA4010 ')
      let transportadoras = await Database.raw('select A4_COD, A4_NREDUZ from ' + Env.get('SLCAFES_SDBP12') + '.dbo.SA4010 ')

      

      response.status(200).send({
        Pedidos: pedidosDeCompraEmAberto,
        Transportadoras: transportadoras
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeCompra.Show',
      })
    }
  }

  async Update({ request, response }) {
    const token = request.header("authorization");
    const { payload } = request.only(['payload'])

    try {
      //verificar se o pedido ainda não foi faturado
      const jaFoiProcessado = await Database
        .select('PedidoID')
        .from('dbo.PedidosVenda')
        .where({
          PedidoID: payload.ID,
          CodigoTotvs: null
        })

      if (jaFoiProcessado.length < 1) {
        response.status(400).send('pedido já processado')
        return
      }

      //fazer update aqui
      await Database.table("dbo.PedidosVenda")
        .where({
          PedidoID: payload.ID,
          CodigoTotvs: null,
        })
        .update({
          TipoVolume: payload.Tipo,
          QtdVolumes: payload.Qtd,
          EMISS: payload.Emissao,
          Transportadora: payload.Transportadora,
          DataEntrega: payload.Faturamento,
          Peso: payload.Peso,
          MsgNotaFiscal: payload.MsgNFe
        });

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeCompra.Update',
      })
    }
  }

  async Integrar({ request, response }) {
    const token = request.header("authorization");

    try {
      var ls = spawn(Env.get('BAT_INTEGRACAO_DOCDIR'))

      // ls.stdout.on('data', function (data) {
      //   console.log('execução: ' + data);
      // })

      ls.stderr.on('data', function (data) {
        console.log('erro na execução do job de compras: ' + data);
      })

      // ls.on('exit', function (code) {
      //   console.log('child process exited with code: ' + code);
      // })

      response.status(200).send()
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'PedidosDeCompra.Integrar',
      })
    }
  }
}

module.exports = PedidosDeCompra;

const QUERY_PEDIDOS_DE_COMPRA_EM_ABERTO = "SELECT dbo.FilialEntidadeGrVenda.UF, dbo.PedidosVenda.Filial, dbo.PedidosVenda.CodigoCliente, dbo.Cliente.Razão_Social, dbo.PedidosVenda.LojaCliente, dbo.PedidosVenda.PedidoID, IIF( dbo.PedidosVenda.CodigoTotvs is null, 'Aguardando', 'Processado' ) as Status, dbo.PedidosVenda.MsgBO, dbo.PedidosVenda.MsgNotaFiscal, dbo.PedidosVenda.MsgPadrao, dbo.PedidosVenda.TipoVolume, dbo.PedidosVenda.QtdVolumes, dbo.PedidosVenda.Peso, dbo.PedidosVenda.Transportadora, Count(dbo.PedidosVenda.PedidoItemID) AS ContarDePedidoItemID, dbo.PedidosVenda.DataCriacao, dbo.PedidosVenda.DataEntrega, dbo.PedidosVenda.EMISS, Max(dbo.PedidosVenda.TES) AS MáxDeTES, Sum(dbo.PedidosVenda.PrecoTotal) AS SomaDePrecoTotal FROM dbo.PedidosVenda INNER JOIN dbo.FilialEntidadeGrVenda ON dbo.PedidosVenda.Filial = dbo.FilialEntidadeGrVenda.M0_CODFIL LEFT JOIN dbo.Cliente on dbo.PedidosVenda.CodigoCliente = dbo.Cliente.A1_COD and dbo.PedidosVenda.LojaCliente = dbo.Cliente.A1_LOJA and dbo.PedidosVenda.GrpVen = dbo.Cliente.GrpVen WHERE DATEDIFF(D, dbo.PedidosVenda.DataCriacao, GETDATE()) <= ? GROUP BY dbo.FilialEntidadeGrVenda.UF, dbo.PedidosVenda.STATUS, dbo.FilialEntidadeGrVenda.NASAJON, dbo.PedidosVenda.Filial, dbo.PedidosVenda.CodigoCliente, dbo.PedidosVenda.LojaCliente, dbo.PedidosVenda.PedidoID, dbo.PedidosVenda.CodigoTotvs, dbo.PedidosVenda.MsgBO, dbo.PedidosVenda.DataCriacao, dbo.PedidosVenda.DataEntrega, dbo.PedidosVenda.DataIntegracao, dbo.PedidosVenda.EMISS, dbo.PedidosVenda.MsgNotaFiscal, dbo.PedidosVenda.MsgPadrao, dbo.PedidosVenda.TipoVolume, dbo.Cliente.Razão_Social, dbo.PedidosVenda.QtdVolumes, dbo.PedidosVenda.Peso, dbo.PedidosVenda.Transportadora, dbo.PedidosVenda.SERIE, dbo.PedidosVenda.EMISS HAVING ( ( (dbo.PedidosVenda.STATUS) Is Null and dbo.FilialEntidadeGrVenda.NASAJON = 'N' ) ) ORDER BY dbo.PedidosVenda.DataCriacao DESC"