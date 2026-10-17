/** Compare real production rendering against a frozen baseline renderer module.
 * node scripts/benchmark-expanded-pairs.mjs <baseline.mjs> <output-folder>
 * No PNG encoding, UI frame cache, browser, CPU throttling or mobile inference.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2]) throw Error('Pass a frozen baseline module exporting renderPixelScene.');
const out=path.resolve(process.argv[3]??'/tmp/material-mixture-benchmark');fs.mkdirSync(out,{recursive:true});
const baseline=path.resolve(process.argv[2]),current=path.join(out,'current-renderer.mjs');
await build({entryPoints:[path.join(root,'src/ui/pixel-scene.ts')],bundle:true,platform:'node',format:'esm',outfile:current});
const mods={before:await import(pathToFileURL(baseline).href),after:await import(pathToFileURL(current).href)};
const being=(elements,extra={})=>({elements,shapes:['forma_esfera'],concepts:[],placement:'front',projectile:false,orbit:false,direction:null,guards:[],estado:false,linked:false,merged:false,bond:null,closed:false,materialFusion:[],...extra});
const ap=b=>({beings:[b],orbitCount:0});
const all=['fogo','terra','agua','vento','raio','metal','gelo','som','natureza','acido','ilusao','luz','sombra','materia','gravidade','espaco'];
const cases=[
 ['pure fire',ap(being(['fogo']))],['accepted water ice',ap(being(['agua','gelo']))],
 ['water fire pair',ap(being(['agua','fogo']))],['shadow metal pair',ap(being(['sombra','metal']))],
 ['water metal ice',ap(being(['agua','metal','gelo']))],
 ['water dragon triple',ap(being(['agua','gelo','fogo'],{intentForm:'dragao'}))],
 ['6 mixed dragons',ap(being(['agua','gelo','fogo'],{intentForm:'dragao',intentCount:'6'}))],
 ['8 mixed orbiters',{beings:Array.from({length:8},()=>being(['agua','metal','gelo'],{orbit:true})),orbitCount:8}],
 ['8 constituent hero',ap(being(all.slice(0,8)))],['16 constituent hero',ap(being(all))],
 ['maintained fire jet',ap(being(['fogo'],{shapes:[],direction:'forward',estado:true}))],
 ['four-material generic dragon',ap(being(['agua','metal','gelo','fogo'],{intentForm:'dragao'}))],
 ['6 four-material dragons',ap(being(['agua','metal','gelo','fogo'],{intentForm:'dragao',intentCount:'6'}))],
 ['water dragon with Life',ap(being(['agua'],{intentForm:'dragao',concepts:['vida']}))],
 ['sphere with four concepts',ap(being(['agua'],{concepts:['tempo','pressao','vida','infinito']}))],
 ['dragon with four concepts',ap(being(['agua'],{intentForm:'dragao',concepts:['tempo','pressao','vida','infinito']}))],
 ['8 concepts on one mixture',ap(being(['gravidade','espaco'],{concepts:['tempo','movimento','pressao','caos','infinito','vazio','vida','morte']}))],
 ['authored metal fire',ap(being(['metal','fogo']))],['authored fire metal',ap(being(['fogo','metal']))],
 ['authored ice water',ap(being(['gelo','agua']))],['authored shadow ice',ap(being(['sombra','gelo']))],['authored ice shadow',ap(being(['gelo','sombra']))],
 ['8 authored water ice orbiters',{beings:Array.from({length:8},()=>being(['agua','gelo'],{orbit:true})),orbitCount:8}],
 ['6 authored metal fire copies',ap(being(['metal','fogo'],{intentCount:'6'}))],
 ['8 orbiters with four concepts',{beings:Array.from({length:8},()=>being(['agua'],{orbit:true,concepts:['tempo','pressao','vida','infinito']})),orbitCount:8}],
 ['8 orbiters with eight concepts',{beings:Array.from({length:8},()=>being(['agua'],{orbit:true,concepts:['tempo','movimento','pressao','caos','infinito','vazio','vida','morte']})),orbitCount:8}]
];
const newPairs=[['raio','metal'],['metal','raio'],['agua','metal'],['metal','agua'],['fogo','terra'],['terra','fogo']];
for(const elements of newPairs)cases.push([`new hero ${elements.join('/')}`,ap(being(elements))]);
for(const elements of [['raio','metal'],['metal','agua'],['terra','fogo']]){
 cases.push([`new six copies ${elements.join('/')}`,ap(being(elements,{intentCount:'6'}))]);
 cases.push([`new eight orbiters ${elements.join('/')}`,{beings:Array.from({length:8},()=>being(elements,{orbit:true})),orbitCount:8}]);
}
cases.push(['new lightning metal with eight concepts',ap(being(['raio','metal'],{concepts:['tempo','movimento','pressao','caos','infinito','vazio','vida','morte']}))]);
cases.push(['new eight mixed pair orbiters with four concepts',{beings:Array.from({length:8},(_,i)=>being(newPairs[i%newPairs.length],{orbit:true,concepts:['tempo','pressao','vida','infinito']})),orbitCount:8}]);
const fresh=()=>Object.fromEntries(cases.map(([name])=>[name,[]]));
const firstCycle={before:fresh(),after:fresh()},samples={before:fresh(),after:fresh()};
const render=(key,name,scene,frame,target)=>{const t=performance.now();mods[key].renderPixelScene(scene,true,frame);target[key][name].push(performance.now()-t);};
for(const key of ['before','after'])for(const[name,scene]of cases)for(let f=0;f<8;f++)render(key,name,scene,f,firstCycle);
// Explicit JIT warmup; geometric/frame cache churn remains representative.
for(let round=0;round<2;round++)for(const key of round%2?['after','before']:['before','after'])for(const[,scene]of cases)for(let f=0;f<8;f++)mods[key].renderPixelScene(scene,true,f);
for(let round=0;round<6;round++)for(const[name,scene]of cases)for(const key of round%2?['after','before']:['before','after'])for(let f=0;f<8;f++)render(key,name,scene,f,samples);
const stats=xs=>{const a=[...xs].sort((a,b)=>a-b);return{n:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)}};
const summarize=data=>Object.fromEntries(Object.keys(data).map(k=>[k,{overall:stats(Object.values(data[k]).flat()),cases:Object.fromEntries(Object.entries(data[k]).map(([name,values])=>[name,stats(values)]))}]));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const result={method:`Same-process Node production renderPixelScene; first cycle separate, two JIT warmup rounds, six measured rounds with alternating version order per case. ${cases.length} scenes ×8frames ×6=${cases.length*48}samples/version. UI image cache bypassed. No browser/CPU4x/mobile claim.`,baselineHash:hash(baseline),currentHash:hash(current),firstCycle:summarize(firstCycle),warmed:summarize(samples),raw:{firstCycle,samples}};
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({firstCycle:result.firstCycle,warmed:result.warmed},null,2));
