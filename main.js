const { storage } = require("uxp");
const { app } = require("indesign");

const fs = storage.localFileSystem;

// ============================================================
// Eddie Tools Alpha
// Milestone 3 – Layout Engine
// Adobe InDesign 2026
// ============================================================


// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------

let selectedFolder = null;
let selectedImages = [];


// ------------------------------------------------------------
// CONSOLE
// ------------------------------------------------------------

function log(message) {
    const logElement = document.getElementById("log");

    const now = new Date();
    const time = now.toLocaleTimeString();

    const line = `[${time}] ${message}`;

    console.log(line);

    if (logElement) {
        logElement.textContent += `\n${line}`;
        logElement.scrollTop = logElement.scrollHeight;
    }
}


// ------------------------------------------------------------
// GET ACTIVE DOCUMENT
// ------------------------------------------------------------

function getActiveDocument() {
    try {
        if (!app.documents || app.documents.length === 0) {
            return null;
        }

        return app.activeDocument;
    } catch (error) {
        console.error(error);
        return null;
    }
}


// ------------------------------------------------------------
// NEW DOCUMENT
// ------------------------------------------------------------

async function createNewDocument() {
    try {
        log("Creating new InDesign document...");

        const doc = app.documents.add();

        log("New InDesign document created successfully.");

        return doc;

    } catch (error) {
        log(`ERROR creating document: ${error.message}`);
        console.error(error);
        return null;
    }
}


// ------------------------------------------------------------
// IMAGE FILE CHECK
// ------------------------------------------------------------

function isImageFile(entry) {
    if (!entry || !entry.isFile) {
        return false;
    }

    const name = entry.name.toLowerCase();

    return (
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".png") ||
        name.endsWith(".tif") ||
        name.endsWith(".tiff") ||
        name.endsWith(".psd")
    );
}


// ------------------------------------------------------------
// OPEN IMAGES FOLDER
// ------------------------------------------------------------

async function openImagesFolder() {
    try {
        log("Opening folder picker...");

        const folder = await fs.getFolder();

        if (!folder) {
            log("Folder selection cancelled.");
            return;
        }

        selectedFolder = folder;

        log(`Folder selected: ${folder.name}`);

        const entries = await folder.getEntries();

        selectedImages = entries
            .filter(isImageFile)
            .sort((a, b) =>
                a.name.localeCompare(
                    b.name,
                    undefined,
                    {
                        numeric: true,
                        sensitivity: "base"
                    }
                )
            );

        log(`${selectedImages.length} image(s) found.`);

        if (selectedImages.length === 0) {
            log("No supported image files found.");
            return;
        }

        selectedImages.forEach((image, index) => {
            log(`${index + 1}. ${image.name}`);
        });

        const doc = getActiveDocument();

        if (doc) {
            log("Document detected.");
        } else {
            log("No document currently open.");
        }

        log(`${selectedImages.length} images ready for layout.`);

    } catch (error) {
        log(`FOLDER ERROR: ${error.message}`);
        console.error(error);
    }
}


// ------------------------------------------------------------
// PAGE SIZE
// ------------------------------------------------------------

function getPageSize(page) {
    const bounds = page.bounds;

    const top = Number(bounds[0]);
    const left = Number(bounds[1]);
    const bottom = Number(bounds[2]);
    const right = Number(bounds[3]);

    return {
        top,
        left,
        bottom,
        right,
        width: right - left,
        height: bottom - top
    };
}


// ------------------------------------------------------------
// CALCULATE GRID
// ------------------------------------------------------------

function calculateGrid(imageCount) {
    if (imageCount <= 1) {
        return {
            rows: 1,
            columns: 1
        };
    }

    if (imageCount === 2) {
        return {
            rows: 1,
            columns: 2
        };
    }

    if (imageCount <= 4) {
        return {
            rows: 2,
            columns: 2
        };
    }

    if (imageCount <= 6) {
        return {
            rows: 2,
            columns: 3
        };
    }

    if (imageCount <= 9) {
        return {
            rows: 3,
            columns: 3
        };
    }

    return {
        rows: 4,
        columns: 3
    };
}


// ------------------------------------------------------------
// CREATE IMAGE FRAME
// ------------------------------------------------------------

