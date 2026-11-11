// 다이어트 게임 0.4.6 — 배달 주문 사진 인식·나눠 먹기·남은 음식 (기기 안, 사진은 저장하지 않음)
(function(root){
const DISCLAIMER='건강 정보는 참고용이에요. 진단이 아니며, 정확한 판단은 의사에게 받으세요.';
const PRIVACY='사진은 이 폰 안에서만 읽고, 어디에도 올리지 않아요. 인식이 끝나면 사진을 저장하지 않아요.';
const PRIVACY_LINE='읽는 것: 가게·메뉴·수량·옵션·주문 시각 / 읽지 않는 것: 주소·전화·카드·결제';
const SHARE_CACHE='dg-share-v1';
const PORTIONS=[0.5,1,1.5,2];
const PEOPLE_CHOICES=[1,2,3,4,5,6];
const EATEN_PRESETS=[{k:1,label:'다 먹음'},{k:0.75,label:'3/4'},{k:0.5,label:'반'},{k:0.25,label:'1/4'}];

function foods(){return (root.DGFoods&&DGFoods.FOODS)||[];}
function foodSource(){return (root.DGFoods&&DGFoods.SOURCE)||'';}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function pad2(n){n=+n;return (n<10?'0':'')+n;}
function addDays(date,n){
  if(!date)return '';
  const p=String(date).split('-');if(p.length<3)return date;
  const u=Date.UTC(+p[0],+p[1]-1,+p[2])+n*864e5;
  return new Date(u).toISOString().slice(0,10);
}
function scaleNut(nut,k){
  const r=x=>Math.round((+x||0)*k*10)/10;
  return {kcal:Math.round((+nut.kcal||0)*k),protein:r(nut.protein),carbs:r(nut.carbs),fat:r(nut.fat),sodium:Math.round((+nut.sodium||0)*k)};
}
function addNut(a,b){
  return {kcal:(+a.kcal||0)+(+b.kcal||0),protein:(+a.protein||0)+(+b.protein||0),carbs:(+a.carbs||0)+(+b.carbs||0),fat:(+a.fat||0)+(+b.fat||0),sodium:(+a.sodium||0)+(+b.sodium||0)};
}

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
    if(q.length>=4&&n.length>=4){
      let hit=0,need=0;
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

function optionAdds(options,itemName){
  const already=normName(itemName||'');
  let m=1, add={kcal:0,protein:0,carbs:0,fat:0,sodium:0};
  (options||[]).forEach(o=>{
    const s=String(o||'');
    const n=normName(s);
    if(/곱빼기|곱배기|곱배/.test(n)){
      if(!/곱빼기|곱배기/.test(already))m*=1.3;
      return;
    }
    if(/사이즈l|\blarge\b|라지|사이즈대|^l사이즈/.test(n)){
      if(!/한마리|1판/.test(already))m*=1.25;
      return;
    }
    if(/사이즈s|스몰|사이즈소/.test(n)){m*=0.8;return;}
    if(/순살/.test(n)&&!/순살/.test(already)){m*=1.05;return;}
    if(/^(뼈|뼈로|뼈있음)$/.test(n)||n==='뼈')return;
    if(/치즈크러스트/.test(n)){add=addNut(add,{kcal:200,protein:8,carbs:18,fat:11,sodium:400});return;}
    if(/밥추가|공기밥/.test(n)){add=addNut(add,{kcal:300,protein:6,carbs:67,fat:0.5,sodium:5});return;}
    if(/제로콜라/.test(n)){add=addNut(add,{sodium:30});return;}
    if(/콜라추가/.test(n)){add=addNut(add,{kcal:200,carbs:52});return;}
    const egg=s.match(/(?:계란|달걀)\s*([0-9]+)?\s*알/)||n.match(/계란([0-9]+)?알/)||n.match(/달걀([0-9]+)?알/);
    if(/계란|달걀/.test(n)&&(egg||/추가/.test(n)||/알/.test(n))){
      const c=egg&&(egg[1]||egg[2])?+(egg[1]||egg[2]):1;
      add=addNut(add,scaleNut({kcal:75,protein:6.3,carbs:0.4,fat:5.3,sodium:70},c));
      return;
    }
    if(/요거트아이스|요거트\s*아이스/.test(n)){add=addNut(add,{kcal:90,protein:3,carbs:12,fat:3,sodium:40});return;}
    if(/오리엔탈/.test(n)){add=addNut(add,{kcal:80,protein:0,carbs:6,fat:6,sodium:280});return;}
    if(/랜치/.test(n)){add=addNut(add,{kcal:120,protein:1,carbs:2,fat:12,sodium:200});return;}
    if(/시저/.test(n)){add=addNut(add,{kcal:110,protein:1,carbs:2,fat:11,sodium:250});return;}
    if(/발사믹/.test(n)){add=addNut(add,{kcal:40,protein:0,carbs:6,fat:1.5,sodium:80});return;}
    if(/드레싱/.test(n)){add=addNut(add,{kcal:80,protein:0,carbs:5,fat:6,sodium:250});return;}
  });
  return {m,add};
}
function optionMultiplier(options,itemName){return optionAdds(options,itemName);}
function applyPortion(dish,qty,portion,options){
  if(!dish)return {kcal:0,protein:0,carbs:0,fat:0,sodium:0};
  const {m,add}=optionAdds(options,dish.name);
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

function myShareFrac(row,orderPeople){
  const qty=Math.max(1,+row.qty||1);
  if(row.shareMode==='portion'){
    return (+row.portion||1)/qty;
  }
  const p=Math.max(1,+(row.peopleOverride||orderPeople||1));
  return 1/p;
}
function eatenFracOf(row){
  const e=row&&row.eatenFrac;if(e==null||e==='')return 1;
  const n=+e;if(!isFinite(n))return 1;return Math.max(0,Math.min(1,n));
}
function shareAndEaten(full,opt){
  opt=opt||{};
  const row={qty:opt.qty||1,portion:opt.portion,shareMode:opt.shareMode,peopleOverride:opt.sharePeople,eatenFrac:opt.eatenFrac};
  const people=Math.max(1,+opt.people||1);
  const my=myShareFrac(row,people);
  const eaten=eatenFracOf(row);
  return {myFrac:my,eatenFrac:eaten,logged:scaleNut(full,my*eaten),leftover:scaleNut(full,my*(1-eaten))};
}

const SKIP=/^(배달의민족|쿠팡이츠|요기요|coupang\s*eats|baemin|yogiyo|주문내역|주문\s*상세|주문상세|장바구니|결제하기|결제금액|결제\s*정보|결제수단|결제내역|결제\s*완료|합계|총\s*금액|총\s*결제|총액|배달팁|배달비|할인|쿠폰|요청사항|가게\s*요청|일회용|수저|만나서|알뜰배달|배민클럽|배민원|배달\s*완료|포장\s*완료|영수증|주문\s*영수증|배달\s*예상|가게\s*사정|포인트|즉시할인|회원|이용\s*금액|상품\s*금액|주문\s*금액)/i;
const PII_LINE=/(주소|배달주소|배송지|도착지|상세주소|도로명|연락처|전화번호|안심번호|안심전화|휴대폰|휴대전화|주문번호|주문\s*번호|접수번호|카드번호|카드\s*번호|승인번호|개인카드|결제카드|신용\s*카드|체크\s*카드|(?:^|\s)카드(?:\s|$)|카드$|^카드|유효기간)/;
const PII_VALUE=/(?:010|011|016|017|018|019|050)\D?\d{3,4}\D?\d{4}|(?:\d{4}[\s*\-·]{1,4}){3}\d{4}/;
const PAY_LINE=/^(입금|결제|할인|쿠폰|배달비|배달팁|포인트|총액|합계|즉시할인|상품금액|주문금액|이용금액|결제금액|결제정보|결제수단)/;
const PRICE=/([0-9]{1,3}(?:[,.]{1,2}[0-9]{3})+)\s*(?:원|[0-9A-Za-z])?|[₩\s]*([0-9]{1,3}(?:,[0-9]{3})+)(?:원|[0-9A-Za-z])?\s*$/;
const QTY=/(?:수량|갯수)\s*([0-9]+)\s*(?:개|개입)?|(?:^|\s)(?:x|×)\s*([0-9]+)\s*$|(?:^|\s)(?:x|×)\s*([0-9]+)(?:\s|$)/i;
const QTY_GAE=/(?:^|\s)([0-9]{1,2})\s*개(?:\s|$)/;
const TIME_RE=/(20\d{2})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})일?\s*(?:\([^)]{0,6}\))?\s*(\d{1,2})[:시]\s*(\d{2})/;
const DATE_RE=/(20\d{2})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})일?/;

