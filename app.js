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

process.on('uncaughtException', async (error) => {
  log('electron', 'uncaught_exception', {
    error: error.message,
    stack: error.stack
  });
  await startSharkConn()
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
    console.log(USERINFO )
    if (typeof USERINFO.tokenQuery == "string"){
      USERINFO.tokenQuery = JSON.parse(USERINFO.tokenquery)
    }

    if (serverDB == undefined && Object.keys(USERINFO.tokenQuery).length ==0) {
      serverDB = await new selectConnection(USERINFO.type)
      serverDB = serverDB.selectConnectionType()
      serverDB = new serverDB(USERINFO.config_json)
      await serverDB.connect()
    }
    webSokcet.openWebSocket(token, store.get('user'), serverDB, USERINFO.domainws, app, autoUpdater, Shark)

    console.log('Indo ali abrir o websocket manualmente -> ', store.get('user'),serverDB, Object.keys(USERINFO.tokenQuery).length >0)
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
  const server = new serverManager()

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
  if (store.get('user') != undefined) {
    startSharkConn()
    // await fullSyncDB()
  }
}
