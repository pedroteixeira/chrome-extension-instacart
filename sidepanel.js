
(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['instacart.js']
        });

    } catch (erri) {
        console.error(`failed to execute script: ${erri}`);
    }
})();

/**
 * Parses a price string (e.g., "$9.39") into a number.
 * @param {string} priceString The price string to parse.
 * @returns {number} The parsed price as a number, or NaN if invalid.
 */
function parsePrice(priceString) {
    if (typeof priceString !== 'string') return NaN;
    return parseFloat(priceString.replace('$', ''));
}


/**
 * Renders items grouped by category into tables, with retailers as columns.
 * @param {Object} groupedData - The pre-grouped data from the content script.
 * @param {Array<string>} retailers - Sorted list of retailer names.
 * @param {Object} itemsByCategory - Items grouped by category and product ID.
 * @param {Array<Object>} shopItems - The raw items from each shop.
 * @param {string} containerId - The ID of the HTML element to render the tables into.
 */
function displayItemsInTables({ retailers, itemsByCategory, shopItems }, containerId) {
    const container = document.getElementById(containerId);
    const categoryNavContainer = document.getElementById('category-nav');

    if (!container || !categoryNavContainer) {
        console.error('Container or category nav container not found.');
        if (container) container.innerHTML = '<p>An error occurred while displaying items.</p>';
        return;
    }

    // 1. Pre-calculate price differences and lowest prices for all items
    Object.values(itemsByCategory).forEach(categoryItems => {
        Object.values(categoryItems).forEach(itemData => {
            const prices = Object.values(itemData.prices)
                .map(p => parsePrice(p.priceString))
                .filter(p => !isNaN(p));

            if (prices.length > 1) {
                const maxPrice = Math.max(...prices);
                const minPrice = Math.min(...prices);
                itemData.priceDifference = maxPrice - minPrice;
                itemData.lowestPrice = minPrice;
            } else {
                itemData.priceDifference = 0;
                itemData.lowestPrice = prices.length > 0 ? prices[0] : Infinity;
            }
        });
    });

    // 2. Initialize global stats objects
    const retailerTotalItems = {};
    const retailerCheapestCategories = {}; // New: count of categories where retailer is cheapest
    retailers.forEach(retailer => {
        const shop = shopItems.find(s => s.retailer === retailer);
        retailerTotalItems[retailer] = shop ? shop.items.length : 0;
        retailerCheapestCategories[retailer] = 0;
    });

    // 3. Determine the "cheapest" retailer for each category
    Object.keys(itemsByCategory).forEach(category => {
        const categoryItems = Object.values(itemsByCategory[category]);
        const cheapestItemsPerRetailer = {};
        retailers.forEach(r => cheapestItemsPerRetailer[r] = 0);

        // Count uniquely cheapest items for each retailer in this category
        categoryItems.forEach(itemData => {
            if (itemData.priceDifference > 0) {
                const cheapestRetailers = [];
                retailers.forEach(retailer => {
                    if (itemData.prices[retailer]) {
                        const currentPrice = parsePrice(itemData.prices[retailer].priceString);
                        if (!isNaN(currentPrice) && currentPrice === itemData.lowestPrice) {
                            cheapestRetailers.push(retailer);
                        }
                    }
                });
                if (cheapestRetailers.length === 1) {
                    cheapestItemsPerRetailer[cheapestRetailers[0]]++;
                }
            }
        });

        // Find the winner(s) for the category
        let maxCheapest = 0;
        for (const retailer in cheapestItemsPerRetailer) {
            if (cheapestItemsPerRetailer[retailer] > maxCheapest) {
                maxCheapest = cheapestItemsPerRetailer[retailer];
            }
        }

        if (maxCheapest > 0) {
            const winners = [];
            for (const retailer in cheapestItemsPerRetailer) {
                if (cheapestItemsPerRetailer[retailer] === maxCheapest) {
                    winners.push(retailer);
                }
            }
            // If there's a single winner, credit them for the category
            if (winners.length === 1) {
                retailerCheapestCategories[winners[0]]++;
            }
        }
    });

    // Sort categories alphabetically for a consistent order in navigation and tables.
    // While sorting by price difference might seem useful, a predictable alphabetical
    // order provides a better user experience for navigation. The items *within* each
    // table are already sorted by price difference.
    const sortedCategories = Object.keys(itemsByCategory).sort((a, b) => a.localeCompare(b));

    if (sortedCategories.length === 0) {
        container.innerHTML = '<p>No items found to display.</p>';
        categoryNavContainer.innerHTML = ''; // Clear nav as well
        return;
    }

    // 4. Build the HTML for the global stats table
    let globalStatsHtml = '<h2>Overall Stats</h2>';
    globalStatsHtml += '<table class="item-table global-stats-table"><thead><tr>';
    retailers.forEach(retailer => {
        globalStatsHtml += `<th>${retailer}</th>`;
    });
    globalStatsHtml += '</tr></thead><tbody><tr>';
    retailers.forEach(retailer => {
        const totalItems = retailerTotalItems[retailer];
        const cheapestCats = retailerCheapestCategories[retailer];
        globalStatsHtml += `<td>Total Items: ${totalItems}<br>Cheapest Categories: ${cheapestCats}</td>`;
    });
    globalStatsHtml += '</tr></tbody></table>';

    // 5. Populate the category navigation
    let navHtml = '<ul id="category-list">';
    // This function now removes special characters to prevent potential ID collisions
    // (e.g., "A & B" and "A @ B" creating the same ID).
    const anchorIdFromCategory = (category) => `category-${category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

    // Use the single sorted list for the navigation.
    sortedCategories.forEach(category => {
        const anchorId = anchorIdFromCategory(category);
        navHtml += `<li><a href="#${anchorId}">${category}</a></li>`;
    });
    categoryNavContainer.innerHTML = navHtml + '</ul>';

    let categoryTablesHtml = '';

    // Generate HTML for each category.
    sortedCategories.forEach(category => {
        const anchorId = anchorIdFromCategory(category);
        categoryTablesHtml += `<h2 id="${anchorId}">${category}</h2>`;
        categoryTablesHtml += '<table class="item-table">';

        // Table Header
        categoryTablesHtml += '<thead><tr>';
        categoryTablesHtml += '<th>Item</th>';
        retailers.forEach(retailer => {
            categoryTablesHtml += `<th>${retailer}</th>`;
        });
        categoryTablesHtml += '</tr></thead>';

        // Table Body
        categoryTablesHtml += '<tbody>';
        const items = Object.values(itemsByCategory[category]);

        // Sort items by largest price difference first, then alphabetically
        items.sort((a, b) => {
            if (b.priceDifference !== a.priceDifference) {
                return b.priceDifference - a.priceDifference;
            }
            return a.itemName.localeCompare(b.itemName);
        });

        items.forEach(itemData => {
            categoryTablesHtml += '<tr>';

            // Item cell (Name and Image)
            categoryTablesHtml += '<td class="item-cell">';
            if (itemData.itemImage && itemData.itemImage.url) {
                categoryTablesHtml += `<img src="${itemData.itemImage.url}" alt="${itemData.itemName}" class="item-image">`;
            }
            categoryTablesHtml += `<span>${itemData.itemName}</span>`;
            categoryTablesHtml += '</td>';

            // Retailer price cells
            retailers.forEach(retailer => {
                let cellClass = '';
                let priceHtml = '';

                if (itemData.prices[retailer]) {
                    const priceInfo = itemData.prices[retailer];
                    const currentPrice = parsePrice(priceInfo.priceString);

                    priceHtml += `${priceInfo.priceString || 'N/A'}`;
                    if (priceInfo.pricingUnitString) {
                        priceHtml += `<br><small>${priceInfo.pricingUnitString}</small>`;
                    }

                    // Highlight if it's the lowest price and there was more than one price to compare
                    if (itemData.priceDifference > 0 && !isNaN(currentPrice) && currentPrice === itemData.lowestPrice) {
                        cellClass = ' class="lowest-price"';
                    }
                }
                categoryTablesHtml += `<td${cellClass}>${priceHtml}</td>`;
            });

            categoryTablesHtml += '</tr>';
        });

        categoryTablesHtml += '</tbody></table>';
    });

    container.innerHTML = globalStatsHtml + categoryTablesHtml;

}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in side panel:", request);

    if (request.itemsByCategory && request.shopItems) {
        displayItemsInTables(request, 'content');
    } else {
        const contentDiv = document.getElementById('content');
        contentDiv.textContent = "No shop items data received.";
    }
});

/**
 * Filters the displayed item tables based on the search text.
 * It iterates through all item rows and hides those that don't match.
 * @param {string} searchText The text to filter by.
 */
function filterItems(searchText) {
    const lowerCaseSearchText = searchText.toLowerCase().trim();
    // Select all category headers, which precede each item table.
    const categoryHeaders = document.querySelectorAll('h2[id^="category-"]');

    categoryHeaders.forEach(header => {
        const table = header.nextElementSibling;
        // Ensure we're working with the correct table.
        if (!table || !table.classList.contains('item-table')) {
            return;
        }

        const rows = table.querySelectorAll('tbody tr');
        let categoryHasVisibleItems = false;

        rows.forEach(row => {
            const itemNameElement = row.querySelector('.item-cell span');
            if (itemNameElement) {
                const itemName = itemNameElement.textContent.toLowerCase();
                if (itemName.includes(lowerCaseSearchText)) {
                    row.style.display = ''; // Show row
                    categoryHasVisibleItems = true;
                } else {
                    row.style.display = 'none'; // Hide row
                }
            }
        });

        // If no items are visible in the category, hide the header and the table.
        // Otherwise, make sure they are visible.
        const displayStyle = categoryHasVisibleItems ? '' : 'none';
        header.style.display = displayStyle;
        // Use 'table' for correct block-level display, 'none' to hide.
        table.style.display = categoryHasVisibleItems ? 'table' : 'none';
    });
}

// Add event listener for the search box
const searchBox = document.getElementById('search-box');
if (searchBox) {
    searchBox.addEventListener('input', (e) => filterItems(e.target.value));
}

/**
 * Sets up a single, delegated event listener for the category navigation.
 * This is more efficient and robust than re-attaching listeners on each render.
 * It handles clicks on category links and performs a smooth scroll to the
 * corresponding section, calculating the position manually for reliability.
 */
const categoryNavContainer = document.getElementById('category-list');
if (categoryNavContainer) { // This listener is on the <ul> now
    categoryNavContainer.addEventListener('click', function (e) {
        // Ensure the clicked element is a link within the navigation
        if (e.target && e.target.tagName === 'A') {
            e.preventDefault();
            const targetId = e.target.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            const scrollingContainer = document.getElementById('content-wrapper');

            if (targetElement && scrollingContainer) {
                // The `getBoundingClientRect` method can be unreliable for calculating
                // scroll positions within the side panel's unique viewport, especially
                // when scrolling upwards.
                // A more direct and robust method is to use `offsetTop`. This property
                // gives the exact distance of the target element from the top of its
                // parent, which is the value we need to scroll to.
                const y = targetElement.offsetTop;
                
                scrollingContainer.scrollTo({
                    top: y,
                    behavior: 'smooth'
                });
            }
        }
    });
}


console.log('instacart extension: sidepanel.js loaded')