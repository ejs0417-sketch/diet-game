// 다이어트 게임 0.4.4 — 기본 체형 3D 아바타 (three.js, 오프라인 번들, 피부·머리·얼굴형)
// 키 186cm 고정. 체중 113~86kg 사이 7개 기준 단계를 연속 보간해서 배·허리·팔·다리·볼 두께만 바뀐다.
// 얼굴 사진은 localStorage(dg_face_v1)에서만 읽고, 어디에도 보내지 않는다.
import * as T from './vendor/three.custom.min.js';

const ANCHORS=[[113,1],[111,.88],[109,.76],[105,.56],[100,.36],[95,.18],[86,0]];
export function shapeOf(kg){
  if(!(kg>0))kg=113;
  if(kg>=113)return 1; if(kg<=86)return 0;
  for(let i=0;i<ANCHORS.length-1;i++){const [w0,f0]=ANCHORS[i],[w1,f1]=ANCHORS[i+1];
    if(kg<=w0&&kg>=w1)return f1+(f0-f1)*(kg-w1)/(w0-w1);}
  return 0;
}
const L=(a,b,f)=>a+(b-a)*f;
const LEGUP=.07;
const COL={skin:0xf6c9a4,shirt:0x8fdcbc,star:0xf37b72,shorts:0x8e949a,shoe:0xffffff,sole:0xdde3e0,hair:0x2b2522,eye:0x2a211d,blush:0xf7a39b,ped:0xbfe9d4,pedTop:0xd8f3e6};
const SKIN_HEX={light:0xf8d7c4,warm:0xf6c9a4,medium:0xc6865b,tan:0xa0643c,deep:0x6b3d26};
const HAIR_HEX={black:0x1a1412,darkbrown:0x2b2522,brown:0x5a3a22,auburn:0x6b2e1f,blonde:0xc6a15b,gray:0x8a8680};
const FACE_SCALE={oval:{x:1,y:1.04,z:1,jaw:1},round:{x:1.1,y:.98,z:1.06,jaw:1.06},long:{x:.92,y:1.14,z:.96,jaw:.92},square:{x:1.06,y:1.0,z:1.02,jaw:1.14}};
const LOOK_DEF={skin:'warm',hairColor:'darkbrown',hairStyle:'short',faceShape:'oval'};
function readFaceStore(){
  try{const s=localStorage.getItem('dg_face_v1');if(!s)return null;
    if(s.startsWith('data:'))return {photo:s};
    const o=JSON.parse(s);return o&&typeof o==='object'?o:null;}catch(e){return null;}
}
function lookFromStore(){const o=readFaceStore()||{};return Object.assign({},LOOK_DEF,{skin:o.skin||LOOK_DEF.skin,hairColor:o.hairColor||LOOK_DEF.hairColor,hairStyle:o.hairStyle||LOOK_DEF.hairStyle,faceShape:o.faceShape||LOOK_DEF.faceShape,photo:o.photo||null});}

let renderer=null,scene,camera,root,body=null,ghost=null,failed=false,gScene,gRoot,gDepth,gColor;
let state={kg:113,ghostKg:null,face:null},faceTex=null,look=Object.assign({},LOOK_DEF);
let host=null,rotY=0.35,drag=null,lastT=0,raf=0,idleSpeed=0.35,ro=null,dirty=true;
const mats={};
function mat(name,opts){return mats[name]||(mats[name]=new T.MeshStandardMaterial(Object.assign({roughness:.85,metalness:0},opts)));}
function ghostMat(){return mats.ghost||(mats.ghost=new T.MeshBasicMaterial({color:0x3fbf86}));}

function starShape(R,r){const s=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,q=i%2?r:R;const x=Math.cos(a)*q,y=Math.sin(a)*q;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();return s;}

function cap(r,len,m){return new T.Mesh(new T.CapsuleGeometry(r,len,6,14),m);}
function sph(r,m,ws=20,hs=14){return new T.Mesh(new T.SphereGeometry(r,ws,hs),m);}
// a->b 사이에 캡슐을 놓는다
function limb(g,a,b,r,m){const d=new T.Vector3().subVectors(b,a),len=d.length();const c=cap(r,Math.max(0.001,len),m);
  c.position.copy(a).addScaledVector(d,.5);c.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());g.add(c);return c;}

