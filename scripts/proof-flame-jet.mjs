/** Real Lança-Chamas preset, engine-derived appearance, frozen baseline comparison.
 * node scripts/proof-flame-jet.mjs <baseline-renderer.mjs> <output-folder>
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Pass a frozen baseline module exporting renderPixelScene.');
const baseline=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]??'/tmp/flame-jet-proof');fs.mkdirSync(out,{recursive:true});
const q=await build({stdin:{contents:`export {modelOf} from './tests/helpers';export {analyzeFlow} from './src/core/flow';export {describeAppearance} from './src/core/appearance';export {renderPixelScene} from './src/ui/pixel-scene';`,resolveDir:root},bundle:true,platform:'node',format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(q.outputFiles[0].text).toString('base64'));
const old=await import(pathToFileURL(baseline).href),model=m.modelOf('ex2'),ap=m.describeAppearance(model,m.analyzeFlow(model));
for(let f=0;f<8;f++)for(const [name,renderer] of [['before',old],['after',m]])fs.writeFileSync(path.join(out,`${name}-${f}.rgba`),renderer.renderPixelScene(ap,true,f).pix.data);
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({preset:'ex2',model,appearance:ap,baselineHash:createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'),currentHash:createHash('sha256').update(q.outputFiles[0].text).digest('hex')},null,2));
const p=spawnSync('python',[path.join(root,'scripts/compose-flame-jet.py'),out],{stdio:'inherit'});if(p.status)process.exit(p.status);
