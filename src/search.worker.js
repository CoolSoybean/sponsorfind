import {createEngine} from './engine.js';
const engine=createEngine();
self.onmessage=async ({data})=>{
  try {
    if(data.type==='init')self.postMessage({type:'ready',options:await engine.init(data.manifest)});
    else self.postMessage({type:'results',id:data.id,...await engine.query(data.filters,data.page)});
  } catch(error) {self.postMessage({type:'error',id:data.id,message:error.message});}
};
