var postgresql = require('pg');
const { Pool } = postgresql
require('dotenv').config()
const Store = require('electron-store');
const store = new Store();
const sshTunneling = require('./sshTunneling');
const { reject } = require('lodash');
class postgresqlConnection {
  constructor(connInfo) {
    this.PostgreSql = connInfo
    this.tunnelConfig = {
      host: store.get("ssh_host"),
      port: store.get("ssh_port"),
      username: store.get("ssh_user"),
      password: store.get("ssh_password"),
  }
    this.results;

  }

  async connect() {
    console.log('Conectando postgrees')
    try{
      if (store.get('ssh_host') != '' && store.get('ssh_host') != '(EMPTY)' && store.get('ssh_host') != 'desativado') {
    console.log('Tentando conectar por Tunnel psql')

        this.connection = await sshTunneling(Pool,this.PostgreSql)
    }else{
    console.log('Tentando conectar direto',JSON.stringify(this.PostgreSql))

      this.connection = new Pool(this.PostgreSql)
    }

      return this.connection 
  }
  catch(e){
    console.log('ERRO NO TUNNEL',e)
    return
  }
  }
  async exec(query, args = undefined) {

    return new Promise( async (resolve,reject) => {
    try{

      let result = await this.connection.query(query, args)
      resolve(result.rows)
       }catch(e){
        reject(e.message)
      console.log("Erro executando query psql",e.message)
    }
    });
   
  }

  end() {
    this.connection.end();
  }
}

module.exports = postgresqlConnection;




