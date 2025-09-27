var RETAILER_SETTINGS_KEY = 'instacart_selected_retailers';
var ALL_RETAILERS_KEY = 'instacart_all_retailers';

/**
 * Saves the selected retailers to chrome.storage.sync.
 */
async function saveOptions() {
    const selectedRetailers = [];
    const checkboxes = document.querySelectorAll('#retailer-list-container input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selectedRetailers.push(checkbox.name);
    });

    await chrome.storage.sync.set({ [RETAILER_SETTINGS_KEY]: selectedRetailers });
    console.log('Retailer preferences saved:', selectedRetailers);
}

/**
 * Renders the list of retailers as checkboxes in the options page.
 * @param {Array<string>} allRetailers - A list of all available retailer names.
 * @param {Array<string>} savedRetailers - A list of previously saved retailer names.
 */
function renderRetailerList(allRetailers, savedRetailers) {
    const container = document.getElementById('retailer-list-container');
    const loadingMessage = document.getElementById('loading-message');

    if (!allRetailers || allRetailers.length === 0) {
        loadingMessage.textContent = 'Could not find any retailers. Please ensure you have an Instacart.com tab open and refresh this page.';
        return;
    }

    loadingMessage.style.display = 'none';
    container.innerHTML = ''; // Clear previous content

    allRetailers.sort().forEach(retailerName => {
        const isChecked = savedRetailers.includes(retailerName);
        const optionDiv = document.createElement('div');
        optionDiv.className = 'retailer-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `retailer-${retailerName.replace(/\s+/g, '-')}`;
        checkbox.name = retailerName;
        checkbox.checked = isChecked;
        checkbox.addEventListener('change', saveOptions);

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = retailerName;

        label.prepend(checkbox);
        optionDiv.appendChild(label);
        container.appendChild(optionDiv);
    });
}

/**
 * Initializes the options page by fetching retailer data and rendering the list.
 */
async function initialize() {
    // Fetch all available retailers from local storage and saved preferences from sync storage.
    // This is done in parallel for efficiency.
    const [localData, syncData] = await Promise.all([
        chrome.storage.local.get(ALL_RETAILERS_KEY),
        chrome.storage.sync.get(RETAILER_SETTINGS_KEY)
    ]);

    let allRetailers = localData[ALL_RETAILERS_KEY] || [];
    const savedRetailers = syncData[RETAILER_SETTINGS_KEY] || [];

    if (allRetailers.length > 0) {
        renderRetailerList(allRetailers, savedRetailers);
    } else {
        // Fallback: if not in local storage, try to get it from an active Instacart tab
        const [tab] = await chrome.tabs.query({ active: true, url: "*://*.instacart.com/*" });
        if (tab) {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['get_retailers.js']
            });
            if (result && result.result) {
                allRetailers = result.result;
                // Also save it for next time
                await chrome.storage.local.set({ [ALL_RETAILERS_KEY]: allRetailers });
                renderRetailerList(allRetailers, savedRetailers);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', initialize);