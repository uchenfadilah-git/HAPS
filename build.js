const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js']) {
  fs.copyFileSync(path.join(__dirname, file), path.join(outDir, file));
}

console.log('Static dashboard copied to public/');