function buildBody(f,isGhost,lk){lk=lk||look||LOOK_DEF;
  const g=new T.Group();
  const skinC=SKIN_HEX[lk.skin]||COL.skin,hairC=HAIR_HEX[lk.hairColor]||COL.hair;
  const M=isGhost?{skin:ghostMat(),shirt:ghostMat(),shorts:ghostMat(),shoe:ghostMat(),hair:ghostMat(),sole:ghostMat()}:
    {skin:mat('skin',{color:skinC}),shirt:mat('shirt',{color:COL.shirt}),shorts:mat('shorts',{color:COL.shorts}),shoe:mat('shoe',{color:COL.shoe,roughness:.6}),sole:mat('sole',{color:COL.sole}),hair:mat('hair',{color:hairC,roughness:.7})};
  if(!isGhost){if(M.skin.color)M.skin.color.setHex(skinC);if(M.hair.color)M.hair.color.setHex(hairC);}
  // 치수 (키 고정: 모든 y 위치는 f와 무관)
  const legX=L(.105,.165,f), shin=L(.066,.098,f), thigh=L(.085,.15,f);
  const waist=L(.21,.34,f), belly=L(.215,.40,f), chest=L(.235,.33,f), shoulder=L(.25,.31,f);
  const depth=L(.78,.92,f), arm=L(.052,.085,f), forearm=L(.046,.074,f);
  // 신발
  for(const s of [-1,1]){const sh=sph(.085,M.shoe,16,10);sh.scale.set(1,.62,1.55);sh.position.set(s*legX,.055,.035);g.add(sh);
    if(!isGhost){const so=sph(.086,M.sole,16,8);so.scale.set(1.02,.25,1.57);so.position.set(s*legX,.022,.035);g.add(so);}}
  // 다리 (정강이·허벅지)
  for(const s of [-1,1]){limb(g,new T.Vector3(s*legX,.12,0),new T.Vector3(s*legX,.36,0),shin,M.skin);
    limb(g,new T.Vector3(s*legX,.36,0),new T.Vector3(s*legX*.92,.56+LEGUP,0),thigh,M.skin);}
  const U=new T.Group();U.position.y=LEGUP;g.add(U); // 상체(다리를 조금 길게)
  // 반바지: 다리 통 + 엉덩이
  for(const s of [-1,1]){const p=new T.Mesh(new T.CylinderGeometry(thigh*1.18,thigh*1.25,.24,16),M.shorts);p.position.set(s*legX*.95,.55,0);U.add(p);}
  const hip=new T.Mesh(new T.LatheGeometry([new T.Vector2(0,.56),new T.Vector2(waist*.98,.56),new T.Vector2(waist*1.02,.63),new T.Vector2(waist,.76),new T.Vector2(0,.76)],24),M.shorts);
  hip.scale.z=depth;U.add(hip);
  // 몸통(티셔츠) 회전체: 허리→배→가슴→어깨
  const by=L(.88,.86,f);
  const prof=[[0,.70],[waist*1.0,.70],[waist*1.03,.76],[L(belly*.97,belly,f),by],[L(chest,belly*.96,f*.6),1.0],[chest,1.12],[shoulder,1.22],[shoulder*.82,1.29],[.11,1.33],[0,1.335]];
  const torso=new T.Mesh(new T.LatheGeometry(prof.map(([r,y])=>new T.Vector2(r,y)),28),M.shirt);torso.scale.z=depth;U.add(torso);
  // 배 앞쪽 볼록함
  if(f>0.02){const b=sph(belly*.78,M.shirt,22,14);b.scale.set(1.05,L(.7,.95,f),L(.5,.9,f));b.position.set(0,by-.01,belly*depth*L(.42,.36,f));U.add(b);}
  // 가슴 별
  if(!isGhost){const st=new T.Mesh(new T.ShapeGeometry(starShape(.058,.025)),mat('star',{color:COL.star,side:T.DoubleSide}));
    st.position.set(0,1.08,L(chest,belly*.96,f*.6)*depth+.006+f*.03);st.rotation.x=-0.12-f*.25;U.add(st);}
  // 팔 (어깨→팔꿈치→손), 무거울수록 바깥으로 벌어짐
  for(const s of [-1,1]){const sx=s*(shoulder*.92);
    const sh=new T.Vector3(sx,1.2,0), el=new T.Vector3(s*(shoulder+L(.06,.13,f)),.93,0), ha=new T.Vector3(s*(shoulder+L(.075,.17,f)),.70,.03);
    limb(U,sh,el,arm,M.skin);limb(U,el,ha,forearm,M.skin);
    const hand=sph(forearm*1.25,M.skin,14,10);hand.position.copy(ha).add(new T.Vector3(0,-.04,0));U.add(hand);
    const sl=limb(U,sh,new T.Vector3().lerpVectors(sh,el,.42),arm*1.32,M.shirt);}
  // 목·머리
  const nk=new T.Mesh(new T.CylinderGeometry(L(.07,.095,f),L(.08,.11,f),.1,14),M.skin);nk.position.y=1.36;U.add(nk);
  const head=new T.Group();head.position.y=1.56;U.add(head);
  const HR=.2, cheek=L(1.0,1.12,f), fs=FACE_SCALE[lk.faceShape]||FACE_SCALE.oval;
  const hd=sph(HR,M.skin,28,20);hd.scale.set(cheek*fs.x,fs.y,fs.z);head.add(hd);
  // 볼살(아래쪽 볼륨) — 둥근·각진 얼굴은 아래를 조금 더
  if(f>0.05||fs.jaw>1.02){const jw=sph(HR*.8,M.skin,20,12);jw.scale.set(cheek*1.1*fs.jaw,.7*(lk.faceShape==='square'?1.15:.95),.95);jw.position.set(0,lk.faceShape==='long'?-.09:-.07,.02);head.add(jw);}
  // 귀
  for(const s of [-1,1]){const e=sph(.045,M.skin,12,8);e.scale.set(.6,1,.8);e.position.set(s*HR*cheek*fs.x*.98,-.01,0);head.add(e);}
  // 머리카락
  const style=lk.hairStyle||'short';
  if(style==='buzz'){
    const hair=new T.Mesh(new T.SphereGeometry(HR*1.02,28,14,0,Math.PI*2,0,Math.PI*.5),M.hair);hair.scale.set(cheek*fs.x*.99,fs.y*.92,fs.z*1.0);hair.position.y=.006;head.add(hair);
  }else{
    const capH=style==='curly'?Math.PI*.5:Math.PI*.42;
    const hair=new T.Mesh(new T.SphereGeometry(HR*(style==='curly'?1.1:1.06),28,14,0,Math.PI*2,0,capH),M.hair);hair.scale.set(cheek*fs.x*.99,fs.y*(style==='curly'?1.12:1.05),fs.z*1.02);hair.position.y=.012;head.add(hair);
    const back=new T.Mesh(new T.SphereGeometry(HR*1.05,24,14,Math.PI*1.1,Math.PI*.8,0,Math.PI*.62),M.hair);back.scale.set(cheek*fs.x*.99,fs.y*1.02,fs.z*1.02);head.add(back);
    if(style==='side'){
      const fr=sph(.075,M.hair,12,8);fr.scale.set(1.4,.5,.7);fr.position.set(-.08,.13,.13);fr.rotation.z=.7;head.add(fr);
    }else if(style==='curly'){
      for(const [x,y,z] of [[-.09,.16,.08],[.0,.2,.1],[.09,.16,.08],[-.06,.14,.14],[.06,.14,.14]]){const c=sph(.055,M.hair,10,8);c.position.set(x,y,z);head.add(c);}
    }else{
      for(const [x,,rz] of [[-.07,0,.5],[.0,0,0],[.075,0,-.5]]){const fr=sph(.07,M.hair,12,8);fr.scale.set(1.2,.55,.7);fr.position.set(x,.135,.135);fr.rotation.z=rz;head.add(fr);}
    }
  }
  if(!isGhost){
    // 기본 얼굴
    const face=new T.Group();face.name='face';head.add(face);
    const eyeM=mat('eye',{color:COL.eye,roughness:.4}),bl=mat('blush',{color:COL.blush,transparent:true,opacity:.75});
    for(const s of [-1,1]){const e=sph(.024,eyeM,12,8);e.scale.set(.9,1.15,.5);e.position.set(s*.072,.02,HR*.95);face.add(e);
      const hl=sph(.007,mat('hl',{color:0xffffff,roughness:.3}),8,6);hl.position.set(s*.072+.008,.03,HR*.95+.011);face.add(hl);
      const b=new T.Mesh(new T.CircleGeometry(.032,16),bl);b.position.set(s*.115*cheek,-.045,HR*.9);b.rotation.y=s*.5;face.add(b);}
    const mouth=new T.Mesh(new T.TorusGeometry(.035,.009,6,16,Math.PI),mat('mouth',{color:0xb8524a}));mouth.rotation.z=Math.PI;mouth.position.set(0,-.06,HR*.97);face.add(mouth);
    // 사진 얼굴(구면 패치)
    const patch=new T.Mesh(new T.SphereGeometry(HR*1.012,24,16,Math.PI/2-.8,1.6,Math.PI*.30,Math.PI*.47),
      new T.MeshStandardMaterial({transparent:true,roughness:.9,map:null}));patch.name='photo';patch.scale.set(cheek*fs.x,fs.y,fs.z);patch.visible=false;head.add(patch);
  }
  return g;
}
function disposeTree(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.name==='photo'&&n.material)n.material.dispose();});}

