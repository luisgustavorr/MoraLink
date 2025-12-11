const Store = require('electron-store');
const store = new Store();
let Firebird = require('node-firebird');
const sshTunneling = require('./sshTunneling');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class firebirdConnection {
  constructor(connInfo) {
    this.options = connInfo;
    this.connection = null;
  }

  createPool(options) {
    return Firebird.pool(5, options);
  }

  async connect(retries = 5, delay = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (store.get('ssh_host') != undefined && store.get('ssh_host') !== '(EMPTY)'&& store.get('ssh_host') !== '' && store.get('ssh_host') !== 'desativado') {
          console.log('TUNNEL db');
          this.connection = await sshTunneling(
            () => Firebird.pool(5, this.options),
            this.options
          );
        } else {
          console.log('FIREBIRD', JSON.stringify(this.options));
          this.connection = Firebird.pool(5, this.options);
          await new Promise((resolve, reject) => {
            this.connection.get((err, db) => {
              if (err) return reject(err);
              db.detach();
              resolve(true);
            });
          });
        }

        console.log('🔥 Firebird connected successfully');
        return; // success, exit loop

      } catch (err) {
        console.warn(`❌ Connection attempt ${attempt} failed: ${err.message}`);
        if (attempt < retries) {
          console.log(`⏳ Retrying in ${delay}ms...`);
          await sleep(delay);
        } else {
          throw new Error(`Failed to connect after ${retries} attempts: ${err.message}`);
        }
      }
    }
  }

  async exec(query) {
    if (!this.connection) throw new Error("Sem conexão Firebird!");
    return new Promise((resolve, reject) => {
      this.connection.get((err, db) => {
        if (err) return reject(err);
        db.query(query, (err, result) => {
          db.detach();
          if (err) return reject(err);
          resolve(result);
        });
      });
    });
  }
}

module.exports = firebirdConnection;
