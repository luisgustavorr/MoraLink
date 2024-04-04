// server.js

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const multer = require('multer');
const SelectConnection = require("./connection_manager")
const storage = multer.memoryStorage();
const Store = require('electron-store');
const store = new Store();
if (!store.has('PORT')) {
    store.set('PORT', 3000);
}
let port = store.get('PORT');

if (store.has('minhaVariavel')) {
    let minhaVariavel = store.get('minhaVariavel');

    // Faça qualquer manipulação necessária na variável
    console.log('Valor da minhaVariavel:', minhaVariavel);
}
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
})
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.get('/', (req, res) => {
    res.status(200).json({ status: 200 });

});
app.post('/select', async (req, res) => {
    const connectionSelector = new SelectConnection(store.get("db_type_db"));
    const connectionClass = connectionSelector.selectConnectionType();
    // Agora você pode usar a classe retornada normalmente
    const connectionInstance = new connectionClass();
    connectionInstance.connect()
    let results = await connectionInstance.exec()
    res.status(200).json({ status: 200, results: JSON.stringify(results)});

});
app.post('/clear', async (req, res) => {
    store.clear()
    res.status(200).json({ status: 200});

});
class serverManager {
    constructor() {
        this.server = null
    }
    startServer() {
        try {
            this.server = app.listen(port, () => {
                console.log(`MoraLink rodando na porta :  ${port}`);
                return true;
            });
        } catch (e) {
            return e
        }
    }
    getPort() {
        return port;
    }
    async stopServer() {
        try {
            console.log(`MoraLink parou de rodar na porta:  ${port}`);
            this.server.close();
            return true

        } catch (e) {
            return e
        }
    }
    async setPort(newPort) {
        try {

            port = newPort
            store.set('PORT', port);
            await this.stopServer()
            this.startServer()
            return true
        } catch (e) {
            return e

        }

    }
}

module.exports = serverManager;
