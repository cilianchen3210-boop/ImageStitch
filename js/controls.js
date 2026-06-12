import {
  getState,
  onChange,
  setMarginSize,
  setMarginColor,
  setOuterBorder,
  setExportWidthCustom,
  setExportFormat,
  setExportQuality,
  getMaxNaturalWidth,
} from './state.js';

const marginSizeInput = document.getElementById('marginSizeInput');
const marginSizeValueLabel = document.getElementById('marginSizeValueLabel');
const marginSizeValueInput = document.getElementById('marginSizeValueInput');
const marginColorInput = document.getElementById('marginColorInput');
const outerBorderInput = document.getElementById('outerBorderInput');
const exportWidthInput = document.getElementById('exportWidthInput');
const exportWidthReference = document.getElementById('exportWidthReference');
const exportFormatSelect = document.getElementById('exportFormatSelect');
const qualityRow = document.getElementById('qualityRow');
const exportQualityInput = document.getElementById('exportQualityInput');
const qualityValueLabel = document.getElementById('qualityValueLabel');

export function initControls() {
  marginSizeInput.addEventListener('input', () => {
    const value = parseInt(marginSizeInput.value, 10);
    const size = Number.isFinite(value) && value >= 0 ? value : 0;
    setMarginSize(size);
    marginSizeValueLabel.textContent = `${size}px`;
  });

  marginSizeValueLabel.addEventListener('click', startEditingMarginSize);
  marginSizeValueLabel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEditingMarginSize();
    }
  });

  marginSizeValueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      marginSizeValueInput.blur();
    } else if (e.key === 'Escape') {
      cancelEditingMarginSize();
    }
  });

  marginSizeValueInput.addEventListener('blur', commitMarginSizeEdit);

  marginColorInput.addEventListener('input', () => {
    setMarginColor(marginColorInput.value);
  });

  outerBorderInput.addEventListener('change', () => {
    setOuterBorder(outerBorderInput.checked);
  });

  exportWidthInput.addEventListener('input', () => {
    const raw = exportWidthInput.value.trim();
    if (raw === '') {
      setExportWidthCustom(null);
    } else {
      const value = parseInt(raw, 10);
      setExportWidthCustom(Number.isFinite(value) && value > 0 ? value : null);
    }
    updateExportWidthReference();
  });

  exportFormatSelect.addEventListener('change', () => {
    setExportFormat(exportFormatSelect.value);
    updateQualityVisibility();
  });

  exportQualityInput.addEventListener('input', () => {
    const value = parseFloat(exportQualityInput.value);
    setExportQuality(value);
    qualityValueLabel.textContent = `${Math.round(value * 100)}%`;
  });

  onChange(() => updateExportWidthPlaceholder());

  updateExportWidthPlaceholder();
  updateQualityVisibility();
}

function startEditingMarginSize() {
  marginSizeValueInput.value = marginSizeInput.value;
  marginSizeValueLabel.hidden = true;
  marginSizeValueInput.hidden = false;
  marginSizeValueInput.focus();
  marginSizeValueInput.select();
}

function commitMarginSizeEdit() {
  const value = parseInt(marginSizeValueInput.value, 10);
  const size = Number.isFinite(value) && value >= 0 ? value : parseInt(marginSizeInput.value, 10);

  if (size > Number(marginSizeInput.max)) {
    marginSizeInput.max = String(size);
  }
  marginSizeInput.value = String(size);
  setMarginSize(size);
  marginSizeValueLabel.textContent = `${size}px`;

  marginSizeValueInput.hidden = true;
  marginSizeValueLabel.hidden = false;
}

function cancelEditingMarginSize() {
  marginSizeValueInput.value = marginSizeInput.value;
  marginSizeValueInput.hidden = true;
  marginSizeValueLabel.hidden = false;
}

function updateExportWidthPlaceholder() {
  const maxWidth = getMaxNaturalWidth();
  exportWidthInput.placeholder = maxWidth > 0 ? String(maxWidth) : '';
  updateExportWidthReference();
}

function updateExportWidthReference() {
  const state = getState();
  const maxWidth = getMaxNaturalWidth();
  const hasCustom = exportWidthInput.value.trim() !== '' && state.exportWidth.custom !== null;

  if (hasCustom && maxWidth > 0) {
    exportWidthReference.textContent = `（最宽图片宽度: ${maxWidth}px）`;
    exportWidthReference.hidden = false;
  } else {
    exportWidthReference.textContent = '';
    exportWidthReference.hidden = true;
  }
}

function updateQualityVisibility() {
  qualityRow.hidden = getState().exportFormat.type === 'image/png';
}
