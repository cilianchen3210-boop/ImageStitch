import { getState, onChange } from './state.js';
import { initUpload } from './upload.js';
import { initControls } from './controls.js';
import { initExport } from './export.js';
import { initEditor } from './editor.js';
import { render, scheduleRender } from './render.js';

initUpload();
initControls();
initExport();
initEditor();

onChange((state) => scheduleRender(state));

render(getState());
