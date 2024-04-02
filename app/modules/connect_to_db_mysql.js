var mysql = require('mysql');
const Store = require('electron-store');
const store = new Store();
class mysqlConnection {
    constructor() {
        this.connection = ""
        this.results = ""
    }
    connect() {
        var connection = mysql.createConnection({
            host: store.get("host_db"),
            user: store.get("user_db"),
            password: store.get("password_db"),
            database: store.get("db_name_db")
        });
        this.connection = connection

    }
    async exec() {
        let exec_process = new Promise(async (resolve, reject) => {
            this.connection.connect();
            await this.connection.query(store.get("query_db"), function (error, results, fields) {
                if (error) throw error;
                resolve(results)
            });
            this.end()
        })
       await exec_process.then((value) => {
            this.results = value
        })
       return this.results
    }
    end() {
        this.connection.end();

    }

}

module.exports = mysqlConnection



