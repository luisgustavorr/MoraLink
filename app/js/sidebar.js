export class sidebar {
    constructor() {

    }
    selectPage() {
        $("#sidebar span").click(function () {
            let ultima_pagina_aberta = $(".selected_page").attr("page")
            $(".selected_page").removeClass("selected_page")
            console.log(ultima_pagina_aberta)
            $(this).addClass("selected_page")
            $("#content_"+ultima_pagina_aberta).css("display", "none")
            $("#content_"+$(this).attr("page")).css("display", "block")
        })
    }
}