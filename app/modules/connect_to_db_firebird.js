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
  try {
    if (store.get('ssh_host') && store.get('ssh_host') !== '(EMPTY)' && store.get('ssh_host') !== 'desativado') {
      console.log('TUNNEL db')
      this.connection = await sshTunneling(
        () => Firebird.pool(5, this.options),
        this.options
      );
    } else {
      console.log('FIREBIRD', JSON.stringify(this.options))
      this.connection = Firebird.pool(5, this.options); // sem await!
    }
  } catch (err) {
    console.error('Erro conectando ao Firebird:', err);
    throw err;
  }
}
  async exec(query) {
    try {
      console.log('Executando Query Firebird')
      return new Promise(async (resolve, reject) => {
        this.connection.get(function (err, db) {
          if (err) throw err;
          db.query(query, function (err, result) {
            console.log('Query executada')
            if (err) {
              console.error("Erro na query:", err);
              return reject(err) // Ou resolve(null), ou reject(err)
            }
            resolve(result);
            db.detach();
          });
        });
      })
    } catch (e) {
      console.log('ERRO FIREBIRD', e)
    }
  }
}
module.exports = firebirdConnection