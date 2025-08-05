const Store = require('electron-store');
const axios = require('axios');
const store = new Store();
// const _ = require('lodash');
const moment = require('moment')
const cliProgress = require('cli-progress');
const { HttpsProxyAgent } = require('https-proxy-agent'); // ← AQUI
const httpsAgent = store.get('ssl_string') != undefined && store.get('ssl_string') != '(EMPTY)' && store.get('ssl_string') != 'desativado' ? new HttpsProxyAgent(store.get('ssl_string')) : undefined
class sharkConnection {
  constructor(db) {
    this.db = db
    this.token = undefined
    this.produtos = undefined
    this.categorias = undefined
    this.clientes = undefined
  }
  async getToken() {
    let usuario = await this.db.exec('SELECT * FROM client_info WHERE "user" = ?', [store.get('user')]);
    console.log(usuario)
    if (usuario.length == 0 || usuario[0]["ativo"] == true || usuario[0]["ativo"] == "true") {
      let data = JSON.stringify({
        "username": store.get('user'),
        "password": store.get('password')
      });
      console.log('HTTP AGENT SENDO USADO : ', store.get('ssl_string'))
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://sharkbusiness.com.br/api/v2/autentificar/obter-token-status/',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/2023.5.8'
        },
        httpsAgent: httpsAgent,
        data: data
      };
      await new Promise((resolve) => {
        axios.request(config)
          .then(async (response) => {
            // usuario = await this.db.exec('INSERT INTO client_info (token,descricao) VALUES (?,?)', [response.data.token, store.get('user')]);
            this.token = response.data.token
            // if (!response.data.status) {
            //   await this.db.exec('UPDATE client_info SET  "ativo" = ? WHERE "user" = ?', [response.data.status, store.get('user')]);
            //   console.log('Status desativado')
            //   this.token = undefined
            // }
            resolve(true)
          })
          .catch((error) => {
            console.log(error)
            resolve(true)

          });
      })

    } else {
      this.token = usuario[0].token
      if (usuario[0]["ativo"] == false || usuario[0]["ativo"] == "false") {
        this.token = undefined
      }
    }

    return this.token
  }

  async cleanShark(token = this.token, infos = ['vendedores', 'vendas', 'produto', 'cliente', 'categoria']) {
    const BATCH_SIZE = 25; // Tamanho do lote de requisições
    if (typeof infos == 'string') {
      infos = JSON.parse(infos.replace(/'/g, '"'))
    }
    console.log(infos)
    for (const e of infos) {
      let dadosShark = await this.getInfosBetweenPages(e, undefined, token);
      dadosShark = dadosShark.filter(item => item.id_externo != null && item.id_externo != undefined);
      const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      bar1.start(dadosShark.length, 0);
      let totalRequests = 0; // contador global
      for (let i = 0; i < dadosShark.length; i += BATCH_SIZE) {
        const batch = dadosShark.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (f, idx) => {
          const config = {
            method: 'delete',
            maxBodyLength: Infinity,
            url: `https://sharkbusiness.com.br/api/v2/${e}/${f.id}/`,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insomnia/2023.5.8',
              'Authorization': `Token ${token}`,
            },
            httpsAgent
          };
          try {
            await axios.request(config);
            totalRequests++;
            bar1.increment();
            if (totalRequests % 500 === 0) {
              console.log(`\n${totalRequests} requisições feitas. Pausando 1 minuto...`);
              await new Promise(resolve => setTimeout(resolve, 60000));
            } else {
              await new Promise(resolve => setTimeout(resolve, 350)); // Delay curto
            }
          } catch (error) {
            console.error(`Erro ao excluir ${e} -> ${f.id}:`, error.response?.data || error.message);
            await new Promise(resolve => setTimeout(resolve, 70000));
          }
        }));
      }
      bar1.update(dadosShark.length);
      bar1.stop();
    }
  }
  async syncShark(token = this.token) {
    console.log('SYNC SHARK')
    await this.syncCategorias(token)
    await this.syncVendedores(token)
    await this.syncClientes(token)
    await this.syncProdutos(token)
    await this.syncVendas(token)
    await this.db.exec(`UPDATE client_info SET last_sync = NOW() WHERE token = '${token}'`);
    console.log('---TUDO SINCRONIZADO ----');
    // await this.syncFinanceiro(undefined, true)
  }
  async getInfosBetweenPages(url, page = 1, token = this.token) {
    const batchSize = 2; // Número de requisições simultâneas por lote
    let arrayCompleto = [];
    let hasMorePages = true;
    const fetchPage = async (currentPage) => {
      console.log(`https://sharkbusiness.com.br/api/v2/${url}/?listagem=400&page=${currentPage}`)
      try {
        if (hasMorePages) {
          const config = {
            method: "get",
            maxBodyLength: Infinity,
            url: `https://sharkbusiness.com.br/api/v2/${url}/?listagem=400&page=${currentPage}`,
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "insomnia/2023.5.8",
              "Authorization": `Token ${token}`,
            },
            httpsAgent
          };
          const response = await axios.request(config);
          if (response.data.next == null) {
            hasMorePages = false
          }
          return response.data;
        } else {
          return []
        }
      }
      catch {
        hasMorePages = false
      }
    };
    try {
      let currentPage = page;
      while (hasMorePages) {
        const promises = [];
        // Adiciona as requisições do batch
        for (let i = 0; i < batchSize; i++) {
          promises.push(fetchPage(currentPage + i));
        }
        // Executa todas as requisições do batch
        const responses = await Promise.all(promises);
        for (const response of responses) {
          if (response?.results) {
            arrayCompleto.push(...response.results);
          }
          if (!response?.next) {
            hasMorePages = false; // Para o loop se não houver mais páginas
          }
        }
        // Atualiza a página inicial do próximo batch
        currentPage += batchSize;
      }

      return arrayCompleto;
    } catch (error) {
      console.error('Erro ao buscar infos');
      throw error;
    }
  }

  async syncCategorias(token = this.token) {
    console.log('Sincronizando categorias')
    const config = {
      httpsAgent,
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://sharkbusiness.com.br/api/v2/categoria/',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'insomnia/2023.5.8',
        'Authorization': `Token ${token}`
      }
    };

    axios.request(config)
      .then(async (response) => {
        let categoriasShark = response.data.results
        let categoriasDB = await this.db.exec('SELECT categorias.uid as id,categorias.id_externo,categorias.nome FROM categorias INNER JOIN client_info ON client_info.token = categorias.token WHERE categorias.token = ? AND last_update >= client_info.last_sync;', [token])
        let { missingOnShark, distinctOnShark } = await this.syncDB(categoriasShark.filter(e => e.id_externo != null && e.id_externo != undefined), categoriasDB)
        const batchSize = 5; // Número de requisições simultâneas por lote
        for (let i = 0; i < distinctOnShark.length; i += batchSize) {
          const batch = distinctOnShark.slice(i, i + batchSize); // Criar o lote
          console.log('Sincronizando')
          await Promise.all(
            batch.map(e => {
              const data = JSON.stringify({
                "nome": e.nome
              });
              const config = {
                httpsAgent,
                method: 'patch',
                maxBodyLength: Infinity,
                url: `https://sharkbusiness.com.br/api/v2/categoria/idExterno=${e.id_externo}/?=`,
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'insomnia/2023.5.8',
                  'Authorization': `Token ${token}`
                },
                data: data
              };
              return new Promise((resolve) => {
                axios.request(config)
                  .then(() => {
                    console.log('CATEGORIA EDITED')

                    setTimeout(resolve, 500); // Delay para evitar sobrecarga
                  })
                  .catch(() => {
                    setTimeout(resolve, 500); // Continuar mesmo em caso de erro
                  });
              });
            })
          );
        }

        // for (const e of shoudntExistOnShark) {
        //   let config = {
        //     method: 'delete',
        //     maxBodyLength: Infinity,
        //     url: `https://sharkbusiness.com.br/api/v2/categoria/${e.id}/`,
        //     headers: {
        //       'Content-Type': 'application/json',
        //       'User-Agent': 'insomnia/2023.5.8',
        //       'Authorization': `Token ${token}`
        //     },
        //   };

        //   let teste = await new Promise((resolve, reject) => {
        //     axios.request(config)
        //       .then((response) => {
        //         setTimeout(resolve, 500)
        //       })
        //       .catch((error) => {
        //         setTimeout(resolve, 500)

        //       });
        //   })

        // }
        for (let i = 0; i < missingOnShark.length; i += batchSize) {
          const batch = missingOnShark.slice(i, i + batchSize); // Criar o lote
          await Promise.all(
            batch.map(e => {
              let data = JSON.stringify({
                "nome": e.nome,
                "id_externo": e.id_externo
              });
              let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://sharkbusiness.com.br/api/v2/categoria/',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'insomnia/2023.5.8',
                  'Authorization': `Token ${token}`
                },
                data: data
              };

              axios.request(config)
                .then(() => {
                  console.log('CATEGORIA ADD')
                })
                .catch(() => {
                });
            })
          );
        }
      })
      .catch(() => {
      });
    console.log('Categorias sincronizadas')
  }
  async syncProdutos(token = this.token, onlyEstoque = false) {
    console.log('Sincronizando produtos')
    let produtosShark = await this.getInfosBetweenPages('produto')
    console.log(token, produtosShark.length)
    let categoriasShark = await this.getInfosBetweenPages('categoria')
    console.log(categoriasShark)
    let produtosDB = await this.db.exec('SELECT produtos.* FROM produtos INNER JOIN client_info ON client_info.token = produtos.token WHERE produtos.token = ? AND last_update >= client_info.last_sync', [token])
    console.log(token, produtosDB.length)

    let cleanedProds = []
    for (const e of produtosDB) {
      let categoria = await categoriasShark.find(f => f.id_externo == e.categoria)
      let produto = await produtosShark.find(f => f.id_externo == e.id_externo)
      if (categoria == undefined) {
        continue
      }
      e.id = produto?.id
      e.categoria = categoria?.id
      e.contar_estoque = e.contar_estoque == 1
      e.estoque = e.estoque ? e.estoque : 0
      e.estoque = parseInt(e.estoque) < 0 ? 0 : parseInt(e.estoque)
      e.nome_categoria = categoria.nome
      e.no_buyback = e.duracao == 0 ? 1 : 0
      e.no_buyback = e.no_buyback == 1
      e.valor = e.valor ? parseFloat(e.valor).toFixed(2) : 0
      e.duracao = `${e.duracao != 0 ? `${e.duracao} ` : ''}00:00:00`
      cleanedProds.push(e)
    }
    produtosDB = cleanedProds
    const batchSize = 5; // Número de requisições simultâneas por lote
    let simultaneousBachSize = 700
    if (onlyEstoque) {
      let momento_venda = await this.db.exec(`SELECT last_sync FROM client_info WHERE token = '${this.token}'`);
      momento_venda = moment(momento_venda[0].last_sync).subtract(1, 'days').format()
      for (let i = 0; i < produtosDB.length; i += batchSize) {
        const batch = distinctOnShark.slice(i, i + simultaneousBachSize).map(e => ({
          "id": e.id,
          "valor": e.valor,
          "id_externo": e.id_externo,
          "estoque": e.estoque,
          "contar_estoque": e.contar_estoque
        }))
        let config = {
          method: 'patch',
          maxBodyLength: Infinity,
          url: `https://sharkbusiness.com.br/api/v2/produto/bulk-update`,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'insomnia/2023.5.8',
            'Authorization': `Token ${token}`
          },
          data: { produtos: batch }
        };

        await new Promise((resolve) => {
          axios.request(config)
            .then(async () => {
              await this.db.exec(`UPDATE produtos SET last_update = '${momento_venda}' WHERE token = '${token}'`);
              setTimeout(resolve, 500)

              resolve()
            })
            .catch((error) => {
              console.log('ERRO updat 1e', error.response.data.errors);
              setTimeout(resolve, 500)

            });
        })
      }
      console.log('Produtos sincronizados')

      return
    }

    let { missingOnShark, distinctOnShark } = this.syncDB(produtosShark.filter(e => e.id_externo != null && e.id_externo != undefined), produtosDB, 'produtos')
    console.log('No meu DB', produtosDB.length, 'Diferente no shark', distinctOnShark.length, 'Faltando no shark', missingOnShark.length, 'No Shark', produtosShark.filter((e, index, self) => e.id_externo != null && e.id_externo != undefined && index === self.findIndex((o) => o.id_externo === e.id_externo)).length)

    for (let i = 0; i < distinctOnShark.length; i += simultaneousBachSize) {

      const batch = distinctOnShark.slice(i, i + simultaneousBachSize).map(e => ({
        "id": e.id,
        "codigo": e.codigo || e.id_externo,
        "nome": e.nome,
        "valor": e.valor,
        "duracao": e.duracao,
        "no_buyback": e.no_buyback,
        "id_externo": e.id_externo,
        "categoria": e.categoria,
        "nome_categoria": e.nome_categoria,
        "descricao": e.descricao,
        "estoque": e.estoque,
        "contar_estoque": e.contar_estoque
      }));

      let config = {
        method: 'patch',
        maxBodyLength: Infinity,
        url: `https://sharkbusiness.com.br/api/v2/produto/bulk-update/`,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/2023.5.8',
          'Authorization': `Token ${token}`
        },
        data: { produtos: batch }
      };

      await new Promise((resolve) => {
        axios.request(config)
          .then(() => setTimeout(resolve, 500))
          .catch(error => {
            console.log('ERRO update', error.response.data.errors);
            console.log(batch[0])

            setTimeout(resolve, 500);
          });
      });
      console.log('Enviando batch', batch[0], batch.length)
    }



    // for(const e of shoudntExistOnShark) {
    //   let config = {
    //     method: 'delete',
    //     maxBodyLength: Infinity,
    //     url: `https://sharkbusiness.com.br/api/v2/produto/${e.id}/`,
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'User-Agent': 'insomnia/2023.5.8',
    //       'Authorization': `Token ${token}`
    //     },
    //   };

    //   let teste = await new Promise((resolve, reject) => {
    //     axios.request(config)
    //       .then((response) => {
    //         setTimeout(resolve, 500)
    //       })
    //       .catch((error) => {
    //         setTimeout(resolve, 500)
    //       });
    //   })

    // }
    for (let i = 0; i < missingOnShark.length; i += simultaneousBachSize) {

      const batch = missingOnShark.slice(i, i + simultaneousBachSize).map(e => ({
        "codigo": e.codigo || e.id_externo,
        "nome": e.nome,
        "valor": e.valor,
        "duracao": e.duracao,
        "no_buyback": e.no_buyback,
        "id_externo": e.id_externo,
        "categoria": e.categoria,
        "nome_categoria": e.nome_categoria,
        "descricao": e.descricao,
        "estoque": e.estoque,
        "contar_estoque": e.contar_estoque
      }));
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://sharkbusiness.com.br/api/v2/produto/bulk-create/',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/2023.5.8',
          'Authorization': `Token ${token}`
        },
        data: { produtos: batch }
      };
      await new Promise((resolve) => {
        axios.request(config)
          .then(() => {
            setTimeout(resolve, 500)
          })
          .catch(() => {
            setTimeout(resolve, 500)

          });
      })
      console.log('Enviando batch', batch[0], batch.length)
    }
    console.log('Produtos sincronizados')
  }
  async syncClientes(token = this.token) {
    console.log('Sincronizando clientes')
    let clientesShark = await this.getInfosBetweenPages('cliente')
    let clientesDB = await this.db.exec('SELECT clientes.* FROM clientes INNER JOIN client_info ON client_info.token = clientes.token WHERE clientes.token = ? AND last_update >= client_info.last_sync AND LENGTH(nome) >=2', [token])
    let cleanClientsDB = []
    for (const e of clientesDB) {
      let cliente = clientesShark.find(f => f.id_externo == e.id_externo)
      e.id = cliente?.id
      e.whatsapp = e.whatsapp != '' && e.whatsapp != null ? e.whatsapp.replace(/[^0-9]/g, '').substring(0, 15) : undefined;

      if (!e.whatsapp) {
        continue
      }
      console.log(e.whatsapp)
      try {
        if (e.aniversario != null && e.aniversario != undefined) {
          e.aniversario = await e.aniversario != null && e.aniversario != 'null' && moment(e.aniversario).format('YYYY-MM-DD') != 'invalid date' ? moment(e.aniversario).format('YYYY-MM-DD') : null
        } else {
          e.aniversario = null
        }
      } catch (e) {
        e.aniversario = null
      }
      cleanClientsDB.push(e)
    }
    console.log('asndklawndlk', clientesDB.length, cleanClientsDB.length)
    clientesDB = cleanClientsDB
    let { missingOnShark, distinctOnShark } = this.syncDB(clientesShark.filter(e => e.id_externo != null && e.id_externo != undefined), clientesDB, 'clientes')
    // const batchSize = 15; // Número de requisições simultâneas por lote
    const simultaneousBachSize = 500; // Número de requisições simultâneas por lote
    console.log('No meu DB', clientesDB.length, 'Diferente no shark', distinctOnShark.length, 'Faltando no shark', missingOnShark.length, 'No Shark', clientesShark.filter((e, index, self) => e.id_externo != null && e.id_externo != undefined && index === self.findIndex((o) => o.id_externo === e.id_externo)).length)

    for (let i = 0; i < distinctOnShark.length; i += simultaneousBachSize) {
      const batch = distinctOnShark.slice(i, i + simultaneousBachSize).map(e => ({
        "id": e.id,
        "nome": e.nome,
        "whatsapp": e.whatsapp,
        "referencia": e.referencia,
        "email": e.email,
        "id_externo": e.id_externo,
        "aniversario": moment(e.aniversario).format('YYYY-MM-DD') != 'Invalid date' ? moment(e.aniversario).format('YYYY-MM-DD') : null,
        "cpf_cnpj": e.cpf_cnpj,
        "pj_ou_pf": e.pj_ou_pf
      }));
      let config = {
        method: 'patch',
        maxBodyLength: Infinity,
        url: `https://sharkbusiness.com.br/api/v2/cliente/bulk-update/`,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/2023.5.8',
          'Authorization': `Token ${token}`
        },
        data: { clientes: batch }
      };

      await new Promise((resolve) => {
        axios.request(config)
          .then(() => {
            setTimeout(resolve, 500)
          })
          .catch((error) => {
            console.log('Erro atualizando clientes', error.response.data)
            setTimeout(resolve, 500)

          });
      })

    }
    // for (const e of shoudntExistOnShark) {
    //   let config = {
    //     method: 'delete',
    //     maxBodyLength: Infinity,
    //     url: `https://sharkbusiness.com.br/api/v2/cliente/${e.id}/`,
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'User-Agent': 'insomnia/2023.5.8',
    //       'Authorization': `Token ${token}`
    //     },
    //   };

    //   let teste = await new Promise((resolve, reject) => {
    //     axios.request(config)
    //       .then((response) => {
    //         setTimeout(resolve, 500)
    //       })
    //       .catch((error) => {
    //         setTimeout(resolve, 500)

    //       });
    //   })

    // }
    for (let i = 0; i < missingOnShark.length; i += simultaneousBachSize) {
      const batch = missingOnShark.slice(i, i + simultaneousBachSize).map(e => ({
        "nome": e.nome,
        "whatsapp": e.whatsapp,
        "referencia": e.referencia,
        "email": e.email,
        "id_externo": e.id_externo,
        "aniversario": moment(e.aniversario).format('YYYY-MM-DD') != 'Invalid date' ? moment(e.aniversario).format('YYYY-MM-DD') : null,
        "cpf_cnpj": e.cpf_cnpj,
        "pj_ou_pf": e.pj_ou_pf
      }));
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://sharkbusiness.com.br/api/v2/cliente/bulk-create/',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/2023.5.8',
          'Authorization': `Token ${token}`
        },
        data: { clientes: batch }
      };
      await new Promise((resolve) => {
        axios.request(config)
          .then(() => {
            setTimeout(resolve, 500)

          })
          .catch((error) => {
            console.log('Erro criando ', batch.length, ' clientes', error.response.status, error.response.data)

            setTimeout(resolve, 500)

          });
      })
    }
    console.log('Clientes sincronizados')
  }
  async syncVendedores(token = this.token) {
    console.log('Sincronizando vendedores')
    let vendedoresShark = await this.getInfosBetweenPages('vendedores')
    let vendedoresDB = await this.db.exec('SELECT vendedores.* FROM vendedores INNER JOIN client_info ON client_info.token = vendedores.token WHERE vendedores.token = ? AND last_update >= client_info.last_sync', [token])
    let { missingOnShark, distinctOnShark } = this.syncDB(vendedoresShark.filter(e => e.id_externo != null && e.id_externo != undefined), vendedoresDB, 'vendedores')
    console.log(missingOnShark.length, distinctOnShark.length)
    const batchSize = 200; // Número de requisições simultâneas por lote
    for (let i = 0; i < distinctOnShark.length; i += batchSize) {
      const batch = distinctOnShark.slice(i, i + batchSize); // Criar o lote
      await Promise.all(
        batch.map(async e => {
          let data = JSON.stringify({
            "nome": e.nome,
            "id_externo": e.id_externo
          });
          let config = {
            method: 'patch',
            maxBodyLength: Infinity,
            url: `https://sharkbusiness.com.br/api/v2/vendedores/idExterno=${e.id_externo}/?=`,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insomnia/2023.5.8',
              'Authorization': `Token ${token}`
            },
            data: data
          };
          console.log('Rodando')
          await new Promise((resolve) => {
            axios.request(config)
              .then(() => {

                setTimeout(resolve, 500)
              })
              .catch((error) => {
                console.log(error)
                setTimeout(resolve, 500)

              });
          })
        }))
    }
    // for (const e of shoudntExistOnShark) {
    //   let config = {
    //     method: 'delete',
    //     maxBodyLength: Infinity,
    //     url: `https://sharkbusiness.com.br/api/v2/vendedores/${e.id}/`,
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'User-Agent': 'insomnia/2023.5.8',
    //       'Authorization': `Token ${token}`
    //     },
    //   };

    //   let teste = await new Promise((resolve, reject) => {
    //     axios.request(config)
    //       .then((response) => {
    //         setTimeout(resolve, 500)
    //       })
    //       .catch((error) => {
    //         setTimeout(resolve, 500)

    //       });
    //   })

    // }
    for (let i = 0; i < missingOnShark.length; i += batchSize) {
      const batch = missingOnShark.slice(i, i + batchSize); // Criar o lote
      await Promise.all(
        batch.map(async e => {
          let data = JSON.stringify({
            "nome": e.nome,
            "codigo": e.id_externo,
            "id_externo": e.id_externo
          });
          let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://sharkbusiness.com.br/api/v2/vendedores/',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'insomnia/2023.5.8',
              'Authorization': `Token ${token}`
            },
            data: data
          };

          await new Promise((resolve,) => {
            axios.request(config)
              .then(() => {
                setTimeout(resolve, 500)
              })
              .catch(() => {
                setTimeout(resolve, 500)

              });
          })
        }))
    }
    console.log('Vendedores sincronizados')
  }
  async syncVendas(token = this.token) {
    console.log('Sincronizando vendas', this.token)
    let vendasShark = await this.getInfosBetweenPages('vendas')
    let clientesShark = await this.getInfosBetweenPages('cliente')
    let produtosShark = await this.getInfosBetweenPages('produto')
    console.log(produtosShark.length)
    let vendedoresShark = await this.getInfosBetweenPages('vendedores')
    let vendasDB = await this.db.exec('SELECT vendas.* FROM vendas INNER JOIN client_info ON client_info.token = vendas.token WHERE vendas.token = ?  AND last_update >= client_info.last_sync', [token])
    let vendasDBFiltradas = []
    for (let e of vendasDB) {
      let cliente = await clientesShark.find(f => parseInt(f.id_externo) == parseInt(e.cliente))
      let vendedor = await vendedoresShark.find(f => f.id_externo == e.vendedor)
      let venda = await vendasShark.find(f => f.id_externo == e.id_externo)
      e.vendedor = vendedor?.id ? vendedor?.id : e.vendedor
      if (venda != undefined) {
        continue
      }
      if (cliente == undefined) {
        continue
      }
      e.cliente = cliente?.id
      e["empresa"] = cliente?.empresa
      e.produtos_venda = removeQuotes(e.produtos_venda)
      e.datas_vencimento = removeQuotes(e.datas_vencimento)
      e.produtos_venda = removeQuotes(e.produtos_venda);

      let produtosNaVenda;
      if (typeof e.produtos_venda === 'string') {
        e.produtos_venda = e.produtos_venda.replace(/\\"/g, '"'); // Substitui \" por "
      }
      try {
        // Verifica se é uma string antes de parsear
        if (typeof e.produtos_venda === 'string') {
          produtosNaVenda = JSON.parse(e.produtos_venda);
        } else {
          produtosNaVenda = e.produtos_venda; // Assume que já é um objeto/array
        }
      } catch (parseError) {
        console.log('Erro ao parsear produtos_venda:', e.produtos_venda, parseError);
        continue; // Pula para a próxima iteração em caso de erro
      }
      let produtosFiltrados = [];
      for (let e of produtosNaVenda) {
        let produto = await produtosShark.find(f => parseInt(f.id_externo) == parseInt(e.produto_id))
        if (produto != undefined) {
          console.log('PRODUTO EXISTE', e.produto_id)
          e.produto_id = produto?.id
          e.quantidade = parseInt(e.quantidade)
          produtosFiltrados.push(e)
        } else {
          console.log(e.produto_id)
        }

      }
      e.produtos_venda = produtosFiltrados
      e.data_vencimento = moment(e.data_vencimento).isValid() ? moment(e.data_vencimento).format('YYYY-MM-DD') : null
      if (produtosFiltrados.length == 0) {
        console.log('venda sem produtos')
        continue
      }
      vendasDBFiltradas.push(e)
    }
    // let shoudntExistOnShark = []
    let missingOnShark = vendasDBFiltradas
    console.log('No meu DB', vendasDB.length, 'Faltando no shark', missingOnShark.length, 'No Shark', vendasShark.filter((e, index, self) => e.id_externo != null && e.id_externo != undefined && index === self.findIndex((o) => o.id_externo === e.id_externo)).length)

    const simultaneousBachSize = 100
    for (let i = 0; i < missingOnShark.length; i += simultaneousBachSize) {
      try {
        const batch = missingOnShark.slice(i, i + simultaneousBachSize).map(e => ({
          "id_externo": e.id_externo,
          "cliente": e.cliente,
          "vendedor": e.vendedor,
          "data_compra": moment(e.data_compra).format(),
          "total_compra": parseFloat(e.total_compra).toFixed(2),
          "valor_liquido": parseFloat(e.valor_liquido).toFixed(2),
          "tipo_pagamento": e.tipo_pagamento.trim(),
          "recorrente": e.recorrente == 1,
          "parcelas": e.parcelas,
          "entrada": parseFloat(e.entrada).toFixed(2),
          "data_vencimento": e.data_vencimento,
          "metodo_pagamento": e.metodo_pagamento.trim(),
          "orcamento": e.orcamento == 1,
          "produtos_venda": typeof e.produtos_venda == 'object' ? e.produtos_venda : JSON.parse(e.produtos_venda),
          "observacao": e.observacao,
          "oferecer_denovo": e.orcamento == 1 ? true : false
        }));

        let config = {
          method: 'post',
          maxBodyLength: Infinity,
          url: 'https://sharkbusiness.com.br/api/v2/vendas/bulk-create/',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'insomnia/2023.5.8',
            'Authorization': `Token ${token}`
          },
          data: { vendas: batch }
        };

        await new Promise((resolve) => {

          axios.request(config)
            .then(() => {
              setTimeout(resolve, 500)
            })
            .catch((error) => {
              console.log('ERRO insert venda:', error?.response?.data, batch[0])
              // console.log('ERRO insert venda', error?.response?.data)

              setTimeout(resolve, 500)

            });
        })


      } catch (e) {
        console.log('erro insert venda externo', e)
      }

    }
    console.log('Vendas Sincronizadas')


  }
  async syncFinanceiro(token = this.token) {
    let financiasShark = await this.getInfosBetweenPages('financeiro')
    let financiasDB = await this.db.exec('SELECT financeiro.* FROM financeiro INNER JOIN client_info ON client_info.token = financeiro.token WHERE financeiro.token = ? AND last_update >= client_info.last_sync', [token])
    let { missingOnShark, distinctOnShark } = this.syncDB(financiasShark.filter(e => e.id_externo != null && e.id_externo != undefined), financiasDB)
    for (const e of distinctOnShark) {
      let data = JSON.stringify(
        {
          "id_externo": e.id_externo,
          "cliente": e.cliente,
          "status": e.status,
          "data_compra": moment(e.data_compra).format(),
          "valor_total": e.valor_total,
          "parcela_atual": e.parcela_atual,
          "parcelas": e.parcelas,
          "valor_parcela": e.valor_parcela,
          "data_vencimento": e.data_vencimento != '0000-00-00' ? moment(e.data_vencimento).format('YYYY-MM-DD') : null,
          "data_personalizadas": e.data_personalizadas,
          "infos_cobranca": JSON.parse(e.infos_cobranca)
        }
      );
      let config = {
        method: 'patch',
        maxBodyLength: Infinity,
        url: `https://sharkbusiness.com.br/api/v2/financeiro/idExterno=${e.id_externo}/?=`,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/2023.5.8',
          'Authorization': `Token ${token}`
        },
        data: data
      };

      await new Promise((resolve) => {
        axios.request(config)
          .then(() => {
            setTimeout(resolve, 500)
          })
          .catch(() => {
            setTimeout(resolve, 500)

          });
      })
    }
    // for (const e of shoudntExistOnShark) {
    //   let config = {
    //     method: 'delete',
    //     maxBodyLength: Infinity,
    //     url: `https://sharkbusiness.com.br/api/v2/financeiro/${e.id}/`,
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'User-Agent': 'insomnia/2023.5.8',
    //       'Authorization': `Token ${token}`
    //     },
    //   };

    //   await new Promise((resolve) => {
    //     axios.request(config)
    //       .then((response) => {
    //         setTimeout(resolve, 500)
    //       })
    //       .catch((error) => {
    //         setTimeout(resolve, 500)

    //       });
    //   })

    // }
    for (const e of missingOnShark) {
      let data = JSON.stringify(
        {
          "id_externo": e.id_externo.trim(),
          "cliente": e.cliente.trim(),
          "status": e.status.trim(),
          "data_compra": moment(e.data_compra).format(),
          "valor_total": e.valor_total,
          "parcelas": e.parcelas,
          "parcela_atual": e.parcela_atual,
          "valor_parcela": e.valor_parcela,
          "data_vencimento": e.data_vencimento != '0000-00-00' ? moment(e.data_vencimento).format('YYYY-MM-DD') : null,
          "data_personalizadas": e.data_personalizadas,
          "infos_cobranca": JSON.parse(e.infos_cobranca)
        }
      );
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://sharkbusiness.com.br/api/v2/financeiro/',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'insomnia/2023.5.8',
          'Authorization': `Token ${token}`
        },
        data: data
      };

      await new Promise((resolve) => {
        axios.request(config)
          .then(() => {
            setTimeout(resolve, 500)
          })
          .catch(() => {
            setTimeout(resolve, 500)

          });
      })

    }
  }
  compareObjects(objetoBase, objetoAoAnalisar, comparar = true) {
    if (!comparar || objetoBase == undefined || objetoBase == null) return false
    let distinct = false
    Object.keys(objetoBase).forEach(e => {
      if (objetoBase[e] instanceof Date || objetoAoAnalisar[e] instanceof Date || objetoAoAnalisar[e] == `Invalid date` || objetoBase[e] == `Invalid date`) {
        objetoBase[e] = moment(objetoBase[e]).format('YYYY-MM-DD')
        objetoAoAnalisar[e] = moment(objetoAoAnalisar[e]).format('YYYY-MM-DD')

      }
      try {
        if (objetoBase[e].toString().replace(/ /g, '') != objetoAoAnalisar[e].toString().replace(/ /g, '')) {
          distinct = true
        }
      } catch {
        if (objetoBase[e] != objetoAoAnalisar[e]) {

          distinct = true
        }
      }

    })
    return distinct
  }
  syncDB(sharkArray, dbArray, selectDistincts = true) {
    let missingOnShark = []
    let distinctOnShark = []

    dbArray.forEach(element => {
      let onSharkValue = sharkArray.filter(e => e.id_externo == element.id_externo)[0]

      if (onSharkValue != undefined) {
        delete onSharkValue['empresa']
        delete onSharkValue['owner']
        delete onSharkValue['id']
      }
      if (onSharkValue == undefined) {
        missingOnShark.push(element)
      }
      if (selectDistincts) {
        if (this.compareObjects(onSharkValue, element, selectDistincts)) {

          distinctOnShark.push(element)
        }
      }

    });

    return {
      missingOnShark, distinctOnShark, shoudntExistOnShark: sharkArray.filter(e => {
        let respos = dbArray.filter(f => {
          return parseInt(f.id_externo) == parseInt(e.id_externo)
        })
        return respos.length == 0
      })
    }
  }


}
module.exports = sharkConnection
// function formatTimeFromDays(days) {
//   // Convertendo dias para segundos
//   const totalSeconds = days * 24 * 60 * 60;

//   // Calculando horas, minutos e segundos
//   const hours = Math.floor(totalSeconds / 3600);
//   const minutes = Math.floor((totalSeconds % 3600) / 60);
//   const seconds = totalSeconds % 60;

//   // Retornando no formato "hh:mm:ss"
//   return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
// }
function removeQuotes(str) {
  // Verifica se o primeiro e o último caractere são aspas
  if (str == undefined) return str;
  if (str.startsWith('"') && str.endsWith('"')) {
    // Remove o primeiro e o último caractere
    return str.slice(1, -1);
  }
  // Retorna a string original caso não tenha aspas no início e no fim
  return str;
}
// function diferentesArrays(arrayA, arrayB) {
//   const onlyInA = arrayA.filter(num => !arrayB.includes(num));
//   return onlyInA
// }