const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const MENU_URL = "https://www.ripleycsd.org/dining";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

async function updateLunchData() {
    console.log(`Fetching menu from ${MENU_URL}...`);
    let lunchMenu = "Menu not found for today."; // Default message
    let displayDate = "";

    try {
        const response = await axios.get(MENU_URL);
        const pageText = response.data.replace(/&nbsp;/g, " ");

        const today = new Date();
        displayDate = today.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });

        // Use the flexible regex for the date
        const monthStr = today.toLocaleDateString('en-US', { month: 'short' });
        const dayStr = today.toLocaleDateString('en-US', { day: 'numeric' });
        const dateRegex = new RegExp(`${monthStr}[^\\w]${dayStr}`, "i");
        
        const dateMatch = pageText.match(dateRegex);

        if (dateMatch) {
            console.log("Found a match for today's date!");
            // Get all text *after* the date
            const textAfterDate = pageText.substring(dateMatch.index);

            // 1. Find the "Lunch" header (case-insensitive)
            const lunchHeaderRegex = /Lunch/i;
            const lunchHeaderMatch = textAfterDate.match(lunchHeaderRegex);

            if (lunchHeaderMatch) {
                console.log("Found 'Lunch' header.");
                // 2. Get all text *after* the word "Lunch"
                const textAfterLunch = textAfterDate.substring(lunchHeaderMatch.index + lunchHeaderMatch[0].length);

                // 3. Find the *first* meaningful line of text after "Lunch"
                // This regex skips whitespace and HTML tags to find the first piece of text
                const firstLineRegex = /^\s*(<[^>]+>)*\s*([^<>\n]+)/m;
                const menuMatch = textAfterLunch.match(firstLineRegex);

                if (menuMatch && menuMatch[2]) {
                    // menuMatch[2] is our captured text!
                    lunchMenu = menuMatch[2].trim();
                    console.log(`Found menu: ${lunchMenu}`);
                } else {
                    console.log("Found 'Lunch' but couldn't find menu items after it.");
                    lunchMenu = "Menu items not found after 'Lunch' header.";
                }
            } else {
                console.log("Found date, but no 'Lunch' header after it.");
                lunchMenu = "Lunch header not found for today.";
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
        date: displayDate,
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
