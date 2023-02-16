"use strict";

const Database = use("Database");
const Mail = use("Mail");
const Env = use("Env");
const { genToken, genTokenAdm, genTokenAdmWithFilial, genTokenExternal, seeToken, genTokenAdmLogout } = require("../../Services/jwtServices");
const logger = require("../../../dump/index")

class UserController {

  async Login({ request, response }) {
    const { user_code, password } = request.only(["user_code", "password"]);

    try {
      //testa usuario + senha informados
      const token = await genToken(user_code, password);

      const DeveConfirmacao = await Database
        .select('Equip')
        .from('dbo.FilialEntidadeGrVenda')
        .where({
          M0_CODFIL: user_code
        })

      const links = await Database.raw(QUERY_LINKS_DISPONIVEIS, process.env.NODE_ENV === 'production' ? [user_code, process.env.NODE_ENV, user_code] : [user_code, user_code])

      let linksEmSessões = []

      links.filter(LS => {
        if (DeveConfirmacao[0].Equip === 'S') {
          if (LS.Bloqueavel === true) {
            return false
          } else {
            return true
          }
        } else {
          return true
        }
      }).forEach(ln => {
        if (linksEmSessões[ln.Sessao]) {
          linksEmSessões[ln.Sessao] = [...linksEmSessões[ln.Sessao], ln]
        } else {
          linksEmSessões[ln.Sessao] = [ln]
        }
      })

      response.status(202).send({
        ...token,
        Links: linksEmSessões.filter(LS => LS !== null)
      });
    } catch (err) {
      response.status(401).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'UserController.Login',
      })
    }
  }

  async Forgot({ request, response }) {
    const { user_code } = request.only(["user_code"]);

    try {
      const checkUser = await Database.raw('select * from dbo.FilialEntidadeGrVenda where M0_CODFIL = ?', [user_code])

      if (checkUser.length < 1) {
        //se não encontrar o codigo do franqueado
        response.status(400).send();
      } else {
        //se encontrar o codigo do franqueado

        //busca a senha do franqueado
        const senha = await Database.raw('select Senha from dbo.FilialAcesso where M0_CODFIL = ?', [user_code])

        //envia a senha do franqueado por email
        await Mail.send(
          "emails.forgotPassword",
          { checkUser, password: senha[0].Senha },
          (message) => {
            message
              .to(checkUser[0].Email)
              .from(Env.get("MAIL_USERNAME"), "SLWEB")
              .subject("Recuperação de senha");
          }
        );

        response.status(200).send();
      }
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'UserController.Forgot',
      })
    }
  }

  async AdmPartialLogin({ request, response }) {
    const { admin_code, admin_password } = request.only(["admin_code", "admin_password",]);

    try {
      const token = await genTokenAdm(admin_code, admin_password)

      const links = await Database.raw(QUERY_LINKS_DISPONIVEIS, process.env.NODE_ENV === 'production' ? [admin_code, process.env.NODE_ENV, admin_code] : [admin_code, admin_code])

      let linksEmSessões = []

      links.forEach(ln => {
        if (linksEmSessões[ln.Sessao]) {
          linksEmSessões[ln.Sessao] = [...linksEmSessões[ln.Sessao], ln]
        } else {
          linksEmSessões[ln.Sessao] = [ln]
        }
      })

      response.status(202).send({ ...token, Links: linksEmSessões.filter(LS => LS !== null) });
    } catch (err) {
      response.status(401).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'UserController.AdmPartialLogin',
      })
    }
  }

  async AdmFullLogin({ request, response }) {
    const token = request.header("authorization");
    const { user_code } = request.only(["user_code"]);

    try {
      const verified = seeToken(token);

      //crio token com codido do adm, codigo do cliente, senha e nivel do adm
      const admTokenWithFilial = await genTokenAdmWithFilial(user_code, verified);

      const links = await Database.raw(QUERY_LINKS_DISPONIVEIS, process.env.NODE_ENV === 'production' ? [verified.admin_code, process.env.NODE_ENV, verified.admin_code] : [verified.admin_code, verified.admin_code])

      let linksEmSessões = []

      links.forEach(ln => {
        if (linksEmSessões[ln.Sessao]) {
          linksEmSessões[ln.Sessao] = [...linksEmSessões[ln.Sessao], ln]
        } else {
          linksEmSessões[ln.Sessao] = [ln]
        }
      })

      response.status(202).send({ ...admTokenWithFilial, Links: linksEmSessões.filter(LS => LS !== null) });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'UserController.AdmFullLogin',
      })
    }
  }

  async AdmLogoutFilial({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const admTokenLogout = await genTokenAdmLogout(verified.admin_code, verified.role);

      const links = await Database.raw(QUERY_LINKS_DISPONIVEIS, process.env.NODE_ENV === 'production' ? [verified.admin_code, process.env.NODE_ENV, verified.admin_code] : [verified.admin_code, verified.admin_code])

      let linksEmSessões = []

      links.forEach(ln => {
        if (linksEmSessões[ln.Sessao]) {
          linksEmSessões[ln.Sessao] = [...linksEmSessões[ln.Sessao], ln]
        } else {
          linksEmSessões[ln.Sessao] = [ln]
        }
      })

      response.status(202).send({ ...admTokenLogout, Links: linksEmSessões.filter(LS => LS !== null) });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'UserController.AdmLogoutFilial',
      })
    }
  }

  async ExternalAuth({ request, response }) {
    const { code } = request.only(["code"]);

    try {
      const tentativa = await Database.raw('select * from dbo.CrossLogin where M0_CODFIL = ? AND Logou = ? order by DtSolicita DESC', [code, false])

      if (tentativa.length < 1) {
        response.status(400).send('Cross login não registrado pelo SLAplic')
        return
      }

      const HorarioMaximo = new Date(
        new Date(tentativa[0].DtSolicita).getFullYear(),
        new Date(tentativa[0].DtSolicita).getMonth(),
        new Date(tentativa[0].DtSolicita).getDate(),
        new Date(tentativa[0].DtSolicita).getHours(),
        new Date(tentativa[0].DtSolicita).getMinutes() + 1,
        new Date(tentativa[0].DtSolicita).getSeconds()
      );

      const HorarioAtual = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
        new Date().getHours() - 3,
        new Date().getMinutes(),
        new Date().getSeconds()
      );

      //data criação <= data de criação + 1min
      if (HorarioAtual < HorarioMaximo) {
        await Database.raw('update dbo.CrossLogin set Logou = ? where M0_CODFIL = ? and Logou = ?', [true, code, false])

        const token = await genTokenExternal(code);

        const links = await Database.raw(QUERY_LINKS_DISPONIVEIS, process.env.NODE_ENV === 'production' ? [code, process.env.NODE_ENV, code] : [code, code])

        let linksEmSessões = []

        links.forEach(ln => {
          if (linksEmSessões[ln.Sessao]) {
            linksEmSessões[ln.Sessao] = [...linksEmSessões[ln.Sessao], ln]
          } else {
            linksEmSessões[ln.Sessao] = [ln]
          }
        })

        response.status(202).send({ ...token, Links: linksEmSessões.filter(LS => LS !== null) });
      } else {
        response.status(400).send('Mais de 1 minuto de redirecionamento')
        return
      }

    } catch (err) {
      response.status(401).send();
      logger.error({
        token: null,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'UserController.ExternalAuth',
      })
    }
  }
}

module.exports = UserController;

const QUERY_LINKS_DISPONIVEIS = `select L.Descricao, L.Link, L.Sessao, L.Icon, L.AccessLevel, L.Bloqueavel from dbo.SLWEB_Links as L inner join ( select T.* from dbo.Operador as O inner join dbo.TipoOper as T on T.TopeCod = O.TopeCod where M0_CODFIL = ? ) as O on ( L.AccessScale = 0 and L.AccessLevel = O.AccessLevel ) or ( L.AccessScale = 1 and O.AccessLevel >= L.AccessLevel ) or ( L.AccessLevel is null ) where ${process.env.NODE_ENV === 'development' ? '' : 'Ambiente = ? and'} Habilitado = 1 and (ExcludeTopeCod  <> (select TopeCod from dbo.Operador where M0_CODFIL = ?) or ExcludeTopeCod is null) order by Sessao ASC`