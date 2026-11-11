// 다이어트 게임 0.4.15 — 기본은 승인된 시안의 5단계 GLB 캐릭터(0·25·50·75·100%).
// 누적 예상 체중 진행도에 가장 가까운 단계 모델을 보여 주고, 단계가 바뀔 때는 이전 모델을 먼저 숨긴 뒤 다음 모델을 짧게 페이드인한다.
// 두 모델을 반투명으로 겹치지 않는다. GLB를 못 불러오거나 '직접 다듬기' 모드면 0.4.7 절차적 캐릭터로 폴백한다.
// 키 186cm 고정. 절차적 폴백은 체중 113~86kg 사이 7개 기준 단계를 보간한다.
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
// ---- 0.4.15 5단계 GLB 캐릭터 (0·100%는 0.4.9 현재/목표 모델) ----
const STAGE_GLB=[
  {p:0,url:'assets/avatar/char-00-0.4.15.glb'},
  {p:.25,url:'assets/avatar/char-25-0.4.15.glb'},
  {p:.5,url:'assets/avatar/char-50-0.4.15.glb'},
  {p:.75,url:'assets/avatar/char-75-0.4.15.glb'},
  {p:1,url:'assets/avatar/char-100-0.4.15.glb'},
];
const GLB_URL={cur:STAGE_GLB[0].url,goal:STAGE_GLB[4].url};
const MODE_KEY='dg_avatar_mode'; // 'glb'(기본) | 'proc'(0.4.7 직접 다듬기 캐릭터)
const clamp01=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp01(x);return x*x*(3-2*x);};
// 진행도 0(시작 체중)~1(목표 체중). 0부터 100%까지 체형이 연속으로 줄어든다(50%에서 갑자기 바꾸지 않음).
export function progressOf(kg,start=113,goal=95){const d=start-goal;if(!(d>0)||!(kg>0))return 0;return clamp01((start-kg)/d);}
export function blendOf(p){return clamp01(p);} // 0.4.15: 진행도 전체를 변형량으로 씀(구 크로스페이드 지연 제거)
export function easeInOut(t){t=clamp01(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
export function readMode(){try{return localStorage.getItem(MODE_KEY)==='proc'?'proc':'glb';}catch(e){return 'glb';}}

const LEGUP=.07;
const COL={skin:0xf6c9a4,shirt:0x8fdcbc,star:0xf37b72,shorts:0x8e949a,shoe:0xffffff,sole:0xdde3e0,hair:0x2b2522,eye:0x2a211d,blush:0xf7a39b,ped:0xbfe9d4,pedTop:0xd8f3e6,lip:0xc45c5c};
const SKIN_HEX={light:0xf8d7c4,warm:0xf6c9a4,medium:0xc6865b,tan:0xa0643c,deep:0x6b3d26};
const HAIR_HEX={black:0x1a1412,darkbrown:0x2b2522,brown:0x5a3a22,auburn:0x6b2e1f,blonde:0xc6a15b,gray:0x8a8680};
const FACE_SCALE={oval:{x:1,y:1.04,z:1,jaw:1},round:{x:1.1,y:.98,z:1.06,jaw:1.06},long:{x:.92,y:1.14,z:.96,jaw:.92},square:{x:1.06,y:1.0,z:1.02,jaw:1.14}};
const LOOK_DEF={skin:'#f6c9a4',hairColor:'#2b2522',hairStyle:'short',faceShape:'oval',faceWidth:.5,faceLength:.5,jawWidth:.5,cheekWidth:.5,chin:.5,eyeSize:.5,eyeSpacing:.5,eyeTilt:.5,eyeColor:'#2a211d',browThick:.5,browAngle:.5,browColor:'#2b2522',noseWidth:.5,noseLength:.5,mouthWidth:.5,lipThick:.5,earY:.5,hairVolume:.5,glasses:false,beard:'none'};

function hexNum(h){
  if(typeof h==='number'&&isFinite(h))return h>>>0;
  if(typeof h==='string'){
    if(SKIN_HEX[h]!=null)return SKIN_HEX[h];
    if(HAIR_HEX[h]!=null)return HAIR_HEX[h];
    if(h[0]==='#'){const v=parseInt(h.slice(1),16);if(isFinite(v))return v;}
  }
  return 0xf6c9a4;
}
function readFaceStore(){
  try{const s=localStorage.getItem('dg_face_v1');if(!s)return null;
    if(s.startsWith('data:'))return {}; // 옛 사진 저장분은 쓰지 않음
    const o=JSON.parse(s);if(!o||typeof o!=='object')return null;
    const {photo,photoDataUrl,image,dataUrl,face,...rest}=o;return rest;}catch(e){return null;}
}
function normalizeLook(o){
  if(window.DGFace&&DGFace.sanitize)return DGFace.sanitize(o||{});
  return Object.assign({},LOOK_DEF,o||{});
}
function lookFromStore(){return normalizeLook(Object.assign({},LOOK_DEF,readFaceStore()||{}));}

let renderer=null,scene,camera,root,body=null,ghost=null,failed=false,gScene,gRoot,gDepth,gColor;
let state={kg:113,ghostKg:null,start:113,goal:95},look=Object.assign({},LOOK_DEF);
let mode=readMode(),glb={status:'idle',cur:null,goal:null},glbRoot=null,gGlb=null,glbShown=false,phase=0,swayBase=0;
let host=null,rotY=0.35,drag=null,lastT=0,raf=0,idleSpeed=0.35,ro=null,dirty=true;
const mats={};
let TOON_G=null;
function toonGrad(){
  if(TOON_G)return TOON_G;
  const c=document.createElement('canvas');c.width=4;c.height=1;
  const x=c.getContext('2d');
  const d=x.createImageData(4,1);
  [[78,86,96],[148,156,164],[214,218,222],[255,255,255]].forEach((col,i)=>{d.data[i*4]=col[0];d.data[i*4+1]=col[1];d.data[i*4+2]=col[2];d.data[i*4+3]=255;});
  x.putImageData(d,0,0);
  const t=new T.CanvasTexture(c);t.minFilter=T.NearestFilter;t.magFilter=T.NearestFilter;t.needsUpdate=true;
  TOON_G=t;return t;
}
function mat(name,opts){
  if(mats[name])return mats[name];
  const g=toonGrad();
  const o=Object.assign({gradientMap:g},opts||{});
  return mats[name]=new T.MeshToonMaterial(o);
}
function ghostMat(){return mats.ghost||(mats.ghost=new T.MeshBasicMaterial({color:0x3fbf86}));}
function tint(m,hex){if(m&&m.color)m.color.setHex(hexNum(hex));}

function starShape(R,r){const s=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,q=i%2?r:R;const x=Math.cos(a)*q,y=Math.sin(a)*q;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();return s;}
function cap(r,len,m){return new T.Mesh(new T.CapsuleGeometry(r,len,6,14),m);}
function sph(r,m,ws=20,hs=14){return new T.Mesh(new T.SphereGeometry(r,ws,hs),m);}
function limb(g,a,b,r,m){const d=new T.Vector3().subVectors(b,a),len=d.length();const c=cap(r,Math.max(0.001,len),m);
  c.position.copy(a).addScaledVector(d,.5);c.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());g.add(c);return c;}

function sculptHeadGeometry(HR,p,fat){
  const geo=new T.SphereGeometry(HR,40,32);
  const pos=geo.attributes.position;
  const fw=L(0.86,1.18,p.faceWidth),fl=L(0.88,1.16,p.faceLength);
  const jw=L(0.82,1.22,p.jawWidth),cw=L(0.90,1.20,p.cheekWidth);
  const chin=p.chin,earY=p.earY;
  for(let i=0;i<pos.count;i++){
    let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const ny=y/HR,nx=x/HR,nz=z/HR;
    y*=fl;x*=fw;
    // jaw (lower face)
    const jawT=ny< -0.15?Math.min(1,(-0.15-ny)/0.75):0;
    x*=L(1,jw,jawT*jawT);
    // cheeks
    const cheekT=Math.exp(-((ny-0.02)**2)/(2*.18*.18))*Math.min(1,Math.abs(nx)*1.4);
    x*=L(1,cw,cheekT*.7);
    z+=HR*L(-0.01,0.05,p.cheekWidth)*cheekT*(.4+fat*.6);
    // chin taper / point
    const chinT=ny< -0.55?Math.min(1,(-0.55-ny)/0.5):0;
    x*=L(1,L(1.14,0.68,chin),chinT);
    y-=HR*L(-0.01,0.05,chin)*chinT;
    z+=HR*0.02*chinT*(.5-chin);
    // forehead slightly flatter at front
    if(ny>0.35&&nz>0){z-=HR*0.03*(ny-0.35)*nz;}
    // slight face plane (front a bit flatter, not a balloon)
    if(nz>0.2){z=z*L(1,0.92, (nz-0.2)/0.8);}
    pos.setXYZ(i,x,y,z);
  }
  pos.needsUpdate=true;
  geo.computeVertexNormals();
  return geo;
}

function addHair(head,p,HR,fw,fl,M){
  const style=p.hairStyle||'short',vol=p.hairVolume??.5;
  const sx=fw*.99,sy=fl*(style==='curly'||style==='volume'?1.12:1.05),sz=1.02;
  // Top cap only (theta from crown). Do not sweep a full ring around the face.
  const capH=style==='buzz'?Math.PI*.46:style==='volume'?Math.PI*.42:Math.PI*.38;
  const capR=HR*(style==='buzz'?1.03:style==='curly'?1.08:style==='volume'?1.10:1.05);
  const cap=new T.Mesh(new T.SphereGeometry(capR,28,16,0,Math.PI*2,0,capH),M.hair);
  cap.scale.set(sx,sy*(style==='buzz'?.92:(.95+vol*.18)),sz);cap.position.y=.01;head.add(cap);
  if(style==='buzz')return;
  // Back hair: phi π..2π is the -Z rear hemisphere in three.js SphereGeometry, so the face (+Z) stays clear.
  const backLen=style==='long'?Math.PI*.8:Math.PI*.52;
  const back=new T.Mesh(new T.SphereGeometry(HR*(style==='long'?1.10:1.05),24,16,Math.PI*0.95,Math.PI*1.10,Math.PI*.28,backLen),M.hair);
  back.scale.set(sx,sy*(style==='long'?1.28:1.02),sz*(style==='long'?1.08:1));
  back.position.y=style==='long'?-.03:0;head.add(back);
  if(style==='side'){
    const fr=sph(.075,M.hair,12,8);fr.scale.set(1.5,.5,.7);fr.position.set(-.08,.13,.12);fr.rotation.z=.7;head.add(fr);
  }else if(style==='curly'){
    for(const [x,y,z] of [[-.09,.16,.06],[.0,.2,.08],[.09,.16,.06],[-.06,.14,.12],[.06,.14,.12],[-.11,.08,.02],[.11,.08,.02]]){
      const c=sph(.05+vol*.02,M.hair,10,8);c.position.set(x,y,z);head.add(c);
    }
  }else if(style==='volume'){
    const bump=sph(HR*.55,M.hair,14,10);bump.scale.set(1.4,.7,1.0);bump.position.set(0,.16,-.02);head.add(bump);
  }else if(style==='long'){
    const fall=new T.Mesh(new T.CapsuleGeometry(HR*.40,.28+vol*.12,6,12),M.hair);
    fall.position.set(0,-.14,-.08);head.add(fall);
  }else{
    for(const [x,,rz] of [[-.07,0,.5],[.0,0,0],[.075,0,-.5]]){
      const fr=sph(.065,M.hair,12,8);fr.scale.set(1.15,.5,.6);fr.position.set(x,.138,.10);fr.rotation.z=rz;head.add(fr);
    }
  }
}

function addFace(head,p,HR,fw,fl,f,M){
  const face=new T.Group();face.name='face';head.add(face);
  const eyeC=hexNum(p.eyeColor||COL.eye);
  const browC=hexNum(p.browColor||p.hairColor||COL.hair);
  const eyeWhite=mat('eyeW',{color:0xf6f3ee}),iris=mat('iris',{color:eyeC}),pupil=mat('pupil',{color:0x141414}),hl=mat('hl',{color:0xffffff});
  const browM=mat('brow',{color:browC}),lipM=mat('lip',{color:COL.lip}),blush=mat('blush',{color:COL.blush,transparent:true,opacity:.55});
  tint(iris,eyeC);tint(browM,browC);
  const sp=L(0.055,0.1,p.eyeSpacing);
  const eyeY=0.025, eyeZ=HR*1.00; // sit on/in front of the sculpted face, not inside the skull
  const size=L(0.018,0.036,p.eyeSize);
  for(const s of [-1,1]){
    const g=new T.Group();
    const sclera=sph(size,eyeWhite,16,12);sclera.scale.set(1.2,1,.62);g.add(sclera);
    const ir=sph(size*.64,iris,14,10);ir.position.z=size*.32;ir.scale.set(1,.95,.7);g.add(ir);
    const pu=sph(size*.28,pupil,10,8);pu.position.z=size*.48;g.add(pu);
    const h=sph(size*.11,hl,8,6);h.position.set(size*.16,size*.16,size*.55);g.add(h);
    g.position.set(s*sp,eyeY,eyeZ);
    g.rotation.z=s*L(-0.28,0.28,p.eyeTilt);
    g.rotation.y=s*.22;
    face.add(g);
    const bl=new T.Mesh(new T.CircleGeometry(.03+f*.01,16),blush);
    bl.position.set(s*(sp+.04),-.05,HR*.98);bl.rotation.y=s*.45;face.add(bl);
    // brow
    const bt=L(0.004,0.012,p.browThick);
    const blen=L(0.034,0.052,p.eyeSize*.4+.5);
    const brow=new T.Mesh(new T.CapsuleGeometry(bt,blen,4,8),browM);
    // mid-range is a slight friendly arch; avoid an angry V
    brow.rotation.z=Math.PI/2+s*L(0.22,-0.18,p.browAngle);
    brow.position.set(s*sp,eyeY+size+L(0.014,0.030,p.browThick),.006+eyeZ);
    face.add(brow);
  }
  // sculpted nose (lathe), not a sticker
  const nLen=L(0.055,0.10,p.noseLength), nW=L(0.016,0.040,p.noseWidth);
  const nPts=[new T.Vector2(0,0),new T.Vector2(nW*.3,nLen*.12),new T.Vector2(nW*.42,nLen*.48),new T.Vector2(nW*.95,nLen*.78),new T.Vector2(nW*.72,nLen*.96),new T.Vector2(0,nLen)];
  const nose=new T.Mesh(new T.LatheGeometry(nPts,16),M.skin);
  nose.rotation.x=Math.PI/2;nose.position.set(0,-0.005,HR*.90);face.add(nose);
  // closed smile as a 2D shape on the face plane (custom three build has no Tube/Bezier3)
  const mw=L(0.022,0.046,p.mouthWidth), th=L(0.005,0.011,p.lipThick);
  const sh=new T.Shape();
  sh.moveTo(-mw,0);
  sh.quadraticCurveTo(0,-th*3.2,mw,0);
  sh.quadraticCurveTo(0,-th*3.2+th*1.8,-mw,0);
  sh.closePath();
  const lips=new T.Mesh(new T.ShapeGeometry(sh,8),lipM);
  lips.position.set(0,-.068,HR*1.025);face.add(lips);
  const lower=new T.Mesh(new T.SphereGeometry(th*1.5,10,8),lipM);
  lower.scale.set(Math.max(1.2,mw/0.018),0.55,0.55);lower.position.set(0,-.068-th*1.2,HR*1.018);face.add(lower);
  // ears (modeled, not just a ball)
  const earY=L(0.04,-0.05,p.earY);
  for(const s of [-1,1]){
    const ear=new T.Group();
    const shell=sph(.045,M.skin,12,10);shell.scale.set(.55,1.15,.72);
    const lobe=sph(.018,M.skin,10,8);lobe.position.set(0,-.038,.004);lobe.scale.set(.8,1,.8);
    ear.add(shell,lobe);ear.position.set(s*HR*fw*.98,earY,0);ear.rotation.y=s*.35;head.add(ear);
  }
  if(p.glasses){
    const fr=mat('gframe',{color:0x1b2140});
    const lens=mat('glens',{color:0x89a0bf,transparent:true,opacity:.22});
    const gg=new T.Group();
    for(const s of [-1,1]){
      const rim=new T.Mesh(new T.TorusGeometry(size*1.55,.006,8,20),fr);
      rim.position.set(s*sp,eyeY,eyeZ+size*.2);gg.add(rim);
      const ln=new T.Mesh(new T.CircleGeometry(size*1.45,20),lens);
      ln.position.set(s*sp,eyeY,eyeZ+size*.18);gg.add(ln);
      const arm=new T.Mesh(new T.CylinderGeometry(.003,.003,HR*.7,6),fr);
      arm.rotation.x=Math.PI/2;arm.position.set(s*(sp+size*1.55),eyeY,eyeZ-HR*.3);gg.add(arm);
    }
    const brLen=Math.max(.02,sp*2-size*2.6);
    const br=new T.Mesh(new T.CylinderGeometry(.003,.003,brLen,6),fr);
    br.rotation.z=Math.PI/2;br.position.set(0,eyeY,eyeZ+size*.2);gg.add(br);
    face.add(gg);
  }
  if(p.beard&&p.beard!=='none'){
    const beardC=hexNum(p.hairColor);
    const bm=mat('beard',{color:beardC});tint(bm,beardC);
    const thick=p.beard==='full'?.07:p.beard==='short'?.05:.03;
    const span=p.beard==='full'?.95:p.beard==='short'?.8:.62;
    // front of the jaw only (phi around +Z), so the back of the head stays clear
    const beard=new T.Mesh(new T.SphereGeometry(HR*.72,20,12,Math.PI*.15,Math.PI*.70,Math.PI*.45,Math.PI*.5),bm);
    beard.scale.set(fw*span,L(.55,.85,p.beard==='full'?1:.5),L(.7,.95,p.beard==='full'?1:.4));
    beard.position.set(0,-.08,.04);
    if(p.beard==='stubble')beard.material=mat('stub',{color:beardC,transparent:true,opacity:.45});
    head.add(beard);
  }
}

function buildBody(f,isGhost,lk){
  lk=normalizeLook(lk||look||LOOK_DEF);
  const g=new T.Group();
  const skinC=hexNum(lk.skin),hairC=hexNum(lk.hairColor);
  const M=isGhost?{skin:ghostMat(),shirt:ghostMat(),shorts:ghostMat(),shoe:ghostMat(),hair:ghostMat(),sole:ghostMat()}:
    {skin:mat('skin',{color:skinC}),shirt:mat('shirt',{color:COL.shirt}),shorts:mat('shorts',{color:COL.shorts}),shoe:mat('shoe',{color:COL.shoe}),sole:mat('sole',{color:COL.sole}),hair:mat('hair',{color:hairC})};
  if(!isGhost){tint(M.skin,skinC);tint(M.hair,hairC);}
  const legX=L(.105,.165,f), shin=L(.066,.098,f), thigh=L(.085,.15,f);
  const waist=L(.21,.34,f), belly=L(.215,.40,f), chest=L(.235,.33,f), shoulder=L(.25,.31,f);
  const depth=L(.78,.92,f), arm=L(.052,.085,f), forearm=L(.046,.074,f);
  for(const s of [-1,1]){const sh=sph(.085,M.shoe,16,10);sh.scale.set(1,.62,1.55);sh.position.set(s*legX,.055,.035);g.add(sh);
    if(!isGhost){const so=sph(.086,M.sole,16,8);so.scale.set(1.02,.25,1.57);so.position.set(s*legX,.022,.035);g.add(so);}}
  for(const s of [-1,1]){limb(g,new T.Vector3(s*legX,.12,0),new T.Vector3(s*legX,.36,0),shin,M.skin);
    limb(g,new T.Vector3(s*legX,.36,0),new T.Vector3(s*legX*.92,.56+LEGUP,0),thigh,M.skin);}
  const U=new T.Group();U.position.y=LEGUP;g.add(U);
  for(const s of [-1,1]){const p=new T.Mesh(new T.CylinderGeometry(thigh*1.18,thigh*1.25,.24,16),M.shorts);p.position.set(s*legX*.95,.55,0);U.add(p);}
  const hip=new T.Mesh(new T.LatheGeometry([new T.Vector2(0,.56),new T.Vector2(waist*.98,.56),new T.Vector2(waist*1.02,.63),new T.Vector2(waist,.76),new T.Vector2(0,.76)],24),M.shorts);
  hip.scale.z=depth;U.add(hip);
  const by=L(.88,.86,f);
  const prof=[[0,.70],[waist*1.0,.70],[waist*1.03,.76],[L(belly*.97,belly,f),by],[L(chest,belly*.96,f*.6),1.0],[chest,1.12],[shoulder,1.22],[shoulder*.82,1.29],[.11,1.33],[0,1.335]];
  const torso=new T.Mesh(new T.LatheGeometry(prof.map(([r,y])=>new T.Vector2(r,y)),28),M.shirt);torso.scale.z=depth;U.add(torso);
  if(f>0.02){const b=sph(belly*.78,M.shirt,22,14);b.scale.set(1.05,L(.7,.95,f),L(.5,.9,f));b.position.set(0,by-.01,belly*depth*L(.42,.36,f));U.add(b);}
  if(!isGhost){const st=new T.Mesh(new T.ShapeGeometry(starShape(.058,.025)),mat('star',{color:COL.star,side:T.DoubleSide,gradientMap:toonGrad()}));
    st.position.set(0,1.08,L(chest,belly*.96,f*.6)*depth+.006+f*.03);st.rotation.x=-0.12-f*.25;U.add(st);}
  for(const s of [-1,1]){const sx=s*(shoulder*.92);
    const sh=new T.Vector3(sx,1.2,0), el=new T.Vector3(s*(shoulder+L(.06,.13,f)),.93,0), ha=new T.Vector3(s*(shoulder+L(.075,.17,f)),.70,.03);
    limb(U,sh,el,arm,M.skin);limb(U,el,ha,forearm,M.skin);
    const hand=sph(forearm*1.25,M.skin,14,10);hand.position.copy(ha).add(new T.Vector3(0,-.04,0));U.add(hand);
    limb(U,sh,new T.Vector3().lerpVectors(sh,el,.42),arm*1.32,M.shirt);}
  const nk=new T.Mesh(new T.CylinderGeometry(L(.07,.095,f),L(.08,.11,f),.1,14),M.skin);nk.position.y=1.36;U.add(nk);
  const head=new T.Group();head.name='head';head.position.y=1.56;U.add(head);
  const HR=.2;
  const fw=L(0.86,1.18,lk.faceWidth)*L(1.0,1.12,f);
  const fl=L(0.88,1.16,lk.faceLength);
  const hd=new T.Mesh(sculptHeadGeometry(HR,lk,f),M.skin);head.add(hd);
  addHair(head,lk,HR,fw,fl,M);
  if(!isGhost)addFace(head,lk,HR,fw,fl,f,M);
  else{
    for(const s of [-1,1]){const e=sph(.045,M.skin,12,8);e.scale.set(.55,1.1,.7);e.position.set(s*HR*fw*.98,-.01,0);head.add(e);}
  }
  return g;
}
function disposeTree(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();});}