function makeFaceTexture(url,cb){const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  // 타원으로 자르고 가장자리를 부드럽게
  x.save();x.beginPath();x.ellipse(128,128,118,124,0,0,Math.PI*2);x.clip();x.drawImage(img,0,0,256,256);x.restore();
  x.globalCompositeOperation='destination-in';const gr=x.createRadialGradient(128,128,90,128,128,126);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,256,256);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;cb(t);};img.src=url;}
function applyFace(){if(!body)return;const p=body.getObjectByName('photo'),f=body.getObjectByName('face');if(!p)return;
  if(faceTex){p.material.map=faceTex;p.material.emissiveMap=faceTex;p.material.emissive.set(0xffffff);p.material.emissiveIntensity=.35;p.material.needsUpdate=true;p.visible=true;f.visible=false;}else{p.visible=false;f.visible=true;}}

function rebuild(){if(!scene)return;
  if(body){root.remove(body);disposeTree(body);} body=buildBody(shapeOf(state.kg),false,look);root.add(body);applyFace();
  if(ghost){gRoot.remove(ghost);disposeTree(ghost);ghost=null;}
  // 예측이 지금보다 가벼울 때만: 더 날씬한 예상 체형을 반투명으로 몸 위에 겹쳐 그림
  if(state.ghostKg!=null&&shapeOf(state.ghostKg)<shapeOf(state.kg)-.01){ghost=buildBody(shapeOf(state.ghostKg),true,look);gRoot.add(ghost);}
  dirty=true;}

