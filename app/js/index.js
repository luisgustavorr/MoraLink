import { configPage } from "./config_page.js";
import { sidebar } from "./sidebar.js";
import { infoDBPage } from "./info_banco_dados.js";
import { infoShark } from "./info_shark_page.js";
async function initializePage() {
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
    const sidebarClass = new sidebar();
    sidebarClass.selectPage();
    const configPageClass = new configPage();
    configPageClass.prepareForm()
    const infoDBPageClass = new infoDBPage();
    infoDBPageClass.prepareForm()
    const infoSharkClass = new infoShark();
    infoSharkClass.prepareForm()
    return
}

$(document).ready(function () {
    initializePage()
})