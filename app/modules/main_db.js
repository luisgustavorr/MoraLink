var postgresql = require('pg');
const { Pool } = postgresql
const { app } = require('electron');
const net = require('net');

const path = require('path');

require('dotenv').config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(process.cwd(), '.env'),
})
const Ssh2Promise = require('ssh2-promise');
const { log } = require('./logger');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}
async function connectToServer(connection, info, itsAClass = true) {
  log('ssh', 'pending', JSON.stringify({ host: process.env.SSH_DB_HOST }));

  const ssh = new Ssh2Promise({
    host: process.env.SSH_DB_HOST,
    username: process.env.SSH_DB_USER,
    password: process.env.SSH_DB_PASSWORD,
    port: process.env.SSH_DB_PORT,
    readyTimeout: 10000, // 30 segundos para handshake
    keepaliveInterval: 60000, // Envia keepalive a cada 20 segundos
    algorithms: {
      kex: [
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        'diffie-hellman-group14-sha256'
      ]
    }
  });

  ssh.on('close', () => log('ssh', 'closed', JSON.stringify({ host: process.env.SSH_DB_HOST })));
  ssh.on('error', (err) => log('ssh', 'error', JSON.stringify({ error: err.message })));

  try {
    await ssh.connect();
    log('ssh', 'connected', JSON.stringify({ host: process.env.SSH_DB_HOST }));
    const isFree = await isPortAvailable(15432);
    if (!isFree) {
      log('ssh', 'info', JSON.stringify({ msg: 'Porta 15432 já em uso. Pulando túnel.' }));
      const dbConnection = itsAClass ? new connection(info) : connection(info);

      return { dbConnection, ssh };; // já está rodando, evita colisão
    }
    await ssh.addTunnel({
      remoteAddr: 'localhost',
      remotePort: 5432,
      localPort: 15432,
    });
    await ssh.addTunnel({
      remoteAddr: 'localhost',
      remotePort: 1080, // VPS will connect to this
      localPort: 1081,  // Your local proxy will listen here
    });
    console.log('Tunnel created on local port 1080');
    log('ssh', 'tunnel_created', JSON.stringify({ localPort: 15432 }));

    const dbConnection = itsAClass ? new connection(info) : connection(info);
    return { dbConnection, ssh };

  } catch (e) {
    log('ssh', 'error', JSON.stringify({ error: e.message }));
    throw e;
  }
}
class postgresqlConnection {
  constructor() {
    this.PostgreSql = {
      host: process.env.MORALINK_HOST_DB,
      user: "postgres",
      password: process.env.MORALINK_PASSWORD_DB,
      database: process.env.MORALINK_DB_NAME,
      charset: 'utf8mb4',
      port: "15432"
    };
    this.ssh = null;
    this.sshConnection = null;
    this.pool = null;
    this.connectionAttempts = 0;
  }
  async getSSHConnection() {
    if (!this.sshConnection || this.sshConnection.socket.closed) {
      this.sshConnection = await this.createSSHTunnel();
    }
    return this.sshConnection;
  }
  async createSSHTunnel() {
    const ssh = new Ssh2Promise({
      host: process.env.SSH_DB_HOST,
      username: process.env.SSH_DB_USER,
      password: process.env.SSH_DB_PASSWORD,
      port: process.env.SSH_DB_PORT,
      readyTimeout: 10000, // 10 segundos para handshake
      keepaliveInterval: 60000, // Envia keepalive a cada 60 segundos
      algorithms: {
        kex: [
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group14-sha256'
        ]
      }
    });

    ssh.on('error', (e) => {
      log('ssh', 'error', JSON.stringify({ error: e.message }));
      this.sshConnection = null;
    });

    await ssh.connect();
    await ssh.addTunnel({
      remoteAddr: 'localhost',
      remotePort: 5432,
      localPort: 15432,
    });
    return ssh;
  }
  async connect() {
    log('postgresql', 'pending', JSON.stringify({ host: this.PostgreSql.host }));

    try {
      const { dbConnection, ssh } = await connectToServer(Pool, this.PostgreSql);
      this.connection = dbConnection;
      this.ssh = ssh;

      log('postgresql', 'connected', JSON.stringify({ host: this.PostgreSql.host }));
      return this.connection;
    } catch (e) {
      log('postgresql', 'error', JSON.stringify({ error: e.message }));
      throw e;
    }
  }
  async connectWithRetry() {
    const MAX_RETRIES = 5;
    const BASE_DELAY = 15000;

    try {
      await this.connect();
      this.connectionAttempts = 0;
    } catch (error) {
      this.connectionAttempts++;

      if (this.connectionAttempts > MAX_RETRIES) {
        throw new Error(`Conexão falhou após ${MAX_RETRIES} tentativas`);
      }

      const delay = BASE_DELAY * Math.pow(2, this.connectionAttempts);
      await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 500));
      return this.connectWithRetry();
    }
  }
  async exec(query, args = undefined) {
    let client;
    try {
      await this.connectWithRetry();
      client = await this.connection.connect();
      let i = 0
      const modifiedQuery = query.split('').map(e => {
        if (e == '?') {
          i++
          return `$${i}`
        }
        return e
      }).join('')
      log(JSON.stringify(modifiedQuery))
      const result = await client.query(modifiedQuery, args);

      return result.rows;
    } catch (e) {
      log('postgresql', 'query_error', JSON.stringify({
        query: query.substring(0, 100),
        error: e.message
      }));
      throw e;
    } finally {
      if (client) client.release();
    }
  }
  end() {
    if (this.connection) {
      this.connection.end();
      log('postgresql', 'closed', JSON.stringify({ host: this.PostgreSql.host }));
    }
    if (this.ssh) {
      this.ssh.close();
      log('ssh', 'closed', JSON.stringify({ host: process.env.SSH_DB_HOST }));
    }
  }

}
module.exports = postgresqlConnection;



