const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const MENU_URL = "https://www.ripleycsd.org/dining";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

async function updateLunchData() {
    console.log(`Fetching menu from ${MENU_URL}...`);
    let lunchMenu = "Menu not found for today.";
    let todayDateStr = "";

    try {
        const response = await axios.get(MENU_URL);
        const pageText = response.data.replace(/&nbsp;/g, " ");

        const today = new Date();
        const todayStr = today.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
        todayDateStr = todayStr;

        const dateRegex = new RegExp(todayStr, "i");
        const dateMatch = pageText.match(dateRegex);

        if (dateMatch) {
            const textAfterDate = pageText.substring(dateMatch.index);
            const lunchRegex = /^\s*Lunch\s*(.*)/im;
            const lunchMatch = textAfterDate.match(lunchRegex);

            if (lunchMatch && lunchMatch[1]) {
                lunchMenu = lunchMatch[1].trim();
            }
        }
    } catch (error) {
        console.error("Error fetching or parsing menu:", error.message);
        lunchMenu = "Error: Could not fetch menu from school website.";
    }

    // Create the JSON object to save
    const data = {
        date: todayDateStr,
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
