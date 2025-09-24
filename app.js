const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
require('dotenv').config();
const path = require('path');
var tcpPortUsed = require('tcp-port-used');
const serverManager = require('./app/modules/server');
const webSocketManager = require('./app/modules/websocket');
const selectConnection = require('./app/modules/connection_manager');
const sharkManager = require('./app/modules/shark');
const { spawn } = require('child_process');
const axios = require('axios')
const mainDb = require('./app/modules/main_db');
const Store = require('electron-store');
const fs = require('fs');
const logsDir = "C:\\Users\\Public\\Documents\\MoraLink";
const logFilePath = path.join(logsDir, "logfile.txt");
var cron = require('node-cron');
var _ = require('lodash');
const moment = require('moment');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
let isDev = app.isPackaged
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.lookup('sharkbusiness.com.br', (err, address) => {
  if (err) console.error('Erro de DNS:', err);
  else console.log('Endereço IP:', address);
});
if (isDev) {
  // Redireciona o console.log para o arquivo
  console.log = function (...args) {
    logStream.write(new Date().toLocaleString('pt-BR') + " - " + args.join(' ') + '\n');
  };

  // Redireciona os erros para o arquivo
  console.error = function (...args) {
    logStream.write(new Date().toLocaleString('pt-BR') + " - " + args.join(' ') + '\n');
  };

  // Redireciona outros tipos de log como warn
  console.warn = function (...args) {
    logStream.write(new Date().toLocaleString('pt-BR') + " - " + args.join(' ') + '\n');
  };
}
let db = new mainDb()
let Shark = new sharkManager(db)
let serverDB = undefined
const { log } = require('./app/modules/logger');

let APIClienteToken = {
}
process.on('unhandledRejection', (reason, promise) => {
  log('electron', 'unhandled_rejection', {
    reason: reason.message,
    stack: reason.stack
  });
});

// Tratamento global de exceções
process.on('uncaughtException', async (error) => {
  log('electron', 'uncaught_exception', {
    error: error.message,
    stack: error.stack
  });
  // Forçar recriação de conexões
  USERINFO = await db.exec("SELECT ci.*,dbc.config_json,dbc.type FROM client_info ci LEFT JOIN db_conn_client_info dbc on dbc.id_client_info = ci.id WHERE token = '" + token + "'")
  USERINFO = USERINFO[0]
  serverDB = await new selectConnection(USERINFO.type)
  serverDB = serverDB.selectConnectionType()
  serverDB = new serverDB(USERINFO.config_json)
  await serverDB.connect()
});
require('dotenv').config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(process.cwd(), '.env'),
})

const { autoUpdater } = require('electron-updater');
const appVersion = app.getVersion()
// Configurações adicionais (opcional)
autoUpdater.autoDownload = true; // Define se o download é automático
autoUpdater.allowPrerelease = false; // Bloqueia versões beta

// Eventos do autoUpdater
autoUpdater.on('checking-for-update', () => {
  console.log('Verificando atualizações...');
});
autoUpdater.on('update-available', async (info) => {
  console.log(`Uma nova versão (${info.version}) está disponível.`)
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Baixar e Instalar', 'Cancelar'],
    title: 'Nova Versão Disponível',
    message: `Uma nova versão (${info.version}) está disponível. Deseja atualizar agora?`,
  });
  if (response === 0) {
    autoUpdater.downloadUpdate();
  }
});
autoUpdater.on('update-not-available', () => {
  console.log('Nenhuma atualização encontrada.');
});

autoUpdater.on('error', (err) => {
  console.error('Erro ao buscar atualização:', err);
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`Progresso: ${Math.round(progress.percent)}%`);
});

autoUpdater.on('update-downloaded', () => {
  console.log('Atualização baixada. Reiniciando...');
  autoUpdater.quitAndInstall(); // Reinicia o app e aplica a atualização
});

