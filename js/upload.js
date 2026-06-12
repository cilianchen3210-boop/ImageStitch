import { getState, onChange, addImages, removeImage, reorderImages } from './state.js';

const uploadRegion = document.getElementById('uploadRegion');
const uploadGrid = document.getElementById('uploadGrid');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const fileInput = document.getElementById('fileInput');

let draggedId = null;

export function initUpload() {
  uploadPlaceholder.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      addImages(Array.from(fileInput.files));
    }
    fileInput.value = '';
  });

  uploadRegion.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadRegion.classList.add('drag-over');
  });

  uploadRegion.addEventListener('dragleave', (e) => {
    if (!uploadRegion.contains(e.relatedTarget)) {
      uploadRegion.classList.remove('drag-over');
    }
  });

  uploadRegion.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadRegion.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (!files || !files.length) return;
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (images.length) addImages(images);
  });

  uploadGrid.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.thumb-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const thumb = deleteBtn.closest('.thumb');
      removeImage(thumb.dataset.id);
      return;
    }

    if (e.target.closest('.add-tile')) {
      fileInput.click();
    }
  });

  uploadGrid.addEventListener('dragstart', (e) => {
    const thumb = e.target.closest('.thumb');
    if (!thumb || thumb.classList.contains('add-tile')) return;
    draggedId = thumb.dataset.id;
    e.dataTransfer.setData('text/plain', draggedId);
    e.dataTransfer.effectAllowed = 'move';
    thumb.classList.add('dragging');
  });

  uploadGrid.addEventListener('dragover', (e) => {
    const thumb = e.target.closest('.thumb');
    if (!thumb || draggedId === null) return;
    e.preventDefault();

    uploadGrid.querySelectorAll('.drag-over-left, .drag-over-right').forEach((el) => {
      el.classList.remove('drag-over-left', 'drag-over-right');
    });

    const rect = thumb.getBoundingClientRect();
    const isBefore = e.clientX < rect.left + rect.width / 2;
    thumb.classList.add(isBefore ? 'drag-over-left' : 'drag-over-right');
  });

  uploadGrid.addEventListener('drop', (e) => {
    const thumb = e.target.closest('.thumb');
    if (!thumb || draggedId === null) return;
    e.preventDefault();

    const state = getState();
    const fromIndex = state.items.findIndex((item) => item.id === draggedId);
    if (fromIndex === -1) return;

    let toIndex;
    if (thumb.classList.contains('add-tile')) {
      toIndex = state.items.length - 1;
    } else {
      const rect = thumb.getBoundingClientRect();
      const isBefore = e.clientX < rect.left + rect.width / 2;
      const targetIndex = state.items.findIndex((item) => item.id === thumb.dataset.id);
      toIndex = isBefore ? targetIndex : targetIndex + 1;
      if (fromIndex < toIndex) toIndex -= 1;
    }

    reorderImages(fromIndex, toIndex);
  });

  uploadGrid.addEventListener('dragend', () => {
    draggedId = null;
    uploadGrid.querySelectorAll('.dragging, .drag-over-left, .drag-over-right').forEach((el) => {
      el.classList.remove('dragging', 'drag-over-left', 'drag-over-right');
    });
  });

  onChange(syncThumbnails);
  syncThumbnails(getState());
}

export function syncThumbnails(state) {
  uploadGrid.innerHTML = '';

  if (state.items.length === 0) {
    uploadPlaceholder.hidden = false;
    uploadGrid.appendChild(uploadPlaceholder);
    return;
  }

  uploadPlaceholder.hidden = true;

  state.items.forEach((item) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.dataset.id = item.id;
    thumb.draggable = true;

    const img = document.createElement('img');
    img.className = 'thumb-img';
    img.src = item.src;
    img.draggable = false;
    img.alt = '';
    thumb.appendChild(img);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'thumb-delete';
    deleteBtn.setAttribute('aria-label', '删除');
    deleteBtn.textContent = '×';
    thumb.appendChild(deleteBtn);

    uploadGrid.appendChild(thumb);
  });

  const addTile = document.createElement('div');
  addTile.className = 'thumb add-tile';
  addTile.textContent = '+';
  uploadGrid.appendChild(addTile);
}
