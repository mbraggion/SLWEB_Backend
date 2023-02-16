const Helpers = use("Helpers");
const moment = require("moment");

exports.PDFGen = (paths, labels, limiteLinha) => {
  let tamanhos = new Array(limiteLinha)
  tamanhos.fill('auto')

  var docDefinition = {
    footer: (currentPage, pageCount) => {
      return {
        columns: [
          { text: moment().format('LLL'), alignment: 'left', style: "footer" },
          { text: `Página ${currentPage.toString()} de ${pageCount}`, alignment: 'right', style: "footer" }
        ]
      }
    },
    background: function () {
      return {
        canvas: [
      {
        type: 'rect',
        x: 0, y: 0, w: 595.28, h: 841.89,
        color: '#14636b'
      }
    ]
    };
  },
    content: [
      {
        unbreakable: true,
        stack: [paths.map((p, x) => {
          return {
            layout: 'noBorders',
            table: {
              headerRows: 1,
              widths: tamanhos,
      
              body: [
                p.map(l => {
                  return { image: l, style: 'semMargem' }
                }),
                p.map((l, z) => {
                  return { text: labels[x][z], style: 'label' }
                })
              ]
            }
          }
        })
        ],
      }
    ],
    styles: {
      label: {
        fontSize: 12,
        alignment: 'center',
        margin: [0, 0, 0, 0],
        color: '#FFF',
        bold: true
      },
      footer: {
        margin: [10, 0, 10, 10],
        fontSize: 8,
      },
      semMargem: {
        margin: [0, 0, 0, 0]
      },
    },
  };

  return docDefinition;
};
