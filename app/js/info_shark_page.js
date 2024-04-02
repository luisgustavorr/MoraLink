export class infoShark {
    constructor() {

    }
    prepareForm() {
        this.setValues()
        this.submitAtChange()
        this.submitAtEnter()
    }
    submitAtChange() {
        let sendForm = this.enviarFormulario
        $("#content_inf_shark input, #content_inf_shark textarea").change(
            async function (e) {
                if ($(this).val() != "" || $(this).attr("id") == "password_db") {
                    let id = $(this).attr("id")
                    let value = $(this).val()
                    sendForm(id,value)
               
                } else {
                    alertar("Favor insira um valor")
                }
            });
    }
    submitAtEnter() {
        $("#content_inf_shark input,#content_inf_shark textarea").keyup(function (e) {
            if (e.keyCode == 13) {
                $(this).change()
            }
        })
    }
    async enviarFormulario(id,value) {
        let setVariable = await window.indexBridge.setVariable(id, value)
        let getVariable = await window.indexBridge.getVariable(id)
        console.log(getVariable)
        $(this).val(getVariable)
        alertar(`${id} alterado(a).`,"Sucesso!","700px","fa-solid fa-check")

    }
    setValues(){
        $("#content_inf_shark input, #content_inf_shark textarea").each( async function(){
            let id = $(this).attr("id")
            console.log(id)
            let getVariable = await window.indexBridge.getVariable(id)
            console.log(getVariable)
            $(this).val(getVariable)

        })
    }
}