// Verifica atualizações no início do app
app.whenReady().then(() => {
  autoUpdater.checkForUpdates();
});

let USERINFO = undefined
const webSokcet = new webSocketManager()
console.log('------------',)
app.commandLine.appendArgument("--disable-gpu");

// Cria o diretório de logs recursivamente, se necessário

// Cria o arquivo de log se não existir
if (!fs.existsSync(logFilePath)) {
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(logFilePath, ''); // Cria o arquivo vazio
} else {
  fs.writeFileSync(logFilePath, ''); // Cria o arquivo vazio

}

// Cria o fluxo de escrita para o arquivo de log

const store = new Store();
let token = undefined
let cronReconnect = undefined
async function startSharkConn() {
  token = await Shark.getToken()
  if (cronReconnect != undefined) {
    cronReconnect.stop()
  }
  USERINFO = await db.exec("SELECT ci.*,dbc.config_json,dbc.type FROM client_info ci LEFT JOIN db_conn_client_info dbc on dbc.id_client_info = ci.id WHERE token = '" + token + "'")
  USERINFO = USERINFO[0]
  if (token != undefined) {
    store.set('cron_shark', USERINFO.cronjob)
    try {
      if (store.get('cron_shark') != undefined) {
        console.log('CRIANDO CRONJOB :', store.get('cron_shark'))
        cron.schedule(store.get('cron_shark'), async () => {
          console.log('Rodando no cron shark');
          const execPath = process.execPath;
          // Recria o app manualmente
          spawn(execPath, [], {
            detached: true,
            stdio: 'ignore'
          }).unref();
          // Força encerramento total
          process.exit(0);

        });
      }
    } catch (e) {
      console.log('ERRO AO INICIAR CRON COM TIMER PERSONALIZADO', e)
      cron.schedule('0 2 * * *', () => {
        console.log('running at 02:00AM');
      });
    }
    if (serverDB === undefined) {
      serverDB = await new selectConnection(USERINFO.type)
      serverDB = serverDB.selectConnectionType()
      serverDB = new serverDB(USERINFO.config_json)
      await serverDB.connect()
    }
    console.log('Indo ali abrir o websocket manualmente -> ', store.get('user'))
    webSokcet.openWebSocket(token, store.get('user'), serverDB, USERINFO.domainws, app, autoUpdater, Shark)
  } else {
    cronReconnect = cron.schedule("0 * * * *", async () => {
      startSharkConn()
    });
    console.log('TOKEN UNDEFINED', token)
  }
}
console.log('Rodando versao :', appVersion, process.env.SSH_DB_HOST)
const gotTheLock = app.requestSingleInstanceLock()
let tray = null;
let mainWindow = null;
app.setLoginItemSettings({
  openAtLogin: true,
});
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    if (mainWindow === null) {
      createWindow();
      mainWindow.focus()

    }
  })
  // parse application/json
  const server = new serverManager()
  // autoUpdater.checkForUpdatesAndNotify()
  // autoUpdater.on('checking-for-update', () => {
  //   console.log('Checking for update...');
  // });
  // autoUpdater.on('update-available', (info) => {
  //   console.log('Update available.');
  //   mainWindow.webContents.send('changePercentDisplay', "block")
  // });
  // autoUpdater.on('update-not-available', (info) => {
  //   console.log('Update not available.');
  // });
  // autoUpdater.on('error', (err) => {
  //   console.log('Error in auto-updater. ' + err);
  // });
  // autoUpdater.on('download-progress', (progressObj) => {
  //   let log_message = 'Progresso Atualização :' + parseFloat(progressObj.percent).toFixed(2) + '%';
  //   if (mainWindow !== null) {
  //     mainWindow.webContents.send('update', log_message)
  //   }
  //   console.log(log_message);
  // });

  // autoUpdater.on('update-downloaded', (info) => {
  //   console.log('Updated');
  //   mainWindow.webContents.send('changePercentDisplay', "none")


  // });
  function createWindow() {
    if (mainWindow != null) {
      mainWindow.destroy()
    };
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: __dirname + 'app/assets/images/favicon_io/Group 10.png',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: true
      }
    });

    mainWindow.loadURL('file://' + __dirname + '/index.html');
    //render to main 2-way
    mainWindow.webContents.on('crashed', (e) => {
      app.relaunch();
      app.quit()
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    setTimeout(() => {
      if (mainWindow != null) {

        mainWindow.webContents.send("getVersion", appVersion)

        mainWindow.webContents.send("getPort", store.get("PORT"))
      }

    }, 500)
  }

  function createTray() {
    tray = new Tray(path.join(__dirname, "app", "assets", "images", "favicon_io", 'Group 10.png')); // Path to your tray icon
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir', click: () => createWindow() },
      { label: 'Fechar ( parar app )', click: () => app.quit() }
    ]);
    tray.setToolTip('MoraLink');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      createWindow()
    });
  }
  app.whenReady().then(() => {
    tcpPortUsed.check(parseInt(server.getPort()), '127.0.0.1')
      .then(function (inUse) {
        if (inUse) {
          console.log("parou")
          createWindow();
          mainWindow.webContents.send('alert', "Porta Ocupada, caso não seja a própria MoraLink, altere a porta nas configurações do aplicativo.", "Mensagem do Sistema", "700px", 'fa fa-warning')
          // app.exit(0)
          return;
        } else {
          createTray()
          setTimeout(() => {
            ipcMain.on('renderToMainOneWay', (event, arg) => {
              console.log("arg")
              return arg
            })
          }, 500)
          server.startServer();
        }
      }, function (err) {
        console.error('Error on check:', err.message);
      });



  });

  app.on('window-all-closed', () => {

  });
  function waitForNetwork(callback, interval = 5000) {
    const check = () => {
      dns.lookup('google.com', (err) => {
        if (!err) {
          callback();
        } else {
          setTimeout(check, interval);
        }
      });
    };
    check();
  }
  async function safeStartConnection() {
    try {
      await startConnection();
    } catch (e) {
      console.log('Falha ao iniciar SharkConn, tentando novamente em 10s', e);
      setTimeout(safeStartSharkConn, 10000);
    }
  }
  app.on('ready', () => {
    console.log('Electron ready event triggered at', new Date().toLocaleString());
    waitForNetwork(async () => {
      console.log('Rede ativa, iniciando módulos...');
      await safeStartConnection()
      // Qualquer outro módulo que dependa de rede

      cron.schedule("0 3 * * *", async () => {
        app.relaunch();
        app.exit(0);
      });
      ipcMain.handle('restartServer', async (event, arg) => {
        console.log(arg)
        server.setPort(arg)
        return "funcionou"
      })
      ipcMain.handle('setVariable', async (event, id, value) => {
        store.set(id, value, 3000);
        return 200
      })
      ipcMain.handle('syncShark', async () => {
        try {
          startSharkConn()
          return 200
        } catch (e) {
          console.log('ERRO AO SINCRONIZAR BANCO DE DADOS get token', e)
          return 400
        }

      })
      ipcMain.handle('getVariable', async (event, arg) => {
        let variable = store.get(arg, "(EMPTY)")
        if (variable == "") {
          variable = "(EMPTY)"
        }
        return variable;
      })
      ipcMain.handle('checkPort', async (event, arg) => {
        try {
          let using = await tcpPortUsed.check(parseInt(arg), '127.0.0.1');
          console.log(using);
          return using;
        } catch (error) {
          console.error(error);
          return false;
        }
      })
    })
  });
  app.on('activate', () => {
    if (mainWindow === null) {
      createTray()
    }
  });
}

