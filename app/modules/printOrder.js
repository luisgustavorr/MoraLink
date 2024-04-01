const escpos = require('escpos');
escpos.USB = require('escpos-usb');
class Order {
    constructor(orderInfo, vID, pID, local = false) {
        this.orderInfo =orderInfo;
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

        this.printer
            .text("PEDIDO", '857')

        this.separador()
        let retirada = "NAO"
        if (this.orderInfo.retirada === 1) {
            retirada = "SIM"
        }
        const [ dataPedido, horaPedido ] = this.orderInfo.data_pedido.split(" ")
        const [ dataEntrega, horaEntrega ] = this.orderInfo.data_entrega.split(" ")
        let numero = this.orderInfo.numero_cliente
        let numero_formatado = "("+numero[0]+numero[1]+") "+numero[2]+numero[3]+numero[4]+numero[5]+"-"+numero[6]+numero[7]+numero[8]+numero[9]

        if(numero.length == 11){
             numero_formatado = "("+numero[0]+numero[1]+") "+numero[2]+" "+numero[3]+numero[4]+numero[5]+numero[6]+"-"+numero[7]+numero[8]+numero[9]+numero[10]

        }
        this.printer
            .text("Cliente: " + this.orderInfo.cliente, '857')
            .text("Número Cliente: " + numero_formatado, '857')
        this.separador()
        this.printer
            .text("Valor Entrada: " + this.orderInfo.valor_entrada, '857')
        this.separador()
        this.printer
            .text("Data do Pedido: " + dataPedido, '857')
            .text("Hora do Pedido: " + horaPedido, '857')
        this.separador()
        this.printer
            .text("Data da Entrega: " + dataEntrega, '857')
            .text("Hora da Entrega: " + horaEntrega, '857')
        this.separador()
        this.printer
            .text("Entrega ? " + retirada, '857')
        if (retirada == "NAO") {
            this.printer
                .text("Endereço: " + this.orderInfo.endereco, '857')
        }
        this.separador()

        this.printer
            .text("-> DOCUMENTO NAO FISCAL <-", '857')
            this.separador()
        this.printer
            .text("Itens", '857')
    }
    repeatPart() {
        let valorTotal = 0
        for (const produto of this.orderInfo.produtos) {
            valorTotal = parseFloat(parseFloat(valorTotal) + parseFloat(produto.preco)).toFixed(2)
            this.printer
                .text(produto.quantidade + " - " + produto.id.replace(/_/g," ") + " R$"+produto.preco, '857')
        }
        this.separador()

        this.printer
        .text("Valor Total: R$"+valorTotal+"\n", '857')
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
