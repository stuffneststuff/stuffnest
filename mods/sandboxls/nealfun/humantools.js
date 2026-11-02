// ==UserScript==
// @name         Sandboxels Ecosystem & Harvest Mod
// @version      1.0
// @description  Adds cows, sheep, cats, dogs, humans, shears, axes, harvest mechanics, and auto-save.
// ==/panel==

if (typeof elements !== "undefined") {
    
    // 1. Register New Mod Elements
    
    elements.cow = {
        color: "#94a3b8",
        type: "animal",
        behavior: behaviors.walker,
        category: "Animals",
        burn: "meat",
        fireColor: "#ef4444",
        state: "solid",
        density: 1200,
        temp: 20,
    };

    elements.sheep = {
        color: "#f8fafc",
        type: "animal",
        behavior: [
            "XX",
            "M2:M1:M1",
            "XX",
        ],
        category: "Animals",
        burn: "meat",
        state: "solid",
        density: 1100,
        temp: 20,
        tick: function(pixel) {
            // Wool regeneration logic
            if (pixel.wool === undefined) pixel.wool = true;
            if (!pixel.wool && Math.random() < 0.003) {
                pixel.wool = true;
                pixel.color = "#f8fafc";
            }
        }
    };

    elements.cat = {
        color: "#f97316",
        type: "animal",
        behavior: behaviors.walker,
        category: "Animals",
        state: "solid",
        density: 800,
        temp: 20,
    };

    elements.dog = {
        color: "#a16207",
        type: "animal",
        behavior: behaviors.walker,
        category: "Animals",
        state: "solid",
        density: 900,
        temp: 20,
    };

    elements.shears = {
        color: "#cbd5e1",
        type: "tool",
        category: "Tools",
        state: "solid",
        density: 2500,
    };

    elements.axe = {
        color: "#94a3b8",
        type: "tool",
        category: "Tools",
        state: "solid",
        density: 3000,
    };

    elements.human = {
        color: "#fbcfe8",
        type: "human",
        behavior: behaviors.walker,
        category: "Humans",
        state: "solid",
        density: 1000,
        temp: 20,
        tick: function(pixel) {
            if (!pixel.tool) pixel.tool = "none";

            // Scan adjacent coordinates for interaction
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    let nx = pixel.x + dx;
                    let ny = pixel.y + dy;
                    if (isEmpty(nx, ny, true)) continue;
                    
                    let neighbor = pixelMap[nx][ny];
                    if (!neighbor) continue;

                    // Pick up tools
                    if ((neighbor.element === "shears" || neighbor.element === "axe") && pixel.tool === "none") {
                        pixel.tool = neighbor.element;
                        changePixelType(neighbor, "empty");
                        break;
                    }

                    // Harvest Sheep Wool
                    if (pixel.tool === "shears" && neighbor.element === "sheep") {
                        if (neighbor.wool === undefined || neighbor.wool === true) {
                            neighbor.wool = false;
                            neighbor.color = "#64748b"; // Turn shorn grey
                        }
                    }

                    // Chop Wood
                    if (pixel.tool === "axe" && neighbor.element === "wood") {
                        changePixelType(neighbor, "empty");
                    }
                }
            }
        }
    };

    // 2. Auto-Save Integration to localStorage
    
    // Auto-save world state every 30 seconds if game save functions exist
    setInterval(() => {
        if (typeof worldToJSON === "function") {
            try {
                const worldData = worldToJSON();
                localStorage.setItem("sandboxels_autosave", worldData);
                console.log("[Sandboxels Mod] World auto-saved successfully.");
            } catch (e) {
                console.error("[Sandboxels Mod] Auto-save failed:", e);
            }
        }
    }, 30000);

    // Optional manual save hook command
    window.saveModWorld = function() {
        if (typeof worldToJSON === "function") {
            localStorage.setItem("sandboxels_autosave", worldToJSON());
            alert("World saved to browser storage!");
        }
    };

    console.log("Sandboxels Ecosystem & Harvest Mod loaded successfully!");
}
