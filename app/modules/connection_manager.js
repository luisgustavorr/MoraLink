const mysql_connection = require("./connect_to_db_mysql");
const firebird_connection = require("./connect_to_db_firebird");

class selectConnection {
    constructor(type){
        this.type = type
    }
    selectConnectionType(){
        switch (this.type) {
            case 'mysql':
                return mysql_connection;
            case 'firebird':
                return firebird_connection;
          }
    }
}
module.exports = selectConnection