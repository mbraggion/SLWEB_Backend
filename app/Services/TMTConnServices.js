const Env = use("Env");
const axios = require("axios");
const https = require('https');
const logger = require("../../dump/index")

//faz a autenticacao e devolve um token de acesso ao TMT junto com outras informacoes
exports.GenTokenTMT = async (filial) => {
  const con = PureConnection();

  const Formulario = new URLSearchParams();

  Formulario.append("grant_type", "password");
  Formulario.append("username", Env.get("TMT_USER"));
  Formulario.append("password", Env.get("TMT_PASSWORD"));
  Formulario.append("filial", filial);

  try {
    const response = await con.post("/Token", Formulario)
    
    return response
  } catch (err) {
    logger.error({
      token: null,
      params: null,
      payload: filial,
      err: err.message,
      handler: 'TMTConnServices.GenTokenTMT',
    })
  }
};

exports.ListClients = async (token) => {
  const con = AuthConnection(token);

  try {
    let result = await con.get("api/v1/cliente?ps=10");
    if (result.data.TotalResults > result.data.PageSize) {
      result = await con.get(`api/v1/cliente?ps=${result.data.TotalResults}`);
    }

    return result.data.List;
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: null,
      err: err.message,
      handler: 'TMTConnServices.ListClients',
    })
  }
};

exports.ListCidades = async (token) => {
  const con = AuthConnection(token);

  try {
    let result = await con.get("api/v1/cidade?ps=10");
    if (result.data.TotalResults > result.data.PageSize) {
      result = await con.get(`api/v1/cidade?ps=${result.data.TotalResults}`);
    }

    return result.data.List;
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: null,
      err: err.message,
      handler: 'TMTConnServices.ListCidades',
    })
  }
};

exports.ListInstalacoes = async (token) => {
  const con = AuthConnection(token);

  try {
    let result = await con.get("api/v1/instalacao?ps=10");
    if (result.data.TotalResults > result.data.PageSize) {
      result = await con.get(`api/v1/instalacao?ps=${result.data.TotalResults}`);
    }

    return result.data.List;
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: null,
      err: err.message,
      handler: 'TMTConnServices.ListInstalacoes',
    })
  }
};

exports.ListMaquinas = async (token) => {
  const con = AuthConnection(token);

  try {
    let result = await con.get("api/v1/maquina?ps=10");
    if (result.data.TotalResults > result.data.PageSize) {
      result = await con.get(`api/v1/maquina?ps=${result.data.TotalResults}`);
    }

    return result.data.List;
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: null,
      err: err.message,
      handler: 'TMTConnServices.ListMaquinas',
    })
  }
};

exports.ListSegmentos = async (token) => {
  const con = AuthConnection(token);

  try {
    let result = await con.get("api/v1/segmento?ps=10");
    if (result.data.TotalResults > result.data.PageSize) {
      result = await con.get(`api/v1/segmento?ps=${result.data.TotalResults}`);
    }

    return result.data.List;
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: null,
      err: err.message,
      handler: 'TMTConnServices.ListSegmentos',
    })
  }
};

exports.StoreClient = async (token, cliente, cidade, empresaID, segmento) => {
  const con = AuthConnection(token);
  
  const DTO = {
    EntidadeId: Number(empresaID),
    Codigo: String(cliente.A1_COD).trim(),
    Tipo: String(cliente.TPessoa).trim(),
    Cnpj: String(cliente.CNPJ[0]).trim(),
    Nome: String(cliente.Razão_Social).trim(),
    NomeFantasia: String(cliente.Nome_Fantasia).trim(),
    SegmentoId: Number(segmento.Id),
    CidadeId: Number(cidade.Id),
    Logradouro: String(cliente.PdvLogradouroPV).trim(),
    Numero: cliente.PdvNumeroPV,
    Complemento: String(cliente.PdvComplementoPV).trim(),
    Bairro: String(cliente.PdvBairroPV).trim(),
    CEP: String(cliente.PdvCEP).trim(),
    Celular: `${cliente.DDD}${cliente.Fone}`.trim(),
    Telefone: '',
    Email: cliente.Email,
    NomeContato: cliente.Contato_Empresa
  }

  try {
    await con.post("/api/v1/cliente", DTO);
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: { cliente, cidade, empresaID, segmento },
      err: err.message,
      handler: 'TMTConnServices.StoreClient',
    })
  }

  return
}

