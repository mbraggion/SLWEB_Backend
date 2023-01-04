"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class ProfileController {
  /** @param {object} ctx
   * @param {import('@adonisjs/framework/src/Request')} ctx.request
   */
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const res = await Database.raw(
        "select * from dbo.FilialEntidadeGrVenda as F left join dbo.SIGAMAT as S on F.M0_CODFIL = S.M0_CODFIL inner join dbo.Parametros as P on P.GrpVen = F.A1_GRPVEN where P.GrpVen = ?",
        [verified.grpven]
      );

      const Certificado = await Database.connection("pg").raw(queryCertificados, [verified.user_code])

      let vencimento = null

      //formato a data do certificado
      if (Certificado.rows[0]) {
        vencimento = String(Certificado.rows[0].valor).substring(
          String(Certificado.rows[0].valor).indexOf('datavenctocertificado=') + 22,
          String(Certificado.rows[0].valor).indexOf('datavenctocertificado=') + 32
        )
      } else {
        vencimento = 'Desconhecido'
      }

      response.status(200).send({
        Franqueado: res[0],
        VencCert: vencimento,
      });
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'ProfileController.Show',
      })
    }
  }

  async ChangePassword({ request, response }) {
    const token = request.header("authorization");
    const { password } = request.only(["password"]);

    if (password.nova !== password.confirmacao) {
      //Caso a senha nova não bater com a confirmação
      response.status(409).send();
    } else if (password.nova.length > 6) {
      //Caso a senha nova exceder os 6 digitos
      response.status(406).send();
    } else {
      try {
        const verified = seeToken(token);

        //busca senha antiga
        const oldPassword = await Database.select("Senha")
          .from("dbo.FilialAcesso")
          .where({
            GrpVen: verified.grpven,
          });

        //Caso a senha atual não ter sido corretamente digitada
        if (oldPassword[0].Senha.trim() !== password.atual) {
          response.status(405).send();
        } else if (oldPassword[0].Senha.trim() === password.nova) {
          //Caso da antiga senha ser igual à nova
          response.status(304).send();
        } else {
          //atualiza senha no BD
          await Database.table("dbo.FilialAcesso")
            .where({
              GrpVen: verified.grpven,
            })
            .update({ Senha: password.nova });

          response.status(200).send();
        }
      } catch (err) {
        response.status(400).send()
        logger.error({
          token: token,
          params: null,
          payload: request.body,
          err: err.message,
          handler: 'ProfileController.ChangePassword',
        })
      }
    }
  }

  async ChangeEmail({ request, response }) {
    const token = request.header("authorization");
    const { email } = request.only(["email"]);

    if (email === "" || email === null || typeof email == "undefined") {
      response.status(400).send('Email inválido')
      return
    }

    try {
      const verified = seeToken(token);

      //atualiza email no BD
      await Database.table("dbo.FilialEntidadeGrVenda")
        .where({
          A1_GRPVEN: verified.grpven,
        })
        .update({ Email: email });

      response.status(200).send();
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'ProfileController.ChangeEmail',
      })
    }
  }

  async ChangeTax({ request, response }) {
    const token = request.header("authorization");
    const { newTax } = request.only(["newTax"]);

    try {
      const verified = seeToken(token);

      if (newTax.tipo === "PERCENTUAL" && parseFloat(newTax.valor) >= 100)
        response.status(412);

      await Database.table("dbo.Parametros")
        .where({
          GrpVen: verified.grpven,
        })
        .update({
          ParamTxt: newTax.tipo,
          ParamVlr:
            newTax.tipo === "PERCENTUAL"
              ? parseFloat(newTax.valor) / 100
              : parseFloat(newTax.valor),
        });

      response.status(200).send();
    } catch (err) {
      response.status(400).send()
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'ProfileController.ChangeTax',
      })
    }
  }
}

module.exports = ProfileController;

const queryCertificados = 'SELECT swvix."ns.estabelecimentos".codigo, valor FROM ( ( swvix."ns.estabelecimentos" INNER JOIN swvix."ns.series" ON swvix."ns.estabelecimentos".estabelecimento = swvix."ns.series".estabelecimento ) INNER JOIN swvix."ns.ConfigCertif" ON swvix."ns.estabelecimentos".codigo = swvix."ns.ConfigCertif".codigo ) INNER JOIN swvix."estoque.locaisdeestoques" ON swvix."ns.estabelecimentos".estabelecimento = swvix."estoque.locaisdeestoques".estabelecimento WHERE swvix."ns.estabelecimentos".codigo = ? ORDER BY swvix."ns.estabelecimentos".codigo'