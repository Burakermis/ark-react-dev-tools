// background.js - Service worker

let connections = {};

chrome.runtime.onConnect.addListener(function(port) {
  
  const extensionListener = function(message, sender, sendResponse) {
    // DevTools panel ile iletişim
    if (message.name === 'init') {
      connections[message.tabId] = port;
      return;
    }
  };

  port.onMessage.addListener(extensionListener);

  port.onDisconnect.addListener(function(port) {
    port.onMessage.removeListener(extensionListener);

    const tabs = Object.keys(connections);
    for (let i = 0, len = tabs.length; i < len; i++) {
      if (connections[tabs[i]] === port) {
        delete connections[tabs[i]];
        break;
      }
    }
  });
});

// Content script'ten gelen mesajları DevTools'a ilet
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (sender.tab) {
    const tabId = sender.tab.id;
    if (tabId in connections) {
      connections[tabId].postMessage(request);
    }
  }
});