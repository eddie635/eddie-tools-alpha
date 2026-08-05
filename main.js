const { storage } = require("uxp");
const { app } = require("indesign");

const fs = storage.localFileSystem;

// ============================================================
// Eddie Tools Alpha
// Milestone 4.1 – Smart Layout Engine
// Adobe InDesign 2026
//
// FIXES:
// 1. Every image receives a frame.
// 2. 4-image groups always use a 4-frame template.
// 3. Template/frame count is validated before placement.
// 4. Better orientation-aware template selection.
// 5. Keeps all working Milestone 4 Adobe integration.
// ============================================================

let selectedFolder = null;
let selectedImages = [];


// ============================================================
// CONSOLE
// ============================================================

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


// ============================================================
// ACTIVE DOCUMENT
// ============================================================

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


// ============================================================
// NEW DOCUMENT
// ============================================================

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


// ============================================================
// IMAGE FILE CHECK
// ============================================================

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


// ============================================================
// IMAGE ORIENTATION FROM FILE NAME
//
// Current image filenames contain dimensions such as:
//
// 1080 x 566
// 608 x 1080
// 1080 x 1080
//
// We use these dimensions to classify the image.
// ============================================================

function getImageOrientationFromName(name) {

    const match = name.match(
        /(\d+)\s*[x×]\s*(\d+)/i
    );

    if (!match) {
        return {
            orientation: "unknown",
            width: 1,
            height: 1,
            ratio: 1
        };
    }

    const width = Number(match[1]);
    const height = Number(match[2]);

    const ratio = width / height;

    let orientation;

    if (ratio > 1.15) {
        orientation = "landscape";

    } else if (ratio < 0.87) {
        orientation = "portrait";

    } else {
        orientation = "square";
    }

    return {
        orientation,
        width,
        height,
        ratio
    };
}


// ============================================================
// OPEN IMAGES FOLDER
// ============================================================

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

        const files = entries
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

        selectedImages = files.map(file => {

            const info =
                getImageOrientationFromName(file.name);

            return {
                entry: file,
                name: file.name,
                orientation: info.orientation,
                width: info.width,
                height: info.height,
                ratio: info.ratio
            };
        });

        log(`${selectedImages.length} image(s) found.`);

        if (selectedImages.length === 0) {
            log("No supported image files found.");
            return;
        }

        let landscapeCount = 0;
        let portraitCount = 0;
        let squareCount = 0;
        let unknownCount = 0;

        selectedImages.forEach((image, index) => {

            if (image.orientation === "landscape") {
                landscapeCount++;

            } else if (image.orientation === "portrait") {
                portraitCount++;

            } else if (image.orientation === "square") {
                squareCount++;

            } else {
                unknownCount++;
            }

            log(
                `${index + 1}. ${image.name} ` +
                `[${image.orientation}]`
            );
        });

        log(
            `Analysis: ${landscapeCount} landscape, ` +
            `${portraitCount} portrait, ` +
            `${squareCount} square, ` +
            `${unknownCount} unknown.`
        );

        const doc = getActiveDocument();

        if (doc) {
            log("Document detected.");
        } else {
            log("No document currently open.");
        }

        log(
            `${selectedImages.length} images ready ` +
            `for smart layout.`
        );

    } catch (error) {

        log(`FOLDER ERROR: ${error.message}`);
        console.error(error);
    }
}


// ============================================================
// PAGE GEOMETRY
// ============================================================

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


// ============================================================
// FRAME CREATION
// ============================================================

function createImageFrame(page, bounds) {

    const frame = page.rectangles.add();

    frame.geometricBounds = bounds;

    return frame;
}


// ============================================================
// PLACE IMAGE
// ============================================================

async function placeImageInFrame(frame, image) {

    try {

        const nativePath =
            await fs.getNativePath(image.entry);

        frame.place(nativePath);

        try {
            frame.fit(1668247152);
        } catch (error) {
            console.log(
                "Automatic fit skipped:",
                error
            );
        }

        return true;

    } catch (error) {

        log(
            `PLACE ERROR (${image.name}): ` +
            error.message
        );

        console.error(error);

        try {
            frame.remove();
        } catch (_) {
            // Ignore cleanup errors.
        }

        return false;
    }
}


