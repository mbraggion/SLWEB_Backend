"use strict";

const Database = use("Database");
const Drive = use('Drive')
const { seeToken } = require("../../../Services/jwtServices");
const logger = require("../../../../dump/index")
const moment = require('moment')
const fs = require('fs');
const path = require('path');
moment.locale("pt-br");

class CompartilhamentoController {
  //
  async Show({ request, response, params }) {
    const token = request.header("authorization");
    let folder = params.folder
    let folderPath = null
    let folderAlias = null

    try {
      const verified = seeToken(token);

      //pego a raiz dos arquivos
      let root = null

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(folder, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      // verificar se houve solicitação de uma pasta em especifico
      if (folder === 'root') {
        root = await Database
          .select('*')
          .from('dbo.SLWEB_Compartilhamento_Index')
          .where({
            type: returnRootPathByRole(verified.role)
          })

        folderPath = root[0].path
        folderAlias = root[0].path_alias
      } else {
        root = await Database
          .select('*')
          .from('dbo.SLWEB_Compartilhamento_Index')
          .where({
            type: returnRootPathByRole(verified.role)
          })

        //substituo o apelido da raiz pela propria raiz
        folderPath = decodeURI(folder).replace(root[0].path_alias, root[0].path)

        folderAlias = decodeURI(folder)
      }


      let dirMap = fs.readdirSync(folderPath).map(fileName => {
        return fileName;
      })

      let files = dirMap.filter(arq =>
        arq.includes('.') && (
          !arq.includes('.lnk') &&
          !arq.includes('.db') &&
          !arq.includes('.log') &&
          !arq.includes('.DS_Store') &&
          arq.charAt(0) !== '.'
        )
      ).map(filename => { return ({ filename: filename, path: path.join(folderAlias, filename) }) })

      let folders = dirMap.filter(arq =>
        !arq.includes('.')
      ).map(folder => { return ({ folder: folder, path: path.join(folderAlias, folder) }) })

      folders = await somehowRemoveFilesOrDirectoriesUnauthorizedToTheUser(folders, verified)
      files = await somehowRemoveFilesOrDirectoriesUnauthorizedToTheUser(files, verified)

      let controls = {
        security: false,
        upload: false,
        createFolder: false,
        downloadContent: false,
        renameContent: false,
        moveContent: false,
        blockContent: false,
        deleteContent: false
      }

      if (verified.role === "Sistema") {
        controls.security = true
        controls.upload = true
        controls.createFolder = true
        controls.downloadContent = true
        controls.renameContent = true
        controls.moveContent = true
        controls.blockContent = true
        controls.deleteContent = true
      } else if (verified.role === "Franquia") {
        controls.security = false
        controls.upload = false
        controls.createFolder = false
        controls.downloadContent = true
        controls.renameContent = false
        controls.moveContent = false
        controls.blockContent = false
        controls.deleteContent = false
      } else if (verified.role === "Marketing") {
        controls.security = false
        controls.upload = true
        controls.createFolder = true
        controls.downloadContent = true
        controls.renameContent = true
        controls.moveContent = true
        controls.blockContent = false
        controls.deleteContent = true
      } else {
        controls.security = false
        controls.upload = true
        controls.createFolder = true
        controls.downloadContent = true
        controls.renameContent = true
        controls.moveContent = true
        controls.blockContent = true
        controls.deleteContent = true
      }

      response.status(200).send({
        arquivos: files,
        pastas: folders,
        pathSegments: folderAlias.split('\\').filter(p => p !== ''),
        controlModals: controls,
        enviroment: await returnFolderEnviroment(folderPath)
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.Show',
      })
    }
  }
  //
  async Download({ request, response, params }) {
    const token = request.header("authorization");
    const filePath = params.filepath

    try {
      const verified = seeToken(token);

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(filePath, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      //pego a raiz dos arquivos
      const root = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: returnRootPathByRole(verified.role)
        })

      const fullFilePath = decodeURI(filePath).replace(root[0].path_alias, root[0].path)

      response.attachment(fullFilePath)
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.Download',
      })
    }
  }
  //
  async Upload({ request, response }) {
    const token = request.header("authorization");
    const multiples = request.input('multiple')
    const targetFolder = request.input('targetFolder')
    const formData = request.file("formData", { types: ["image", "pdf", "video", 'application'] });

    try {
      const verified = seeToken(token);

      //verificar se o cara pode fazer upload
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(targetFolder, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      const root = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: returnRootPathByRole(verified.role)
        })

      //substituo o apelido da raiz pela propria raiz
      const fullPathToFiles = decodeURI(targetFolder).replace(root[0].path_alias, root[0].path)

      //verificar se é um ou muitos arquivos
      if (multiples === 'N') {
        await formData.move(fullPathToFiles, {
          name: formData.clientName,
          overwrite: true
        });

      } else {
        await formData.moveAll(fullPathToFiles, (file) => {
          return {
            name: file.clientName,
            overwrite: true,
          };
        })
      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.Upload',
      })
    }
  }
  //
  async ShowIndexedFolders({ request, response }) {
    const token = request.header("authorization");

    try {
      const verified = seeToken(token);

      //verificar se o cara é usuário sistema
      if (verified.role !== "Sistema") {
        response.status(400).send('Usuário não permitido')
        return
      }

      //retornar a lista das tela indexadas e o TipoOper
      const dir = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .orderBy('type', 'ASC')

      const TipoOperadores = await Database
        .select('*')
        .from('dbo.TipoOper')
        .orderBy('AccessLevel', 'ASC')

      let aux = []

      TipoOperadores.forEach(op => {
        let index = null

        aux.forEach((opr, i) => {
          if (op.AccessLevel === opr.AccessLevel) {
            index = i
          }
        })

        if (index !== null) {
          aux[index] = {
            ...aux[index],
            Members: aux[index].Members + `, ${op.TopeDes}`
          }
        } else {
          aux.push({
            AccessLevel: op.AccessLevel,
            Group: `Nivel ${op.AccessLevel}`,
            Members: op.TopeDes,
          })
        }
      })

      response.status(200).send({
        indexedFolders: dir,
        tipoOperadores: aux
      });
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.ShowIndexedFolders',
      })
    }
  }
  //
  async UpdateIndexedFolder({ request, response }) {
    const token = request.header("authorization");
    const { path, newGroup } = request.only(['path', 'newGroup']);

    try {
      const verified = seeToken(token);

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(path, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      //verificar se é sistema
      if (verified.role !== "Sistema") {
        response.status(400).send('Usuário não permitido')
        return
      }

      //fazer update
      await Database.table("dbo.SLWEB_Compartilhamento_Index")
        .where({
          path: decodeURI(path),
        })
        .update({
          AccessLevel: newGroup,
        });

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.UpdateIndexedFolder',
      })
    }
  }
  //
  async IndexFolder({ request, response }) {
    const token = request.header("authorization");
    const { path, type } = request.only(['path', 'type']);

    try {
      const verified = seeToken(token);

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(path, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      const root = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: returnRootPathByRole(verified.role)
        })

      await Database.insert({
        AccessLevel: 1,
        path: decodeURI(path).replace(root[0].path_alias, root[0].path),
        path_alias: decodeURI(path).replace(root[0].path_alias, root[0].path).split('\\')[decodeURI(path).replace(root[0].path_alias, root[0].path).split('\\').length - 1],
        type: type,
      }).into('dbo.SLWEB_Compartilhamento_Index')

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.IndexFolder',
      })
    }
  }
  //
  async MoveToTrash({ request, response, params }) {
    const token = request.header("authorization");
    const filepath = params.filepath;

    try {
      const verified = seeToken(token);

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(filepath, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      let root = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: returnRootPathByRole(verified.role)
        })

      let trashFolder = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: 'TRASH_DUMP'
        })

      // substituir o alias pelo path
      let oldPath = decodeURI(filepath).replace(root[0].path_alias, root[0].path)

      // substituir o path antigo pelo path de lixeira
      let newPath = oldPath.replace(root[0].path, trashFolder[0].path)

      // mover
      await Drive.move(oldPath, newPath, {
        overwrite: true
      })

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: params,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.MoveToTrash',
      })
    }
  }
  //
  async CreateFolder({ request, response }) {
    const token = request.header("authorization");
    const { dirName } = request.only(['dirName'])

    try {
      const verified = seeToken(token);

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(dirName, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      const root = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: returnRootPathByRole(verified.role)
        })

      const fullDirPath = decodeURI(dirName).replace(root[0].path_alias, root[0].path)

      if (!fs.existsSync(fullDirPath)) {
        fs.mkdirSync(fullDirPath);
      }

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.CreateFolder',
      })
    }
  }
  //
  async Rename({ request, response }) {
    const token = request.header("authorization");
    const { currPath, newPath } = request.only(['currPath', 'newPath']);

    try {
      const verified = seeToken(token);

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(currPath, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      const root = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: returnRootPathByRole(verified.role)
        })

      const fixedCurrPath = decodeURI(currPath).replace(root[0].path_alias, root[0].path)
      const fixedNewPath = decodeURI(newPath).replace(root[0].path_alias, root[0].path)

      fs.renameSync(fixedCurrPath, fixedNewPath)

      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.Rename',
      })
    }
  }
  //
  async Move({ request, response }) {
    const token = request.header("authorization");
    const { currPath, newPath, type } = request.only(['currPath', 'newPath', 'type']);

    try {
      const verified = seeToken(token);

      //verificar permissão do usuário
      if (await somehowVerifyIfUserShouldHaveAccessToFileOrDirectory(currPath, verified)) {
        response.status(400).send('Acesso bloqueado')
        return
      }

      let root = await Database
        .select('*')
        .from('dbo.SLWEB_Compartilhamento_Index')
        .where({
          type: returnRootPathByRole(verified.role)
        })

      // substituir o alias pelo path
      let oldPath = decodeURI(currPath).replace(root[0].path_alias, root[0].path)

      // substituir o path antigo pelo path de lixeira
      let targetPath = decodeURI(newPath).replace(root[0].path_alias, root[0].path)

      if (type === 'file') {
        fs.copyFileSync(oldPath, targetPath)

        fs.rmSync(oldPath)
      } else if (type === 'folder') {
        let newPath = targetPath.toString().replace(/,/g, '\\')

        copyFolderRecursiveSync(oldPath, newPath)

        fs.rmdirSync(oldPath, { recursive: true, force: true })
      }


      response.status(200).send();
    } catch (err) {
      response.status(400).send();
      logger.error({
        token: token,
        params: null,
        payload: request.body,
        err: err.message,
        handler: 'CompartilhamentoController.Move',
      })
    }
  }
}

