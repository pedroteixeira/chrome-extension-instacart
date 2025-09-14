console.log('instacart extension script injected!');

var apolloState = JSON.parse(decodeURIComponent(document.getElementById("node-apollo-state").textContent));

var buyItAgainPageViewId = 'a7f8235f-70ff-5fb5-8039-b5a03702307f';
var postalCode = "77077"; // Using the postal code from your prompt
var zoneId = "982"; // Using the zoneId from your prompt

var allShops = apolloState['Shop:f928c71'];


var myRetailersNames = new Set(['H-E-B', 'Kroger', 'Sprouts Farmers Market', 'ALDI']);
var searchServiceType = "delivery";
var searchingShops = [];

Object.keys(allShops).forEach(shopKey => {
    var shop = allShops[shopKey].shop;
    if (shop.serviceType === searchServiceType && myRetailersNames.has(shop.retailer.name)) {
        searchingShops.push(shop)
    }
});


console.log('searchingShops', searchingShops);

/**
 * Creates a delay for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clears cache entries from previous days to save space.
 * This function is designed to run once per day.
 */
async function clearOldCache() {
    const today = new Date().toISOString().split('T')[0];
    const lastCleanupKey = 'lastCacheCleanupDate';

    try {
        const result = await chrome.storage.local.get(lastCleanupKey);
        if (result[lastCleanupKey] === today) {
            // Already cleaned up today, no need to run again.
            return;
        }

        console.log('Running daily cache cleanup...');
        const allStorage = await chrome.storage.local.get(null);
        const keysToRemove = [];

        for (const key in allStorage) {
            // Target all known cache key prefixes
            if (key.startsWith('instacart-shop-items-') || key.startsWith('instacart-item-') || key.startsWith('instacart-shop-')) {
                const parts = key.split('-');
                const potentialDate = parts[parts.length - 1];

                // Check if the last part of the key is a date and it's not today's date
                if (/\d{4}-\d{2}-\d{2}/.test(potentialDate) && potentialDate !== today) {
                    keysToRemove.push(key);
                }
            }
        }

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log(`Cleared ${keysToRemove.length} old cache entries.`);
        }

        // Mark that we've cleaned up for today
        await chrome.storage.local.set({ [lastCleanupKey]: today });
    } catch (error) {
        console.error('Error during cache cleanup:', error);
    }
}

/**
 * Fetches details for a given list of item IDs, utilizing a daily cache.
 *
 * @param {Array<string>} itemIds - The IDs of all items to fetch/retrieve.
 * @param {string} shopId - The ID of the shop.
 * @param {string} zoneId - The zone ID for the request.
 * @param {string} postalCode - The postal code for the request.
 * @param {Array<Object>} initialItems - Optional array of item objects already fetched.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of all processed item objects.
 */
async function fetchItemDetails(itemIds, shopId, zoneId, postalCode, initialItems = []) {
    const today = new Date().toISOString().split('T')[0];
    const shopCacheKey = `instacart-shop-items-${shopId}-${today}`;

    const finalItemsMap = {};
    const itemIdsToFetch = [];
    let cacheNeedsUpdate = false;

    // 1. Get existing cache for the shop
    const cacheResult = await chrome.storage.local.get(shopCacheKey);
    let cachedItems = cacheResult[shopCacheKey] || {};

    // 2. Process and cache the "free" initial items first
    const processedInitialItems = initialItems.map(item => getItemData(item));
    for (const item of processedInitialItems) {
        if (!cachedItems[item.productId]) {
            cachedItems[item.productId] = item;
            cacheNeedsUpdate = true;
        }
    }

    // 3. Check all required itemIds against the cache
    for (const itemId of itemIds) {
        const productId = itemId.split('-')[1];
        if (cachedItems[productId]) {
            if (!finalItemsMap[productId]) { // Avoid duplicates
                finalItemsMap[productId] = cachedItems[productId];
            }
        } else {
            itemIdsToFetch.push(itemId);
        }
    }

    // 4. Fetch details for any remaining items that were not in the cache.
    if (itemIdsToFetch.length > 0) {
        console.log(`Shop ${shopId}: Found ${Object.keys(finalItemsMap).length} items in cache, fetching remaining ${itemIdsToFetch.length}.`);
        const CHUNK_SIZE = 50;
        for (let i = 0; i < itemIdsToFetch.length; i += CHUNK_SIZE) {
            const itemIdsChunk = itemIdsToFetch.slice(i, i + CHUNK_SIZE);
            console.log(`Fetching details for chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(itemIdsToFetch.length / CHUNK_SIZE)}...`);

            const chunkVariables = { ids: itemIdsChunk, shopId, zoneId, postalCode };
            const extensions = {
                persistedQuery: {
                    version: 1,
                    sha256Hash: "6474c319c75c5357b0a4f646e1d3a01dd805c5fd917d7a90906ecb84a1bad8b1"
                }
            };
            const params = new URLSearchParams({
                operationName: 'Items',
                variables: JSON.stringify(chunkVariables),
                extensions: JSON.stringify(extensions)
            });
            const url = `/graphql?${params.toString()}`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const obj = await response.json();
                if (obj.errors?.length > 0) throw new Error(obj.errors[0].message);

                const newlyFetchedItems = obj?.data?.items || [];
                const processedNewItems = newlyFetchedItems.map(item => getItemData(item));

                // Add to final list and update cache object
                for (const item of processedNewItems) {
                    if (!finalItemsMap[item.productId]) {
                        finalItemsMap[item.productId] = item;
                    }
                    if (!cachedItems[item.productId]) {
                        cachedItems[item.productId] = item;
                        cacheNeedsUpdate = true;
                    }
                }
            } catch (error) {
                console.error(`Failed to fetch details for item IDs chunk in shop ${shopId}:`, error);
            }
            await delay(500); // Be kind to the API
        }
    } else if (itemIds.length > 0) {
        console.log(`Shop ${shopId}: All ${itemIds.length} items found in cache.`);
    }

    // 5. Update the cache in local storage if needed
    if (cacheNeedsUpdate) {
        console.log(`Updating cache for shop ${shopId} with ${Object.keys(cachedItems).length} total items.`);
        await chrome.storage.local.set({ [shopCacheKey]: cachedItems });
    }

    return Object.values(finalItemsMap);
}


