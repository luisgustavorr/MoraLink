const fs = require("fs");
const convert = require('xml-js');
const localPrinter = require("./consolePrinter")
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
class Order {
    constructor(saleInfo, vID, pID, local = false) {
        this.saleInfo =saleInfo;
        this.local = local
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
        this.repeatPart()
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
        console.log(typeof (this.saleInfo))
        this.printer
            .text("CUPOM DE VENDA", '857')
        this.separador();
        console.log( this.saleInfo)
        const [ dataCompra, horaCompra ] = this.saleInfo["infoVenda"].data.split(" ")
        this.printer
            .text("Data da compra: " + dataCompra, '857')
        this.printer
            .text("Hora da compra: " + horaCompra, '857')
        this.separador();
    }
    repeatPart() {
        let valorTotal = 0
        for (const produto of this.saleInfo.infoProds) {
            valorTotal = parseFloat(parseFloat(valorTotal) + parseFloat(produto.valor)).toFixed(2)
            this.printer
                .text("Produto: "+produto.nome+"\n", '857')
                .text("Quantidade: "+produto.quantidade_produto+"\n", '857')
                .text("Valor: "+produto.valor+"\n", '857')
                this.separador()

        }

        this.printer
        .text("Valor Total: R$"+valorTotal+"\n", '857')
        this.separador()

    }
    separador() {
        this.printer.align("lt")
        this.printer.text('='.repeat(38), '857');
    }
}
// let data ={"infoProds":[{"id":"1331","colaborador":"4","data":"2024-03-19 04:00:42","valor":"6.9","caixa":"Mix Salgados Prainha Ltda","produto":"1331","forma_pagamento":"Dinheiro","pedido_id":"0","quantidade_produto":"1","venda_dividida_id":"0","troco":"3.1","nome":"PAO DE BATATA COM 12 UNID","codigo":"7890000908573","administrador":"1","preco":"6.9","por_peso":"0","codigo_id":"90857","vendido":"1","ncm":"1905.90.90","cod_grp_financeiro":"40","cst_icms":"102","icms":"18","cst_pis_cofins":"99","json_precos":"{\"Mix Salgados Ltda\":\"6.9\",\"Mix Salgados Prainha Ltda\":\"6.9\",\"Mix Salgados Variados Ltda\":\"3.90\"}","validade":"5"}],"infoVenda":{"data":"2024-03-19 04:00:42"}}

// let teste = new Order(JSON.stringify(data), 132, 123, true)
// teste.printOrder()
module.exports = Order;
