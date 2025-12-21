// inject.js - Sayfaya enjekte edilen script (React'e direkt erişim için)

(function () {
  'use strict';

  console.log('%c[React Inspector - Inject] 🚀 Script yüklendi', 'color: #61dafb; font-weight: bold; font-size: 14px');

  // React Fiber tree'yi traverse et
  function traverseFiber(fiber, depth = 0, parentId = null, index = 0) {
    if (!fiber) return [];

    const components = [];
    const componentId = `${parentId || 'root'}-${index}`;

    // Component bilgilerini topla
    if (fiber.type) {
      const componentInfo = {
        id: componentId,
        name: getComponentName(fiber),
        type: getComponentType(fiber),
        props: safeSerialize(fiber.memoizedProps),
        state: safeSerialize(fiber.memoizedState),
        context: safeSerialize(fiber.context),
        depth: depth,
        key: fiber.key,
        children: []
      };

      components.push(componentInfo);

      // Children'ı traverse et
      if (fiber.child) {
        let childIndex = 0;
        let child = fiber.child;
        while (child) {
          const childComponents = traverseFiber(child, depth + 1, componentId, childIndex);
          components.push(...childComponents);
          child = child.sibling;
          childIndex++;
        }
      }
    } else if (fiber.child) {
      // Type yoksa ama child varsa (Fragment gibi)
      components.push(...traverseFiber(fiber.child, depth, parentId, index));
    }

    // Sibling'leri traverse et (aynı seviyede)
    if (fiber.sibling && parentId) {
      // Sibling'ler parent tarafından halledilir
    }

    return components;
  }

  // Component adını al
  function getComponentName(fiber) {
    if (!fiber.type) return 'Unknown';

    if (typeof fiber.type === 'string') {
      return fiber.type; // 'div', 'span' gibi DOM elementleri
    }

    // Klasik function/class name
    if (fiber.type.name) {
      return fiber.type.name;
    }

    // DisplayName varsa
    if (fiber.type.displayName) {
      return fiber.type.displayName;
    }

    // ForwardRef, Memo, Lazy gibi sarmalanmış bileşenler için
    if (typeof fiber.type === 'object') {
      if (fiber.type.displayName) return fiber.type.displayName;
      if (fiber.type.name) return fiber.type.name;

      // Inner type kontrolü (Memo(MyComponent))
      if (fiber.type.type) {
        const innerName = fiber.type.type.displayName || fiber.type.type.name;
        if (innerName) return innerName; // Memo ve ForwardRef genellikle burada ismini saklar
      }

      // render fonksiyonu (ForwardRef)
      if (fiber.type.render) {
        const renderName = fiber.type.render.displayName || fiber.type.render.name;
        if (renderName) return renderName;
      }
    }

    // Context, Memo, ForwardRef gibi özel tipler
    if (fiber.type.$$typeof) {
      const symbolString = fiber.type.$$typeof.toString();
      if (symbolString.includes('context')) return 'Context.Provider/Consumer';
      if (symbolString.includes('memo')) {
        const inner = getComponentName({ type: fiber.type.type });
        return inner !== 'Anonymous' && inner !== 'Unknown' ? `Memo(${inner})` : 'Memo';
      }
      if (symbolString.includes('forward_ref')) return 'ForwardRef';
    }

    // Eğer hala bulamadıysak ve debug kaynağı varsa dosya adını kullan
    if (fiber._debugSource && fiber._debugSource.fileName) {
      const fileName = fiber._debugSource.fileName.split('/').pop().split('.')[0];
      return `${fileName} (Anonymous)`;
    }

    return 'Anonymous';
  }

  // Component tipini belirle
  function getComponentType(fiber) {
    if (!fiber.type) return 'unknown';
    if (typeof fiber.type === 'string') return 'native';
    if (fiber.type.prototype && fiber.type.prototype.isReactComponent) return 'class';
    return 'function';
  }

  // Objeleri güvenli şekilde serialize et
  function safeSerialize(obj, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return '[Max Depth Reached]';
    if (obj === null) return null;
    if (obj === undefined) return undefined;

    const type = typeof obj;

    if (type === 'string' || type === 'number' || type === 'boolean') {
      return obj;
    }

    if (type === 'function') {
      return `[Function: ${obj.name || 'anonymous'}]`;
    }

    if (type === 'symbol') {
      return obj.toString();
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (obj instanceof RegExp) {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map(item => safeSerialize(item, depth + 1, maxDepth));
    }

    if (type === 'object') {
      // React element kontrolü
      if (obj.$$typeof && obj.$$typeof.toString().includes('react.element')) {
        return '[React Element]';
      }

      const result = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // DOM node'ları ve circular reference'ları atla
          if (key.startsWith('__') || key === '_owner' || key === '_store') continue;

          try {
            result[key] = safeSerialize(obj[key], depth + 1, maxDepth);
          } catch (e) {
            result[key] = '[Error Serializing]';
          }
        }
      }
      return result;
    }

    return String(obj);
  }

  // React root'larını bul - Tüm React versiyonları için
  function findReactRoots() {
    const roots = [];

    // Tüm olası React key pattern'leri
    const reactKeyPatterns = [
      '__reactFiber',           // React 16.8+
      '__reactInternalInstance', // React 15-16
      '_reactRootContainer',    // React 16-17
      '_reactRoot',             // React 18
      '__reactContainer',       // Eski versiyonlar
      '__reactEventHandlers'    // Alternatif
    ];

    function scanElement(element) {
      if (!element || element.nodeType !== 1) return null;

      const keys = Object.keys(element);

      // Tüm pattern'leri dene
      for (const pattern of reactKeyPatterns) {
        const fiberKey = keys.find(key => key.startsWith(pattern) || key.includes(pattern));

        if (fiberKey) {
          let fiber = element[fiberKey];

          // _reactRootContainer yapısı (React 16-17)
          // Örnek: element._reactRootContainer._internalRoot.current
          if (fiber && fiber._internalRoot && fiber._internalRoot.current) {
            fiber = fiber._internalRoot.current;
          }
          // React 18+ root yapısı
          // Örnek: element._reactRoot.current
          else if (fiber && fiber.current) {
            fiber = fiber.current;
          }

          // Fiber geçerliyse döndür
          if (fiber && (fiber.child || fiber.stateNode)) {
            console.log('[React Inspector - Inject] ✅ React bulundu! Key:', fiberKey);
            return {
              element: element,
              fiber: fiber,
              key: fiberKey
            };
          }
        }
      }

      return null;
    }

    // Önce bilinen React mount noktalarını kontrol et
    const selectors = [
      '#root',
      '#app',
      '[data-reactroot]',
      '[data-react-root]',
      'body > div',
      'main',
      '#__next', // Next.js
      '#___gatsby', // Gatsby
      '.app',
      '.App'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const result = scanElement(element);
        if (result) {
          roots.push(result);
        }
      });

      if (roots.length > 0) break;
    }

    // Hala bulamadıysak, body'nin tüm direct children'larını tara
    if (roots.length === 0) {
      console.log('[React Inspector - Inject] 🔍 Body children taranıyor...');
      const bodyChildren = document.body.children;
      for (let i = 0; i < bodyChildren.length; i++) {
        const result = scanElement(bodyChildren[i]);
        if (result) {
          roots.push(result);
          break;
        }
      }
    }

    // Hala yoksa, tüm div'leri tara (ilk 50 tane)
    if (roots.length === 0) {
      console.log('[React Inspector - Inject] 🔍 Tüm div elementleri taranıyor...');
      const allDivs = document.querySelectorAll('div');
      for (let i = 0; i < Math.min(allDivs.length, 50); i++) {
        const result = scanElement(allDivs[i]);
        if (result) {
          roots.push(result);
          break;
        }
      }
    }

    console.log('[React Inspector - Inject] 📊 Bulunan root sayısı:', roots.length);
    if (roots.length > 0) {
      console.log('[React Inspector - Inject] 📍 İlk root:', roots[0]);
    } else {
      console.warn('[React Inspector - Inject] ⚠️ Hiç React root bulunamadı!');
    }

    return roots;
  }

  // Redux store'u bul
  function findReduxStore() {
    // Yaygın Redux store konumları
    const possibleStores = [
      window.store,
      window.__REDUX_STORE__,
      window.__STORE__,
    ];

    for (const store of possibleStores) {
      if (store && typeof store.getState === 'function') {
        return {
          state: safeSerialize(store.getState()),
          found: true
        };
      }
    }

    // Redux DevTools Extension kontrolü
    if (window.__REDUX_DEVTOOLS_EXTENSION__) {
      return {
        state: 'Redux DevTools Extension active',
        found: true,
        devToolsActive: true
      };
    }

    return { found: false };
  }

  // Context değerlerini topla
  function collectContextValues(fiber) {
    const contexts = [];
    let current = fiber;

    while (current) {
      if (current.type && current.type._context) {
        contexts.push({
          name: current.type._context.displayName || 'Context',
          value: safeSerialize(current.memoizedProps?.value)
        });
      }

      // Dependencies'i kontrol et
      if (current.dependencies) {
        let dep = current.dependencies.firstContext;
        while (dep) {
          contexts.push({
            name: dep.context.displayName || 'Context',
            value: safeSerialize(dep.memoizedValue)
          });
          dep = dep.next;
        }
      }

      current = current.return;
    }

    return contexts;
  }

  // Ana inspect fonksiyonu
  function inspectReactApp() {
    const roots = findReactRoots();

    if (roots.length === 0) {
      return {
        success: false,
        message: 'React uygulaması bulunamadı'
      };
    }

    const allComponents = [];

    roots.forEach((root, rootIndex) => {
      const components = traverseFiber(root.fiber, 0, `root-${rootIndex}`, 0);
      allComponents.push(...components);
    });

    const reduxInfo = findReduxStore();

    return {
      success: true,
      components: allComponents,
      redux: reduxInfo,
      reactVersion: getReactVersion(),
      timestamp: Date.now()
    };
  }

  // React versiyonunu al
  function getReactVersion() {
    const rootElement = document.querySelector('[data-reactroot], #root, #app');
    if (!rootElement) return 'Unknown';

    const reactKey = Object.keys(rootElement).find(key => key.startsWith('__react'));
    if (!reactKey) return 'Unknown';

    // React 16+ için
    if (window.React && window.React.version) {
      return window.React.version;
    }

    return 'Unknown';
  }

  // Message listener
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;

    if (event.data.type === 'REACT_INSPECTOR_INSPECT') {
      console.log('[React Inspector - Inject] 🔍 Inspect isteği alındı');
      const result = inspectReactApp();
      console.log('[React Inspector - Inject] 📊 Sonuç:', result);
      window.postMessage({
        type: 'REACT_INSPECTOR_RESULT',
        data: result
      }, '*');
    }
  });

  // Extension'a hazır olduğunu bildir
  console.log('[React Inspector - Inject] ✅ Ready mesajı gönderiliyor');
  window.postMessage({
    type: 'REACT_INSPECTOR_READY'
  }, '*');

})();