exports.StoreInstalacao = async (token, empresaID, maquinaID, clienteID) => {
  const con = AuthConnection(token);
  const DTO = {
    EntidadeId: empresaID,
    MaquinaId: maquinaID,
    ClienteId: clienteID,
    DataDeInstalacao: new Date()
  }

  try {
    await con.post("api/v1/instalacao", DTO);
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: { empresaID, maquinaID, clienteID },
      err: err.message,
      handler: 'TMTConnServices.StoreInstalacao',
    })
  }

  return
}

exports.UpdateClient = async (token, ID, cliente, cidade, empresaID, segmento) => {
  const con = AuthConnection(token);
  
  const DTO = {
    Id: ID,
    EntidadeId: empresaID,
    Codigo: cliente.A1_COD,
    Tipo: cliente.TPessoa,
    Cnpj: cliente.CNPJ[0],
    Nome: cliente.Razão_Social,
    NomeFantasia: cliente.Nome_Fantasia,
    SegmentoId: segmento.Id,
    CidadeId: cidade.Id,
    Logradouro: cliente.PdvLogradouroPV,
    Numero: cliente.PdvNumeroPV,
    Complemento: cliente.PdvComplementoPV,
    Bairro: cliente.PdvBairroPV,
    CEP: cliente.PdvCEP,
    Celular: `${cliente.DDD}${cliente.Fone}`,
    Telefone: '',
    Email: cliente.Email,
    NomeContato: cliente.Contato_Empresa
  }

  try {
    await con.put("/api/v1/cliente", DTO);
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: { ID, cliente, cidade, empresaID, segmento },
      err: err.message,
      handler: 'TMTConnServices.UpdateClient',
    })
  }

  return
}

exports.FecharInstalacoes = async (token, instalacao) => {
  const con = AuthConnection(token);
  const DTO = {
    Id: instalacao.Id,
    EntidadeId: instalacao.EntidadeId,
    MaquinaId: instalacao.MaquinaId,
    ClienteId: instalacao.ClienteId,
    DataDeInstalacao: instalacao.DataDeInstalacao,
    DataDeRemocao: new Date()
  }

  try {
    await con.put("api/v1/instalacao", DTO);
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: instalacao,
      err: err.message,
      handler: 'TMTConnServices.FecharInstalacoes',
    })
  }

  return
}

exports.FindUltimaInstalacao = async (token, ativo) => {
  const con = AuthConnection(token);
  let achou = true;
  let maior = false;
  let result = [];
  let max = await con.get("/api/v1/instalacao?ps=1");
  let resposta = [];

  do {
    result = await con.get(`/api/v1/instalacao?ps=${max.data.TotalResults}`);
    result.data.List.map((maq) => {
      if (String(maq.Matricula) === String(ativo)) {
        resposta.push(maq);
      }
    });
    achou = false;
  } while (achou);

  //se só tiver uma instalação da máquina retorna ela
  if (resposta.length === 1) {
    return resposta[0];
  } else if (resposta.length > 1) {
    //Se houver mais de uma instalação eu comparo elas pra buscar a mais recente
    for (let i = 0; i < resposta.length; i++) {
      for (let j = 0; j < resposta.length; j++) {
        if (
          resposta[i].DataInstalacaoString > resposta[j].DataInstalacaoString
        ) {
          maior = true;
        } else {
          maior = false;
          j = resposta.length;
        }
      }
      if (maior) {
        return resposta[i];
      }
    }
  } else {
    //se não houver nenhuma instalação da máquina
    return null;
  }
};

exports.FindEnderecoPorInstalacaoCliente = async (token, instalacao) => {
  if (instalacao === null) {
    return { data: "Localização não encontrada" };
  }
  const con = AuthConnection(token);

  try {
    return await con.get(`/api/v1/cliente/${instalacao.ClienteId}`);
  } catch (err) {
    logger.error({
      token: token,
      params: null,
      payload: instalacao,
      err: err.message,
      handler: 'TMTConnServices.FindEnderecoPorInstalacaoCliente',
    })
  }
};

//conexão não autenticada
const PureConnection = () =>
  axios.create({
    baseURL: `${Env.get("TMT_URL")}`,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    crossDomain: true,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  });

//conexão autenticada 
const AuthConnection = (token) =>
  axios.create({
    baseURL: `${Env.get("TMT_URL")}`,
    headers: {
      "Access-Control-Allow-Origin": "*",
      Authorization: "Bearer " + token,
    },
    crossDomain: true,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  });
