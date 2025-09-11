const Store = require('electron-store');
const store = new Store();
let Firebird = require('node-firebird');
const sshTunneling = require('./sshTunneling')

class firebirdConnection {
  constructor(connInfo) {
    this.options = connInfo
    this.connection

  }
createPool(options) {
  return Firebird.pool(5, options);
}
async connect() {
  if (store.get('ssh_host') && store.get('ssh_host') !== '(EMPTY)' && store.get('ssh_host') !== 'desativado') {
    console.log('TUNNEL db')
    this.connection = await sshTunneling(
      () => Firebird.pool(5, this.options),
      this.options
    );
  } else {
    console.log('FIREBIRD', JSON.stringify(this.options));
    // Conecta de verdade e aguarda erro
    this.connection = Firebird.pool(5, this.options);
    await new Promise((resolve, reject) => {
      this.connection.get((err, db) => {
        if (err) return reject(err);
        db.detach(); // apenas testar conexão
        resolve(true);
      });
    });
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
module.exports = firebirdConnection