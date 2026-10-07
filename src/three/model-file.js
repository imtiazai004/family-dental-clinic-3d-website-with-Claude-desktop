import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// The 3D model file (teeth, gums, bone). Each page's <head> asks the browser to start downloading
// it straight away (<link rel="preload">), so it arrives while the scripts are still loading.
// Hosts that cannot serve .glb files get a base64 JSON copy instead (tools/make-artifact.py points
// the preload at it), and the page then asks for that copy first rather than trying the .glb.
export async function loadTeeth(root = './') {
  const jsonFirst = !!document.querySelector('link[rel="preload"][href$="teeth.json"]');
  const glb = async () => {
    const r = await fetch(`${root}models/teeth.glb`);
    if (!r.ok) throw new Error(String(r.status));
    return r.arrayBuffer();
  };
  const json = async () => {
    const r = await fetch(`${root}models/teeth.json`);
    if (!r.ok) throw new Error(String(r.status));
    const bin = atob((await r.json()).glb);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  };
  const buf = jsonFirst ? await json().catch(glb) : await glb().catch(json);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return new Promise((ok, fail) => loader.parse(buf, './', ok, fail));
}

