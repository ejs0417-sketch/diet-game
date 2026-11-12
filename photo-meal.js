// 다이어트 게임 0.4.22 — 식사 사진 인식. 칼로리는 AI가 만들지 않고 음식 표 공식 값만 씁니다. 끼니는 사진 시각(서울), 배달 결제내역 지원.
(function(root){
const PROXY_URL='https://52-79-146-61.sslip.io/recognize';
const PORTIONS=[{id:'little',label:'조금',mul:0.5},{id:'normal',label:'보통',mul:1},{id:'lots',label:'많이',mul:1.5}];
const MUL_OF={'조금':0.5,'보통':1,'많이':1.5,little:0.5,normal:1,lots:1.5};

const PHOTO_SLOTS=['아침','점심','저녁','간식','야식'];
const PII_RE=/01[016789]-?\d{3,4}-?\d{4}|\d{2,3}-\d{3,4}-\d{4}|\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4}|(주문번호|주문\s*번호|수령코드|승인번호)\s*[:#]?\s*\S+|(\d{1,3}(,\d{3})+원)/g;
const ADDR_RE=/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n,]{0,24}(\d+|\d+-\d+)?/g;
function pad2(n){n=+n;return (n<10?'0':'')+n;}
function seoulParts(d){
  d=d instanceof Date?d:new Date(d);
  if(isNaN(d.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,hourCycle:'h23'}).formatToParts(d);
  const g=t=>{const x=parts.find(p=>p.type===t);return x?x.value:'';};
  let h=+(g('hour')||0);if(h===24)h=0;
  return {date:g('year')+'-'+g('month')+'-'+g('day'),time:pad2(h)+':'+g('minute'),hour:h,minute:+(g('minute')||0)};
}
/** 사진·결제내역 확인 화면용 5개 끼니. 10:30~15:00 점심, 21:00부터 야식. */
function suggestMealSlotAt(now){
  now=now||new Date();
  const p=seoulParts(now);if(!p)return '점심';
  const t=p.hour*60+p.minute;
  if(t>=5*60&&t<10*60+30)return '아침';
  if(t>=10*60+30&&t<15*60)return '점심';
  if(t>=15*60&&t<17*60+30)return '간식';
  if(t>=17*60+30&&t<21*60)return '저녁';
  return '야식';
}
function parseExifAsciiDate(s,offset){
  const m=String(s||'').trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if(!m)return null;
  let off=String(offset||'').trim();
  if(!/^[+-]\d{2}:\d{2}$/.test(off))off='+09:00';
  const iso=m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+m[6]+off;
  const d=new Date(iso);
  return isNaN(d.getTime())?null:d;
}
function _u16(u8,i,le){return le?u8[i]|u8[i+1]<<8:u8[i]<<8|u8[i+1];}
function _u32(u8,i,le){return le?u8[i]|u8[i+1]<<8|u8[i+2]<<16|u8[i+3]<<24:((u8[i]<<24)|(u8[i+1]<<16)|(u8[i+2]<<8)|u8[i+3])>>>0;}
function _readAscii(u8,off,len){
  if(off<0||off+len>u8.length)return '';
  let s='';
  for(let i=0;i<len;i++){const c=u8[off+i];if(c===0)break;if(c>=32&&c<127)s+=String.fromCharCode(c);}
  return s;
}
function parseTiffDate(u8,tiff){
  if(tiff+8>u8.length)return null;
  const le=u8[tiff]===0x49&&u8[tiff+1]===0x49;
  if(!le&&!(u8[tiff]===0x4D&&u8[tiff+1]===0x4D))return null;
  const ifd0=tiff+_u32(u8,tiff+4,le);
  function readIfd(ifd){
    const tags={};
    if(ifd<0||ifd+2>u8.length)return tags;
    const n=_u16(u8,ifd,le);
    for(let i=0;i<n;i++){
      const e=ifd+2+i*12;if(e+12>u8.length)break;
      const tag=_u16(u8,e,le),typ=_u16(u8,e+2,le),cnt=_u32(u8,e+4,le),valOff=_u32(u8,e+8,le);
      let dataOff=e+8;
      const unit=typ===3?2:typ===4?4:1;
      if(cnt*unit>4)dataOff=tiff+valOff;
      if(typ===2)tags[tag]=_readAscii(u8,dataOff,cnt);
      else if(typ===4)tags[tag]=valOff;
    }
    return tags;
  }
  const t0=readIfd(ifd0);
  const exifOff=t0[0x8769];
  const t1=exifOff?readIfd(tiff+exifOff):{};
  const date=t1[0x9003]||t1[0x9004]||t0[0x0132];
  const off=t1[0x9011]||t1[0x9010]||t1[0x9012]||'';
  return parseExifAsciiDate(date,off);
}
function parseJpegExifDate(buf){
  const u8=buf instanceof Uint8Array?buf:(buf&&buf.buffer)?new Uint8Array(buf):null;
  if(!u8||u8.length<12||u8[0]!==0xFF||u8[1]!==0xD8)return null;
  let off=2;
  while(off+8<u8.length){
    if(u8[off]!==0xFF){off++;continue;}
    const m=u8[off+1];
    if(m===0xDA||m===0xD9)break;
    if(m===0x00||m===0x01||(m>=0xD0&&m<=0xD8)){off+=2;continue;}
    const len=(u8[off+2]<<8)|u8[off+3];
    if(len<2)break;
    if(m===0xE1&&len>10){
      const s=off+4;
      if(u8[s]===0x45&&u8[s+1]===0x78&&u8[s+2]===0x69&&u8[s+3]===0x66&&u8[s+4]===0&&u8[s+5]===0){
        const d=parseTiffDate(u8,s+6);
        if(d)return d;
      }
    }
    off+=2+len;
  }
  return null;
}
function whenFromDate(at,source){
  source=source||'now';
  at=at instanceof Date?at:new Date(at);
  if(isNaN(at.getTime())){at=new Date();source='now';}
  const p=seoulParts(at);
  return {at,date:p.date,time:p.time,slot:suggestMealSlotAt(at),source};
}
async function readHeadBytes(file,max){
  max=max||262144;
  if(!file)return null;
  if(file instanceof Uint8Array)return file.subarray(0,Math.min(max,file.length));
  if(typeof Buffer!=='undefined'&&Buffer.isBuffer&&Buffer.isBuffer(file))return new Uint8Array(file.subarray(0,Math.min(max,file.length)));
  if(file.buffer&&file.byteLength!=null&&!file.size)return new Uint8Array(file.buffer,file.byteOffset||0,Math.min(max,file.byteLength));
  if(typeof file.arrayBuffer==='function'){
    const slice=file.slice?file.slice(0,max):file;
    const ab=await slice.arrayBuffer();
    return new Uint8Array(ab);
  }
  return null;
}
async function readPhotoWhen(file){
  let at=null,source='now';
  try{
    const head=await readHeadBytes(file,262144);
    if(head){
      const d=parseJpegExifDate(head);
      if(d){at=d;source='exif';}
    }
  }catch(e){}
  if(!at&&file&&file.lastModified){
    const d=new Date(file.lastModified);
    if(!isNaN(d.getTime())){at=d;source='modified';}
  }
  if(!at){at=new Date();source='now';}
  return whenFromDate(at,source);
}
function scrubPii(s){
  return String(s||'').replace(PII_RE,'').replace(ADDR_RE,'').replace(/\s+/g,' ').trim();
}
function sanitizeReceipt(input){
  let data=input;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch(e){data={};}}
  if(!data||typeof data!=='object')data={};
  // 주소·전화·카드·주문번호·결제 필드는 키 자체부터 버립니다.
  const store=scrubPii(String(data.store||data.restaurant||data.shop||'')).slice(0,40);
  let ordered='';
  const rawAt=String(data.ordered_at||data.orderTime||data.time||'').trim();
  const tm=rawAt.match(/(?:(\d{4})[-./](\d{1,2})[-./](\d{1,2}))?[ T]?(\d{1,2}):(\d{2})/);
  if(tm){
    const y=tm[1]||'';
    if(y){
      const iso=y+'-'+pad2(tm[2])+'-'+pad2(tm[3])+'T'+pad2(tm[4])+':'+tm[5]+':00+09:00';
      const d=new Date(iso);
      if(!isNaN(d.getTime()))ordered=iso.slice(0,16)+'+09:00';
    }
  }
  const rawItems=Array.isArray(data.items)?data.items:(Array.isArray(data.dishes)?data.dishes:[]);
  const items=[];
  rawItems.forEach(it=>{
    let name='',qty=1;
    if(typeof it==='string')name=it;
    else if(it&&typeof it==='object'){
      name=it.name||it.menu||it.dish||'';
      qty=Math.round(+it.qty||+it.quantity||+it.count||1);
    }
    name=scrubPii(String(name)).slice(0,40);
    if(!name)return;
    if(!(qty>=1&&qty<=20))qty=1;
    items.push({name,qty});
  });
  return {kind:'receipt',store,ordered_at:ordered,items};
}
function whenLabel(when){
  if(!when)return '지금 시각(서울) 기준으로 끼니를 넣었어요. 다르면 바꿔 주세요.';
  const t=(when.date||'')+' '+(when.time||'');
  const slot='‘'+(when.slot||'')+'’';
  if(when.source==='exif')return '사진 촬영 시각(서울) '+t+' 기준으로 '+slot+'으로 넣었어요. 다르면 바꿔 주세요.';
  if(when.source==='receipt')return '주문 시각(서울) '+t+' 기준으로 '+slot+'으로 넣었어요. 다르면 바꿔 주세요.';
  if(when.source==='modified')return '파일 시각(서울) '+t+' 기준으로 넣었어요. 촬영 시각과 다를 수 있으니 확인해 주세요.';
  return '지금 시각(서울) '+t+' 기준으로 넣었어요. 다르면 바꿔 주세요.';
}