function parsePrice(s){return +(String(s||'').replace(/[.,]/g,''))||0;}
function cleanOcrText(s){
  return String(s||'')
    .replace(/흥콩/g,'홍콩')
    .replace(/곰빼기/g,'곱빼기')
    .replace(/([0-9]),\.([0-9]{3})/g,'$1,$2')
    .replace(/합계\s*([0-9,]+)[0-9A-Za-z]?$/gm,'합계 $1원');
}
function isPiiLine(line){
  const s=String(line||'');
  if(PII_LINE.test(s))return true;
  if(PII_VALUE.test(s))return true;
  return false;
}
function isSkipLine(line){
  const s=String(line||'').trim();
  if(!s)return true;
  if(SKIP.test(s)||PAY_LINE.test(s)||isPiiLine(s))return true;
  if(/주문일시|주문시간|주문\s*시각|결제일시|결제시간/.test(s)&&!/[가-힣]{2,}.{0,8}(치킨|피자|샐러드|면|밥|탕|찌개)/.test(s))return false; // time kept for parseOrderTime, dropped as item
  return false;
}
function scrubSensitiveText(s){
  return String(s||'').split(/\r?\n/).map(line=>{
    if(isPiiLine(line)||PII_VALUE.test(line))return '●●●';
    return line;
  }).join('\n');
}
function detectApp(text){
  const t=String(text||'');
  if(/쿠팡이츠|coupang\s*eats|쿠팡\s*이츠/i.test(t))return '쿠팡이츠';
  if(/배달의민족|배민클럽|배민원|\bbaemin\b/i.test(t))return '배민';
  if(/요기요|\byogiyo\b/i.test(t))return '요기요';
  if(/\bx\s*[0-9]+\s*$/im.test(t)&&/주문상세|주문내역/.test(t))return '요기요';
  if(/[0-9]+\s*개/.test(t)&&/주문\s*메뉴|주문상세/.test(t))return '배민';
  return '';
}
function parseOrderTime(text){
  const t=String(text||'');
  let m=t.match(TIME_RE);
  if(m)return {date:m[1]+'-'+pad2(m[2])+'-'+pad2(m[3]),time:pad2(m[4])+':'+m[5]};
  m=t.match(DATE_RE);
  if(m)return {date:m[1]+'-'+pad2(m[2])+'-'+pad2(m[3]),time:''};
  return {date:'',time:''};
}
function slotFromWhen(date,time){
  const sug=typeof suggestMealSlot==='function'?suggestMealSlot:null;
  if(!sug)return '점심';
  if(date&&time){
    const now=new Date(date+'T'+time+':00+09:00');
    if(!isNaN(now.getTime()))return sug(date,now);
  }
  return sug(date);
}
function looksLikeStore(s){
  const n=String(s||'').trim();
  if(n.length<2||n.length>28)return false;
  if(isPiiLine(n)||SKIP.test(n)||PAY_LINE.test(n))return false;
  if(TIME_RE.test(n)||DATE_RE.test(n))return false;
  if(/^[0-9,.\s원x×개]+$/i.test(n))return false;
  if(/옵션|드레싱|계란|순살|^뼈$/.test(n))return false;
  return true;
}
function looksLikeOption(s){
  const n=String(s||'').trim();
  if(/^(옵션|추가|선택|선택사항)\s*[:：]/.test(n))return true;
  if(/^[·•\-–▪●.]\s*\S/.test(n))return true;
  if(/^[.\s]*뼈\s*$/.test(n)||/^[.\s]*순살\s*$/.test(n))return true;
  if(/^(뼈|순살|오리엔탈|계란|달걀|드레싱|요거트아이스|곱빼기|곱배기|치즈크러스트|밥추가|콜라)/.test(n))return true;
  return false;
}
function optionText(s){
  return String(s||'').replace(/^(옵션|추가|선택|선택사항)\s*[:：]\s*/,'').replace(/^[·•\-–▪●.]+\s*/,'').trim().replace(/곰빼기/g,'곱빼기');
}
function splitOptions(s){
  const t=optionText(s);
  if(!t)return [];
  return t.split(/\s*,\s*|\s*\/\s*/).map(x=>x.trim()).filter(Boolean);
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
function stripQtyName(name){
  return String(name||'').replace(QTY,'').replace(QTY_GAE,'').replace(PRICE,'').replace(/[·•]/g,' ').replace(/\s{2,}/g,' ').trim()
    .replace(/^\d+[\.)]\s*/,'').replace(/^\s*[-–]\s*/,'').trim();
}

