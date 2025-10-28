const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

const MENU_URL = "https://www.ripleycsd.org/dining";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

// This is a reliable selector for the whole menu block
const MENU_CONTAINER_SELECTOR = '.district-menu-v-2-container';

async function updateLunchData() {
    console.log("Launching headless browser...");
    let lunchMenu = "Menu not found for today.";
    let displayDate = "";
    let browser = null;

    // Get today's date info
    const today = new Date();
    displayDate = today.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
    // We need these to find the right section
    const monthStr = today.toLocaleDateString('en-US', { month: 'short' }); // e.g., "Oct"
    const dayStr = today.toLocaleDateString('en-US', { day: 'numeric' });   // e.g., "24"

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();

        console.log(`Navigating to ${MENU_URL}...`);
        await page.goto(MENU_URL);

        // 1. Wait for the main menu container to exist
        console.log(`Waiting for selector: ${MENU_CONTAINER_SELECTOR}`);
        await page.waitForSelector(MENU_CONTAINER_SELECTOR, { timeout: 15000 });
        console.log("Menu container loaded!");

        // 2. Run JavaScript inside the loaded page to find the menu
        const menuText = await page.evaluate((month, day) => {
            // Find all the "day" blocks on the page
            const dayBlocks = document.querySelectorAll('.district-menu-v-2-menu-day');
            
            for (const block of dayBlocks) {
                // Find the date header for this block
                const dateTitle = block.querySelector('h2.district-menu-v-2-menu-day-title');
                
                // Check if the date header exists and matches today
                if (dateTitle && dateTitle.innerText.includes(month) && dateTitle.innerText.includes(day)) {
                    // This is today's block! Now find the "Lunch" category
                    const categoryBlocks = block.querySelectorAll('.district-menu-v-2-category');
                    
                    for (const cat of categoryBlocks) {
                        const catTitle = cat.querySelector('h3.district-menu-v-2-category-title');
                        
                        // Check if this category is "Lunch"
                        if (catTitle && catTitle.innerText.trim().toLowerCase() === 'lunch') {
                            // This is the "Lunch" block! Get the first menu item
                            const menuItem = cat.querySelector('.district-menu-item-name');
                            if (menuItem) {
                                return menuItem.innerText.trim(); // Success!
                            }
                        }
                    }
                }
            }
            return null; // No match found
        }, monthStr, dayStr); // Pass our date strings into the function

        // 3. Check the result
        if (menuText) {
            lunchMenu = menuText.replace(/&amp;/g, '&'); // Clean up text
            console.log(`Found menu: ${lunchMenu}`);
        } else {
            console.log("Scrape complete, but no matching menu item was found.");
        }

    } catch (error) {
        console.error("Error during puppeteer scrape:", error.message);
        lunchMenu = "Error: Could not scrape the menu page.";
    } finally {
        if (browser) {
            await browser.close();
            console.log("Browser closed.");
        }
    }

    // Write the result to the JSON file
    const data = {
        date: displayDate,
        menu: lunchMenu,
        lastUpdated: new Date().toISOString()
    };

    try {
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
        console.log(`Success! ${OUTPUT_FILE} has been created.`);
    } catch (err) {
        console.error("Error writing file:", err);
    }
}

updateLunchData();