// ============================================================
// TEMPLATE 1 – SINGLE HERO
// ============================================================

function templateSingle(area) {

    return [
        [
            area.top,
            area.left,
            area.bottom,
            area.right
        ]
    ];
}


// ============================================================
// TEMPLATE 2 – TWO COLUMNS
//
// ┌───────────┬───────────┐
// │           │           │
// │ IMAGE 1   │ IMAGE 2   │
// │           │           │
// └───────────┴───────────┘
// ============================================================

function templateTwoColumns(area, gap) {

    const width =
        (area.width - gap) / 2;

    return [

        [
            area.top,
            area.left,
            area.bottom,
            area.left + width
        ],

        [
            area.top,
            area.left + width + gap,
            area.bottom,
            area.right
        ]

    ];
}


// ============================================================
// TEMPLATE 3 – TWO ROWS
//
// ┌───────────────────────┐
// │       IMAGE 1         │
// ├───────────────────────┤
// │       IMAGE 2         │
// └───────────────────────┘
// ============================================================

function templateTwoRows(area, gap) {

    const height =
        (area.height - gap) / 2;

    return [

        [
            area.top,
            area.left,
            area.top + height,
            area.right
        ],

        [
            area.top + height + gap,
            area.left,
            area.bottom,
            area.right
        ]

    ];
}


// ============================================================
// TEMPLATE 4 – LARGE LEFT
//
// ┌──────────────┬─────────────┐
// │              │   IMAGE 2   │
// │   IMAGE 1    ├─────────────┤
// │              │   IMAGE 3   │
// └──────────────┴─────────────┘
// ============================================================

function templateLargeLeft(area, gap) {

    const leftWidth =
        area.width * 0.58;

    const rightHeight =
        (area.height - gap) / 2;

    return [

        [
            area.top,
            area.left,
            area.bottom,
            area.left + leftWidth
        ],

        [
            area.top,
            area.left + leftWidth + gap,
            area.top + rightHeight,
            area.right
        ],

        [
            area.top + rightHeight + gap,
            area.left + leftWidth + gap,
            area.bottom,
            area.right
        ]

    ];
}


// ============================================================
// TEMPLATE 5 – LARGE RIGHT
//
// ┌─────────────┬──────────────┐
// │   IMAGE 2   │              │
// ├─────────────┤   IMAGE 1    │
// │   IMAGE 3   │              │
// └─────────────┴──────────────┘
// ============================================================

function templateLargeRight(area, gap) {

    const rightWidth =
        area.width * 0.58;

    const leftWidth =
        area.width -
        rightWidth -
        gap;

    const leftHeight =
        (area.height - gap) / 2;

    return [

        [
            area.top,
            area.left + leftWidth + gap,
            area.bottom,
            area.right
        ],

        [
            area.top,
            area.left,
            area.top + leftHeight,
            area.left + leftWidth
        ],

        [
            area.top + leftHeight + gap,
            area.left,
            area.bottom,
            area.left + leftWidth
        ]

    ];
}


// ============================================================
// TEMPLATE 6 – HERO TOP
//
// ┌───────────────────────┐
// │        IMAGE 1        │
// ├───────────┬───────────┤
// │ IMAGE 2   │ IMAGE 3   │
// └───────────┴───────────┘
//
// IMPORTANT:
// This template is ONLY for 3 images.
// ============================================================

function templateHeroTop(area, gap) {

    const topHeight =
        area.height * 0.56;

    const halfWidth =
        (area.width - gap) / 2;

    return [

        [
            area.top,
            area.left,
            area.top + topHeight,
            area.right
        ],

        [
            area.top + topHeight + gap,
            area.left,
            area.bottom,
            area.left + halfWidth
        ],

        [
            area.top + topHeight + gap,
            area.left + halfWidth + gap,
            area.bottom,
            area.right
        ]

    ];
}


// ============================================================
// TEMPLATE 7 – HERO BOTTOM
//
// ┌───────────┬───────────┐
// │ IMAGE 2   │ IMAGE 3   │
// ├───────────┴───────────┤
// │        IMAGE 1        │
// └───────────────────────┘
// ============================================================

