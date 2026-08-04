const { app } = require("indesign");
const { storage } = require("uxp");

const fs = storage.localFileSystem;

// --------------------------------------------------
// Eddie Tools Alpha
// Milestone 2 – Adobe Integration
// --------------------------------------------------

let selectedFolder = null;
let selectedImages = [];

// --------------------------------------------------
// Console
// --------------------------------------------------

function log(message) {
    const logElement = document.getElementById("log");

    const time = new Date().toLocaleTimeString();

    if (logElement) {
        logElement.innerHTML += `<div>[${time}] ${message}</div>`;
        logElement.scrollTop = logElement.scrollHeight;
    }

    console.log(`[Eddie Tools] ${message}`);
}

// --------------------------------------------------
// New Document
// --------------------------------------------------

async function createNewDocument() {
    try {
        log("Creating new InDesign document...");

        const document = app.documents.add();

        if (document) {
            log("New InDesign document created successfully.");
        }

    } catch (error) {
        log(`ERROR creating document: ${error.message}`);
        console.error(error);
    }
}

// --------------------------------------------------
// Open Images Folder
// --------------------------------------------------

async function openImagesFolder() {
    try {
        log("Opening folder picker...");

        const folder = await fs.getFolder();

        if (!folder) {
            log("Folder selection cancelled.");
            return;
        }

        selectedFolder = folder;

        const entries = await folder.getEntries();

        const imageExtensions = [
            "jpg",
            "jpeg",
            "png",
            "tif",
            "tiff",
            "psd"
        ];

        selectedImages = entries.filter(entry => {
            if (!entry.isFile) {
                return false;
            }

            const extension = entry.name
                .split(".")
                .pop()
                .toLowerCase();

            return imageExtensions.includes(extension);
        });

        log(`Folder selected: ${folder.name}`);
        log(`${selectedImages.length} image(s) found.`);

        selectedImages.forEach((image, index) => {
            log(`${index + 1}. ${image.name}`);
        });

    } catch (error) {
        log(`ERROR opening folder: ${error.message}`);
        console.error(error);
    }
}

// --------------------------------------------------
// Create Layout
// --------------------------------------------------

async function createLayout() {
    try {

        if (app.documents.length === 0) {
            log("Create Layout: no InDesign document is open.");
            return;
        }

        if (selectedImages.length === 0) {
            log("Create Layout: select an images folder first.");
            return;
        }

        log("Document detected.");
        log(`${selectedImages.length} images ready for layout.`);
        log("Layout engine ready for next development stage.");

    } catch (error) {
        log(`ERROR preparing layout: ${error.message}`);
        console.error(error);
    }
}

// --------------------------------------------------
// UI Events
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

    const btnNewDocument =
        document.getElementById("btnNewDocument");

    const btnOpenFolder =
        document.getElementById("btnOpenFolder");

    const btnCreateLayout =
        document.getElementById("btnCreateLayout");


    if (btnNewDocument) {
        btnNewDocument.addEventListener(
            "click",
            createNewDocument
        );
    }


    if (btnOpenFolder) {
        btnOpenFolder.addEventListener(
            "click",
            openImagesFolder
        );
    }


    if (btnCreateLayout) {
        btnCreateLayout.addEventListener(
            "click",
            createLayout
        );
    }


    log("Eddie Tools Alpha – Milestone 2 initialized.");
});