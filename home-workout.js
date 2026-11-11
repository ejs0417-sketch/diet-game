// 다이어트 게임 0.4.15 — 장비 없이 하는 홈트 단계 코칭
// 소모 kcal = (MET − 1) × 체중(kg) × 시간(h). 기존 걷기·근력과 같은 순증분(활동계수에 기초대사가 이미 포함).
// MET 출처: Ainsworth BE et al., 2011 Compendium of Physical Activities (Med Sci Sports Exerc).
//   제자리걷기 3.5 MET — 17170 walking, 3.0 mph, level, firm surface (가벼운 보행에 준함)
//   스쿼트·런지 5.0 MET — 02014 calisthenics, moderate effort
//   벽/무릎 푸시업 3.8 MET — 02012 calisthenics, light or moderate effort (무릎·벽)
//   일반 푸시업 8.0 MET — 02020 calisthenics, vigorous effort (push-ups, sit-ups, pull-ups)
//   플랭크 4.0 MET — 02104 yoga, power (정적 코어에 준함)
(function(root){
const SKEY_HW='hw';
const MET={walk:3.5, squat:5.0, lunge:5.0, pushLight:3.8, pushHard:8.0, plank:4.0};
const NEED=3; // 같은 단계 완료 N번이면 다음 단계 개방
const REST_SEC=20;
const SAFETY='무릎이나 가슴이 아프면 바로 멈추고, 통증 있는 날에는 쉬어 주세요. 이 운동은 참고용이에요.';

const STAGES=[
  {id:1,name:'1단계 · 몸을 깨우기',need:NEED,moves:[
    {id:'w',name:'제자리걷기',kind:'time',sec:120,sets:1,met:MET.walk},
    {id:'p',name:'벽 푸시업',kind:'reps',reps:8,sets:2,met:MET.pushLight},
    {id:'s',name:'스쿼트',kind:'reps',reps:8,sets:2,met:MET.squat},
    {id:'k',name:'플랭크',kind:'time',sec:15,sets:2,met:MET.plank}
  ]},
  {id:2,name:'2단계 · 기본 다지기',need:NEED,moves:[
    {id:'w',name:'제자리걷기',kind:'time',sec:180,sets:1,met:MET.walk},
    {id:'p',name:'무릎 푸시업',kind:'reps',reps:10,sets:2,met:MET.pushLight},
    {id:'s',name:'스쿼트',kind:'reps',reps:10,sets:3,met:MET.squat},
    {id:'l',name:'런지',kind:'reps',reps:6,sets:2,met:MET.lunge,per:'다리'},
    {id:'k',name:'플랭크',kind:'time',sec:20,sets:2,met:MET.plank}
  ]},
  {id:3,name:'3단계 · 조금 더',need:NEED,moves:[
    {id:'w',name:'제자리걷기',kind:'time',sec:180,sets:1,met:MET.walk},
    {id:'p',name:'푸시업(무릎 또는 일반)',kind:'reps',reps:8,sets:3,met:MET.pushLight},
    {id:'s',name:'스쿼트',kind:'reps',reps:12,sets:3,met:MET.squat},
    {id:'l',name:'런지',kind:'reps',reps:8,sets:3,met:MET.lunge,per:'다리'},
    {id:'k',name:'플랭크',kind:'time',sec:30,sets:2,met:MET.plank}
  ]},
  {id:4,name:'4단계 · 힘 올리기',need:NEED,moves:[
    {id:'w',name:'제자리걷기',kind:'time',sec:240,sets:1,met:MET.walk},
    {id:'p',name:'푸시업',kind:'reps',reps:10,sets:3,met:MET.pushHard},
    {id:'s',name:'스쿼트',kind:'reps',reps:15,sets:3,met:MET.squat},
    {id:'l',name:'런지',kind:'reps',reps:10,sets:3,met:MET.lunge,per:'다리'},
    {id:'k',name:'플랭크',kind:'time',sec:40,sets:3,met:MET.plank}
  ]},
  {id:5,name:'5단계 · 꾸준한 루틴',need:NEED,moves:[
    {id:'w',name:'제자리걷기',kind:'time',sec:300,sets:1,met:MET.walk},
    {id:'p',name:'푸시업',kind:'reps',reps:12,sets:3,met:MET.pushHard},
    {id:'s',name:'스쿼트',kind:'reps',reps:15,sets:4,met:MET.squat},
    {id:'l',name:'런지',kind:'reps',reps:12,sets:3,met:MET.lunge,per:'다리'},
    {id:'k',name:'플랭크',kind:'time',sec:45,sets:3,met:MET.plank}
  ]}
];

function state(){
  const st=(typeof settings!=='undefined'?settings:{});
  if(!st[SKEY_HW]||typeof st[SKEY_HW]!=='object')st[SKEY_HW]={stage:1,unlocked:1,done:{}};
  const h=st[SKEY_HW];
  h.stage=+h.stage||1;h.unlocked=+h.unlocked||1;h.done=h.done||{};
  h.stage=Math.max(1,Math.min(STAGES.length,h.stage));
  h.unlocked=Math.max(h.unlocked,h.stage,1);
  return h;
}
function saveHw(){if(typeof saveSettings==='function')saveSettings();}
function stageOf(n){return STAGES.find(s=>s.id===n)||STAGES[0];}
function doneCount(n){return +(state().done[n]||0);}
function canUnlock(n){return doneCount(n)>=(stageOf(n).need||NEED);}
function setStage(n){
  const h=state();
  n=Math.max(1,Math.min(h.unlocked,n));
  h.stage=n;saveHw();return h;
}
function stepDown(){
  const h=state();
  if(h.stage<=1)return h;
  h.stage=h.stage-1;saveHw();return h;
}
function registerComplete(n){
  const h=state();
  n=n||h.stage;
  h.done[n]=(+h.done[n]||0)+1;
  if(canUnlock(n)&&n<STAGES.length)h.unlocked=Math.max(h.unlocked,n+1);
  h.stage=Math.min(STAGES.length, Math.max(h.stage, n<(h.unlocked)?n:h.stage));
  if(h.done[n]>=(stageOf(n).need||NEED)&&n<STAGES.length)h.stage=Math.max(h.stage,n+1);
  saveHw();return h;
}

function moveMinutes(m){
  if(m.kind==='time')return (m.sec*(m.sets||1))/60;
  // 횟수 운동은 세트당 약 40초 + 휴식 20초로 시간만 추정(kcal용). 횟수 자체는 MET 시간에 포함.
  const sets=m.sets||1;
  return (sets*40 + Math.max(0,sets-1)*REST_SEC)/60;
}
function sessionMinutes(stage){
  return (stage.moves||[]).reduce((s,m)=>s+moveMinutes(m),0);
}
function sessionKcal(stage,weight){
  // 동작별 MET로 합산. 공식은 파일 상단 주석(2011 Compendium).
  const w=+weight||0;
  if(!(w>0))return 0;
  const fn=(typeof exKcal==='function')?exKcal:(met,min,ww)=>(met-1)*ww*min/60;
  return (stage.moves||[]).reduce((s,m)=>s+fn(m.met,moveMinutes(m),w),0);
}

let sess=null, timer=null;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtTime(s){s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60);}

function open(){
  const h=state(); startSession(h.stage);
}
function startSession(n){
  const st=stageOf(n);
  sess={stage:st,idx:0,set:0,left:st.moves[0].kind==='time'?st.moves[0].sec:0,running:false,done:st.moves.map(m=>0),rest:0};
  paint();
}
function close(keep){
  stopTimer();sess=null;
  const el=$el();if(el)el.remove();
  if(!keep&&typeof render==='function')render();
}
function $el(){return document.getElementById('hwPane');}
function stopTimer(){if(timer){clearInterval(timer);timer=null;}}
function tick(){
  if(!sess)return;
  if(sess.rest>0){sess.rest--;if(sess.rest<=0){sess.rest=0;}paint();return;}
  if(!sess.running)return;
  const mv=sess.stage.moves[sess.idx];
  if(!mv||mv.kind!=='time')return;
  sess.left=Math.max(0,sess.left-1);
  if(sess.left<=0){sess.running=false;completeSet();}
  paint();
}
function startTimer(){
  if(!sess)return;
  sess.running=true;
  if(!timer)timer=setInterval(tick,1000);
  paint();
}
function pauseTimer(){if(sess)sess.running=false;paint();}
function completeSet(){
  if(!sess)return;
  const mv=sess.stage.moves[sess.idx];
  sess.done[sess.idx]=(sess.done[sess.idx]||0)+1;
  sess.running=false;
  if(sess.done[sess.idx]>=(mv.sets||1)){
    if(sess.idx<sess.stage.moves.length-1){
      sess.idx++;sess.set=0;sess.left=sess.stage.moves[sess.idx].kind==='time'?sess.stage.moves[sess.idx].sec:0;
      sess.rest=REST_SEC;
    }
  }else{
    const nxt=sess.stage.moves[sess.idx];
    sess.left=nxt.kind==='time'?nxt.sec:0;
    sess.rest=REST_SEC;
  }
  paint();
}
function skipMove(){
  if(!sess)return;
  const mv=sess.stage.moves[sess.idx];
  sess.done[sess.idx]=mv.sets||1;
  sess.rest=0;sess.running=false;
  if(sess.idx<sess.stage.moves.length-1){
    sess.idx++;sess.left=sess.stage.moves[sess.idx].kind==='time'?sess.stage.moves[sess.idx].sec:0;
  }
  paint();
}
function allDone(){return sess&&sess.stage.moves.every((m,i)=>(sess.done[i]||0)>=(m.sets||1));}

function finish(){
  if(!sess||!allDone())return typeof toast==='function'&&toast('아직 끝나지 않은 동작이 있어요');
  const st=sess.stage;
  const w=(typeof compute==='function'?compute().weight:0);
  const min=Math.max(1,Math.round(sessionMinutes(st)));
  const kcal=Math.round(sessionKcal(st,w));
  registerComplete(st.id);
  const ev={date:typeof today==='function'?today():'',type:'exercise',item:'근력',value:String(min),kcal:kcal?String(kcal):'',note:'홈트 '+st.id+'단계'+(kcal?';kcal='+kcal:'')};
  close(true);
  if(typeof add==='function')add(ev);
  else if(typeof toast==='function')toast('홈트를 기록했어요');
}

function paint(){
  let el=$el();
  if(!el){el=document.createElement('div');el.id='hwPane';el.className='cam-pane';document.body.appendChild(el);}
  if(!sess){el.remove();return;}
  const st=sess.stage, mv=st.moves[sess.idx], doneSets=sess.done[sess.idx]||0;
  const finished=allDone();
  const list=st.moves.map((m,i)=>{
    const d=sess.done[i]||0, tot=m.sets||1, on=i===sess.idx&&!finished;
    const lab=m.kind==='time'?(fmtTime(m.sec)+(m.sets>1?` × ${m.sets}세트`:'')):(m.reps+'회'+(m.per?('/'+m.per):'')+` × ${m.sets}세트`);
    return `<div class="hw-move${on?' on':''}${d>=tot?' done':''}"><b>${esc(m.name)}</b><span>${lab} · ${d}/${tot}</span></div>`;
  }).join('');
  let body='';
  if(finished){
    const w=(typeof compute==='function'?compute().weight:0);
    body=`<div class="hw-hero">완료!</div><div class="muted" style="margin-bottom:12px">약 ${Math.round(sessionMinutes(st))}분 · 추정 ${Math.round(sessionKcal(st,w))}kcal. 기록하면 근력 운동으로 들어가요.</div>
      <button type="button" class="btn-primary btn-lg" onclick="DGWorkout.finish()">기록하고 닫기</button>`;
  }else if(sess.rest>0){
    const rp=Math.max(0,Math.min(1,1-sess.rest/REST_SEC));
    body=`<div class="hw-ring-wrap"><div class="hw-ring" style="--p:${(rp*100).toFixed(1)}"><div class="hw-hero">${fmtTime(sess.rest)}</div></div></div><div class="muted" style="margin-bottom:12px">잠시 숨을 고르세요 (휴식 ${REST_SEC}초)</div>
      <button type="button" class="btn-secondary" onclick="DGWorkout.skipRest()">휴식 건너뛰기</button>`;
  }else if(mv.kind==='time'){
    const tot=mv.sec||1, left=sess.left||tot, rp=Math.max(0,Math.min(1,1-left/tot));
    body=`<div class="muted">${esc(mv.name)} · ${doneSets+1}/${mv.sets||1}세트</div>
      <div class="hw-ring-wrap"><div class="hw-ring" style="--p:${(rp*100).toFixed(1)}"><div class="hw-hero">${fmtTime(left)}</div></div></div>
      <div class="rowx" style="margin-top:8px">${sess.running
        ?`<button type="button" class="btn-secondary" onclick="DGWorkout.pauseTimer()">일시정지</button>`
        :`<button type="button" class="btn-primary btn-lg" onclick="DGWorkout.startTimer()">${(sess.left&&sess.left<mv.sec)?'이어하기':'시작'}</button>`}
        <button type="button" class="btn-ghost" onclick="DGWorkout.completeSet()">세트 완료</button></div>`;
  }else{
    body=`<div class="muted">${esc(mv.name)}</div>
      <div class="hw-hero">${mv.reps}회${mv.per?`/${esc(mv.per)}`:''}</div>
      <div class="muted" style="margin-bottom:10px">${doneSets+1}/${mv.sets||1}세트</div>
      <button type="button" class="btn-primary btn-lg" onclick="DGWorkout.completeSet()">세트 완료</button>`;
  }
  el.innerHTML=`<div class="health-sheet hw-sheet"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">${esc(st.name)}</h2><button type="button" class="btn-ghost btn-sm" onclick="DGWorkout.close()">닫기</button></div>
    <div class="muted" style="font-size:12px;line-height:18px;margin-bottom:10px">${esc(SAFETY)}</div>
    <div class="hw-list">${list}</div>
    ${body}
    <div class="rowx" style="margin-top:14px"><button type="button" class="btn-secondary btn-sm" onclick="DGWorkout.skipMove()">이 동작 건너뛰기</button>
      ${st.id>1?`<button type="button" class="btn-ghost btn-sm" onclick="DGWorkout.tooHard()">너무 힘들어요 · 한 단계 내리기</button>`:''}</div>
  </div>`;
}
function skipRest(){if(sess){sess.rest=0;paint();}}
function tooHard(){
  const h=stepDown();
  if(typeof toast==='function')toast((h.stage)+'단계로 낮췄어요');
  startSession(h.stage);
}

function cardHTML(C){
  const h=state();
  const st=stageOf(h.stage);
  const n=doneCount(st.id), need=st.need||NEED;
  const w=C&&C.weight, kcal=Math.round(sessionKcal(st,w)), min=Math.round(sessionMinutes(st));
  const next=h.unlocked>h.stage?stageOf(h.stage+1): (canUnlock(st.id)&&st.id<STAGES.length?stageOf(st.id+1):null);
  return `<div class="card guide-card" id="workoutCard">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0">홈트 ${esc(st.name)}</h3><span class="muted" style="font-size:11px">${n}/${need}회 완료</span></div>
    <div class="muted" style="font-size:12px;line-height:18px;margin-bottom:8px">장비 없이 ${st.moves.length}동작 · 약 ${min}분 · 추정 ${kcal}kcal. ${esc(SAFETY)}</div>
    <div class="hw-mini">${st.moves.map(m=>`<span class="chip" style="min-height:28px;font-size:12px">${esc(m.name)}</span>`).join('')}</div>
    <div class="rowx" style="margin-top:10px"><button type="button" class="btn-primary btn-sm" onclick="DGWorkout.open()">이 단계 시작</button>
      ${h.stage>1?`<button type="button" class="btn-ghost btn-sm" onclick="DGWorkout.dropAndRefresh()">한 단계 내리기</button>`:''}
      ${h.unlocked>h.stage?`<button type="button" class="btn-secondary btn-sm" onclick="DGWorkout.upAndRefresh()">다음 단계</button>`:''}</div>
    ${next&&h.unlocked<=h.stage?`<div class="muted" style="margin-top:8px;font-size:12px">이 단계를 ${need}번 마치면 ${esc(next.name)}가 열려요.</div>`:''}
  </div>`;
}
function dropAndRefresh(){stepDown();if(typeof render==='function')render();}
function upAndRefresh(){const h=state();if(h.stage<h.unlocked){h.stage++;saveHw();if(typeof render==='function')render();}}

const api={STAGES,MET,SAFETY,NEED,state,stageOf,doneCount,setStage,stepDown,registerComplete,canUnlock,
  sessionMinutes,sessionKcal,moveMinutes,open,close,startSession,startTimer,pauseTimer,completeSet,skipMove,skipRest,finish,tooHard,
  dropAndRefresh,upAndRefresh,cardHTML};
root.DGWorkout=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
