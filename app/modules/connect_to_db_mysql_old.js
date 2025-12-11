var mysql = require('mysql');
require('dotenv').config()
const Store = require('electron-store');
const store = new Store();
const PoolManager = require('mysql-connection-pool-manager');
const sshTunneling = require('./sshTunneling')

class mysqlConnection {
   constructor(connInfo) {

        this.MySql = {
            host: store.get("host_db"),
            user: store.get("user_db"),
            password: store.get("password_db"),
            database: store.get("db_name_db"),
            port: Number(store.get("port_db")) || 3306,
            insecureAuth: true,   // Habilita autenticação antiga
            ssl: false            // Desabilita SSL

        };
        this.poolManager = {
            idleCheckInterval: 1000,
            maxConnextionTimeout: 30000,
            idlePoolTimeout: 3000,
            errorLimit: 5,
            preInitDelay: 50,
            sessionTimeout: 60000,
            mySQLSettings: this.MySql
        };
        this.mysql = PoolManager(this.poolManager);

        this.results = "";
    }
    async connect() {
        if (store.get('ssh_host') != undefined && store.get('ssh_host') !== '(EMPTY)'&& store.get('ssh_host') !== '' && store.get('ssh_host') !== 'desativado') {
            console.log('Tentando conectar por SSH', store.get('ssh_host'))

            this.connection = await sshTunneling(mysql.createPool, {
                host: store.get("host_db"),
                user: store.get("user_db"),
                password: store.get("password_db"),
                database: store.get("db_name_db"),
                port: Number(store.get("port_db")) || 3306,
                insecureAuth: true,   // Habilita autenticação antiga
                ssl: false            // Desabilita SSL

            }, false)
        } else {
            try{
                console.log('Versão da lib mysql carregada:', require('mysql/package.json').version);
            }catch{
                console.log('eRROO NA VERSÃO ')
            }
   
            this.connection = mysql.createPool({
                host: store.get("host_db"),
                user: store.get("user_db"),
                password: store.get("password_db"),
                database: store.get("db_name_db"),
                port: Number(store.get("port_db")) || 3306,
                insecureAuth: true,   // Habilita autenticação antiga
                ssl: false            // Desabilita SSL

            });
        }

    }
    async exec(query, args = undefined) {
        if (this.connection == undefined) {
            console.log('CONEXÃO INVÁLIDA')
        }
        return new Promise((resolve, reject) => {
            this.connection.query(query, args, (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    }

    end() {
        this.connection.end();
    }
}

module.exports = mysqlConnection;




