"use strict";

const Database = use("Database");
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")

class ContractController {
  async Show({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      const contracts = await Database
        .select("CNPJ", "CNPJss", "ConId", "Dt_Inicio", "Dt_Fim", "Nome_Fantasia", "ConStatus")
        .from("dbo.Contrato")
        .where({
          GrpVen: verified.grpven
        })

      response.status(200).send({ contracts: contracts });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err,
        handler: 'ContractController.Show',
      })
    }
  }

  // async See({ request, response, params }) {
  //   const token = request.header("authorization");
  //   const CNPJ = params.cnpj
  //   const ConId = params.conid
  //   const Tipo = params.tipo

  //   try {
  //     const verified = seeToken(token);

  //     switch (Tipo) {
  //       case 'anexo':
  //         //buscar todos os anexos
  //         const anexo = await Database
  //           .select("CalcFatId", "AnxFatMinimo", "AnxCalcMinPor", "AnxTipMin", "AnxMinMoeda", "AnxDiaFecha", "AnxProRata", "ProdId", "AnxObs", "ProdIdEMin", "CNPJ", "ConId", "AnxId")
  //           .from('dbo.Anexos')
  //           .where({
  //             GrpVen: verified.grpven,
  //             ConId: ConId,
  //             CNPJ: CNPJ
  //           })

  //         let newAnx = null

  //         if (anexo.length === 0) {
  //           const lastAnxId = await Database
  //             .raw('SELECT MAX(AnxId) AS AnxId FROM dbo.Anexos WHERE GrpVen = ?', [verified.grpven])

  //           let newAnxId = lastAnxId.length > 0 ? Number(lastAnxId[lastAnxId.length - 1].AnxId) + 1 : 1

  //           const info = await Database
  //             .select("Nome_Fantasia", "CNPJss")
  //             .from('dbo.Cliente')
  //             .where({ CNPJ: CNPJ })

  //           if (info.length === 0) throw new Error('Cliente para anexo não encontrado')

  //           newAnx = {
  //             GrpVen: verified.grpven,
  //             CNPJ: CNPJ,
  //             CNPJss: info[0].CNPJss,
  //             ConId: ConId,
  //             AnxId: newAnxId,
  //             AnxDesc: info[0].Nome_Fantasia,
  //             CalcFatId: 255,
  //             AnxDiaFecha: 30,
  //             AnxProRata: "N",
  //             AnxCPAG: 0,
  //             AnxFatMinimo: "N",
  //             AnxTipMin: "R",
  //             AnxMinMoeda: "S",
  //             AnxCalcMinPor: "A",
  //             ProdId: '9807',
  //             AnxObs: "Anexo criado automaticamente pela tela Contratos web",
  //           }

  //           await Database.table("dbo.Anexos").insert(newAnx);
  //         }

  //         //separar a faixa de consumo do anx do contrato
  //         const faixa = await Database
  //           .select("AnxId", "AFCId", "AFCTipo", "AFCIni", "AFCFin", "AFCPorc")
  //           .from('dbo.AnexosFaixasConsumo')
  //           .where({
  //             GrpVen: verified.grpven,
  //             AnxId: anexo.length > 0 ? anexo[0].AnxId : newAnx.AnxId
  //           })
  //           .orderBy('AFCId', 'ASC')

  //         return response.status(200).send({
  //           ContractAnx: anexo.length > 0 ? anexo[0] : newAnx,
  //           ContractFxCon: faixa,
  //         });
  //       case 'contrato':
  //         const contratoInfo = await Database
  //           .select("CNPJ", "CNPJss", "ConId", "Dt_Inicio", "Dt_Fim", "Nome_Fantasia", "Contato_Empresa", "Email", "Contato_Empresa_2", "Email_2", "Fone_2", "Contato2", "Obs_Específica_Cliente", "ConPDF", "ConStatus")
  //           .from("dbo.Contrato")
  //           .where({
  //             CNPJ: CNPJ,
  //             GrpVen: verified.grpven,
  //             ConId: ConId
  //           })

  //         return response.status(200).send({
  //           Contract: contratoInfo[0]
  //         });
  //       default:
  //         throw new Error('entidade para query não identificada')
  //     }
  //   } catch (err) {
  //     response.status(400).send();
  //     logger.error({
  //       token: token,
  //       params: params,
  //       payload: request.body,
  //       err: err,
  //       handler: 'ContractController.See',
  //     })
  //   }
  // }

  // async Update({ request, response, params }) {
  //   const token = request.header("authorization");
  //   const { payload } = request.only(["payload"])
  //   const CNPJ = params.cnpj
  //   const ConId = params.conid
  //   const Tipo = params.tipo

  //   try {
  //     const verified = seeToken(token);

  //     switch (Tipo) {
  //       case 'anexo':
  //         await Database.table("dbo.Anexos")
  //           .where({
  //             CNPJ: CNPJ,
  //             ConId: ConId,
  //             AnxId: payload.AnxId,
  //             GrpVen: verified.grpven
  //           })
  //           .update({
  //             CalcFatId: payload.CalcFatId,
  //             AnxFatMinimo: payload.AnxFatMinimo,
  //             AnxCalcMinPor: payload.AnxCalcMinPor,
  //             AnxTipMin: payload.AnxTipMin,
  //             AnxMinMoeda: payload.AnxMinMoeda,
  //             AnxDiaFecha: payload.AnxDiaFecha,
  //             AnxProRata: payload.AnxProRata,
  //             AnxObs: payload.AnxObs,
  //           })

  //         await Database.table("dbo.AnexosFaixasConsumo")
  //           .where({
  //             GrpVen: verified.grpven,
  //             AnxId: payload.AnxId
  //           })
  //           .delete();

  //         payload.Faixa.forEach(async (F, i) => {
  //           await Database
  //             .insert({
  //               GrpVen: verified.grpven,
  //               AnxId: payload.AnxId,
  //               AFCId: F.AFCId,
  //               AFCTipo: F.AFCTipo,
  //               AFCIni: F.AFCIni,
  //               AFCFin: F.AFCFin,
  //               AFCPorc: F.AFCPorc
  //             })
  //             .into('dbo.AnexosFaixasConsumo')
  //         })

  //         return response.status(200).send();
  //       case 'contrato':
  //         await Database.table("dbo.Contrato")
  //           .where({
  //             CNPJ: CNPJ,
  //             ConId: ConId,
  //             GrpVen: verified.grpven
  //           })
  //           .update({
  //             Dt_Inicio: payload.Dt_Inicio,
  //             Dt_Fim: payload.Dt_Fim,
  //             Contato_Empresa: payload.Contato_Empresa,
  //             Email: payload.Email,
  //             Contato_Empresa_2: payload.Contato_Empresa_2,
  //             Email_2: payload.Email_2,
  //             Fone_2: payload.Fone_2,
  //             Contato2: payload.Contato2,
  //             Obs_Específica_Cliente: payload.Obs_Específica_Cliente,
  //           })

  //         return response.status(200).send();
  //       default:
  //         throw new Error('entidade para query não identificada')
  //     }
  //   } catch (err) {
  //     response.status(400).send();
  //     logger.error({
  //       token: token,
  //       params: params,
  //       payload: request.body,
  //       err: err,
  //       handler: 'ContractController.Update',
  //     })
  //   }
  // }

  // async Upload({ request, response }) {
  //   const token = request.header("authorization");

  //   const formData = request.file("formData", { types: ["image", "pdf"], size: "10mb" });
  //   const fn = JSON.parse(request.input(('fn')))
  //   const MULTI = request.input('multiple')
  //   const CNPJ = request.input('CNPJ')
  //   const ConId = request.input('ConId')

  //   try {
  //     const verified = seeToken(token);
  //     const path = Helpers.publicPath(`/CONTRATOS/${verified.user_code}/${CNPJ}/${ConId}`);
  //     let file = null
  //     let newFileName = ''

  //     if (MULTI === 'N') {

  //       newFileName = fn[0];

  //       await formData.move(path, {
  //         name: newFileName,
  //         overwrite: true,
  //       });

  //       if (!formData.moved()) {
  //         return formData.errors();
  //       }

  //       file = await Drive.get(`${path}/${newFileName}`);

  //       Drive.put(
  //         `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\CONTRATOS\\${verified.user_code}\\${CNPJ}\\${ConId}`,
  //         file
  //       );
  //     } else {
  //       await formData.moveAll(path, (file, i) => {
  //         newFileName = fn[i];

  //         return {
  //           name: newFileName,
  //           overwrite: true,
  //         };
  //       });

  //       if (!formData.movedAll()) {
  //         return formData.errors();
  //       }

  //       fn.forEach(async (name) => {
  //         file = await Drive.get(`${path}/${name}`);

  //         Drive.put(
  //           `\\\\192.168.1.250\\dados\\Franquia\\SLWEB\\CONTRATOS\\${verified.user_code}\\${CNPJ}\\${ConId}`,
  //           file
  //         );
  //       });
  //     }

  //     response.status(200).send();
  //   } catch (err) {
  //     console.log(err.message)
  //     response.status(400).send();
  //     logger.error({
  //       token: token,
  //       params: null,
  //       payload: request.body,
  //       err: err,
  //       handler: 'ContractController.Upload',
  //     })
  //   }
  // }
}

module.exports = ContractController;
