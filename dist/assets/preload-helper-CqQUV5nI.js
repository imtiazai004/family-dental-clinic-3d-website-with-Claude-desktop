import{L as e,N as t,Z as n,it as r,m as i,q as a}from"./bot-L6vEMbHw.js";function o(t,n){let o=n.look===`gloss`,s=i(n.tier,n.look,n.tune),c=o?{bone:`#eed6b8`,gum:`#ef9aab`,enamel:`#ffffff`,dentin:`#fdf7ee`}:{bone:`#f0e0c0`,gum:`#c25a6e`,enamel:`#f8f3ea`,dentin:`#ebd197`},l=e=>t.scene.getObjectByName(e),u=(t,n)=>{let r=l(t).clone();r.traverse(e=>{e.isMesh&&(e.material=n)});let i=new e;return i.add(r),i};return{M:s,CUT:c,gloss:o,part:u,molar:(t={},n=!0)=>{let r=new e,i=u(`molar_dentin`,t.dentin||s.dentin),a=n?u(`molar_pulp`,t.pulp||s.pulp):new e,o=u(`molar_enamel`,t.enamel||s.enamel);return r.add(i,a,o),{g:r,d:i,p:a,e:o}},localPlane:(e,t,n,i=0)=>{let o=new a(new r(e,t,n),i),s=o.clone();return{plane:s,local:o,sync(e,t=o.constant){o.constant=t,s.copy(o).applyMatrix4(e.matrixWorld)}}},src:l}}function s(e=`#cfe3ff`,r=1){let i=new n({uniforms:{uColor:{value:new t(e)},uK:{value:r},uOpacity:{value:1}},vertexShader:`
      #include <common>
      #include <clipping_planes_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,fragmentShader:`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor; uniform float uK; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <clipping_planes_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = (0.16 + 0.84 * pow(f, 2.2)) * uK * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,transparent:!0,depthWrite:!1,blending:2,side:2});return i.clipping=!0,i.toneMapped=!1,i}var c=`modulepreload`,l=function(e,t){return new URL(e,t).href},u={},d=function(e){return e.pathname.endsWith(`.css`)},f=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=o(t.map(t=>{t=l(t,n);let r=s(t);if(r.href in u)return;u[r.href]=!0;let i=d(r);if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let o=document.createElement(`link`);if(o.rel=i?`stylesheet`:c,i||(o.as=`script`),o.crossOrigin=``,o.href=r.href,a&&o.setAttribute(`nonce`,a),document.head.appendChild(o),i)return new Promise((e,t)=>{o.addEventListener(`load`,e),o.addEventListener(`error`,()=>t(Error(`Unable to preload CSS for ${r}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})};export{o as n,s as r,f as t};