function parseOrderText(text){
  const cleaned=cleanOcrText(scrubSensitiveText(text));
  const app=detectApp(cleaned);
  const when=parseOrderTime(cleaned);
  const lines=cleaned.split(/\r?\n/).map(l=>l.replace(/[|]/g,' ').trim()).filter(Boolean);
  let store='',items=[],sawMenu=false;
  const storeHint=[];
  function pushItem(name,qty,raw,price){
    name=repairMenuName(name,store||(storeHint[storeHint.length-1]||''));
    if(!name||name.length<2)return;
    if(SKIP.test(name)||isPiiLine(name)||PAY_LINE.test(name))return;
    if(TIME_RE.test(name)||/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(name))return;
    const rec={name,qty:Math.max(1,+qty||1),options:[],raw:raw||name};
    if(price)rec.price=price; // transient for line detection only; never saved
    items.push(rec);
    if(!store&&storeHint.length){
      const cand=storeHint.reverse().find(looksLikeStore);
      storeHint.reverse();
      if(cand)store=cand;
    }
    sawMenu=true;
  }
  for(const line of lines){
    if(/^●+$/.test(line)||/^·+$/.test(line))continue;
    if(isPiiLine(line)||PAY_LINE.test(line))continue;
    if(SKIP.test(line)&&!looksLikeOption(line))continue;
    if(TIME_RE.test(line)||(/주문일시|주문시간|주문\s*시각|결제일시/.test(line)&&DATE_RE.test(line)))continue;
    if((/^(수량|갯수)\b/.test(line)||(/^[A-Za-z]{1,3}\s*[0-9]+\s*개/.test(line)&&items.length))&&!looksLikeOption(line)){
      const qm0=line.match(/([0-9]+)/);if(qm0&&items.length)items[items.length-1].qty=+(qm0[1]||1);
      continue;
    }
    if(looksLikeOption(line)){
      if(items.length)splitOptions(line).forEach(o=>items[items.length-1].options.push(o));
      continue;
    }
    const pm=line.match(PRICE);
    const qm=line.match(QTY);
    let qty=qm?+(qm[1]||qm[2]||qm[3]||1):0;
    const gae=line.match(QTY_GAE);
    let name=stripQtyName(line);
    // If "N개" is part of a known dish (치즈볼 4개), keep it in the name and qty 1
    let gaeIsName=false;
    if(gae){
      const withGae=line.replace(PRICE,'').replace(QTY,'').replace(/\s{2,}/g,' ').trim();
      const hitKeep=matchDish(withGae,80);
      const hitDrop=matchDish(name,80);
      if(hitKeep&&(!hitDrop||hitKeep.score>=hitDrop.score)&&/개/.test(hitKeep.item.name)){
        name=hitKeep.item.name;gaeIsName=true;if(!qty)qty=1;
      }else if(!qty)qty=+(gae[1]||1);
    }
    name=repairMenuName(name,store||(storeHint[storeHint.length-1]||''));
    if((pm||qty||gae)&&name&&name.length>=2&&!SKIP.test(name)&&!/원$/.test(name)&&!isPiiLine(name)){
      pushItem(name,qty||1,line,pm?parsePrice(pm[1]||pm[2]):0);
      continue;
    }
    if((qm||(gae&&!gaeIsName))&&!pm&&items.length&&name.length<4){items[items.length-1].qty=qty||+(gae&&gae[1])||items[items.length-1].qty;continue;}
    if(!pm&&name.length>=2&&name.length<=28&&!/[0-9]{3,}/.test(name)&&!isPiiLine(name)){
      const storeish=/점$/.test(name.replace(/\s+/g,''))||/매장$/.test(name);
      const hit=matchDish(name,80);
      if(hit&&!storeish&&(sawMenu||qty)){pushItem(name,1,line);continue;}
      if(hit&&!storeish&&sawMenu===false&&storeHint.length){pushItem(name,1,line);continue;}
      if(!sawMenu){if(looksLikeStore(line))storeHint.push(line);}
      else if(items.length&&name.length<=18&&!storeish)items[items.length-1].options.push(name);
    }
  }
  if(!store&&storeHint.length){
    const cand=storeHint.find(looksLikeStore);
    store=cand||'';
  }
  const merged=[];
  for(const it of items){
    const n=String(it.name||'').replace(/^[·•\-–▪●.\s]+/,'').trim();
    if(merged.length&&/^(뼈|순살)$/.test(n)&&(!it.options||!it.options.length)){
      merged[merged.length-1].options.push(n);
      continue;
    }
    it.name=String(it.name||'').replace(/[!|?~]+$/g,'').trim();
    merged.push(it);
  }
  items=merged;
  return {app,store:store||'',items,date:when.date,time:when.time};
}

