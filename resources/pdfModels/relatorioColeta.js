const Helpers = use("Helpers");
const moment = require("moment");

exports.PDFGen = (FD, FM, PDV, PROD) => {
  //obj que vai virar pdf
  var docDefinition = {
    // watermark: Helpers.resourcesPath("logo/Exemplo logo pilao - Danfe.bmp"),
    footer: (currentPage, pageCount) => {
      return {
        columns: [
          { text: moment().format('LLL'), alignment: 'left', style: "footer" },
          { text: `Página ${currentPage.toString()} de ${pageCount}`, alignment: 'right', style: "footer" }
        ]
      }
    },
    content: [
      { text: "Demonstrativo de Consumo", style: "header" },

      {
        image: Helpers.resourcesPath("logo/Exemplo logo pilao - Danfe.bmp"),
        width: 100,
        absolutePosition: { x: 460, y: 10 },
      },

      {
        style: "tableMarginTop",
        table: {
          widths: ["auto", "*", "auto", "auto"],
          body: [
            [
              { text: "Cliente: ", bold: true },
              `${PDV.Nome_Fantasia}`,
              { text: 'Equipamento: ', bold: true },
              `${PDV.EQUIPMOD_Desc} [${PDV.EquiCod}]`,
            ],
          ],
        },
      },

      {
        style: "tableNoMargin",
        table: {
          widths: ['auto', "*", 'auto', "auto"],
          body: [
            [
              { text: "Endereço: ", bold: true },
              { text: montaEndereco(PDV) },
              { text: "Referencia: ", bold: true },
              { text: `${moment(FM.FfmRef).add(3, 'hours').format('MM/YYYY')}` },
            ],
          ],
        },
      },

      {
        style: "tableMarginTop",
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: [
            [
              { text: "De: ", bold: true },
              { text: `${moment(FM.FfmDtColetaAnt).format('L')}`, alignment: 'right' },
              { text: "Até: ", bold: true },
              { text: `${moment(FM.FfmDtColeta).format('L')}`, alignment: 'right' },
            ],
            [
              { text: "Contador geral: ", bold: true },
              { text: `${FM.FfmCNTAnt}`, alignment: 'right' },
              { text: "Contador geral: ", bold: true },
              { text: `${FM.FfmCNT}`, alignment: 'right' },
            ],
          ],
        },
      },

      {
        unbreakable: true,
        stack: [
          { text: "Layout da Máquina", style: "subheader" },
          {
            style: "tableNoMargin",
            table: {
              widths: ["auto", "*", "auto", "auto"],
              body: [
                [
                  { text: "Sel.", bold: true },
                  { text: "Produto", bold: true },
                  { text: "Venda", bold: true },
                  { text: "Valor Un.", bold: true },
                ],
              ].concat(PROD.map(p => ([
                { text: p.PvpSel, alignment: 'center' },
                { text: p.Produto },
                { text: p.TveDesc },
                {
                  text: new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(p.PvpVvn1), alignment: 'right'
                }
              ]))),
            },
          }
        ]
      },

      {
        unbreakable: true,
        stack: [
          { text: "Consumo no Período", style: "subheader" },
          {
            style: "tableNoMargin",
            table: {
              widths: ["auto", "*", "auto", "auto", "auto"],
              body: [
                [
                  { text: "Sel.", bold: true },
                  { text: "Produto", bold: true },
                  { text: "C. I.", bold: true },
                  { text: "C. F.", bold: true },
                  { text: "Consumo", bold: true },
                ],
              ].concat(FD.map(f => ([
                { text: f.Sel },
                { text: f.Produto },
                { text: f["C.I"], alignment: 'right' },
                { text: f["C.F"], alignment: 'right' },
                { text: f.Consumo, alignment: 'right' },
              ]))).concat([[
                { text: '-', alignment: 'center' },
                { text: 'TOTAL' },
                { text: '-', alignment: 'center' },
                { text: '-', alignment: 'center' },
                {
                  text: FD.reduce((acc, act) => {
                    return acc + act.Consumo
                  }, 0), alignment: 'right'
                },
              ]]),
            },
          }
        ]
      },

      {
        unbreakable: true,
        stack: [
          { text: 'Faturamento do Período', style: "subheader" },
          {
            style: "tableNoMargin",
            table: {
              widths: ["auto", "*", "auto", "auto", "auto", "auto"],
              body: [
                [
                  { text: "Cod", bold: true },
                  { text: "Produto", bold: true },
                  { text: "Qtd.", bold: true },
                  { text: "Vlr. Un.", bold: true },
                  { text: "Desconto", bold: true },
                  { text: "Vlr. Total", bold: true },
                ],
              ].concat(
                FD
                  .filter(w => w.Consumo > 0 && w["Vlr. Total"] > 0)
                  .map(y => ([
                    { text: y.ProdId, alignment: 'right' },
                    { text: y.Produto },
                    { text: y.Consumo, alignment: 'right' },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(y["Vlr. Un."]), alignment: 'right'
                    },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(0), alignment: 'right'
                    },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(y["Vlr. Total"]), alignment: 'right'
                    }
                  ]))
              ).concat(
                [
                  [
                    { text: "-", alignment: 'center' },
                    { text: "TOTAL" },
                    { text: "-", alignment: 'center' },
                    { text: "-", alignment: 'center' },
                    { text: "-", alignment: 'center' },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(FD
                        .filter(w => w.Consumo > 0 && w["Vlr. Total"] > 0)
                        .reduce((acc, act) => {
                          return acc + act["Vlr. Total"]
                        }, 0)),
                      alignment: 'right'
                    }
                  ]
                ]
              )
            }
          }
        ]
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      footer: {
        margin: [10, 0, 10, 10],
        fontSize: 8,
      },
      tableNoMargin: {
        margin: [0, 0, 0, 0],
      },
      tableMarginTop: {
        margin: [0, 16, 0, 0],
      },
      subheader: {
        fontSize: 16,
        bold: true,
        margin: [0, 16, 0, 8],
      },
    },
  };

  return docDefinition;
};


const montaEndereco = (pdv) => {
  let res = ''

  if (pdv.PdvLogradouroPV !== null && String(pdv.PdvLogradouroPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvLogradouroPV}`) : res = res.concat(pdv.PdvLogradouroPV)
  }

  if (pdv.PdvNumeroPV !== null && String(pdv.PdvNumeroPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvNumeroPV}`) : res = res.concat(pdv.PdvNumeroPV)
  }

  if (pdv.PdvComplementoPV !== null && String(pdv.PdvComplementoPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvComplementoPV}`) : res = res.concat(pdv.PdvComplementoPV)
  }

  if (pdv.PdvBairroPV !== null && String(pdv.PdvBairroPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvBairroPV}`) : res = res.concat(pdv.PdvBairroPV)
  }

  if (pdv.PdvCidadePV !== null && String(pdv.PdvCidadePV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvCidadePV}`) : res = res.concat(pdv.PdvCidadePV)
  }

  if (pdv.PdvUfPV !== null && String(pdv.PdvUfPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvUfPV}`) : res = res.concat(pdv.PdvUfPV)
  }

  if (pdv.PdvCEP !== null && String(pdv.PdvCEP).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvCEP}`) : res = res.concat(pdv.PdvCEP)
  }

  return res
}