/**************************************************************************
 * Eddie Tools Alpha
 * main.js
 **************************************************************************/

class EddieTools {

    constructor() {

        this.logElement = document.getElementById("log");

        this.initialize();

    }

    initialize() {

        this.writeLog("Eddie Tools Alpha initialized.");

        this.registerEvents();

    }

    registerEvents() {

        const btnNewDocument = document.getElementById("btnNewDocument");
        const btnOpenFolder = document.getElementById("btnOpenFolder");
        const btnCreateLayout = document.getElementById("btnCreateLayout");

        if (btnNewDocument) {

            btnNewDocument.addEventListener("click", () => {

                this.newDocument();

            });

        }

        if (btnOpenFolder) {

            btnOpenFolder.addEventListener("click", () => {

                this.openFolder();

            });

        }

        if (btnCreateLayout) {

            btnCreateLayout.addEventListener("click", () => {

                this.createLayout();

            });

        }

    }

    newDocument() {

        this.writeLog("New Document command selected.");

        // Adobe InDesign API will be connected here.

    }

    openFolder() {

        this.writeLog("Open Images Folder command selected.");

        // File System API will be connected here.

    }

    createLayout() {

        this.writeLog("Create Layout command selected.");

        // Layout Engine will be connected here.

    }

    writeLog(message) {

        if (!this.logElement)
            return;

        const time = new Date().toLocaleTimeString();

        this.logElement.innerHTML += `<br>[${time}] ${message}`;

    }

}

window.addEventListener("DOMContentLoaded", () => {

    new EddieTools();

});