async function startConnection() {
  console.log('StartConnection rodous')
  await db.connect()

  if (store.get('chat_shark') != undefined && store.get('chat_shark') != '(EMPTY)') {
    cron.schedule('*/7 * * * *', async () => {
      await syncEstoque()
    });
  }
  console.log(store.get('user'))
  if (store.get('user') != undefined != undefined) {
    startSharkConn()
    // await fullSyncDB()
  }
}
function compareObjects(objetoBase, objetoAoAnalisar, comparar = true) {
  if (!comparar || objetoBase == undefined || objetoBase == null) return false
  let distinct = false
  Object.keys(objetoBase).forEach(e => {
    if (objetoBase[e] instanceof Date || objetoAoAnalisar[e] instanceof Date || objetoAoAnalisar[e] == `Invalid date` || objetoBase[e] == `Invalid date`) {
      objetoBase[e] = moment(objetoBase[e]).format('YYYY-MM-DD')
      objetoAoAnalisar[e] = moment(objetoAoAnalisar[e]).format('YYYY-MM-DD')

    }
    try {
      if (objetoBase[e].toString().replace(/ /g, '') != objetoAoAnalisar[e].toString().replace(/ /g, '')) {
        console.log('APP.JS -> ', e, `'${objetoBase[e]}'`, `'${objetoAoAnalisar[e]}'`)
        distinct = true
      }
    } catch {
      if (objetoBase[e] != objetoAoAnalisar[e]) {
        console.log('APP.JS -> ', e, `'${objetoBase[e]}'`, `'${objetoAoAnalisar[e]}'`)

        distinct = true
      }
    }

  })
  return distinct
}

