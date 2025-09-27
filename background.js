var INSTACART_HOSTNAME = 'instacart.com';

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url) return;
  var url = new URL(tab.url);
  var isInstacartPage = url.hostname === INSTACART_HOSTNAME || url.hostname.includes(`.${INSTACART_HOSTNAME}`);

  if (isInstacartPage) {
    // Programmatically open the side panel on the current tab.
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  var url = new URL(tab.url);

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