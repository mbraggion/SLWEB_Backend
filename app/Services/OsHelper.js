exports.showStatus = (OS) => {
  if (OS === null) return;

  if (OS.OSCStatus === "Cancelado") {
    return "Nenhuma";
  } else if (OS.OSCStatus === "Concluido") {
    return "Nenhuma";
  } else if (OS.OSCComAceite === false || OS.OSCTecAceite === false) {
    return "Supervisão";
  } else if (OS.OSCComAceite === null && OS.OSCStatus === "Ativo") {
    return "Comercial";
  } else if (OS.OSCTecAceite === null && OS.OSCStatus === "Ativo") {
    return "Técnica (1)";
  } else if (OS.OSCTecDtTermino === null && OS.OSCStatus === "Ativo") {
    return "Técnica (2)";
  } else if (OS.OSCExpDtPrevisao === null && OS.OSCStatus === "Ativo") {
    return "Transporte";
  } else if (OS.OSCExpDtPrevisao !== null && OS.OSCStatus === "Ativo") {
    return "Entrega";
  } else {
    return "Desconhecido";
  }
}

exports.getActualActor = (OS) => {
  if (OS === null) return [];

  if (OS.OSCStatus === "Cancelado") {
    return ["Sistema"];
  } else if (OS.OSCStatus === "Concluido") {
    return ["Sistema"];
  } else if (OS.OSCComAceite === false || OS.OSCTecAceite === false) {
    return ["Sistema"];
  } else if (OS.OSCComAceite === null && OS.OSCStatus === "Ativo") {
    return ["BackOffice", "Sistema"];
  } else if (OS.OSCTecAceite === null && OS.OSCStatus === "Ativo") {
    return ["Técnica Pilão", "Sistema"];
  } else if (OS.OSCTecDtTermino === null && OS.OSCStatus === "Ativo") {
    return ["Técnica Pilão", "Sistema"];
  } else if (OS.OSCExpDtPrevisao === null && OS.OSCStatus === "Ativo") {
    return ["BackOffice", "Sistema"];
  } else if (OS.OSCExpDtPrevisao !== null && OS.OSCStatus === "Ativo") {
    return ["Sistema"];
  } else {
    return [];
  }
}

exports.ContenedoresDB2PDF = (contenedoresFromDB) => {
  let newContenedores = []

  contenedoresFromDB.forEach((contenedor) => {
    if (contenedor.Contenedor !== null) {
      newContenedores = [...newContenedores, ...JSON.parse(
        "[" +
        String(contenedor.Contenedor).replace(/0/g, ",") +
        "]"
      )]
    }
  })

  const newContenedoresSemRepeticao = newContenedores.filter((item, index) => {
    return (newContenedores.indexOf(item) == index)
  })

  return newContenedoresSemRepeticao
}