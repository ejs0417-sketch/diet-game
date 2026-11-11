// 다이어트 게임 0.4.5 — 배달 주문 사진 인식·단골 메뉴 (기기 안, 사진은 저장하지 않음)
(function(root){
const DISCLAIMER='건강 정보는 참고용이에요. 진단이 아니며, 정확한 판단은 의사에게 받으세요.';
const PRIVACY='사진은 이 폰 안에서만 읽고, 어디에도 올리지 않아요. 인식이 끝나면 사진을 저장하지 않아요.';
const SHARE_CACHE='dg-share-v1';
const PORTIONS=[0.5,1,1.5,2];

function foods(){return (root.DGFoods&&DGFoods.FOODS)||[];}
function foodSource(){return (root.DGFoods&&DGFoods.SOURCE)||'';}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

function normName(s){
  return String(s||'').toLowerCase()
    .replace(/[()\[\]{}]/g,'')
    .replace(/\s+/g,'')
    .replace(/[~\-_/.,'"]/g,'')
    .replace(/배달의민족|쿠팡이츠|요기요/g,'');
}
function levenshtein(a,b){
  a=String(a||'');b=String(b||'');
  const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  const dp=new Array(n+1);for(let j=0;j<=n;j++)dp[j]=j;
  for(let i=1;i<=m;i++){let prev=dp[0];dp[0]=i;for(let j=1;j<=n;j++){const tmp=dp[j];dp[j]=a[i-1]===b[j-1]?prev:Math.min(prev+1,dp[j]+1,dp[j-1]+1);prev=tmp;}}
  return dp[n];
}
function scoreMatch(query,item){
  const q=normName(query);if(!q)return 0;
  const names=[item.name].concat(item.aliases||[]).map(normName);
  let best=0;
  for(const n of names){
    if(!n)continue;
    if(q===n)return 100;
    if(n.includes(q)||q.includes(n)){
      const ratio=Math.min(q.length,n.length)/Math.max(q.length,n.length);
      best=Math.max(best,78+Math.round(ratio*20));
    }
    const lev=1-levenshtein(q,n)/Math.max(q.length,n.length);
    best=Math.max(best,Math.round(lev*90));
    // token bag (짜장 곱빼기 vs 곱빼기짜장)
    if(q.length>=4&&n.length>=4){
      let hit=0,need=0;
      const parts=q.split(/(?=[가-힣]{2})/).filter(x=>x.length>=2);
      // simpler: sliding 2-char
      for(let i=0;i<=q.length-2;i++){need++;if(n.includes(q.slice(i,i+2)))hit++;}
      if(need)best=Math.max(best,Math.round(50+40*(hit/need)));
    }
  }
  return best;
}
function matchDish(query,minScore){
  minScore=minScore==null?62:minScore;
  let best=null,sc=0;
  foods().forEach(it=>{const s=scoreMatch(query,it);if(s>sc){sc=s;best=it;}});
  return (best&&sc>=minScore)?{item:best,score:sc}:null;
}

function optionMultiplier(options,itemName){
  const already=normName(itemName||'');
  let m=1, add={kcal:0,protein:0,carbs:0,fat:0,sodium:0};
  (options||[]).forEach(o=>{
    const s=normName(o);
    if(/곱빼기|곱배기|곱배/.test(s)){
      if(!/곱빼기|곱배기/.test(already))m*=1.3;
    }else if(/사이즈l|\blarge\b|라지|사이즈대|^l사이즈/.test(s)){
      if(!/한마리|1판/.test(already))m*=1.25;
    }else if(/사이즈s|스몰|사이즈소/.test(s))m*=0.8;
    else if(/치즈크러스트/.test(s)){add.kcal+=200;add.protein+=8;add.carbs+=18;add.fat+=11;add.sodium+=400;}
    else if(/밥추가|공기밥/.test(s)){add.kcal+=300;add.protein+=6;add.carbs+=67;add.fat+=0.5;add.sodium+=5;}
    else if(/제로콜라/.test(s)){add.sodium+=30;}
    else if(/콜라추가/.test(s)){add.kcal+=200;add.carbs+=52;}
  });
  return {m,add};
}
function applyPortion(dish,qty,portion,options){
  if(!dish)return {kcal:0,protein:0,carbs:0,fat:0,sodium:0};
  const {m,add}=optionMultiplier(options,dish.name);
  const k=(qty||1)*(portion||1)*m;
  const r=x=>Math.round(x*10)/10;
  return {
    kcal:Math.round((dish.kcal||0)*k+add.kcal),
    protein:r((dish.protein||0)*k+add.protein),
    carbs:r((dish.carbs||0)*k+add.carbs),
    fat:r((dish.fat||0)*k+add.fat),
    sodium:Math.round((dish.sodium||0)*k+add.sodium)
  };
}

const SKIP=/^(배달의민족|쿠팡이츠|요기요|coupang\s*eats|baemin|yogiyo|주문내역|주문\s*상세|장바구니|결제하기|결제금액|결제\s*정보|합계|총\s*금액|총\s*결제|배달팁|배달비|할인|쿠폰|요청사항|가게\s*요청|일회용|수저|카드|만나서|알뜰배달|배민클럽|주문번호|주문일|배달\s*완료|포장\s*완료|영수증|배달\s*예상|가게\s*사정|포인트|즉시할인|회원)/i;
const PRICE=/([0-9]{1,3}(?:[,.]{1,2}[0-9]{3})+)\s*(?:원|[0-9A-Za-z])?|[₩\s]*([0-9]{1,3}(?:,[0-9]{3})+)(?:원|[0-9A-Za-z])?\s*$/;
const QTY=/(?:수량|갯수)\s*([0-9]+)\s*(?:개|개입)?|(?:^|\s)(?:x|×)\s*([0-9]+)/i;

function parsePrice(s){return +(String(s||'').replace(/[.,]/g,''))||0;}
function cleanOcrText(s){
  return String(s||'')
    .replace(/흥콩/g,'홍콩')
    .replace(/곰빼기/g,'곱빼기')
    .replace(/([0-9]),\.([0-9]{3})/g,'$1,$2')
    .replace(/합계\s*([0-9,]+)[0-9A-Za-z]?$/gm,'합계 $1원');
}
function repairMenuName(name,store){
  const n=String(name||'').trim();
  const st=String(store||'');
  if(/^[A-Za-z]{1,4}\s*한그릇/.test(n) && /반점|중식|홍콩|중국/.test(st))return '짬뽕 한그릇';
  if(/^[A-Za-z]{1,4}\s*한그릇/.test(n)){
    const hit=matchDish('짬뽕 한그릇',50); if(hit)return '짬뽕 한그릇';
  }
  return n;
}
function parseOrderText(text){
  const lines=cleanOcrText(text).split(/\r?\n/).map(l=>l.replace(/[|]/g,' ').trim()).filter(Boolean);
  let store='',items=[],sawMenu=false;
  const storeHint=[];
  for(const line of lines){
    if(SKIP.test(line))continue;
    if(/^(수량|갯수)\b/.test(line) || (/^[A-Za-z]{1,3}\s*[0-9]+\s*개/.test(line)&&items.length)){
      const qm0=line.match(/([0-9]+)/);if(qm0&&items.length)items[items.length-1].qty=+(qm0[1]||1);
      continue;
    }
    if(/^(옵션|추가|선택)\s*[:：]/.test(line)||/^(곱빼기|곱배기|곰빼기|치즈크러스트|콜라\s*추가|무\s*추가|밥\s*추가|사이즈)/.test(line)){
      if(items.length)items[items.length-1].options.push(line.replace(/^(옵션|추가|선택)\s*[:：]\s*/,'').trim().replace(/곰빼기/g,'곱빼기'));
      continue;
    }
    const pm=line.match(PRICE);
    const qm=line.match(QTY);
    const qty=qm?+(qm[1]||qm[2]||qm[3]||1):1;
    let name=line.replace(PRICE,'').replace(QTY,'').replace(/[·•]/g,' ').replace(/\s{2,}/g,' ').trim();
    name=name.replace(/^\d+[\.)]\s*/,'').replace(/^\s*[-–]\s*/,'').trim();
    name=repairMenuName(name,store||(storeHint[storeHint.length-1]||''));
    if(pm&&name&&name.length>=2&&!SKIP.test(name)&&!/원$/.test(name)){
      items.push({name,qty,price:parsePrice(pm[1]||pm[2]),options:[],raw:line});
      if(!store&&storeHint.length)store=storeHint[storeHint.length-1];
      sawMenu=true;
      continue;
    }
    // quantity-only follow line
    if(qm&&!pm&&items.length&&name.length<4){items[items.length-1].qty=qty;continue;}
    if(!pm&&name.length>=2&&name.length<=28&&!/[0-9]{3,}/.test(name)){
      if(!sawMenu)storeHint.push(line);
      else if(items.length&&name.length<=16)items[items.length-1].options.push(name);
    }
  }
  if(!store&&storeHint.length)store=storeHint[0];
  return {store:store||'',items};
}

function rowsFromParsed(parsed){
  return (parsed.items||[]).map(it=>{
    const q=it.name+(it.options&&it.options.length?' '+it.options.join(' '):'');
    const hit=matchDish(q)||matchDish(it.name);
    const dish=hit&&hit.item;
    const portion=1;
    const nut=dish?applyPortion(dish,it.qty||1,portion,it.options):{kcal:'',protein:'',carbs:'',fat:'',sodium:''};
    return {
      name:it.name,qty:it.qty||1,portion,options:it.options||[],
      dishId:dish?dish.id:null,match:dish?dish.name:null,score:hit?hit.score:0,
      kcal:nut.kcal,protein:nut.protein,carbs:nut.carbs,fat:nut.fat,sodium:nut.sodium,
      unit:dish?dish.unit:'',on:true
    };
  });
}

function todayEaten(raw,date){
  raw=raw||(typeof root.raw!=='undefined'?root.raw:[]);
  date=date||(typeof today==='function'?today():'');
  return raw.filter(e=>e.date===date&&e.type==='meal'&&e.value).map(e=>e.value);
}
function sameMenu(a,b){
  const x=normName(a),y=normName(b);if(!x||!y)return false;
  if(x===y)return true;
  const lo=x.length<y.length?x:y,hi=x.length<y.length?y:x;
  if(lo.length>=4&&hi.includes(lo)&&lo.length/hi.length>=0.55)return true;
  return false;
}
function eatenTodaySet(names){
  const n=(names||[]).filter(Boolean);
  return {has(name){return n.some(x=>sameMenu(x,name));}};
}

function favList(){
  const s=(typeof settings!=='undefined'&&settings&&Array.isArray(settings.favMenus))?settings.favMenus:[];
  return s.map(f=>Object.assign({},f));
}
function saveFavs(list){
  if(typeof settings==='undefined')return;
  settings.favMenus=list;
  if(typeof saveSettings==='function')saveSettings();
}
function mergeFavs(a,b){
  const map=new Map();
  (a||[]).concat(b||[]).forEach(f=>{
    if(!f||!f.name)return;
    const k=normName(f.name);if(!k)return;
    const prev=map.get(k);
    if(!prev){map.set(k,Object.assign({},f, {count:+f.count||1,last:f.last||''}));return;}
    const newer=(f.last||'')>(prev.last||'');
    map.set(k,Object.assign({},newer?f:prev,{
      count:Math.max(+prev.count||0,+f.count||0),
      last:(prev.last||'')>(f.last||'')?prev.last:f.last
    }));
  });
  return [...map.values()].sort((x,y)=>(y.count||0)-(x.count||0));
}
function rememberFav(row,date){
  if(!row||!row.name)return;
  const list=favList();
  const k=normName(row.name);
  const i=list.findIndex(f=>normName(f.name)===k||(row.dishId&&f.dishId===row.dishId));
  const rec={name:row.match||row.name,dishId:row.dishId||null,count:1,last:date||'',store:row.store||'',kcal:row.kcal,protein:row.protein,carbs:row.carbs,fat:row.fat,sodium:row.sodium};
  if(i<0)list.push(rec);
  else{
    list[i].count=(+list[i].count||0)+1;
    list[i].last=date||list[i].last;
    if(row.kcal){list[i].kcal=row.kcal;list[i].protein=row.protein;list[i].carbs=row.carbs;list[i].fat=row.fat;list[i].sodium=row.sodium;}
    if(row.dishId)list[i].dishId=row.dishId;
    if(row.match)list[i].name=row.match;
  }
  saveFavs(list.sort((a,b)=>(b.count||0)-(a.count||0)));
}

function rankFavorites(favs,opt){
  opt=opt||{};
  const eaten=eatenTodaySet(opt.todayNames||[]);
  const remainKcal=Math.max(0,1800-(+opt.kcal||0));
  const remainProt=Math.max(0,130-(+opt.prot||0));
  return (favs||[]).filter(f=>f&&f.name&&!eaten.has(f.name)).map(f=>{
    let score=(+f.count||1)*3;
    if(f.last)score+=1;
    const k=+f.kcal||0,p=+f.protein||0;
    if(remainProt>30&&p>=25)score+=22;
    else if(remainProt>15&&p>=18)score+=14;
    else if(remainProt<=10&&p>=30)score-=8;
    if(k>0&&k<=remainKcal*1.1)score+=12;
    if(remainKcal<500&&k>700)score-=18;
    if(remainKcal<800&&k>900)score-=12;
    if(remainProt>40&&p<15)score-=10;
    return {item:f,score};
  }).sort((a,b)=>b.score-a.score).map(x=>x.item);
}

// ---------- UI ----------
let pane=null, draft=null;

function openPane(data){draft=data;renderPane();}
function closePane(){
  draft=null;const el=$('#delivPane');if(el)el.remove();
  if(typeof render==='function')render();
}
function renderPane(){
  if(!draft){const el=$('#delivPane');if(el)el.remove();return;}
  let el=$('#delivPane');
  if(!el){el=document.createElement('div');el.id='delivPane';el.className='health-pane';document.body.appendChild(el);}
  if(draft.mode==='busy')el.innerHTML=`<div class="health-sheet"><div class="card"><h3>주문 사진을 읽고 있어요</h3><p class="muted">${esc(draft.msg||PRIVACY)}</p></div></div>`;
  else el.innerHTML=confirmHTML(draft);
  el.scrollTop=0;
}

function confirmHTML(d){
  const slot=d.slot||(typeof suggestMealSlot==='function'?suggestMealSlot(d.date):'저녁');
  const slots=(typeof MEAL_SLOTS!=='undefined'?MEAL_SLOTS:['아침','아점','점심','점저','저녁','간식','야식']);
  const rows=d.rows||[];
  const tot=rows.filter(r=>r.on).reduce((s,r)=>({kcal:s.kcal+(+r.kcal||0),protein:s.protein+(+r.protein||0),sodium:s.sodium+(+r.sodium||0)}),{kcal:0,protein:0,sodium:0});
  const note=d.ocrError?`<div class="banner warn">글자를 읽지 못했어요. 아래에서 메뉴를 직접 고르거나 적어 주세요.</div>`:
    (rows.length?`<div class="muted">찾은 메뉴 ${rows.length}개. 틀린 줄은 고치고, 나눠 먹었으면 인분을 바꿔 주세요.</div>`:`<div class="banner flat">메뉴를 자동으로 찾지 못했어요. 아래에서 직접 적어 주세요.</div>`);
  return `<div class="health-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">배달 주문 확인</h2><button type="button" class="btn-ghost btn-sm" onclick="DGDelivery.close()">닫기</button></div>
    ${note}
    <p class="muted">${esc(PRIVACY)}</p>
    <div class="card">
      <label class="field"><span class="label">가게</span><input class="input" id="dvStore" value="${esc(d.store||'')}" placeholder="가게 이름 (선택)"></label>
      <div class="label" style="margin:10px 0 6px">끼니</div>
      <div class="segmented meal-slots" data-seg="dvslot" style="background:#F3F5FB">${slots.map(m=>`<button type="button" data-k="${m}" aria-selected="${slot===m}" onclick="DGDelivery.setSlot('${m}')">${m}</button>`).join('')}</div>
    </div>
    ${rows.map((r,i)=>rowHTML(r,i)).join('')||'<div class="card muted">줄이 없어요.</div>'}
    <button type="button" class="btn-secondary btn-block" onclick="DGDelivery.addRow()">+ 메뉴 줄 추가</button>
    <div class="card"><b>합계</b> (켜 둔 줄) <span class="num">${tot.kcal}kcal · 단백질 ${Math.round(tot.protein)}g · 나트륨 ${tot.sodium}mg</span>
      <div class="muted" style="margin-top:6px;font-size:11px">${esc(foodSource())}</div></div>
    <p class="muted">${esc(DISCLAIMER)}</p>
    <button type="button" class="btn-primary btn-lg" onclick="DGDelivery.save()">식사로 기록하기</button>
  </div>`;
}
function rowHTML(r,i){
  const on=r.on!==false;
  return `<div class="card dv-row ${on?'':'off'}" data-i="${i}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" ${on?'checked':''} onchange="DGDelivery.toggleRow(${i},this.checked)"> 이 줄 기록</label>
      <button type="button" class="btn-ghost btn-sm" onclick="DGDelivery.removeRow(${i})">삭제</button>
    </div>
    <label class="field"><span class="label">메뉴</span><input class="input" value="${esc(r.name||'')}" onchange="DGDelivery.rename(${i},this.value)" placeholder="메뉴 이름"></label>
    ${r.match?`<div class="muted" style="margin:4px 0 8px">맞춤: ${esc(r.match)}${r.unit?' · '+esc(r.unit):''}${r.score?` · ${Math.round(r.score)}점`:''}</div>`:'<div class="muted" style="margin:4px 0 8px">표에서 못 찾았어요. 칼로리를 직접 적어도 돼요.</div>'}
    ${r.options&&r.options.length?`<div class="muted">옵션: ${esc(r.options.join(', '))}</div>`:''}
    <div class="rowx" style="margin-top:8px">
      <label class="field"><span class="label">수량</span><input class="input" type="number" min="1" step="1" value="${esc(r.qty||1)}" onchange="DGDelivery.setQty(${i},this.value)"></label>
      <label class="field"><span class="label">인분</span>
        <div class="segmented" data-seg="por">${PORTIONS.map(p=>`<button type="button" aria-selected="${(+r.portion||1)===p}" onclick="DGDelivery.setPortion(${i},${p})">${p}</button>`).join('')}</div>
      </label>
    </div>
    <div class="rowx" style="margin-top:8px">
      <label class="field"><span class="label">kcal</span><input class="input" inputmode="numeric" value="${esc(r.kcal)}" onchange="DGDelivery.setMacro(${i},'kcal',this.value)"></label>
      <label class="field"><span class="label">단백질 g</span><input class="input" inputmode="decimal" value="${esc(r.protein)}" onchange="DGDelivery.setMacro(${i},'protein',this.value)"></label>
    </div>
    <div class="rowx" style="margin-top:8px">
      <label class="field"><span class="label">탄수화물 g</span><input class="input" inputmode="decimal" value="${esc(r.carbs)}" onchange="DGDelivery.setMacro(${i},'carbs',this.value)"></label>
      <label class="field"><span class="label">지방 g</span><input class="input" inputmode="decimal" value="${esc(r.fat)}" onchange="DGDelivery.setMacro(${i},'fat',this.value)"></label>
    </div>
    <label class="field" style="margin-top:8px"><span class="label">나트륨 mg</span><input class="input" inputmode="numeric" value="${esc(r.sodium)}" onchange="DGDelivery.setMacro(${i},'sodium',this.value)"></label>
  </div>`;
}
function touch(fn){if(!draft)return;fn(draft);renderPane();}
function setSlot(s){touch(d=>d.slot=s);}
function toggleRow(i,on){touch(d=>{if(d.rows[i])d.rows[i].on=on;});}
function removeRow(i){touch(d=>d.rows.splice(i,1));}
function addRow(){touch(d=>{d.rows.push({name:'',qty:1,portion:1,options:[],dishId:null,match:null,kcal:'',protein:'',carbs:'',fat:'',sodium:'',on:true});});}
function rename(i,name){touch(d=>{const r=d.rows[i];if(!r)return;r.name=name;const hit=matchDish(name);if(hit){r.dishId=hit.item.id;r.match=hit.item.name;r.score=hit.score;r.unit=hit.item.unit;Object.assign(r,applyPortion(hit.item,r.qty,r.portion,r.options));}else{r.dishId=null;r.match=null;}});}
function setQty(i,v){touch(d=>{const r=d.rows[i];if(!r)return;r.qty=Math.max(1,+v||1);recalc(r);});}
function setPortion(i,p){touch(d=>{const r=d.rows[i];if(!r)return;r.portion=p;recalc(r);});}
function setMacro(i,k,v){touch(d=>{const r=d.rows[i];if(!r)return;r[k]=v===''?'':+v;});}
function recalc(r){
  const dish=r.dishId?foods().find(f=>f.id===r.dishId):null;
  if(!dish)return;
  Object.assign(r,applyPortion(dish,r.qty,r.portion,r.options));
}

function pick(){
  let inp=$('#delivPick');
  if(!inp){inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.id='delivPick';inp.style.display='none';
    inp.onchange=()=>{const f=inp.files&&inp.files[0];inp.value='';if(f)importFile(f);};
    document.body.appendChild(inp);}
  inp.click();
}

async function importFile(file){
  if(!file)return;
  if(file.type&&!file.type.startsWith('image/')&&!/\.(png|jpe?g|webp|gif|heic)$/i.test(file.name||'')){
    if(typeof toast==='function')toast('주문 사진(이미지)만 불러올 수 있어요');return;
  }
  openPane({mode:'busy',msg:'사진을 이 폰 안에서 읽고 있어요. 어디에도 올리지 않고, 끝나면 사진을 남기지 않아요.'});
  let text='',ocrError=false;
  try{
    if(typeof DGHealth==='undefined'||!DGHealth.ocrImage)throw new Error('ocr-unavailable');
    text=await DGHealth.ocrImage(file);
  }catch(e){ocrError=true;text='';}
  const parsed=parseOrderText(text||'');
  const rows=rowsFromParsed(parsed);
  const date=(typeof logDate!=='undefined'&&logDate)||(typeof today==='function'?today():'');
  const slot=typeof suggestMealSlot==='function'?suggestMealSlot(date):'저녁';
  // drop image refs
  file=null;text=parsed&&parsed.items?text:'';
  openPane({mode:'confirm',store:parsed.store,rows,slot,date,ocrError,rawText:null});
}

function commitMeals(){
  if(!draft)return;
  const store=($('#dvStore')&&$('#dvStore').value)||draft.store||'';
  const slot=draft.slot||(typeof suggestMealSlot==='function'?suggestMealSlot():'저녁');
  const date=draft.date||(typeof today==='function'?today():'');
  const rows=(draft.rows||[]).filter(r=>r.on!==false&&String(r.name||'').trim());
  if(!rows.length){if(typeof toast==='function')toast('기록할 메뉴를 한 줄 이상 남겨 주세요');return;}
  const evs=rows.map(r=>{
    const name=String(r.name).trim();
    const nut={kcal:r.kcal,protein:r.protein,carbs:r.carbs,fat:r.fat,sodium:r.sodium};
    rememberFav(Object.assign({store},r,{name}),date);
    return {
      date,type:'meal',item:slot,value:r.match||name,
      kcal:r.kcal===''||r.kcal==null?'':String(r.kcal),
      protein_g:r.protein===''||r.protein==null?'':String(r.protein),
      carbs_g:r.carbs===''||r.carbs==null?'':String(r.carbs),
      fat_g:r.fat===''||r.fat==null?'':String(r.fat),
      sodium_mg:r.sodium===''||r.sodium==null?'':String(r.sodium),
      kcal_source:r.dishId?'배달메뉴표(대략)':(r.kcal?'직접입력':''),
      store,portion:r.portion,qty:r.qty,dish_id:r.dishId||'',
      note:[(r.options||[]).join(', '),store?('가게='+store):''].filter(Boolean).join('; ')
    };
  });
  root._dgLastMealLog=evs[evs.length-1];
  if(typeof withId==='function'&&typeof raw!=='undefined'){
    evs.forEach(e=>raw.push(withId(e)));
    if(typeof root.save==='function')root.save();
  }
  const n=evs.length,k=evs.reduce((s,e)=>s+(+e.kcal||0),0),p=evs.reduce((s,e)=>s+(+e.protein_g||0),0);
  draft=null;const el=$('#delivPane');if(el)el.remove();
  if(typeof toast==='function')toast(`${slot}에 배달 ${n}개 기록 · ${k}kcal · 단백질 ${Math.round(p)}g`);
  if(typeof render==='function'){if(typeof tab!=='undefined')tab='home';render();}
}

function logFavorite(name){
  const list=favList();
  const f=list.find(x=>x.name===name)||list.find(x=>normName(x.name)===normName(name));
  if(!f){if(typeof toast==='function')toast('단골 메뉴를 찾지 못했어요');return;}
  const date=(typeof logDate!=='undefined'&&logDate)||(typeof today==='function'?today():'');
  const eaten=eatenTodaySet(todayEaten(typeof raw!=='undefined'?raw:[],date));
  if(eaten.has(f.name)){if(typeof toast==='function')toast('오늘은 이미 같은 메뉴를 기록했어요');return;}
  const slot=typeof suggestMealSlot==='function'?suggestMealSlot(date):'저녁';
  const ev={
    date,type:'meal',item:slot,value:f.name,
    kcal:f.kcal==null?'':String(f.kcal),protein_g:f.protein==null?'':String(f.protein),
    carbs_g:f.carbs==null?'':String(f.carbs),fat_g:f.fat==null?'':String(f.fat),
    sodium_mg:f.sodium==null?'':String(f.sodium),
    kcal_source:f.dishId?'배달메뉴표(대략)':(f.kcal?'단골':'') ,
    dish_id:f.dishId||'',portion:1,qty:1,store:f.store||'',note:f.store?('가게='+f.store):''
  };
  rememberFav(Object.assign({},f,{match:f.name}),date);
  root._dgLastMealLog=ev;
  if(typeof withId==='function'){raw.push(withId(ev));if(typeof root.save==='function')root.save();}
  if(typeof toast==='function')toast(`${f.name}을(를) ${slot}으로 기록했어요`);
  if(typeof render==='function')render();
}

function chipsHTML(C){
  const date=(C&&C.today)||(typeof today==='function'?today():'');
  const t=(C&&C.days&&C.days[date])||{};
  const names=todayEaten(typeof raw!=='undefined'?raw:[],date);
  const ranked=rankFavorites(favList(),{todayNames:names,kcal:t.kcal,prot:t.prot});
  if(!ranked.length&&!favList().length)return `<div class="muted" style="font-size:12px;margin-top:8px">배달 사진을 한 번 기록하면 단골 메뉴가 생겨요. 같은 메뉴는 하루에 한 번만 추천해요.</div>`;
  if(!ranked.length)return `<div class="muted" style="font-size:12px;margin-top:8px">오늘 이미 먹은 단골은 빼 두었어요.</div>`;
  const show=ranked.slice(0,6);
  return `<div class="fav-block"><div class="label" style="font-size:13px;font-weight:700;margin:8px 0 6px">단골 메뉴 <span class="muted" style="font-weight:600">오늘 먹은 건 빼요</span></div>
    <div class="look-picks fav-chips">${show.map(f=>`<button type="button" class="chip" onclick="DGDelivery.logFavorite('${escJs(f.name)}')">${esc(f.name)}${f.kcal?` · ${Math.round(f.kcal)}kcal`:''}</button>`).join('')}</div></div>`;
}

async function consumeShare(){
  try{
    if(!('caches' in root))return;
    const cache=await caches.open(SHARE_CACHE);
    const res=await cache.match('pending');
    await cache.delete('pending');
    try{history.replaceState({},'',location.pathname+(location.hash||''));}catch(e){}
    if(!res)return;
    const blob=await res.blob();
    const file=new File([blob],decodeURIComponent(res.headers.get('X-Filename')||'order.png'),{type:blob.type||'image/png'});
    await importFile(file);
  }catch(e){if(typeof toast==='function')toast('공유된 사진을 읽지 못했어요');}
}
function bootShare(){
  if(/[?&](delivery=1|share=delivery)/.test(location.search))consumeShare();
}

const api={
  DISCLAIMER,PRIVACY,PORTIONS,normName,levenshtein,scoreMatch,matchDish,
  applyPortion,optionMultiplier,cleanOcrText,repairMenuName,parseOrderText,rowsFromParsed,parsePrice,
  todayEaten,eatenTodaySet,sameMenu,rankFavorites,mergeFavs,favList,rememberFav,
  pick,importFile,openPane,close:closePane,closePane,setSlot,toggleRow,removeRow,addRow,
  rename,setQty,setPortion,setMacro,save:commitMeals,commitMeals,logFavorite,chipsHTML,consumeShare,bootShare
};
root.DGDelivery=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