// async function getInfosBetweenPages(url, type, body, headers, batchSize = 1) {
//   let page = 1
//   let arrayCompleto = [];
//   let hasMorePages = true;
//   let pageSelected = undefined
//   const fetchPage = async (currentPage) => {
//     pageSelected = currentPage
//     try {
//       if (hasMorePages) {

//         const response = await sendRequestToClientAPI(`${url}page=${currentPage}`, type, undefined, headers)
//         if (response.data.data.length == 0) {
//           hasMorePages = false
//         }
//         return response.data.data;

//       } else {
//         return []
//       }
//     }
//     catch (e) {
//       hasMorePages = false
//     }
//   };

//   try {
//     let currentPage = page;

//     while (hasMorePages) {
//       const promises = [];

//       // Adiciona as requisições do batch
//       for (let i = 0; i < batchSize; i++) {
//         promises.push(fetchPage(currentPage + i));
//       }

//       // Executa todas as requisições do batch
//       const responses = await Promise.all(promises);

//       for (const response of responses) {
//         arrayCompleto.push(...response);
//         if (response.length == 0) {
//           hasMorePages = false
//         }


//       }

//       // Atualiza a página inicial do próximo batch
//       currentPage += batchSize;
//     }

//     return arrayCompleto;
//   } catch (error) {
//     console.error('Erro ao buscar infos', `${url}page=${pageSelected}`, type);
//     throw error;
//   }
// }
// async function sendRequestToClientAPI(url, type, body, headers = undefined) {
//   const config = {
//     method: type,
//     maxBodyLength: Infinity,
//     url: url,
//     headers: headers || {
//       "Content-Type": "application/json",
//       "User-Agent": "insomnia/2023.5.8",
//       "Authorization": `Token ${token}`,
//     },
//     data: body
//   };

