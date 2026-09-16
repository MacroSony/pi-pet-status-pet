'use strict';

const invoke = window.__TAURI__.core.invoke;
const editorWindow = window.__TAURI__.window.getCurrentWindow();
const message = document.getElementById('message');
const buttons = [...document.querySelectorAll('button')];
let busy = false;
const showError = (error) => { message.textContent = String(error); };

async function save(disabled) {
  if (busy) return;
  busy = true;
  buttons.forEach((button) => { button.disabled = true; });
  try {
    // Geometry and revision come from native state, never WebView arguments.
    await invoke('save_activity_area', { disabled });
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
}
document.getElementById('apply').addEventListener('click', () => save(false));
document.getElementById('disable').addEventListener('click', () => save(true));
document.getElementById('cancel').addEventListener('click', () => {
  if (!busy) editorWindow.close().catch(showError);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !busy) editorWindow.close().catch(showError);
});
document.getElementById('move-handle').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || busy) return;
  event.preventDefault();
  editorWindow.startDragging().catch(showError);
});
for (const handle of document.querySelectorAll('[data-resize]')) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || busy) return;
    event.preventDefault();
    editorWindow.startResizeDragging(handle.dataset.resize).catch(showError);
  });
}
invoke('activity_area_editor_info').then((text) => { message.textContent = text; }).catch(showError);