function templateHeroBottom(area, gap) {

    const bottomHeight =
        area.height * 0.56;

    const topHeight =
        area.height -
        bottomHeight -
        gap;

    const halfWidth =
        (area.width - gap) / 2;

    return [

        [
            area.top + topHeight + gap,
            area.left,
            area.bottom,
            area.right
        ],

        [
            area.top,
            area.left,
            area.top + topHeight,
            area.left + halfWidth
        ],

        [
            area.top,
            area.left + halfWidth + gap,
            area.top + topHeight,
            area.right
        ]

    ];
}


// ============================================================
// TEMPLATE 8 – FOUR GRID
//
// ┌───────────┬───────────┐
// │ IMAGE 1   │ IMAGE 2   │
// ├───────────┼───────────┤
// │ IMAGE 3   │ IMAGE 4   │
// └───────────┴───────────┘
//
// ALWAYS RETURNS FOUR FRAMES.
// ============================================================

function templateFourGrid(area, gap) {

    const width =
        (area.width - gap) / 2;

    const height =
        (area.height - gap) / 2;

    return [

        [
            area.top,
            area.left,
            area.top + height,
            area.left + width
        ],

        [
            area.top,
            area.left + width + gap,
            area.top + height,
            area.right
        ],

        [
            area.top + height + gap,
            area.left,
            area.bottom,
            area.left + width
        ],

        [
            area.top + height + gap,
            area.left + width + gap,
            area.bottom,
            area.right
        ]

    ];
}


// ============================================================
// TEMPLATE 9 – FOUR WITH TOP HERO
//
// Exactly FOUR frames.
//
// ┌───────────────────────┐
// │        IMAGE 1        │
// ├───────┬───────┬───────┤
// │ IMG 2 │ IMG 3 │ IMG 4 │
// └───────┴───────┴───────┘
// ============================================================

function templateFourHeroTop(area, gap) {

    const heroHeight =
        area.height * 0.52;

    const bottomTop =
        area.top + heroHeight + gap;

    const bottomHeight =
        area.bottom - bottomTop;

    const smallWidth =
        (area.width - gap * 2) / 3;

    return [

        [
            area.top,
            area.left,
            area.top + heroHeight,
            area.right
        ],

        [
            bottomTop,
            area.left,
            bottomTop + bottomHeight,
            area.left + smallWidth
        ],

        [
            bottomTop,
            area.left + smallWidth + gap,
            bottomTop + bottomHeight,
            area.left + smallWidth * 2 + gap
        ],

        [
            bottomTop,
            area.left + smallWidth * 2 + gap * 2,
            bottomTop + bottomHeight,
            area.right
        ]

    ];
}


// ============================================================
// IMAGE ANALYSIS HELPERS
// ============================================================

function countOrientations(images) {

    let landscape = 0;
    let portrait = 0;
    let square = 0;
    let unknown = 0;

    images.forEach(image => {

        if (image.orientation === "landscape") {
            landscape++;

        } else if (image.orientation === "portrait") {
            portrait++;

        } else if (image.orientation === "square") {
            square++;

        } else {
            unknown++;
        }
    });

    return {
        landscape,
        portrait,
        square,
        unknown
    };
}


// ============================================================
// FIND HERO IMAGE
//
// Prefer a landscape image for hero layouts.
// If none exists, use a square.
// Otherwise keep the first image.
// ============================================================

function orderImagesForTemplate(
    images,
    templateName
) {

    const ordered =
        images.slice();


    const heroTemplates = [
        "Hero Top",
        "Hero Bottom",
        "Four Hero Top",
        "Large Left",
        "Large Right"
    ];


    if (!heroTemplates.includes(templateName)) {
        return ordered;
    }


    let heroIndex =
        ordered.findIndex(
            image =>
                image.orientation === "landscape"
        );


    if (heroIndex === -1) {

        heroIndex =
            ordered.findIndex(
                image =>
                    image.orientation === "square"
            );
    }


    if (heroIndex > 0) {

        const hero =
            ordered.splice(
                heroIndex,
                1
            )[0];

        ordered.unshift(hero);
    }


    return ordered;
}


// ============================================================
// CHOOSE TEMPLATE
//
// IMPORTANT:
// Every template returned here MUST have exactly the same
// number of frames as the number of images.
// ============================================================

