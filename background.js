const INSTACART_HOSTNAME = 'instacart.com';

// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);

  // Enables the side panel on instacart.com
  if (url.hostname === INSTACART_HOSTNAME || url.hostname.includes(`.${INSTACART_HOSTNAME}`)) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html', // Make sure this path is correct
      enabled: true
    });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});