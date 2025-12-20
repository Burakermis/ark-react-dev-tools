chrome.devtools.panels.create(
  'ARK React DevTools',
  'icon48.png',
  'panel.html',
  function(panel) {
    console.log('React Inspector panel created');
  }
);