const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const API_URL = "https://api.apptegy.net/sites/1155/district_menus";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

// Helper function to get today's date in YYYY-MM-DD format
function getApiDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function updateLunchData() {
    console.log("Fetching menu from API...");
    let lunchMenu = "Menu not found for today."; // Default message
    
    const today = new Date();
    const displayDate = today.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
    const apiDate = getApiDate();

    try {
        // 1. Call the API with today's date and a User-Agent header
        const response = await axios.get(API_URL, {
            params: {
                date: apiDate,
                end_date: apiDate
            },
            // --- THIS IS THE NEW, IMPORTANT PART ---
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.82 Safari/537.36'
            }
            // --- END NEW PART ---
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
            console.log("No menu data returned from API for today.");
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
