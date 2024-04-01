// server.js

const express = require('express');
const bodyParser = require('body-parser');
const path = require('node:path');
const DanfcePOS = require("./xmlPrinter");
const app = express();
const fs = require('fs');
const Order = require("./printOrder")
const Fechamento = require("./printFechamento")
const Venda = require("./printLastVenda")

const Sangria = require("./printSangria")

const multer = require('multer');
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

function generatePath(date, type) {
    let data = date
    let dataArray = data.split("-")
    let caminhoXML = path.resolve("C:\\Users\\Public\\Documents\\NotasFiscais\\" + type + "\\" + dataArray[0] + "\\" + dataArray[1] + "\\" + dataArray[2] + "\\" + data + "." + type)
    console.log(caminhoXML)
    // Verifica se o diretório do caminho existe, se não, cria recursivamente
    let dirname = path.dirname(caminhoXML);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }

    return caminhoXML;
}

app.post('/printXML', upload.none(), async (req, res) => {
    console.log("print")
    try {
        let data =await req.body.dataXML
        let vID = req.body.vID
        let pID = req.body.pID      
        console.log(data)
        let printer = new DanfcePOS(generatePath(data,"xml"), vID,pID)
        printer.printAll()
        res.status(200).json({ status: "Sucesso" });
    } catch (error) {
        console.log(error)
        res.status(500).json({  status: "Falha :" + error });

    }

});
app.post('/printOrder', upload.none(), async (req, res) => {
    console.log("print")
    try {
        let infoOrder =await req.body.infoOrder
        infoOrder = JSON.parse(infoOrder)
        let vID = req.body.vID
        let pID = req.body.pID      
        let printer = new Order(infoOrder,vID,pID)
        printer.printOrder()
        res.status(200).json({ status: "Sucesso" });
    } catch (error) {
        console.log(error)
        res.status(500).json({  status: "Falha :" + error });

    }

});
app.post('/printFechamento', upload.none(), async (req, res) => {
    try {
        let infoOrder =await req.body.infoOrder
        infoOrder = JSON.parse(infoOrder)
        let vID = req.body.vID
        let pID = req.body.pID      
        let printer = new Fechamento(infoOrder,vID,pID,true)
        printer.printOrder()
        res.status(200).json({ status: "Sucesso" });
    } catch (error) {
        console.log(error)
        res.status(500).json({  status: "Falha :" + error });

    }

});
app.post('/printSangria', upload.none(), async (req, res) => {
    console.log("print")
    try {
        let infoOrder =await req.body.infoOrder
        infoOrder = JSON.parse(infoOrder)
        let vID = req.body.vID
        let pID = req.body.pID      
        let printer = new Sangria(infoOrder,vID,pID)
        printer.printOrder()
        res.status(200).json({ status: "Sucesso" });
    } catch (error) {
        console.log(error)
        res.status(500).json({  status: "Falha :" + error });

    }

});
app.post('/printLastVenda', upload.none(), async (req, res) => {
    console.log("print")
    try {
        let infoOrder =await req.body.infoOrder
        infoOrder = JSON.parse(infoOrder)
        let vID = req.body.vID
        let pID = req.body.pID      
        let printer = new Venda(infoOrder,vID,pID,true)
        printer.printOrder()
        res.status(200).json({ status: "Sucesso" });
    } catch (error) {
        console.log(error)
        res.status(500).json({  status: "Falha :" + error });

    }

});
app.post('/saveXML', upload.single("fileXML"), async (req, res) => {
    console.log("print")

    try {
        let data = req.body.dataXML
        const fileInfo = req.file
        const base64 = fileInfo.buffer.toString("base64");
        let caminhoXML = generatePath(data,"xml")

        const filePath = caminhoXML

        fs.writeFileSync(filePath, fileInfo.buffer)
        res.status(200).json({ status: "Sucesso" });
    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Falha :" + error });

    }

});
app.post('/savePDF', upload.single("filePDF"), async (req, res) => {
    console.log("print")

    try {
        let data = await req.body.dataXML
        const fileInfo = req.file
        const base64 = fileInfo.buffer.toString("base64");
        let caminhoXML = generatePath(data,"pdf")

        const filePath = caminhoXML

        fs.writeFileSync(filePath, fileInfo.buffer)
        res.status(200).json({ status: "Sucesso" });
    } catch (error) {
        console.log(error)
        res.status(500).json({ status: "Falha :" + error });

    }

});
class serverManager {
    constructor() {
        this.server = null
    }
    startServer() {
        try {
            this.server = app.listen(port, () => {
                console.log(`octopus rodando na porta :  ${port}`);
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
            console.log(`octopus parou de rodar na porta:  ${port}`);
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