function init(){if(renderer||failed)return !failed;
  try{const cv=document.createElement('canvas');const gl=cv.getContext('webgl2')||cv.getContext('webgl');if(!gl)throw new Error('no webgl');
    renderer=new T.WebGLRenderer({canvas:cv,context:gl,antialias:true,alpha:true});}
  catch(e){failed=true;return false;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;
  const cv=renderer.domElement;cv.style.cssText='width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
  cv.addEventListener('webglcontextlost',e=>{e.preventDefault();});
  scene=new T.Scene();camera=new T.PerspectiveCamera(30,1,.1,20);
  scene.add(new T.HemisphereLight(0xffffff,0xb9dcc9,1.6));const d=new T.DirectionalLight(0xffffff,1.5);d.position.set(1.5,2.5,3);scene.add(d);
  const d2=new T.DirectionalLight(0xfff0e6,.5);d2.position.set(-2,1,-1);scene.add(d2);
  root=new T.Group();scene.add(root);
  // 예측 체형: 따로 깊이만 먼저 그리고, 맨 앞면만 반투명 한 겹으로 칠한다(겹침 얼룩 방지)
  gScene=new T.Scene();gRoot=new T.Group();gScene.add(gRoot);
  gDepth=new T.MeshBasicMaterial({colorWrite:false});gColor=new T.MeshBasicMaterial({color:0x3fbf86,transparent:true,opacity:.28,depthWrite:false});
  renderer.autoClear=false;
  const ped=new T.Mesh(new T.CylinderGeometry(.5,.54,.08,40),mat('ped',{color:COL.ped}));ped.position.y=-.04;scene.add(ped);
  const top=new T.Mesh(new T.CircleGeometry(.5,40),mat('pedTop',{color:COL.pedTop}));top.rotation.x=-Math.PI/2;top.position.y=.001;scene.add(top);
  // 드래그로 돌리기 (가로만, 세로 스크롤은 그대로)
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,r:rotY};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing';});
  cv.addEventListener('pointermove',e=>{if(drag){rotY=drag.r+(e.clientX-drag.x)*.012;dirty=true;}});
  const up=()=>{drag=null;cv.style.cursor='grab';};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
  const st=lookFromStore();look=Object.assign({},LOOK_DEF,st);
  if(st&&st.photo)makeFaceTexture(st.photo,t=>{faceTex=t;applyFace();dirty=true;});
  rebuild();return true;}