function getItemData(item) {
    var trackingProperties = item.viewSection.trackingProperties

    return {
        category: trackingProperties.product_category_name,
        itemName: trackingProperties.item_name,
        productId: trackingProperties.product_id,
        priceString: item.price?.viewSection?.itemDetails?.priceString,
        pricingUnitString: item.price?.viewSection?.itemDetails?.pricingUnitString,
        itemId: trackingProperties.item_id,
        itemImage: item.viewSection?.itemImage         
    }
}

/**
 * Fetches "Buy it again" items for a list of Instacart shops.
 *
 * @param {Array<Object>} shops - An array of shop objects. Each object must have `id` and `retailerInventorySessionToken`.
 * @param {string} pageViewId - The unique page view ID from the current Instacart session.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of objects, where each object
 * contains the shopId and a list of its processed items.
 */
async function fetchAllShopItems(shops, pageViewId) {
    var allShopItems = [];

    var extensions = {
        persistedQuery: {
            version: 1,
            sha256Hash: "829a2e7c0b0d8156926b64dc69afd11f0b3d4097f90679fa84a539059c131eb7"
        }
    };


    // Process shops sequentially to avoid sending too many requests at once.
    for (var shop of shops) {
        var {
            id: shopId,
            retailerInventorySessionToken
        } = shop;

        try {
            // Construct the complex 'variables' and 'extensions' objects for the GraphQL query.
            var variables = {
                retailerInventorySessionToken,
                pageViewId,
                orderBy: "MOST_RELEVANT",
                first: 20, // Fetch up to 18 items per shop (seems to be max page size)
                pageSource: "your_items",
                categoryId: "all",
                shopId,
                postalCode,
                zoneId
            };

            // Use URLSearchParams to safely encode the parameters for the GET request.
            var params = new URLSearchParams({
                operationName: 'Category',
                variables: JSON.stringify(variables),
                extensions: JSON.stringify(extensions)
            });

            var url = `/graphql?${params.toString()}`;

            var response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for shop ${shopId}`);
            }
            var obj = await response.json();

            if (obj.errors?.length > 0) {
                console.error(obj.errors)
                throw obj.errors[0].message
            }

            var initialItems = obj?.data?.yourItemsCategory?.items || [];
            var allItemIds = obj?.data?.yourItemsCategory?.itemIds || [];

            // The new fetchItemDetails will handle caching and fetching only what's necessary.
            // We pass it all the item IDs we expect, and the initial items we got for "free".
            const allItemsForShop = await fetchItemDetails(allItemIds, shopId, zoneId, postalCode, initialItems);

            console.log(`Found total of ${allItemsForShop.length} items for ${shop.retailer.name}`);

            allShopItems.push({ shopId, retailer: shop.retailer.name, items: allItemsForShop, error: null });
        } catch (error) {
            console.error(`Failed to fetch or process data for shop ${shopId}:`, error);
            allShopItems.push({ shopId, items: [], error: error.message });
        }
        // Add a small delay between shop requests to be kind to the API.
        await delay(500);
    }
    return allShopItems;
}

/**
 * Groups items from multiple shops by category and product ID.
 * @param {Array<Object>} shopItems - The array of shop items from all shops.
 * @returns {{retailers: Array<string>, itemsByCategory: Object}} An object containing sorted retailer names and items grouped by category.
 */
function groupShopItems(shopItems) {
    // 1. Get unique retailers and sort them for consistent column order.
    const retailers = [...new Set(shopItems.map(shop => shop.retailer))].sort();

    // 2. Group all items by category, then by product id.
    const itemsByCategory = {};
    shopItems.forEach(shop => {
        if (!shop.items) return;
        shop.items.forEach(item => {
            if (!item.category || !item.itemName) return; // Skip items without category or name

            const category = item.category;
            const itemName = item.itemName;
            const productId = item.productId;

            if (!itemsByCategory[category]) {
                itemsByCategory[category] = {};
            }
            const categoryItems = itemsByCategory[category];

            if (!categoryItems[productId]) {
                // Store item details once, find first available image
                categoryItems[productId] = {
                    productId,
                    itemName,
                    itemImage: item.itemImage,
                    prices: {}
                };
            } else if (!categoryItems[productId].itemImage && item.itemImage) {
                // If we find an image for an item that didn't have one
                categoryItems[productId].itemImage = item.itemImage;
            }

            // Store price info per retailer
            categoryItems[productId].prices[shop.retailer] = {
                priceString: item.priceString,
                pricingUnitString: item.pricingUnitString,
            };
        });
    });

    return { retailers, itemsByCategory };
}

(async () => {

    await clearOldCache();

    var shopItems = await fetchAllShopItems(searchingShops, buyItAgainPageViewId);
    const { retailers, itemsByCategory } = groupShopItems(shopItems);

    window.sidePanelContent = { apolloState, retailers, itemsByCategory, postalCode, zoneId }

    // send message to side panel

    await chrome.runtime.sendMessage(window.sidePanelContent)

    console.log('sidePanelContent', window.sidePanelContent)

})();
