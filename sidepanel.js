
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
 * @param {Array<string>} groupedData.retailers - Sorted list of retailer names.
 * @param {Object} groupedData.itemsByCategory - Items grouped by category and product ID.
 * @param {string} containerId - The ID of the HTML element to render the tables into.
 */
function displayItemsInTables({ retailers, itemsByCategory }, containerId) {
    const container = document.getElementById(containerId);
    const categoryNavContainer = document.getElementById('category-list');

    if (!container || !categoryNavContainer) {
        console.error('Container or category nav container not found.');
        if (container) container.innerHTML = '<p>An error occurred while displaying items.</p>';
        return;
    }


    // Calculate max price difference for each category to sort them
    const categoriesWithMaxDiff = Object.keys(itemsByCategory).map(category => {
        const items = Object.values(itemsByCategory[category]);
        let maxDiff = 0;
        items.forEach(itemData => {
            const prices = Object.values(itemData.prices)
                .map(p => parsePrice(p.priceString))
                .filter(p => !isNaN(p));
            if (prices.length > 1) {
                const diff = Math.max(...prices) - Math.min(...prices);
                if (diff > maxDiff) {
                    maxDiff = diff;
                }
            }
        });
        return { name: category, maxDiff };
    });

    // Sort categories by the largest max difference first
    categoriesWithMaxDiff.sort((a, b) => b.maxDiff - a.maxDiff);
    const sortedCategories = categoriesWithMaxDiff.map(c => c.name);

    // Get categories sorted alphabetically for the navigation
    const sortedCategoriesForNav = Object.keys(itemsByCategory).sort((a, b) => a.localeCompare(b));

    if (sortedCategories.length === 0) {
        container.innerHTML = '<p>No items found to display.</p>';
        categoryNavContainer.innerHTML = ''; // Clear nav as well
        return;
    }

    // Populate the category navigation
    let navHtml = '';
    const anchorIdFromCategory = (category) => `category-${category.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

    sortedCategoriesForNav.forEach(category => {
        const anchorId = anchorIdFromCategory(category);
        navHtml += `<li><a href="#${anchorId}">${category}</a></li>`;
    });
    categoryNavContainer.innerHTML = navHtml;

    let html = '';

    // Generate HTML for each category.
    sortedCategories.forEach(category => {
        const anchorId = anchorIdFromCategory(category);
        html += `<h2 id="${anchorId}">${category}</h2>`;
        html += '<table class="item-table">';

        // Table Header
        html += '<thead><tr>';
        html += '<th>Item</th>';
        retailers.forEach(retailer => {
            html += `<th>${retailer}</th>`;
        });
        html += '</tr></thead>';

        // Table Body
        html += '<tbody>';
        const items = Object.values(itemsByCategory[category]);

        // 1. Calculate price difference and find lowest price for each item
        items.forEach(itemData => {
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

        // 2. Sort items by largest price difference first, then alphabetically
        items.sort((a, b) => {
            if (b.priceDifference !== a.priceDifference) {
                return b.priceDifference - a.priceDifference;
            }
            return a.itemName.localeCompare(b.itemName);
        });

        items.forEach(itemData => {
            html += '<tr>';

            // Item cell (Name and Image)
            html += '<td class="item-cell">';
            if (itemData.itemImage && itemData.itemImage.url) {
                html += `<img src="${itemData.itemImage.url}" alt="${itemData.itemName}" class="item-image">`;
            }
            html += `<span>${itemData.itemName}</span>`;
            html += '</td>';

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
                html += `<td${cellClass}>${priceHtml}</td>`;
            });

            html += '</tr>';
        });

        html += '</tbody></table>';
    });

    container.innerHTML = html;

    // Add click listeners for smooth scrolling in the category navigation
    document.querySelectorAll('#category-nav a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in side panel:", request);

    if (request.itemsByCategory) {
        displayItemsInTables(request, 'content');
    } else {
        const contentDiv = document.getElementById('content');
        contentDiv.textContent = "No shop items data received.";
    }
});


console.log('instacart extension: sidepanel.js loaded')