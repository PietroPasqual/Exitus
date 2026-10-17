/** Engine-derived fusion controls; no handwritten Being or fusion groups.
 * Run: node scripts/proof-confirmed-fusion.mjs <output-folder>
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(process.argv[2] ?? '/tmp/confirmed-fusion-proof');
fs.mkdirSync(dir, { recursive: true });
const q=await build({stdin:{contents:`export{model,node,prism,cable}from'${root}/tests/helpers.ts';export{analyzeFlow}from'${root}/src/core/flow.ts';export{checkLigacao}from'${root}/src/core/structural.ts';export{describeAppearance,describeBeing}from'${root}/src/core/appearance.ts';export{narrate}from'${root}/src/core/spellsheet.ts';export{renderPixelScene}from'${root}/src/ui/pixel-scene.ts';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false});fs.writeFileSync(dir+'/renderer.mjs',q.outputFiles[0].text);const m=await import('data:text/javascript;base64,'+Buffer.from(q.outputFiles[0].text).toString('base64'));
function circuit(groups){const first={...m.prism(groups[0][0]),...(groups[0].length>1?{inner:groups[0].slice(1)}:{})};const nodes=[first,...groups.slice(1).map((g,i)=>({...m.node('n'+i,g[0]==='mod_ligacao'?'hexagon':'circle',Math.cos(i/(groups.length-1)*Math.PI*2)*170,Math.sin(i/(groups.length-1)*Math.PI*2)*170,g[0]),...(g.length>1?{inner:g.slice(1)}:{})}))];return m.model(nodes,nodes.map((n,i)=>m.cable(n.id,nodes[(i+1)%nodes.length].id)));}
const cases=[
{title:'Mesmo selo: ligados, sem fusao',groups:[['fogo','raio'],['forma_esfera'],['forma_cubo'],['mod_ligacao']]},
{title:'Selos distintos: Fogo + Raio fundidos',groups:[['fogo'],['raio'],['forma_esfera'],['forma_cubo'],['mod_ligacao']]},
{title:'Fusao parcial: Fogo/Raio; Agua separada',groups:[['fogo'],['raio'],['agua'],['forma_esfera'],['forma_cubo'],['mod_ligacao']]},
{title:'Duas familias: Fogo/Raio e Agua/Gelo',groups:[['fogo'],['raio'],['agua'],['gelo'],['forma_esfera'],['forma_cubo'],['mod_ligacao']]},
{title:'So Agua/Gelo; Fogo/Raio no mesmo selo',groups:[['fogo','raio'],['agua'],['gelo'],['forma_esfera'],['forma_cubo'],['mod_ligacao']]},
{title:'Apoio de Vida: Fogo/Raio confirmados',groups:[['fogo','raio'],['vida'],['forma_esfera'],['forma_cubo'],['mod_ligacao']]}
];const records=[];for(let i=0;i<cases.length;i++){const c=cases[i],model=circuit(c.groups),flow=m.analyzeFlow(model),ap=m.describeAppearance(model,flow),links=m.checkLigacao(model,flow);for(const night of[false,true])for(let frame=0;frame<8;frame++)fs.writeFileSync(`${dir}/${i}-${night}-${frame}.rgba`,m.renderPixelScene(ap,night,frame).pix.data);records.push({...c,model,links,appearance:ap,description:ap.beings.map(b=>m.describeBeing(b,ap.orbitCount)),narration:ap.beings.map(b=>m.narrate(b,ap.orbitCount))});}
fs.writeFileSync(dir+'/cases.json',JSON.stringify(records,null,2));console.log(JSON.stringify(records.map(({title,links,appearance,narration})=>({title,links,groups:appearance.beings.map(b=>b.materialFusion??[]),narration})),null,2));

const composed = spawnSync('python', [path.join(root, 'scripts/compose-confirmed-fusion.py'), dir], { stdio: 'inherit' });
if (composed.status) process.exit(composed.status);
