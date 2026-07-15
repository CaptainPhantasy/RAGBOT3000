// Content script: Inject extension ID and signal readiness to the page
(function () {
  // Inject extension ID into window object
  (window as any).__TOM_EXTENSION_ID__ = chrome.runtime.id;

  // Dispatch custom event to signal extension is ready
  const event = new CustomEvent('tom-extension-ready', {
    detail: { extensionId: chrome.runtime.id }
  });
  window.dispatchEvent(event);
})();
