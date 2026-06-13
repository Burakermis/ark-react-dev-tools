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

  div.style.paddingLeft = '4px';

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
    toggle.style.visibility = 'hidden';
    toggle.textContent = '▶';
  }
  div.appendChild(toggle);

  const name = document.createElement('span');
  name.className = 'component-name';
  name.textContent = component.name;
  div.appendChild(name);

  if (component.key) {
    const keyBadge = document.createElement('span');
    keyBadge.className = 'badge-type';
    keyBadge.style.color = '#9cdcfe';
    keyBadge.textContent = `key="${component.key}"`;
    div.appendChild(keyBadge);
  }

  if (component.name.includes('Memo')) {
    const badge = document.createElement('span');
    badge.className = 'badge-type';
    badge.textContent = 'Memo';
    div.appendChild(badge);
  } else if (component.name.includes('ForwardRef')) {
    const badge = document.createElement('span');
    badge.className = 'badge-type';
    badge.textContent = 'ForwardRef';
    div.appendChild(badge);
  }

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
  renderBreadcrumbs(component);
  const details = document.getElementById('details');
  details.innerHTML = '';

  // Props
  if (component.props && Object.keys(component.props).length > 0) {
    const propsSection = createSection('props', component.props);
    details.appendChild(propsSection);
  }

  // Hooks
  if (component.state !== null && component.state !== undefined && component.state._isHooks) {
    const hooksContainer = document.createElement('div');
    hooksContainer.className = 'section';
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'hooks';
    hooksContainer.appendChild(title);

    component.state.hooks.forEach((hook, index) => {
      const hookItem = document.createElement('div');
      hookItem.className = 'hook-item';
      hookItem.style.display = 'flex';
      hookItem.style.marginBottom = '8px';

      const idx = document.createElement('span');
      idx.className = 'hook-index';
      idx.textContent = index + 1;
      hookItem.appendChild(idx);

      const valContainer = document.createElement('div');
      valContainer.style.flex = '1';

      if (typeof hook.value === 'object' && hook.value !== null) {
        renderObjectTree(hook.value, valContainer);
      } else {
        const valSpan = document.createElement('span');
        valSpan.className = 'property-value';
        valSpan.style.marginLeft = '0';
        valSpan.textContent = formatValue(hook.value);
        valContainer.appendChild(valSpan);
      }

      hookItem.appendChild(valContainer);
      hooksContainer.appendChild(hookItem);
    });
    details.appendChild(hooksContainer);
  } else if (component.state !== null && component.state !== undefined) {
    const stateSection = createSection('state', component.state);
    details.appendChild(stateSection);
  }

  // Rendered by
  const renderedBySection = document.createElement('div');
  renderedBySection.className = 'section';
  renderedBySection.innerHTML = `
    <div class="section-title">rendered by</div>
    <div class="property">
      <span class="property-value" style="color: #61dafb; margin-left: 0;">react-dom@${currentData.reactVersion}</span>
    </div>
  `;
  details.appendChild(renderedBySection);

  // Source
  if (component.source) {
    const sourceSection = document.createElement('div');
    sourceSection.className = 'section';
    const fileName = component.source.fileName.split('/').pop();
    sourceSection.innerHTML = `
      <div class="section-title">source</div>
      <div class="property">
        <span class="property-value" style="color: #61dafb; cursor: pointer; margin-left: 0; text-decoration: underline;">
          ${fileName}:${component.source.lineNumber}
        </span>
      </div>
    `;
    details.appendChild(sourceSection);
  }
}

function renderBreadcrumbs(component) {
  const header = document.getElementById('details-header');
  header.innerHTML = '';

  const bc = document.createElement('div');
  bc.className = 'breadcrumb';

  const idBadge = document.createElement('span');
  idBadge.className = 'breadcrumb-item';
  // Use component index or similar to have a "stable-ish" mock ID
  idBadge.textContent = component.id.split('-').pop().padStart(8, '0');
  bc.appendChild(idBadge);

  const name = document.createElement('span');
  name.className = 'breadcrumb-current';
  name.textContent = component.name;
  bc.appendChild(name);

  header.appendChild(bc);
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
        valuePreview.textContent = Array.isArray(value) ? `Array(${value.length})` : '{…}';
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