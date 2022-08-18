const Helpers = use("Helpers");
const moment = require("moment");

exports.PDFGen = (Cab, Det) => {
  const detalhes = []
  let total = 0

  Det.forEach(detalhe => {
    total = total + Number(detalhe.PvdVlrTotal)
    detalhes.push(
      [
        { text: detalhe.ProdId, alignment: 'left' },
        { text: detalhe.Produto, alignment: 'left' },
        { text: detalhe.PvdQtd, alignment: 'right' },
        { text: `R$ ${Number(detalhe.PrCompra).toFixed(2)}`, alignment: 'left' },
        { text: `R$ ${Number(detalhe.PvdVlrUnit).toFixed(2)}`, alignment: 'left' },
        { text: `R$ ${Number(detalhe.PvdVlrTotal).toFixed(2)}`, alignment: 'left' }
      ]
    )
  })

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
      { text: `Pedido de Compra - ${Cab.PvcID}`, style: "header" },
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
              { text: "Franqueado: ", bold: true },
              `${Cab.Nome_Fantasia}`,
              { text: `${Cab.TPessoa === 'F' ? 'CPF: ' : 'CNPJ: '}`, bold: true },
              `${Cab.CNPJss}`,
            ],
          ],
        },
      },
      {
        style: "tableNoMargin",
        table: {
          widths: ["auto", "*", "auto", "auto"],
          body: [
            [
              { text: "Pedido N°: ", bold: true },
              `${Cab.PvcID}`,
              { text: "Data do pedido: ", bold: true },
              moment(Cab.DataCriacao).format('DD/MM/YYYY'),
            ],
          ],
        },
      },
      { text: 'Itens do Pedido:', style: 'subheader' },
      {
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Cód.', style: 'tableHeader' },
              { text: 'Produto', style: 'tableHeader' },
              { text: 'Qtd.', style: 'tableHeader' },
              { text: 'Valor', style: 'tableHeader' },
              { text: 'Valor c/ Desc.', style: 'tableHeader' },
              { text: 'Valor Total', style: 'tableHeader' }
            ],
            ...detalhes,
            [
              { text: '', alignment: 'right' },
              { text: '', alignment: 'center' },
              { text: '', alignment: 'center' },
              { text: '', alignment: 'center' },
              { text: 'TOTAL', style: 'TextT', alignment: 'left' },
              { text: `R$ ${Number(total).toFixed(2)}`, style: 'TextT', alignment: 'left' }
            ]
          ]
        },
        layout: {
          fillColor: function (rowIndex, node, columnIndex) {
            if (rowIndex === 0) {
              return '#FFFFFF'
            } else if (rowIndex === node.table.body.length - 1) {
              return '#1b1b1b'
            } else if (rowIndex % 2 === 0 && rowIndex !== 0) {
              return '#CCCCCC'
            } else {
              return '#FFFFFF'
            };
          },
          hLineWidth: function (i, node) {
            return null
          },
          vLineWidth: function (i, node) {
            return (i === 2) ? 2 : null
          },
          hLineColor: function (lineIndex, node, i) {
            return '#FFFFFF';
          },
          vLineColor: function (i, node, rowIndex) {
            if (rowIndex === node.table.body.length - 1) {
              return '#1b1b1b'
            } else if (i === 2) {
              return '#000000'
            } else if (rowIndex % 2 === 0 && rowIndex !== 0 && i !== 2) {
              return '#CCCCCC'
            } else {
              return '#FFFFFF'
            }
          },
          paddingBottom: function (rowIndex, node) {
            return (rowIndex === 0) ? 10 : 0;
          },
        }
      },
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      tableHeader: {
        bold: true,
        fontSize: 12,
        color: '#0A0A0A',
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 20, 0, 8]
      },
      TextT: {
        color: "#FFF",
        alignment: 'center',
        bold: true,
        fontSize: 10,
      },
      table: {
        margin: [0, 5, 0, 15],
        fontSize: 10,
      },
      tableNoMargin: {
        margin: [0, 0, 0, 0],
      },
      tableMarginTop: {
        margin: [0, 16, 0, 0],
      },
      footer: {
        margin: [10, 0, 10, 10],
        fontSize: 8,
      },
    },
  };

  return docDefinition;
};
