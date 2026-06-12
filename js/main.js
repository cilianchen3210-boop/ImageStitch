import { getState, onChange } from './state.js';
import { initUpload } from './upload.js';
import { initControls } from './controls.js';
import { initExport } from './export.js';
import { render, scheduleRender } from './render.js';

initUpload();
initControls();
initExport();

onChange((state) => scheduleRender(state));

render(getState());
