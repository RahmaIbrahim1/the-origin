import { MeshPhysicalMaterial, Color } from 'three';
import { TRIPLANAR, NOISE } from '../utils/glsl.js';

/**
 * Bean material: the scanned maps, plus procedural macro detail that fades in as
 * the camera closes, so the 1K scan holds up when it fills the screen.
 */
export function beanMaterial(assets, { env = null, envIntensity = 1 } = {}) {
  const src = assets.bean.material;
  const m = new MeshPhysicalMaterial({
    map: src.map, normalMap: src.normalMap, roughness: 0.52, metalness: 0,
    envMap: env, envMapIntensity: envIntensity, color: new Color(1.5, 1.28, 1.12),
    sheen: 0, clearcoat: 0.22, clearcoatRoughness: 0.5,
  });
  m.normalScale.set(1.25, 1.25);
  m.userData.u = {
    uDetail: { value: assets.barkNormal }, uFrac: { value: assets.fracture },
    uMacro: { value: 0 }, uHeat: { value: 0 }, uTime: { value: 0 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;varying vec3 vON;varying mat3 vDM;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vOP=position;vON=normal;
        #ifdef USE_INSTANCING
        vDM=normalMatrix*mat3(normalize(instanceMatrix[0].xyz),normalize(instanceMatrix[1].xyz),normalize(instanceMatrix[2].xyz));
        #else
        vDM=normalMatrix;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP;varying vec3 vON;varying mat3 vDM;uniform sampler2D uDetail,uFrac;uniform float uMacro,uHeat,uTime;${NOISE}${TRIPLANAR}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 on=normalize(vON);vec3 tw=triW(on);
        vec4 fr=tri(uFrac,vOP*1.9,tw);
        float mottling=fbm(vOP*9.);
        diffuseColor.rgb*=mix(1.,.62+.76*mottling,.45+.4*uMacro);
        diffuseColor.rgb*=mix(1.,smoothstep(0.,.14,fr.g)*.55+.45,uMacro*.6);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+(mottling-.45)*.55,.2,1.);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {vec3 d=triNormal(uDetail,vOP*1.6+.3,on,1.)-on;vec3 d2=triNormal(uDetail,vOP*5.2,on,1.)-on;
         normal=normalize(normal+vDM*(d*.28+d2*.5*uMacro));}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {float hot=uHeat*smoothstep(.016,0.,fr.r)*smoothstep(.3,.7,fr.b);
         totalEmissiveRadiance+=hot*vec3(1.6,.42,.07);}`);
  };
  return m;
}
