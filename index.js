const playwright = require('playwright');
const fs = require('fs');
const readline = require('readline');

async function main() {

    // Get the URL to go to from the user
    const userUrl = await getUserInput('Please enter the URL: ');

    // We don't use persistent launch because if cookies are saved, the website instantly blocks us as a robot.
    const browser = await playwright.firefox.launch({
        headless: false, // Don't use headless mode, we need to pass the anti-robot test by hand
    });

    const page = await browser.newPage({
        extraHTTPHeaders: { // Headers to pass the anti-robot test (based on the headers of a real browser)
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'Sec-Fetch-Dest': 'document', 
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0',
        }
    });

    await page.goto(userUrl); // Go to the website, but redirect to the anti-robot test
    await page.waitForTimeout(5000); // Wait for the anti-robot test to load entirely

    await waitForSpecificUrl(page, userUrl); // Wait for the anti-robot test to be passed
    await smoothScrollToBottom(page); // Scroll to the bottom of the page to load all products
    const products = await getProducts(page); // Get all products from the page

    // Get the name of the category from the URL
    const myURL = new URL(userUrl);
    const pathSegments = myURL.pathname.split('/');
    const indexOfC = pathSegments.indexOf("c");

    let category = "";

    if (indexOfC !== -1 && pathSegments[indexOfC + 1]) {
        category = pathSegments[indexOfC + 1];
    } else {
        category = "dessertsetcompotes";
    }

    if (!fs.existsSync('json')){
        fs.mkdirSync('json');
    }

    fs.writeFileSync('json/' + category + '.json', JSON.stringify(products, null, 2), 'utf8'); // Write the products to a file

}

// Get all products from the page
async function getProducts(page) {

    // Scroll to the bottom of the page to load all products
    // await smoothScrollUntilElementVisible(page, '.no-more-products-text');

    return page.evaluate(() => {
        const products = [];
        const productElements = document.querySelectorAll('.liWCRS310_Product'); // Get all product elements 
        for (const productElement of productElements) {
            const nameElement = productElement.querySelector('p.pWCRS310_Desc a.aWCRS310_Product'); // Get the product name
            const priceElement = productElement.querySelector('div.divWCRS310_PrixUnitaire p.pWCRS310_PrixUnitairePartieEntiere'); // Get the product price
            const priceMinElement = productElement.querySelector('div.divWCRS310_PrixUnitaire p.pWCRS310_PrixUnitairePartieDecimale'); // Get the product price
            // Check if the product is in stock
            if (priceElement) {
                const product = {};
                product.name = nameElement.innerText; // Get the product name
                product.price = priceElement.innerText + priceMinElement.innerText + "€"; // Get the product price
                products.push(product); // Add the product to the list of products
            }
        }
        return products; // Return the list of products
    });
}

// Wait for a specific URL to be loaded
async function waitForSpecificUrl(page, desiredUrl, timeout = 30000) {
    const startTime = Date.now(); // Get the current time

    while (Date.now() - startTime < timeout) { // While the timeout is not reached
        if (page.url() === desiredUrl) { // If the current URL is the desired one
            return true;
        }
        await page.waitForTimeout(10000);  // Wait 10 seconds before checking again
    }

    throw new Error(`Timed out waiting for URL: ${desiredUrl}`); // Throw an error if the timeout is reached
}

// Get user input from the console to know the URL to go to
function getUserInput(prompt) {
    // Create a readline interface to get user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Return a promise that resolves when the user enters a value
    return new Promise((resolve) => {
        rl.question(prompt, (input) => {
            resolve(input);
            rl.close();
        });
    });
}

async function smoothScrollToBottom(page, increment = 900) {
    const waitTime = 50;  // Temps d'attente entre chaque incrémentation, en millisecondes

    let previousPosition = 0;
    let currentPosition = 0;

    while (true) {
        currentPosition = await page.evaluate((increment) => {
            window.scrollBy(0, increment);
            return window.scrollY;
        }, increment);

        if (currentPosition === previousPosition) break;  // Si la position n'a pas changé, nous avons atteint le bas.

        previousPosition = currentPosition;
        await page.waitForTimeout(waitTime);
    }
}

main();