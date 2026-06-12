let idCounter = 0;

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `id_${Date.now()}_${idCounter}`;
}

export function createImageItem(file) {
  return {
    id: generateId(),
    type: 'image',
    file,
    src: URL.createObjectURL(file),
    img: null,
    naturalWidth: 0,
    naturalHeight: 0,
    fillMode: 'scale',
    crop: null,
    centerLock: false,
    children: null,
  };
}

export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
