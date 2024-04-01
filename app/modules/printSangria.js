const fs = require("fs");
const convert = require('xml-js');
const localPrinter = require("./consolePrinter")
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
const { format } = require('date-fns');

// Obtém a data atual

class Order {
    constructor(sangriaInfo, vID, pID, local = false) {
        this.sangriaInfo = sangriaInfo;
        console.log(typeof (this.sangriaInfo))
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
        const currentDate = new Date();

        // Formata a data para o formato desejado
        const formattedDate = format(currentDate, 'yyyy/MM/dd HH:mm:ss');
        this.separador()

        this.printer
            .text("SANGRIA DE CAIXA", '857')
        this.separador()
        this.printer
            .text("\nData: " + formattedDate, '857')
            .text("Valor Sangria: " + this.sangriaInfo.valor_sangria, '857')
            .text("Novo Valor em Caixa: " + this.sangriaInfo.valor, '857')
            .text("Cod. colaborador: " + this.sangriaInfo.colaborador, '857')
            .text("Motivo: " + this.sangriaInfo.mensagem, '857')
            .text("Assinatura _____________________ \n", '857')
        this.separador()

    }

    separador() {
        this.printer.align("lt")
        this.printer.text('='.repeat(38), '857');
    }
}
// let teste = new Order(JSON.stringify(data), 132, 123,true)
// teste.printOrder()
module.exports = Order;
