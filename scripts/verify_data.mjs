import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('public');
const manifest=JSON.parse(readFileSync(resolve(root,'data/manifest.json'),'utf8'));
const index=JSON.parse(readFileSync(resolve(root,'.'+manifest.index),'utf8'));
assert.equal(index.format,1);
assert.equal(index.rows.length,manifest.count);
const records=new Map();
for(const [shard,info] of Object.entries(manifest.shards)){
 const rows=JSON.parse(readFileSync(resolve(root,'.'+info.url),'utf8'));
 assert.equal(rows.length,info.count);
 for(const row of rows){assert.equal(row.shard,shard);assert(!records.has(row.id));records.set(row.id,row);}
}
assert.equal(records.size,manifest.count);
for(const packed of index.rows){
 const row=records.get(packed[0]);assert(row);assert.equal(row.name,packed[1]);
 ['town','county','route','rating','shard'].forEach((key,i)=>assert.equal(row[key],index.dictionaries[key][packed[i+2]]));
}
const bootstrap=JSON.parse(readFileSync(resolve(root,'.'+manifest.bootstrap),'utf8'));
assert.deepEqual(bootstrap.rows.map(r=>r.id),index.rows.slice(0,20).map(r=>r[0]));
let browseCount=0;
for(let start=0;start<manifest.count;start+=200){
 const chunk=JSON.parse(readFileSync(resolve(root,'.'+manifest.browse+Math.floor(start/200)+'.json'),'utf8'));
 assert.deepEqual(chunk.map(r=>r.id),index.rows.slice(start,start+200).map(r=>r[0]));
 for(const row of chunk)assert.deepEqual(row,records.get(row.id));
 browseCount+=chunk.length;
}
assert.equal(browseCount,manifest.count);
console.log(`Verified ${records.size} records: every index entry matches its shard.`);
