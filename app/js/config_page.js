export class configPage {
    constructor() {

    }
    prepareForm(){
        this.submitAtChange()
        this.submitAtEnter()

    }
    submitAtChange() {
        let sendForm = this.enviarFormulario
        $("#config_father input").change(
            async function (e) {
                if ($(this).val() != "") {
                    sendForm($(this).val())
                } else {
                    alertar("Favor insira um valor")
                }
            });
    }
    submitAtEnter() {
        $("#config_father input").keyup((e) => {
            if (e.keyCode == 13) {
                $(this).change()
            }
        })
    }
    async enviarFormulario(porta) {
        let busyPort = await window.indexBridge.checkPort(porta)
        console.log(busyPort)
        if (busyPort) {
          alertar("Porta Ocupada, utilize outra !")
        } else {
          let changePort = await window.indexBridge.restartServer(porta)
          $("#porta").text(porta)
          $("#config_father input").val(porta)
          alertar("Porta alterada, não se esqueça de altera-la no seu sistema também.","Sucesso!","700px","fa-solid fa-check")
        }
      }
}