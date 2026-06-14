import {
  getState,
  onChange,
  setMarginSize,
  setMarginColor,
  setOuterBorder,
  setStitchMode,
  setExportWidthCustom,
  setExportFormat,
  setExportQuality,
  getMaxNaturalCrossSize,
} from './state.js';
import { hexToHsl, hslToHex, normalizeHex } from './utils.js';

const marginSizeInput = document.getElementById('marginSizeInput');
const marginSizeValueLabel = document.getElementById('marginSizeValueLabel');
const marginSizeValueInput = document.getElementById('marginSizeValueInput');
const marginColorInput = document.getElementById('marginColorInput');
const marginColorHexInput = document.getElementById('marginColorHexInput');
const hslToggleInput = document.getElementById('hslToggleInput');
const marginHslControls = document.getElementById('marginHslControls');
const marginHueInput = document.getElementById('marginHueInput');
const marginSatInput = document.getElementById('marginSatInput');
const marginLightInput = document.getElementById('marginLightInput');
const marginHueValue = document.getElementById('marginHueValue');
const marginSatValue = document.getElementById('marginSatValue');
const marginLightValue = document.getElementById('marginLightValue');
const outerBorderInput = document.getElementById('outerBorderInput');
const stitchModeVerticalInput = document.getElementById('stitchModeVertical');
const stitchModeHorizontalInput = document.getElementById('stitchModeHorizontal');
const exportSizeLabelText = document.getElementById('exportSizeLabelText');
const exportWidthInput = document.getElementById('exportWidthInput');
const exportWidthReference = document.getElementById('exportWidthReference');
const exportFormatSelect = document.getElementById('exportFormatSelect');
const qualityRow = document.getElementById('qualityRow');
const exportQualityInput = document.getElementById('exportQualityInput');
const qualityValueLabel = document.getElementById('qualityValueLabel');
const previewRegion = document.getElementById('previewRegion');
const previewThemeToggle = document.getElementById('previewThemeToggle');
const miniPreviewGroup = document.querySelector('.mini-preview-group');

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
    applyMarginColor(marginColorInput.value, marginColorInput);
  });

  marginColorHexInput.addEventListener('input', () => {
    const hex = normalizeHex(marginColorHexInput.value);
    if (hex) applyMarginColor(hex, marginColorHexInput);
  });

  marginColorHexInput.addEventListener('blur', () => {
    marginColorHexInput.value = getState().margin.color;
  });

  marginColorHexInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') marginColorHexInput.blur();
  });

  hslToggleInput.addEventListener('change', () => {
    marginHslControls.hidden = !hslToggleInput.checked;
  });

  [marginHueInput, marginSatInput, marginLightInput].forEach((input) => {
    input.addEventListener('input', () => {
      const h = Number(marginHueInput.value);
      const s = Number(marginSatInput.value);
      const l = Number(marginLightInput.value);
      marginHueValue.textContent = String(h);
      marginSatValue.textContent = `${s}%`;
      marginLightValue.textContent = `${l}%`;
      applyMarginColor(hslToHex(h, s, l), 'hsl');
    });
  });

  previewThemeToggle.addEventListener('change', () => {
    const isDark = previewThemeToggle.checked;
    previewRegion.classList.toggle('dark-preview', isDark);
    miniPreviewGroup.classList.toggle('dark-preview', isDark);
  });

  outerBorderInput.addEventListener('change', () => {
    setOuterBorder(outerBorderInput.checked);
  });

  [stitchModeVerticalInput, stitchModeHorizontalInput].forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      setStitchMode(input.value);
      updateExportSizeLabel();
      updateExportWidthPlaceholder();
    });
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

  applyMarginColor(getState().margin.color, null);
  updateExportSizeLabel();
  updateExportWidthPlaceholder();
  updateQualityVisibility();
}

function updateExportSizeLabel() {
  const horizontal = getState().stitchMode === 'horizontal';
  exportSizeLabelText.textContent = horizontal ? '导出长度 (px)' : '导出宽度 (px)';
}

function applyMarginColor(hex, skip) {
  setMarginColor(hex);

  if (skip !== marginColorInput) marginColorInput.value = hex;
  if (skip !== marginColorHexInput) marginColorHexInput.value = hex;

  if (skip !== 'hsl') {
    const { h, s, l } = hexToHsl(hex);
    marginHueInput.value = String(h);
    marginSatInput.value = String(s);
    marginLightInput.value = String(l);
    marginHueValue.textContent = String(h);
    marginSatValue.textContent = `${s}%`;
    marginLightValue.textContent = `${l}%`;
  }
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
  const maxSize = getMaxNaturalCrossSize();
  exportWidthInput.placeholder = maxSize > 0 ? String(maxSize) : '';
  updateExportWidthReference();
}

function updateExportWidthReference() {
  const state = getState();
  const maxSize = getMaxNaturalCrossSize();
  const hasCustom = exportWidthInput.value.trim() !== '' && state.exportWidth.custom !== null;
  const horizontal = state.stitchMode === 'horizontal';

  if (hasCustom && maxSize > 0) {
    exportWidthReference.textContent = horizontal
      ? `（最高图片高度: ${maxSize}px）`
      : `（最宽图片宽度: ${maxSize}px）`;
    exportWidthReference.hidden = false;
  } else {
    exportWidthReference.textContent = '';
    exportWidthReference.hidden = true;
  }
}

function updateQualityVisibility() {
  qualityRow.hidden = getState().exportFormat.type === 'image/png';
}
