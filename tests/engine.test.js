import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createEngine} from '../src/engine.js';
const root=resolve('public');
const manifest=JSON.parse(readFileSync(resolve(root,'data/manifest.json'),'utf8'));
function harness(){const requests=[];return {requests,engine:createEngine(async url=>{requests.push(url);return new Response(readFileSync(resolve(root,'.'+url)));})};}
test('initial results do not download full index or letter shards',async()=>{const {engine,requests}=harness();await engine.init(manifest);const r=await engine.query({},1);assert.equal(r.rows.length,20);assert.equal(r.total,manifest.count);assert.deepEqual(requests,[manifest.bootstrap]);});
test('unfiltered pagination fetches only one small browse chunk',async()=>{const {engine,requests}=harness();await engine.init(manifest);const r=await engine.query({},11);assert.equal(r.rows.length,20);assert.equal(requests.length,2);assert.equal(requests[1],manifest.browse+'1.json');});
test('letter browsing avoids full index and reuses its download',async()=>{const {engine,requests}=harness();await engine.init(manifest);const r=await engine.query({letter:'b'},1);assert(r.rows.every(x=>x.shard==='b'));await engine.query({letter:'b'},2);assert.equal(requests.length,2);assert.equal(requests[1],manifest.shards.b.gzip);});
test('global keyword search uses compressed full index only on demand',async()=>{const {engine,requests}=harness();await engine.init(manifest);const r=await engine.query({q:'the'},1);assert(r.total>0);assert(r.rows.every(x=>x.name.toLowerCase().includes('the')));assert.equal(requests[1],manifest.index_gzip);await engine.query({q:'london'},1);assert.equal(requests.length,2);});
test('failed fetch can retry',async()=>{let failures=0;const engine=createEngine(async url=>{if(url===manifest.index_gzip&&failures++===0)return new Response('',{status:503});return new Response(readFileSync(resolve(root,'.'+url)));});await engine.init(manifest);await assert.rejects(engine.query({q:'the'}));assert((await engine.query({q:'the'})).total>0);});
