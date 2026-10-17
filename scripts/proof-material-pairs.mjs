/** Actual native production gallery. Diagonal=pure; rows=primary; columns=secondary.
 * All fixtures are coexistence (no Ligação/fusion), so this does not invent rule outcomes.
 * Run: node scripts/proof-material-pairs.mjs [output-folder]
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]??'/tmp/material-pair-proof');fs.mkdirSync(out,{recursive:true});
const sourceHashes={};
const result=await build({stdin:{contents:`export {renderPixelScene} from './src/ui/pixel-scene';export {BODY_MATERIALS} from './src/ui/pixel-mixture-signatures';export {usesAllocatedMixture} from './src/ui/pixel-material-interaction';export {spellSpriteOf} from './src/ui/pixel-spell-sprites';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'provenance',setup(build){build.onLoad({filter:/\.ts$/},args=>{const contents=fs.readFileSync(args.path,'utf8');sourceHashes[path.relative(root,args.path)]=createHash('sha256').update(contents).digest('hex');return{contents,loader:'ts'};});}}]});
const m=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const rows=[];
for(let i=0;i<m.BODY_MATERIALS.length;i++)for(let j=0;j<m.BODY_MATERIALS.length;j++){
 const a=m.BODY_MATERIALS[i],b=m.BODY_MATERIALS[j],elements=i===j?[a]:[a,b];
 const body={elements,shapes:['forma_esfera'],concepts:[],placement:'front',projectile:false,orbit:false,direction:null,guards:[],estado:false,linked:false,merged:false,bond:null,closed:false,materialFusion:[]};
 const sprite=m.spellSpriteOf(body),form=sprite?.endsWith('-sphere')?'esfera':undefined;
 rows.push({i,j,primary:a,secondary:i===j?null:b,sprite:sprite??'generic',path:i===j?'pure':m.usesAllocatedMixture(elements,form,'forma_esfera')?'allocated-signatures':'authored-adapter'});
 for(const night of[false,true])fs.writeFileSync(path.join(out,`${i}-${j}-${night}.rgba`),m.renderPixelScene({beings:[body],orbitCount:0},night,0).pix.data);
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({description:'Actual production frame0, 240 ordered mixtures plus16pure controls, both themes. Not eight-frame coverage or engine-derived fusion fixtures.',elements:m.BODY_MATERIALS,rows,sourceHashes},null,2));
const p=spawnSync('python',[path.join(root,'scripts/compose-material-pairs.py'),out],{stdio:'inherit'});if(p.status)process.exit(p.status);
console.log(JSON.stringify({out,mixtures:240,pureControls:16,captures:512}));
