var postgresql = require('pg');
const { Pool } = postgresql
require('dotenv').config()
const Store = require('electron-store');
const store = new Store();
const Cursor = require('pg-cursor')
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
    try {
      if (store.get('ssh_host') != '' && store.get('ssh_host') != '(EMPTY)' && store.get('ssh_host') != 'desativado') {
        console.log('Tentando conectar por Tunnel psql')

        this.connection = await sshTunneling(Pool, this.PostgreSql)
      } else {
        console.log('Tentando conectar direto', JSON.stringify(this.PostgreSql))
        const pool = new Pool(this.PostgreSql)
        this.connection = await pool.connect()
      }
      return this.connection
    }
    catch (e) {
      console.log('ERRO NO TUNNEL', e)
      return
    }
  }
  async exec(query, args = [],readBatchLength = 5000) {
    const cursor = this.connection.query(new Cursor(query, args));
    const allRows = [];
    return new Promise((resolve, reject) => {
      const readBatch = () => {
        cursor.read(readBatchLength, (err, rows) => { // fetch 500 at a time
          if (err) {
            cursor.close(() => reject(err));
            return;
          }
          if (rows.length === 0) {
            cursor.close(() => resolve(allRows));
            return;
          }
          allRows.push(...rows);
          setImmediate(readBatch); // schedule next batch
        });
      };
      readBatch();
    });
  }
  end() {
    this.connection.end();
  }
}

module.exports = postgresqlConnection;




