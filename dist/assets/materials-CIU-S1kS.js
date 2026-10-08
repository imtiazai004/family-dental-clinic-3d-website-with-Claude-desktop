import{E as e,z as t}from"./bot-DrlZcFbz.js";var n=e=>new t(e);function r(e,t,n){let r=e.userData.patches||(e.userData.patches=[]);return r.push({key:t,fn:n}),e.onBeforeCompile=e=>{for(let t of r)t.fn(e)},e.customProgramCacheKey=()=>r.map(e=>e.key).join(`|`),e.needsUpdate=!0,e}var i=`
float fhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fhash(i), fhash(i + vec3(1,0,0)), f.x), mix(fhash(i + vec3(0,1,0)), fhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fhash(i + vec3(0,0,1)), fhash(i + vec3(1,0,1)), f.x), mix(fhash(i + vec3(0,1,1)), fhash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float cells(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); float d = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z); vec3 r = o + vec3(fhash(i + o), fhash(i + o + 17.3), fhash(i + o + 41.7)) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}`;function a(t,n={}){let a={uAO:{value:n.ao??.9},uCerv:{value:new e(n.cervical??`#ffffff`)},uThinCol:{value:new e(n.thinColor??`#ffffff`)},uThin:{value:n.thin??0},uTrans:{value:new e(n.trans??`#000000`)},uBump:{value:n.bump??0},uFreq:{value:n.freq??40},uRough:{value:n.roughVar??0},uVary:{value:n.vary??.05}};return t.userData.surf=a,r(t,`surf${n.bump?`b`:``}`,e=>{Object.assign(e.uniforms,a),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
attribute vec3 _surf;
varying vec3 vSurf;
varying vec3 vObjP;
varying mat3 vNM;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
vSurf = _surf;
vObjP = position;
vNM = normalMatrix;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
        varying vec3 vSurf; varying vec3 vObjP; varying mat3 vNM;
        uniform float uAO; uniform vec3 uCerv; uniform vec3 uThinCol; uniform float uThin; uniform vec3 uTrans;
        uniform float uBump; uniform float uFreq; uniform float uRough; uniform float uVary;
        ${i}`).replace(`#include <color_fragment>`,`#include <color_fragment>
        float hgt = vSurf.z;
        float thinv = 1.0 - vSurf.y;
        float nz = vnoise(vObjP * uFreq);
        float nz2 = vnoise(vObjP * uFreq * 0.23 + 7.0);
        diffuseColor.rgb *= mix(uCerv, vec3(1.0), smoothstep(0.0, 0.65, hgt));
        diffuseColor.rgb = mix(diffuseColor.rgb, uThinCol, uThin * thinv * thinv);
        diffuseColor.rgb *= 1.0 - uVary + uVary * 2.0 * (0.6 * nz2 + 0.4 * nz);`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + uRough * (nz - 0.5)), 0.05, 1.0);`).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
        if (uBump > 0.0) {
          vec3 q = vObjP * uFreq * 2.0;
          float e = 0.2;
          float n0 = vnoise(q);
          vec3 g = vec3(vnoise(q + vec3(e, 0.0, 0.0)) - n0, vnoise(q + vec3(0.0, e, 0.0)) - n0, vnoise(q + vec3(0.0, 0.0, e)) - n0) / e;
          vec3 gv = vNM * g;
          normal = normalize(normal - uBump * (gv - dot(gv, normal) * normal));
        }`).replace(`#include <lights_fragment_end>`,`#include <lights_fragment_end>
        float aoV = mix(1.0, vSurf.x, uAO);
        reflectedLight.indirectDiffuse *= aoV;
        reflectedLight.indirectSpecular *= mix(1.0, aoV * aoV, 0.9);
        reflectedLight.directDiffuse *= mix(1.0, aoV, 0.5);
        reflectedLight.directSpecular *= mix(1.0, aoV, 0.7);
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
        totalEmissiveRadiance += uTrans * thinv * thinv * (0.3 + 0.7 * rim) * aoV;`)})}function o(t,n,a,o=0){t.side=2,t.clippingPlanes=[a],t.clipShadows=!0;let s={value:new e(n)};return r(t,`cut${o}`,e=>{e.uniforms.uCut=s,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vWorldP;`).replace(`#include <project_vertex>`,`#include <project_vertex>
vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;`),e.fragmentShader.includes(`float vnoise(`)||(e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>\n${i}`)),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform vec3 uCut; varying vec3 vWorldP;`).replace(`#include <dithering_fragment>`,`#include <dithering_fragment>
        if (!gl_FrontFacing) {
          vec3 c = uCut;
          ${o===1?`float cc = cells(vWorldP * 9.0) * 0.6 + cells(vWorldP * 21.0 + 3.1) * 0.4;
               float solid = smoothstep(0.3, 0.4, cc);
               float fine = vnoise(vWorldP * 70.0);
               c = mix(c * vec3(0.72, 0.5, 0.42), c, solid) * (0.93 + 0.07 * fine);`:`c *= 0.97 + 0.03 * vnoise(vWorldP * 50.0);`}
          gl_FragColor = linearToOutputTexel(vec4(c * 0.9, 1.0));
        }`)})}function s(t){let i={uInfect:{value:1},uFill:{value:-10},uTime:{value:0},uSick:{value:new e(`#6e1028`)},uClean:{value:new e(`#efc9c9`)},uGutta:{value:new e(`#e2763f`)},uGlow:{value:new e(`#ff2d55`)}},a=n({color:`#ffffff`,roughness:.4,clearcoat:.6,clearcoatRoughness:.2,side:2});return a.clippingPlanes=[t],a.clipShadows=!0,r(a,`pulp`,e=>{Object.assign(e.uniforms,i),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vWorldQ;`).replace(`#include <project_vertex>`,`#include <project_vertex>
vWorldQ = (modelMatrix * vec4(transformed, 1.0)).xyz;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
        uniform float uInfect; uniform float uFill; uniform float uTime;
        uniform vec3 uSick; uniform vec3 uClean; uniform vec3 uGutta; uniform vec3 uGlow;
        varying vec3 vWorldQ;`).replace(`#include <color_fragment>`,`#include <color_fragment>
        float filled = 1.0 - smoothstep(uFill - 0.02, uFill + 0.02, vWorldQ.y);
        diffuseColor.rgb = mix(mix(uClean, uSick, uInfect), uGutta, filled);`).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * uInfect * (0.3 + 0.28 * sin(uTime * 3.2)) * (1.0 - filled);`)}),a.userData.u=i,a}function c(t,r=`natural`,i={}){let o=t===0,s=e=>o?{...e,sheen:0}:e,c={ao:.95,cervical:`#ffeacb`,thinColor:`#cbd5e4`,thin:.45,trans:`#323c52`,freq:55,roughVar:.6,vary:.03},u={enamel:[()=>n(s({color:`#faf6ee`,roughness:.26,clearcoat:.85,clearcoatRoughness:.12,sheen:.15,sheenColor:new e(`#f2ecff`)})),c],dentin:[()=>n(s({color:`#e7cf9c`,roughness:.6,sheen:.25,sheenColor:new e(`#fff0d0`)})),{ao:.95,freq:45,roughVar:.5,bump:.06,vary:.06,trans:`#2a1a08`}],pulp:[()=>n({color:`#b8344f`,roughness:.35,clearcoat:.8,clearcoatRoughness:.15,emissive:new e(`#4a0816`),emissiveIntensity:.5}),{ao:.85,freq:30,bump:.08,trans:`#5a0a1c`,vary:.08}],gum:[()=>n(s({color:`#e07a8a`,roughness:.45,clearcoat:.7,clearcoatRoughness:.18,sheen:.6,sheenColor:new e(`#ffc4cf`),sheenRoughness:.45})),{ao:.95,cervical:`#e6a7b1`,bump:.32,freq:34,roughVar:.7,trans:`#4a0c18`,vary:.07}],bone:[()=>n({color:`#e8d8b8`,roughness:.82}),{ao:.95,bump:.22,freq:18,roughVar:.3,vary:.08}],porcelain:[()=>n(s({color:`#f7f3eb`,roughness:.16,clearcoat:1,clearcoatRoughness:.08,sheen:.25,sheenColor:new e(`#f0e6ff`)})),{...c,cervical:`#fff3e2`,thin:.4,vary:.02}],stained:[()=>n(s({color:`#e0cb9e`,roughness:.38,clearcoat:.5,clearcoatRoughness:.25})),{...c,cervical:`#e9c78f`,vary:.07}],veneer:[()=>n(s({color:`#faf7f0`,roughness:.14,clearcoat:1,clearcoatRoughness:.06,sheen:.25,sheenColor:new e(`#f3ecff`)})),{...c,cervical:`#fff6ea`,thin:.55,vary:.02}],archTeeth:[()=>n(s({color:`#faf6ee`,roughness:.26,clearcoat:.85,clearcoatRoughness:.12,sheen:.15,sheenColor:new e(`#f2ecff`)})),c],archGum:[()=>n(s({color:`#e07a8a`,roughness:.42,clearcoat:.75,clearcoatRoughness:.16,sheen:.6,sheenColor:new e(`#ffc4cf`),sheenRoughness:.45})),{ao:.95,cervical:`#e6a7b1`,bump:.3,freq:30,roughVar:.7,trans:`#4a0c18`,vary:.07}],acrylic:[()=>n(s({color:`#df7d8e`,roughness:.25,clearcoat:1,clearcoatRoughness:.08})),{ao:.9,bump:.12,freq:9,vary:.05}],milk:[()=>n(s({color:`#fbf8f2`,roughness:.22,clearcoat:.9,clearcoatRoughness:.1,sheen:.35,sheenColor:new e(`#e7d9ff`)})),{...c,cervical:`#fff6ea`}]};r===`gloss`&&Object.assign(u,l(s,i));let d=e=>{let[t,n]=u[e];return a(t(),n)},f={fresh:d};for(let e of Object.keys(u))f[e]=d(e);return Object.assign(f,{titanium:n({color:`#bcc1ca`,metalness:1,roughness:.22}),abutment:n({color:`#d9c39a`,metalness:1,roughness:.26}),steel:n({color:`#d4d8de`,metalness:1,roughness:.18}),socket:n({color:`#2f2a35`,metalness:.6,roughness:.6}),handle:n(s({color:`#3f6fd6`,roughness:.32,clearcoat:.6})),stopper:n({color:`#ffb347`,roughness:.5})}),r===`gloss`&&Object.assign(f,{titanium:n({color:`#eef1f5`,metalness:1,roughness:.2,envMapIntensity:2.2}),abutment:n({color:`#e6e9ee`,metalness:1,roughness:.18,envMapIntensity:2.2}),steel:n({color:`#eef1f5`,metalness:1,roughness:.12,envMapIntensity:2})}),f}function l(t,r={}){let i=()=>n(t({color:r.teeth||`#ffffff`,roughness:.12,clearcoat:1,clearcoatRoughness:.04,sheen:.25,sheenColor:new e(`#ffffff`),sheenRoughness:.35})),a={ao:.55,cervical:`#ffffff`,thinColor:`#eef2f8`,thin:.15,trans:`#2a3242`,vary:0,roughVar:.05,freq:40},o=r=>()=>n(t({color:r,roughness:.3,clearcoat:.9,clearcoatRoughness:.1,sheen:.6,sheenColor:new e(`#ffd3db`),sheenRoughness:.4,emissive:new e(`#ff6f86`),emissiveIntensity:.1})),s={ao:.7,cervical:`#ffffff`,trans:`#9a1631`,vary:.02,freq:30};return{enamel:[i,a],porcelain:[i,a],veneer:[i,{...a,thin:.25}],archTeeth:[i,a],milk:[i,a],stained:[()=>n(t({color:`#efe1c3`,roughness:.2,clearcoat:1,clearcoatRoughness:.08})),{...a,cervical:`#f4e2b8`}],dentin:[()=>n(t({color:r.dentin||`#f7eedf`,roughness:.26,clearcoat:.8,clearcoatRoughness:.1,sheen:.3,sheenColor:new e(`#fff6e8`)})),{ao:.6,vary:0,trans:`#3a2a12`,freq:40}],pulp:[()=>n({color:`#ee4d69`,roughness:.22,clearcoat:1,clearcoatRoughness:.06,emissive:new e(`#ff3d63`),emissiveIntensity:.35}),{ao:.6,trans:`#7a0e26`,vary:0,freq:30}],gum:[o(`#f6a2af`),s],archGum:[o(`#f6a2af`),s],acrylic:[o(`#f39aab`),{...s,bump:.05,freq:9}],bone:[()=>n({color:`#f5ecdc`,roughness:.55,clearcoat:.3}),{ao:.75,bump:.05,freq:18,vary:.03}]}}export{s as n,o as r,c as t};