/** Same-machine Node renderer comparison. Does not measure browser/mobile or image-cache hits.
 * node scripts/benchmark-directed-streams.mjs <before.mjs> <proof-folder> <out.json> [extra-copy-case-ids]
 * The proof folder must be generated from final source with proof-directed-streams.mjs.
 */
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';
const [baseline,folder,output,extraCopies='']=process.argv.slice(2);if(!output)throw Error('Pass baseline module, proof folder, output JSON.');
const old=await import(pathToFileURL(path.resolve(baseline)).href),current=await import(pathToFileURL(path.resolve(folder,'renderer.mjs')).href);
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
const cases=manifest.entries.map(e=>({id:e.id,ap:e.appearance}));
for(const id of new Set(['agua','gelo','raio','metal','agua-gelo','raio-metal','agua-gelo-fogo',...extraCopies.split(',').filter(Boolean)])){
 const ap=structuredClone(manifest.entries.find(e=>e.id===id).appearance);ap.beings[0].intentCount='6';cases.push({id:id+'-six-copies',ap});
}
const summary=a=>{const v=[...a].sort((a,b)=>a-b);return {median:v[Math.floor(v.length*.5)],p95:v[Math.ceil(v.length*.95)-1],max:v.at(-1),samples:v.length};};
const results=[];
for(const c of cases){
 const times={before:[],after:[]},initial={};
 for(const [name,m]of[['before',old],['after',current]]){
  const start=performance.now();for(let f=0;f<8;f++)m.renderPixelScene(c.ap,true,f);initial[name]=performance.now()-start;
 }
 // Alternating renderer order reduces drift; each sample generates a raster frame without the image cache,
 // while internal geometry caches are warm after the first complete cycle.
 for(let cycle=0;cycle<8;cycle++)for(const name of cycle%2?['after','before']:['before','after']){
  const m=name==='before'?old:current;
  for(let f=0;f<8;f++){const start=performance.now();m.renderPixelScene(c.ap,true,f);times[name].push(performance.now()-start);}
 }
 results.push({id:c.id,initialEightFrameCycleMs:initial,before:summary(times.before),after:summary(times.after)});
}
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
fs.writeFileSync(output,JSON.stringify({runtime:process.version,platform:process.platform,arch:process.arch,baselineHash:hash(baseline),currentHash:hash(path.join(folder,'renderer.mjs')),environment:'Node renderer, same machine, sequential, image cache bypassed; geometry caches warm for measured frames',browserCpu4x:false,mobile:false,results},null,2));
console.log(JSON.stringify(results.map(r=>({id:r.id,before:r.before.median.toFixed(2),after:r.after.median.toFixed(2),beforeP95:r.before.p95.toFixed(2),afterP95:r.after.p95.toFixed(2)})),null,2));
