const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

const MENU_URL = "https://www.ripleycsd.org/dining";
const OUTPUT_FILE = path.join(__dirname, 'lunch.json');

// --- THIS IS THE CHANGE ---
// We will wait for the date header (e.g., "Monday, Oct 20") to appear.
// This should always be present, even if there's no menu.
const DATE_HEADER_SELECTOR = '.district-menu-v-2-menu-day-v-28cb4ed5';
// --- END CHANGE ---

async function updateLunchData() {
    console.log("Launching headless browser...");
    let lunchMenu = "Menu not found for today.";
    let displayDate = "";
    let browser = null;

    try {
        // Launch the browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();

        // 1. Go to the dining page
        console.log(`Navigating to ${MENU_URL}...`);
        await page.goto(MENU_URL, { waitUntil: 'networkidle2' });

        // 2. Wait for the JavaScript to load the menu headers
        console.log(`Waiting for selector: ${DATE_HEADER_SELECTOR}`);
        // We now wait for the new, more reliable selector
        await page.waitForSelector(DATE_HEADER_SELECTOR, { timeout: 15000 });

        console.log("Menu page has loaded! Scraping page content...");
        // 3. Get the fully-loaded HTML
        const pageText = await page.content();
        
        // --- This is our scraping logic ---
        const today = new Date();
        displayDate = today.toLocaleString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });

        const monthStr = today.toLocaleDateString('en-US', { month: 'short' });
        const dayStr = today.toLocaleDateString('en-US', { day: 'numeric' });
        const dateRegex = new RegExp(`${monthStr}[^\\w]${dayStr}`, "i");
        
        const dateMatch = pageText.match(dateRegex);

        if (dateMatch) {
            console.log("Found today's date!");
            const textAfterDate = pageText.substring(dateMatch.index);

            // Find "Lunch" (case-insensitive)
            const lunchHeaderRegex = /Lunch/i;
            const lunchHeaderMatch = textAfterDate.match(lunchHeaderRegex);

            if (lunchHeaderMatch) {
                console.log("Found 'Lunch' header.");
                const textAfterLunch = textAfterDate.substring(lunchHeaderMatch.index + lunchHeaderMatch[0].length);

                // Find the *first* menu item name after "Lunch"
                const firstLineRegex = /<div[^>]*class="[^"]*district-menu-item-name[^"]*"[^>]*>([^<]+)<\/div>/im;
                const menuMatch = textAfterLunch.match(firstLineRegex);

                if (menuMatch && menuMatch[1]) {
                    lunchMenu = menuMatch[1].trim().replace(/&amp;/g, '&'); // Clean up &
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
        // --- End scraping logic ---

    } catch (error) {
        console.error("Error during puppeteer scrape:", error.message);
        lunchMenu = "Error: Could not scrape the menu page.";
    } finally {
        // Always close the browser
        if (browser) {
            await browser.close();
        }
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
