// 다이어트 게임 0.4.7 — 기기 안 얼굴 분석 (MediaPipe Face Landmarker)
// 사진은 분석에만 쓰고 저장하지 않아요. 숫자 파라미터만 남습니다.
const FACE_MODEL_VER='0.10.21';
const PRIVACY='사진은 이 폰 안에서만 보고, 분석이 끝나면 버려요. 어디에도 올리지 않아요.';

const DEFAULTS={
  version:1,
  faceWidth:.5,faceLength:.5,jawWidth:.5,cheekWidth:.5,chin:.5,
  eyeSize:.5,eyeSpacing:.5,eyeTilt:.5,eyeColor:'#2a211d',
  browThick:.5,browAngle:.5,browColor:'#2b2522',
  noseWidth:.5,noseLength:.5,
  mouthWidth:.5,lipThick:.5,
  earY:.5,
  hairStyle:'short',hairColor:'#2b2522',hairVolume:.5,
  skin:'#f6c9a4',
  glasses:false,beard:'none'
};

const SKIN_HEX={light:'#f8d7c4',warm:'#f6c9a4',medium:'#c6865b',tan:'#a0643c',deep:'#6b3d26'};
const HAIR_HEX={black:'#1a1412',darkbrown:'#2b2522',brown:'#5a3a22',auburn:'#6b2e1f',blonde:'#c6a15b',gray:'#8a8680'};
const HAIR_STYLES=['buzz','short','side','curly','volume','long'];
const BEARDS=['none','stubble','short','full'];

// MediaPipe Face Mesh indices (478 with iris)
const I={
  forehead:10,chin:152,lCheek:234,rCheek:454,
  lJaw:172,rJaw:397,lJaw2:136,rJaw2:365,lChin:176,rChin:400,
  lMid:123,rMid:352,lCheekF:50,rCheekF:280,
  lEyeO:33,lEyeI:133,lEyeT:159,lEyeB:145,
  rEyeI:362,rEyeO:263,rEyeT:386,rEyeB:374,
  lIris:468,rIris:473,
  lBrowO:70,lBrowM:105,lBrowI:107,
  rBrowI:336,rBrowM:334,rBrowO:300,
  noseTip:1,noseBridge:6,noseRoot:168,noseBot:2,lAla:48,rAla:278,lAla2:64,rAla2:294,
  lMouth:61,rMouth:291,upLip:13,loLip:14,upOuter:0,loOuter:17,
  lEar:127,rEar:356,lEar2:93,rEar2:323
};

function clamp01(v){v=+v;if(!isFinite(v))return .5;return Math.max(0,Math.min(1,v));}
function hexify(n){const s=(Math.max(0,Math.min(255,n|0))).toString(16);return s.length<2?'0'+s:s;}
function rgbHex(r,g,b){return '#'+hexify(r)+hexify(g)+hexify(b);}
function dist(a,b){if(!a||!b)return 0;const dz=(a.z||0)-(b.z||0);return Math.hypot(a.x-b.x,a.y-b.y,dz);}
function distXY(a,b){if(!a||!b)return 0;return Math.hypot(a.x-b.x,a.y-b.y);}
function mid(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:((a.z||0)+(b.z||0))/2};}
function lerp(a,b,t){return a+(b-a)*t;}
function norm01(v,lo,hi){if(hi===lo)return .5;return clamp01((v-lo)/(hi-lo));}

function nearestNamed(hex, pal){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  let best=null,bd=1e12;
  Object.keys(pal).forEach(k=>{
    const p=pal[k],pr=parseInt(p.slice(1,3),16),pg=parseInt(p.slice(3,5),16),pb=parseInt(p.slice(5,7),16);
    const d=(pr-r)**2+(pg-g)**2+(pb-b)**2;
    if(d<bd){bd=d;best=k;}
  });
  return best;
}
function namedSkin(hex){return nearestNamed(hex,SKIN_HEX)||'warm';}
function namedHair(hex){return nearestNamed(hex,HAIR_HEX)||'darkbrown';}