function chooseTemplate(
    images,
    area,
    gap,
    pageIndex
) {

    const count = images.length;

    const stats =
        countOrientations(images);


    // --------------------------------------------------------
    // 1 IMAGE
    // --------------------------------------------------------

    if (count === 1) {

        return {
            name: "Single Hero",
            bounds:
                templateSingle(area)
        };
    }


    // --------------------------------------------------------
    // 2 IMAGES
    // --------------------------------------------------------

    if (count === 2) {

        if (stats.landscape >= 1) {

            return {
                name: "Two Rows",
                bounds:
                    templateTwoRows(
                        area,
                        gap
                    )
            };
        }

        return {
            name: "Two Columns",
            bounds:
                templateTwoColumns(
                    area,
                    gap
                )
        };
    }


    // --------------------------------------------------------
    // 3 IMAGES
    // --------------------------------------------------------

    if (count === 3) {

        if (stats.landscape >= 1) {

            if (pageIndex % 2 === 0) {

                return {
                    name: "Hero Top",
                    bounds:
                        templateHeroTop(
                            area,
                            gap
                        )
                };

            } else {

                return {
                    name: "Hero Bottom",
                    bounds:
                        templateHeroBottom(
                            area,
                            gap
                        )
                };
            }
        }


        if (pageIndex % 2 === 0) {

            return {
                name: "Large Left",
                bounds:
                    templateLargeLeft(
                        area,
                        gap
                    )
            };

        } else {

            return {
                name: "Large Right",
                bounds:
                    templateLargeRight(
                        area,
                        gap
                    )
            };
        }
    }


    // --------------------------------------------------------
    // 4 IMAGES
    //
    // FIX:
    // Never use the old 3-frame Hero Top template here.
    // --------------------------------------------------------

    if (count === 4) {

        if (
            stats.landscape >= 1 &&
            pageIndex % 2 === 1
        ) {

            return {
                name: "Four Hero Top",
                bounds:
                    templateFourHeroTop(
                        area,
                        gap
                    )
            };
        }


        return {
            name: "Four Grid",
            bounds:
                templateFourGrid(
                    area,
                    gap
                )
        };
    }


    // --------------------------------------------------------
    // SAFETY FALLBACK
    // --------------------------------------------------------

    return {
        name: "Four Grid",
        bounds:
            templateFourGrid(
                area,
                gap
            )
    };
}


// ============================================================
// SMART GROUPING
//
// Prevents groups larger than four.
// Also avoids leaving a single image at the end whenever
// possible.
// ============================================================

function createSmartGroups(images) {

    const groups = [];

    let index = 0;


    while (index < images.length) {

        const remaining =
            images.length - index;

        let groupSize;


        if (remaining === 1) {

            groupSize = 1;

        } else if (remaining === 2) {

            groupSize = 2;

        } else if (remaining === 3) {

            groupSize = 3;

        } else if (remaining === 4) {

            groupSize = 4;

        } else if (remaining === 5) {

            // 3 + 2
            groupSize = 3;

        } else if (remaining === 6) {

            // 3 + 3
            groupSize = 3;

        } else if (remaining === 7) {

            // 4 + 3
            groupSize = 4;

        } else {

            // Continue with groups of four.
            groupSize = 4;
        }


        groups.push(
            images.slice(
                index,
                index + groupSize
            )
        );


        index += groupSize;
    }


    return groups;
}


// ============================================================
// CREATE SMART PAGE
// ============================================================

