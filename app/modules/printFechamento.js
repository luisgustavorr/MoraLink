const fs = require("fs");
const convert = require('xml-js');
const localPrinter = require("./consolePrinter")
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
class Order {
    constructor(closeInfo, vID, pID, local = false) {
        this.closeInfo = closeInfo;
        console.log(typeof (this.closeInfo))

        this.local = local
        console.log(vID)
        this.device = new escpos.USB(vID, pID);
    }
    printOrder() {
        this.device.open((err) => {
            if (err) {
                console.error(err);
                return;
            }
            this.textConfig()
            this.staticPart()
            this.printer.cut().close()
        })
    }
    textConfig() {
        this.printer = new escpos.Printer(this.device);


        this.printer
            .font('a')
            .size(1, 1)
            .align('lt')
    }
    staticPart() {
        this.printer
            .text("FECHAMENTO DE CAIXA", '857')

        this.separador();
        this.printer
            .text("Dinheiro Informado: " + this.closeInfo["dinheiro_informadas"], '857')
        this.separador();
        this.printer
            .text("Cartao Informado: " + this.closeInfo["cartao_informadas"], '857')
        this.separador();
        this.printer
            .text("Moedas Informadas: " + this.closeInfo["moedas_informadas"], '857')
        this.separador();
        this.printer
            .text("Pix Informado: " + this.closeInfo["pix_informadas"], '857')
        this.separador();
        this.printer
            .text("Sangria Informadas: " + this.closeInfo["sangria_informadas"], '857')
        this.separador();
        this.printer
            .text("Colaborador: " + this.closeInfo["codigo_colaborador_informado_fechamento"] + "\n", '857')
    }

    separador() {
        this.printer.align("lt")
        this.printer.text('='.repeat(38), '857');
    }
}
// let data = { "id": "308", "cliente": "Teste", "produtos": "[{\"id\":\"Teste_1\",\"quantidade\":\"1\",\"preco\":\"10.00\"},{\"id\":\"Teste_2\",\"quantidade\":\"1\",\"preco\":\"10.00\"}]", "entregue": "0", "data_entrega": "2024-01-10 14:30:00", "data_pedido": "2024-01-10 14:00:00", "retirada": "0", "forma_pagamento": "Pix", "endereco": "", "caixa": "Mix Salgados Prainha Ltda", "valor_entrada": "10", "metodo_entrada": "Pix", "colaborador": "9841", "numero_cliente": "37984103402", "enviado": "0" }
// let teste = new Order(JSON.stringify(data), 132, 123,true)
// teste.printOrder()
module.exports = Order;