//   const response = await axios.request(config);
//   return response
// }
// async function getTokenAPICliente(url, type, tokenBody, responseKeysMap) {
//   if (APIClienteToken['token'] != undefined) {
//     return APIClienteToken
//   }
//   let resposta = await sendRequestToClientAPI(url, type, tokenBody)
//   resposta = resposta.data
//   console.log(resposta)
//   let token = resposta[responseKeysMap["token"]]
//   let expiresIn = resposta[responseKeysMap["expires_in"]]
//   let token_type = resposta[responseKeysMap["token_type"]]
//   if (APIClienteToken['timeout_id'] != undefined) {
//     clearTimeout(APIClienteToken['timeout_id']);
//   }
//   APIClienteToken['token'] = token
//   APIClienteToken['token_type'] = token_type
//   APIClienteToken['timeout_id'] = setTimeout(() => {
//     console.log('Limpando Token')
//     APIClienteToken = {}
//   }, expiresIn * 1000);
//   return APIClienteToken
// }
function inverse(obj) {
  var retobj = {};
  for (var key in obj) {
    retobj[obj[key]] = key;
  }
  return retobj;
}
// async function sendToDB(resultado, elementKey, token) {
//   const batchSize = 150;
//   const batches = splitIntoBatches(resultado, batchSize);
//   console.log(`Buscando ${elementKey} no DB do token = ${token}`)
//   let colunaSelect = Object.keys(batches[0][0])
//   let allInfoFromDB = await db.exec(`SELECT ${colunaSelect.map(f =>`\`${f}\``).join(',')} FROM ${elementKey} WHERE token = '${token}';`);
//   console.log(`SELECT ${colunaSelect.map(f => `\`${f}\``).join(',')} FROM ${elementKey} WHERE token = '${token}';`)
//   for (const batch of batches) {
//     await Promise.all(batch.map(async e => {
//       try {
//         e['token'] = token;
//         delete e['uid']
//         delete e['last_update']
//         delete e['empresa']
//         let colunas = Object.keys(e);
//         let colunasJSON = ['produtos_venda', 'datas_vencimento'];
//         let colunaWithoutSingleQuote = ['nome']
//         let inDB = allInfoFromDB.find(info => info.id_externo == e.id_externo)
//         let valoresColunas = colunas.map(f => {
//           if (e[f] instanceof Date) {
//             e[f] = e[f].toISOString();
//             return `"${e[f]}"`;
//           } else if (colunasJSON.includes(f)) {
//             e[f] = JSON.stringify(e[f]).replace(/'/g, `''`);
//             return `'${e[f]}'`;
//           } else if (typeof e[f] === 'object') {
//             e[f] = JSON.stringify(e[f]).replace(/'/g, `''`);

//             return `'${e[f]}'`;
//           } else if (e[f].toString().includes("'") || colunaWithoutSingleQuote.includes(f)) {
//             e[f] = e[f].toString()?.replace(/'/g, `''`)
//             return `'${e[f].toString()}'`;
//           }
//           return `'${e[f] || ''}'`;
//         });
//         if (inDB != undefined) {
//           delete inDB['uid']
//           delete inDB['last_update']
//           delete inDB['empresa']
//           colunas.forEach(f => {
//             if (e[f] instanceof Date) {
//               inDB[f] = inDB[f].toISOString();
//             } else if (colunasJSON.includes(f)) {
//               inDB[f] = JSON.stringify(inDB[f]).replace(/'/g, `''`);
//             } else if (typeof e[f] === 'object') {
//               inDB[f] = JSON.stringify(inDB[f]).replace(/'/g, `''`);
//             } else if (e[f].toString().includes("'") || colunaWithoutSingleQuote.includes(f)) {
//               inDB[f] = inDB[f]?.toString()?.replace(/'/g, `''`)
//             }
//           });
//           if (compareObjects(inDB, e)) {
//             e['last_update'] = moment().format();
//             await db.exec(`UPDATE ${elementKey} SET ${colunas.map(f => `\`${f}\` = '${e[f] || ''}'`).join(',')} WHERE id_externo = '${e.id_externo}'`);
//           }
//         } else {
//           await db.exec(`INSERT INTO ${elementKey} (${colunas.map(f => `\`${f}\``).join(',')}) VALUES (${valoresColunas.join(',')})`);
//         }
//       } catch (e) {
//         console.log('Erro ->', e)
//       }
//     }));
//   }
// }