function glbActive(){return mode==='glb'&&glb.status==='ready'&&glb.stages&&glb.stages.length;}
function nearestStage(p,stages){
  const list=stages||glb.stages||[];
  if(!list.length)return null;
  let best=list[0],d=Math.abs(p-list[0].p);
  for(const s of list){
    const dd=Math.abs(p-s.p);
    if(dd<d-1e-9||(Math.abs(dd-d)<1e-9&&s.p>best.p)){best=s;d=dd;}
  }
  return best;
}
function paintGlb(root){
  if(!root)return;
  root.traverse(n=>{if(n.isMesh){
    const m=n.material,map=m&&m.map;if(map){map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;}
    n.material=new T.MeshBasicMaterial({map:map||null,color:0xffffff});n.frustumCulled=false;}});
}
function loadGlbs(){
  if(glb.status!=='idle'||failed)return;glb.status='loading';
  const ld=new T.GLTFLoader();
  const one=u=>new Promise((res,rej)=>{const to=setTimeout(()=>rej(new Error('timeout')),25000);
    ld.load(u,g=>{clearTimeout(to);res(g.scene);},undefined,e=>{clearTimeout(to);rej(e);});});
  Promise.all(STAGE_GLB.map(s=>one(s.url).then(root=>{paintGlb(root);root.visible=false;return {p:s.p,url:s.url,root};}).catch(e=>{
    try{console.warn('단계 GLB 로드 실패',s.url,e);}catch(_){}
    return null;
  }))).then(list=>{
    const ok=list.filter(Boolean);
    if(!ok.length)throw new Error('no stage glb');
    ok.sort((a,b)=>a.p-b.p);
    glb.stages=ok;glb.cur=ok[0].root;glb.goal=ok[ok.length-1].root;
    glb.shown=null;glb.morphReady=true;glb.status='ready';rebuild();
  }).catch(e=>{glb.status='failed';try{console.warn('GLB 로드 실패, 절차적 캐릭터로 대체',e);}catch(_){}rebuild();});
}
function setOpacity(o,op){if(!o)return;o.traverse(n=>{if(n.isMesh){const m=n.material,tr=op<.999;
  m.transparent=tr;m.opacity=op;m.depthWrite=!tr;m.needsUpdate=true;}});}
