import{Dt as e,Nn as t,R as n,_ as r,sr as i,t as a}from"./materials-Dng9b25K.js";function o(t,r){let o=r.look===`gloss`,s=a(r.tier,r.look,r.tune),c=o?{bone:`#eed6b8`,gum:`#ef9aab`,enamel:`#ffffff`,dentin:`#fdf7ee`}:{bone:`#f0e0c0`,gum:`#c25a6e`,enamel:`#f8f3ea`,dentin:`#ebd197`},l=e=>t.scene.getObjectByName(e),u=(e,t)=>{let r=l(e).clone();r.traverse(e=>{e.isMesh&&(e.material=t)});let i=new n;return i.add(r),i};return{M:s,CUT:c,gloss:o,part:u,molar:(e={},t=!0)=>{let r=new n,i=u(`molar_dentin`,e.dentin||s.dentin),a=t?u(`molar_pulp`,e.pulp||s.pulp):new n,o=u(`molar_enamel`,e.enamel||s.enamel);return r.add(i,a,o),{g:r,d:i,p:a,e:o}},localPlane:(t,n,r,a=0)=>{let o=new e(new i(t,n,r),a),s=o.clone();return{plane:s,local:o,sync(e,t=o.constant){o.constant=t,s.copy(o).applyMatrix4(e.matrixWorld)}}},src:l}}function s(e=`#cfe3ff`,n=1){let i=new t({uniforms:{uColor:{value:new r(e)},uK:{value:n},uOpacity:{value:1}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:2,side:2});return i.clipping=!0,i.toneMapped=!1,i}export{s as n,o as t};