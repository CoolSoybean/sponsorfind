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
console.log(`Verified ${records.size} records: every index entry matches its shard.`);
