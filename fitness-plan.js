// 다이어트 게임 0.4.24 — 헬스장 4주 계획 (2026-11-17 화 ~ 12-16 수). 월~토 운동, 일요일 휴식/가벼운 걷기
// 소모 kcal(화면 표시) = MET × 체중(kg) × 시간(h). 체중은 그날까지 기록된 최신 체중, 없으면 113kg.
// 하루 예상 체중 계산에는 기존 걷기·근력과 같이 (MET − 1) 순증분만 더함(기초대사는 활동계수에 이미 포함).
// MET 참고: 2011 Compendium of Physical Activities — 경사 걷기 5~6, 실내자전거 보통 5.5, 일립티컬 5,
//   인터벌 고강도 구간 7, 근력 기계 3.5~5, 스트레칭 2.5, 가벼운 걷기 3.5.
(function(root){
const START='2026-11-17', END='2026-12-16', DEFAULT_W=113;
const XP_ITEM=5, XP_DAY=20, XP_STREAK3=10, XP_STREAK6=20;
const SAFETY=[
  '체중이 70kg대 후반이 될 때까지 달리기·점프는 하지 않아요. 걷기·자전거·일립티컬만.',
  '가슴 통증, 어지러움, 관절 통증이 있으면 바로 멈추세요.',
  '운동 중 물 1L 이상, 잠은 7시간 이상.',
  '혈압·검진에서 걸리는 게 있으면 시작 전에 의사와 상의해 주세요.'
];
const WEEKS=[
  {n:1,from:'2026-11-17',to:'2026-11-23',min:'75~90분',kcal:'600~750kcal',sum:'근력 30분(가볍게 2세트×12~15회) + 유산소 45~60분(대화 가능한 강도)'},
  {n:2,from:'2026-11-24',to:'2026-11-30',min:'약 100분',kcal:'800~900kcal',sum:'근력 3세트 + 트레드밀 경사 최대 8% + 일립티컬'},
  {n:3,from:'2026-12-01',to:'2026-12-07',min:'2시간',kcal:'1,000~1,100kcal',sum:'준비운동 10 + 근력 40 + 인터벌 유산소 60(3분 편하게/2분 세게) + 스트레칭 10'},
  {n:4,from:'2026-12-08',to:'2026-12-16',min:'2시간',kcal:'1,100~1,200kcal',sum:'상체/하체 나눈 근력(무게 조금씩 ↑) + 유산소 경사·속도 한 단계 ↑'}
];
const M=(id,name,min,met,dose,kind)=>({id,name,min,met,dose,kind:kind||'str'});
function machines(set,min,met,tail){
  const s=set+'세트×12~15회'+(tail||'');
  return [M('legpress','레그프레스',min[0],met,s),M('chest','체스트프레스',min[1],met,s),M('latpull','랫풀다운',min[2],met,s),
    M('row','시티드로우',min[3],met,s),M('shoulder','숄더프레스',min[4],met,s),M('plank','플랭크',min[5],met,set+'세트×20~40초')];
}
const SUNDAY=[M('sunwalk','가벼운 걷기 (선택)',30,3.5,'편한 속도 30분 · 쉬어도 돼요','cardio')];
function weekItems(n,dow){
  if(dow===0)return SUNDAY;
  if(n===1)return machines(2,[5,5,5,5,5,5],3.5,' · 가볍게').concat([
    M('cardio','트레드밀 경사 걷기 또는 실내자전거',50,5.0,'경사 3~6% · 시속 4.5~5km · 45~60분 · 대화 가능한 강도','cardio')]);
  if(n===2)return machines(3,[7,7,7,7,7,5],3.5).concat([
    M('tread','트레드밀 경사 걷기',30,6.0,'경사 최대 8% · 시속 4.5~5km','cardio'),
    M('ellip','일립티컬',30,5.0,'보통 강도 · 숨이 약간 찰 정도','cardio')]);
  const warm=M('warm','준비운동 (가볍게 걷기·관절 풀기)',10,3.5,'10분','warm');
  const stretch=M('stretch','스트레칭',10,2.5,'10분 · 하체·등·어깨','stretch');
  if(n===3)return [warm].concat(machines(3,[7,7,7,7,7,5],3.5),[
    M('interval','인터벌 유산소 (트레드밀 경사/자전거/일립티컬)',60,5.8,'3분 편하게 + 2분 세게 × 12회 · 달리기 금지','cardio'),stretch]);
  // 4주차: 월·수·금 상체, 화·목·토 하체
  const upper=dow%2===1;
  const met=4.5, d3='3~4세트×10~12회 · 지난주보다 무게 조금 ↑';
  const str=upper?[M('chest','체스트프레스',8,met,d3),M('latpull','랫풀다운',8,met,d3),M('row','시티드로우',8,met,d3),M('shoulder','숄더프레스',8,met,d3),M('plank','플랭크',8,met,'3~4세트×30~45초')]
    :[M('legpress','레그프레스',9,met,d3),M('legcurl','레그컬',8,met,d3),M('legext','레그익스텐션',8,met,d3),M('calf','카프레이즈',7,met,d3),M('plank','플랭크',8,met,'3~4세트×30~45초')];
  return [warm].concat(str,[
    M('interval','인터벌 유산소 (한 단계 ↑)',60,6.3,'3분 편하게 + 2분 세게 × 12회 · 경사·속도 한 단계 ↑ · 달리기 금지','cardio'),stretch]);
}
function dnum(d){return Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;}
function dstr(n){return new Date(n*864e5).toISOString().slice(0,10);}
function dowOf(d){return new Date(dnum(d)*864e5).getUTCDay();}
function weekNo(d){if(!d||d<START||d>END)return 0;return Math.min(4,Math.floor((dnum(d)-dnum(START))/7)+1);}
function planFor(d){
  const n=weekNo(d);if(!n)return null;
  const dow=dowOf(d), items=weekItems(n,dow);
  const wk=WEEKS[n-1];
  const label=dow===0?'일요일 · 휴식 또는 가벼운 걷기':(n===4?(dow%2===1?'상체 날':'하체 날'):'운동하는 날');
  return {date:d,week:n,dow,rest:dow===0,label,items,wk,
    min:items.reduce((s,i)=>s+i.min,0)};
}
const kcalOf=(met,w,min)=>met*(w>0?w:DEFAULT_W)*min/60;
const netOf=(met,w,min)=>Math.max(0,met-1)*(w>0?w:DEFAULT_W)*min/60;
function planKcal(p,w){return p?p.items.reduce((s,i)=>s+kcalOf(i.met,w,i.min),0):0;}
function itemOf(d,id){const p=planFor(d);return p?p.items.find(i=>i.id===id)||null:null;}
// compute()에서 하루치 정산. info.gym = {itemId: minutes}
function dayComplete(d,gym){
  const p=planFor(d);if(!p||p.rest)return false;
  return p.items.every(i=>gym&&gym[i.id]!=null);
}

// ---------- UI ----------
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtD(d){return (+d.slice(5,7))+'/'+(+d.slice(8,10));}
const WD=['일','월','화','수','목','금','토'];
function curW(C){return (C&&C.weight>0)?C.weight:DEFAULT_W;}
function evFor(d,id){return (typeof raw!=='undefined'?raw:[]).find(e=>e&&e.type==='gym'&&e.date===d&&e.item===id);}
function itemRow(d,it,w,editable){
  const ev=evFor(d,it.id), done=!!ev, min=done?(+ev.value||it.min):it.min;
  const k=Math.round(kcalOf(it.met,w,min));
  return `<div class="gym-item${done?' done':''}">
    <button type="button" class="gym-check" aria-label="${done?'완료 취소':'완료'}" ${editable?`onclick="DGFitness.toggle('${d}','${it.id}')"`:'disabled'}>${done?'✓':''}</button>
    <div class="gym-body"><b>${esc(it.name)}</b><span>${esc(it.dose)}</span></div>
    <button type="button" class="gym-min" ${editable?`onclick="DGFitness.editMin('${d}','${it.id}')"`:'disabled'} aria-label="실제 한 시간 수정"><b class="num">${min}분</b><span>${k}kcal</span></button>
  </div>`;
}
function safetyHTML(open){return `<details class="gym-safety"${open?' open':''}><summary>⚠️ 안전 안내</summary><ul>${SAFETY.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`;}
function todayCardHTML(C){
  const T=(C&&C.today)||(typeof today==='function'?today():START);
  const w=curW(C);
  if(T<START){
    const p=planFor(START);
    return `<section class="card gym-card" id="gymCard"><div class="gym-h"><h3>🏋️ 헬스 계획</h3><span class="gym-wk">${fmtD(START)}(${WD[dowOf(START)]}) 시작</span></div>
      <div class="muted" style="font-size:13px;line-height:19px">4주 헬스 계획이 ${fmtD(START)}(${WD[dowOf(START)]})부터 시작돼요. 첫날은 ${p.items.length}개 항목 · 약 ${p.min}분 · 약 ${Math.round(planKcal(p,w))}kcal.</div>
      <button type="button" class="btn-secondary btn-sm" style="width:100%;margin-top:10px" onclick="DGFitness.openPlan()">4주 계획 보기</button>${safetyHTML(false)}</section>`;
  }
  if(T>END){
    return `<section class="card gym-card" id="gymCard"><div class="gym-h"><h3>🏋️ 헬스 계획</h3><span class="gym-wk">완료</span></div>
      <div class="muted" style="font-size:13px">4주 계획 기간(11/17~12/16)이 끝났어요. 다음 계획은 코치에게 물어봐 주세요.</div>
      <button type="button" class="btn-ghost btn-sm" style="width:100%;margin-top:10px" onclick="DGFitness.openPlan()">지난 4주 보기</button></section>`;
  }
  const p=planFor(T), info=(C&&C.days&&C.days[T])||{};
  const gym=info.gym||{}, nDone=p.items.filter(i=>gym[i.id]!=null).length;
  const burned=Math.round(info.gymKcal||0), target=Math.round(planKcal(p,w));
  const complete=!p.rest&&nDone===p.items.length;
  const pct=Math.max(0,Math.min(100,target?burned/target*100:0));
  const xpToday=(C&&C.rows||[]).filter(r=>r.date===T&&r.type==='gym').reduce((s,r)=>s+(+r.xp||0),0);
  return `<section class="card gym-card${complete?' complete':''}" id="gymCard">
    <div class="gym-h"><h3>🏋️ 오늘의 운동</h3><span class="gym-wk">${p.week}주차 · ${fmtD(T)}(${WD[p.dow]})</span></div>
    <div class="gym-sub">${esc(p.label)} · 목표 ${esc(p.rest?'30분 걷기(선택)':p.wk.min+' · '+p.wk.kcal)}</div>
    <div class="gym-nums">
      <div><b class="num">${burned.toLocaleString('ko-KR')}</b><span>오늘 소모 kcal</span></div>
      <div><b class="num">${nDone}/${p.items.length}</b><span>완료 항목</span></div>
      <div><b class="num">+${xpToday}</b><span>헬스 XP</span></div>
    </div>
    <div class="bar gym-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="muted" style="font-size:11px;margin:4px 0 8px">계획대로 하면 약 ${target.toLocaleString('ko-KR')}kcal · 체중 ${(+w).toFixed(1)}kg 기준 · 시간을 누르면 실제 한 시간으로 고칠 수 있어요</div>
    ${complete?`<div class="gym-done-banner">🎉 오늘 운동 완료! +${XP_DAY} XP${info.gymStreak>=3?` · 연속 ${info.gymStreak}일`:''}</div>`:''}
    <div class="gym-list">${p.items.map(it=>itemRow(T,it,w,true)).join('')}</div>
    <div class="rowx" style="margin-top:10px">${!complete&&!p.rest?`<button type="button" class="btn-primary btn-sm" onclick="DGFitness.completeAll('${T}')">남은 항목 모두 완료</button>`:''}
      <button type="button" class="btn-secondary btn-sm" onclick="DGFitness.openPlan()">4주 계획 보기</button></div>
    ${safetyHTML(false)}
  </section>`;
}
let planOpenWeek=0;
function planHTML(){
  const T=typeof today==='function'?today():START;
  const cur=weekNo(T)||(T<START?1:4);
  const sel=planOpenWeek||cur;
  const C=typeof compute==='function'?compute():null, w=curW(C);
  const tabs=WEEKS.map(wk=>`<button type="button" class="chip${wk.n===sel?' on':''}${wk.n===cur&&T>=START&&T<=END?' cur':''}" onclick="DGFitness.pickWeek(${wk.n})">${wk.n}주차${wk.n===cur&&T>=START&&T<=END?' · 지금':''}</button>`).join('');
  const weeksOverview=WEEKS.map(wk=>`<div class="gym-week${wk.n===cur&&T>=START&&T<=END?' cur':''}" onclick="DGFitness.pickWeek(${wk.n})">
    <div class="gw-h"><b>${wk.n}주차</b><span>${fmtD(wk.from)}~${fmtD(wk.to)}</span></div>
    <div class="gw-m"><span>${esc(wk.min)}</span><span>${esc(wk.kcal)}</span></div>
    <div class="gw-s">${esc(wk.sum)}</div></div>`).join('');
  const W=WEEKS[sel-1];const days=[];for(let n=dnum(W.from);n<=dnum(W.to);n++)days.push(dstr(n));
  const dayBlocks=days.map(d=>{
    const p=planFor(d), info=(C&&C.days&&C.days[d])||{}, gym=info.gym||{};
    const nDone=p.items.filter(i=>gym[i.id]!=null).length, comp=!p.rest&&nDone===p.items.length;
    const isT=d===T, editable=d<=T;
    return `<details class="gym-day${isT?' today':''}${comp?' complete':''}"${isT?' open':''}><summary><b>${fmtD(d)}(${WD[p.dow]})</b><span>${esc(p.label)}</span><span class="num">${comp?'✓ 완료':(nDone?nDone+'/'+p.items.length:p.min+'분 · '+Math.round(planKcal(p,w))+'kcal')}</span></summary>
      <div class="gym-list">${p.items.map(it=>itemRow(d,it,w,editable)).join('')}</div></details>`;
  }).join('');
  return `<div class="health-sheet gym-sheet"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">🏋️ 4주 헬스 계획</h2><button type="button" class="btn-ghost btn-sm" onclick="DGFitness.closePlan()">닫기</button></div>
    <div class="muted" style="font-size:12px;line-height:18px;margin-bottom:10px">11/17(화)~12/16(수) · 월~토 운동, 일요일은 쉬거나 가볍게 30분 걷기. 운동 ${'800~1,200kcal'} + 식단 하루 약 2,200kcal·단백질 150g+로 한 달 5~7kg가 현실적인 목표예요.</div>
    ${safetyHTML(true)}
    <div class="gym-weeks">${weeksOverview}</div>
    <div class="gym-tabs">${tabs}</div>
    <div class="gym-days">${dayBlocks}</div>
    <div class="muted" style="font-size:11px;line-height:16px;margin-top:10px">소모 kcal = MET × 체중 × 시간. 경사 걷기 5~6, 자전거 5.5, 일립티컬 5, 인터벌(3분 편하게+2분 세게 평균) 5.8~6.3, 근력 기계 3.5~4.5, 스트레칭 2.5. XP: 항목마다 +${XP_ITEM}, 하루 완료 +${XP_DAY}, 3일 연속 +${XP_STREAK3}, 6일 연속 +${XP_STREAK6}(일요일은 연속을 끊지 않아요).</div>
  </div>`;
}
function paintPlan(){let el=document.getElementById('gymPane');if(!el){el=document.createElement('div');el.id='gymPane';el.className='cam-pane';document.body.appendChild(el);
  el.addEventListener('click',e=>{if(e.target===el)closePlan();});}
  const st=el.scrollTop;el.innerHTML=planHTML();el.scrollTop=st;}
function openPlan(){planOpenWeek=0;paintPlan();}
function closePlan(){const el=document.getElementById('gymPane');if(el)el.remove();}
function pickWeek(n){planOpenWeek=n;paintPlan();}
function refresh(){if(document.getElementById('gymPane'))paintPlan();}
function toggle(d,id){
  const it=itemOf(d,id);if(!it)return;
  if(typeof today==='function'&&d>today())return toast&&toast('미래 날짜는 체크할 수 없어요');
  const ev=evFor(d,id);
  if(ev){raw=raw.filter(e=>e!==ev);save();if(typeof toast==='function')toast('완료를 취소했어요');render();refresh();return;}
  add({date:d,type:'gym',item:id,value:String(it.min),met:String(it.met),note:it.name});refresh();
}
function editMin(d,id){
  const it=itemOf(d,id);if(!it)return;
  const ev=evFor(d,id);
  const v=prompt(`${it.name} · 실제로 한 시간(분)`,String(ev?ev.value:it.min));
  if(v==null)return;const m=Math.round(+v);
  if(!(m>0&&m<=240))return toast('1~240분으로 적어 주세요');
  if(ev){ev.value=String(m);save();render();refresh();toast('시간을 고쳤어요');}
  else{add({date:d,type:'gym',item:id,value:String(m),met:String(it.met),note:it.name});refresh();}
}
function completeAll(d){
  const p=planFor(d);if(!p)return;
  const left=p.items.filter(i=>!evFor(d,i.id));if(!left.length)return;
  left.slice(0,-1).forEach(it=>raw.push(withId({date:d,type:'gym',item:it.id,value:String(it.min),met:String(it.met),note:it.name})));
  const last=left[left.length-1];
  // 마지막 하나는 add()로 넣어 XP 연출이 한 번에 뜨게 함
  const before=compute().total;raw.push(withId({date:d,type:'gym',item:last.id,value:String(last.min),met:String(last.met),note:last.name}));
  save();const C=compute(),g=C.total-before;
  // add()와 같은 연출
  if(typeof pendingFx!=='undefined')pendingFx={xp:g,todayXp:todayXp(C),levelUp:false,ach:[],fire:true};
  render();refresh();
}
function questDef(C){
  const T=C&&C.today;const p=planFor(T);if(!p||p.rest)return null;
  const gym=((C.days[T]||{}).gym)||{}, n=p.items.filter(i=>gym[i.id]!=null).length;
  return {id:'gym',ic:'🏋️',t:`헬스 ${p.week}주차 · ${p.label}`,s:`${p.items.length}개 항목 · 약 ${p.min}분`,tags:['헬스','운동'],p:n,max:p.items.length,lab:`${n} / ${p.items.length}`,xp:XP_ITEM*p.items.length+XP_DAY,done:n===p.items.length,
    go:"tab='home';render();setTimeout(()=>{const el=document.getElementById('gymCard');if(el)el.scrollIntoView({block:'start'});},50)"};
}
const api={START,END,DEFAULT_W,WEEKS,SAFETY,XP_ITEM,XP_DAY,XP_STREAK3,XP_STREAK6,weekNo,planFor,planKcal,kcalOf,netOf,itemOf,dayComplete,dowOf,
  todayCardHTML,planHTML,openPlan,closePlan,pickWeek,toggle,editMin,completeAll,questDef};
root.DGFitness=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
