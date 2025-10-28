const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const API_URL = "https://api.apptegy.net/sites/1155/district_menus";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

// --- THIS IS THE CRITICAL FIX ---
// Gets the current date formatted as YYYY-MM-DD for the
// "America/New_York" timezone, regardless of where the server is.
function getApiDate() {
    const today = new Date();
    // Options to get parts of the date in the correct timezone
    const options = {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    
    // Format the date (e.g., "10/28/2025")
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(today);
    
    // Reassemble into YYYY-MM-DD
    const dateParts = {};
    parts.forEach(p => dateParts[p.type] = p.value);
    
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}
// --- END FIX ---

async function updateLunchData() {
    console.log("Fetching menu from API...");
    let lunchMenu = "Menu not found for today."; // Default message
    
    // Get the display date (also in the correct timezone)
    const displayDate = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
    
    const apiDate = getApiDate();
    console.log(`Requesting menu for date: ${apiDate} (New York Time)`);

    try {
        // 1. Call the API with the correct date and headers
        const response = await axios.get(API_URL, {
            params: {
                date: apiDate,
                end_date: apiDate
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.82 Safari/537.36',
                'Referer': 'https://www.ripleycsd.org/'
            }
        });

        // 2. Parse the JSON response
        const menus = response.data.data.district_menus;

        if (menus && menus.length > 0) {
            const allItems = menus[0].menu_day_items;
            const lunchItem = allItems.find(item => item.category === "Lunch");

            if (lunchItem && lunchItem.name) {
                lunchMenu = lunchItem.name.trim();
                console.log(`Found menu: ${lunchMenu}`);
            } else {
                console.log("API returned data, but no 'Lunch' category was found.");
                lunchMenu = "Lunch not posted for today.";
            }
        } else {
            console.log("No menu data returned from API for this date.");
        }
    } catch (error) {
        console.error("Error fetching from API:", error.message);
        lunchMenu = "Error: Could not contact school menu API.";
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