function rowsFromParsed(parsed){
  return (parsed.items||[]).map(it=>{
    const q=it.name+(it.options&&it.options.length?' '+it.options.join(' '):'');
    const hit=matchDish(q)||matchDish(it.name);
    const dish=hit&&hit.item;
    const qty=it.qty||1;
    const nut=dish?applyPortion(dish,qty,1,it.options):{kcal:'',protein:'',carbs:'',fat:'',sodium:''};
    return {
      name:it.name,qty,portion:1,shareMode:'people',peopleOverride:null,eatenFrac:1,
      options:it.options||[],
      dishId:dish?dish.id:null,match:dish?dish.name:null,score:hit?hit.score:0,
      base:nut,kcal:nut.kcal,protein:nut.protein,carbs:nut.carbs,fat:nut.fat,sodium:nut.sodium,
      unit:dish?dish.unit:'',on:true
    };
  });
}
function refreshRowMacros(r,people){
  const dish=r.dishId?foods().find(f=>f.id===r.dishId):null;
  const base=dish?applyPortion(dish,r.qty||1,1,r.options):(r.base||{kcal:+r.kcal||0,protein:+r.protein||0,carbs:+r.carbs||0,fat:+r.fat||0,sodium:+r.sodium||0});
  r.base=base;
  const se=shareAndEaten(base,{people:people||1,qty:r.qty,portion:r.portion,shareMode:r.shareMode,sharePeople:r.peopleOverride,eatenFrac:eatenFracOf(r)});
  Object.assign(r,se.logged);
  r._leftover=se.leftover;
  r.myFrac=se.myFrac;
  return r;
}

