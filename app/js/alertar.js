function alertar(message,title = "Alerta!",size = "500px",icon = null){
    $.alert({
        title: title,
        icon: icon,
        boxWidth: size,
        useBootstrap: false,
        content: message,
        buttons: {
          specialKey: {
              text: 'Ok',
              keys: ['enter', 'tab'],
              action: function(){
                  return
              }
          }
      }
      });
}