async function createSmartPage(
    page,
    images,
    pageIndex
) {

    const pageSize =
        getPageSize(page);


    // Keep the same proven Milestone 4 geometry.
    const margin = 36;
    const gap = 12;


    const area = {

        top:
            pageSize.top + margin,

        left:
            pageSize.left + margin,

        bottom:
            pageSize.bottom - margin,

        right:
            pageSize.right - margin,

        width:
            pageSize.width - margin * 2,

        height:
            pageSize.height - margin * 2
    };


    const template =
        chooseTemplate(
            images,
            area,
            gap,
            pageIndex
        );


    // ========================================================
    // CRITICAL 4.1 SAFETY CHECK
    // ========================================================

    if (
        !template ||
        !template.bounds
    ) {

        log(
            `LAYOUT ERROR: No template generated ` +
            `for page ${pageIndex + 1}.`
        );

        return 0;
    }


    if (
        template.bounds.length !==
        images.length
    ) {

        log(
            `LAYOUT ERROR: Template "${template.name}" ` +
            `contains ${template.bounds.length} frames ` +
            `but page requires ${images.length}.`
        );

        return 0;
    }


    log(
        `Page ${pageIndex + 1}: ` +
        `${template.name} ` +
        `(${images.length} images / ` +
        `${template.bounds.length} frames)`
    );


    // Reorder only within the page.
    // No images are removed.
    const orderedImages =
        orderImagesForTemplate(
            images,
            template.name
        );


    let placed = 0;


    for (
        let i = 0;
        i < orderedImages.length;
        i++
    ) {

        const bounds =
            template.bounds[i];


        const frame =
            createImageFrame(
                page,
                bounds
            );


        const success =
            await placeImageInFrame(
                frame,
                orderedImages[i]
            );


        if (success) {

            placed++;

            log(
                `Placed ${i + 1}/${orderedImages.length}: ` +
                `${orderedImages[i].name} ` +
                `[${orderedImages[i].orientation}]`
            );
        }
    }


    log(
        `Page ${pageIndex + 1} complete: ` +
        `${placed}/${images.length} placed.`
    );


    return placed;
}


// ============================================================
// CREATE SMART LAYOUT
// ============================================================

async function createLayout() {

    try {

        if (
            !selectedImages ||
            selectedImages.length === 0
        ) {

            log(
                "No images selected. " +
                "Use Open Images Folder first."
            );

            return;
        }


        let doc =
            getActiveDocument();


        if (!doc) {

            log(
                "No document detected. " +
                "Creating document..."
            );


            doc =
                await createNewDocument();


            if (!doc) {

                log(
                    "Unable to create document."
                );

                return;
            }
        }


        log("Document detected.");


        log(
            `Milestone 4.1 Smart Layout Engine ` +
            `analyzing ${selectedImages.length} images...`
        );


        const groups =
            createSmartGroups(
                selectedImages
            );


        log(
            `${groups.length} page composition(s) generated.`
        );


        // ----------------------------------------------------
        // Show grouping plan in console before placement.
        // ----------------------------------------------------

        groups.forEach(
            (group, index) => {

                const stats =
                    countOrientations(group);

                log(
                    `Group ${index + 1}: ` +
                    `${group.length} images — ` +
                    `${stats.landscape} landscape, ` +
                    `${stats.portrait} portrait, ` +
                    `${stats.square} square, ` +
                    `${stats.unknown} unknown.`
                );
            }
        );


        let totalPlaced = 0;


        for (
            let pageIndex = 0;
            pageIndex < groups.length;
            pageIndex++
        ) {

            let page;


            if (
                pageIndex <
                doc.pages.length
            ) {

                page =
                    doc.pages.item(
                        pageIndex
                    );

            } else {

                page =
                    doc.pages.add();
            }


            const group =
                groups[pageIndex];


            const placed =
                await createSmartPage(
                    page,
                    group,
                    pageIndex
                );


            totalPlaced += placed;
        }


        // ====================================================
        // FINAL VALIDATION
        // ====================================================

        if (
            totalPlaced ===
            selectedImages.length
        ) {

            log(
                `${totalPlaced} of ` +
                `${selectedImages.length} ` +
                `image(s) placed successfully.`
            );


            log(
                "Milestone 4.1 Smart Layout completed successfully."
            );

        } else {

            log(
                `WARNING: ${totalPlaced} of ` +
                `${selectedImages.length} ` +
                `image(s) placed.`
            );


            log(
                `Missing images: ` +
                `${selectedImages.length - totalPlaced}`
            );
        }


    } catch (error) {

        log(
            `SMART LAYOUT ERROR: ` +
            error.message
        );

        console.error(error);
    }
}


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const btnNewDocument =
            document.getElementById(
                "btnNewDocument"
            );


        const btnOpenFolder =
            document.getElementById(
                "btnOpenFolder"
            );


        const btnCreateLayout =
            document.getElementById(
                "btnCreateLayout"
            );


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
            "Milestone 4.1 Smart Layout Engine initialized."
        );
    }
);