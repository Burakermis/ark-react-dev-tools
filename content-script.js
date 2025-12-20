// content-script.js - Content script (Sayfa ve extension arasında köprü)

(function() {
  'use strict';

  // inject.js'i sayfaya enjekte et
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // Sayfadan gelen mesajları dinle
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data.type === 'REACT_INSPECTOR_RESULT') {
      // DevTools paneline gönder
      chrome.runtime.sendMessage({
        type: 'REACT_DATA',
        data: event.data.data
      });
    }
    
    if (event.data.type === 'REACT_INSPECTOR_READY') {
      chrome.runtime.sendMessage({
        type: 'INSPECTOR_READY'
      });
    }
  });

  // DevTools'dan gelen istekleri dinle
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'INSPECT_PAGE') {
      // Sayfaya inspect isteği gönder
      window.postMessage({
        type: 'REACT_INSPECTOR_INSPECT'
      }, '*');
      sendResponse({ success: true });
    }
    return true;
  });

})();