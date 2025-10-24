const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// This is the new API endpoint
const API_URL = "https://api.apptegy.net/sites/1155/district_menus";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

// Helper function to get today's date in YYYY-MM-DD format
function getApiDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    // Month is 0-indexed, so add 1 and pad with '0'
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
        // 1. Call the API with today's date
        const response = await axios.get(API_URL, {
            params: {
                date: apiDate,
                end_date: apiDate
            }
        });

        // 2. Parse the JSON response
        const menus = response.data.data.district_menus;

        if (menus && menus.length > 0) {
            // Get all items for the first menu of the day
            const allItems = menus[0].menu_day_items;
            
            // 3. Find the item where the category is "Lunch"
            const lunchItem = allItems.find(item => item.category === "Lunch");

            if (lunchItem && lunchItem.name) {
                // 4. Success! We found the lunch menu.
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
