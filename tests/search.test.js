import {test} from 'node:test';
import assert from 'node:assert/strict';
import {search} from '../src/search.js';
const rows=[{name:'The Barclays Example',shard:'t',town:'London',route:'Skilled Worker',rating:'Worker (A rating)'},{name:'The Barclays Example',shard:'t',town:'London',route:'Creative Worker',rating:'Temporary Worker (A rating)'}];
test('global substring search crosses first-letter partitions',()=>assert.equal(search(rows,{q:'BARCLAYS'}).length,2));
test('route and rating belong to the same record',()=>assert.equal(search(rows,{route:'Skilled Worker',rating:'Temporary Worker (A rating)'}).length,0));
test('letter and location filters intersect',()=>assert.equal(search(rows,{letter:'b',town:'London'}).length,0));
test('Unicode and whitespace normalization',()=>assert.equal(search(rows,{q:' ＢＡＲＣＬＡＹＳ   example '}).length,2));
