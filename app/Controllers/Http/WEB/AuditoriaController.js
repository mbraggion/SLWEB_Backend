"use strict";
const Database = use("Database");
const moment = require('moment')
const { randomUUID } = require('node:crypto');
const Helpers = use("Helpers");
const Env = use("Env");
var QRCode = require('qrcode')
const Drive = use("Drive");
const ppt = require('puppeteer')

const { seeToken } = require('../../../Services/jwtServices')
const logger = require("../../../../dump/index");
const { GenTokenTMT } = require('../../../Services/TMTConnServices')
const GerarExcel = require("../../../Services/excelExportService");

class AuditoriaController {
  async Show({ request, response, params }) {
    const uuid = decodeURI(params.uuid)

    try {
      // select nos index de acesso
      const index = await Database
        .select('*')
        .from('SLAPLIC.dbo.SLWEB_AuditEqIndex')
        .where({
          AccessId: uuid
        })

      if (index.length === 0) {
        response.status(400).send('acesso não existe')
        return
      }

      const equipamento = await Database
        .select('*')
        .from('dbo.Equipamento')
        .where({
          EquiCod: index[0].EquiCod,
          GrpVen: index[0].GrpVen
        })

      let status = ''
      if (equipamento.length === 0) {
        status = 'movido'
      } else if (index[0].Enabled === false) {
        status = 'desabilitado'
      } else {
        status = 'disponivel'
      }

      let pontodevenda = []
      let leiturasNoMes = []
      let configuracao = []
      let franqueado = []
      let telId = null

      if (status === 'disponivel' || status === 'desabilitado') {
        pontodevenda = await Database.raw("select E.EquiDesc, E.EquiCod, P.AnxDesc, P.PdvId, P.AnxId from SLAPLIC.dbo.PontoVenda as P inner join SLAPLIC.dbo.Equipamento as E on P.EquiCod = E.EquiCod and P.PdvStatus = 'A' where P.EquiCod = ?", [index[0].EquiCod])
        franqueado = await Database.raw("select C.Nome_Fantasia, C.DDD, C.Fone, F.Email from dbo.FilialEntidadeGrVenda as F inner join dbo.Cliente as C on F.A1_COD = C.A1_COD and F.A1_GRPVEN = C.GrpVen where F.A1_GRPVEN = ? order by C.TPessoa asc", [index[0].GrpVen])

        configuracao = await Database.raw("select PV.PvpSel, P.Produto, PV.PvpVvn1 from dbo.PVPROD as PV inner join dbo.Produtos as P on PV.ProdId = P.ProdId where GrpVen = ? and PdvId = ? and AnxId = ?", [index[0].GrpVen, pontodevenda[0].PdvId, pontodevenda[0].AnxId])
      }

      if (status === 'disponivel') {
        leiturasNoMes = await Database.raw("select DataLeitura, LeituraId, Matricula, QuantidadeTotal from SLAPLIC.dbo.SLTELLeitura where Matricula = ? and DATEDIFF(D, DataLeitura, GETDATE()) <= 31 order by DataLeitura DESC", [index[0].EquiCod])
        //const t = await Database.raw("SELECT Id FROM SLCafes.SLTelV1Prod.dbo.Telemetria where Matricula = ?", [index[0].EquiCod])
        const t = await Database.raw("SELECT Id FROM " + Env.get('SLCAFES_SLTELV1PROD') + ".dbo.Telemetria where Matricula = ?", [index[0].EquiCod])
        
        telId = t[0].Id
      }

      response.status(200).send({
        acesso: status,
        data: {
          leituras: leiturasNoMes,
          pdv: pontodevenda[0] ?? {},
          config: configuracao,
          franqueado: franqueado[0] ?? {},
          telemetriaId: telId
        }
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'AuditoriaController.Show',
      })
    }
  }

  async See({ request, response, params }) {
    const token = request.header("authorization");
    const eqcod = decodeURI(params.eqcod)

    try {
      const verified = seeToken(token);

      const accesso = await Database
        .select('AccessId', 'Enabled')
        .from('dbo.SLWEB_AuditEqIndex')
        .where({
          EquiCod: eqcod,
          GrpVen: verified.grpven
        })

      let linkAcesso = null
      let QRB64 = null

      if (accesso.length > 0) {
        linkAcesso = `${Env.get("CLIENT_URL")}/auditoria/${accesso[0].AccessId}`

        QRB64 = await stringToQrCode(linkAcesso, 'base64')
      }

      response.status(200).send({
        id: accesso.length > 0 ? accesso[0].AccessId : null,
        link: linkAcesso,
        status: accesso.length > 0 ? accesso[0].Enabled : null,
        QRCodeB64: QRB64
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'AuditoriaController.See',
      })
    }
  }

  async Store({ request, response }) {
    const token = request.header("authorization");
    const { eqcod } = request.only(['eqcod'])

    try {
      const verified = seeToken(token);
      const newUUID = randomUUID();

      const eq = await Database
        .select('*')
        .from('dbo.Equipamento')
        .where({
          EquiCod: eqcod,
          GrpVen: verified.grpven
        })

      if (eq.length === 0) {
        response.status(400).send('Equipamento não vinculado a sua filial')
        return
      }

      await Database
        .insert({
          Filial: verified.user_code,
          GrpVen: verified.grpven,
          EquiCod: eqcod,
          Enabled: true,
          AccessId: newUUID
        })
        .into('SLWEB_AuditEqIndex')

      let linkAcesso = `${Env.get("CLIENT_URL")}/auditoria/${newUUID}`

      const QRB64 = await stringToQrCode(linkAcesso, 'base64')

      response.status(201).send({
        id: newUUID,
        link: linkAcesso,
        status: true,
        QRCodeB64: QRB64
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'AuditoriaController.Store',
      })
    }
  }

