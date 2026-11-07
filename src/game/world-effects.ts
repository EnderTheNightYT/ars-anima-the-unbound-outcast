import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { zoneGrade } from './gfx/zones';
import type { GfxSettings } from './gfx/settings';

/** Alternative cameras use their own scene/depth, never the first-person G-buffer. */
export class WorldEffects {
  private composer:EffectComposer;
  private bloom:UnrealBloomPass;
  private grade:ShaderPass;
  private aa:ShaderPass;
  constructor(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
    this.composer=new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene,camera));
    // Saneado antes del bloom: un solo píxel NaN/Inf (normales degeneradas, HDR extremo) ennegrecía toda la vista.
    this.composer.addPass(new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv); bvec4 bad=isnan(c); if(bad.x||bad.y||bad.z||any(isinf(c.rgb)))c=vec4(0.0,0.0,0.0,1.0); gl_FragColor=vec4(clamp(c.rgb,0.0,16.0),1.0);}'}));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(320,200),.18,.25,1.35);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},grain:{value:0},aberration:{value:0},grading:{value:1},hurt:{value:0},lift:{value:new THREE.Vector3()},gamma:{value:new THREE.Vector3(1,1,1)},gain:{value:new THREE.Vector3(1,1,1)},contrast:{value:1},saturation:{value:1}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
      uniform sampler2D tDiffuse; uniform float time,grain,aberration,grading,hurt,contrast,saturation; uniform vec3 lift,gamma,gain; varying vec2 vUv;
      void main(){ vec2 off=(vUv-.5)*aberration; vec3 c=texture2D(tDiffuse,vUv).rgb;
        c.r=texture2D(tDiffuse,clamp(vUv+off,0.0,1.0)).r;c.b=texture2D(tDiffuse,clamp(vUv-off,0.0,1.0)).b;
        c=clamp(c,0.0,20.0); if(grading>.5){c=pow(max(vec3(0.0),c*(1.0-lift)+lift)*gain,1.0/gamma);float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,saturation);c=(c-.5)*contrast+.5;}
        float n=fract(sin(dot(vUv,vec2(12.9898,78.233))+time)*43758.5453);c+=(n-.5)*grain;
        c=mix(c,vec3(.65,.025,.06),hurt*.22);gl_FragColor=vec4(max(c,vec3(0.0)),1.0);
      }`});this.composer.addPass(this.grade);
    this.aa=new ShaderPass(FXAAShader);this.composer.addPass(this.aa);this.composer.addPass(new OutputPass());
  }
  resize(w:number,h:number){this.composer.setSize(w,h);this.aa.uniforms['resolution']?.value.set(1/w,1/h);}
  render(s:GfxSettings,region:string,time:number,hurt:number){
    this.bloom.enabled=s.backend!=='canvas2d'&&s.bloom>0;this.bloom.strength=.05*s.bloom; // más bajo: el halo difuminaba a jugador y enemigos
    // No FXAA/aberration here: both smear the pixel-art sprite edges. Light, shadows, bloom and reflections stay.
    this.aa.enabled=false;
    const p=zoneGrade(region),u=this.grade.uniforms;
    if(p){u['lift']?.value.fromArray(p.lift);u['gamma']?.value.fromArray(p.gamma);u['gain']?.value.fromArray(p.gain);if(u['contrast'])u['contrast'].value=p.contrast;if(u['saturation'])u['saturation'].value=p.saturation;}
    for(const [key,value]of Object.entries({time,grain:s.filmGrain?.025:0,aberration:0,grading:s.colorGrading?1:0,hurt:Math.min(1,hurt)})){if(u[key])u[key].value=value;}
    this.composer.render();
  }
  dispose(){this.composer.passes.forEach(p=>p.dispose());this.composer.dispose();}
}