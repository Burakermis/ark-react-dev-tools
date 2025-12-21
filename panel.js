// panel.js - DevTools panel UI mantığı

let currentData = null;
let selectedComponent = null;

// Background script ile bağlantı kur
const backgroundPageConnection = chrome.runtime.connect({
  name: 'devtools-page'
});

backgroundPageConnection.postMessage({
  name: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId
});

// Background'dan gelen mesajları dinle
backgroundPageConnection.onMessage.addListener(function (message) {
  if (message.type === 'REACT_DATA') {
    handleReactData(message.data);
  }
});

// Inspect butonuna tıklama
document.getElementById('inspectBtn').addEventListener('click', function () {
  inspectPage();
});

// Sayfayı inspect et
function inspectPage() {
  showLoading();

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'INSPECT_PAGE' });
    }
  });
}

function showLoading() {
  document.getElementById('componentTree').innerHTML = '<div class="loading">Inspecting React app...</div>';
  document.getElementById('details').innerHTML = '';
}

// React verilerini işle
function handleReactData(data) {
  currentData = data;

  if (!data.success) {
    document.getElementById('componentTree').innerHTML =
      `<div class="empty-state">${data.message}</div>`;
    return;
  }

  renderComponentTree(data.components);
  renderStats(data);

  if (data.components.length > 0) {
    selectComponent(data.components[0]);
  }
}

// Component tree'yi render et
function renderComponentTree(components) {
  const tree = document.getElementById('componentTree');
  tree.innerHTML = '';

  const grouped = groupByDepth(components);

  Object.keys(grouped).forEach(depth => {
    grouped[depth].forEach(component => {
      const item = createComponentItem(component);
      tree.appendChild(item);
    });
  });
}

function groupByDepth(components) {
  const grouped = {};
  components.forEach(comp => {
    if (!grouped[comp.depth]) {
      grouped[comp.depth] = [];
    }
    grouped[comp.depth].push(comp);
  });
  return grouped;
}

function createComponentItem(component) {
  const div = document.createElement('div');
  div.className = 'component-item';
  div.style.paddingLeft = (component.depth * 10 + 12) + 'px';

  const name = document.createElement('span');
  name.className = 'component-name';
  name.textContent = component.name;

  const type = document.createElement('span');
  type.className = 'component-type';
  type.textContent = `[${component.type}]`;

  div.appendChild(name);
  div.appendChild(type);

  div.addEventListener('click', () => selectComponent(component));

  return div;
}

// Component seçimi
function selectComponent(component) {
  selectedComponent = component;

  // Önceki seçimi temizle
  document.querySelectorAll('.component-item').forEach(el => {
    el.classList.remove('selected');
  });

  // Yeni seçimi işaretle
  event?.currentTarget?.classList.add('selected');

  renderComponentDetails(component);
}

// Component detaylarını render et
function renderComponentDetails(component) {
  const details = document.getElementById('details');
  details.innerHTML = '';

  // Başlık
  const title = document.createElement('h2');
  title.textContent = component.name;
  title.style.marginBottom = '24px';
  title.style.color = '#4ec9b0';
  details.appendChild(title);

  // Props
  if (component.props && Object.keys(component.props).length > 0) {
    const propsSection = createSection('Props', component.props);
    details.appendChild(propsSection);
  }

  // State
  if (component.state !== null && component.state !== undefined) {
    const stateSection = createSection('State', component.state);
    details.appendChild(stateSection);
  }

  // Context
  if (component.context && Object.keys(component.context).length > 0) {
    const contextSection = createSection('Context', component.context);
    details.appendChild(contextSection);
  }

  // Component bilgileri
  const infoSection = document.createElement('div');
  infoSection.className = 'section';
  infoSection.innerHTML = `
    <div class="section-title">Component Info</div>
    <div class="property">
      <span class="property-key">Type:</span>
      <span class="property-value">${component.type}</span>
    </div>
    <div class="property">
      <span class="property-key">Key:</span>
      <span class="property-value">${component.key || 'null'}</span>
    </div>
    <div class="property">
      <span class="property-key">Depth:</span>
      <span class="property-value">${component.depth}</span>
    </div>
  `;
  details.appendChild(infoSection);

  // Redux (eğer varsa)
  if (currentData.redux && currentData.redux.found) {
    const reduxSection = createSection('Redux Store', currentData.redux.state);
    details.appendChild(reduxSection);
  }
}

// Section oluştur
function createSection(title, data) {
  const section = document.createElement('div');
  section.className = 'section';

  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = title;
  section.appendChild(titleEl);

  const content = document.createElement('pre');
  content.textContent = JSON.stringify(data, null, 2);
  section.appendChild(content);

  return section;
}

// İstatistikleri göster
function renderStats(data) {
  const stats = document.getElementById('stats');
  stats.innerHTML = `<span class="info-badge">${data.components.length} components</span>`;

  if (data.reactVersion !== 'Unknown') {
    stats.innerHTML += `<span class="info-badge">React ${data.reactVersion}</span>`;
  }

  if (data.redux && data.redux.found) {
    stats.innerHTML += `<span class="info-badge">Redux detected</span>`;
  }
}

// Sayfa yüklendiğinde otomatik inspect
setTimeout(() => {
  inspectPage();
}, 500);

// Sidebar Resizing Logic
const resizer = document.getElementById('resizer');
const sidebar = document.getElementById('sidebar');
const body = document.body;

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  resizer.classList.add('resizing');
  body.classList.add('resizing');
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  // Prevent selecting text while resizing
  e.preventDefault();
  const newWidth = e.clientX;
  // Min width 150px, Max width window width - 100px
  if (newWidth > 150 && newWidth < window.innerWidth - 100) {
    sidebar.style.width = `${newWidth}px`;
  }
});

document.addEventListener('mouseup', () => {
  isResizing = false;
  resizer.classList.remove('resizing');
  body.classList.remove('resizing');
});