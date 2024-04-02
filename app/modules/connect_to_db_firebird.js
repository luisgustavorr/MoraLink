const Store = require('electron-store');
const store = new Store();
let Firebird = require('node-firebird');
class firebirdConnection{
    constructor(){
        this.options = {}
    }
    connect() {
        this.options.host = store.get('host_db');
        this.options.port = store.get("port_db");
        this.options.database = store.get('db_name_db');
        this.options.user = store.get('user_db');
        this.options.password = store.get('password_db');
        this.options.lowercase_keys = false; // set to true to lowercase keys
        this.options.role = null;            // default
        this.options.pageSize = 4096;        // default when creating database
        this.options.pageSize = 4096;        // default when creating database
        this.options.retryConnectionInterval = 1000; // reconnect interval in case of connection drop
        this.options.blobAsText = false; // set to true to get blob as text, only affects blob subtype 1
        this.options.encoding = 'UTF-8'; // default encoding for connection is UTF-8
    }
    async exec() {
        Firebird.attach(this.options, function (err, db) {
            if (err)
                throw err;
            // db = DATABASE
            db.query(store.get('query_db'), function (err, result) {
                // IMPORTANT: close the connection
                db.detach();
            });
        
        });
    }

}
module.exports = firebirdConnection