module.exports = CompartilhamentoController;

//verificar se o usuário tem direito a pasta/arquivos
const somehowVerifyIfUserShouldHaveAccessToFileOrDirectory = async (filepath, decriptedToken) => {
  let isBlockedFolder = false

  const compartilhamentoIndex = await Database
    .select('*')
    .from('dbo.SLWEB_Compartilhamento_Index')


  const OperAccessLevel = await Database
    .select('AccessLevel')
    .from('dbo.TipoOper')
    .where({
      TopeDes: decriptedToken.role
    })

  //verificar se esta tentando acessar a raiz dos arquivos
  if (filepath === 'root') {
    // verificar se a raiz dos arquivos pode ser acessada por ele
    if (compartilhamentoIndex.filter(folder => folder.type === returnRootPathByRole(decriptedToken.role))[0].AccessLevel <= OperAccessLevel[0].AccessLevel) {
      isBlockedFolder = false
    } else {
      isBlockedFolder = true
    }
  } else {
    //verificar se a o caminho que está tentando acessar está disponivel
    const blockedFolders = compartilhamentoIndex.map(indexedFolder => indexedFolder.AccessLevel > OperAccessLevel[0].AccessLevel ? indexedFolder.path : null)

    blockedFolders.forEach(BF => {
      if (String(
        decodeURI(filepath).replace(
          compartilhamentoIndex
            .filter(
              index => index.type === returnRootPathByRole(decriptedToken.role)
            )[0].path_alias,
          compartilhamentoIndex
            .filter(
              index => index.type === returnRootPathByRole(decriptedToken.role)
            )[0].path
        )
      ).includes(BF)) {
        isBlockedFolder = true
      }
    })
  }

  return isBlockedFolder
}

