// 다이어트 게임 0.4.23 — 인터넷에서 찾은 영양(출처 있는 값만). 폰 안에만 저장하고 공식 음식 표가 우선입니다.
(function(root){
const LOOKUP_URL='https://52-79-146-61.sslip.io/lookup';
const CKEY='dg_custom_foods_v1';
const PORTIONS=[{label:'조금',mul:0.5},{label:'보통',mul:1},{label:'많이',mul:1.5}];

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function norm(s){return root.DGFoodSearch?DGFoodSearch.norm(s):String(s||'').toLowerCase().replace(/\s+/g,'');}

function list(){
  try{
    const raw=typeof localStorage!=='undefined'?localStorage.getItem(CKEY):null;
    const arr=raw?JSON.parse(raw):[];
    return Array.isArray(arr)?arr.map(sanitizeFood).filter(Boolean):[];
  }catch(e){return [];}
}
function save(arr){
  if(typeof localStorage==='undefined')return;
  localStorage.setItem(CKEY,JSON.stringify(arr));
}
function officialList(){return (root.DGFoods&&DGFoods.FOODS)||[];}
function officialKeys(off){
  const keys=new Set();
  (off||officialList()).forEach(f=>{
    [f.name].concat(f.aliases||[]).concat(f.searchAliases||[]).forEach(k=>{
      const n=norm(k);if(n)keys.add(n);
    });
  });
  return keys;
}
function coveredByOfficial(name,off){
  const n=norm(name);if(!n)return false;
  const keys=officialKeys(off);
  if(keys.has(n))return true;
  for(const k of keys){
    if(k.startsWith(n)&&n.length>=2)return true;
    if(n.startsWith(k)&&k.length>=3)return true;
  }
  return false;
}
/** 공식 표와 이름이 겹치는 커스텀은 매칭·검색에서 빼요. 공식 값이 우선입니다. */
function usable(off){
  return list().filter(c=>c&&!coveredByOfficial(c.name,off));
}
function all(){return officialList().concat(usable());}
function byId(id){return list().find(f=>f.id===id)||null;}

function sanitizeFood(f){
  if(!f||typeof f!=='object')return null;
  const name=String(f.name||'').trim().slice(0,40);
  const kcal=Math.round(+f.kcal);
  if(!name||!(kcal>=1&&kcal<=8000))return null;
  const protein=f.protein==null||f.protein===''?null:Math.round(+f.protein*10)/10;
  if(protein!=null&&!(protein>=0&&protein<=400))return null;
  const sources=sanitizeSources(f.sources||(f.sourceUrl?[{url:f.sourceUrl,title:f.sourceTitle||''}]:[]));
  if(!sources.length)return null;
  const unit=String(f.unit||f.serving||'1회').trim().slice(0,40)||'1회';
  const id=String(f.id||('custom-'+Math.random().toString(36).slice(2,10))).slice(0,40);
  if(!id.startsWith('custom-'))return null;
  return {
    id,name,
    aliases:Array.isArray(f.aliases)?f.aliases.map(a=>String(a).trim()).filter(Boolean).slice(0,8):[],
    cat:'내가 찾은 메뉴',
    unit,
    kcal,
    protein:protein,
    src:'인터넷 검색값 · '+(sources[0].title||sources[0].url),
    sources,
    sourceUrl:sources[0].url,
    sourceTitle:sources[0].title||'',
    serving:unit,
    custom:true,
    edited:!!f.edited,
    addedAt:f.addedAt||Date.now()
  };
}
function sanitizeSources(arr){
  const out=[], seen=new Set();
  (Array.isArray(arr)?arr:[]).forEach(s=>{
    const url=String(s&&s.url||s||'').trim();
    if(!/^https:\/\//i.test(url))return;
    // 자바스크립트 URL·내부 주소는 버립니다.
    if(/[<>\s]/.test(url)||url.length>500)return;
    const key=url.split('#')[0];
    if(seen.has(key))return;
    seen.add(key);
    out.push({url:key,title:String(s&&s.title||'').trim().slice(0,80)});
  });
  return out.slice(0,5);
}
function sanitizeLookup(input){
  let data=input;
  if(typeof data==='string'){try{data=JSON.parse(data);}catch(e){data={};}}
  if(!data||typeof data!=='object')return {found:false};
  if(data.found===false)return {found:false,reason:data.reason||'not_found'};
  const sources=sanitizeSources(data.sources);
  const kcal=Math.round(+data.kcal);
  const protein=data.protein==null||data.protein===''?null:Math.round(+data.protein*10)/10;
  const name=String(data.name||data.query||'').trim().slice(0,40);
  const serving=String(data.serving||data.unit||'').trim().slice(0,40);
  // 출처 URL이 없으면 값을 쓰지 않아요.
  if(!sources.length||!name||!(kcal>=1&&kcal<=8000))return {found:false,reason:'no_source'};
  if(protein!=null&&!(protein>=0&&protein<=400))return {found:false,reason:'no_source'};
  return {found:true,name,serving:serving||'1회',kcal,protein,sources};
}

function upsert(food,query){
  const f=sanitizeFood(Object.assign({},food,{
    id:food.id&&String(food.id).startsWith('custom-')?food.id:('custom-'+Math.random().toString(36).slice(2,10)),
    aliases:Array.from(new Set([].concat(food.aliases||[],query?[query]:[]))).filter(Boolean)
  }));
  if(!f)return null;
  const arr=list().filter(x=>x.id!==f.id&&norm(x.name)!==norm(f.name));
  arr.unshift(f);
  save(arr.slice(0,80));
  return f;
}
function remove(id){
  save(list().filter(x=>x.id!==id));
}
function update(id,patch){
  const cur=byId(id);if(!cur)return null;
  const next=sanitizeFood(Object.assign({},cur,patch,{id:cur.id,edited:true,sources:cur.sources}));
  if(!next)return null;
  save(list().map(x=>x.id===id?next:x));
  return next;
}

let lookupState=null; // {query,result,portion,ctx}

function closeLookup(){
  lookupState=null;
  if(typeof document==='undefined')return;
  const el=document.getElementById('netFoodPane');
  if(el)el.remove();
}
function showLookupLoading(query){
  if(typeof document==='undefined')return;
  closeLookup();
  const html=`<div class="photo-meal-load" id="netFoodPane"><div class="photo-meal-load-card">‘${esc(query)}’를 인터넷에서 찾고 있어요<div class="muted" style="margin-top:6px;font-size:12px">공식 출처가 있는 값만 써요</div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function showLookupError(msg,query,ctx){
  if(typeof document==='undefined')return;
  const el=document.getElementById('netFoodPane');
  const body=`<div class="photo-meal-err-card">
    <b>찾지 못했어요</b>
    <p>${esc(msg||'공식 출처에서 영양 값을 찾지 못했어요. 이름을 바꿔 다시 해 보거나, 직접 적어서 기록해 주세요.')}</p>
    ${query?`<button type="button" class="btn-secondary btn-lg" style="width:100%;margin-bottom:8px" onclick="DGCustomFoods.lookup('${escJs(query)}',${ctx?JSON.stringify(ctx).replace(/"/g,'&quot;'):'null'})">다시 찾기</button>`:''}
    <button type="button" class="btn-ghost" style="width:100%" onclick="DGCustomFoods.closeLookup()">닫기</button>
  </div>`;
  if(el){el.className='photo-meal-err';el.innerHTML=body;}
  else document.body.insertAdjacentHTML('beforeend',`<div class="photo-meal-err" id="netFoodPane">${body}</div>`);
}
function showLookupResult(result,query,ctx){
  lookupState={query,result,portion:'보통',ctx:ctx||null};
  renderLookup();
}
function setPortion(label){
  if(!lookupState)return;
  lookupState.portion=label;
  renderLookup();
}
function renderLookup(){
  if(typeof document==='undefined'||!lookupState||!lookupState.result)return;
  const r=lookupState.result, por=lookupState.portion||'보통';
  const mul=por==='조금'?0.5:por==='많이'?1.5:1;
  const kcal=Math.round(r.kcal*mul);
  const prot=r.protein==null?null:Math.round(r.protein*mul*10)/10;
  const links=r.sources.map(s=>`<a class="net-src" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a>`).join('');
  const porBtns=PORTIONS.map(p=>`<button type="button" class="pm-por" aria-selected="${por===p.label}" onclick="DGCustomFoods.setPortion('${p.label}')">${p.label}</button>`).join('');
  const html=`<div class="photo-meal-err" id="netFoodPane" role="dialog" aria-label="인터넷 검색값">
    <div class="photo-meal-err-card net-food-card">
      <b>인터넷 검색값</b>
      <p class="muted" style="margin:0 0 10px">공식 출처가 있는 값만 가져왔어요. 확인하시면 이 폰에만 저장되고, 다음부터 바로 찾아져요. 음식 표 공식 값이 있으면 그쪽이 우선입니다.</p>
      <div class="net-food-name"><b>${esc(r.name)}</b><span>${esc(r.serving||'1회')}</span></div>
      <div class="net-food-kcal"><span class="num">${kcal.toLocaleString('ko-KR')}</span>kcal${prot!=null?` · 단백질 ${prot}g`:''}${mul!==1?` <span class="muted">(${esc(por)})</span>`:''}</div>
      <div class="segmented pm-portions" role="tablist" style="margin:10px 0">${porBtns}</div>
      <div class="net-food-src"><span class="muted">출처</span>${links}</div>
      <button type="button" class="btn-primary btn-lg" style="width:100%;margin:14px 0 8px" onclick="DGCustomFoods.confirmLookup()">이 값으로 등록</button>
      <button type="button" class="btn-ghost" style="width:100%" onclick="DGCustomFoods.closeLookup()">닫기</button>
    </div>
  </div>`;
  const el=document.getElementById('netFoodPane');
  if(el)el.outerHTML=html;
  else document.body.insertAdjacentHTML('beforeend',html);
}

/** 출처가 있는 검색값을 확인 없이 이 폰에 저장하고, 열려 있는 기록에 바로 넣어요. */
function applyFound(result,query,ctx){
  ctx=ctx||{};
  const food=upsert({
    name:result.name,
    unit:result.serving,
    serving:result.serving,
    kcal:result.kcal,
    protein:result.protein,
    sources:result.sources
  },query);
  if(!food){
    if(!ctx.silent&&typeof toast==='function')toast('저장하지 못했어요');
    return null;
  }
  closeLookup();
  if(typeof toast==='function')toast('‘'+food.name+'’을(를) 인터넷 검색값으로 넣었어요');
  const mul=1;
  if(ctx.photoIndex!=null&&root.DGPhotoMeal&&DGPhotoMeal.applyFood){
    DGPhotoMeal.applyFood(ctx.photoIndex,food,mul);
    return food;
  }
  if(ctx.search&&root.DGFoodSearch&&DGFoodSearch.pick){
    DGFoodSearch.pick(food.id);
    if(typeof render==='function')render();
    return food;
  }
  if(typeof render==='function')render();
  return food;
}

async function lookup(query,ctx){
  query=String(query||'').trim().slice(0,80);
  if(!query){if(typeof toast==='function')toast('찾을 메뉴 이름을 적어 주세요');return {found:false};}
  ctx=ctx||{};
  const store=ctx.store?String(ctx.store).slice(0,40):'';
  if(!ctx.silent)showLookupLoading(query);
  try{
    let res;
    try{
      res=await fetch(LOOKUP_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query,store})
      });
    }catch(net){
      throw new Error('검색 서버에 연결하지 못했어요. 네트워크를 확인하고 다시 해 주세요');
    }
    let data=null;
    try{data=await res.json();}catch(e){data=null;}
    if(!res.ok){
      const msg=(data&&data.error)||(res.status===429?'요청이 많아요. 잠시 후 다시 해 주세요':'검색하지 못했어요. 잠시 후 다시 해 주세요');
      throw new Error(msg);
    }
    const clean=sanitizeLookup(data);
    if(!clean.found){
      if(!ctx.silent)showLookupError('공식 출처에서 ‘'+query+'’의 영양 값을 찾지 못했어요. 값을 만들어 넣지는 않아요.',query,ctx);
      else closeLookup();
      return clean;
    }
    // 출처가 확인된 값만 자동 저장합니다. 숫자는 만들지 않아요.
    applyFound(clean,query,ctx);
    return clean;
  }catch(err){
    if(!ctx.silent)showLookupError((err&&err.message)||'검색하지 못했어요',query,ctx);
    else closeLookup();
    return {found:false};
  }
}
function lookupForPhoto(index){
  let name='';
  let store='';
  if(root.DGPhotoMeal&&DGPhotoMeal.getState){
    const s=DGPhotoMeal.getState();
    const r=s&&s.rows&&s.rows[index];
    if(r)name=r.name||'';
    store=s&&s.store||'';
  }
  if(!name&&root.DGPhotoMeal&&DGPhotoMeal.rowName)name=DGPhotoMeal.rowName(index);
  return lookup(name||'',{photoIndex:index,store});
}
function lookupForSearch(query){
  return lookup(query,{search:true});
}
function confirmLookup(){
  if(!lookupState||!lookupState.result)return;
  applyFound(lookupState.result,lookupState.query,lookupState.ctx||{});
}

function cardHTML(){
  const arr=list();
  if(!arr.length)return `<div class="card" id="customFoodsCard"><h3>내가 찾은 메뉴</h3><p class="muted" style="margin:0">사진이나 검색에서 음식 표에 없는 메뉴를 ‘인터넷에서 찾기’로 넣은 목록이에요. 이 폰에만 저장되고, 공식 음식 표 값이 있으면 그쪽이 우선입니다.</p></div>`;
  const rows=arr.map(f=>{
    const src=f.sources&&f.sources[0]?`<a href="${esc(f.sources[0].url)}" target="_blank" rel="noopener noreferrer">${esc(f.sources[0].title||'출처')}</a>`:'';
    return `<div class="custom-food-row">
      <div><b>${esc(f.name)}</b><span class="muted"> · ${esc(f.unit)} · ${Math.round(f.kcal).toLocaleString('ko-KR')}kcal${f.protein!=null?` · 단백질 ${f.protein}g`:''}${f.edited?' · 수정됨':''}</span><div class="muted" style="font-size:11px">인터넷 검색값 ${src}</div></div>
      <div class="custom-food-acts">
        <button type="button" class="btn-ghost btn-sm" onclick="DGCustomFoods.editPrompt('${escJs(f.id)}')">수정</button>
        <button type="button" class="btn-ghost btn-sm" onclick="DGCustomFoods.remove('${escJs(f.id)}');if(typeof render==='function')render();">삭제</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="card" id="customFoodsCard"><h3>내가 찾은 메뉴</h3><p class="muted">이 폰에만 저장돼요. 공식 음식 표가 우선입니다.</p>${rows}</div>`;
}
function editPrompt(id){
  const f=byId(id);if(!f)return;
  if(typeof document==='undefined')return;
  const html=`<div class="photo-meal-err" id="netFoodPane">
    <div class="photo-meal-err-card">
      <b>메뉴 수정</b>
      <p class="muted">출처는 그대로 두고, 이름·제공량·칼로리·단백질만 고쳐요.</p>
      <label class="muted">이름</label>
      <input id="cfName" value="${esc(f.name)}" style="width:100%;margin:4px 0 8px">
      <label class="muted">제공량</label>
      <input id="cfUnit" value="${esc(f.unit)}" style="width:100%;margin:4px 0 8px">
      <label class="muted">kcal</label>
      <input id="cfKcal" type="number" value="${esc(f.kcal)}" style="width:100%;margin:4px 0 8px">
      <label class="muted">단백질 g</label>
      <input id="cfProt" type="number" value="${f.protein==null?'':esc(f.protein)}" style="width:100%;margin:4px 0 8px">
      <button type="button" class="btn-primary btn-lg" style="width:100%;margin:8px 0" onclick="DGCustomFoods.saveEdit('${escJs(f.id)}')">저장</button>
      <button type="button" class="btn-ghost" style="width:100%" onclick="DGCustomFoods.closeLookup()">닫기</button>
    </div>
  </div>`;
  closeLookup();
  document.body.insertAdjacentHTML('beforeend',html);
}
function saveEdit(id){
  const g=k=>typeof document!=='undefined'?(document.getElementById(k)||{}).value:'';
  const next=update(id,{name:g('cfName'),unit:g('cfUnit'),serving:g('cfUnit'),kcal:g('cfKcal'),protein:g('cfProt')});
  closeLookup();
  if(!next){if(typeof toast==='function')toast('값을 확인한 뒤 다시 저장해 주세요');return;}
  if(typeof toast==='function')toast('수정했어요');
  if(typeof render==='function')render();
}

const api={
  LOOKUP_URL,CKEY,list,save,usable,all,byId,officialKeys,
  sanitizeFood,sanitizeLookup,sanitizeSources,upsert,remove,update,coveredByOfficial,
  lookup,lookupForPhoto,lookupForSearch,confirmLookup,closeLookup,setPortion,
  showLookupResult,applyFound,cardHTML,editPrompt,saveEdit
};
root.DGCustomFoods=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
