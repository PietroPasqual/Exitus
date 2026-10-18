/** Real ex2 material substitutions, with a frozen comparison renderer.
 * node scripts/proof-directed-streams.mjs <baseline-renderer.mjs> <output-folder>
 *   [baseline-commit] [baseline-label] [focus-ids] [current-label]
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Pass the frozen comparison renderer.');
const baseline=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]??'/tmp/directed-stream-proof');
const baselineCommit=process.argv[4]??'88fc8789b8b32690eb50db22229a0b6f331bf372';
const baselineLabel=process.argv[5]??'PUBLICADO',currentLabel=process.argv[7]??'JATO DO MATERIAL';
const focus=(process.argv[6]??'agua,gelo,terra,raio').split(',');
fs.mkdirSync(out,{recursive:true});
const contents=`export {modelOf} from './tests/helpers';export {analyzeCircuit} from './src/core/analysis';export {describeAppearance,describeBeing} from './src/core/appearance';export {narrate} from './src/core/spellsheet';export {renderPixelScene} from './src/ui/pixel-scene';export {BODY_MATERIALS} from './src/ui/pixel-mixture-signatures';export {RUNES} from './src/data/runes';`;
const q=await build({stdin:{contents,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false});
fs.writeFileSync(path.join(out,'renderer.mjs'),q.outputFiles[0].text);
const current=await import(pathToFileURL(path.join(out,'renderer.mjs')).href+'?'+Date.now()),old=await import(pathToFileURL(baseline).href);
const cases=current.BODY_MATERIALS.map(material=>({id:material,elements:[material]}));
for(const elements of [['agua','gelo'],['gelo','agua'],['raio','metal'],['metal','raio'],['agua','gelo','fogo']])cases.push({id:elements.join('-'),elements});
const entries=[];
for(const c of cases){
 const model=current.modelOf('ex2');let i=0;
 model.nodes.forEach(n=>{if(n.rune==='fogo')n.rune=c.elements[Math.min(i++,c.elements.length-1)];});
 if(c.elements.length===3)model.nodes.find(n=>n.id==='n_top').inner=[c.elements[2]];
 const analysis=current.analyzeCircuit(model,{specMode:'simultaneous',missingMat:false});
 const ap=current.describeAppearance(model,analysis.flow);
 const entry={...c,label:c.elements.map(e=>current.RUNES[e].name.split(' (')[0].split(' /')[0]).join(' + '),model,appearance:ap,description:ap.beings.map(b=>current.narrate(b,ap.orbitCount))};
 if(JSON.stringify(ap.beings[0]?.elements)!==JSON.stringify(c.elements))throw Error('Material fixture mismatch: '+c.id+' '+JSON.stringify(ap));
 entries.push(entry);
 for(const night of [false,true])for(let frame=0;frame<8;frame++)for(const [version,renderer] of [['before',old],['after',current]]){
  const data=renderer.renderPixelScene(ap,night,frame).pix.data;
  fs.writeFileSync(path.join(out,`${c.id}-${night?'night':'day'}-${version}-${frame}.rgba`),data);
 }
}
const hash=x=>createHash('sha256').update(x).digest('hex');
const sources=['src/ui/pixel-material-stream.ts','src/ui/pixel-mixed-stream.ts','src/ui/pixel-scene.ts','src/ui/pixel-scene-layout.ts','src/core/spell-narrative-semantics.ts','src/core/appearance.ts','src/core/spellsheet.ts'];
const sourceHashes=Object.fromEntries(sources.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({baselineCommit,baselineLabel,currentLabel,focus,baselineHash:hash(fs.readFileSync(baseline)),currentHash:hash(q.outputFiles[0].text),sourceHashes,productionIntegrated:true,width:180,height:105,frames:8,frameDurationsMs:[120,130,120,130,120,130,120,130],entries},null,2));
const p=spawnSync('python',[path.join(root,'scripts/compose-directed-streams.py'),out],{stdio:'inherit'});if(p.status)process.exit(p.status);
console.log(out);
