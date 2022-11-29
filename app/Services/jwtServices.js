const Database = use("Database");
const Env = use("Env");
const jwt = require("jsonwebtoken");
const logger = require("../../dump/index")

exports.seeToken = (token) => {
  try {
    const verified = jwt.verify(token, Env.get("APP_KEY"));

    return verified;
  } catch (err) {
    // logger.error({
    //   token: token,
    //   params: null,
    //   payload: null,
    //   err: err.message,
    //   handler: 'jwtServices.seeToken',
    // })
    return err;
  }
};

exports.genToken = async (user_code, password) => {
  //login franqueado
  const user = await Database.select("*")
    .from("dbo.FilialAcesso")
    .where({
      M0_CODFIL: String(user_code),
      Senha: String(password)
    });

  if (user.length > 0) {
    const name = await Database.select("*")
      .from("dbo.FilialEntidadeGrVenda")
      .where({
        M0_CODFIL: user[0].M0_CODFIL
      });

    const token = jwt.sign(
      {
        user_code: user[0].M0_CODFIL,
        grpven: user[0].GrpVen,
        role: "Franquia",
        user_name: name[0].GrupoVenda,
        timestamp: new Date().toISOString(),
      },
      Env.get("APP_KEY"),
      { expiresIn: "2h" }
    );

    return {
      nome: name[0].GrupoVenda,
      token,
      role: "Franquia",
    };

  } else {
    throw new Error('credenciais inválidas');
  }
};

exports.genTokenAdmWithFilial = async (user_code, tokenAdmDecrypted) => {
  const user = await Database
    .select('A1_GRPVEN', 'GrupoVenda')
    .from('dbo.FilialEntidadeGrVenda')
    .where({
      M0_CODFIL: user_code
    })

  if (user.length < 1) throw new Error('Filial não encontrada');

  const token = jwt.sign(
    {
      user_code: user_code,
      grpven: user[0].A1_GRPVEN,
      role: tokenAdmDecrypted.role,
      timestamp: new Date().toLocaleString(),
      user_name: user[0].GrupoVenda,
      admin_code: tokenAdmDecrypted.admin_code,
    },
    Env.get("APP_KEY"),
    {
      expiresIn: "2h",
    }
  );

  return {
    nome: user[0].GrupoVenda,
    token,
    role: tokenAdmDecrypted.role
  };
};

exports.genTokenAdm = async (admin_code, admin_password) => {
  const isAdm = await Database.raw(
    "select O.M0_CODFIL, O.OperNome, F.Senha, T.TopeDes from dbo.Operador as O inner join dbo.FilialAcesso as F on O.M0_CODFIL = F.M0_CODFIL inner join dbo.TipoOper as T on O.TopeCod = T.TopeCod where O.TopeCod <> 3 and O.M0_CODFIL = ? and F.Senha = ?",
    [admin_code, admin_password]
  );

  if (isAdm.length > 0) {
    const token = jwt.sign(
      {
        user_code: '0000',
        grpven: '000000',
        role: isAdm[0].TopeDes,
        timestamp: new Date().toLocaleString(),
        user_name: '',
        admin_code: admin_code,
      },
      Env.get("APP_KEY"),
      {
        expiresIn: "2h",
      }
    );

    return {
      nome: '',
      token,
      role: isAdm[0].TopeDes
    };

  } else {
    throw new Error('credenciais inválidas');
  }
};

exports.genTokenAdmLogout = async (admin_code, admin_role) => {
    const token = jwt.sign(
      {
        user_code: '0000',
        grpven: '000000',
        role: admin_role,
        timestamp: new Date().toLocaleString(),
        user_name: '',
        admin_code: admin_code,
      },
      Env.get("APP_KEY"),
      {
        expiresIn: "2h",
      }
    );

    return {
      nome: '',
      token,
      role: admin_role
    };
};

exports.genTokenExternal = async (code) => {
  try {

    const dados = await Database.select("*")
      .from("dbo.FilialEntidadeGrVenda")
      .where({ M0_CODFIL: code })

    const token = jwt.sign(
      {
        user_code: dados[0].M0_CODFIL,
        grpven: dados[0].A1_GRPVEN,
        role: "Franquia",
        user_name: dados[0].GrupoVenda,
        timestamp: new Date().toISOString(),
      },
      Env.get("APP_KEY"),
      { expiresIn: "2h" }
    );

    return { 
      nome: dados[0].GrupoVenda, 
      token, 
      role: "Franquia" 
    }
  } catch (err) {
    logger.error({
      token: null,
      params: null,
      payload: code,
      err: err.message,
      handler: 'jwtServices.genTokenExternal',
    })
    return null;
  }
};

exports.dateCheck = () => {
  const data = new Date();
  data.setHours(data.getHours() - 3);

  return data.toISOString();
};
