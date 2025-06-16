const mysql_connection = require("./connect_to_db_mysql");
const firebird_connection = require("./connect_to_db_firebird");
const postgresql_connection = require("./connect_to_db_postgresql");
const mssql_connection = require("./connect_to_db_mssql");

class selectConnection {
    constructor(type){
        this.type = type
    }
    selectConnectionType(){
        switch (this.type) {
            case 'postgresql':
                return postgresql_connection;
            case 'mssql':
                return mssql_connection;
            case 'mysql':
                return mysql_connection;
            case 'firebird':
                return firebird_connection;
          }
    }
}
module.exports = selectConnection