const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/[^\"]+\.(?:js|css|webmanifest)(?:\?[^\"]+)?)"/g)].map(m=>m[1]);
assert.ok(assets.length>5);
for(const url of assets){assert.ok(url.endsWith('?v=11'),'must version '+url);assert.ok(sw.includes("'"+url+"'"),'precache must include '+url)}
assert.ok(sw.includes("cache:'no-cache'"),'worker must revalidate browser HTTP cache');
assert.ok(sw.includes('raja-shell-v11'));
console.log('PASS versioned scripts/styles/manifest, matching precache, HTTP-cache revalidation');