function createImageFrame(page, bounds) {
    const frame = page.rectangles.add();

    frame.geometricBounds = bounds;

    return frame;
}


// ------------------------------------------------------------
// PLACE IMAGE
// ------------------------------------------------------------

async function placeImageInFrame(frame, imageEntry) {
    try {
        const nativePath = await fs.getNativePath(imageEntry);

        frame.place(nativePath);

        try {
            frame.fit(1668247152);
        } catch (fitError) {
            console.log("Automatic fit skipped:", fitError);
        }

        return true;

    } catch (error) {
        log(`PLACE ERROR (${imageEntry.name}): ${error.message}`);
        console.error(error);

        try {
            frame.remove();
        } catch (_) {
            // Ignore cleanup errors
        }

        return false;
    }
}


// ------------------------------------------------------------
// CREATE PAGE LAYOUT
// ------------------------------------------------------------

async function createPageLayout(page, images, startIndex) {
    const pageSize = getPageSize(page);

    const margin = 36;
    const gap = 12;

    const maxImagesPerPage = 12;

    const remainingImages = images.length - startIndex;

    const imageCount = Math.min(
        remainingImages,
        maxImagesPerPage
    );

    if (imageCount <= 0) {
        return 0;
    }

    const grid = calculateGrid(imageCount);

    const availableWidth =
        pageSize.width -
        (margin * 2) -
        (gap * (grid.columns - 1));

    const availableHeight =
        pageSize.height -
        (margin * 2) -
        (gap * (grid.rows - 1));

    const cellWidth =
        availableWidth / grid.columns;

    const cellHeight =
        availableHeight / grid.rows;

    let placedCount = 0;

    for (let i = 0; i < imageCount; i++) {

        const imageIndex = startIndex + i;

        const row =
            Math.floor(i / grid.columns);

        const column =
            i % grid.columns;

        const top =
            pageSize.top +
            margin +
            row * (cellHeight + gap);

        const left =
            pageSize.left +
            margin +
            column * (cellWidth + gap);

        const bottom =
            top + cellHeight;

        const right =
            left + cellWidth;

        const frame = createImageFrame(
            page,
            [
                top,
                left,
                bottom,
                right
            ]
        );

        const success =
            await placeImageInFrame(
                frame,
                images[imageIndex]
            );

        if (success) {
            placedCount++;

            log(
                `Placed ${imageIndex + 1}/${images.length}: ` +
                images[imageIndex].name
            );
        }
    }

    return placedCount;
}


// ------------------------------------------------------------
// CREATE COMPLETE LAYOUT
// ------------------------------------------------------------

async function createLayout() {
    try {

        if (selectedImages.length === 0) {
            log(
                "No images selected. " +
                "Use Open Images Folder first."
            );
            return;
        }

        let doc = getActiveDocument();

        if (!doc) {
            log("No document detected. Creating document...");

            doc = await createNewDocument();

            if (!doc) {
                log("Unable to create document.");
                return;
            }
        }

        log("Document detected.");

        log(
            `${selectedImages.length} images ready for layout.`
        );

        const maxImagesPerPage = 12;

        let imageIndex = 0;
        let pageIndex = 0;
        let totalPlaced = 0;

        while (imageIndex < selectedImages.length) {

            let page;

            if (pageIndex < doc.pages.length) {
                page = doc.pages.item(pageIndex);
            } else {
                page = doc.pages.add();
            }

            log(
                `Creating layout on page ${pageIndex + 1}...`
            );

            const placedOnPage =
                await createPageLayout(
                    page,
                    selectedImages,
                    imageIndex
                );

            totalPlaced += placedOnPage;

            imageIndex += Math.min(
                maxImagesPerPage,
                selectedImages.length - imageIndex
            );

            pageIndex++;
        }

        log(
            `${totalPlaced} of ${selectedImages.length} ` +
            `image(s) placed.`
        );

        log("Milestone 3 layout completed.");

    } catch (error) {
        log(`LAYOUT ERROR: ${error.message}`);
        console.error(error);
    }
}


// ------------------------------------------------------------
// INITIALIZE PANEL
// ------------------------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    () => {

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


        log(
            "Eddie Tools Alpha – " +
            "Milestone 3 Layout Engine initialized."
        );
    }
);