const COOK_REST=/^(장)?조림$|^볶음$|^무침$|^구이$|^찜$|^탕$|^국$|^찌개$|^전골$|^전$|^부침$|^나물$|^튀김$|^조림$|^장조림$/;
const MAX_EDGE=1024, JPEG_Q=0.85;

function foods(){return (root.DGCustomFoods&&DGCustomFoods.all())||((root.DGFoods&&DGFoods.FOODS)||[]);}
function searchFoods(q,opts){return (root.DGFoodSearch&&DGFoodSearch.searchFoods(q,opts))||[];}
function norm(s){return root.DGFoodSearch?DGFoodSearch.norm(s):String(s||'').toLowerCase().replace(/\s+/g,'');}
function foodKeys(item){return [item.name].concat(item.aliases||[]).concat(item.searchAliases||[]).filter(Boolean);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

function containedScore(query,key){
  const nq=norm(query),nk=norm(key);
  if(!nq||!nk||nk.length<2)return 0;
  if(nq===nk)return 100;
  if(nk.startsWith(nq)&&nq.length>=2)return 92;
  if(nq.startsWith(nk)&&nk.length>=3)return 90;
  if(nq.endsWith(nk)&&nk.length>=3)return 90;
  if(nq.includes(nk)&&nk.length>=3)return 70+Math.min(20,Math.round(20*nk.length/Math.max(nq.length,1)));
  if(nk.includes(nq)&&nq.length>=3)return 80;
  return 0;
}

function isCookedVariant(query,key){
  const nq=norm(query),nk=norm(key);
  if(!nq||!nk||nq===nk)return false;
  if(!nq.includes(nk))return false;
  const rest=nq.split(nk).join('');
  return COOK_REST.test(rest);
}

function nutritionOf(food,mul,place){
  mul=+mul||1;
  const raw=food||{};
  const fn=root.DGFoods&&DGFoods.nutritionForPlace;
  const f=fn?fn(raw,place):raw;
  const kcal=Math.round((+f.kcal||0)*mul);
  const protein=Math.round((+f.protein||0)*mul*10)/10;
  return {id:f.id,name:f.name,unit:f.unit,src:f.src||'',kcal:kcal,protein:protein,mul:mul,baseKcal:+f.kcal||0,baseProtein:+f.protein||0};
}

// AI가 준 kcal·영양 숫자는 버리고 이름·양 추정만 씁니다.
function sanitizeDishes(input){
  const list=Array.isArray(input)?input:(input&&Array.isArray(input.dishes)?input.dishes:[]);
  const out=[];
  list.forEach(d=>{
    if(d==null)return;
    const name=String(typeof d==='string'?d:(d.name||d.dish||d.menu||'')).trim();
    if(!name)return;
    let portion=String((d&& (d.portion||d.amount||d.size))||'보통').trim();
    if(!MUL_OF[portion])portion='보통';
    let qty=Math.round(+(d&&(d.qty||d.quantity||d.count))||1);
    if(!(qty>=1&&qty<=20))qty=1;
    out.push({name,portion,qty});
  });
  return out;
}

function uniqueFoods(arr){
  const seen=new Set(),out=[];
  arr.forEach(f=>{if(f&&f.id&&!seen.has(f.id)){seen.add(f.id);out.push(f);}});
  return out;
}

function textHits(query,limit){
  const q=String(query||'').trim();
  const scored=[];
  foods().forEach(item=>{
    let best=0,via='';
    foodKeys(item).forEach(key=>{
      const s=containedScore(q,key);
      if(s>best){best=s;via=key;}
    });
    if(best>=70)scored.push({item,score:best,via});
  });
  scored.sort((a,b)=>b.score-a.score||norm(b.via).length-norm(a.via).length);
  return scored.slice(0,limit||6);
}

function candidatesFor(query,excludeId){
  const q=String(query||'').trim();
  const variants=[q];
  const m=q.match(/^(.*?)((?:장)?조림|볶음|무침|구이|찜|탕|국|찌개|전골|전|부침|나물|튀김)$/);
  if(m&&m[1]&&m[1].replace(/\s+/g,'').length>=2)variants.push(m[1].trim());
  const hits=[];
  variants.forEach(v=>{
    textHits(v,6).forEach(h=>{if(h&&h.item)hits.push(h.item);});
  });
  return uniqueFoods(hits).filter(f=>f.id!==excludeId).slice(0,5);
}

function matchDish(query){
  const q=String(query||'').trim();
  if(!q)return {status:'none',food:null,candidates:[],query:q,score:0,via:''};
  // 사진에서 온 이름은 초성 검색을 쓰지 않아요. '달걀전'과 '닭강정'처럼 초성만 같은 메뉴가 붙지 않게 해요.
  let best=null;
  foods().forEach(item=>{
    foodKeys(item).forEach(key=>{
      let s=containedScore(q,key);
      if(s<=0)return;
      const cooked=isCookedVariant(q,key);
      if(cooked)s=Math.min(s,75);
      if(item.unit==='1인분')s+=2;
      const better=!best||s>best.score||(s===best.score&&!item.custom&&best.item.custom)||(s===best.score&&norm(key).length>norm(best.via).length);
      if(better){
        best={item,score:s,via:key,cooked:cooked};
      }
    });
  });
  const auto=best&&best.score>=84&&!best.cooked;
  const food=auto?best.item:null;
  const candidates=candidatesFor(q,food&&food.id);
  const status=food?'match':(candidates.length?'pick':'none');
  return {status,food,candidates,query:q,score:best?best.score:0,via:best?best.via:'',cooked:!!(best&&best.cooked)};
}

function matchDishes(dishes){
  return sanitizeDishes(dishes).map(d=>{
    const m=matchDish(d.name);
    const sizeMul=MUL_OF[d.portion]||1;
    const qty=d.qty||1;
    return Object.assign({name:d.name,portion:d.portion,qty,sizeMul,portionMul:qty*sizeMul,removed:false},m);
  });
}

function totals(rows,place){
  let kcal=0,protein=0,n=0;
  (rows||[]).forEach(r=>{
    if(r.removed||!r.food)return;
    const nu=nutritionOf(r.food,typeof rowMul==='function'?rowMul(r):(r.portionMul||1),place);
    kcal+=nu.kcal;protein+=nu.protein;n++;
  });
  return {kcal:kcal,protein:Math.round(protein*10)/10,n:n};
}

function portionById(id){return PORTIONS.find(p=>p.id===id||p.label===id)||PORTIONS[1];}

/* ---------- UI (browser only) ---------- */
let state=null; // {rows,slot,place,busy}

function fileInput(){
  if(typeof document==='undefined')return null;
  let el=document.getElementById('mealPhotoInput');
  if(!el){
    el=document.createElement('input');
    el.type='file';el.id='mealPhotoInput';el.accept='image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp';
    // Android/iOS에서 hidden/display:none 이면 선택 후 change가 안 오는 경우가 있어요. 화면 밖으로만 빼요.
    el.setAttribute('aria-hidden','true');
    el.style.cssText='position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;overflow:hidden;z-index:1;border:0;padding:0;margin:0';
    el.addEventListener('change',onFile);
    document.body.appendChild(el);
  }
  return el;
}

let pickMode='auto';
function closeChooser(){
  if(typeof document==='undefined')return;
  const el=document.getElementById('photoMealChoose');
  if(el)el.remove();
}
function showChooser(){
  if(typeof document==='undefined')return;
  closeChooser();clearError();
  const html=`<div class="photo-meal-err" id="photoMealChoose" role="dialog" aria-label="사진 종류">
    <div class="photo-meal-err-card">
      <b>사진을 어떻게 등록할까요?</b>
      <p>음식 사진은 밥상·반찬을, 배달 결제내역은 배민·쿠팡이츠·요기요 주문 화면을 올리면 돼요.</p>
      <button type="button" class="btn-primary btn-lg" style="width:100%;margin-bottom:8px" onclick="DGPhotoMeal.pick({mode:'food',skipChooser:true})">음식 사진</button>
      <button type="button" class="btn-secondary btn-lg" style="width:100%;margin-bottom:8px" onclick="DGPhotoMeal.pick({mode:'receipt',skipChooser:true})">배달 결제내역</button>
      <button type="button" class="btn-ghost" style="width:100%" onclick="DGPhotoMeal.closeChooser()">닫기</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function pick(opt){
  opt=opt||{};
  try{
    clearError();
    closeChooser();
    if(!opt.skipChooser&&!opt.mode){showChooser();return;}
    pickMode=opt.mode||'auto';
    const el=fileInput();
    if(!el){showError('사진 선택 창을 열 수 없어요');return;}
    el.value='';
    el.click();
  }catch(err){
    showError((err&&err.message)||'사진 선택 창을 열 수 없어요');
  }
}

function onFile(ev){
  const input=ev&&ev.target;
  const f=(input&&input.files&&input.files[0])||null;
  // 같은 파일을 다시 고를 수 있게, 파일 객체를 복사한 뒤에 값을 비워요.
  if(!f){
    if(input)input.value='';
    return;
  }
  showLoading(true,'사진을 읽고 있어요');
  const mode=pickMode||'auto';
  recognizeFile(f,{mode}).finally(()=>{if(input)input.value='';pickMode='auto';});
}

function loadImage(blob){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('decode'));};
    img.src=url;
  });
}

function drawToJpeg(img){
  let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  if(!w||!h)throw new Error('사진 크기를 알 수 없어요');
  if(w>MAX_EDGE||h>MAX_EDGE){
    const s=MAX_EDGE/Math.max(w,h);
    w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s));
  }
  const c=document.createElement('canvas');
  c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  if(!ctx)throw new Error('사진을 줄이지 못했어요');
  ctx.drawImage(img,0,0,w,h);
  if(img.close)try{img.close();}catch(e){}
  return new Promise((resolve,reject)=>{
    c.toBlob(b=>{if(b)resolve(b);else reject(new Error('사진을 줄이지 못했어요'));},'image/jpeg',JPEG_Q);
  });
}

async function prepareImage(file){
  // 1) createImageBitmap(HEIC 일부 지원) 2) Image 디코드 3) 원본을 그대로 전송
  if(typeof createImageBitmap==='function'){
    try{
      const bmp=await createImageBitmap(file);
      const blob=await drawToJpeg(bmp);
      return {blob,mime:'image/jpeg'};
    }catch(e){/* 다음 방법 */}
  }
  try{
    const img=await loadImage(file);
    const blob=await drawToJpeg(img);
    return {blob,mime:'image/jpeg'};
  }catch(e){/* 다음 방법 */}
  const mime=(file.type||'').split(';')[0]||'image/jpeg';
  const ok=/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mime)||/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name||'');
  if(ok&&file.size&&file.size<=2*1024*1024){
    return {blob:file,mime:mime||'image/jpeg'};
  }
  throw new Error('이 사진 형식은 읽지 못했어요. JPEG나 PNG로 다시 찍어 주세요');
}

function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const s=String(fr.result||'');
      const i=s.indexOf(',');
      resolve(i>=0?s.slice(i+1):s);
    };
    fr.onerror=()=>reject(new Error('사진을 읽지 못했어요'));
    fr.readAsDataURL(blob);
  });
}

async function recognizeFile(file,opt){
  opt=opt||{};
  const mode=opt.mode||pickMode||'auto';
  showLoading(true,'사진을 살펴보는 중이에요');
  try{
    // 리사이즈하면 EXIF가 사라지니, 원본에서 먼저 촬영 시각을 읽어요.
    const when=await readPhotoWhen(file);
    const prep=await prepareImage(file);
    const b64=await blobToBase64(prep.blob);
    showLoading(true,mode==='receipt'?'결제 내역을 읽고 있어요':'메뉴를 알아보고 있어요');
    let res;
    try{
      res=await fetch(PROXY_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({image:b64,mime:prep.mime||'image/jpeg',mode:mode})
      });
    }catch(net){
      throw new Error('인식 서버에 연결하지 못했어요. 네트워크를 확인하고 다시 해 주세요');
    }
    let data=null;
    try{data=await res.json();}catch(e){data=null;}
    if(!res.ok){
      const msg=(data&&data.error)||(res.status===429?'요청이 많아요. 잠시 후 다시 해 주세요':res.status===413?'사진이 너무 커요':res.status===502||res.status===503?'사진 인식이 잠시 안 돼요. 조금 있다 다시 해 주세요':'사진을 알아보지 못했어요');
      throw new Error(msg);
    }
    const kind=(data&&data.kind)||(mode==='receipt'?'receipt':'food');
    if(kind==='receipt'||(Array.isArray(data&&data.items)&&!((data.dishes)||[]).length)){
      openWithReceipt(data,when);
    }else{
      const dishes=sanitizeDishes(data);
      if(!dishes.length)throw new Error('메뉴를 찾지 못했어요. 다른 각도나 가까운 사진으로 다시 해 주세요');
      openWithDishes(dishes,{when,place:(typeof mealPlace==='string')?mealPlace:''});
    }
    showLoading(false);
    return state;
  }catch(err){
    const msg=(err&&err.message)?err.message:'사진을 알아보지 못했어요';
    showError(msg);
    throw err;
  }
}

function showError(msg){
  showLoading(false);
  if(typeof toast==='function')toast(msg);
  if(typeof document==='undefined')return;
  let el=document.getElementById('photoMealErr');
  if(el)el.remove();
  el=document.createElement('div');
  el.id='photoMealErr';
  el.className='photo-meal-err';
  el.innerHTML='<div class="photo-meal-err-card"><b>사진을 등록하지 못했어요</b><p>'+esc(msg)+'</p>'
    +'<button type="button" class="btn-primary btn-lg" onclick="document.getElementById(\'photoMealErr\').remove();DGPhotoMeal.pick()">다시 사진 고르기</button>'
    +'<button type="button" class="btn-secondary" style="width:100%;margin-top:8px" onclick="document.getElementById(\'photoMealErr\').remove()">닫기</button></div>';
  document.body.appendChild(el);
}
function clearError(){
  if(typeof document==='undefined')return;
  const el=document.getElementById('photoMealErr');
  if(el)el.remove();
}

function showLoading(on,text){
  if(typeof document==='undefined')return;
  let el=document.getElementById('photoMealLoad');
  if(!on){if(el)el.remove();return;}
  const body='<div class="photo-meal-load-card">'+(esc(text||'사진을 살펴보는 중이에요'))+'<div class="muted" style="margin-top:6px;font-size:12px">사진은 서버에 저장되지 않아요</div></div>';
  if(!el){
    el=document.createElement('div');
    el.id='photoMealLoad';
    el.className='photo-meal-load';
    document.body.appendChild(el);
  }
  el.innerHTML=body;
}

function closeConfirm(){
  state=null;
  const el=typeof document!=='undefined'&&document.getElementById('photoMealPane');
  if(el)el.remove();
}

function setRowPortion(i,label){
  if(!state||!state.rows[i])return;
  const p=portionById(label);
  const r=state.rows[i];
  r.portion=p.label;
  r.sizeMul=p.mul;
  r.portionMul=(r.qty||1)*p.mul;
  renderConfirm();
}
function removeRow(i){
  if(!state||!state.rows[i])return;
  state.rows[i].removed=true;
  renderConfirm();
}
function pickCandidate(i,id){
  if(!state||!state.rows[i])return;
  const f=foods().find(x=>x.id===id);
  if(!f)return;
  state.rows[i].food=f;
  state.rows[i].status='match';
  state.rows[i].candidates=state.rows[i].candidates.filter(c=>c.id!==id);
  renderConfirm();
}
function setSlot(k){if(!state)return;if(PHOTO_SLOTS.indexOf(k)<0)return;state.slot=k;if(typeof setMealKind==='function')setMealKind(k);renderConfirm();}
function setDate(d){
  if(!state)return;
  const s=String(d||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return;
  state.date=s;
  if(typeof logDate!=='undefined')logDate=s;
  renderConfirm();
}
function setRowQty(i,delta){
  if(!state||!state.rows[i])return;
  const r=state.rows[i];
  const q=Math.max(1,Math.min(20,(+r.qty||1)+(+delta||0)));
  r.qty=q;r.portionMul=q*(r.sizeMul||1);
  renderConfirm();
}
function setPlace(k){
  if(!state)return;
  state.place=(k&&k===state.place)?'':k;
  if(typeof setMealPlace==='function')setMealPlace(state.place);
  renderConfirm();
}

function rowMul(r){return (r.qty||1)*(r.sizeMul||r.portionMul||1);}
function rowHTML(r,i,place){
  if(r.removed)return '';
  const mul=rowMul(r);
  const nu=r.food?nutritionOf(r.food,mul,place):null;
  const sizeMul=r.sizeMul||(r.qty?1:(r.portionMul||1));
  const por=PORTIONS.map(p=>`<button type="button" class="pm-por" aria-selected="${sizeMul===p.mul}" onclick="DGPhotoMeal.setRowPortion(${i},'${p.label}')">${p.label}</button>`).join('');
  const qtyBox=state&&state.kind==='receipt'?`<div class="pm-qty"><button type="button" onclick="DGPhotoMeal.setRowQty(${i},-1)" aria-label="수량 줄이기">−</button><span>${r.qty||1}개</span><button type="button" onclick="DGPhotoMeal.setRowQty(${i},1)" aria-label="수량 늘리기">+</button></div>`:'';
  if(r.food){
    return `<div class="pm-row">
      <div class="pm-row-h"><span class="nm"><b>${esc(r.food.name)}</b><span>${esc(r.food.unit||'1인분')}${r.name!==r.food.name?` · 사진: ${esc(r.name)}`:''}</span></span>
        <span class="kcal num">${nu.kcal.toLocaleString('ko-KR')}kcal</span>
        <button type="button" class="icon-btn" aria-label="빼기" onclick="DGPhotoMeal.removeRow(${i})">✕</button></div>
      ${qtyBox}
      <div class="segmented pm-portions" role="tablist">${por}</div>
      <div class="muted pm-src">단백질 ${nu.protein}g · ${r.food.custom?`인터넷 검색값${r.food.sourceUrl?` · <a href="${esc(r.food.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.food.sourceTitle||'출처')}</a>`:''}`:esc(r.food.src? '음식 표 공식 값':'음식 표')}</div>
    </div>`;
  }
  const cands=(r.candidates||[]).map(c=>{
    const n=nutritionOf(c,r.portionMul||1,place);
    return `<button type="button" class="pm-cand" onclick="DGPhotoMeal.pickCandidate(${i},'${escJs(c.id)}')"><b>${esc(c.name)}</b><span>${n.kcal.toLocaleString('ko-KR')}kcal · ${esc(c.unit||'')}</span></button>`;
  }).join('');
  return `<div class="pm-row pm-unmatched">
    <div class="pm-row-h"><span class="nm"><b>‘${esc(r.name)}’</b><span>음식 표에서 바로 맞는 메뉴가 없어요. 가까운 메뉴를 고르거나, 인터넷에서 찾아 주세요.</span></span>
      <button type="button" class="icon-btn" aria-label="빼기" onclick="DGPhotoMeal.removeRow(${i})">✕</button></div>
    <div class="pm-cands">${cands||'<div class="muted">가까운 메뉴가 없어요.</div>'}</div>
    <button type="button" class="btn-secondary" style="width:100%;margin-top:8px" onclick="DGCustomFoods.lookupForPhoto(${i})">인터넷에서 찾기</button>
  </div>`;
}

function todaySeoul(){
  if(typeof today==='function')return today();
  const p=seoulParts(new Date());
  return p?p.date:'';
}
function renderConfirm(){
  if(typeof document==='undefined'||!state)return;
  const slots=PHOTO_SLOTS;
  const places=(typeof MEAL_PLACES!=='undefined'?MEAL_PLACES:[['home','🏠','집밥'],['out','🍽️','외식'],['delivery','📦','배달·포장']]);
  const tot=totals(state.rows,state.place);
  const rows=state.rows.map((r,i)=>rowHTML(r,i,state.place)).join('')||'<div class="muted">남은 메뉴가 없어요.</div>';
  const date=state.date||todaySeoul();
  const isPast=date&&date!==todaySeoul();
  const title=state.kind==='receipt'?'결제 내역에서 찾은 메뉴':'사진으로 찾은 메뉴';
  const hint=state.kind==='receipt'
    ?'가게·메뉴·수량·주문 시각만 써요. 주소·전화·카드·주문번호·결제 정보는 읽어서 버려요. 칼로리는 음식 표의 공식 값이에요.'
    :'칼로리는 음식 표의 공식 값이에요. AI가 숫자를 만들지 않아요. 사진은 저장하지 않아요.';
  const store=state.store?`<div class="pm-store">가게 <b>${esc(state.store)}</b></div>`:'';
  const html=`<div class="photo-meal-pane" id="photoMealPane">
    <div class="photo-meal-card">
      <div class="pm-head"><b>${title}</b>
        <button type="button" class="btn-secondary btn-sm" onclick="DGPhotoMeal.closeConfirm()">닫기</button></div>
      <div class="muted" style="font-size:12px;margin:0 0 10px">${hint}</div>
      ${store}
      <div class="label" style="font-size:13px;font-weight:700;margin-bottom:6px">끼니</div>
      <p class="muted pm-when-hint" id="pmWhenHint">${esc(whenLabel(state.when))}</p>
      <div class="pm-slots" role="tablist" aria-label="끼니">${slots.map(m=>`<button type="button" aria-selected="${state.slot===m}" onclick="DGPhotoMeal.setSlot('${m}')">${m}</button>`).join('')}</div>
      <div class="pm-date-row"><label for="pmDate">날짜</label>
        <input type="date" id="pmDate" value="${esc(date)}" onchange="DGPhotoMeal.setDate(this.value)">
        ${isPast?'<span class="muted">이전 날짜 사진이에요. 그날로 기록돼요.</span>':'<span class="muted">다른 날 사진이면 날짜를 바꿔 주세요.</span>'}
      </div>
      <div class="segmented meal-place" style="margin-top:8px" role="tablist" aria-label="식사 방식">${places.map(([k,i,l])=>`<button type="button" aria-selected="${state.place===k}" onclick="DGPhotoMeal.setPlace('${k}')">${i} ${l}</button>`).join('')}</div>
      <div class="pm-list">${rows}</div>
      <div class="pm-tot"><b>합계 ${tot.kcal.toLocaleString('ko-KR')}kcal</b><span>단백질 ${tot.protein}g · ${tot.n}개</span></div>
      <button type="button" class="btn-primary btn-lg" id="photoMealConfirmBtn" ${tot.n? '':'disabled'} onclick="DGPhotoMeal.confirm()">${tot.n? '확인 · '+tot.n+'개 기록':'기록할 메뉴를 골라 주세요'}</button>
    </div>
  </div>`;
  let el=document.getElementById('photoMealPane');
  if(el)el.outerHTML=html;
  else document.body.insertAdjacentHTML('beforeend',html);
}

function portionLabel(mul){
  if(mul===0.5)return '조금';
  if(mul===1.5)return '많이';
  return '';
}

function confirm(){
  if(!state)return;
  const rows=state.rows.filter(r=>!r.removed&&r.food);
  if(!rows.length){if(typeof toast==='function')toast('기록할 메뉴를 확인해 주세요');return;}
  const date=state.date||todaySeoul();
  const slot=state.slot||'점심';
  const place=state.place||'';
  const evs=rows.map(r=>{
    const mul=rowMul(r);
    const nu=nutritionOf(r.food,mul,place);
    const plab=portionLabel(r.sizeMul||r.portionMul||1);
    const qtyNote=(r.qty&&r.qty!==1)?(r.qty+'개'):'';
    const ev={
      date:date,type:'meal',item:slot,
      value:nu.name+(qtyNote?' '+qtyNote:'')+(plab?' ('+plab+')':''),
      kcal:String(nu.kcal),
      protein_g:String(nu.protein),
      kcal_source:r.food&&r.food.custom?('인터넷검색값'+(r.food.sourceUrl?(' '+r.food.sourceUrl):'')):'음식표',
      dish_id:nu.id,
      portion:mul,
      qty:r.qty||1,
      store:state.store||'',
      note:(function(){
        const bits=[];
        if(place){var m=typeof placeMeta==='function'?placeMeta(place):null;bits.push('방식='+((m&&m[2])||place));}
        if(state.store)bits.push('가게='+state.store);
        if(qtyNote)bits.push('수량='+qtyNote);
        return bits.join('; ');
      })()
    };
    if(place)ev.place=place;
    return ev;
  });
  if(typeof raw==='undefined'||typeof withId!=='function'||typeof save!=='function'){
    if(typeof toast==='function')toast('기록을 저장할 수 없어요');
    return;
  }
  evs.forEach(e=>{raw.push(withId(e));});
  save();
  closeConfirm();
  if(typeof logAdding!=='undefined')logAdding=false;
  if(typeof toast==='function')toast(evs.length+'개 메뉴를 기록했어요');
  if(typeof render==='function')render();
}

// 테스트·스크린샷용: 이미 구한 인식 결과로 확인 화면만 엽니다. 사진을 저장하지 않아요.
function openWithDishes(dishes,opt){
  opt=opt||{};
  const rows=matchDishes(dishes);
  rows.forEach(r=>{if(r.qty==null)r.qty=1;if(r.sizeMul==null)r.sizeMul=r.portionMul||1;});
  const when=opt.when||(opt.at?whenFromDate(opt.at,opt.source||'now'):null);
  // 끼니 기본값은 사진(또는 주문) 시각. 현재 시각으로 잡아 둔 mealKind(밤에 야식)는 쓰지 않아요.
  const slot=opt.slot||(when&&when.slot)||suggestMealSlotAt(when&&when.at)||'점심';
  const date=opt.date||(when&&when.date)||todaySeoul();
  const place=opt.place!=null?opt.place:((typeof mealPlace==='string')?mealPlace:'');
  state={rows,slot,place,date,when,kind:'food',store:''};
  renderConfirm();
  return state;
}
function openWithReceipt(data,photoWhen){
  const rec=sanitizeReceipt(data);
  const dishes=rec.items.map(it=>({name:it.name,portion:'보통',qty:it.qty}));
  const rows=matchDishes(dishes).map((r,i)=>{
    const qty=rec.items[i]&&rec.items[i].qty||1;
    r.qty=qty;r.sizeMul=1;r.portionMul=qty;
    return r;
  });
  let when=photoWhen||null;
  if(rec.ordered_at){
    const d=new Date(rec.ordered_at);
    if(!isNaN(d.getTime()))when=whenFromDate(d,'receipt');
  }
  if(!when)when=whenFromDate(new Date(),'now');
  const slot=when.slot||'점심';
  const date=when.date||todaySeoul();
  state={rows,slot,place:'delivery',date,when,kind:'receipt',store:rec.store||''};
  renderConfirm();
  return state;
}

function getState(){return state;}
function rowName(i){return state&&state.rows&&state.rows[i]&&state.rows[i].name||'';}
function applyFood(i,food,mul){
  if(!state||!state.rows[i]||!food)return;
  const r=state.rows[i];
  const sizeMul=(mul==null?1:+mul)||1;
  r.food=food;
  r.status='match';
  r.candidates=[];
  r.sizeMul=sizeMul;
  r.portionMul=(r.qty||1)*sizeMul;
  r.portion=sizeMul===0.5?'조금':sizeMul===1.5?'많이':'보통';
  if(typeof renderConfirm==='function')renderConfirm();
}
const api={
  PROXY_URL,PORTIONS,MUL_OF,PHOTO_SLOTS,
  sanitizeDishes,sanitizeReceipt,scrubPii,matchDish,matchDishes,nutritionOf,totals,candidatesFor,
  parseJpegExifDate,parseExifAsciiDate,suggestMealSlotAt,seoulParts,readPhotoWhen,whenFromDate,whenLabel,
  pick,showChooser,closeChooser,recognizeFile,closeConfirm,showError,showLoading,clearError,prepareImage,setRowPortion,setRowQty,removeRow,pickCandidate,
  setSlot,setDate,setPlace,confirm,openWithDishes,openWithReceipt,renderConfirm,getState,rowName,applyFood
};
root.DGPhotoMeal=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