async function syncEstoque() {
  if (store.get('chat_shark') != undefined && store.get('chat_shark') != '(EMPTY)') {
    console.log('Sincronizando Estoque')
    if (store.get('query_db') != undefined) {
      USERINFO = await db.exec("SELECT ci.*,dbc.config_json,dbc.type FROM client_info ci LEFT JOIN db_conn_client_info dbc on dbc.id_client_info = ci.id WHERE token = '" + token + "'")
      USERINFO = USERINFO[0]
      serverDB = await new selectConnection(USERINFO.type)
      serverDB = serverDB.selectConnectionType()
      serverDB = new serverDB(USERINFO.config_json)
      await serverDB.connect()
      let querys = JSON.parse(store.get('query_db'))
      let resultado = undefined
      if (store.get('token_url') != undefined && store.get('token_url') != '(EMPTY)') {
        let tokenInfo = querys['token']
        let tokenBody = JSON.parse(JSON.stringify(tokenInfo.getTokenBody).replace(/{{token}}/g, store.get('password_db')))
        let tokenResponse = await getTokenAPICliente(store.get('token_url'), 'POST', tokenBody, tokenInfo.getTokenResponseKeys)
        delete querys['token']
        let token_api_cliente = tokenResponse.token
        resultado = await getResultadoFromAPI(querys['produtos'], token_api_cliente, tokenResponse)
      } else {
        resultado = await serverDB.exec(querys.produtos)
      }
      const batchSize = 200; // Conferir depois kkkkkk
      const batches = splitIntoBatches(resultado, batchSize);
      let alreadySent = 0
      let produtosAlterados = 0
      let allInfoFromDB = await db.exec(`SELECT id_externo,estoque FROM produtos WHERE token = '${token}'`);
      for (const batch of batches) {
        await Promise.all(batch.map(async e => {
          let produtoNoDB = allInfoFromDB.find(info => info.id_externo == e.id_externo)
          if (produtoNoDB != undefined && produtoNoDB.estoque != e.estoque) {
            let query_update = `UPDATE produtos SET estoque = ${e.estoque} WHERE id_externo = ${e.id_externo}`
            let infosAtualizadas = await db.exec(query_update)
            produtosAlterados += infosAtualizadas.affectedRows
          }
        }))
        alreadySent += batch.length;
      }
      console.log('Finalizando', 'produtos revisados:', alreadySent, ' produtos alterados : ', produtosAlterados)
      // if(produtosAlterados > 0){
      //   await db.exec(UPDATE client_info SET last_sync = '${momentoIniciado}' WHERE token = '${token}');
      // }
      if (produtosAlterados != 0) {
        await Shark.syncProdutos(token, true)
      } else {
        console.log('Nenhuma mudanca no estoque')
      }
    } else {
      console.log('SEM QUERY')
    }
  }
}
async function getResultadoFromAPI(element, token_api_cliente, tokenResponse, data_last_sync = moment().format('YYYY-MM-DD')) {
  console.log(element.url.replace(/{{now}}/g, data_last_sync))
  let retorno = await getInfosBetweenPages(element.url.replace(/{{now}}/g, data_last_sync), element.type, undefined, { ...element.headers, Authorization: `${tokenResponse.token_type} ${token_api_cliente}` })
  let formattedData = []
  let translateInfo = element.resultTranslate
  if (translateInfo['filter'] != undefined) {
    retorno = retorno.filter(e => {
      return eval(translateInfo['filter'])
    })
    delete translateInfo['filter']
  }
  let translateInfoKeys = inverse(translateInfo)

  for (const unformattedElement of retorno) {
    let formatedElement = {}
    let latestRequest = undefined
    let formasPagamento = undefined
    for (let e of Object.keys(translateInfoKeys)) {
      if (e.includes('<?') && e.includes('?>')) {
        e = e.replace(/<\?|\?>/g, '')
        let splittedSearch = e.split(' as ')
        let key = splittedSearch[1].trim()
        let returnAlias = ''
        let params = splittedSearch[0].split(',')
        let alias = ''
        if (key.includes('extract')) {
          splittedSearch = key.split(' extract ')
          key = splittedSearch[0]
          alias = splittedSearch[1].split(' from ')
          returnAlias = JSON.parse(`{"${alias[0].toString().replace(/->/g, '":"').replace(/,/g, '","')}"}`)
        }
        let midRequest = await sendRequestToClientAPI(eval(`\`${params[0]}\``), params[1], params[2], { ...element.headers, Authorization: `${tokenResponse.token_type} ${token_api_cliente}` })
        latestRequest = midRequest
        let infosMidRequest = eval(`midRequest${alias[1].split('->').map(e => `["${e}"]`).join('')}`)

        let infosCleaned = []
        infosMidRequest.forEach(info => {
          let singleInfoCleaned = {}
          Object.keys(returnAlias).forEach(alias => {
            singleInfoCleaned[returnAlias[alias]] = info[alias]
          })
          infosCleaned.push(singleInfoCleaned)
        })
        formatedElement[key] = JSON.stringify(infosCleaned)
      } else if (e.includes('->')) {
        let splittedSearch = e.split('->')
        let key = splittedSearch[0]
        delete splittedSearch[0]
        formatedElement[translateInfoKeys[e]] = eval(`unformattedElement['${key}']${splittedSearch.map(e => `[${e}]`).join('')}`) || ''
      } else if (e.includes('<<') && e.includes('>>')) {
        e = e.replace(/<<|>>/g, '')
        let splittedSearch = e.split(' as ')
        let key = splittedSearch[1].trim()
        formatedElement[key] = eval(splittedSearch[0]) || ''
      } else {
        formatedElement[translateInfoKeys[e]] = unformattedElement[e] || ''
      }
    }
    formattedData.push(formatedElement)
  }
  let resultado = formattedData
  return resultado
}
async function fullSyncDB() {
  try {
    console.log('Sincronizando DB (Rodando Funcao)')
    if (store.get('token_url') != undefined && store.get('token_url') != '(EMPTY)') {
      console.log('Sincronizando DB (passou do if 1)')

      console.log(token)
      let querys = JSON.parse(store.get('query_db'))
      let tokenInfo = querys['token']
      let tokenBody = JSON.parse(JSON.stringify(tokenInfo.getTokenBody).replace(/{{token}}/g, store.get('password_db')))
      let tokenResponse = await getTokenAPICliente(store.get('token_url'), 'POST', tokenBody, tokenInfo.getTokenResponseKeys)
      delete querys['token']
      let token_api_cliente = tokenResponse.token
      let last_sync = await db.exec(`SELECT last_sync FROM client_info WHERE token = '${token}'`);
      last_sync = last_sync[0].last_sync
      for (const elementKey of Object.keys(querys)) {
        let resultado = await getResultadoFromAPI(querys[elementKey], token_api_cliente, tokenResponse, moment(last_sync).format('YYYY-MM-DD'))
        await sendToDB(resultado, elementKey, token)
      }
      console.log('->>>>>>Enviado ao db')
      // await Shark.syncShark()
      return
    }
    if (store.get('db_type_db') != undefined) {
      console.log('Sincronizando DB (passou do if 2)')

      if (serverDB === undefined) {
        USERINFO = await db.exec("SELECT ci.*,dbc.config_json,dbc.type FROM client_info ci LEFT JOIN db_conn_client_info dbc on dbc.id_client_info = ci.id WHERE token = '" + token + "'")
        USERINFO = USERINFO[0]
        serverDB = await new selectConnection(USERINFO.type)
        serverDB = serverDB.selectConnectionType()
        serverDB = new serverDB(USERINFO.config_json)
        await serverDB.connect()
      }

      if (store.get('query_db') != undefined) {
        let querys = JSON.parse(store.get('query_db'))
        for (const element of Object.keys(querys)) {
          let resultado = await serverDB.exec(querys[element])
          const batchSize = 100;
          const batches = splitIntoBatches(resultado, batchSize);
          console.log(`Buscando ${element} no DB`)
          let colunaSelect = Object.keys(batches[0][0])
          console.log(JSON.stringify(batches[0][0]))

          let allInfoFromDB = await db.exec(`SELECT ${colunaSelect.map(f => `\`${f}\``).join(',')} FROM ${element} WHERE token = '${token}'`);
          console.log(`SELECT ${colunaSelect.map(f => `\`${f}\``).join(',')} FROM ${element} WHERE token = '${token}'`)
          for (const batch of batches) {
            await Promise.all(batch.map(async e => {
              try {
                e['token'] = token;
                delete e['uid']
                delete e['last_update']
                delete e['empresa']
                let colunas = Object.keys(e);
                let colunasJSON = ['produtos_venda', 'datas_vencimento'];
                let colunaWithoutSingleQuote = ['nome'];
                let inDB = allInfoFromDB.find(info => info.id_externo == e.id_externo)
                let valoresColunas = colunas.map(f => {
                  if (e[f] instanceof Date) {
                    e[f] = e[f].toISOString();
                    return `"${e[f]}"`;
                  } else if (colunasJSON.includes(f)) {
                    e[f] = JSON.stringify(e[f]).replace(/'/g, `''`);
                    return `'${e[f]}'`;
                  } else if (typeof e[f] === 'object') {
                    e[f] = JSON.stringify(e[f]).replace(/'/g, `''`);

                    return `'${e[f]}'`;
                  } else if (e[f].toString().includes("'") || colunaWithoutSingleQuote.includes(f)) {
                    e[f] = e[f].toString().replace(/'/g, `''`)
                    return `'${e[f].toString().replace(/'/g, `''`)}'`;
                  }
                  return `'${e[f] || ''}'`;
                });
                try {


                  if (inDB != undefined) {
                    delete inDB['uid']
                    delete inDB['last_update']
                    delete inDB['empresa']
                    colunas.forEach(f => {
                      if (e[f] instanceof Date) {
                        inDB[f] = inDB[f].toISOString();
                      } else if (colunasJSON.includes(f)) {
                        inDB[f] = JSON.stringify(inDB[f]).replace(/'/g, `''`);
                      } else if (typeof e[f] === 'object') {
                        inDB[f] = JSON.stringify(inDB[f]).replace(/'/g, `''`);
                      } else if (e[f].toString().includes("'") || colunaWithoutSingleQuote.includes(f)) {
                        inDB[f] = inDB[f].toString().replace(/'/g, `''`)
                      }
                    });
                    if (compareObjects(inDB, e)) {
                      e['last_update'] = moment().format();
                      await db.exec(`UPDATE ${element} SET ${colunas.map(f => `\`${f}\` = '${e[f] || ''}'`).join(',')} WHERE id_externo = '${e.id_externo}'`);
                    }
                  } else {
                    await db.exec(`INSERT INTO ${element} (${colunas.map(f => `\`${f}\``).join(',')}) VALUES (${valoresColunas.join(',')})`);
                  }
                } catch (e) {
                  console.log('---------------------------------------------------------------------')
                  console.log(`INSERT INTO ${element} (${colunas.map(f => `\`${f}\``).join(',')}) VALUES (${valoresColunas.join(',')})`)
                  console.log('ERRO ADICIONANDO NO DB : -------------------------------------------', e)
                }
              } catch (e) {
                console.log('Erro ->', e)
              }
            }));
          }
        }
        await Shark.syncShark()

      } else {
        console.log('ALERTAR')
      }

    } else {
      console.log('ALERTAR')
    }
  } catch (e) {
    serverDB = undefined
    console.log('ERRO AO SINCRONIZAR BANCO DE DADOS app.js', e)
  }
}
function splitIntoBatches(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}
