import{E as e,G as t,Q as n,V as r,j as i}from"./bot-D-Cz5efb.js";import{t as a}from"./materials-CNZONb8J.js";function o(e,t){let o=t.look===`gloss`,s=a(t.tier,t.look,t.tune),c=o?{bone:`#eed6b8`,gum:`#ef9aab`,enamel:`#ffffff`,dentin:`#fdf7ee`}:{bone:`#f0e0c0`,gum:`#c25a6e`,enamel:`#f8f3ea`,dentin:`#ebd197`},l=t=>e.scene.getObjectByName(t),u=(e,t)=>{let n=l(e).clone();n.traverse(e=>{e.isMesh&&(e.material=t)});let r=new i;return r.add(n),r};return{M:s,CUT:c,gloss:o,part:u,molar:(e={},t=!0)=>{let n=new i,r=u(`molar_dentin`,e.dentin||s.dentin),a=t?u(`molar_pulp`,e.pulp||s.pulp):new i,o=u(`molar_enamel`,e.enamel||s.enamel);return n.add(r,a,o),{g:n,d:r,p:a,e:o}},localPlane:(e,t,i,a=0)=>{let o=new r(new n(e,t,i),a),s=o.clone();return{plane:s,local:o,sync(e,t=o.constant){o.constant=t,s.copy(o).applyMatrix4(e.matrixWorld)}}},src:l}}function s(n=`#cfe3ff`,r=1){let i=new t({uniforms:{uColor:{value:new e(n)},uK:{value:r},uOpacity:{value:1}},vertexShader:`
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