function todayEaten(rawArr,date){
  rawArr=rawArr||(typeof root.raw!=='undefined'?root.raw:[]);
  date=date||(typeof today==='function'?today():'');
  return rawArr.filter(e=>e.date===date&&e.type==='meal'&&e.value).map(e=>e.value);
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

function leftoverList(){
  const s=(typeof settings!=='undefined'&&settings&&Array.isArray(settings.leftovers))?settings.leftovers:[];
  return s.map(x=>Object.assign({},x));
}
function saveLeftovers(list){
  if(typeof settings==='undefined')return;
  settings.leftovers=list;
  if(typeof saveSettings==='function')saveSettings();
}
function sanitizeLeftover(x){
  if(!x||!x.name)return null;
  return {
    id:x.id||'',name:String(x.name).slice(0,80),dishId:x.dishId||'',store:String(x.store||'').slice(0,40),
    date:x.date||'',expire:x.expire||'',updated:x.updated||'',
    kcal:+x.kcal||0,protein:+x.protein||0,carbs:+x.carbs||0,fat:+x.fat||0,sodium:+x.sodium||0
  };
}
function mergeLeftovers(a,b){
  const map=new Map();
  function key(x){return x.id||(normName(x.name)+'|'+(x.date||''));}
  (a||[]).concat(b||[]).forEach(raw=>{
    const x=sanitizeLeftover(raw);if(!x)return;
    const k=key(x);
    const prev=map.get(k);
    if(!prev){map.set(k,x);return;}
    const kcal=Math.min(+prev.kcal||0,+x.kcal||0);
    const ratio=prev.kcal?kcal/(+prev.kcal||1):(x.kcal?kcal/(+x.kcal||1):1);
    const src=(+x.kcal||0)<=(+prev.kcal||0)?x:prev;
    map.set(k,Object.assign({},(+x.updated||'')>=(+prev.updated||'')?x:prev,src,{
      kcal,protein:Math.round(((+src.protein||0)*ratio)*10)/10,carbs:Math.round(((+src.carbs||0)*ratio)*10)/10,
      fat:Math.round(((+src.fat||0)*ratio)*10)/10,sodium:Math.round((+src.sodium||0)*ratio)
    }));
  });
  return [...map.values()];
}
function activeLeftovers(date){
  date=date||(typeof today==='function'?today():'');
  return leftoverList().filter(x=>x&&x.name&&(+x.kcal||0)>=8&&(!x.expire||x.expire>=date)&&(x.date||'')<=date);
}
function rememberLeftover(row,date,people){
  refreshRowMacros(row,people);
  const lo=row._leftover||scaleNut({kcal:0,protein:0,carbs:0,fat:0,sodium:0},0);
  if((+lo.kcal||0)<8)return null;
  const rec=sanitizeLeftover({
    id:(typeof withId==='function'?withId({}).id:('lv'+Date.now().toString(36)+Math.random().toString(36).slice(2,6))),
    name:row.match||row.name,dishId:row.dishId||'',store:row.store||'',
    date,expire:addDays(date,1),updated:date,
    kcal:lo.kcal,protein:lo.protein,carbs:lo.carbs,fat:lo.fat,sodium:lo.sodium
  });
  const list=leftoverList();
  list.push(rec);
  saveLeftovers(list);
  return rec;
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
  else if(draft.mode==='eatLeft')el.innerHTML=eatLeftHTML(draft);
  else el.innerHTML=confirmHTML(draft);
  el.scrollTop=0;
}

function confirmHTML(d){
  const people=Math.max(1,+d.people||1);
  (d.rows||[]).forEach(r=>refreshRowMacros(r,people));
  const slot=d.slot||slotFromWhen(d.date,d.time);
  const slots=(typeof MEAL_SLOTS!=='undefined'?MEAL_SLOTS:['아침','아점','점심','점저','저녁','간식','야식']);
  const rows=d.rows||[];
  const tot=rows.filter(r=>r.on).reduce((s,r)=>({kcal:s.kcal+(+r.kcal||0),protein:s.protein+(+r.protein||0),sodium:s.sodium+(+r.sodium||0)}),{kcal:0,protein:0,sodium:0});
  const left=rows.filter(r=>r.on).reduce((s,r)=>{const lo=r._leftover||{};return {kcal:s.kcal+(+lo.kcal||0)};},{kcal:0});
  const note=d.ocrError?`<div class="banner warn">글자를 읽지 못했어요. 아래에서 메뉴를 직접 고르거나 적어 주세요.</div>`:
    (rows.length?`<div class="muted">찾은 메뉴 ${rows.length}개. 틀린 줄은 고치고, 나눠 먹었거나 남겼으면 아래에서 바꿔 주세요.</div>`:`<div class="banner flat">메뉴를 자동으로 찾지 못했어요. 아래에서 직접 적어 주세요.</div>`);
  const timeLine=d.orderWhen?((d.date||'')+(d.time?(' '+d.time):'')).trim():'';
  const peopleBtns=PEOPLE_CHOICES.map(n=>`<button type="button" aria-selected="${people===n&&!d.peoplePlus}" onclick="DGDelivery.setPeople(${n})">${n}</button>`).join('')
    +`<button type="button" aria-selected="${!!d.peoplePlus||people>6}" onclick="DGDelivery.setPeople(7,true)">6+</button>`;
  return `<div class="health-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">배달 주문 확인</h2><button type="button" class="btn-ghost btn-sm" onclick="DGDelivery.close()">닫기</button></div>
    ${note}
    <p class="muted">${esc(PRIVACY)}</p>
    <p class="priv-line">${esc(PRIVACY_LINE)}</p>
    <div class="card">
      ${d.app?`<div class="muted" style="margin-bottom:6px">앱: ${esc(d.app)}</div>`:''}
      <label class="field"><span class="label">가게</span><input class="input" id="dvStore" value="${esc(d.store||'')}" placeholder="가게 이름 (없으면 비워 두세요)"></label>
      ${timeLine?`<div class="muted" style="margin:6px 0 0">주문 시각 ${esc(timeLine)} · 끼니에 반영했어요</div>`:''}
      <div class="label" style="margin:10px 0 6px">끼니</div>
      <div class="segmented meal-slots" data-seg="dvslot" style="background:#F3F5FB">${slots.map(m=>`<button type="button" data-k="${m}" aria-selected="${slot===m}" onclick="DGDelivery.setSlot('${m}')">${m}</button>`).join('')}</div>
      <div class="label" style="margin:12px 0 6px">몇 명이서</div>
      <div class="segmented" data-seg="people">${peopleBtns}</div>
      ${d.peoplePlus||people>6?`<label class="field" style="margin-top:8px"><span class="label">인원</span><input class="input" type="number" min="6" step="1" value="${esc(people)}" onchange="DGDelivery.setPeople(this.value,true)"></label>`:''}
      <div class="muted" style="margin-top:6px">기본은 고른 인원으로 똑같이 나눠요. 메뉴마다 내 몫을 바꿀 수 있어요.</div>
    </div>
    ${rows.map((r,i)=>rowHTML(r,i,people)).join('')||'<div class="card muted">줄이 없어요.</div>'}
    <button type="button" class="btn-secondary btn-block" onclick="DGDelivery.addRow()">+ 메뉴 줄 추가</button>
    <div class="card"><b>내 기록</b> (켠 줄, 먹은 양까지) <span class="num">${tot.kcal}kcal · 단백질 ${Math.round(tot.protein)}g · 나트륨 ${tot.sodium}mg</span>
      ${left.kcal?`<div class="muted" style="margin-top:6px">남긴 양은 남은 음식으로 ${Math.round(left.kcal)}kcal 올려 둘게요. 이틀 정도 홈에서 이어서 먹을 수 있어요.</div>`:''}
      <div class="muted" style="margin-top:6px;font-size:11px">${esc(foodSource())}</div></div>
    <p class="muted">${esc(DISCLAIMER)}</p>
    <button type="button" class="btn-primary btn-lg" onclick="DGDelivery.save()">식사로 기록하기</button>
  </div>`;
}
function rowHTML(r,i,people){
  const on=r.on!==false;
  const mode=r.shareMode||'people';
  const eaten=eatenFracOf(r);
  const customEaten=EATEN_PRESETS.every(p=>Math.abs(p.k-eaten)>0.001);
  const lo=r._leftover||{};
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
    </div>
    <div class="label" style="margin:10px 0 6px">내 몫</div>
    <div class="segmented" data-seg="share">${[
      ['people','같이 나눔'],['portion','인분으로']
    ].map(([k,lab])=>`<button type="button" aria-selected="${mode===k}" onclick="DGDelivery.setShareMode(${i},'${k}')">${lab}</button>`).join('')}</div>
    ${mode==='portion'?`<div class="segmented" style="margin-top:8px" data-seg="por">${PORTIONS.map(p=>`<button type="button" aria-selected="${(+r.portion||1)===p}" onclick="DGDelivery.setPortion(${i},${p})">${p}</button>`).join('')}</div>`:
      `<label class="field" style="margin-top:8px"><span class="label">이 메뉴만 (명)</span><input class="input" type="number" min="1" step="1" placeholder="전체 ${people}명" value="${esc(r.peopleOverride||'')}" onchange="DGDelivery.setRowPeople(${i},this.value)"></label>`}
    <div class="label" style="margin:10px 0 6px">먹은 양</div>
    <div class="segmented eaten-seg" data-seg="eaten">${EATEN_PRESETS.map(p=>`<button type="button" aria-selected="${!customEaten&&Math.abs(eaten-p.k)<0.001}" onclick="DGDelivery.setEaten(${i},${p.k})">${p.label}</button>`).join('')}<button type="button" aria-selected="${customEaten}" onclick="DGDelivery.setEaten(${i},'custom')">직접(%)</button></div>
    ${customEaten?`<label class="field" style="margin-top:8px"><span class="label">먹은 비율 %</span><input class="input" type="number" min="0" max="100" step="1" value="${esc(Math.round(eaten*100))}" onchange="DGDelivery.setEaten(${i},(+this.value||0)/100)"></label>`:''}
    ${(+lo.kcal||0)>=8?`<div class="muted" style="margin-top:6px">남김 ${(lo.kcal)}kcal · 단백질 ${Math.round(lo.protein)}g 을 남은 음식으로 둘게요</div>`:''}
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
function setPeople(n,plus){touch(d=>{d.people=Math.max(1,+n||1);d.peoplePlus=!!plus||d.people>6;d.rows.forEach(r=>refreshRowMacros(r,d.people));});}
function toggleRow(i,on){touch(d=>{if(d.rows[i])d.rows[i].on=on;});}
function removeRow(i){touch(d=>d.rows.splice(i,1));}
function addRow(){touch(d=>{d.rows.push({name:'',qty:1,portion:1,shareMode:'people',peopleOverride:null,eatenFrac:1,options:[],dishId:null,match:null,kcal:'',protein:'',carbs:'',fat:'',sodium:'',on:true});});}
function rename(i,name){touch(d=>{const r=d.rows[i];if(!r)return;r.name=name;const hit=matchDish(name);if(hit){r.dishId=hit.item.id;r.match=hit.item.name;r.score=hit.score;r.unit=hit.item.unit;}else{r.dishId=null;r.match=null;}refreshRowMacros(r,d.people);});}
function setQty(i,v){touch(d=>{const r=d.rows[i];if(!r)return;r.qty=Math.max(1,+v||1);refreshRowMacros(r,d.people);});}
function setPortion(i,p){touch(d=>{const r=d.rows[i];if(!r)return;r.portion=p;r.shareMode='portion';refreshRowMacros(r,d.people);});}
function setShareMode(i,mode){touch(d=>{const r=d.rows[i];if(!r)return;r.shareMode=mode;refreshRowMacros(r,d.people);});}
function setRowPeople(i,v){touch(d=>{const r=d.rows[i];if(!r)return;r.peopleOverride=v===''||v==null?null:Math.max(1,+v||1);r.shareMode='people';refreshRowMacros(r,d.people);});}
function setEaten(i,v){touch(d=>{const r=d.rows[i];if(!r)return;if(v==='custom'){r.eatenFrac=r.eatenFrac==null||r.eatenFrac===1?0.5:r.eatenFrac;}else r.eatenFrac=Math.max(0,Math.min(1,+v));refreshRowMacros(r,d.people);});}
function setMacro(i,k,v){touch(d=>{const r=d.rows[i];if(!r)return;r[k]=v===''?'':+v;});}
function recalc(r){refreshRowMacros(r,draft&&draft.people||1);}

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
  text=scrubSensitiveText(text||'');
  const parsed=parseOrderText(text||'');
  const rows=rowsFromParsed(parsed);
  const readDate=parsed.date||'';
  const readTime=parsed.time||'';
  const date=readDate||(typeof logDate!=='undefined'&&logDate)||(typeof today==='function'?today():'');
  const slot=slotFromWhen(readDate||date,readTime);
  file=null;text='';
  openPane({mode:'confirm',app:parsed.app,store:parsed.store,rows,slot,date,time:readTime,orderWhen:!!(readDate||readTime),people:1,peoplePlus:false,ocrError,rawText:null});
}

function commitMeals(){
  if(!draft||draft.mode==='eatLeft')return;
  const store=($('#dvStore')&&$('#dvStore').value)||draft.store||'';
  const slot=draft.slot||slotFromWhen(draft.date,draft.time)||'저녁';
  const date=draft.date||(typeof today==='function'?today():'');
  const people=Math.max(1,+draft.people||1);
  const rows=(draft.rows||[]).filter(r=>r.on!==false&&String(r.name||'').trim());
  if(!rows.length){if(typeof toast==='function')toast('기록할 메뉴를 한 줄 이상 남겨 주세요');return;}
  const evs=rows.map(r=>{
    refreshRowMacros(r,people);
    const name=String(r.name).trim();
    rememberFav(Object.assign({store},r,{name}),date);
    rememberLeftover(Object.assign({store},r),date,people);
    return {
      date,type:'meal',item:slot,value:r.match||name,
      kcal:r.kcal===''||r.kcal==null?'':String(r.kcal),
      protein_g:r.protein===''||r.protein==null?'':String(r.protein),
      carbs_g:r.carbs===''||r.carbs==null?'':String(r.carbs),
      fat_g:r.fat===''||r.fat==null?'':String(r.fat),
      sodium_mg:r.sodium===''||r.sodium==null?'':String(r.sodium),
      kcal_source:r.dishId?'배달메뉴표(대략)':(r.kcal?'직접입력':''),
      store,portion:r.portion,qty:r.qty,dish_id:r.dishId||'',people,
      eaten:eatenFracOf(r),
      note:[(r.options||[]).join(', '),store?('가게='+store):'',people>1?('나눔='+people+'명'):'',eatenFracOf(r)<1?('먹은양='+Math.round(eatenFracOf(r)*100)+'%'):''].filter(Boolean).join('; ')
    };
  });
  root._dgLastMealLog=evs[evs.length-1];
  if(typeof withId==='function'&&typeof raw!=='undefined'){
    evs.forEach(e=>raw.push(withId(e)));
    if(typeof root.save==='function')root.save();
  }
  const n=evs.length,k=evs.reduce((s,e)=>s+(+e.kcal||0),0),p=evs.reduce((s,e)=>s+(+e.protein_g||0),0);
  const leftN=activeLeftovers(date).length;
  draft=null;const el=$('#delivPane');if(el)el.remove();
  if(typeof toast==='function')toast(`${slot}에 배달 ${n}개 기록 · ${k}kcal · 단백질 ${Math.round(p)}g`+(leftN?` · 남은 음식 있음`:''));
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

function leftoversHTML(C){
  const date=(C&&C.today)||(typeof today==='function'?today():'');
  const list=activeLeftovers(date);
  if(!list.length)return '';
  return `<div class="leftover-block"><div class="label" style="font-size:13px;font-weight:700;margin:8px 0 6px">남은 음식 <span class="muted" style="font-weight:600">이틀 정도 보여요. 이어서 먹어도 돼요</span></div>
    ${list.map(x=>`<div class="card lo-card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${esc(x.name)}</b>${x.store?` <span class="muted">${esc(x.store)}</span>`:''}<div class="muted">남은 ${Math.round(x.kcal)}kcal · 단백질 ${Math.round(x.protein)}g</div></div></div>
      <div class="rowx" style="margin-top:8px;gap:8px">
        <button type="button" class="btn-primary btn-sm" onclick="DGDelivery.openEatLeft('${escJs(x.id)}')">이어서 먹음</button>
        <button type="button" class="btn-ghost btn-sm" onclick="DGDelivery.discardLeftover('${escJs(x.id)}')">버림</button>
      </div></div>`).join('')}
  </div>`;
}
function eatLeftHTML(d){
  const x=d.item||{};
  const slots=(typeof MEAL_SLOTS!=='undefined'?MEAL_SLOTS:['아침','아점','점심','점저','저녁','간식','야식']);
  const slot=d.slot||(typeof suggestMealSlot==='function'?suggestMealSlot(d.date):'저녁');
  const frac=d.frac==null?1:d.frac;
  const custom=EATEN_PRESETS.every(p=>Math.abs(p.k-frac)>0.001);
  return `<div class="health-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">이어서 먹음</h2><button type="button" class="btn-ghost btn-sm" onclick="DGDelivery.close()">닫기</button></div>
    <div class="card"><b>${esc(x.name)}</b><div class="muted">남은 ${Math.round(x.kcal)}kcal · 단백질 ${Math.round(x.protein)}g</div></div>
    <div class="label" style="margin:10px 0 6px">이번에 먹을 양</div>
    <div class="segmented eaten-seg">${EATEN_PRESETS.map(p=>`<button type="button" aria-selected="${!custom&&Math.abs(frac-p.k)<0.001}" onclick="DGDelivery.setEatLeftFrac(${p.k})">${p.label}</button>`).join('')}<button type="button" aria-selected="${custom}" onclick="DGDelivery.setEatLeftFrac('custom')">직접(%)</button></div>
    ${custom?`<label class="field" style="margin-top:8px"><span class="label">먹을 비율 %</span><input class="input" type="number" min="0" max="100" value="${esc(Math.round(frac*100))}" onchange="DGDelivery.setEatLeftFrac((+this.value||0)/100)"></label>`:''}
    <div class="label" style="margin:12px 0 6px">끼니</div>
    <div class="segmented meal-slots" style="background:#F3F5FB">${slots.map(m=>`<button type="button" aria-selected="${slot===m}" onclick="DGDelivery.setSlot('${m}')">${m}</button>`).join('')}</div>
    <p class="muted" style="margin-top:10px">남은 음식은 오늘 같은 메뉴를 이미 먹었어도 이어서 기록할 수 있어요.</p>
    <button type="button" class="btn-primary btn-lg" style="margin-top:12px" onclick="DGDelivery.commitEatLeft()">기록하기</button>
  </div>`;
}
function openEatLeft(id){
  const date=(typeof logDate!=='undefined'&&logDate)||(typeof today==='function'?today():'');
  const item=leftoverList().find(x=>x.id===id);
  if(!item){if(typeof toast==='function')toast('남은 음식을 찾지 못했어요');return;}
  openPane({mode:'eatLeft',item,frac:1,date,slot:typeof suggestMealSlot==='function'?suggestMealSlot(date):'저녁'});
}
function setEatLeftFrac(v){touch(d=>{if(v==='custom')d.frac=d.frac==null||d.frac===1?0.5:d.frac;else d.frac=Math.max(0,Math.min(1,+v));});}
function commitEatLeft(){
  if(!draft||draft.mode!=='eatLeft'||!draft.item)return;
  const date=draft.date||(typeof today==='function'?today():'');
  const slot=draft.slot||(typeof suggestMealSlot==='function'?suggestMealSlot(date):'저녁');
  const frac=Math.max(0,Math.min(1,draft.frac==null?1:+draft.frac));
  const item=draft.item;
  const eaten=scaleNut(item,frac);
  const remain=scaleNut(item,1-frac);
  const ev={
    date,type:'meal',item:slot,value:item.name,
    kcal:String(eaten.kcal),protein_g:String(eaten.protein),carbs_g:String(eaten.carbs),fat_g:String(eaten.fat),sodium_mg:String(eaten.sodium),
    kcal_source:item.dishId?'배달메뉴표(대략)':'남은음식',dish_id:item.dishId||'',store:item.store||'',leftover:'1',
    note:['남은 음식 이어서',item.store?('가게='+item.store):''].filter(Boolean).join('; ')
  };
  // leftovers are allowed even if the same menu was already eaten today
  root._dgLastMealLog=ev;
  if(typeof withId==='function'){raw.push(withId(ev));if(typeof root.save==='function')root.save();}
  const list=leftoverList();
  const i=list.findIndex(x=>x.id===item.id);
  if(i>=0){
    if((+remain.kcal||0)<8)list.splice(i,1);
    else Object.assign(list[i],remain,{updated:date});
    saveLeftovers(list);
  }
  draft=null;const el=$('#delivPane');if(el)el.remove();
  if(typeof toast==='function')toast(`${item.name} 이어서 ${Math.round(eaten.kcal)}kcal를 ${slot}으로 기록했어요`);
  if(typeof render==='function')render();
}
function discardLeftover(id){
  saveLeftovers(leftoverList().filter(x=>x.id!==id));
  if(typeof toast==='function')toast('남은 음식을 버렸어요');
  if(typeof render==='function')render();
}

function chipsHTML(C){
  const date=(C&&C.today)||(typeof today==='function'?today():'');
  const t=(C&&C.days&&C.days[date])||{};
  const names=todayEaten(typeof raw!=='undefined'?raw:[],date);
  const ranked=rankFavorites(favList(),{todayNames:names,kcal:t.kcal,prot:t.prot});
  const left=leftoversHTML(C);
  let fav='';
  if(!ranked.length&&!favList().length)fav=`<div class="muted" style="font-size:12px;margin-top:8px">배달 사진을 한 번 기록하면 단골 메뉴가 생겨요. 같은 메뉴는 하루에 한 번만 추천해요.</div>`;
  else if(!ranked.length)fav=`<div class="muted" style="font-size:12px;margin-top:8px">오늘 이미 먹은 단골은 빼 두었어요. 남은 음식은 위에서 이어서 먹을 수 있어요.</div>`;
  else{
    const show=ranked.slice(0,6);
    fav=`<div class="fav-block"><div class="label" style="font-size:13px;font-weight:700;margin:8px 0 6px">단골 메뉴 <span class="muted" style="font-weight:600">오늘 먹은 건 빼요</span></div>
    <div class="look-picks fav-chips">${show.map(f=>`<button type="button" class="chip" onclick="DGDelivery.logFavorite('${escJs(f.name)}')">${esc(f.name)}${f.kcal?` · ${Math.round(f.kcal)}kcal`:''}</button>`).join('')}</div></div>`;
  }
  return left+fav;
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
  DISCLAIMER,PRIVACY,PRIVACY_LINE,PORTIONS,normName,levenshtein,scoreMatch,matchDish,
  applyPortion,optionMultiplier,optionAdds,cleanOcrText,repairMenuName,parseOrderText,rowsFromParsed,parsePrice,
  detectApp,parseOrderTime,slotFromWhen,scrubSensitiveText,isPiiLine,shareAndEaten,myShareFrac,addDays,scaleNut,
  todayEaten,eatenTodaySet,sameMenu,rankFavorites,mergeFavs,favList,rememberFav,
  leftoverList,saveLeftovers,mergeLeftovers,activeLeftovers,rememberLeftover,sanitizeLeftover,
  pick,importFile,openPane,close:closePane,closePane,setSlot,setPeople,toggleRow,removeRow,addRow,
  rename,setQty,setPortion,setShareMode,setRowPeople,setEaten,setMacro,save:commitMeals,commitMeals,logFavorite,chipsHTML,leftoversHTML,
  openEatLeft,setEatLeftFrac,commitEatLeft,discardLeftover,consumeShare,bootShare
};
root.DGDelivery=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
