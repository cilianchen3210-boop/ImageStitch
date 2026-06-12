import { getState } from './state.js';
import { render } from './render.js';

const canvas = document.getElementById('previewCanvas');
const exportButton = document.getElementById('exportButton');
const exportNote = document.getElementById('exportNote');

const FORMAT_INFO = {
  'image/png': { ext: 'png', description: 'PNG 图片' },
  'image/webp': { ext: 'webp', description: 'WebP 图片' },
  'image/jpeg': { ext: 'jpg', description: 'JPEG 图片' },
};

const supportsSavePicker = 'showSaveFilePicker' in window;

export function initExport() {
  if (!supportsSavePicker) {
    exportNote.textContent =
      '当前浏览器不支持选择保存位置，文件将保存到浏览器默认下载文件夹。可在浏览器设置中开启"下载前询问保存位置"以自行选择路径。';
    exportNote.hidden = false;
  }

  exportButton.addEventListener('click', () => {
    handleExport().catch((err) => {
      console.error(err);
      alert('导出失败：' + err.message);
    });
  });
}

async function handleExport() {
  const state = getState();
  const hasImages = state.items.some((item) => item.naturalWidth > 0);
  if (!hasImages) {
    alert('请先上传图片');
    return;
  }

  render(state);

  const { type: mimeType, quality } = state.exportFormat;
  const { ext, description } = FORMAT_INFO[mimeType];
  const filename = `拼图-${Date.now()}.${ext}`;
  const toBlobQuality = mimeType === 'image/png' ? undefined : quality;

  if (supportsSavePicker) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description, accept: { [mimeType]: [`.${ext}`] } }],
      });
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
      return;
    }

    const blob = await canvasToBlob(mimeType, toBlobQuality);
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const blob = await canvasToBlob(mimeType, toBlobQuality);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function canvasToBlob(type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
