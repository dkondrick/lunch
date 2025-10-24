const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const MENU_URL = "https://www.ripleycsd.org/dining";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

async function updateLunchData() {
    console.log(`Fetching menu from ${MENU_URL}...`);
    let lunchMenu = "Menu not found for today."; // Default message if we fail
    let displayDate = "";

    try {
        const response = await axios.get(MENU_URL);
        const pageText = response.data.replace(/&nbsp;/g, " ");

        // --- NEW, MORE ROBUST DATE LOGIC ---
        const today = new Date();
        
        // Get the full date string just for display
        displayDate = today.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });

        // Get the parts for searching
        const monthStr = today.toLocaleDateString('en-US', { month: 'short' }); // e.g., "Oct"
        const dayStr = today.toLocaleDateString('en-US', { day: 'numeric' });   // e.g., "24"

        // Create a flexible regex to find "Oct" followed by "24"
        // This will match "Oct 24", "Oct. 24", "Oct    24", etc.
        const dateRegex = new RegExp(`${monthStr}[^\\w]${dayStr}`, "i");
        // --- END NEW LOGIC ---

        const dateMatch = pageText.match(dateRegex);

        if (dateMatch) {
            console.log("Found a match for today's date!");
            const textAfterDate = pageText.substring(dateMatch.index);
            const lunchRegex = /^\s*Lunch\s*(.*)/im;
            const lunchMatch = textAfterDate.match(lunchRegex);

            if (lunchMatch && lunchMatch[1]) {
                lunchMenu = lunchMatch[1].trim(); // Success!
                console.log(`Found menu: ${lunchMenu}`);
            } else {
                console.log("Found date, but no 'Lunch' line after it.");
                lunchMenu = "Lunch not posted for today.";
            }
        } else {
            console.log("Could not find today's date on the menu page.");
        }
    } catch (error) {
        console.error("Error fetching or parsing menu:", error.message);
        lunchMenu = "Error: Could not fetch menu from school website.";
    }

    // Create the JSON object to save
    const data = {
        date: displayDate, // We still show the full, pretty date
        menu: lunchMenu,
        lastUpdated: new Date().toISOString()
    };

    // Write the data to lunch.json
    try {
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
        console.log(`Success! ${OUTPUT_FILE} has been created.`);
    } catch (err) {
        console.error("Error writing file:", err);
    }
}

updateLunchData();
