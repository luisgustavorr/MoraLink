const { default: axios } = require('axios');
const WebSocket = require('ws');
const moment = require('moment')
const Store = require('electron-store');

const { HttpsProxyAgent } = require('https-proxy-agent');
const store = new Store();
const httpsAgent = store.get('ssl_string') != undefined && store.get('ssl_string') != '(EMPTY)'&& store.get('ssl_string') != 'desativado'  ? new HttpsProxyAgent(store.get('ssl_string')) : undefined



let ws = undefined;
let isConnected = false;
let verifyConnectionInterval = undefined;
let APIClienteToken = {
}
async function accessObjectByPath(array, pathToInfo) {
  let paths = pathToInfo.split('/')
  let recursiveInfo = array
  for (const path of paths) {
    if (path != "") {
      recursiveInfo = recursiveInfo[path]

    }
  }
  return recursiveInfo
}
async function getInfosBetweenPages(url, type, body, headers, batchSize = 1, pathToData = undefined, minPagName = undefined, maxPagName = "page", page = 1) {
  let arrayCompleto = [];
  let hasMorePages = true;
  let pageSelected = undefined
  if (minPagName != undefined) {
    url += `${minPagName}={{minPag}}`
  }
  url += `&${maxPagName}={{currentPage}}`
  const fetchPage = async (currentPage) => {
    pageSelected = currentPage
    try {
      if (hasMorePages) {
        // console.log('CurrentPage hp:',currentPage,batchSize)

        const response = await sendRequestToClientAPI(`${url.replace(/{{minPag}}/g, currentPage - batchSize).replace(/{{currentPage}}/g, batchSize)}`, type, undefined, headers)

        let responseSearchResult = pathToData == undefined ? response : await accessObjectByPath(response, pathToData)

        if (responseSearchResult.length == 0) {
          hasMorePages = false
        }
        return responseSearchResult;

      } else {
        console.log('Sem mais pags')
        return []
      }
    }
    catch (e) {
      console.log('Erro fetch page', e?.response?.data)
      hasMorePages = false
    }
  };

  try {
    let currentPage = page;

    while (hasMorePages) {
      const promises = [];
      // Adiciona as requisições do batch
      promises.push(fetchPage(currentPage + batchSize));

      // Executa todas as requisições do batch
      const responses = await Promise.all(promises);
      for (const response of responses) {
        if (response == undefined) continue
        // console.log('RESPOTSA :', response)
        arrayCompleto = arrayCompleto.concat(response);
        if (response.length == 0) {
          hasMorePages = false
        }


      }

      // Atualiza a página inicial do próximo batch
      currentPage += batchSize;

    }

    return arrayCompleto;
  } catch (error) {
    console.error('Erro ao buscar infos', `${url}page=${pageSelected}`, type, headers);
    throw error;
  }
}
function inverse(obj) {
  var retobj = {};
  for (var key in obj) {
    retobj[obj[key]] = key;
  }
  return retobj;
}
async function getResultadoFromAPI(element, token_api_cliente, tokenResponse, data_last_sync = moment().format('YYYY-MM-DD')) {
  let resultadoJoin = []
  if (element.join != undefined) {
        console.log("FAAZER JOIN")
        for (let joinnedElement of element.join) {
          let returned = await getInfosBetweenPages(joinnedElement.url.replace(/{{now}}/g, data_last_sync), joinnedElement.type, undefined, { ...joinnedElement.headers, Authorization: `${tokenResponse.token_type} ${token_api_cliente}`.trim() }, joinnedElement.pagLength, joinnedElement.pathToData, joinnedElement.minPagName, joinnedElement.maxPagName, joinnedElement.pagStart)

          resultadoJoin.push(...returned.map(e => { return{...e,on:joinnedElement.on}}))
        }
      }
  let retorno = await getInfosBetweenPages(element.url.replace(/{{now}}/g, data_last_sync), element.type, undefined, { ...element.headers, Authorization: `${tokenResponse.token_type} ${token_api_cliente}`.trim() }, element.pagLength, element.pathToData, element.minPagName, element.maxPagName, element.pagStart)
  let formattedData = []
  let translateInfo = element.resultTranslate
  if (element.resultTranslate == undefined) {
    return retorno
  }
  if (translateInfo['filter'] != undefined) {
    retorno = retorno.filter((e) => {
      return eval(translateInfo['filter'])
    })
    delete translateInfo['filter']
  }
  let translateInfoKeys = inverse(translateInfo)

  for (const unformattedElement of retorno) {
    let joinnedInfo = resultadoJoin.find(sub => eval(sub.on))
    let formatedElement = {}
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
        await sendRequestToClientAPI(eval(`\`${params[0]}\``), params[1], params[2], { ...element.headers, Authorization: `${tokenResponse.token_type} ${token_api_cliente}` })
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
        try {
          formatedElement[key] = eval(splittedSearch[0]) || ''

        } catch (e) {
          console.log(`Erro ao executar query :"${splittedSearch[0]}" de ${key}: `, e)
        }
        // console.log('Formatted Key', formatedElement[key])
      } else {
        formatedElement[translateInfoKeys[e]] = unformattedElement[e] || ''
      }
    }
    formattedData.push(formatedElement)
  }
  let resultado = formattedData
  console.log(resultado, 'result')
  return resultado
}
async function sendRequestToClientAPI(url, type, body, headers = undefined) {
  const config = {
    method: type,
    maxBodyLength: Infinity,
    url: url,
    headers: headers || {
      "Content-Type": "application/json",
      "User-Agent": "insomnia/2023.5.8"
    },
    data: body,
    httpsAgent
  };
  console.log(config)
  const response = await axios.request(config);
  console.log('RESPOSTA', response)
  return response
}
async function getTokenAPICliente(url, type, tokenBody, responseKeysMap) {
  if (APIClienteToken['token'] != undefined) {
    return APIClienteToken
  }
  let resposta = await sendRequestToClientAPI(url, type, tokenBody)
  resposta = resposta.data
  let token = resposta[responseKeysMap["token"]]
  let expiresIn = resposta[responseKeysMap["expires_in"]]
  console.log('RESPONSE KEY MAP !!!!!!', resposta)
  let token_type = responseKeysMap["token_type"].includes('<<') ? responseKeysMap["token_type"].replace(/<<|>>/g, "") : resposta[responseKeysMap["token_type"]]
  if (APIClienteToken['timeout_id'] != undefined) {
    clearTimeout(APIClienteToken['timeout_id']);
    APIClienteToken['timeout_id'] = setTimeout(() => {
      APIClienteToken = {}
    }, expiresIn * 1000);
  }
  APIClienteToken['token'] = token
  APIClienteToken['token_type'] = token_type || ""

  return APIClienteToken

}
function joinQuerys(mainQuery, subQuery, subQueryAlias, joinFactor) {
  return mainQuery.map(main => {
    main[subQueryAlias] = subQuery.find(sub => eval(joinFactor))
    return main
  })

}
class webSocket {
  openWebSocket(token, user, db, wsDomain, app, autoUpdater, shark) {
    try {
      console.log('Abrindo ws', wsDomain)
      ws = new WebSocket('wss://' + wsDomain + '/ws/local', { agent: httpsAgent });
      ws.on('open', () => {
        console.log('WebSocket conectado');
        ws.send(JSON.stringify({ type: 'Connection', token: token, user: user }));
        // Heartbeat a cada 30 segundos
        this.heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping(); // Usa o ping nativo do WebSocket
          }
        }, 30000);
      });
      ws.on('pong', () => {
        isConnected = true;
      });
      ws.on('message', (data) => {
        try {
          const command = JSON.parse(data);
          if (command["type"] !== undefined && command["type"] === "Heartbeat") {
            isConnected = command["status"] === 200;
            return;
          }
          if (command["type"] !== undefined && command["type"] === "Restart") {
            this.restartApp(app)
            return
          }
          if (command["type"] !== undefined && command["type"] === "Stop") {
            this.stopApp(app)
            return
          }
          if (command["type"] !== undefined && command["type"] === "Update") {
            this.updateApp(autoUpdater, command["forceUpdate"])
            return
          }
          if (command["type"] !== undefined && command["type"] === "SyncShark") {
            shark.syncShark(token)
            return
          }
          if (command["type"] !== undefined && command["type"] === "Query") {
            console.log('Solicitação para gerar query :', JSON.stringify(command))
            this.execQuery(db, command["query"], command["idQuery"], wsDomain, command["batchSize"], command["getToken"])
          }
        } catch (error) {
          console.log('Erro ao processar mensagem do WebSocket:', data.toString(), error);
        }
      });
      ws.on('error', (err) => {
        console.error('Erro no WebSocket:', token, wsDomain, err.message);
        isConnected = false;
      });
      ws.on('close', async () => {
        console.log('WebSocket desconectado');
        isConnected = false;
        clearInterval(verifyConnectionInterval);
        verifyConnectionInterval = setInterval(async () => {
          console.log("Conectado:", await this.verifyConnection(token, user, db, wsDomain, app, autoUpdater, shark));
        }, 5000);
      });
    } catch (e) {
      console.log('Erro iniciando WebSocket:', e);
      isConnected = false;
    }
  }
  async updateApp(autoUpdater, forceUpdate) {
    if (forceUpdate) {
      autoUpdater.downloadUpdate();
    } else {
      autoUpdater.checkForUpdates();
    }
  }
  async restartApp(app) {
    app.relaunch();
    app.exit(0);
  }
  async stopApp(app) {
    app.exit(0);
  }
  async execQuery(db, query, idQuery, wsDomain, batchSize, getTokenInfo) {
    let tokenInfo = getTokenInfo
    let resultado = undefined;
    let totalEnviados = 0

    if (tokenInfo != undefined && Object.keys(tokenInfo).length != 0) {
      console.log('Recuperando por API', JSON.stringify(tokenInfo))
      let tokenBody = JSON.parse(JSON.stringify(tokenInfo.getTokenBody).replace(/{{token}}/g, tokenInfo.tokenString))
      let tokenResponse = await getTokenAPICliente(tokenInfo.tokenURL, 'POST', tokenBody, tokenInfo.getTokenResponseKeys)
      console.log('Resposta token : ', tokenResponse)
      let token_api_cliente = tokenResponse.token
   
      resultado = await getResultadoFromAPI(query, token_api_cliente, tokenResponse)

      console.log(resultado, 'Resultado')
    }
    try {
      if (resultado == undefined) {
        resultado = await db.exec(query)
        if (resultado != undefined) {
          console.log('Recuperando por DB', resultado.length)
        } else {
          await this.sendBatch({ error: "Resultado vazio rodando query :| " + query + " |", status: 500 }, 1, 1, idQuery, wsDomain);
          return
        }

      }
    } catch (e) {
      console.log('Err', e)
      await this.sendBatch({ error: e, status: 500 }, 1, 1, idQuery, wsDomain);
      return
    }
    const batches = [];
    if (resultado.length == 0) {
      this.sendBatch([], -1, 0, idQuery, wsDomain);
    }
    console.log('PASSOU POR AQUI ->')
    try {
      for (let i = 0; i < resultado.length; i += batchSize) {
        batches.push(resultado.slice(i, i + batchSize));
      }
    } catch (e) {
      console.log('Erro criando batchs: ', e, resultado)
    }
    // Envio paralelo controlado
    const queue = async (batch, index, total) => {
      console.time(`Batch ${index}`);
      totalEnviados += batch.length
      await new Promise((resolve) => {setTimeout(resolve, 1000*index);})
      console.log(`Enviando BATCH ------- (${index}/${total}) ${totalEnviados} adicionados`);
      await this.sendBatch(batch, index, total, idQuery, wsDomain);
      console.timeEnd(`Batch ${index}`);
    };

    // Divida os batches em grupos de até 5 para envio paralelo controlado
    const chunks = [];
    const totalBatches = batches.length;
    while (batches.length) {

      chunks.push(batches.splice(0, 5));
    }

    let batchIndex = 1;
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (batch) => {
          await queue(batch, batchIndex++, totalBatches);
      await new Promise((resolve) => {setTimeout(resolve, 1000);})

        })
      );
      await new Promise((resolve) => {setTimeout(resolve, 1000);})

    }

  }

  async sendBatch(batch, index, totalBatches, idQuery, wsDomain) {
    const data = {
      idQuery,
      resultado: JSON.stringify(batch),
      repeticoes: index + 1,
      repeticoesNecesasrias: totalBatches
    };
    console.log(index + 1, totalBatches, `https://${wsDomain}/queryResult`)
    try {
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://${wsDomain}/queryResult`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: data,
        httpsAgent
      };
      return await axios.request(config)
        .then((response) => {
          return response.data
        })
        .catch((error) => {
          console.log(error);
          return undefined

        });
    } catch (error) {
      console.error(`Erro no batch ${index}:`, error.message);
      throw error;
    }
  }
  async verifyConnection(token, user, db, wsDomain, app, autoUpdater, shark) {
    return new Promise((resolve) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log("WebSocket não está aberto, tentando reconectar...");
        clearInterval(verifyConnectionInterval);
        this.openWebSocket(token, user, db, wsDomain, app, autoUpdater, shark);
        return resolve(false);
      }

      isConnected = false;
      try {
        ws.send("Heartbeat");
      } catch (err) {
        console.error("Erro ao enviar heartbeat:", err.message);
        isConnected = false;
        ws.close();
        clearInterval(verifyConnectionInterval);
        this.openWebSocket(token, user, db, wsDomain, app, autoUpdater, shark);
        return resolve(false);
      }

      setTimeout(() => {
        resolve(isConnected);
      }, 1000);
    });
  }

}

module.exports = webSocket
