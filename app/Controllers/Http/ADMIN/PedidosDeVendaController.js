
"use strict";

const Database = use("Database");
const Env = use("Env");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")
const { spawn } = require('child_process');

class PedidosDeVenda {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Show({ request, response, params }) {
    try {
      // const p = await Database
      //   .connection("pg")
      //   .select()
      //   .from()
      //   .where({});

      const pedidos = await Database.raw(QUERY_PEDIDOS_DE_VENDA_A_FATURAR)

      response.status(200).send({
        Pedidos: pedidos,
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'PedidosDeVenda.Show',
      })
    }
  }
}

module.exports = PedidosDeVenda;

const QUERY_PEDIDOS_DE_VENDA_A_FATURAR = "SELECT dbo.PedidosVenda.PedidoID, dbo.PedidosVenda.Filial, dbo.Cliente.Razão_Social as Cliente, dbo.PedidosVenda.CodigoCliente, dbo.PedidosVenda.LojaCliente, dbo.FilialEntidadeGrVenda.UF, Count(dbo.PedidosVenda.PedidoItemID) AS ItensNoPedido, Sum(dbo.PedidosVenda.PrecoTotal) AS ValorTotal, dbo.PedidosVenda.DataCriacao, Max(dbo.PedidosVenda.TES) AS MáxDeTES FROM dbo.PedidosVenda INNER JOIN dbo.FilialEntidadeGrVenda ON dbo.PedidosVenda.Filial = dbo.FilialEntidadeGrVenda.M0_CODFIL INNER JOIN dbo.Cliente on dbo.Cliente.A1_COD = dbo.PedidosVenda.CodigoCliente and dbo.Cliente.A1_LOJA = dbo.PedidosVenda.LojaCliente WHERE (((dbo.PedidosVenda.CodigoTotvs) Is Null) and NASAJON = 'S') GROUP BY dbo.PedidosVenda.PedidoID, dbo.PedidosVenda.Filial, dbo.Cliente.Razão_Social, dbo.PedidosVenda.CodigoCliente, dbo.PedidosVenda.LojaCliente, dbo.FilialEntidadeGrVenda.UF, dbo.PedidosVenda.DataCriacao, dbo.PedidosVenda.STATUS HAVING (((dbo.PedidosVenda.STATUS) Is Null)) ORDER BY dbo.PedidosVenda.DataCriacao DESC"