function faceShapeOf(p){
  const ar=(.4+p.faceLength)/(.4+p.faceWidth);
  if(ar>=1.18&&p.faceWidth<.45)return 'long';
  if(p.faceWidth>.62&&p.faceLength<.45)return 'round';
  if(p.jawWidth>.62&&p.chin<.45)return 'square';
  return 'oval';
}

function fromLegacy(o){
  o=o||{};
  const p=Object.assign({},DEFAULTS);
  if(o.skin&&SKIN_HEX[o.skin])p.skin=SKIN_HEX[o.skin];
  else if(/^#/.test(o.skin))p.skin=o.skin;
  if(o.hairColor&&HAIR_HEX[o.hairColor])p.hairColor=HAIR_HEX[o.hairColor];
  else if(/^#/.test(o.hairColor))p.hairColor=o.hairColor;
  if(o.hairStyle&&HAIR_STYLES.includes(o.hairStyle))p.hairStyle=o.hairStyle;
  if(o.faceShape==='round'){p.faceWidth=.78;p.faceLength=.35;p.jawWidth=.7;p.chin=.35;}
  else if(o.faceShape==='long'){p.faceWidth=.28;p.faceLength=.82;p.jawWidth=.32;p.chin=.7;}
  else if(o.faceShape==='square'){p.faceWidth=.62;p.faceLength=.45;p.jawWidth=.82;p.chin=.22;}
  return p;
}

function sanitize(o){
  const p=Object.assign({},DEFAULTS,fromLegacy(o),o||{});
  // never keep images
  delete p.photo;delete p.photoDataUrl;delete p.image;delete p.dataUrl;delete p.face;
  Object.keys(DEFAULTS).forEach(k=>{
    const d=DEFAULTS[k];
    if(typeof d==='number')p[k]=clamp01(p[k]);
    else if(typeof d==='boolean')p[k]=!!p[k];
    else if(k==='hairStyle')p[k]=HAIR_STYLES.includes(p[k])?p[k]:'short';
    else if(k==='beard')p[k]=BEARDS.includes(p[k])?p[k]:'none';
    else if(typeof d==='string'&&d.startsWith('#')){
      const s=String(p[k]||d);
      p[k]=/^#[0-9a-fA-F]{6}$/.test(s)?s.toLowerCase():d;
    }
  });
  p.version=1;
  p.faceShape=faceShapeOf(p);
  p.skinName=namedSkin(p.skin);
  p.hairName=namedHair(p.hairColor);
  return p;
}

function sample(ctx,w,h,x,y,r){
  const px=Math.max(0,Math.min(w-1,Math.round(x*w)));
  const py=Math.max(0,Math.min(h-1,Math.round(y*h)));
  r=Math.max(1,r|0);
  const x0=Math.max(0,px-r),y0=Math.max(0,py-r),x1=Math.min(w,px+r+1),y1=Math.min(h,py+r+1);
  const data=ctx.getImageData(x0,y0,x1-x0,y1-y0).data;
  let sr=0,sg=0,sb=0,n=0;
  for(let i=0;i<data.length;i+=4){if(data[i+3]<80)continue;sr+=data[i];sg+=data[i+1];sb+=data[i+2];n++;}
  if(!n)return null;
  return {r:sr/n,g:sg/n,b:sb/n,n};
}
function lum(c){return c?.r==null?0:.299*c.r+.587*c.g+.114*c.b;}

function derive(landmarks, canvas, blendshapes){
  const lm=landmarks;
  const get=i=>lm[i];
  // shape ratios use 2D (image-plane) distances so camera depth does not flatten every face to "round"
  const faceH=distXY(get(I.forehead),get(I.chin))||1e-6;
  const faceW=distXY(get(I.lCheek),get(I.rCheek))||1e-6;
  const jawW=distXY(get(I.lJaw),get(I.rJaw))||distXY(get(I.lJaw2),get(I.rJaw2));
  const cheekW=distXY(get(I.lCheekF),get(I.rCheekF))||distXY(get(I.lMid),get(I.rMid));
  const chinW=distXY(get(I.lChin),get(I.rChin))||jawW*.7;
  const eyeWL=distXY(get(I.lEyeO),get(I.lEyeI)),eyeWR=distXY(get(I.rEyeO),get(I.rEyeI));
  const eyeHL=distXY(get(I.lEyeT),get(I.lEyeB)),eyeHR=distXY(get(I.rEyeT),get(I.rEyeB));
  const eyeW=(eyeWL+eyeWR)/2,eyeH=(eyeHL+eyeHR)/2;
  const space=distXY(get(I.lEyeI),get(I.rEyeI));
  const lTilt=Math.atan2(get(I.lEyeO).y-get(I.lEyeI).y,get(I.lEyeO).x-get(I.lEyeI).x);
  const rTilt=Math.atan2(get(I.rEyeI).y-get(I.rEyeO).y,get(I.rEyeI).x-get(I.rEyeO).x);
  const tilt=(lTilt+rTilt)/2; // ~0 is level; negative often slightly up on outer
  const browToEye=distXY(get(I.lBrowM),get(I.lEyeT));
  const browAng=Math.atan2(get(I.lBrowO).y-get(I.lBrowI).y,get(I.lBrowO).x-get(I.lBrowI).x);
  const noseW=distXY(get(I.lAla),get(I.rAla))||distXY(get(I.lAla2),get(I.rAla2));
  const noseL=distXY(get(I.noseRoot),get(I.noseTip))||distXY(get(I.noseBridge),get(I.noseBot));
  const mouthW=distXY(get(I.lMouth),get(I.rMouth));
  const lipIn=distXY(get(I.upLip),get(I.loLip));
  const lipOut=distXY(get(I.upOuter),get(I.loOuter));
  const earY=((get(I.lEar).y+get(I.rEar).y)/2-get(I.forehead).y)/faceH;

  const p=Object.assign({},DEFAULTS);
  p.faceWidth=norm01(faceW/faceH,0.62,0.92);
  p.faceLength=norm01(faceH/faceW,1.08,1.55);
  p.jawWidth=norm01(jawW/faceW,0.70,0.98);
  p.cheekWidth=norm01(cheekW/faceW,0.72,0.98);
  p.chin=norm01(1-(chinW/(jawW||1)),0.08,0.50);
  p.eyeSize=norm01((eyeH*2+eyeW)/faceH,0.08,0.22);
  p.eyeSpacing=norm01(space/faceW,0.20,0.38);
  p.eyeTilt=norm01(tilt,-0.18,0.18);
  p.browThick=norm01(browToEye/faceH,0.04,0.14);
  p.browAngle=norm01(browAng,-0.40,0.20);
  p.noseWidth=norm01(noseW/faceW,0.16,0.36);
  p.noseLength=norm01(noseL/faceH,0.16,0.34);
  p.mouthWidth=norm01(mouthW/faceW,0.30,0.52);
  p.lipThick=norm01((lipIn+lipOut)/faceH,0.04,0.14);
  p.earY=norm01(earY,0.25,0.55);

  // colors
  if(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const w=canvas.width,h=canvas.height;
    const skinPts=[I.lCheekF,I.rCheekF,I.lMid,I.rMid,I.forehead].map(get);
    const skinSamples=[];
    skinPts.forEach(pt=>{const c=sample(ctx,w,h,pt.x,pt.y,4);if(c)skinSamples.push(c);});
    skinSamples.sort((a,b)=>lum(a)-lum(b));
    const skinUse=skinSamples.length>=3?skinSamples.slice(0,Math.max(2,Math.ceil(skinSamples.length*.7))):skinSamples;
    let sr=0,sg=0,sb=0,sn=skinUse.length;
    skinUse.forEach(c=>{sr+=c.r;sg+=c.g;sb+=c.b;});
    if(sn)p.skin=rgbHex(sr/sn,sg/sn,sb/sn);
    const irisL=get(I.lIris)||mid(get(I.lEyeT),get(I.lEyeB));
    const irisR=get(I.rIris)||mid(get(I.rEyeT),get(I.rEyeB));
    const e1=sample(ctx,w,h,irisL.x,irisL.y,2),e2=sample(ctx,w,h,irisR.x,irisR.y,2);
    if(e1||e2){
      const e=e1&&e2?{r:(e1.r+e2.r)/2,g:(e1.g+e2.g)/2,b:(e1.b+e2.b)/2}: (e1||e2);
      // avoid specular white
      if(lum(e)<200)p.eyeColor=rgbHex(e.r*.7,e.g*.7,e.b*.7);
    }
    const b1=sample(ctx,w,h,get(I.lBrowM).x,get(I.lBrowM).y,2);
    const b2=sample(ctx,w,h,get(I.rBrowM).x,get(I.rBrowM).y,2);
    if(b1||b2){const b=b1&&b2?{r:(b1.r+b2.r)/2,g:(b1.g+b2.g)/2,b:(b1.b+b2.b)/2}:(b1||b2);p.browColor=rgbHex(b.r,b.g,b.b);}

    // hair region above forehead (no image-segmenter model — keep vendor small)
    const top=get(I.forehead);
    const hairBox={x0:Math.max(0,top.x-faceW*.55),x1:Math.min(1,top.x+faceW*.55),y0:Math.max(0,top.y-faceH*.38),y1:Math.max(0,top.y-faceH*.015)};
    const x0=Math.floor(hairBox.x0*w),x1=Math.ceil(hairBox.x1*w),y0=Math.floor(hairBox.y0*h),y1=Math.ceil(hairBox.y1*h);
    const cTL=sample(ctx,w,h,0.04,0.04,6),cTR=sample(ctx,w,h,0.96,0.04,6);
    const bg=cTL&&cTR?{r:(cTL.r+cTR.r)/2,g:(cTL.g+cTR.g)/2,b:(cTL.b+cTR.b)/2}:(cTL||cTR);
    let hr=0,hg=0,hb=0,hn=0,left=0,right=0,minY=h,maxY=0,maxX=0,minX=w;const hairPix=[];
    if(x1>x0&&y1>y0){
      const data=ctx.getImageData(x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0)).data;
      const bw=x1-x0;
      for(let yy=0;yy<y1-y0;yy++)for(let xx=0;xx<bw;xx++){
        const i=(yy*bw+xx)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        if(a<80)continue;
        const L=.299*r+.587*g+.114*b;
        if(L>210)continue;
        const chroma=Math.max(r,g,b)-Math.min(r,g,b);
        // skip flat studio backdrops (low-chroma mid-gray, or close to corner color)
        if(bg){
          const dBg=Math.abs(r-bg.r)+Math.abs(g-bg.g)+Math.abs(b-bg.b);
          if(dBg<48)continue;
        }
        if(chroma<18&&L>70&&L<200)continue;
        const skinL=lum({r:sr/Math.max(1,sn),g:sg/Math.max(1,sn),b:sb/Math.max(1,sn)});
        if(sn&&Math.abs(L-skinL)<18&&r>=g-5)continue;
        hairPix.push(r,g,b,L);
        hn++;
        const px=x0+xx,py=y0+yy;
        if(px<top.x*w)left++;else right++;
        if(py<minY)minY=py;if(py>maxY)maxY=py;if(px<minX)minX=px;if(px>maxX)maxX=px;
      }
    }
    if(hn>20){
      // darker half of hair pixels (highlights / backdrop leftovers skew the mean light)
      const idx=[...Array(hn).keys()].sort((i,j)=>hairPix[i*4+3]-hairPix[j*4+3]);
      const take=idx.slice(0,Math.max(8,Math.floor(hn*.55)));
      take.forEach(i=>{hr+=hairPix[i*4];hg+=hairPix[i*4+1];hb+=hairPix[i*4+2];});
      p.hairColor=rgbHex(hr/take.length,hg/take.length,hb/take.length);
      const hairL=lum({r:hr/take.length,g:hg/take.length,b:hb/take.length});
      const hairCh=Math.max(hr,hg,hb)/take.length-Math.min(hr,hg,hb)/take.length;
      const skinL0=lum({r:sr/Math.max(1,sn),g:sg/Math.max(1,sn),b:sb/Math.max(1,sn)});
      // tight buzz / highlight / backdrop leftovers: prefer a darker brow if hair came out too light or gray
      if((hairL>skinL0*0.92 || (hairCh<22&&hairL>70)) && p.browColor){
        const br=parseInt(p.browColor.slice(1,3),16),bg=parseInt(p.browColor.slice(3,5),16),bb=parseInt(p.browColor.slice(5,7),16);
        if(lum({r:br,g:bg,b:bb})<hairL-8) p.hairColor=p.browColor;
      }
      const hairH=(maxY-minY)/ (faceH*h);
      const hairW=(maxX-minX)/(faceW*w);
      p.hairVolume=norm01(hairH*hairW,0.3,2.2);
      const asym=Math.abs(left-right)/Math.max(1,hn);
      if(hn<60||hairH<.18)p.hairStyle='buzz';
      else if(asym>0.28)p.hairStyle='side';
      else if(hairH>0.85)p.hairStyle='long';
      else if(p.hairVolume>.7&&hairH>.45)p.hairStyle='volume';
      else if(p.hairVolume>.62)p.hairStyle='curly';
      else p.hairStyle='short';
    }

    // beard: dark pixels on jaw / under mouth
    const chin=get(I.chin), mouth=get(I.loOuter);
    let dark=0,tot=0,dr=0,dg=0,db=0;
    const jx0=Math.floor((get(I.lJaw).x)*w), jx1=Math.ceil((get(I.rJaw).x)*w);
    const jy0=Math.floor(mouth.y*h), jy1=Math.ceil((chin.y+faceH*.05)*h);
    if(jx1>jx0&&jy1>jy0){
      const data=ctx.getImageData(jx0,jy0,Math.max(1,jx1-jx0),Math.max(1,jy1-jy0)).data;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2],L=.299*r+.587*g+.114*b;
        tot++;
        const skinL=lum({r:sr/Math.max(1,sn),g:sg/Math.max(1,sn),b:sb/Math.max(1,sn)});
        if(L<skinL-28&&L<110){dark++;dr+=r;dg+=g;db+=b;}
      }
    }
    const frac=tot?dark/tot:0;
    if(frac>0.42)p.beard='full';
    else if(frac>0.26)p.beard='short';
    else if(frac>0.16)p.beard='stubble';
    else p.beard='none';

    // glasses: a thin dark ring around the eyes, darker than the eye interior (avoids dark-skin false positives)
    let frameDark=0,frameN=0,innerDark=0,innerN=0,eyesOk=0;
    const skinL=lum({r:sr/Math.max(1,sn),g:sg/Math.max(1,sn),b:sb/Math.max(1,sn)});
    for(const side of [[I.lEyeO,I.lEyeI,I.lEyeT,I.lEyeB],[I.rEyeO,I.rEyeI,I.rEyeT,I.rEyeB]]){
      const cx=(get(side[0]).x+get(side[1]).x)/2, cy=(get(side[2]).y+get(side[3]).y)/2;
      const rw=distXY(get(side[0]),get(side[1]))*0.95, rh=Math.max(rw*0.65,distXY(get(side[2]),get(side[3]))*1.35);
      const xa=Math.floor((cx-rw*1.8)*w), xb=Math.ceil((cx+rw*1.8)*w);
      const ya=Math.floor((cy-rh*1.6)*h), yb=Math.ceil((cy+rh*1.6)*h);
      if(xb<=xa||yb<=ya)continue;
      const data=ctx.getImageData(xa,ya,Math.max(1,xb-xa),Math.max(1,yb-ya)).data;
      const bw=xb-xa;
      let fd=0,fn=0,idk=0,inn=0;
      for(let yy=0;yy<yb-ya;yy++)for(let xx=0;xx<bw;xx++){
        const px=(xa+xx)/w, py=(ya+yy)/h;
        const rad=Math.hypot((px-cx)/rw,(py-cy)/rh);
        if(rad<0.55||rad>1.85)continue;
        const i=(yy*bw+xx)*4,L=.299*data[i]+.587*data[i+1]+.114*data[i+2];
        const isDark=L<skinL-28&&L<115;
        if(rad<1.12){inn++;if(isDark)idk++;}
        else if(rad>=1.22&&rad<=1.75){fn++;if(isDark)fd++;}
      }
      frameDark+=fd;frameN+=fn;innerDark+=idk;innerN+=inn;
      const fR=fn?fd/fn:0, iR=inn?idk/inn:0;
      if(fn>12&&fR>0.14&&fR>iR+0.08)eyesOk++;
    }
    p.glasses=eyesOk>=2||(eyesOk>=1&&frameN>40&&(frameDark/frameN)>(innerN?innerDark/innerN:0)+0.12);
  }

  return sanitize(p);
}

