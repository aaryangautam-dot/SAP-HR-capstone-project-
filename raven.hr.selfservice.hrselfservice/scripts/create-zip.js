const fs = require('fs');
const path = require('path');
const z = require('zip-stream');
const ZipStream = z.default || z;

async function zipDir(sourceDir, outZipPath) {
  // Collect all files first
  const fileList = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name.endsWith('.zip')) continue;
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.isFile()) {
        const rel = path.relative(sourceDir, full).replace(/\\/g, '/');
        fileList.push({ full, rel });
      }
    }
  }
  scan(sourceDir);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    const zip = new ZipStream();

    output.on('close', () => {
      const size = fs.statSync(outZipPath).size;
      console.log(`Successfully created ${outZipPath} (${size} bytes, ${fileList.length} files)`);
      resolve();
    });
    output.on('error', reject);
    zip.on('error', reject);
    zip.pipe(output);

    let idx = 0;
    function next() {
      if (idx >= fileList.length) {
        zip.finish();
        return;
      }
      const item = fileList[idx++];
      const fileData = fs.readFileSync(item.full);
      zip.entry(fileData, { name: item.rel }, (err) => {
        if (err) return reject(err);
        next();
      });
    }
    next();
  });
}

(async () => {
  const [sourceDir, outZipPath] = process.argv.slice(2);
  if (!sourceDir || !outZipPath) {
    console.error('Usage: node create-zip.js <sourceDir> <outZipPath>');
    process.exit(1);
  }
  try {
    await zipDir(path.resolve(sourceDir), path.resolve(outZipPath));
  } catch (err) {
    console.error('Zipping error:', err);
    process.exit(1);
  }
})();