//remove pastas/arquivos que o usuário não tem direito do resultado da varredura do DIR
const somehowRemoveFilesOrDirectoriesUnauthorizedToTheUser = async (dir, decriptedToken) => {
  let clearDir = []

  const compartilhamentoIndex = await Database
    .select('*')
    .from('dbo.SLWEB_Compartilhamento_Index')

  const OperAccessLevel = await Database
    .select('AccessLevel')
    .from('dbo.TipoOper')
    .where({
      TopeDes: decriptedToken.role
    })

  //verificar se a o caminho que está tentando acessar está disponivel
  const blockedFolders = compartilhamentoIndex.map(indexedFolder => indexedFolder.AccessLevel > OperAccessLevel[0].AccessLevel ? indexedFolder.path : null)

  dir.forEach(item => {
    let isBlockedItem = false

    let formatedItemName = String(item.path)
      .replace(
        compartilhamentoIndex
          .filter(
            index => index.type === returnRootPathByRole(decriptedToken.role)
          )[0].path_alias,
        compartilhamentoIndex
          .filter(
            index => index.type === returnRootPathByRole(decriptedToken.role)
          )[0].path
      )

    blockedFolders.forEach(blockedFolder => {
      if (formatedItemName.includes(blockedFolder)) {
        isBlockedItem = true
      }
    })

    if (!isBlockedItem) {
      clearDir.push(item)
    }
  })

  return clearDir
}

const returnRootPathByRole = (role) => {
  switch (role) {
    case 'Sistema':
      return 'ROOT'
    case 'Marketing':
      return 'ROOT'
    // case 'Marketing':
    //   return 'PRIVATE_DUMP'
    default:
      return 'FRANQUEADO_DUMP'
  }
}

const returnFolderEnviroment = async (folderPath) => {
  //pegar todas as pastas "root"
  const dumpFolders = await Database.raw("select * from dbo.SLWEB_Compartilhamento_Index where type like '%DUMP'")
  const rootFolders = await Database.raw("select * from dbo.SLWEB_Compartilhamento_Index where type like '%ROOT'")

  if (folderPath === rootFolders[0].path) {
    return 'ROOT'
  }

  if (dumpFolders.filter(df => df.path === folderPath).length > 0) {
    return 'DUMP'
  }

  let foldersWithinDump = dumpFolders.filter(df => folderPath.includes(df.path))

  if (foldersWithinDump.length > 0) {
    return foldersWithinDump[0].type
  }

  return null
}

function copyFileSync(source, target) {

  var targetFile = target;

  // If target is a directory, a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  var files = [];

  // Check if folder needs to be created or integrated
  var targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function (file) {
      var curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}