function frame(){if(!host)return;
  const w=host.clientWidth,h=host.clientHeight;if(w&&h){const cv=renderer.domElement;
    if(cv._w!==w||cv._h!==h){cv._w=w;cv._h=h;renderer.setSize(w,h,false);camera.aspect=w/h;
      // 전신(받침대 포함, 높이 약 1.85)이 화면에 들어오게 거리 계산
      const vH=2.32,fov=camera.fov*Math.PI/180,distH=vH/2/Math.tan(fov/2),distW=(1.35/2)/Math.tan(fov/2)/camera.aspect;
      camera.position.set(0,.95,Math.max(distH,distW)*1.02);camera.lookAt(0,.86,0);camera.updateProjectionMatrix();dirty=true;}}
}
function loop(t){raf=0;if(!host||!host.isConnected||document.hidden){return;}
  const dt=lastT?Math.min(.05,(t-lastT)/1000):0;lastT=t;
  if(!drag&&idleSpeed){rotY+=dt*idleSpeed;dirty=true;}
  frame();root.rotation.y=rotY;
  if(dirty){renderer.clear();renderer.render(scene,camera);
    if(ghost){gRoot.rotation.y=rotY;renderer.clearDepth();gScene.overrideMaterial=gDepth;renderer.render(gScene,camera);gScene.overrideMaterial=gColor;renderer.render(gScene,camera);}
    dirty=false;}
  raf=requestAnimationFrame(loop);}
function start(){if(!raf&&host&&!failed){lastT=0;raf=requestAnimationFrame(loop);}}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}

const api={
  get failed(){return failed;},
  shapeOf,
  // el: 아바타를 넣을 칸. 안에 있는 대체 이미지(.fallback)는 WebGL이 되면 숨긴다.
  mount(el,opt={}){if(!el)return false;if(!init()){el.classList.add('noGL');return false;}
    host=el;const fb=el.querySelector('.fallback');if(fb)fb.style.display='none';
    el.appendChild(renderer.domElement);renderer.domElement._w=0;
    idleSpeed=opt.idle??.35;
    const kg=opt.kg??state.kg,gk=opt.ghostKg??null;if(kg!==state.kg||gk!==state.ghostKg){state.kg=kg;state.ghostKg=gk;rebuild();}
    if(ro)ro.disconnect();if(window.ResizeObserver){ro=new ResizeObserver(()=>{dirty=true;});ro.observe(el);}
    dirty=true;stop();start();return true;},
  setWeight(kg,ghostKg){if(failed||!scene)return;state.kg=kg;state.ghostKg=ghostKg??null;rebuild();},
  setFace(url){if(failed||!scene)return;if(!url){if(faceTex)faceTex.dispose();faceTex=null;applyFace();dirty=true;return;}
    makeFaceTexture(url,t=>{if(faceTex)faceTex.dispose();faceTex=t;applyFace();dirty=true;});},
  setLook(o){look=Object.assign({},LOOK_DEF,look,o||{});if(!failed&&scene)rebuild();},
  getLook(){return Object.assign({},look);},
  SKIN_HEX,HAIR_HEX,FACE_SCALE,LOOK_DEF,
  setRotation(r){rotY=r;dirty=true;},
};
window.DGAvatar=api;
if(typeof window.dgMountAvatar==='function')window.dgMountAvatar();
