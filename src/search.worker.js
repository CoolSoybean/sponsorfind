import { search } from './search.js';
let rows = [];
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const response = await fetch(data.url);
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw Error('搜索数据加载失败');
      const packed = await response.json();
      if (packed.format !== 1) throw Error('数据版本不兼容，请刷新网页');
      const d = packed.dictionaries;
      rows = packed.rows.map(r => ({id:r[0],name:r[1],town:d.town[r[2]],county:d.county[r[3]],route:d.route[r[4]],rating:d.rating[r[5]],shard:d.shard[r[6]]}));
      const options = {};
      for (const key of ['town','county','route','rating']) options[key] = [...new Set(rows.map(r => r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      self.postMessage({type:'ready', options});
    } else {
      const result = search(rows, data.filters);
      const pages = Math.max(1,Math.ceil(result.length/20));
      const page = Math.min(data.page,pages);
      self.postMessage({type:'results',id:data.id,total:result.length,page,pages,rows:result.slice((page-1)*20,page*20)});
    }
  } catch(error) { self.postMessage({type:'error',message:error.message}); }
};
