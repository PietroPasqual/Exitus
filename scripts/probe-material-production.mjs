/** Read-only instrumentation of the actual production sampler path. No source is changed. */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] ?? '/tmp/material-production-probe.json');
const compiled = await build({ stdin: { contents: `
 export { renderPixelScene } from './src/ui/pixel-scene';
 export { BODY_MATERIALS } from './src/ui/pixel-mixture-signatures';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
 plugins: [{ name: 'read-only-signature-proof', setup(build) {
  build.onLoad({ filter: /pixel-mixture-compositor\.ts$/ }, args => {
   let source = fs.readFileSync(args.path, 'utf8');
   for (const expected of ['const { l, t, r, b } = domains.bounds;', 'if (!sampled) continue;', '  return report;\n}']) {
    if (!source.includes(expected)) throw new Error('Compositor proof hook is stale: ' + expected);
   }
   source = source.replace('const { l, t, r, b } = domains.bounds;', `const { l, t, r, b } = domains.bounds;
    const __proof = { elements: materials.map(m => m.element), shape: domains.shape, safePixelCount: domains.safePixelCount, preserveAuthoredPrimary: !!options.preserveAuthoredPrimary,
      regions: domains.regions.map(r => ({...r, sampledCues: {}, paintedCues: {}, sampled: 0, painted: 0})) };`);
   source = source.replace('if (!sampled) continue;', `if (!sampled) continue;
    const __region = __proof.regions[q.owner]; __region.sampled++;
    __region.sampledCues[sampled.cue] = (__region.sampledCues[sampled.cue] ?? 0) + 1;`);
   source = source.replace('body.data[i] = color[0]; body.data[i + 1] = color[1]; body.data[i + 2] = color[2];',
    `body.data[i] = color[0]; body.data[i + 1] = color[1]; body.data[i + 2] = color[2];
    __region.painted++; __region.paintedCues[sampled.cue] = (__region.paintedCues[sampled.cue] ?? 0) + 1;`);
   source = source.replace('  return report;\n}', `  globalThis.__materialSignatureProof.push(__proof);\n  return report;\n}`);
   return { contents: source, loader: 'ts' };
  });
 } }]
});
const renderer = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const being = elements => ({ elements, shapes: ['forma_esfera'], concepts: [], placement: 'front',
 projectile: false, orbit: false, direction: null, guards: [], estado: false,
 linked: false, merged: false, bond: null, closed: false });
const rows = [];
for (const element of renderer.BODY_MATERIALS) for (const role of ['primary', 'secondary']) for (let frame = 0; frame < 8; frame++) {
 const peer = element === 'metal' ? 'agua' : element === 'raio' ? 'natureza' : 'metal';
 const elements = role === 'primary' ? [element, peer] : [peer, element];
 globalThis.__materialSignatureProof = [];
 renderer.renderPixelScene({beings:[being(elements)],orbitCount:0}, false, frame);
 rows.push({element,role,frame,proof:globalThis.__materialSignatureProof});
}
const summary = renderer.BODY_MATERIALS.map(element => ({element,...Object.fromEntries(['primary','secondary'].map(role => {
 const counts = rows.filter(r=>r.element===element && r.role===role).map(row=>row.proof[0]?.regions[role==='primary'?0:1]);
 return [role, {allocation:counts.map(r=>r?.pixelCount??null),painted:counts.map(r=>r?.painted??null),components:counts.map(r=>r?.components??null),
  frame0Cues:counts[0]?.paintedCues??'accepted pair override'}];
}))}));
fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),limits:'Single-peer production sampling, not exhaustive pair coverage. Accepted legacy pair overrides do not call this sampler.',summary,rows},null,2));
console.log(JSON.stringify({output,summary},null,2));
