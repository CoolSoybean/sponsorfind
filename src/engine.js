import {search, normalize} from './search.js';

export function createEngine(fetcher = fetch) {
  let manifest, bootstrap, fullIndex;
  const cache = new Map();
  async function read(url, compressed) {
    const useGzip = compressed && typeof DecompressionStream !== 'undefined';
    const response = await fetcher(useGzip ? compressed : url);
    if (!response.ok) throw Error('查询数据加载失败，请重试');
    if (useGzip) return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    return response.json();
  }
  function cached(key, loader) {
    if (!cache.has(key)) cache.set(key, loader().catch(error => {cache.delete(key); throw error;}));
    return cache.get(key);
  }
  function prepared(rows) { return rows.map(r => ({...r, searchName:normalize(r.name)})); }
  function visible(rows) { return rows.map(({searchName,...row}) => row); }
  function paginate(rows,page) {
    const pages=Math.max(1,Math.ceil(rows.length/20));
    page=Math.max(1,Math.min(page,pages));
    return {total:rows.length,page,pages,rows:visible(rows.slice((page-1)*20,page*20))};
  }
  return {
    async init(value) {
      manifest=value;
      bootstrap=await read(manifest.bootstrap);
      return bootstrap.options;
    },
    async query(filters,page=1) {
      if (!manifest || !bootstrap) throw Error('名录尚未就绪');
      if (!Object.values(filters).some(Boolean)) {
        const pages=Math.max(1,Math.ceil(manifest.count/20));
        page=Math.max(1,Math.min(page,pages));
        if(page===1)return {total:manifest.count,page,pages,rows:bootstrap.rows};
        const offset=(page-1)*20,chunk=Math.floor(offset/200);
        const rows=await cached(`browse-${chunk}`,()=>read(`${manifest.browse}${chunk}.json`));
        return {total:manifest.count,page,pages,rows:rows.slice(offset%200,offset%200+20)};
      }
      let rows;
      if (filters.letter) {
        const info=manifest.shards[filters.letter];
        if(!info)return paginate([],1);
        rows=await cached(`letter-${filters.letter}`,async()=>prepared(await read(info.url,info.gzip)));
      } else {
        rows=await cached('global',async()=>{
          const packed=await read(manifest.index,manifest.index_gzip);
          if(packed.format!==1)throw Error('数据版本不兼容，请刷新网页');
          const d=packed.dictionaries;
          fullIndex=prepared(packed.rows.map(r=>({id:r[0],name:r[1],town:d.town[r[2]],county:d.county[r[3]],route:d.route[r[4]],rating:d.rating[r[5]],shard:d.shard[r[6]]})));
          return fullIndex;
        });
      }
      return paginate(search(rows,filters),page);
    }
  };
}
