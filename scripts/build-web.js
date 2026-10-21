// 把纯静态网页文件复制到 www/，供 Capacitor 打包
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

function copy(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dest, name));
  } else {
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'style.css', 'js']) {
  copy(path.join(root, item), path.join(out, item));
}