function hideAllStages(){(glb.stages||[]).forEach(s=>{if(s.root){s.root.visible=false;setOpacity(s.root,1);}});}
function showStage(st,op){if(!st||!st.root)return;st.root.visible=true;setOpacity(st.root,op==null?1:op);glb.shown=st;glb.cur=st.root;}
let morphAnim=null,stageFade=null;
function currentProgress(){return progressOf(state.kg,state.start,state.goal);}
function glbShade(){
  morphAnim=null;stageFade=null;
  const p=currentProgress();
  const st=nearestStage(p);
  hideAllStages();
  if(st)showStage(st,1);
  applyGlbPose(0);
  if(gGlb){gRoot.remove(gGlb);gGlb=null;}
  if(state.ghostKg!=null){const gp=progressOf(state.ghostKg,state.start,state.goal);
    const gs=nearestStage(gp);
    if(gs&&(!st||gs.p>st.p+.01)){gGlb=gs.root.clone(true);
      gGlb.traverse(n=>{if(n.isMesh&&n.geometry){n.geometry=n.geometry.clone();n.frustumCulled=false;}});
      gGlb.visible=true;setOpacity(gGlb,1);gRoot.add(gGlb);}}
  applyGlbPose(0);
}
function applyGlbPose(breath){
  const roots=[glb&&glb.shown&&glb.shown.root,gGlb].filter(Boolean);
  for(const o of roots){const sx=o.userData.sx||1;o.scale.set(sx*(1-.004*breath),1+.008*breath,sx*(1-.004*breath));}
}
function playMorph(toKg,ms){
  if(!glbActive()||!glb.shown){state.kg=toKg;if(glbActive()&&glbShown)glbShade();else rebuild();dirty=true;return;}
  const from=state.kg, t0=(typeof performance!=='undefined'?performance.now():Date.now());
  morphAnim={from,to:+toKg,t0,ms:Math.max(200,ms||900)};
  dirty=true;
}
function beginStageFade(next){
  if(!next||!next.root)return;
  const cur=glb.shown;
  if(!cur||cur===next){hideAllStages();showStage(next,1);stageFade=null;return;}
  const now=(typeof performance!=='undefined'?performance.now():Date.now());
  // 이전 모델을 먼저 숨기고(페이드아웃), 그다음 다음 모델만 페이드인. 동시에 반투명으로 겹치지 않음.
  stageFade={from:cur,to:next,t0:now,ms:180,phase:'out'};
}
function stepFade(now){
  if(!stageFade)return;
  const t=clamp01((now-stageFade.t0)/stageFade.ms);
  const u=easeInOut(t);
  if(stageFade.phase==='out'){
    if(stageFade.to)stageFade.to.root.visible=false;
    if(stageFade.from){stageFade.from.root.visible=true;setOpacity(stageFade.from.root,1-u);}
    if(t>=1){
      if(stageFade.from){stageFade.from.root.visible=false;setOpacity(stageFade.from.root,1);}
      showStage(stageFade.to,0);
      stageFade={from:stageFade.from,to:stageFade.to,t0:now,ms:180,phase:'in'};
    }
  }else{
    if(stageFade.from)stageFade.from.root.visible=false;
    showStage(stageFade.to,u);
    if(t>=1){showStage(stageFade.to,1);stageFade=null;}
  }
  dirty=true;
}
function stepMorph(now){
  if(stageFade)stepFade(now);
  if(!morphAnim)return;
  const t=clamp01((now-morphAnim.t0)/morphAnim.ms);
  const u=easeInOut(t);
  const kg=morphAnim.from+(morphAnim.to-morphAnim.from)*u;
  state.kg=kg;
  const st=nearestStage(progressOf(kg,state.start,state.goal));
  if(st&&glb.shown!==st&&!stageFade)beginStageFade(st);
  applyGlbPose(0);
  dirty=true;
  if(t>=1){state.kg=morphAnim.to;morphAnim=null;
    if(!stageFade){const fin=nearestStage(currentProgress());hideAllStages();if(fin)showStage(fin,1);}
  }
}
function rebuild(){if(!scene)return;
  if(body){root.remove(body);disposeTree(body);body=null;}
  if(glbRoot){root.remove(glbRoot);glbRoot=null;}
  if(ghost){gRoot.remove(ghost);disposeTree(ghost);ghost=null;}
  if(gGlb){gRoot.remove(gGlb);gGlb=null;}
  mode=readMode();
  if(mode==='glb'&&glb.status==='idle')loadGlbs();
  if(glbActive()){
    glbRoot=new T.Group();(glb.stages||[]).forEach(s=>glbRoot.add(s.root));root.add(glbRoot);glbShown=true;glbShade();
  }else if(mode==='proc'||glb.status==='failed'){
    glbShown=false;
    body=buildBody(shapeOf(state.kg),false,look);root.add(body);
    if(state.ghostKg!=null&&shapeOf(state.ghostKg)<shapeOf(state.kg)-.01){ghost=buildBody(shapeOf(state.ghostKg),true,look);gRoot.add(ghost);}
  }else glbShown=false; // 불러오는 중: char.png 임시 이미지를 보여줌
  syncFallback();dirty=true;}
