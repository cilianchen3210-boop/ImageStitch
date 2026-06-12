const previewCanvas = document.getElementById('previewCanvas');
const previewRegion = document.getElementById('previewRegion');
const miniPreviewGroup = document.querySelector('.mini-preview-group');
const overlay = document.getElementById('fullscreenOverlay');
const closeButton = document.getElementById('fullscreenCloseButton');

export function initFullscreenPreview() {
  miniPreviewGroup.addEventListener('click', () => {
    if (previewCanvas.width === 0 || previewCanvas.height === 0) return;
    overlay.hidden = false;
    overlay.appendChild(previewCanvas);
  });

  closeButton.addEventListener('click', closeFullscreen);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeFullscreen();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeFullscreen();
  });
}

function closeFullscreen() {
  overlay.hidden = true;
  previewRegion.appendChild(previewCanvas);
}
