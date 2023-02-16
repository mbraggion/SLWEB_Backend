const Helpers = use("Helpers");
const moment = require("moment");

exports.PDFGen = (FD, FM, PDV, PROD, Faturar) => {
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
              { text: "Contador inicial: ", bold: true },
              { text: `${FM.FfmCNTAnt}`, alignment: 'right' },
              { text: "Contador final: ", bold: true },
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
            layout: {
              fillColor: function (rowIndex, node, columnIndex) {
                if (rowIndex === 0) {
                  return '#CCCCCC'
                } else {
                  return '#FFFFFF'
                };
              },
              hLineColor: function (lineIndex, node, i) {
                return '#1b1b1b'
              },
              vLineColor: function (i, node, rowIndex) {
                return '#1b1b1b'
              },
              paddingBottom: function (rowIndex, node) {
                return (rowIndex === 0) ? 10 : 0;
              },
            }
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
                { text: '', alignment: 'center' },
                { text: 'TOTAL', style: 'whiteText' },
                { text: '', alignment: 'center' },
                { text: '', alignment: 'center' },
                {
                  text: FD.reduce((acc, act) => {
                    return acc + act.Consumo
                  }, 0),
                  alignment: 'right',
                  style: 'whiteText'
                },
              ]]),
            },
            layout: {
              fillColor: function (rowIndex, node, columnIndex) {
                if (rowIndex === 0) {
                  return '#CCCCCC'
                } else if (rowIndex === node.table.body.length - 1) {
                  return '#1b1b1b'
                } else {
                  return '#FFFFFF'
                };
              },
              hLineColor: function (lineIndex, node, i) {
                return '#1b1b1b'
              },
              vLineColor: function (i, node, rowIndex) {
                return '#1b1b1b'
              },
              paddingBottom: function (rowIndex, node) {
                return (rowIndex === 0) ? 10 : 0;
              },
            }
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
                Faturar
                  .map(y => ([
                    { text: y.ProdId, alignment: 'right' },
                    { text: y.Produto },
                    { text: y.QVenda, alignment: 'right' },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(y.VVenda), alignment: 'right'
                    },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(Number(y.DVenda)), alignment: 'right'
                    },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format((y.VVenda - Number(y.DVenda)) * y.QVenda), alignment: 'right'
                    }
                  ]))
              ).concat(
                [
                  [
                    { text: "", alignment: 'center' },
                    { text: "TOTAL", style: 'whiteText' },
                    { text: "", alignment: 'center' },
                    { text: "", alignment: 'center' },
                    { text: "", alignment: 'center' },
                    {
                      text: new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(Faturar
                        .reduce((acc, act) => {
                          return acc + (act.VVenda - Number(act.DVenda)) * act.QVenda
                        }, 0)),
                      alignment: 'right',
                      style: 'whiteText',
                      noWrap: true
                    }
                  ]
                ]
              )
            },
            layout: {
              fillColor: function (rowIndex, node, columnIndex) {
                if (rowIndex === 0) {
                  return '#CCCCCC'
                } else if (rowIndex === node.table.body.length - 1) {
                  return '#1b1b1b'
                } else {
                  return '#FFFFFF'
                };
              },
              hLineColor: function (lineIndex, node, i) {
                return '#1b1b1b'
              },
              vLineColor: function (i, node, rowIndex) {
                return '#1b1b1b'
              },
              paddingBottom: function (rowIndex, node) {
                return (rowIndex === 0) ? 10 : 0;
              },
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
      whiteText: {
        color: '#FFF'
      }
    },
  };

  return docDefinition;
};


const montaEndereco = (pdv) => {
  let res = ''

  if (pdv.PdvLogradouroPV !== null && String(pdv.PdvLogradouroPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvLogradouroPV}`).trim() : res = res.concat(pdv.PdvLogradouroPV).trim()
  }

  if (pdv.PdvNumeroPV !== null && String(pdv.PdvNumeroPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvNumeroPV}`).trim() : res = res.concat(pdv.PdvNumeroPV).trim()
  }

  if (pdv.PdvComplementoPV !== null && String(pdv.PdvComplementoPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvComplementoPV}`).trim() : res = res.concat(pdv.PdvComplementoPV).trim()
  }

  if (pdv.PdvBairroPV !== null && String(pdv.PdvBairroPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvBairroPV}`).trim() : res = res.concat(pdv.PdvBairroPV).trim()
  }

  if (pdv.PdvCidadePV !== null && String(pdv.PdvCidadePV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvCidadePV}`).trim() : res = res.concat(pdv.PdvCidadePV).trim()
  }

  if (pdv.PdvUfPV !== null && String(pdv.PdvUfPV).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvUfPV}`).trim() : res = res.concat(pdv.PdvUfPV).trim()
  }

  if (pdv.PdvCEP !== null && String(pdv.PdvCEP).trim() !== '') {
    res.length > 0 ? res = res.concat(`, ${pdv.PdvCEP}`).trim() : res = res.concat(pdv.PdvCEP).trim()
  }

  return res
}