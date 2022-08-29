const Helpers = use("Helpers");

exports.PDFGen = (Solicitacao, ID, Dados, verified, solicitacao) => {
  //Coloco a configuração das bebibas nesse array aqui em cima porque no meio do obj do pdf fica uma bagunça
  const configArray = [
    [
      { text: "Seleção", bold: true },
      { text: "Bebida", bold: true },
      { text: "Medida", bold: true },
      { text: "Valor", bold: true },
      { text: "Tipo", bold: true },
      { text: "Ativa", bold: true },
    ],
  ];

  const contenedores = [];

  if (Solicitacao.Contenedor.length > 0) {
    Solicitacao.Contenedor.map((cont) =>
      contenedores.push([{ text: defineContenedor(cont) }])
    );
  } else {
    contenedores.push([{ text: 'VAZIO' }])
  }


  const detalhes = [
    [{ text: "Modelo da Máquina: ", bold: true }, `${Solicitacao.Maquina}`],
  ];

  detalhes.push([
    { text: "Máquina Corporativa: ", bold: true },
    `${Solicitacao.Corporativa === true || Solicitacao.Corporativa === '1' ? "Sim" : "Não"}`,
  ]);

  if (Solicitacao.Maquina !== "LEI SA") {
    detalhes.push([
      { text: "Inibir copos: ", bold: true },
      `${Solicitacao.InibirCopos === true ? "Sim" : "Não"}`,
    ]);
  }

  detalhes.push([
    { text: "Acompanha Gabinete: ", bold: true },
    `${typeof Solicitacao.Gabinete == 'undefined' || Solicitacao.Gabinete === '' || Solicitacao.Gabinete === false || Solicitacao.Gabinete === '0' ? "Não" : "Sim"}`,
  ]);
  detalhes.push([
    { text: "Abastecimento: ", bold: true },
    `${Solicitacao.Abastecimento}`,
  ]);
  detalhes.push([
    { text: "Sistema de Pagamento: ", bold: true },
    `${Solicitacao.Pagamento}`,
  ]);

  if ( Solicitacao.Pagamento === "Validador" || Solicitacao.Pagamento === "Cartão e Validador" ) {
    detalhes.push([
      { text: "Tipo de Validador: ", bold: true },
      `${Solicitacao.TipoValidador}`,
    ]);

    if (Solicitacao.TipoValidador === "Ficha") {
      detalhes.push([
        { text: "Fichas: ", bold: true },
        `${Solicitacao.Validador.toString()}`,
      ]);
    } else if (Solicitacao.TipoValidador === "Moeda") {
      detalhes.push([
        { text: "Moedas: ", bold: true },
        `${Solicitacao.Validador.toString()}`,
      ]);
    } else {
      detalhes.push([
        { text: "Moedas/Fichas: ", bold: true },
        `${Solicitacao.Validador.toString()}`,
      ]);
    }
  }

  detalhes.push([
    { text: "Antena Externa: ", bold: true },
    `${Solicitacao.AntExt === true || Solicitacao.AntExt === '1' ? "Sim" : "Não"}`,
  ]);

  detalhes.push([
    { text: "Operadora do Chip da Telemetria: ", bold: true },
    `${Solicitacao.Chip === '' ? 'Não especificado' : Solicitacao.Chip}`,
  ]);

  Solicitacao.Configuracao.map((bebida) => {
    configArray.push([
      `${bebida.selecao}`,
      `${bebida.bebida.trim()}`,
      `${bebida.medida}ML`,
      `${typeof bebida.valor == 'undefined' || bebida.valor == null || bebida.valor === '' ? '0' : bebida.valor}`,
      `${bebida.tipo}`,
      `${bebida.configura ? "Sim" : "Não"}`,
    ]);
  });

  Solicitacao.Telefone_Contato = Solicitacao.Telefone_Contato.replace(
    /()-/g,
    ""
  );

  /* !!!PDF COMEÇA AQUI!!! */
  var docDefinition = {
    // watermark: Helpers.resourcesPath("logo/Exemplo logo pilao - Danfe.bmp"),
    footer: (currentPage, pageCount) => {
      if (currentPage == pageCount)
        return [
          {
            style: "pilaoInfoTable",
            table: {
              widths: ["auto", "*", "auto", "*", "auto", "*",],
              body: [
                [
                  { text: 'Ativo: ' },
                  { text: Solicitacao.EquipCod ? Solicitacao.EquipCod : '' },
                  { text: 'Telemetria: ' },
                  { text: Solicitacao.TelemetriaNum ? Solicitacao.TelemetriaNum : '' },
                  { text: 'SLRaspy: ' },
                  { text: Solicitacao.SLRaspyNum ? Solicitacao.SLRaspyNum : '' }
                ]
              ],
            },
          },
          { text: `OS ${`000000${ID}`.slice(-6)} - ${currentPage.toString()} de ${pageCount}`, alignment: 'right', style: "footer" }
        ]
      else {
        return [
          { text: `OS ${`000000${ID}`.slice(-6)} - ${currentPage.toString()} de ${pageCount}`, alignment: 'right', style: "footer" }
        ]
      }

    },
    content: [
      { text: "Ordem de Serviço", style: "header" },

      {
        image: Helpers.resourcesPath("logo/Exemplo logo pilao - Danfe.bmp"),
        width: 100,
        absolutePosition: { x: 460, y: 10 },
      },

      {
        text: `OS Nº ${`000000${ID}`.slice(-6)}`,
        bold: true,
        absolutePosition: { x: 461, y: 80 },
      },

      { text: "Solicitante", style: "subheader" },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*", "auto", "auto"],
          body: [
            [
              { text: "Franqueado: ", bold: true },
              `${verified.user_name}`,
              { text: "Filial: ", bold: true },
              `${verified.user_code}`,
            ],
          ],
        },
      },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*", "auto", "auto"],
          body: [
            [
              { text: "Grupo: ", bold: true },
              `${typeof Dados[0] != "undefined"
                ? Dados[0].GrupoVenda.trim()
                : "Não encontrado"
              }`,
              { text: "CNPJ: ", bold: true },
              `${typeof Dados[0] != "undefined"
                ? Dados[0].M0_CGC.trim()
                : "Não encontrado"
              }`,
            ],
          ],
        },
      },

      { text: "Destinatário", style: "subheader" },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*", "auto", "auto"],
          body: [
            [
              { text: "Cliente: ", bold: true },
              `${Solicitacao.Cliente_Destino}`,
              { text: "CNPJ: ", bold: true },
              `${Solicitacao.CNPJ_Destino.trim()}`,
            ],
          ],
        },
      },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*"],
          body: [
            [
              { text: "Endereço: ", bold: true },
              `${Solicitacao.Endereço_Entrega}`,
            ],
          ],
        },
      },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: [
            [
              { text: "Data Solicitada: ", bold: true },
              `${typeof solicitacao == 'undefined' ? new Date()
                .toISOString()
                .split("T")[0]
                .replace(/-/g, "/")
                .split("/")
                .reverse()
                .join("/") : new Date(solicitacao)
                  .toISOString()
                  .split("T")[0]
                  .replace(/-/g, "/")
                  .split("/")
                  .reverse()
                  .join("/")}`,
              { text: "Data Esperada: ", bold: true },
              `${new Date(Solicitacao.Data_Entrega_Desejada)
                .toISOString()
                .split("T")[0]
                .replace(/-/g, "/")
                .split("/")
                .reverse()
                .join("/")}`,
            ],
          ],
        },
      },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: [
            [
              { text: "Contato: ", bold: true },
              `${Solicitacao.Contato}`,
              { text: "Tel: ", bold: true },
              `${[
                Solicitacao.Telefone_Contato.slice(
                  0,
                  Solicitacao.Telefone_Contato.length - 4
                ),
                "-",
                Solicitacao.Telefone_Contato.slice(-4),
              ].join("")}`,
            ],
          ],
        },
      },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*"],
          body: [
            [
              { text: "Email: ", bold: true },
              `${Dados[0].Email}`,
            ],
          ],
        },
      },

      { text: "Configuração", style: "subheader" },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*", "auto", "auto", "auto", "auto"],
          body: configArray,
        },
      },

      { text: "Contenedores", style: "subheader" },

      {
        style: "tableExample",
        table: {
          widths: ["auto"],
          body: contenedores,
        },
      },

      { text: "Detalhes", style: "subheader", pageBreak: "before" },

      {
        style: "tableExample",
        table: {
          widths: ["auto", "*"],
          body: detalhes,
        },
      },

      { text: "Observações", style: "subheader" },

      {
        text:
          Solicitacao.Observacao !== "" ? Solicitacao.Observacao : "Ausente",
      },
    ],
    styles: {
      header: {
        fontSize: 22,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 16,
        bold: true,
        margin: [0, 10, 0, 5],
      },
      tableExample: {
        margin: [0, 0, 0, 0],
      },
      pilaoInfoTable: {
        margin: [10, 0, 10, 0],
      },
      footer: {
        bold: true,
        margin: [0, 0, 10, 0],
      }
    },
  };

  return docDefinition;
};

const defineContenedor = (cont) => {
  switch (cont) {
    case 1:
      return "Café";
    case 2:
      return "Leite";
    case 3:
      return "Cappuccino";
    case 4:
      return "Café c/ Leite";
    case 5:
      return "Achocolatado";
    case 6:
      return "Chá de Limão";
    default:
      return "Desconhecido";
  }
};
