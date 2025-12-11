const mssql = require('mssql');
require('dotenv').config();
const Store = require('electron-store');
const store = new Store();
const sshTunneling = require('./sshTunneling');

class mssqlConnection {
  constructor(connInfo) {
        this.Mssql = connInfo;
        this.connection = null;
    }

    async connect() {
        if (store.get('ssh_host') != undefined && store.get('ssh_host') !== '(EMPTY)'&& store.get('ssh_host') !== '' && store.get('ssh_host') !== 'desativado') {
            this.connection = await sshTunneling(async (config) => {
                const pool = new mssql.ConnectionPool(config);
                await pool.connect();
                return pool;
            }, this.Mssql, false);
        } else {
            this.connection = new mssql.ConnectionPool(this.Mssql);
            await this.connection.connect();
        }
    }

    async exec(query, args = []) {
        let paramIndex = 0;
        const parsedQuery = query.replace(/\?/g, () => {
            if (paramIndex >= args.length) {
                throw new Error('Número de placeholders excede os parâmetros');
            }
            return `@p${paramIndex++}`;
        });

        if (paramIndex !== args.length) {
            throw new Error('Número de parâmetros excede os placeholders');
        }

        const request = this.connection.request();
        args.forEach((value, index) => {
            request.input(`p${index}`, value);
        });

        const result = await request.query(parsedQuery);
        return result.recordset;
    }

    async end() {
        await this.connection.close();
    }
}

module.exports = mssqlConnection;