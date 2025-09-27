/**
 * This content script is injected temporarily into an Instacart tab
 * by the options page to retrieve a list of all available retailers.
 */
(() => {
    try {
        var apolloState = JSON.parse(document.getElementById("node-apollo-state").textContent);
        var allShops = apolloState['Shop:f928c71'];
        var retailerNames = new Set();

        Object.values(allShops).forEach(shopWrapper => {
            retailerNames.add(shopWrapper.shop.retailer.name);
        });

        return Array.from(retailerNames);
    } catch (e) {
        console.error("Failed to get retailers from Apollo state:", e);
        return [];
    }
})();