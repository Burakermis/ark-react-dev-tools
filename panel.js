// panel.js - DevTools panel UI mantığı

let currentData = null;
let selectedComponent = null;
const tabId = chrome.devtools.inspectedWindow.tabId;

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

// Refresh butonuna tıklama
document.getElementById('refreshBtn').addEventListener('click', function () {
  inspectPage();
});

// Sayfayı inspect et
function inspectPage() {
  showLoading();
  chrome.tabs.sendMessage(tabId, { type: 'INSPECT_PAGE' });
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

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
  const filterText = e.target.value.toLowerCase();
  if (currentData && currentData.components) {
    const filteredComponents = currentData.components.filter(comp =>
      comp.name.toLowerCase().includes(filterText)
    );
    renderComponentTree(filteredComponents);
  }
});

// Component tree'yi render et
// Tree State
const collapsedIds = new Set();
// Varsayılan olarak her şey açık (collapsedIds boş)

function buildTree(flatList) {
  const root = { id: 'virtual-root', children: [], depth: -1 };
  const stack = [root];

  flatList.forEach(item => {
    while (stack.length > 1 && stack[stack.length - 1].depth >= item.depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    const newNode = { ...item, children: [] };
    parent.children.push(newNode);
    stack.push(newNode);
  });

  return root.children;
}

function renderComponentTree(components) {
  const treeContainer = document.getElementById('componentTree');
  treeContainer.innerHTML = '';

  // Search aktifse düz liste göster
  const filterText = document.getElementById('searchInput').value;
  if (filterText) {
    components.forEach(comp => {
      const div = document.createElement('div');
      div.className = 'component-item';
      div.style.paddingLeft = '12px';

      const name = document.createElement('span');
      name.className = 'component-name';
      name.textContent = comp.name;
      div.appendChild(name);

      div.addEventListener('click', () => selectComponent(comp));
      treeContainer.appendChild(div);
    });
    return;
  }

  const tree = buildTree(components);
  renderTreeNodes(tree, treeContainer);
}

function renderTreeNodes(nodes, container) {
  if (!nodes || nodes.length === 0) return;

  nodes.forEach(node => {
    const nodeEl = createComponentNode(node);
    container.appendChild(nodeEl);

    if (node.children && node.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      childrenContainer.style.display = collapsedIds.has(node.id) ? 'none' : 'block';

      renderTreeNodes(node.children, childrenContainer);
      container.appendChild(childrenContainer);
    }
  });
}

function createComponentNode(component) {
  const div = document.createElement('div');
  div.className = 'component-item';
  if (selectedComponent && selectedComponent.id === component.id) {
    div.classList.add('selected');
  }

  // Padding based on depth (reset depth since we use nested divs? No, we use flat structure visually but logic is nested)
  // Wait, if we use nested divs for children (tree-children), we don't need cumulative padding on items!
  // The padding happens naturally via hierarchy?
  // Let's check CSS. .tree-children usually has padding-left.
  // But our CSS doesn't have .tree-children padding yet.

  // Let's use explicit padding and flat visual structure but nested in DOM for standard tree feel.
  // Actually, standard tree implementation usually shifts children right.
  // So:
  // .tree-children { padding-left: 12px; }
  // And remove variable padding from createComponentNode.

  div.style.paddingLeft = '4px'; // Base padding

  // Toggle Icon
  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle';
  if (component.children && component.children.length > 0) {
    toggle.textContent = '▶';
    if (!collapsedIds.has(component.id)) {
      toggle.classList.add('expanded');
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleComponent(component.id);
    });
  } else {
    toggle.style.opacity = '0';
    toggle.textContent = '▶';
    toggle.style.cursor = 'default';
  }
  div.appendChild(toggle);

  const name = document.createElement('span');
  name.className = 'component-name';
  name.textContent = component.name;

  const type = document.createElement('span');
  type.className = 'component-type';
  if (component.key) {
    type.textContent = ` key="${component.key}"`;
    type.style.color = '#9cdcfe';
  } else {
    type.textContent = '';
  }

  div.appendChild(name);
  div.appendChild(type);

  div.addEventListener('click', (e) => selectComponent(component));

  div.addEventListener('mouseenter', () => {
    chrome.tabs.sendMessage(tabId, { type: 'HIGHLIGHT_COMPONENT', id: component.id });
  });

  div.addEventListener('mouseleave', () => {
    chrome.tabs.sendMessage(tabId, { type: 'HIDE_HIGHLIGHT' });
  });

  return div;
}

function toggleComponent(id) {
  if (collapsedIds.has(id)) {
    collapsedIds.delete(id);
  } else {
    collapsedIds.add(id);
  }
  // Re-render full tree with new state
  if (currentData && currentData.components) {
    renderComponentTree(currentData.components);
  }
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
    if (component.state._isHooks) {
      component.state.hooks.forEach((hookValue, index) => {
        const hookSection = createSection(`Hook ${index}`, hookValue);
        details.appendChild(hookSection);
      });
    } else {
      const stateSection = createSection('State', component.state);
      details.appendChild(stateSection);
    }
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

  const content = document.createElement('div');
  content.className = 'property-tree';

  if (typeof data === 'object' && data !== null) {
    renderObjectTree(data, content);
  } else {
    const simpleValue = document.createElement('div');
    simpleValue.className = 'property';
    const valSpan = document.createElement('span');
    valSpan.className = 'property-value';
    valSpan.textContent = formatValue(data);
    simpleValue.appendChild(valSpan);
    content.appendChild(simpleValue);
  }

  section.appendChild(content);

  return section;
}

function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return 'Object';
  return String(value);
}

function renderObjectTree(obj, container, depth = 0) {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];
    const isObject = typeof value === 'object' && value !== null;
    const propertyEl = document.createElement('div');
    propertyEl.className = 'property';

    const keySpan = document.createElement('span');
    keySpan.className = 'property-key';
    keySpan.textContent = `${key}: `;
    propertyEl.appendChild(keySpan);

    if (isObject) {
      const hasChildren = Object.keys(value).length > 0;
      if (hasChildren) {
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = '▶';
        propertyEl.insertBefore(toggle, keySpan);

        const valuePreview = document.createElement('span');
        valuePreview.className = 'property-value';
        valuePreview.textContent = Array.isArray(value) ? `Array(${value.length})` : 'Object';
        propertyEl.appendChild(valuePreview);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'property-tree-children';
        childrenContainer.style.display = 'none';

        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = childrenContainer.style.display === 'block';
          childrenContainer.style.display = isExpanded ? 'none' : 'block';
          toggle.classList.toggle('expanded', !isExpanded);
        });

        renderObjectTree(value, childrenContainer, depth + 1);
        container.appendChild(propertyEl);
        container.appendChild(childrenContainer);
      } else {
        const valueSpan = document.createElement('span');
        valueSpan.className = 'property-value';
        valueSpan.textContent = Array.isArray(value) ? '[]' : '{}';
        propertyEl.appendChild(valueSpan);
        container.appendChild(propertyEl);
      }
    } else {
      const valueSpan = document.createElement('span');
      valueSpan.className = 'property-value';
      valueSpan.textContent = formatValue(value);
      propertyEl.appendChild(valueSpan);
      container.appendChild(propertyEl);
    }
  }
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