function syncFallback(){if(!host)return;const fb=host.querySelector('.fallback');
  if(fb)fb.style.display=(body||glbShown)?'none':'';}

function init(){if(renderer||failed)return !failed;
  try{const cv=document.createElement('canvas');const gl=cv.getContext('webgl2')||cv.getContext('webgl');if(!gl)throw new Error('no webgl');
    renderer=new T.WebGLRenderer({canvas:cv,context:gl,antialias:true,alpha:true});}
  catch(e){failed=true;return false;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0x000000,0);
  const cv=renderer.domElement;cv.style.cssText='width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
  cv.addEventListener('webglcontextlost',e=>{e.preventDefault();});
  scene=new T.Scene();camera=new T.PerspectiveCamera(30,1,.1,20);
  scene.add(new T.HemisphereLight(0xf3f5fb,0x7aa894,1.35));
  const d=new T.DirectionalLight(0xffffff,1.35);d.position.set(1.4,2.4,3);scene.add(d);
  const d2=new T.DirectionalLight(0xffe8d6,.45);d2.position.set(-2,1,-1);scene.add(d2);
  root=new T.Group();scene.add(root);
  gScene=new T.Scene();gRoot=new T.Group();gScene.add(gRoot);
  gDepth=new T.MeshBasicMaterial({colorWrite:false});gColor=new T.MeshBasicMaterial({color:0x3fbf86,transparent:true,opacity:.28,depthWrite:false});
  renderer.autoClear=false;
  const ped=new T.Mesh(new T.CylinderGeometry(.5,.54,.08,40),mat('ped',{color:COL.ped}));ped.position.y=-.04;scene.add(ped);
  const top=new T.Mesh(new T.CircleGeometry(.5,40),mat('pedTop',{color:COL.pedTop}));top.rotation.x=-Math.PI/2;top.position.y=.001;scene.add(top);
  const sh=new T.Mesh(new T.CircleGeometry(.36,32),new T.MeshBasicMaterial({color:0x3f8f77,transparent:true,opacity:.22,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;sh.position.y=.004;sh.scale.set(1.25,1,.8);scene.add(sh);
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,r:rotY};swayBase=rotY;cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing';});
  cv.addEventListener('pointermove',e=>{if(drag){rotY=drag.r+(e.clientX-drag.x)*.012;swayBase=rotY;dirty=true;}});
  const up=()=>{drag=null;cv.style.cursor='grab';};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
  look=lookFromStore();
  rebuild();return true;}

function frame(){if(!host)return;
  const w=host.clientWidth,h=host.clientHeight;if(w&&h){const cv=renderer.domElement;
    if(cv._w!==w||cv._h!==h){cv._w=w;cv._h=h;renderer.setSize(w,h,false);camera.aspect=w/h;
      const vH=2.32,fov=camera.fov*Math.PI/180,distH=vH/2/Math.tan(fov/2),distW=(1.35/2)/Math.tan(fov/2)/camera.aspect;
      camera.position.set(0,.95,Math.max(distH,distW)*1.02);camera.lookAt(0,.86,0);camera.updateProjectionMatrix();dirty=true;}}
}
function loop(t){raf=0;if(!host||!host.isConnected||document.hidden){return;}
  if(glbShown&&idleSpeed&&!drag&&!morphAnim&&!stageFade&&lastT&&t-lastT<30){raf=requestAnimationFrame(loop);return;} // 대기 애니메이션은 30fps 이하로
  const dt=lastT?Math.min(.05,(t-lastT)/1000):0;lastT=t;
  if(glbShown){ // GLB: 얼굴이 잘 보이게 살짝 좌우로 흔들리는 대기 동작 + 숨쉬기
    if(morphAnim||stageFade)stepMorph(t);
    if(idleSpeed&&!drag){phase+=dt;dirty=true;}
    const sway=idleSpeed&&!drag?Math.sin(phase*idleSpeed*1.7)*.5:0;
    rotY=swayBase+sway;
    applyGlbPose(idleSpeed?Math.sin(phase*2.2):0);
  }else if(!drag&&idleSpeed){rotY+=dt*idleSpeed;dirty=true;}
  frame();root.rotation.y=rotY;
  if(dirty){renderer.clear();renderer.render(scene,camera);
    if(ghost||gGlb){gRoot.rotation.y=rotY;renderer.clearDepth();gScene.overrideMaterial=gDepth;renderer.render(gScene,camera);gScene.overrideMaterial=gColor;renderer.render(gScene,camera);}
    dirty=false;}
  raf=requestAnimationFrame(loop);}
function start(){if(!raf&&host&&!failed){lastT=0;raf=requestAnimationFrame(loop);}}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}

function snapshot(opt){
  opt=opt||{};
  if(!renderer||!scene)return null;
  const prev=rotY;
  const prevPos=camera.position.clone(), prevFov=camera.fov;
  if(opt.rotY!=null)rotY=opt.rotY;
  root.rotation.y=rotY;if(gRoot)gRoot.rotation.y=rotY;
  if(opt.close==='head'){
    camera.position.set(0,1.58,1.35);camera.lookAt(0,1.54,0);camera.fov=28;camera.updateProjectionMatrix();
  }else if(opt.close==='bust'){
    camera.position.set(0,1.35,2.05);camera.lookAt(0,1.22,0);camera.fov=28;camera.updateProjectionMatrix();
  }else{
    frame();
  }
  renderer.setClearColor(0x000000,0);
  renderer.clear();renderer.render(scene,camera);
  if(ghost||gGlb){gRoot.rotation.y=rotY;renderer.clearDepth();gScene.overrideMaterial=gDepth;renderer.render(gScene,camera);gScene.overrideMaterial=gColor;renderer.render(gScene,camera);}
  const url=renderer.domElement.toDataURL('image/png');
  rotY=prev;root.rotation.y=rotY;
  camera.position.copy(prevPos);camera.fov=prevFov;camera.lookAt(0,.86,0);camera.updateProjectionMatrix();
  dirty=true;
  return url;
}

const api={
  get failed(){return failed;},
  shapeOf,hexNum,normalizeLook,
  mount(el,opt={}){if(!el)return false;if(!init()){el.classList.add('noGL');return false;}
    host=el;
    el.appendChild(renderer.domElement);renderer.domElement._w=0;
    idleSpeed=opt.idle??.35;
    if(opt.start>0)state.start=opt.start;if(opt.goal>0)state.goal=opt.goal;
    state.kg=opt.kg??state.kg;state.ghostKg=opt.ghostKg??null;
    swayBase=readMode()==='glb'?0:rotY;phase=0;
    rebuild();
    if(ro)ro.disconnect();if(window.ResizeObserver){ro=new ResizeObserver(()=>{dirty=true;});ro.observe(el);}
    dirty=true;stop();start();return true;},
  setWeight(kg,ghostKg,opt){if(failed||!scene)return;state.ghostKg=ghostKg??null;
    if(opt&&opt.animate&&glbActive()&&glbShown){playMorph(kg,opt.ms||900);dirty=true;return;}
    morphAnim=null;state.kg=kg;if(glbActive()&&glbShown)glbShade();else rebuild();dirty=true;},
  setProgress(p,opt){p=clamp01(+p||0);const kg=state.start-(state.start-state.goal)*p;this.setWeight(kg,state.ghostKg,opt);},
  playPreview(ms){this.setProgress(0);this.setProgress(1,{animate:true,ms:ms||1600});},
  progressOf,blendOf,easeInOut,get morphReady(){return !!glb.morphReady;},get stageCount(){return (glb.stages||[]).length;},get visibleStage(){return glb.shown?glb.shown.p:null;},
  get mode(){return readMode();},get glbStatus(){return glb.status;},
  setMode(m){try{localStorage.setItem(MODE_KEY,m==='proc'?'proc':'glb');}catch(e){}if(!failed&&scene){if(m!=='proc')swayBase=0;rebuild();}},
  setIdle(v){idleSpeed=v;dirty=true;},
  setFace(){/* 사진은 아바타에 붙이지 않아요 */},
  setLook(o){look=normalizeLook(Object.assign({},look,o||{}));if(!failed&&scene&&readMode()==='proc')rebuild();},
  getLook(){return Object.assign({},look);},
  snapshot,setRotation(r){rotY=r;swayBase=r;dirty=true;},
  SKIN_HEX,HAIR_HEX,FACE_SCALE,LOOK_DEF,
};
window.DGAvatar=api;
if(typeof window.dgMountAvatar==='function')window.dgMountAvatar();
