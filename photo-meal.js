// 다이어트 게임 0.4.18 — 식사 사진 인식. 칼로리는 AI가 만들지 않고 음식 표 공식 값만 씁니다.
(function(root){
const PROXY_URL='https://52-79-146-61.sslip.io/recognize';
const PORTIONS=[{id:'little',label:'조금',mul:0.5},{id:'normal',label:'보통',mul:1},{id:'lots',label:'많이',mul:1.5}];
const MUL_OF={'조금':0.5,'보통':1,'많이':1.5,little:0.5,normal:1,lots:1.5};
const COOK_REST=/^(장)?조림$|^볶음$|^무침$|^구이$|^찜$|^탕$|^국$|^찌개$|^전골$|^전$|^부침$|^나물$|^튀김$|^조림$|^장조림$/;
const MAX_EDGE=1024, JPEG_Q=0.85;

function foods(){return (root.DGFoods&&DGFoods.FOODS)||[];}
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
    out.push({name,portion});
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
      if(!best||s>best.score||(s===best.score&&norm(key).length>norm(best.via).length)){
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
    return Object.assign({name:d.name,portion:d.portion,portionMul:MUL_OF[d.portion]||1,removed:false},m);
  });
}

function totals(rows,place){
  let kcal=0,protein=0,n=0;
  (rows||[]).forEach(r=>{
    if(r.removed||!r.food)return;
    const nu=nutritionOf(r.food,r.portionMul||1,place);
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

function pick(){
  try{
    clearError();
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
  recognizeFile(f).finally(()=>{if(input)input.value='';});
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

async function recognizeFile(file){
  showLoading(true,'사진을 살펴보는 중이에요');
  try{
    const prep=await prepareImage(file);
    file=null;
    const b64=await blobToBase64(prep.blob);
    showLoading(true,'메뉴를 알아보고 있어요');
    let res;
    try{
      res=await fetch(PROXY_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({image:b64,mime:prep.mime||'image/jpeg'})
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
    const dishes=sanitizeDishes(data);
    if(!dishes.length)throw new Error('메뉴를 찾지 못했어요. 다른 각도나 가까운 사진으로 다시 해 주세요');
    const rows=matchDishes(dishes);
    const slot=(typeof mealKind==='string'&&mealKind)||(typeof suggestMealSlot==='function'?suggestMealSlot():'점심');
    const place=(typeof mealPlace==='string')?mealPlace:'';
    state={rows,slot,place};
    showLoading(false);
    renderConfirm();
    return rows;
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
  state.rows[i].portion=p.label;
  state.rows[i].portionMul=p.mul;
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
function setSlot(k){if(!state)return;state.slot=k;if(typeof setMealKind==='function')setMealKind(k);renderConfirm();}
function setPlace(k){
  if(!state)return;
  state.place=(k&&k===state.place)?'':k;
  if(typeof setMealPlace==='function')setMealPlace(state.place);
  renderConfirm();
}

function rowHTML(r,i,place){
  if(r.removed)return '';
  const nu=r.food?nutritionOf(r.food,r.portionMul||1,place):null;
  const por=PORTIONS.map(p=>`<button type="button" class="pm-por" aria-selected="${(r.portionMul||1)===p.mul}" onclick="DGPhotoMeal.setRowPortion(${i},'${p.label}')">${p.label}</button>`).join('');
  if(r.food){
    return `<div class="pm-row">
      <div class="pm-row-h"><span class="nm"><b>${esc(r.food.name)}</b><span>${esc(r.food.unit||'1인분')}${r.name!==r.food.name?` · 사진: ${esc(r.name)}`:''}</span></span>
        <span class="kcal num">${nu.kcal.toLocaleString('ko-KR')}kcal</span>
        <button type="button" class="icon-btn" aria-label="빼기" onclick="DGPhotoMeal.removeRow(${i})">✕</button></div>
      <div class="segmented pm-portions" role="tablist">${por}</div>
      <div class="muted pm-src">단백질 ${nu.protein}g · ${esc(r.food.src? '음식 표 공식 값':'음식 표')}</div>
    </div>`;
  }
  const cands=(r.candidates||[]).map(c=>{
    const n=nutritionOf(c,r.portionMul||1,place);
    return `<button type="button" class="pm-cand" onclick="DGPhotoMeal.pickCandidate(${i},'${escJs(c.id)}')"><b>${esc(c.name)}</b><span>${n.kcal.toLocaleString('ko-KR')}kcal · ${esc(c.unit||'')}</span></button>`;
  }).join('');
  return `<div class="pm-row pm-unmatched">
    <div class="pm-row-h"><span class="nm"><b>‘${esc(r.name)}’</b><span>음식 표에서 바로 맞는 메뉴가 없어요. 가까운 메뉴를 고르거나 빼 주세요.</span></span>
      <button type="button" class="icon-btn" aria-label="빼기" onclick="DGPhotoMeal.removeRow(${i})">✕</button></div>
    <div class="pm-cands">${cands||'<div class="muted">가까운 메뉴가 없어요. 빼거나 검색으로 따로 등록해 주세요.</div>'}</div>
  </div>`;
}

function renderConfirm(){
  if(typeof document==='undefined'||!state)return;
  const slots=(typeof MEAL_SLOTS!=='undefined'?MEAL_SLOTS:['아침','아점','점심','점저','저녁','간식','야식']);
  const places=(typeof MEAL_PLACES!=='undefined'?MEAL_PLACES:[['home','🏠','집밥'],['out','🍽️','외식'],['delivery','📦','배달·포장']]);
  const tot=totals(state.rows,state.place);
  const rows=state.rows.map((r,i)=>rowHTML(r,i,state.place)).join('')||'<div class="muted">남은 메뉴가 없어요.</div>';
  const html=`<div class="photo-meal-pane" id="photoMealPane">
    <div class="photo-meal-card">
      <div class="pm-head"><b>사진으로 찾은 메뉴</b>
        <button type="button" class="btn-secondary btn-sm" onclick="DGPhotoMeal.closeConfirm()">닫기</button></div>
      <div class="muted" style="font-size:12px;margin:0 0 10px">칼로리는 음식 표의 공식 값이에요. AI가 숫자를 만들지 않아요. 사진은 저장하지 않아요.</div>
      <div class="label" style="font-size:13px;font-weight:700;margin-bottom:6px">끼니</div>
      <div class="segmented meal-slots" role="tablist">${slots.map(m=>`<button type="button" aria-selected="${state.slot===m}" onclick="DGPhotoMeal.setSlot('${m}')">${m}</button>`).join('')}</div>
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
  const date=(typeof logDate==='string'&&logDate)||(typeof today==='function'?today():'');
  const slot=state.slot||'점심';
  const place=state.place||'';
  const evs=rows.map(r=>{
    const nu=nutritionOf(r.food,r.portionMul||1,place);
    const plab=portionLabel(r.portionMul||1);
    const ev={
      date:date,type:'meal',item:slot,
      value:nu.name+(plab?' ('+plab+')':''),
      kcal:String(nu.kcal),
      protein_g:String(nu.protein),
      kcal_source:'음식표',
      dish_id:nu.id,
      portion:r.portionMul||1,
      note:(function(){if(!place)return '';var m=typeof placeMeta==='function'?placeMeta(place):null;return '방식='+((m&&m[2])||place);})()
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
  const slot=opt.slot||((typeof mealKind==='string'&&mealKind)||(typeof suggestMealSlot==='function'?suggestMealSlot():'점심'));
  const place=opt.place!=null?opt.place:((typeof mealPlace==='string')?mealPlace:'');
  state={rows,slot,place};
  renderConfirm();
  return state;
}

const api={
  PROXY_URL,PORTIONS,MUL_OF,
  sanitizeDishes,matchDish,matchDishes,nutritionOf,totals,candidatesFor,
  pick,recognizeFile,closeConfirm,showError,showLoading,clearError,prepareImage,setRowPortion,removeRow,pickCandidate,
  setSlot,setPlace,confirm,openWithDishes,renderConfirm
};
root.DGPhotoMeal=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
