// 다이어트 게임 0.4.15 — 오늘 예상 체중, 저녁 추천, 코치 한마디 (규칙 기반, 추정치)
(function(root){
const KCAL_PER_KG=7700;
const ACT_OPTS=[[1.2,'거의 앉아서'],[1.375,'조금 활동'],[1.55,'보통'],[1.725,'활동적'],[1.9,'매우 활동적']];
const BUDGET=1800, PROT_GOAL=130;

function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function ageFromBirth(birth,d){
  if(!birth||!/^\d{4}-\d{2}-\d{2}$/.test(birth))return null;
  d=d||(typeof today==='function'?today():'2026-11-11');
  let a=+d.slice(0,4)-+birth.slice(0,4);
  if(d.slice(5)<birth.slice(5))a--;
  return a;
}
// Mifflin-St Jeor: 남성 10w+6.25h−5age+5, 여성 10w+6.25h−5age−161 (Mifflin et al., 1990, Am J Clin Nutr)
function mifflinBmr(w,hCm,age,sex){
  if(!(w>0)||!(hCm>0)||!(age>=10))return null;
  const s=(sex==='f'||sex==='female'||sex==='여'||sex==='여성')?-161:5;
  return 10*w+6.25*hCm-5*age+s;
}
function tdeeProfile(opt){
  opt=opt||{};
  const st=opt.settings||(typeof settings!=='undefined'?settings:{});
  const fb=opt.fallback!==false;
  const height=+st.heightCm||(fb&&typeof HEIGHT==='number'?HEIGHT:0);
  const birth=st.birth||(fb&&typeof BIRTH==='string'?BIRTH:'');
  const age=st.age>0?+st.age:ageFromBirth(birth,opt.date);
  const sex=st.sex||(fb?'m':'');
  const activity=+st.activity||(fb&&typeof ACT==='number'?ACT:0);
  const ok=height>0&&age>=10&&!!sex&&activity>0;
  return {height,birth,age,sex,activity,ok};
}
function forecastWeight(opt){
  opt=opt||{};
  const prof=tdeeProfile(opt);
  if(!prof.ok)return {ok:false,needProfile:true};
  const w=+opt.weight; if(!(w>0))return {ok:false,needWeight:true};
  const bmr=mifflinBmr(w,prof.height,prof.age,prof.sex);
  const tdee=bmr*prof.activity;
  const eat=Math.max(0,+opt.eatenKcal||0);
  const burnEx=Math.max(0,+opt.exerciseKcal||0);
  const net=eat-tdee-burnEx;
  const day=net/KCAL_PER_KG;
  const month=day*30;
  const tomorrow=w+day;
  const in30=w+month;
  return {ok:true,needProfile:false,bmr,tdee,eat,burnEx,net,day,month,tomorrow,in30,weight:w,profile:prof,estimate:true};
}
function fmtKgDelta(x){
  if(!isFinite(x))return '—';
  const a=Math.abs(x), n=a<0.01?x.toFixed(3):a<1?x.toFixed(2):x.toFixed(1);
  return (x>=0?'+':'')+n+'kg';
}
function walkExtraKg(w,min){
  const met=(typeof MET_WALK==='number')?MET_WALK:3.5;
  const fn=(typeof exKcal==='function')?exKcal:(m,n,ww)=>(m-1)*ww*n/60;
  if(!(w>0)||!(min>0))return 0;
  return -fn(met,min,w)/KCAL_PER_KG;
}
function dayExKcal(info,w){
  const metW=(typeof MET_WALK==='number')?MET_WALK:3.5;
  const metS=(typeof MET_STR==='number')?MET_STR:3.5;
  const fn=(typeof exKcal==='function')?exKcal:(m,n,ww)=>(m-1)*ww*n/60;
  return fn(metW,info.walk||0,w)+fn(metS,info.strMin||0,w);
}
function addDays(d,n){
  if(typeof ds==='function'&&typeof dn==='function')return ds(dn(d)+n);
  const t=new Date(d+'T12:00:00+09:00');
  t.setTime(t.getTime()+n*86400000);
  const y=t.getFullYear(),m=String(t.getMonth()+1).padStart(2,'0'),da=String(t.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+da;
}
function dayLogged(info){
  if(!info)return false;
  return !!(info.mealCount>0||info.closed||(+info.kcal>0)||(+info.walk>0)||(+info.strMin>0)||info.strength);
}
// 기록된 섭취·운동만 모아 일별 누적 예상. 끼니/운동이 없는 날은 값을 유지(섭취 0으로 가정하지 않음).
// bodyKg: 마지막 실측 체중 이후의 일별 이론 감량을 더해 캐릭터·오늘 추정에 씀.
function forecastTrail(opt){
  opt=opt||{};
  const C=opt.C||{};
  const days=opt.days||C.days||{};
  const today=opt.today||C.today;
  const startDate=opt.startDate||(typeof START_DATE==='string'?START_DATE:today);
  let startW=+opt.startW;
  if(!(startW>0))startW=(typeof START_W==='number'?START_W:0);
  const prof=tdeeProfile(opt);
  if(!today||!(startW>0))return {ok:false,needWeight:!(startW>0)};
  if(!prof.ok)return {ok:false,needProfile:true};
  const pts=[];
  let run=startW, body=startW, lastActual=null, lastActualDate=null;
  let guard=0, d=startDate;
  while(d<=today&&guard++<800){
    const info=days[d]||{};
    const actual=(info.weight!=null&&+info.weight>0)?+info.weight:null;
    const logged=dayLogged(info);
    let day=0,tdee=0,burn=0,eat=0,bmr=0;
    if(logged){
      const age=prof.age=ageFromBirth(prof.birth,d)||prof.age;
      bmr=mifflinBmr(run,prof.height,age,prof.sex);
      tdee=bmr*prof.activity;
      eat=Math.max(0,+info.kcal||0);
      burn=dayExKcal(info,run);
      day=(eat-tdee-burn)/KCAL_PER_KG;
      run=run+day;
    }
    if(actual!=null){lastActual=actual;lastActualDate=d;body=logged?actual+day:actual;}
    else if(logged)body=body+day;
    pts.push({date:d,pred:run,actual,body,day,logged,tdee,eat,burn});
    if(d===today)break;
    d=addDays(d,1);
  }
  const cur=pts[pts.length-1]||{};
  return {ok:true,estimate:true,pts,bodyKg:cur.body,predKg:cur.pred,lastActual,lastActualDate,profile:prof};
}
function forecastChartSVG(trail){
  const pts=(trail&&trail.pts)||[];
  if(pts.length<2)return '';
  const pred=pts.map((p,i)=>[i,p.pred]);
  const act=pts.map((p,i)=>[i,p.actual]).filter(p=>p[1]!=null);
  const ys=pred.map(p=>p[1]).concat(act.map(p=>p[1]));
  let lo=Math.min(...ys)-0.4, hi=Math.max(...ys)+0.4;
  if(!(hi>lo)){lo-=0.5;hi+=0.5;}
  const W=348,H=150,l=18,r=12,t=12,b=22,iw=W-l-r,ih=H-t-b;
  const X=i=>l+(i/(pts.length-1))*iw, Y=y=>t+(hi-y)/(hi-lo)*ih;
  const line=pred.map((p,i)=>X(i)+','+Y(p[1])).join(' ');
  const ticks=[];
  const step=pts.length>20?7:Math.max(1,Math.floor((pts.length-1)/3));
  for(let i=0;i<pts.length;i+=step){
    const lab=(pts[i].date||'').slice(5).replace('-','/');
    ticks.push(`<text x="${X(i)}" y="${H-6}" font-size="10" text-anchor="middle" fill="#8A8A8A" font-family="Lexend,sans-serif">${lab}</text>`);
  }
  return `<svg class="forecast-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="누적 예상 체중과 실제 체중 그래프">
    <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#1A1A1A"/>
    <polyline fill="none" stroke="#3DFF7A" stroke-width="2.5" points="${line}"/>
    ${act.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" fill="#FFD84D" stroke="#121212" stroke-width="1"/>`).join('')}
    ${ticks.join('')}
  </svg>
  <div class="forecast-legend"><span><b style="color:#3DFF7A">━</b> 누적 예상</span><span><b style="color:#FFD84D">●</b> 실제 체중</span></div>`;
}
function forecastHTML(C){
  const t=(C&&C.days&&C.days[C.today])||{};
  const w=C&&C.weight;
  const metW=(typeof MET_WALK==='number')?MET_WALK:3.5;
  const metS=(typeof MET_STR==='number')?MET_STR:3.5;
  const burn=(typeof exKcal==='function')?(exKcal(metW,t.walk||0,w)+exKcal(metS,t.strMin||0,w)):0;
  const f=forecastWeight({weight:w,eatenKcal:t.kcal||0,exerciseKcal:burn,date:C&&C.today});
  if(!f.ok&&f.needProfile){
    return `<div class="card guide-card" id="forecastCard"><h3 style="margin:0 0 8px">오늘의 예상</h3>
      <div class="muted">예상 체중을 보려면 내정보에 키·나이·성별·활동량을 적어 주세요.</div>
      <button type="button" class="btn-primary btn-sm" style="margin-top:10px" onclick="tab='me';render()">내정보에서 입력</button></div>`;
  }
  if(!f.ok)return '';
  const plus10=walkExtraKg(w,10), plus20=walkExtraKg(w,20);
  const trail=forecastTrail({C,days:C.days,today:C.today,weight:w});
  const eaten=t.kcal||0;
  return `<div class="card guide-card" id="forecastCard">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0">오늘의 예상</h3><span class="muted" style="font-size:11px">추정치</span></div>
    <div style="font-size:15px;line-height:22px;color:var(--ink-900)">오늘 <b class="num-i" style="font-size:26px;color:var(--mint-400)">${fmtKgDelta(f.day)}</b></div>
    <div class="forecast-extras">걷기 +10분이면 오늘 <b class="num">${fmtKgDelta(f.day+plus10)}</b><span class="muted"> (${fmtKgDelta(plus10)})</span>
      · +20분이면 오늘 <b class="num">${fmtKgDelta(f.day+plus20)}</b><span class="muted"> (${fmtKgDelta(plus20)})</span></div>
    ${trail.ok?forecastChartSVG(trail):''}
    <div class="muted" style="margin-top:8px;font-size:12px;line-height:18px">오늘 섭취 ${Math.round(eaten).toLocaleString('ko-KR')}kcal − TDEE ${Math.round(f.tdee).toLocaleString('ko-KR')}kcal${f.burnEx>=1?` − 운동 ${Math.round(f.burnEx)}kcal`:''}. 끼니나 운동을 기록한 날만 누적해요. Mifflin-St Jeor × 활동량, 7,700kcal≈1kg. 실제 체중은 수분·오차로 달라질 수 있어요.</div>
  </div>`;
}

function placeBucket(dish){
  if(dish.brand)return 'delivery';
  const c=dish.cat||'';
  if(/한식|과일|샐러드|분식|죽|유제품|곡류|채소|견과|어육류|달걀|해조/.test(c))return 'home';
  if(/치킨|피자|중식|버거|족발|밥버거|배달/.test(c))return 'delivery';
  return 'out';
}
function unitHeavy(dish){
  const u=dish.unit||'';
  return u==='한마리'||u==='1판'||/^1판/.test(u)||u==='1팩(L)';
}
function recScore(dish,opt){
  const k=+dish.kcal||0, p=+dish.protein||0;
  if(!(k>0))return -1e9;
  const remainK=opt.remainK, remainP=opt.remainP, place=opt.place||'';
  const cap=remainK>0?remainK:BUDGET;
  let s=0;
  if(k>cap*1.15)s-=(k-cap)*0.08;
  else if(k>=cap*0.45&&k<=cap*1.05)s+=40;
  else if(k<=cap)s+=20;
  if(remainP>20)s+=Math.min(40,p*(remainP>40?0.5:0.3));
  else if(p>=15)s+=8;
  if(unitHeavy(dish)&&cap<900)s-=50;
  if(place==='home'&&placeBucket(dish)==='home')s+=16;
  else if(place==='delivery'&&placeBucket(dish)==='delivery')s+=16;
  else if(place==='out'&&placeBucket(dish)!=='home')s+=10;
  else if(place&&placeBucket(dish)!==place)s-=8;
  const u=dish.unit||'';
  if(u==='1인분'||u==='1개'||u==='1회'||/^1회/.test(u))s+=6;
  if(opt.evening&&/야식|세트/.test(dish.name||''))s-=4;
  return s;
}
function recommendDinner(opt){
  opt=opt||{};
  const list=(opt.foods||((root.DGFoods&&DGFoods.FOODS)||[])).slice();
  const eatenK=+opt.eatenKcal||0, eatenP=+opt.eatenProt||0;
  const remainK=Math.max(0,(opt.budget||BUDGET)-eatenK);
  const remainP=Math.max(0,(opt.protGoal||PROT_GOAL)-eatenP);
  const ctx={remainK,remainP,place:opt.place||'',evening:opt.evening!==false};
  const scored=list.map(d=>{
    const fn=root.DGFoods&&DGFoods.nutritionForPlace;
    const dish=fn?fn(d,ctx.place):d;
    return {dish,score:recScore(dish,ctx)};
  }).filter(x=>x.score>-1e8&&(+x.dish.kcal||0)>0);
  scored.sort((a,b)=>b.score-a.score);
  const out=[], seen=new Set();
  for(const x of scored){
    const key=(x.dish.name||'').replace(/\s+/g,'').slice(0,8);
    if(seen.has(x.dish.id)||seen.has(key))continue;
    seen.add(x.dish.id);seen.add(key);
    out.push(x.dish);
    if(out.length>=(opt.limit||3))break;
  }
  return {items:out,remainK,remainP};
}
function dinnerHTML(C){
  const t=(C&&C.days&&C.days[C.today])||{};
  const place=(typeof mealPlace!=='undefined'?mealPlace:'')||'';
  const rec=recommendDinner({eatenKcal:t.kcal||0,eatenProt:t.prot||0,place});
  const items=rec.items||[];
  if(!items.length)return '';
  const rows=items.map(f=>{
    const id=String(f.id||'').replace(/'/g,"\\'");
    const sub=[f.brand,f.cat,f.unit].filter(Boolean).join(' · ');
    const kcal=Math.round(+f.kcal||0).toLocaleString('ko-KR');
    const prot=f.protein!=null?` · 단백질 ${Math.round(f.protein)}g`:'';
    return `<button type="button" class="meal-search-item rec-item" onclick="DGGuide.addDinner('${id}')">
      <span class="nm"><b>${esc(f.name)}</b><span>${esc(sub)}${prot}</span></span>
      <span class="kcal"><span class="num">${kcal}</span>kcal</span></button>`;
  }).join('');
  return `<div class="card guide-card" id="dinnerCard">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0">저녁 추천</h3><span class="muted" style="font-size:11px">남은 ${Math.round(rec.remainK)}kcal · 단백질 ${Math.round(rec.remainP)}g</span></div>
    <div class="muted" style="font-size:12px;margin-bottom:6px">오늘 기록과 ${place?esc((typeof placeMeta==='function'&&(placeMeta(place)||[])[2])||'선택'):'식사 방식'}을 반영했어요. 누르면 저녁 바구니에 담겨요.</div>
    <div class="rec-list">${rows}</div>
  </div>`;
}
function addDinner(id){
  const foods=(root.DGFoods&&DGFoods.FOODS)||[];
  const rawDish=foods.find(f=>String(f.id)===String(id));
  if(!rawDish)return typeof toast==='function'&&toast('메뉴를 찾지 못했어요');
  const fn=root.DGFoods&&DGFoods.nutritionForPlace;
  const place=(typeof mealPlace!=='undefined'?mealPlace:'')||'';
  const f=fn?fn(rawDish,place):rawDish;
  if(typeof mealKind!=='undefined')mealKind='저녁';
  if(typeof logKind!=='undefined')logKind='meal';
  if(typeof tab!=='undefined')tab='log';
  const ev={date:typeof today==='function'?today():'',type:'meal',item:'저녁',value:f.name,kcal:f.kcal!=null?String(Math.round(+f.kcal)): '',protein_g:f.protein!=null?String(f.protein):'',kcal_source:f.id?'음식표(대략)':'',dish_id:f.id||'',note:place?('방식='+(((typeof placeMeta==='function'?placeMeta(place):null)||[])[2]||place)):''};
  if(place)ev.place=place;
  if(f.carbs!=null&&f.carbs!=='')ev.carbs_g=String(f.carbs);
  if(f.fat!=null&&f.fat!=='')ev.fat_g=String(f.fat);
  if(typeof add==='function')add(ev);
}


function eatenMealKeys(opt){
  opt=opt||{};
  const day=opt.day||opt.today||'';
  const evs=opt.events||(typeof raw!=='undefined'?raw:[]);
  const keys=new Set();
  evs.forEach(e=>{
    if(!e||e.type!=='meal')return;
    if(day&&e.date!==day)return;
    if(e.dish_id)keys.add('id:'+String(e.dish_id));
    const n=String(e.value||'').replace(/\s+/g,'').slice(0,10);
    if(n)keys.add('n:'+n);
  });
  (opt.extra||[]).forEach(x=>{if(x)keys.add(String(x));});
  return keys;
}
function dishExcluded(dish,keys){
  if(!dish)return true;
  if(keys.has('id:'+String(dish.id)))return true;
  const n=String(dish.name||'').replace(/\s+/g,'').slice(0,10);
  return !!(n&&keys.has('n:'+n));
}
function slotScore(dish,slot,ctx){
  let s=recScore(dish,ctx);
  const c=dish.cat||'',k=+dish.kcal||0;
  if(slot==='아침'){
    if(/유제품|달걀|곡류/.test(c))s+=18;
    if(k>0&&k<=280)s+=10;
    if(k>450)s-=16;
  }else if(slot==='점심'){
    if(/곡류|어육류|한식/.test(c))s+=12;
    if(k>=180&&k<=600)s+=8;
  }else if(slot==='저녁'){
    if(/어육류|채소|해조/.test(c))s+=8;
  }
  return s;
}
function recommendNextDay(opt){
  opt=opt||{};
  const slots=['아침','점심','저녁'];
  const day=opt.today||'';
  const keys=eatenMealKeys({day,events:opt.events,extra:opt.exclude});
  const list=(opt.foods||((root.DGFoods&&DGFoods.FOODS)||[])).slice();
  const fn=root.DGFoods&&DGFoods.nutritionForPlace;
  const place=opt.place||'home';
  const budget=opt.budget||BUDGET, protGoal=opt.protGoal||PROT_GOAL;
  const share={아침:0.30,점심:0.35,저녁:0.35};
  const items={}, lists={};
  slots.forEach(slot=>{
    const ctx={remainK:budget*share[slot],remainP:protGoal*share[slot],place,evening:slot==='저녁'};
    const scored=list.map(d=>{
      const dish=fn?fn(d,place):d;
      if(dishExcluded(dish,keys)||!(+dish.kcal>0))return null;
      return {dish,score:slotScore(dish,slot,ctx)};
    }).filter(Boolean);
    scored.sort((a,b)=>b.score-a.score);
    const uniq=[], seen=new Set();
    for(const x of scored){
      const k=(x.dish.name||'').replace(/\s+/g,'').slice(0,8);
      if(seen.has(x.dish.id)||seen.has(k))continue;
      seen.add(x.dish.id);seen.add(k);
      uniq.push(x.dish);
      if(uniq.length>=12)break;
    }
    lists[slot]=uniq;
    const pick=uniq[0]||null;
    items[slot]=pick;
    if(pick){
      keys.add('id:'+String(pick.id));
      const n=String(pick.name||'').replace(/\s+/g,'').slice(0,10);
      if(n)keys.add('n:'+n);
    }
  });
  return {items,lists,date:opt.date||(day?addDays(day,1):'')};
}
function nextPlanDate(C){
  const t=(C&&C.today)||(typeof today==='function'?today():'');
  return t?addDays(t,1):'';
}
function loadNextPlan(C,opt){
  opt=opt||{};
  const date=nextPlanDate(C);
  const evs=opt.events||(typeof raw!=='undefined'?raw:[]);
  const place=(typeof mealPlace!=='undefined'?mealPlace:'')||opt.place||'home';
  let plan=(typeof settings!=='undefined'&&settings.nextPlan)||null;
  if(!plan||plan.date!==date||!plan.ids){
    const rec=recommendNextDay({today:C&&C.today,events:evs,place,foods:opt.foods});
    plan={date,ids:{아침:rec.items.아침&&rec.items.아침.id,점심:rec.items.점심&&rec.items.점심.id,저녁:rec.items.저녁&&rec.items.저녁.id}};
    if(typeof settings!=='undefined'){settings.nextPlan=plan;if(typeof saveSettings==='function')saveSettings();}
  }
  return plan;
}
function dishById(id){
  const foods=(root.DGFoods&&DGFoods.FOODS)||[];
  return foods.find(f=>String(f.id)===String(id))||null;
}
function swapNextMeal(slot,C){
  C=C||((typeof compute==='function')?compute():{});
  const evs=(typeof raw!=='undefined'?raw:[]);
  const plan=loadNextPlan(C,{events:evs});
  const rec=recommendNextDay({today:C.today,events:evs,place:(typeof mealPlace!=='undefined'?mealPlace:'')||'home',
    exclude:['id:'+plan.ids.아침,'id:'+plan.ids.점심,'id:'+plan.ids.저녁].filter(Boolean)});
  const list=(rec.lists[slot]||[]).filter(d=>d&&String(d.id)!==String(plan.ids[slot]));
  const pick=list[0]||(rec.lists[slot]||[])[0];
  if(!pick){if(typeof toast==='function')toast('바꿀 메뉴가 더 없어요');return;}
  plan.ids[slot]=pick.id;
  if(typeof settings!=='undefined'){settings.nextPlan=plan;if(typeof saveSettings==='function')saveSettings();}
  if(typeof render==='function')render();
}
function addNextMeal(slot,C){
  C=C||((typeof compute==='function')?compute():{});
  const plan=loadNextPlan(C);
  const rawDish=dishById(plan.ids[slot]);
  if(!rawDish)return typeof toast==='function'&&toast('메뉴를 찾지 못했어요');
  const fn=root.DGFoods&&DGFoods.nutritionForPlace;
  const place=(typeof mealPlace!=='undefined'?mealPlace:'')||'home';
  const f=fn?fn(rawDish,place):rawDish;
  const ev={date:plan.date,type:'meal',item:slot,value:f.name,kcal:f.kcal!=null?String(Math.round(+f.kcal)):'',protein_g:f.protein!=null?String(f.protein):'',kcal_source:f.id?'음식표(대략)':'',dish_id:f.id||'',note:'내일 식단'};
  if(place)ev.place=place;
  if(f.carbs!=null&&f.carbs!=='')ev.carbs_g=String(f.carbs);
  if(f.fat!=null&&f.fat!=='')ev.fat_g=String(f.fat);
  if(typeof add==='function')add(ev);
}
function nextDayHTML(C){
  const evs=(typeof raw!=='undefined'?raw:[]);
  const plan=loadNextPlan(C,{events:evs});
  if(!plan||!plan.date)return '';
  const recorded=new Set(evs.filter(e=>e&&e.type==='meal'&&e.date===plan.date).map(e=>e.item));
  const rows=['아침','점심','저녁'].map(slot=>{
    const f=dishById(plan.ids[slot]);
    if(!f)return '';
    const sub=[f.cat,f.unit].filter(Boolean).join(' · ');
    const kcal=Math.round(+f.kcal||0).toLocaleString('ko-KR');
    const prot=f.protein!=null?` · 단백질 ${Math.round(f.protein)}g`:'';
    const done=recorded.has(slot);
    const btns=done?`<span class="muted" style="font-size:11px">기록됨</span>`:
      `<button type="button" class="btn-secondary btn-sm" onclick="DGGuide.swapNextMeal('${slot}')">교체</button>
       <button type="button" class="btn-primary btn-sm" onclick="DGGuide.addNextMeal('${slot}')">기록</button>`;
    return `<div class="np-row">
      <div class="nm"><b>${esc(slot)} · ${esc(f.name)}</b><span>${esc(sub)}${prot} · <span class="num">${kcal}</span>kcal</span></div>
      <div class="np-act">${btns}</div></div>`;
  }).join('');
  return `<div class="card guide-card" id="nextDayCard">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0">내일 식단</h3><span class="muted" style="font-size:11px">${esc(plan.date)}</span></div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">오늘 먹은 메뉴는 빼고 골랐어요. 교체하거나 내일 날짜로 바로 기록할 수 있어요.</div>
    <div class="np-list">${rows}</div>
  </div>`;
}

function headline(C){
  const t=(C&&C.days&&C.days[C.today])||{};
  const kcal=t.kcal||0, prot=t.prot||0, meals=t.mealCount||0, streak=C&&C.streak||0;
  const walk=t.walk||0, str=t.strength||t.strMin, rest=!!t.rest;
  if(kcal>=2300)return {id:'overeat',text:'오늘은 이미 '+Math.round(kcal).toLocaleString('ko-KR')+'kcal예요. 저녁만 가볍게 가 볼까요?',act:'저녁 추천 보기',go:"const el=document.getElementById('dinnerCard');if(el)el.scrollIntoView({block:'start'});"};
  if(kcal>=2000&&meals>0)return {id:'overeat-soft',text:'칼로리가 목표보다 조금 많아요. 다음 한 끼만 가볍게 챙겨 봐요.',act:'저녁 추천 보기',go:"const el=document.getElementById('dinnerCard');if(el)el.scrollIntoView({block:'start'});"};
  if(meals>0&&prot<100)return {id:'prot',text:'단백질이 아직 '+Math.round(prot)+'g이에요. 저녁에 한 끼만 채워도 균형이 맞아요.',act:'저녁 추천 보기',go:"const el=document.getElementById('dinnerCard');if(el)el.scrollIntoView({block:'start'});"};
  if(!rest&&walk<40&&!str)return {id:'ex',text:'오늘은 아직 운동 기록이 없어요. 홈트 한 세트만 해도 몸이 가벼워져요.',act:'홈트 시작',go:"if(window.DGWorkout)DGWorkout.open();"};
  if(streak>=3&&(t.weight!=null||meals>0))return {id:'streak',text:'연속 '+streak+'일 기록 중이에요. 이 페이스 정말 좋아요.',act:'오늘 체중 기록',go:"tab='log';logKind='weight';render();"};
  if(!meals)return {id:'meal',text:'끼니를 적으면 예상 체중과 저녁 추천이 더 정확해져요. 천천히 시작해도 돼요.',act:'식사 기록',go:"tab='log';logKind='meal';mealKind=suggestMealSlot();render();setTimeout(revealMealSearch,50);"};
  return {id:'ok',text:'오늘도 잘 적고 있어요. 남은 하루도 무리하지 말고 가볍게 가요.',act:'홈트 살펴보기',go:"if(window.DGWorkout)DGWorkout.open();"};
}
function coachHTML(C){
  const h=headline(C);
  return `<div class="card guide-card coach-line" id="coachLine">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0">코치 한마디</h3><span class="muted" style="font-size:11px">규칙 기반</span></div>
    <div style="font-size:15px;line-height:22px;color:var(--ink-900)">${esc(h.text)}</div>
    <button type="button" class="btn-primary btn-sm" style="margin-top:10px" onclick="${h.go}">${esc(h.act)}</button>
    <div class="muted" style="font-size:11px;margin-top:8px">건강 정보는 참고용이에요. 진단이 아니며, 정확한 판단은 의사에게 받으세요.</div>
  </div>`;
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const api={KCAL_PER_KG,ACT_OPTS,ageFromBirth,mifflinBmr,tdeeProfile,forecastWeight,fmtKgDelta,walkExtraKg,forecastTrail,forecastChartSVG,forecastHTML,
  recommendDinner,recScore,dinnerHTML,addDinner,recommendNextDay,eatenMealKeys,nextDayHTML,swapNextMeal,addNextMeal,loadNextPlan,headline,coachHTML};
root.DGGuide=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
