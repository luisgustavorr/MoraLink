const Store = require('electron-store');
const store = new Store();
let Firebird = require('node-firebird');
const sshTunneling = require('./sshTunneling')

class firebirdConnection {
  constructor() {
    this.options = {}
    this.connection
    this.options.host = store.get('host_db');
    this.options.port = store.get("port_db");
    this.options.database = store.get('db_name_db');
    this.options.user = store.get('user_db');
    this.options.password = store.get('password_db');
    this.options.lowercase_keys = true; // set to true to lowercase keys
    this.options.role = null;            // default
    this.options.pageSize = 4096;        // default when creating database
    this.options.pageSize = 4096;        // default when creating database
    this.options.retryConnectionInterval = 1000; // reconnect interval in case of connection drop
    this.options.blobAsText = true; // set to true to get blob as text, only affects blob subtype 1
    this.options.encoding = 'UTF-8'; // default encoding for connection is UTF-8
    this.options.wireCrypt = false
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