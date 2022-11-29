'use strict'

const Drive = use("Drive");
const Helpers = use("Helpers");
var QRCode = require('qrcode')
const moment = require("moment");
const logger = require("../../../../dump/index")

class SLaplicIntController {
  async AttSLAPLIC({ response }) {
    try {
      const file = await Drive.get(
        `\\\\192.168.1.250\\dados\\Franqueado\\SLAPLIC\\SL_APLIC.accdb`
      );

      response.status(200).send(file);
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: null,
        params: null,
        payload: null,
        err: err.message,
        handler: 'SLaplicIntController.AttSLAPLIC',
      })
    }
  }

  async ReturnQRCode({ response, params }) {
    const EquiCod = params.ativo;

    if (EquiCod !== null && typeof EquiCod != 'undefined') {
      const filePath = Helpers.publicPath(`/tmp/${EquiCod}-${moment().format('hh:mm:ss').replace(/:/g, "-")}.png`);
      await QRCode.toFile(filePath, EquiCod)

      response.status(200).attachment(filePath, 'QRCODE.png')
    } else {
      response.status(400).send({
        message: "Não foi possível gerar o QRCode"
      })
    }
  }
}

module.exports = SLaplicIntController
