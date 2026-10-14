const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/[^\"]+\.(?:js|css|webmanifest)(?:\?[^\"]+)?)"/g)].map(m=>m[1]);
assert.ok(assets.length>5);
for(const url of assets){assert.ok(url.endsWith('?v=20'),'must version '+url);assert.ok(sw.includes("'"+url+"'"),'precache must include '+url)}
assert.ok(sw.includes("cache:'no-cache'"),'worker must revalidate browser HTTP cache');
assert.ok(sw.includes('raja-shell-v20'));
console.log('PASS versioned scripts/styles/manifest, matching precache, HTTP-cache revalidation');
const path=require('node:path');
const logo=fs.readFileSync(path.join(__dirname,'../assets/raja-logo.jpeg'));
const encoded=logo.toString('base64');
assert.ok(fs.readFileSync(path.join(__dirname,'../icon.svg'),'utf8').includes('data:image/jpeg;base64,'+encoded));
assert.ok(html.includes('class="raja-logo" src="/assets/raja-logo.jpeg?v=20"'));
assert.ok(JSON.parse(fs.readFileSync(path.join(__dirname,'../manifest.webmanifest'),'utf8')).icons.every(icon=>icon.src.includes('?v=20')));
console.log('PASS supplied logo used by header, embedded favicon and app manifest');