  async Update({ request, response, params }) {
    const token = request.header("authorization");
    let uuid = decodeURI(params.uuid)
    let { type, status } = request.only(['type', 'status'])

    try {
      const verified = seeToken(token);

      switch (type) {
        case 'link':
          const newUUID = randomUUID()

          await Database
            .table("dbo.SLWEB_AuditEqIndex")
            .where({
              AccessId: uuid,
              GrpVen: verified.grpven
            })
            .update({
              AccessId: newUUID,
            });

          uuid = newUUID
          break;
        case 'compartilhamento':
          await Database
            .table("dbo.SLWEB_AuditEqIndex")
            .where({
              AccessId: uuid,
              GrpVen: verified.grpven
            })
            .update({
              Enabled: !status,
            });

          status = !status
          break
        default:
      }

      const linkAcesso = `${Env.get("CLIENT_URL")}/auditoria/${uuid}`

      const QRB64 = await stringToQrCode(linkAcesso, 'base64')

      response.status(200).send({
        id: uuid,
        link: linkAcesso,
        status: status,
        QRCodeB64: QRB64
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'AuditoriaController.Update',
      })
    }
  }

  async Destroy({ request, response, params }) {
    const token = request.header("authorization");
    const uuid = decodeURI(params.uuid)

    try {
      await Database
        .table("dbo.SLWEB_AuditEqIndex")
        .where({
          AccessId: uuid
        })
        .delete()

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'AuditoriaController.Destroy',
      })
    }
  }

  async GenExcel({ request, response, params }) {
    const AnxId = params.anxid
    const PdvId = params.pdvid
    const leituraIdInit = params.letini
    const leituraIdEnc = params.letenc
    const uuid = decodeURI(params.uuid)
    let objToExcel = []

    try {
      const index = await Database
        .select('*')
        .from('SLAPLIC.dbo.SLWEB_AuditEqIndex')
        .where({
          AccessId: uuid
        })

      if (index.length === 0 || index[0].Enabled === false) {
        response.status(400).send('Leituras privadas')
        return
      }

      const filePath = Helpers.publicPath(`/tmp/CONSUMO_${index[0].GrpVen}_${leituraIdInit}_a_${leituraIdEnc}.xlsx`);

      const produtos = await Database.raw("execute dbo.sp_ApontaConsumo1 @GrpVen = ?, @AnxId = ?, @PdvId = ?, @LeituraId1 = ?, @LeituraId2 = ?", [index[0].GrpVen, AnxId, PdvId, leituraIdInit, leituraIdEnc])

      objToExcel.push({
        workSheetName: 'Consumo de doses',
        workSheetColumnNames: ['Seleção', 'Bebida', 'Contador Inicial', 'Contador Final', 'Consumo'],
        workSheetData: produtos.map(p => ([p.PvpSel, p.Produto, p.QtdI, p.QtdF, p.QtdF - p.QtdI])),
      })

      await GerarExcel(
        objToExcel,
        filePath
      )

      const location = await Drive.get(filePath);

      response.status(200).send(location);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'AuditoriaController.GenExcel',
      })
    }
  }

  async SolicitarLeitura({ request, response, params }) {
    const telemetriaId = params.telId

    try {
      // faço isso pra garantir que meu login estará na filial correta
      await GenTokenTMT('0000')

      const pptParams = {
        headless: true,
        // executablePath: '/opt/homebrew/bin/chromium'
      }

      const browser = await ppt.launch(pptParams)

      const page = await browser.newPage();
      
      await page.goto('https://2btech.com.br/app/2tel/Telemetrias')
      await page.type('#Filial', Env.get('TMT_FILIAL'));
      await page.type('#UserName', Env.get('TMT_USER'));
      await page.type('#Password', Env.get('TMT_PASSWORD'));

      await Promise.all([
        page.waitForNavigation(),
        page.click('.btn-primary', {
          button: 'left',
          clickCount: 1,
        })
      ])
      
      await page.goto(`https://2btech.com.br/app/2tel/Telemetrias/PedirLeitura/${telemetriaId}`, { waitUntil: 'load' })

      await browser.close();

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'AuditoriaController.SolicitarLeitura',
      })
    }
  }
}

module.exports = AuditoriaController;

const _imageEncode = (arrayBuffer) => {
  // let u8 = new Uint8Array(arrayBuffer)

  let b64encoded = ''
  b64encoded = Buffer.from(arrayBuffer).toString('base64')
  // b64encoded = btoa([].reduce.call(new Uint8Array(arrayBuffer), function (p, c) { return p + String.fromCharCode(c) }, ''))
  let mimetype = "image/png"
  return "data:" + mimetype + ";base64," + b64encoded
}

const stringToQrCode = async (content, encoding) => {
  const filePath = Helpers.publicPath(`/tmp/${randomUUID()}-${moment().format('hh:mm:ss').replace(/:/g, "-")}.png`);
  await QRCode.toFile(filePath, content)

  const QRBin = await Drive.get(filePath)

  if (encoding === 'base64') {
    return _imageEncode(QRBin)
  } else if (encoding === 'binary') {
    return QRBin
  }
}