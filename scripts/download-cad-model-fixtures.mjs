import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = new URL('../test-results/fixtures/', import.meta.url);
await mkdir(directory, { recursive: true });
const api = (url) =>
  JSON.parse(execFileSync('gh', ['api', url], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
const sources = [];
for (const [repo, ref, source, name] of [
  ['mrdoob/three.js', 'dev', 'examples/models/stl/binary/pr2_head_pan.stl', 'pr2-real.stl'],
  ['mrdoob/three.js', 'dev', 'examples/models/obj/cerberus/Cerberus.obj', 'Cerberus.obj'],
  ['kovacsv/occt-import-js', 'main', 'test/testfiles/cax-if/as1-oc-214.stp', 'assembly.stp'],
  ...['AC1015', 'AC1021', 'AC1032'].map((v) => [
    'DomCR/ACadSharp',
    'master',
    `samples/sample_${v}.dwg`,
    `${v}.dwg`,
  ]),
]) {
  const entry = api(`repos/${repo}/contents/${source}?ref=${ref}`);
  const blob = api(`repos/${repo}/git/blobs/${entry.sha}`);
  const bytes = Buffer.from(blob.content, 'base64');
  await writeFile(new URL(name, directory), bytes);
  sources.push({ name, url: entry.html_url, blob: entry.sha, size: bytes.length });
  console.log(name, bytes.length);
}
await writeFile(
  new URL('../test-results/cad-model-sources.json', import.meta.url),
  JSON.stringify(sources, null, 2),
);