let landmarker=null,loadP=null;

function wasmBase(){
  try{return new URL('./vendor/mediapipe/wasm/', import.meta.url).href;}
  catch(e){return 'vendor/mediapipe/wasm/';}
}
function modelUrl(){
  try{return new URL('./vendor/mediapipe/face_landmarker.task', import.meta.url).href;}
  catch(e){return 'vendor/mediapipe/face_landmarker.task';}
}
function bundleUrl(){
  try{return new URL('./vendor/mediapipe/vision_bundle.mjs', import.meta.url).href;}
  catch(e){return './vendor/mediapipe/vision_bundle.mjs';}
}

async function loadLandmarker(){
  if(landmarker)return landmarker;
  if(loadP)return loadP;
  loadP=(async()=>{
    const mod=await import(bundleUrl());
    const {FaceLandmarker,FilesetResolver}=mod;
    const vision=await FilesetResolver.forVisionTasks(wasmBase());
    const opts={
      baseOptions:{modelAssetPath:modelUrl(),delegate:'GPU'},
      runningMode:'IMAGE',
      numFaces:1,
      outputFaceBlendshapes:true,
      outputFacialTransformationMatrixes:false
    };
    try{landmarker=await FaceLandmarker.createFromOptions(vision,opts);}
    catch(e){
      opts.baseOptions.delegate='CPU';
      landmarker=await FaceLandmarker.createFromOptions(vision,opts);
    }
    return landmarker;
  })();
  try{return await loadP;}finally{/* keep loadP to dedupe */}
}

