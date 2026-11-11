// 다이어트 게임 0.4.3 — 건강검진 PDF 분석·관리 퀘스트 (기기 안에서만, dg_health_v1)
(function(root){
const HKEY='dg_health_v1';
const R=root.DG_HEALTH_RANGES||(typeof DG_HEALTH_RANGES!=='undefined'?DG_HEALTH_RANGES:{items:{},source:{}});
const ITEMS=R.items||{};
const DISCLAIMER=(R.source&&R.source.disclaimer)||'진단이 아니에요. 정확한 판단은 의사에게 받으세요.';
const HQ_XP={walk15:5,nosugar:5,lowsalt:5,homebp:5,noalcohol:5,nofry:5,veggie:5};
const HQ_CAP=30;
const QUESTS=[
  {id:'walk15',title:'식후 15분 걷기',when:'daily',xp:5,flags:['glucose'],desc:'식사 후 가볍게 15분만 걸어 보세요.'},
  {id:'nosugar',title:'단 음료 0',when:'daily',xp:5,flags:['glucose'],desc:'오늘 달콤한 음료는 건너뛰어 보세요.'},
  {id:'lowsalt',title:'저염 식사',when:'daily',xp:5,flags:['bp'],desc:'국물·짠 반찬을 줄여 보세요.'},
  {id:'homebp',title:'집에서 혈압 재기',when:'daily',xp:5,flags:['bp'],desc:'편한 시간에 한 번 재고 기록해 보세요.',extra:'bp_log'},
  {id:'noalcohol',title:'오늘은 금주',when:'daily',xp:5,flags:['liver'],desc:'간 수치가 높아 보일 땐 술을 쉬어 보세요.'},
  {id:'nofry',title:'튀김 피하기',when:'daily',xp:5,flags:['lipid'],desc:'오늘은 튀긴 음식 대신 굽거나 찐 음식으로.'},
  {id:'veggie',title:'채소 한 접시',when:'daily',xp:5,flags:['bmi'],desc:'식사에 채소를 한 접시 더해 보세요.'}
];
const FIELDS=['date','sbp','dbp','fpg','hba1c','tc','ldl','hdl','tg','ast','alt','ggtp','creat','egfr','hb','uprotein','waist','bmi','weight'];
const SYN={
  sbp:[/수축기\s*(혈압)?/,/최고\s*혈압/,/\bSBP\b/i,/systolic/i],
  dbp:[/이완기\s*(혈압)?/,/최저\s*혈압/,/\bDBP\b/i,/diastolic/i],
  fpg:[/공복\s*혈당/,/식전\s*혈당/,/\bFBS\b/i,/\bFPG\b/i,/fasting\s*glucose/i,/(?<![당화])혈당(?!\s*조절)/],
  hba1c:[/당화\s*혈색소/,/HbA1c/i,/\bA1C\b/i,/glycated\s*hemoglobin/i],
  tc:[/총\s*콜레스테롤/,/Total\s*cholesterol/i,/\bT-?Chol\b/i,/\bTC\b(?![A-Z])/],
  ldl:[/LDL\s*-?\s*(C|콜레스테롤)?/i,/저밀도\s*(콜레스테롤)?/],
  hdl:[/HDL\s*-?\s*(C|콜레스테롤)?/i,/고밀도\s*(콜레스테롤)?/],
  tg:[/중성\s*지방/,/\bTG\b/,/triglyceride/i,/트리글리세라이드/],
  ast:[/\bAST\b/,/\bSGOT\b/,/\bGOT\b(?!\w)/],
  alt:[/\bALT\b/,/\bSGPT\b/,/\bGPT\b(?!\w)/],
  ggtp:[/[γrΓ]\s*-?\s*GTP/i,/감마\s*(지티피|GTP)/i,/\bGGT\b/i,/\bGTP\b/],
  creat:[/혈청\s*크레아티닌/,/크레아티닌/,/creatinine/i,/\b(s)?Cr\b/],
  egfr:[/e-?\s*GFR/i,/신사구체\s*여과율/,/\bGFR\b/],
  hb:[/헤모글로빈/,/(?<!당화\s*)혈색소/,/hemoglobin/i,/\bHgb\b/i,/\bHb\b(?!A)/],
  uprotein:[/요\s*단백/,/단백뇨/,/urine\s*protein/i],
  waist:[/허리\s*둘레/,/waist\s*(circ)?/i],
  bmi:[/\bBMI\b/,/체질량\s*지수/,/비만도/],
  weight:[/(?<![감목표현재시작])체중/,/몸무게/,/\bweight\b/i]
};

function fw(s){return String(s).replace(/[０-９]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-65248)).replace(/[．]/g,'.').replace(/[／／]/g,'/').replace(/㎎/g,'mg').replace(/㎗/g,'dL').replace(/㎏/g,'kg').replace(/\u00a0/g,' ');}
function norm(s){return fw(s).replace(/Γ|ɤ|𝛾|ɣ/g,'γ').replace(/ｇ/g,'g').replace(/[ \t]+/g,' ').replace(/\r\n?/g,'\n');}
function emptyStore(){return {checkups:[],homeBp:[],reminder:null};}
function loadHealth(){
  try{const x=JSON.parse((root.localStorage&&localStorage.getItem(HKEY))||'null');
    if(x&&Array.isArray(x.checkups))return x;}catch(e){}
  return emptyStore();
}
function saveHealth(data){
  if(!root.localStorage)return;
  try{localStorage.setItem(HKEY,JSON.stringify(data));}catch(e){if(typeof toast==='function')toast('저장 공간이 부족해요');}
  // never schedulePush — 검진 값은 계정에 올리지 않음
}
function byDate(list){return (list||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));}
function latest(){const d=byDate(loadHealth().checkups);return d.length?d[d.length-1]:null;}
function urineLevel(v){
  if(v==null||v==='')return null;
  const s=String(v).trim();
  if(/음성|negativ|^-$|^[-–—]$|^\(-?\)$/i.test(s))return 'ok';
  if(/약양성|±|\+\/-|\(\s*\+\s*-\s*\)|trace/i.test(s))return 'warn';
  if(/양성|\+|pos|\+1|\+2|\+3|\+4|1\+|2\+|3\+|4\+/i.test(s))return 'risk';
  return null;
}
function levelOf(item,value,sex){
  if(value==null||value==='')return null;
  const spec=ITEMS[item];if(!spec)return null;
  if(spec.kind==='record')return {level:'info',label:'기록'};
  if(spec.kind==='urine'){
    const lv=urineLevel(value);
    return lv?{level:lv,label:lv==='ok'?'정상':lv==='warn'?'주의':'위험(의심)'}:null;
  }
  const n=+value;if(!isFinite(n))return null;
  sex=sex==='f'?'f':'m';
  const sx=spec.bySex&&spec.bySex[sex];
  if(item==='bmi'){
    if(n<18.5)return {level:'warn',label:'주의'};
    if(n<=24.9)return {level:'ok',label:'정상'};
    if(n<=29.9)return {level:'warn',label:'주의'};
    return {level:'risk',label:'위험(의심)'};
  }
  if(item==='waist'&&sx){
    if(n<(sx.riskMin))return {level:'ok',label:'정상'};
    return {level:'risk',label:'위험(의심)'};
  }
  if(item==='hb'&&sx){
    if(n>=sx.okMin&&n<=sx.okMax)return {level:'ok',label:'정상'};
    if(n>=sx.warnMin&&n<sx.okMin)return {level:'warn',label:'주의'};
    if(n<sx.warnMin)return {level:'risk',label:'위험(의심)'};
    if(n>sx.okMax)return {level:'warn',label:'주의'};
  }
  if(item==='ggtp'&&sx){
    if(n>=sx.okMin&&n<=sx.okMax)return {level:'ok',label:'정상'};
    if(n>sx.okMax&&n<=sx.warnMax)return {level:'warn',label:'주의'};
    if(n>sx.warnMax)return {level:'risk',label:'위험(의심)'};
    if(n<sx.okMin)return {level:'warn',label:'주의'};
  }
  if(spec.higherBad===false){
    if(spec.okMin!=null&&n>=spec.okMin)return {level:'ok',label:'정상'};
    if(spec.warnMin!=null&&n>=spec.warnMin)return {level:'warn',label:'주의'};
    if(spec.okMin!=null&&n<spec.okMin)return {level:'risk',label:'위험(의심)'};
  }
  if(spec.okMax!=null){
    if(n<=spec.okMax)return {level:'ok',label:'정상'};
    if(spec.warnMax!=null&&n<=spec.warnMax)return {level:'warn',label:'주의'};
    return {level:'risk',label:'위험(의심)'};
  }
  return null;
}
function overallBp(values){
  const s=values.sbp,d=values.dbp;
  if(s==null&&d==null)return null;
  const sl=s!=null?levelOf('sbp',s):null, dl=d!=null?levelOf('dbp',d):null;
  const rank={ok:1,warn:2,risk:3};
  const worst=(sl&&dl)?(rank[sl.level]>=rank[dl.level]?sl:dl):(sl||dl);
  return worst;
}
function conditions(values,sex){
  const out=[];
  const bp=overallBp(values);
  if(bp&&bp.level==='risk')out.push({code:'htn',text:'고혈압 의심',level:'risk'});
  else if(bp&&bp.level==='warn')out.push({code:'htn',text:'고혈압 전단계',level:'warn'});
  const g=levelOf('fpg',values.fpg)||levelOf('hba1c',values.hba1c);
  const g2=[levelOf('fpg',values.fpg),levelOf('hba1c',values.hba1c)].filter(Boolean);
  const gWorst=g2.sort((a,b)=>({ok:1,warn:2,risk:3}[b.level]-{ok:1,warn:2,risk:3}[a.level]))[0];
  if(gWorst&&gWorst.level==='risk')out.push({code:'dm',text:'당뇨병 의심',level:'risk'});
  else if(gWorst&&gWorst.level==='warn')out.push({code:'dm',text:'당뇨 전단계',level:'warn'});
  const lip=['tc','ldl','hdl','tg'].map(k=>levelOf(k,values[k],sex)).filter(x=>x&&x.level!=='ok'&&x.level!=='info');
  if(lip.some(x=>x.level==='risk'))out.push({code:'lipid',text:'이상지질혈증 의심',level:'risk'});
  else if(lip.length)out.push({code:'lipid',text:'이상지질혈증 주의',level:'warn'});
  const liv=['ast','alt','ggtp'].map(k=>levelOf(k,values[k],sex)).filter(x=>x&&x.level!=='ok');
  if(liv.some(x=>x.level==='risk'))out.push({code:'liver',text:'지방간 의심',level:'risk'});
  else if(liv.length)out.push({code:'liver',text:'간기능 주의',level:'warn'});
  const bmi=levelOf('bmi',values.bmi,sex);
  if(bmi&&values.bmi>=30)out.push({code:'bmi',text:'비만',level:'risk'});
  else if(bmi&&values.bmi>=25)out.push({code:'bmi',text:'과체중',level:'warn'});
  else if(bmi&&values.bmi<18.5)out.push({code:'bmi',text:'저체중',level:'warn'});
  const w=levelOf('waist',values.waist,sex);
  if(w&&w.level==='risk')out.push({code:'waist',text:'복부비만',level:'risk'});
  const kid=[levelOf('creat',values.creat,sex),levelOf('egfr',values.egfr,sex)].filter(x=>x&&x.level!=='ok');
  if(kid.length)out.push({code:'kidney',text:'신장기능 이상 의심',level:kid.some(x=>x.level==='risk')?'risk':'warn'});
  const up=levelOf('uprotein',values.uprotein,sex);
  if(up&&up.level==='risk')out.push({code:'uprotein',text:'단백뇨 의심',level:'risk'});
  else if(up&&up.level==='warn')out.push({code:'uprotein',text:'요단백 주의',level:'warn'});
  const hb=levelOf('hb',values.hb,sex);
  if(hb&&hb.level==='risk')out.push({code:'anemia',text:'빈혈 의심',level:'risk'});
  else if(hb&&hb.level==='warn'&&values.hb<13)out.push({code:'anemia',text:'빈혈 주의',level:'warn'});
  return out;
}
function classify(values,sex){
  sex=sex==='f'?'f':'m';
  const rows=[];
  for(const k of FIELDS){
    if(k==='date')continue;
    const spec=ITEMS[k];if(!spec)continue;
    if(values[k]==null||values[k]==='')continue;
    const lv=levelOf(k,values[k],sex);
    rows.push({key:k,name:spec.name,unit:spec.unit,value:values[k],group:spec.group,level:lv?lv.level:'info',label:lv?lv.label:'기록'});
  }
  const bp=overallBp(values);
  return {rows,conditions:conditions(values,sex),bp,sex};
}
function flagGroups(cls){
  const g=new Set();
  (cls.conditions||[]).forEach(c=>{
    if(c.code==='htn')g.add('bp');
    if(c.code==='dm')g.add('glucose');
    if(c.code==='lipid')g.add('lipid');
    if(c.code==='liver')g.add('liver');
    if(c.code==='bmi'||c.code==='waist')g.add('bmi');
    if(c.code==='kidney'||c.code==='uprotein')g.add('kidney');
  });
  return g;
}
function questsFor(cls){
  const g=flagGroups(cls);
  return QUESTS.filter(q=>q.flags.some(f=>g.has(f)));
}
function reminderDate(checkup){
  const cls=classify(checkup.values||{},checkup.sex);
  const risk=(cls.conditions||[]).some(c=>c.level==='risk');
  const base=checkup.date||(typeof today==='function'?today():'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(base))return null;
  const d=new Date(base+'T00:00:00+09:00');
  d.setDate(d.getDate()+(risk?90:730));
  return d.toISOString().slice(0,10);
}

function plausible(key,n){
  const p=ITEMS[key]&&ITEMS[key].plausible;if(!p)return true;
  return n>=p[0]&&n<=p[1];
}
function grabNum(str,key){
  const m=String(str).match(/(\d{1,4}(?:\.\d{1,2})?)/);
  if(!m)return null;
  const n=+m[1];
  return plausible(key,n)?n:null;
}
function parseDate(text){
  const t=norm(text);
  const labeled=t.match(/(검진\s*일(?:자)?|검사\s*일(?:자)?|수검\s*일(?:자)?|실시\s*일(?:자)?)\s*[:：]?\s*(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
  const any=t.match(/(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
  const m=labeled||any;
  if(!m)return '';
  const y=labeled?m[2]:m[1],mo=labeled?m[3]:m[2],da=labeled?m[4]:m[3];
  const mm=('0'+mo).slice(-2),dd=('0'+da).slice(-2);
  if(+mo<1||+mo>12||+da<1||+da>31)return '';
  return y+'-'+mm+'-'+dd;
}
function parseUrine(chunk){
  const s=chunk.slice(0,40);
  const m=s.match(/음성(?:\s*\(\s*-\s*\))?|약양성|\(\s*\+\s*-\s*\)|양성(?:\s*\(\s*\++\s*\))?|\+\/-|[±]|\+{1,4}|[1-4]\s*\+|음성|-|trace/i);
  if(!m)return '';
  const v=m[0];
  if(/약양성|±|\+\/-/.test(v))return '±';
  if(/양성|\+/.test(v)&&!/약양성/.test(v))return v.replace(/\s/g,'');
  if(/음성|^-$/.test(v))return '음성';
  return v;
}
function findAfter(text,re,key){
  const t=norm(text);
  const flags=re.ignoreCase?'gi':'g';
  const rx=new RegExp(re.source,flags);
  let best=null,m;
  while((m=rx.exec(t))){
    const slice=t.slice(m.index+m[0].length,m.index+m[0].length+80);
    if(key==='uprotein'){const u=parseUrine(slice);if(u)return u;continue;}
    // skip reference-like "100 미만" as first number if a measurement exists before unit + 참고
    const nums=[];
    const nr=/(\d{1,4}(?:\.\d{1,2})?)/g;let nm;
    while((nm=nr.exec(slice))&&nums.length<3){
      const n=+nm[1];
      if(plausible(key,n))nums.push({n,at:nm.index,ctx:slice.slice(Math.max(0,nm.index-8),nm.index+nm[1].length+10)});
    }
    if(!nums.length)continue;
    // prefer first number not clearly a reference (미만/이하/이상/~ 앞에 있음)
    const meas=nums.find(x=>!/(미만|이하|이상|초과|이하|~\s*$|～)/.test(slice.slice(0,x.at)))||nums[0];
    if(!best||m.index<best.idx)best={val:meas.n,idx:m.index};
  }
  return best?best.val:null;
}
function parseText(raw){
  const text=norm(raw||'');
  const values={};
  const bp=text.match(/(?:혈압|BP)[^\d]{0,24}(\d{2,3})\s*[/／]\s*(\d{2,3})/i);
  if(bp&&plausible('sbp',+bp[1])&&plausible('dbp',+bp[2])){values.sbp=+bp[1];values.dbp=+bp[2];}
  const bp2=text.match(/(\d{2,3})\s*[/／]\s*(\d{2,3})\s*mmHg/i);
  if(!values.sbp&&bp2&&plausible('sbp',+bp2[1])&&plausible('dbp',+bp2[2])){values.sbp=+bp2[1];values.dbp=+bp2[2];}
  for(const key of Object.keys(SYN)){
    if(values[key]!=null&&values[key]!=='')continue;
    for(const re of SYN[key]){
      try{
        const v=findAfter(text,re,key);
        if(v!=null&&v!==''){values[key]=v;break;}
      }catch(e){}
    }
  }
  values.date=parseDate(text);
  // BMI from weight + known height if missing
  if(values.bmi==null&&values.weight&&typeof HEIGHT==='number'&&HEIGHT>0){
    const bmi=+(values.weight/Math.pow(HEIGHT/100,2)).toFixed(1);
    if(plausible('bmi',bmi))values.bmi=bmi;
  }
  return values;
}

function hasMeaningfulText(t){return String(t||'').replace(/\s+/g,'').length>=40;}

async function extractPdfFile(file){
  const buf=await file.arrayBuffer();
  const data=new Uint8Array(buf);
  const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('vendor/pdfjs/pdf.worker.min.mjs',location.href).href;
  const doc=await pdfjs.getDocument({data,disableRange:true,disableStream:true}).promise;
  let text='';
  const pages=Math.min(doc.numPages,8);
  for(let i=1;i<=pages;i++){
    const page=await doc.getPage(i);
    const tc=await page.getTextContent();
    const line=tc.items.map(it=>it.str).join(' ');
    text+=line+'\n';
  }
  let usedOcr=false,ocrError=null;
  if(!hasMeaningfulText(text)){
    try{
      text=await ocrDocument(doc,pages);
      usedOcr=true;
    }catch(e){
      ocrError=e&&e.message?e.message:'ocr';
    }
  }
  try{doc.destroy();}catch(e){}
  return {text,values:parseText(text),usedOcr,ocrError,hadText:hasMeaningfulText(text)};
}

function appBase(){let p=location.pathname.replace(/index\.html$/,'');if(!p.endsWith('/'))p+='/';return location.origin+p;}

async function ocrDocument(doc,pages){
  await loadTesseract();
  const T=root.Tesseract;
  if(!T)throw new Error('ocr-unavailable');
  const base=appBase();
  const worker=await T.createWorker('kor+eng',1,{
    workerPath:base+'vendor/tesseract/worker.min.js',
    corePath:base+'vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
    langPath:base+'vendor/tesseract/lang',
    workerBlobURL:false,
    gzip:false
  });
  let text='';
  try{
    const n=Math.min(pages,3);
    for(let i=1;i<=n;i++){
      const page=await doc.getPage(i);
      const vp=page.getViewport({scale:1.6});
      const canvas=document.createElement('canvas');
      canvas.width=vp.width;canvas.height=vp.height;
      const ctx=canvas.getContext('2d');
      await page.render({canvasContext:ctx,viewport:vp}).promise;
      const res=await worker.recognize(canvas);
      text+=(res&&res.data&&res.data.text)||'';
      text+='\n';
    }
  }finally{
    try{await worker.terminate();}catch(e){}
  }
  return text;
}
function loadTesseract(){
  return new Promise((res,rej)=>{
    if(root.Tesseract)return res(root.Tesseract);
    const s=document.createElement('script');
    s.src='vendor/tesseract/tesseract.min.js';
    s.onload=()=>root.Tesseract?res(root.Tesseract):rej(new Error('ocr-unavailable'));
    s.onerror=()=>rej(new Error('ocr-unavailable'));
    document.head.appendChild(s);
  });
}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

let paneMode=null, draft=null;

function openPane(mode,data){paneMode=mode;if(data)draft=data;renderPane();}
function closePane(){paneMode=null;draft=null;const el=$('#healthPane');if(el)el.remove();if(typeof render==='function')render();}

function ensurePane(){
  let el=$('#healthPane');
  if(!el){el=document.createElement('div');el.id='healthPane';el.className='health-pane';document.body.appendChild(el);}
  return el;
}
function fieldInput(key,val){
  const spec=ITEMS[key]||{name:key,unit:''};
  if(key==='date')return `<label class="field"><span class="label">검진일</span><input class="input" data-hk="date" type="date" value="${esc(val||'')}"></label>`;
  if(key==='uprotein')return `<label class="field"><span class="label">${esc(spec.name)}</span>
    <select class="input" data-hk="uprotein"><option value="">모름</option>
      <option${val==='음성'?' selected':''}>음성</option><option${val==='±'?' selected':''}>±</option>
      <option${val==='+'||val==='1+'||val==='+1'?' selected':''}>+</option>
      <option${val==='++'||val==='2+'?' selected':''}>++</option>
      <option${val==='+++'||val==='3+'?' selected':''}>+++</option></select></label>`;
  return `<label class="field"><span class="label">${esc(spec.name)} ${spec.unit?`<span class="muted">(${esc(spec.unit)})</span>`:''}</span>
    <input class="input" data-hk="${key}" inputmode="decimal" value="${val==null||val===''?'':esc(val)}" placeholder="없으면 비워 두세요"></label>`;
}
function readDraftForm(){
  const values={};let sex='m';
  document.querySelectorAll('#healthPane [data-hk]').forEach(el=>{
    const k=el.getAttribute('data-hk');let v=el.value.trim();
    if(k==='date'||k==='uprotein')values[k]=v;else values[k]=v===''?null:+v;
  });
  const sx=$('#healthPane [name=hsex]');if(sx)sex=sx.value==='f'?'f':'m';
  if(values.bmi==null&&values.weight&&typeof HEIGHT==='number'){
    values.bmi=+((values.weight)/Math.pow(HEIGHT/100,2)).toFixed(1);
  }
  return {values,sex};
}
function renderPane(){
  if(!paneMode){const el=$('#healthPane');if(el)el.remove();return;}
  const el=ensurePane();
  if(paneMode==='confirm')el.innerHTML=confirmHTML(draft||{values:{},sex:'m',meta:{}});
  else if(paneMode==='detail')el.innerHTML=detailHTML(draft||latest());
  else if(paneMode==='busy')el.innerHTML=busyHTML(draft&&draft.msg);
  el.scrollTop=0;
}
function busyHTML(msg){return `<div class="health-sheet"><div class="card"><h3>검진 기록을 읽고 있어요</h3><p class="muted">${esc(msg||'이 폰 안에서만 처리하고, 파일은 어디에도 올리지 않아요.')}</p></div></div>`;}
function confirmHTML(d){
  const v=d.values||{};
  const found=FIELDS.filter(k=>k!=='date'&&v[k]!=null&&v[k]!=='').length;
  const note=d.meta&&d.meta.ocrError?`<div class="banner warn">글자를 읽지 못했어요. 사진만 있는 자료일 수 있어요. 아래에서 직접 적어 주세요.</div>`:
    (d.meta&&d.meta.usedOcr?`<div class="banner flat">글자 층이 없어서 화면 인식으로 읽었어요. 숫자를 한 번 확인해 주세요.</div>`:
    (found?`<div class="muted">찾은 항목 ${found}개. 틀린 칸은 고치고, 없는 칸은 비워 두거나 직접 적어 주세요.</div>`:`<div class="banner flat">자동으로 숫자를 찾지 못했어요. 아래에서 직접 적어 주세요.</div>`));
  return `<div class="health-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">검진 값 확인</h2><button type="button" class="btn-ghost btn-sm" onclick="DGHealth.close()">닫기</button></div>
    ${note}
    <div class="card">
      ${fieldInput('date',v.date)}
      <div class="rowx" style="margin:10px 0"><label class="field"><span class="label">성별 (일부 기준에 필요)</span>
        <select class="input" name="hsex"><option value="m"${d.sex!=='f'?' selected':''}>남성</option><option value="f"${d.sex==='f'?' selected':''}>여성</option></select></label></div>
      <div class="grid2">${FIELDS.filter(k=>k!=='date').map(k=>fieldInput(k,v[k])).join('')}</div>
    </div>
    <p class="muted">${esc(DISCLAIMER)}</p>
    <button type="button" class="btn-primary btn-lg" onclick="DGHealth.saveDraft()">저장하고 분석 보기</button>
  </div>`;
}
function levelChip(lv){
  const cls=lv==='risk'?'risk':lv==='warn'?'warn':'ok';
  const lab=lv==='risk'?'위험(의심)':lv==='warn'?'주의':lv==='info'?'기록':'정상';
  return `<span class="hchip ${cls}">${lab}</span>`;
}
function detailHTML(cu){
  if(!cu)return `<div class="health-sheet"><div class="card">기록이 없어요.</div><button type="button" class="btn-secondary btn-block" onclick="DGHealth.close()">닫기</button></div>`;
  const cls=classify(cu.values||{},cu.sex);
  const store=loadHealth();
  const trend=trendHTML(store.checkups,cu);
  const qs=questsFor(cls);
  const rem=reminderDate(cu);
  return `<div class="health-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">검진 분석</h2><button type="button" class="btn-ghost btn-sm" onclick="DGHealth.close()">닫기</button></div>
    <div class="banner warn">${esc(DISCLAIMER)}</div>
    <div class="muted" style="margin-bottom:8px">검진일 ${esc(cu.date||'모름')} · ${cu.sex==='f'?'여성':'남성'}</div>
    ${cls.conditions.length?`<div class="card"><h3>이렇게 보여요</h3>${cls.conditions.map(c=>`<div class="list-row"><div class="m"><b>${esc(c.text)}</b></div>${levelChip(c.level)}</div>`).join('')}</div>`:
      `<div class="card"><h3>이렇게 보여요</h3><div class="muted">입력한 항목은 참고 범위 안에 있어요. 그래도 불편하면 의사와 상의해 주세요.</div></div>`}
    <div class="card"><h3>항목별</h3>${cls.rows.map(r=>`<div class="list-row"><div class="m"><b>${esc(r.name)}</b><span class="num">${esc(r.value)}${r.unit?' '+r.unit:''}</span></div>${levelChip(r.level)}</div>`).join('')||'<div class="muted">값이 없어요.</div>'}</div>
    ${trend}
    ${qs.length?`<div class="card"><h3>관리 퀘스트</h3><div class="muted" style="margin-bottom:8px">표시된 항목을 바탕으로 오늘 할 일을 만들었어요. 하루 최대 +${HQ_CAP} XP.</div>${qs.map(q=>`<div class="list-row"><div class="m"><b>${esc(q.title)}</b><span>${esc(q.desc)} · +${q.xp} XP</span></div></div>`).join('')}<button type="button" class="btn-secondary btn-block" onclick="DGHealth.close();tab='quest';render()">퀘스트에서 체크하기</button></div>`:''}
    ${rem?`<div class="card"><h3>다음 검진 제안</h3><div class="num" style="font-weight:800;font-size:20px">${rem}</div><div class="muted">${(cls.conditions||[]).some(c=>c.level==='risk')?'위험(의심) 항목이 있어 약 3개월 뒤 재검을 제안해요.':'정기 국가건강검진 주기(2년)를 참고한 제안이에요.'} 실제 일정은 의사·안내문 기준이 맞아요.</div></div>`:''}
    <div class="muted" style="font-size:12px;margin:8px 0">${esc(R.source.main||'')} ${R.source.hba1c?esc(R.source.hba1c):''}</div>
    <button type="button" class="btn-secondary btn-block" onclick="DGHealth.editCurrent()">값 고치기</button>
    <button type="button" class="btn-ghost btn-block" style="color:var(--coral-600);margin-top:8px" onclick="DGHealth.wipe()">검진 기록 삭제</button>
  </div>`;
}
function trendHTML(list,cur){
  if(!list||list.length<2||!cur)return '';
  const keys=['fpg','hba1c','sbp','dbp','ldl','tg','ast','alt','bmi','weight'];
  const sorted=byDate(list);
  let i=cur.id!=null?sorted.findIndex(c=>c.id===cur.id):-1;
  if(i<0&&cur.date)i=sorted.findIndex(c=>c.date===cur.date);
  if(i<0)i=sorted.length-1;
  let from=null,to=null,title='이전 검진과 비교';
  if(i>0){from=sorted[i-1];to=sorted[i];}
  else if(i>=0&&i<sorted.length-1){from=sorted[i];to=sorted[i+1];title='다음 검진과 비교';}
  if(!from||!to)return '';
  const rows=keys.map(k=>{
    const a=from.values&&from.values[k],b=to.values&&to.values[k];
    if(a==null||b==null||a===''||b==='')return '';
    if(ITEMS[k]&&ITEMS[k].kind==='urine')return '';
    const d=+(+b-+a).toFixed(1);
    const arrow=d===0?'비슷':(d>0?'+'+d:'−'+Math.abs(d));
    // These keys: lower is generally better (HDL/eGFR are not in this list).
    const cls=d===0?'same':(d<0?'better':'worse');
    return `<div class="list-row"><div class="m"><b>${esc(ITEMS[k].name)}</b><span class="num">${a} → ${b}</span></div><span class="x ${cls}">${arrow}</span></div>`;
  }).filter(Boolean).join('');
  if(!rows)return '';
  return `<div class="card"><h3>${title}</h3><div class="muted">${esc(from.date||'이전')} → ${esc(to.date||'이번')} · ${list.length}회 기록</div>${rows}</div>`;
}

function pickPdf(){
  let inp=$('#healthPdf');
  if(!inp){inp=document.createElement('input');inp.type='file';inp.accept='application/pdf,.pdf';inp.id='healthPdf';inp.style.display='none';
    inp.onchange=()=>{const f=inp.files&&inp.files[0];inp.value='';if(f)importFile(f);};
    document.body.appendChild(inp);}
  inp.click();
}
async function importFile(file){
  if(!file)return;
  if(file.type&&file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name||'')){if(typeof toast==='function')toast('PDF 파일만 불러올 수 있어요');return;}
  openPane('busy',{msg:'PDF를 이 폰 안에서 읽고 있어요. 어디에도 올리지 않아요.'});
  try{
    const out=await extractPdfFile(file);
    openPane('confirm',{values:out.values||{},sex:'m',meta:out});
  }catch(e){
    openPane('confirm',{values:{},sex:'m',meta:{ocrError:true,hadText:false}});
    if(typeof toast==='function')toast('파일을 읽지 못했어요. 직접 입력해 주세요');
  }
}
function openManual(){openPane('confirm',{values:{date:(typeof today==='function'?today():'')},sex:'m',meta:{manual:true}});}
function saveDraft(){
  const {values,sex}=readDraftForm();
  const has=FIELDS.some(k=>k!=='date'&&values[k]!=null&&values[k]!=='');
  if(!has){if(typeof toast==='function')toast('값을 하나 이상 적어 주세요');return;}
  const store=loadHealth();
  const first=!store.checkups.length;
  const rec={id:(typeof withId==='function'?withId({}).id:Date.now().toString(36)),date:values.date||(typeof today==='function'?today():''),sex,values,source:draft&&draft.meta&&draft.meta.manual?'manual':'pdf'};
  store.checkups.push(rec);
  store.reminder=reminderDate(rec);
  saveHealth(store);
  if(first&&typeof raw!=='undefined'&&typeof withId==='function'&&typeof today==='function'){
    if(!raw.some(e=>e.type==='achievement'&&e.item==='검진 등록')){
      raw.push(withId({date:today(),type:'achievement',item:'검진 등록',value:'',note:''}));
      if(typeof save==='function')save();
    }
  }
  openPane('detail',rec);
  if(typeof toast==='function')toast('이 폰에만 저장했어요');
}
function editCurrent(){
  const cu=draft&&draft.values?draft:latest();
  if(!cu)return openManual();
  openPane('confirm',{values:Object.assign({},cu.values,{date:cu.date}),sex:cu.sex||'m',meta:{edit:cu.id}});
  // if editing, saveDraft should replace — handle in saveDraft if meta.edit
}
// wrap save to replace when editing
const _saveDraft=saveDraft;
function saveDraftSmart(){
  const editing=draft&&draft.meta&&draft.meta.edit;
  if(!editing)return _saveDraft();
  const {values,sex}=readDraftForm();
  const store=loadHealth();
  const i=store.checkups.findIndex(c=>c.id===editing);
  if(i<0)return _saveDraft();
  const rec=Object.assign({},store.checkups[i],{values,sex,date:values.date||store.checkups[i].date});
  store.checkups[i]=rec;store.reminder=reminderDate(rec);saveHealth(store);
  openPane('detail',rec);
}
function wipe(){
  if(!confirm('이 폰에 있는 검진 기록을 모두 지울까요? 원본 PDF는 저장되어 있지 않아요.'))return;
  try{localStorage.removeItem(HKEY);}catch(e){}
  closePane();
  if(typeof toast==='function')toast('검진 기록을 지웠어요');
  if(typeof render==='function')render();
}
function openLatest(){const c=latest();if(c)openPane('detail',c);else openManual();}

function summaryCard(){
  const c=latest();
  if(!c){
    return `<div class="card" id="healthCard"><h3>🏥 건강검진</h3>
      <div class="muted" style="margin-bottom:10px">PDF를 이 폰 안에서만 읽어 참고 범위와 비교해요. 파일과 수치를 서버에 올리지 않아요.</div>
      <div class="rowx"><button type="button" class="btn-primary" onclick="DGHealth.pickPdf()">📄 건강검진 불러오기</button>
      <button type="button" class="btn-secondary" onclick="DGHealth.openManual()">직접 입력</button></div>
      <div class="muted" style="margin-top:8px">${esc(DISCLAIMER)}</div></div>`;
  }
  const cls=classify(c.values||{},c.sex);
  const n=cls.conditions.length;
  const bad=cls.conditions.filter(x=>x.level==='risk').length;
  return `<div class="card" id="healthCard"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🏥 건강검진</h3><span class="muted">${esc(c.date||'')}</span></div>
    <div class="muted" style="margin:6px 0 10px">${n? (bad?`위험(의심) ${bad} · 주의 포함 ${n}항목`:`주의 ${n}항목`):'입력한 항목은 참고 범위 안'} · 이 폰에만 저장됨</div>
    ${cls.conditions.slice(0,4).map(x=>`<span class="hchip ${x.level==='risk'?'risk':'warn'}" style="margin:0 6px 6px 0;display:inline-flex">${esc(x.text)}</span>`).join('')}
    <div class="rowx" style="margin-top:10px"><button type="button" class="btn-primary" onclick="DGHealth.openLatest()">분석 보기</button>
    <button type="button" class="btn-secondary" onclick="DGHealth.pickPdf()">PDF 추가</button></div>
    <div class="muted" style="margin-top:8px">${esc(DISCLAIMER)}</div></div>`;
}

function todayYmd(){return typeof today==='function'?today():new Date().toISOString().slice(0,10);}
function doneQuest(id,d){
  d=d||todayYmd();
  return (typeof raw!=='undefined')&&raw.some(e=>e.date===d&&e.type==='health_quest'&&e.item===id);
}
function toggleQuest(id){
  const d=todayYmd();
  const q=QUESTS.find(x=>x.id===id);if(!q)return;
  const existing=typeof raw!=='undefined'&&raw.find(e=>e.date===d&&e.type==='health_quest'&&e.item===id);
  if(existing){
    raw=raw.filter(e=>e.id!==existing.id);
    if(typeof save==='function')save();
    if(typeof toast==='function')toast('퀘스트 기록을 취소했어요');
    if(typeof render==='function')render();
    return;
  }
  if(q.extra==='bp_log'){
    const s=prompt('수축기 혈압(mmHg, 선택)','');
    const di=s==null?null:prompt('이완기 혈압(mmHg, 선택)','');
    if(s&&+s>0){
      const store=loadHealth();
      store.homeBp=store.homeBp||[];
      store.homeBp.push({date:d,sbp:+s,dbp:di&&+di>0?+di:null});
      saveHealth(store);
    }
  }
  if(typeof add==='function')add({date:d,type:'health_quest',item:id,value:'1',note:''});
}
function questBlock(){
  const c=latest();if(!c)return summaryCard();
  const cls=classify(c.values||{},c.sex);
  const qs=questsFor(cls);
  if(!qs.length)return summaryCard();
  const doneN=qs.filter(q=>doneQuest(q.id)).length;
  return `<div class="section-title"><h2>건강 관리 퀘스트</h2><span class="stat-chip mint">${doneN} / ${qs.length} 완료</span></div>
    <div class="muted" style="margin-top:-8px;margin-bottom:8px">검진 결과를 참고한 습관 퀘스트예요. 하루 최대 +${HQ_CAP} XP. ${esc(DISCLAIMER)}</div>
    ${qs.map(q=>{
      const on=doneQuest(q.id);
      return `<div class="quest-card${on?' done':''}"><div class="q-ic">🏥</div><div class="q-body"><div class="q-title">${esc(q.title)}</div><div class="q-sub">${esc(q.desc)}</div></div>
        <button type="button" class="${on?'btn-secondary':'btn-primary'} btn-sm" onclick="DGHealth.toggleQuest('${q.id}')">${on?'✓ 완료':'기록 +'+q.xp}</button></div>`;
    }).join('')}
    ${summaryCard()}`;
}

const api={
  HKEY,HQ_CAP,HQ_XP,QUESTS,FIELDS,DISCLAIMER,
  parseText,classify,levelOf,conditions,questsFor,flagGroups,reminderDate,urineLevel,
  loadHealth,saveHealth,latest,extractPdfFile,
  pickPdf,openManual,openLatest,openPane,close:closePane,closePane,saveDraft:saveDraftSmart,editCurrent,wipe,importFile,
  summaryCard,questBlock,toggleQuest,renderPane,
  hasMeaningfulText
};
root.DGHealth=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
