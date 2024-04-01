window.indexBridge.update((_event, value) => {
  $("#porcentagem").text(value)
})
window.indexBridge.getVersion((_event, value) => {
  $("#version").text(value)
})
window.indexBridge.getPort((_event, value) => {
  $("#porta").text(value)
  $("#config_father input").val(value)

})
window.indexBridge.changePercentDisplay((_event, value) => {
  $("#porcentagem").css("display", value)
})
window.indexBridge.alert((_event, message,title = "Mensagem do Sistema",size = "500px",icon = null) => {
    alertar(message,title,size, icon)
})
$.getJSON("app/config/config.json",(ret)=>{
  $("#porta").text(ret.porta)
  $("#config_father input").val(ret.porta)
})
window.indexBridge.renderToMainOneWay("teste")
$("#config_father input").mask("0000")
async function enviarFormulário(porta) {

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
$("#config_father input").change(
  async function (e) {
    if ($(this).val() != "") {
      enviarFormulário($(this).val())
    } else {
      alertar("Favor insira um valor")
    }



  });
  $("#config_father input").keyup((e)=>{
    if(e.keyCode ==13){
      $(this).change()
    }
  })