function toCanvas(src,maxSide){
  maxSide=maxSide||512;
  const c=document.createElement('canvas');
  let w,h;
  if(src instanceof HTMLVideoElement){w=src.videoWidth;h=src.videoHeight;}
  else {w=src.naturalWidth||src.width;h=src.naturalHeight||src.height;}
  if(!w||!h)throw new Error('empty-image');
  const s=Math.min(1,maxSide/Math.max(w,h));
  c.width=Math.max(1,Math.round(w*s));c.height=Math.max(1,Math.round(h*s));
  const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(src,0,0,c.width,c.height);
  return c;
}

async function analyze(src){
  const t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  const lm=await loadLandmarker();
  const canvas=toCanvas(src,512);
  const res=lm.detect(canvas);
  const faces=res&&res.faceLandmarks||[];
  if(!faces.length){
    const err=new Error('no-face');
    err.code='no-face';
    throw err;
  }
  const params=derive(faces[0],canvas,res.faceBlendshapes&&res.faceBlendshapes[0]);
  const dt=((typeof performance!=='undefined'&&performance.now)?performance.now():Date.now())-t0;
  params._ms=Math.round(dt);
  params._points=faces[0].length;
  // drop canvas pixels — caller must also drop the source photo
  try{const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);}catch(e){}
  return sanitize(params);
}

const api={
  PRIVACY,DEFAULTS,SKIN_HEX,HAIR_HEX,HAIR_STYLES,BEARDS,I,FACE_MODEL_VER,
  clamp01,sanitize,fromLegacy,derive,analyze,loadLandmarker,faceShapeOf,namedSkin,namedHair,dist,distXY,norm01
};
if(typeof window!=='undefined')window.DGFace=api;
export default api;
