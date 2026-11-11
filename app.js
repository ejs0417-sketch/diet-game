// 다이어트 게임 0.4.0 — 기획서 v3 규칙 (예측 공식 건강관리 확인됨, 3D 아바타, 구글 로그인)
const VERSION='0.4.0', START_DATE='2026-11-10', START_W=113.0, MONTH_END='2026-12-10';
const KEY='dg_raw_v1', SKEY='dg_settings_v1';
const MEALS=['아침','점심','저녁'];
const SEED=[
 {date:'2026-11-10',type:'weight',item:'체중',value:'113.0',note:'시작 체중'},
 {date:'2026-11-10',type:'achievement',item:'시작의 용기',value:'',note:'게임 시작'},
 {date:'2026-11-11',type:'meal',item:'점심',value:'율민샐러드 수비드닭가슴살 샐러드(오리엔탈 드레싱+계란 1알)',kcal:'400~550',protein_g:'35~45',kcal_source:'대략치(건강관리)',note:''}];
const ACH=[
 ['시작의 용기','게임 시작',50,'🌱'],['첫 만점 주','주간 감량 0.5~1.2kg 첫 달성',40,'🏅'],
 ['식단 지킴이','1,600~2,000kcal·단백질 130g+ 7일 누적',40,'🥗'],['걷기 습관','걷기 40~60분 7일 누적',40,'👟'],
 ['근력 스타트','근력 주 2회 처음 채움',30,'💪'],['스트릭 7','체중 기록 7일 연속',30,'🔥'],
 ['한 달 최소 목표','2단계 달성 (XP는 단계 보상으로 지급)',100,'🎯'],['보스 토벌','정체기 보스 첫 클리어',50,'🐉'],
 ['첫 동기화','로컬과 계정을 처음 맞췄을 때',20,'☁️']];
const DERIVED=new Set(['quest','weekly_weight','warning']);

let logDate=null,raw=load(), settings=Object.assign({goal:95,month:109},JSON.parse(localStorage.getItem(SKEY)||'{}')), tab='home';
function load(){const s=localStorage.getItem(KEY);return s?JSON.parse(s):[];}
function ensureSeed(){if(!raw.length){raw=SEED.map(withId);localStorage.setItem(KEY,JSON.stringify(raw));}}
function save(){localStorage.setItem(KEY,JSON.stringify(raw));if(window.DGAuth)DGAuth.schedulePush();}
function saveSettings(){localStorage.setItem(SKEY,JSON.stringify(settings));if(window.DGAuth)DGAuth.schedulePush();}
function withId(e){return Object.assign({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7)},e);}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());}
const dn=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
const ds=n=>new Date(n*864e5).toISOString().slice(0,10);
const week=d=>Math.floor((dn(d)-dn(START_DATE))/7);
const weekEnd=w=>ds(dn(START_DATE)+w*7+6);
function rng(v){if(v==null||v==='')return null;const m=String(v).match(/([0-9.]+)\s*[~-]\s*([0-9.]+)/);return m?(+m[1]+ +m[2])/2:(isNaN(+v)?null:+v);}
function kc(e){const a=rng(e.kcal);return a!==null?a:nv(e.note,'kcal');}
function pr(e){const a=rng(e.protein_g);return a!==null?a:nv(e.note,'protein');}
function nv(note,k){const m=(note||'').match(new RegExp(k+'=([0-9.]+)'));return m?+m[1]:null;}
const walkXp=m=>Math.min(30,Math.floor(m/30)*15);

const LADDER=[[111,30,'첫 발'],[109,100,'한 달 최소 목표'],[105,40,'꾸준한 하락'],[100,50,'백 아래로'],[95,80,'1차 목표'],[86,120,'건강 체중']];
const ACT=1.2,KCAL_PER_KG=7700,CAP=150,HEIGHT=186,BIRTH='1988-02-25',MET_WALK=3.5,MET_STR=3.5,STR_DEFAULT_MIN=30;
// 운동 칼로리(순증분): (MET-1)×체중×시간. 기본 활동(×1.2)은 ACT에 이미 들어 있음
const exKcal=(met,min,w)=>(met-1)*w*min/60;
const walkKcal=(min,w)=>exKcal(MET_WALK,min,w);
const strKcal=(min,w)=>exKcal(MET_STR,min,w);
function ageAt(d){let a=+d.slice(0,4)-+BIRTH.slice(0,4);if(d.slice(5)<BIRTH.slice(5))a--;return a;}
// Mifflin-St Jeor (남성): 10×체중 + 6.25×키 − 5×나이 + 5
const mifflin=(w,d)=>10*w+6.25*HEIGHT-5*ageAt(d)+5;
function compute(T){
 T=T||today();
 const evs=raw.filter(e=>e.date<=T).slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
 const first=evs.length?evs[0].date:START_DATE;
 const rows=[],status=[],days={},got={},stages={};let streak=0,lastW=null,strW={},lastAvg=START_W,good=0,walkDays=0;
 const wByWeek={},lowWeek={},weekly={};let flatWeeks=0,boss=null,bossHist=[],notice=null;
 let pred=START_W,curW=START_W,bmrWk=null,bmrW=START_W,bmr=mifflin(START_W,START_DATE),lastSeenW=null;
 const award=(d,name,note,xp)=>{if(got[name])return;const a=ACH.find(x=>x[0]===name);got[name]=d;const r={date:d,type:'achievement',item:name,value:'',xp:xp??a[2],note:note||''};rows.push(r);return r;};
 const stage=(d,avg,isDeadlineCheck)=>{LADDER.forEach(([kg,xp,title],i)=>{if(stages[i]||avg>kg)return;if(i===1&&d>MONTH_END)return;if(isDeadlineCheck&&i!==1)return;
   stages[i]=d;rows.push({date:d,type:'milestone',item:`${i+1}단계 ${title}`,value:kg,xp,note:`avg=${avg.toFixed(2)}`});
   if(i===1)award(d,'한 달 최소 목표','2단계와 같음',0);});};
 for(let n=Math.min(dn(first),dn(START_DATE));n<=dn(T);n++){
  const d=ds(n),es=evs.filter(e=>e.date===d),wk=week(d);
  const info={weight:null,meals:{},kcal:0,prot:0,missingKcal:0,mealCount:0,walk:0,strength:0,strMin:0,rest:false,water:0,warn:false,bonus:0,closed:false};
  days[d]=info;const mealRows=[],habit=[];let seenMeal={},cumWalk=0;
  for(const e of es){
   const r={date:d,type:e.type,item:e.item,value:e.value,xp:0,kcal:e.kcal||'',protein_g:e.protein_g||'',kcal_source:e.kcal_source||'',note:e.note||'',id:e.id};
   if(e.type==='weight'){if(info.weight===null){info.weight=+e.value;curW=info.weight;r.xp=10;habit.push(r);}}
   else if(e.type==='meal'){info.mealCount++;const k=kc(e),p=pr(e);if(k===null)info.missingKcal++;else info.kcal+=k;if(p)info.prot+=p;
     if(MEALS.includes(e.item)&&!seenMeal[e.item]){seenMeal[e.item]=1;r.xp=5;habit.push(r);}info.meals[e.item]=1;mealRows.push(r);}
   else if(e.type==='meal_close'){if(info.closed)continue;info.closed=true;r.item='식사마감';info.closeRow=r;}
   else if(e.type==='exercise'&&e.item==='걷기'){const m=+e.value||0;r.xp=walkXp(cumWalk+m)-walkXp(cumWalk);cumWalk+=m;info.walk=cumWalk;habit.push(r);}
   else if(e.type==='exercise'&&e.item==='근력'){info.strMin+=(+e.value>0?+e.value:STR_DEFAULT_MIN);if(!info.strength){info.strength=1;strW[wk]=(strW[wk]||0)+1;if(strW[wk]<=3){r.xp=15;habit.push(r);}if(strW[wk]===2)award(d,'근력 스타트');}}
   else if(e.type==='rest'){info.rest=true;}
   else if(e.type==='water'){const before=info.water;info.water=+(info.water+(+e.value||0)).toFixed(2);if(before<2&&info.water>=2){r.xp=5;habit.push(r);}}
   else if(e.type==='achievement'){const a=ACH.find(x=>x[0]===e.item);if(a&&!got[a[0]]){got[a[0]]=d;r.xp=a[2];}else continue;}
   rows.push(r);
  }
  if(info.walk>=40&&info.walk<=60){const r={date:d,type:'exercise',item:'걷기가산',value:info.walk,xp:10,note:'40~60분'};rows.push(r);habit.push(r);}
  // 식사 마감 정산 (버튼 누른 날만)
  if(info.closed){const k=info.kcal,p=info.prot,cr=info.closeRow;cr.kcal=k;cr.protein_g=p;cr.kcal_source='하루합계';
   if(k<1600){info.warn=true;lowWeek[wk]=1;mealRows.forEach(r=>r.xp=0);cr.xp=0;rows.push({date:d,type:'warning',item:'저칼로리',value:k,xp:0,note:'1,600kcal 미만 식단 점수 없음'});}
   else{let b=0;if(k<=2000&&p>=130)b=20;else if(k<=2000&&p>=100)b=10;else if(k<=2300&&p>=130)b=10;cr.xp=b;info.bonus=b;habit.push(cr);
    if(k<=2000&&p>=130){good++;if(good===7)award(d,'식단 지킴이');}}}
  // 일일 퀘스트
  info.q=[info.weight!==null,info.closed&&info.mealCount>0,info.walk>=40||info.rest,info.water>=2];
  if(info.q.every(Boolean)){const r={date:d,type:'quest',item:'일일퀘스트',value:'',xp:20,note:''};rows.push(r);habit.push(r);}
  // 습관 XP 하루 상한
  let sum=0;for(const r of habit){if(sum+r.xp>CAP){r.note=(r.note?r.note+';':'')+'상한';r.xp=Math.max(0,CAP-sum);}sum+=r.xp;}
  if(info.walk>=40&&info.walk<=60){walkDays++;if(walkDays===7)award(d,'걷기 습관');}
  // 스트릭
  if(info.weight!==null){streak=(lastW===n-1)?streak+1:1;lastW=n;(wByWeek[wk]=wByWeek[wk]||[]).push(info.weight);
   if(streak%7===0){rows.push({date:d,type:'quest',item:'스트릭7',value:streak,xp:50,note:''});award(d,'스트릭 7');}}
  else if(!(d===T&&lastW===n-1))streak=0;
  info.streak=streak;
  // 예측 체중 (마감한 날만, 1,600 미만은 1,600으로 계산)
  // 기초대사량은 주마다 다시 계산: 그 주 시작일까지 7일 체중 평균 → 없으면 최근 체중 → 113
  if(info.weight!==null)lastSeenW=info.weight;
  if(bmrWk!==wk){const ws=[];for(let k=0;k<7;k++){const x=days[ds(n-k)];if(x&&x.weight!==null)ws.push(x.weight);}
   bmrW=ws.length?ws.reduce((a,b)=>a+b,0)/ws.length:(lastSeenW??START_W);bmr=mifflin(bmrW,d);bmrWk=wk;}
  info.bmr=Math.round(bmr);
  if(info.closed&&info.mealCount>0){const burn=bmr*ACT+walkKcal(info.walk,bmrW)+strKcal(info.strMin,bmrW);const eat=Math.max(1600,info.kcal);pred-=(burn-eat)/KCAL_PER_KG;info.burn=Math.round(burn);}
  info.pred=pred;
  // 보스 진행
  if(boss&&!boss.done&&d>=boss.start){const B=boss;if(info.weight===null)B.miss=true;else B.ws.push(info.weight);if(info.warn)B.low=true;
   if((info.walk>=40&&info.walk<=60)||info.rest)B.walkDays++;if(info.strength)B.str++;
   if(d===B.end&&d<T){const avg=B.ws.length?B.ws.reduce((a,b)=>a+b,0)/B.ws.length:Infinity;B.endAvg=avg;
     B.ok=!B.miss&&!B.low&&B.walkDays>=5&&B.str>=1&&avg<B.startAvg;B.done=true;
     if(B.ok){rows.push({date:d,type:'quest',item:'보스클리어',value:'',xp:80,note:`start=${B.startAvg.toFixed(2)};end=${avg.toFixed(2)}`});award(d,'보스 토벌');}
     bossHist.push(B);boss=null;flatWeeks=0;}}
  // 2단계 기한일 체크 (최근 7일 평균)
  if(d===MONTH_END&&d<=T){const ws=[];for(let k=0;k<7;k++){const x=days[ds(n-k)];if(x&&x.weight!==null)ws.push(x.weight);}if(ws.length>=3&&d<T)stage(d,ws.reduce((a,b)=>a+b,0)/ws.length,true);}
  // 주간 정산
  if(d===weekEnd(wk)&&d<T&&wk>=0){const ws=wByWeek[wk]||[];const W={n:ws.length};
   if(ws.length>=3){const avg=ws.reduce((a,b)=>a+b,0)/ws.length,loss=+(lastAvg-avg).toFixed(2);let x=0;
    if(lowWeek[wk])x=0;else if(loss>=0.5&&loss<=1.2)x=80;else if(loss>1.2)x=wk<=1?80:20;else if(loss>=0.3)x=40;else if(loss>0)x=15;
    Object.assign(W,{avg,loss,xp:x,low:!!lowWeek[wk]});rows.push({date:d,type:'weekly_weight',item:'주간평균',value:loss,xp:x,note:`this=${avg.toFixed(2)};prev=${lastAvg.toFixed(2)}`+(lowWeek[wk]?';저칼로리날있음':'')});
    if(loss>=0.5&&!(loss>1.2&&wk>1)&&!lowWeek[wk]){rows.push({date:d,type:'quest',item:'주간감량',value:'',xp:100,note:''});award(d,'첫 만점 주');}
    if(loss<=0){flatWeeks++;if(flatWeeks>=2&&!boss){boss={start:ds(n+1),end:ds(n+7),startAvg:avg,ws:[],walkDays:0,str:0};}else if(flatWeeks===1)notice={week:wk};}else{flatWeeks=0;}
    stage(d,avg);lastAvg=avg;}
   if((strW[wk]||0)>=2)rows.push({date:d,type:'quest',item:'근력주간',value:strW[wk],xp:100,note:''});
   weekly[wk]=W;}
  const total=rows.reduce((a,r)=>a+(+r.xp||0),0);
  status.push({date:d,level:Math.floor(total/100)+1,total_xp:total,streak_days:streak,weight:info.weight!==null?info.weight.toFixed(1):'',lost_kg:info.weight!==null?(START_W-info.weight).toFixed(1):''});
 }
 const total=rows.reduce((a,r)=>a+(+r.xp||0),0);
 const latestW=[...evs].reverse().find(e=>e.type==='weight');
 // 아바타 체형 기준: 최근 7일 체중 평균 → 없으면 최근 체중 → 시작 체중
 const w7=[];for(let k=0;k<7;k++){const x=days[ds(dn(T)-k)];if(x&&x.weight!==null)w7.push(x.weight);}
 const avatarW=w7.length?w7.reduce((a,b)=>a+b,0)/w7.length:(latestW?+latestW.value:START_W);
 const nStage=Object.keys(stages).length;
 return {rows,status,days,got,total,level:Math.floor(total/100)+1,coins:total,streak,today:T,weekly,strW,stages,nStage,
   next:LADDER.find((x,i)=>!stages[i]),boss,bossHist,flatWeeks,pred,weight:latestW?+latestW.value:START_W,lastAvg,avatarW,avatarN:w7.length,bmr:Math.round(bmr),bmrW};
}

// ---------- CSV ----------
const LOGH=['date','type','item','value','xp','kcal','protein_g','kcal_source','note'];
function csvCell(v){v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function toCsv(head,rows){return head.join(',')+'\n'+rows.map(r=>head.map(h=>csvCell(r[h])).join(',')).join('\n')+'\n';}
function parseCsv(t){const out=[];let row=[],c='',q=false;t=t.replace(/^\uFEFF/,'');
 for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++;}else q=false;}else c+=ch;}
  else if(ch=='"')q=true;else if(ch==','){row.push(c);c='';}else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;row.push(c);c='';if(row.some(x=>x!==''))out.push(row);row=[];}else c+=ch;}
 row.push(c);if(row.some(x=>x!==''))out.push(row);return out;}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv'}));a.download=name;a.click();}
function exportCsv(){const C=compute();download(`log_${C.today}.csv`,toCsv(LOGH,C.rows));
 setTimeout(()=>download(`status_${C.today}.csv`,toCsv(['date','level','total_xp','streak_days','weight','lost_kg'],C.status)),600);}
function importCsv(file){const fr=new FileReader();fr.onload=()=>{const t=parseCsv(fr.result);const h=t.shift()||[];
 const ix=k=>h.indexOf(k);if(ix('date')<0||ix('type')<0||ix('item')<0||ix('value')<0){alert('log.csv 형식이 아니에요. status.csv는 자동으로 다시 계산돼서 가져올 필요가 없어요.');return;}
 const g=(r,k)=>ix(k)>=0?(r[ix(k)]||''):'';
 const ev=t.map(r=>({date:g(r,'date'),type:g(r,'type'),item:g(r,'item'),value:g(r,'value'),kcal:g(r,'kcal'),protein_g:g(r,'protein_g'),kcal_source:g(r,'kcal_source'),note:g(r,'note')})).filter(e=>!DERIVED.has(e.type)&&e.item!=='식단보너스'&&e.item!=='걷기가산');
 if(!confirm(`기록 ${ev.length}건을 가져와서 지금 기록을 바꿀까요? (XP는 기획서 v1 규칙으로 다시 계산돼요)`))return;
 raw=ev.map(withId);save();toast('가져오기 완료');render();};fr.readAsText(file,'utf-8');}

// ---------- UI ----------
const $=s=>document.querySelector(s);
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',2200);}
function add(e){const before=compute().total;raw.push(withId(e));save();const C=compute(),g=C.total-before;
 toast(g>0?`+${g} XP 획득!`+(Math.floor(C.total/100)>Math.floor(before/100)?' 🎉 레벨업!':''):'기록했어요');render();}
function del(id){if(!confirm('이 기록을 지울까요?'))return;raw=raw.filter(e=>e.id!==id);save();render();}
const NAV=[['home','🏠','홈'],['quest','📋','퀘스트'],['log','📊','기록'],['ach','🛡️','업적'],['me','👤','내정보']];
function render(){const C=compute();$('#nav').innerHTML=NAV.map(([k,i,l])=>`<button class="${tab===k?'on':''}" onclick="tab='${k}';render()"><div>${i}</div>${l}</button>`).join('');
 if(tab!=='me'){pvKg=null;meBase=null;}$('#view').innerHTML=({home,quest,log,ach,me})[tab](C);window.scrollTo(0,0);if(window.dgMountAvatar)window.dgMountAvatar();}
function topBar(C){const p=C.total%100;return `<div class="top"><div class="badge">Lv.${C.level}</div><div style="flex:1"><b>Lv.${C.level}</b> <span class="muted">다음 레벨까지 ${100-p} XP</span><div class="bar"><i style="width:${p}%"></i><span>${p} / 100 XP</span></div></div><div class="coin">🪙 ${C.coins}</div></div>`;}
function questDefs(C){const t=C.days[C.today];const meals=MEALS.filter(m=>t.meals[m]).length;return [
 {ic:'⚖️',t:'아침 공복 체중',s:'하루 한 번, 일어나서 바로',p:t.weight!==null?1:0,max:1,lab:t.weight!==null?t.weight+'kg':'0 / 1',xp:10,done:t.weight!==null},
 {ic:'🍱',t:'식사 기록하고 마감',s:t.closed?`마감 완료 · ${t.kcal}kcal · 단백질 ${t.prot}g`:`${t.mealCount}끼 기록 · 다 먹으면 마감`,p:t.closed?1:0,max:1,lab:t.closed?'마감':'미마감',xp:20,done:t.closed&&t.mealCount>0},
 {ic:'👟',t:'걷기 40~60분',s:t.rest?'오늘은 통증 휴식':'관절에 무리 없이',p:t.rest?60:Math.min(t.walk,60),max:40,lab:t.rest?'휴식':`${t.walk} / 40~60분`,xp:40,done:t.walk>=40||t.rest},
 {ic:'💧',t:'물 2L 마시기',s:'틈틈이 나눠서',p:t.water,max:2,lab:`${t.water} / 2L`,xp:5,done:t.water>=2}];}
function qCard(q){return `<div class="card q"><div class="ic">${q.ic}</div><div class="b"><h4>${q.t}</h4><div class="muted">${q.s}</div><div class="bar ${q.done?'':'c'}" style="margin-top:6px"><i style="width:${Math.min(100,q.p/q.max*100)}%"></i><span>${q.lab}</span></div></div><div class="pill ${q.done?'done':''}">${q.done?'완료':q.xp?'+'+q.xp+' XP':'퀘스트'}</div></div>`;}
function warnBanner(C){let h='';const t=C.days[C.today],y=C.days[ds(dn(C.today)-1)];
 if(t.warn)h+=`<div class="warn">⚠️ 오늘은 1,600kcal 미만이라 식단 점수를 드리지 않았어요. 굶기 보상은 없어요.</div>`;
 else if(y&&y.warn)h+=`<div class="warn">⚠️ 어제는 1,600kcal 미만이라 식단 점수를 드리지 않았어요. 굶기 보상은 없어요.</div>`;
 if(C.boss){const live=C.today>=C.boss.start;h+=`<div class="warn" style="background:#f3edff;border-color:#8a63d2;color:#5b3aa0" onclick="tab='quest';render()">🐉 정체기 보스 ${live?'등장! ~'+C.boss.end.slice(5):'예고: '+C.boss.start.slice(5)+' 시작'} · 퀘스트에서 확인</div>`;}
 else if(C.flatWeeks===1)h+=`<div class="warn" style="background:#fffbe8;border-color:#e0b400;color:#7a6000">지난주 평균이 줄지 않았어요. 1주 정체는 흔해요. 이번 주도 그대로 꾸준히!</div>`;
 return h;}
function home(C){const qs=questDefs(C),show=qs.filter(q=>!q.done).slice(0,3);while(show.length<3&&show.length<qs.length)show.push(qs.find(q=>!show.includes(q)));
 const all=qs.every(q=>q.done);
 return topBar(C)+warnBanner(C)+`<div class="hero"><div class="avatar" id="avatarSlot" data-kg="${C.avatarW.toFixed(2)}" data-ghost="${C.pred.toFixed(2)}" data-idle="0.35"><img class="fallback" src="char.png" alt="캐릭터" style="transform:scale(${1-0.05*C.nStage},1)"><div class="avcap">주간 평균 ${C.avatarW.toFixed(1)}kg 체형${C.pred<=C.avatarW-0.1?' · 연두=예측':''}</div></div><div class="card wt" onclick="tab='log';render()">⚖️<div class="muted">현재 체중</div><b>${C.weight.toFixed(1)}kg</b><div>🎯 목표 <b style="display:inline;font-size:18px;color:#222">${settings.goal}kg</b></div><div class="muted">이번 달 목표 ${settings.month}kg · 감량 ${(START_W-C.weight).toFixed(1)}kg</div><div class="muted">📈 예측 ${predRange(C)} <span style="font-size:11px">(건강관리 확인됨)</span></div>${C.next?`<div class="muted">다음 단계 ${C.next[0]}kg ${C.next[2]}</div>`:''}</div></div>
 <div style="display:flex;justify-content:space-between;align-items:center"><h3>오늘의 퀘스트 ⭐</h3><span class="muted" onclick="tab='quest';render()">${all?'모두 완료! +20 XP':'모두 완료하면 +20 XP'} ›</span></div>${show.map(qCard).join('')}
 <div class="card"><b>빠른 기록</b><div>${quick()}</div><div class="muted">🔥 스트릭 ${C.streak}일</div></div>`;}
function quick(){return `<button class="btn" onclick="askWeight()">⚖️ 체중</button><button class="btn" onclick="tab='log';render();setTimeout(()=>$('#mealMenu').focus(),50)">🍱 식사</button><button class="btn" onclick="addWalk()">👟 걷기</button><button class="btn" onclick="add({date:today(),type:'water',item:'물',value:'0.5',note:''})">💧 물 0.5L</button>`;}
function predRange(C){return `${(C.pred-0.5).toFixed(1)}~${(C.pred+0.5).toFixed(1)}kg`;}
function askYesterday(d){const y=ds(dn(d)-1),C=compute(),Y=C.days[y],k='dg_asked_'+y;if(!Y||Y.closed||!Y.mealCount||localStorage.getItem(k))return;localStorage.setItem(k,'1');
 if(confirm(`어제(${y.slice(5)}) 식사가 마감되지 않았어요. 빠진 끼니 있나요?\n확인을 누르면 어제 기록으로 가서 추가하고 마감할 수 있어요.`)){tab='log';logDate=y;render();}}
function addWeight(d,v){add({date:d,type:'weight',item:'체중',value:(+v).toFixed(1),note:''});if(d===today())askYesterday(d);}
function closeMeals(d){const C=compute(),x=C.days[d];if(!x||!x.mealCount)return toast('먼저 식사를 기록해 주세요');if(x.closed)return toast('이미 마감했어요');
 let m=`${d.slice(5)} 식사를 마감할까요?\n합계 ${x.kcal}kcal · 단백질 ${x.prot}g`;if(x.missingKcal)m+=`\n(kcal 안 적은 끼니 ${x.missingKcal}개는 0으로 계산돼요)`;if(x.kcal<1600)m+='\n1,600kcal 미만이면 식단 점수가 없어요.';
 if(confirm(m))add({date:d,type:'meal_close',item:'식사마감',value:'',note:''});}
function askWeight(){const v=prompt('오늘 아침 체중(kg)');if(v&&+v>30)addWeight(today(),v);}
function addWalk(){const v=prompt('걸은 시간(분)','40');if(v&&+v>0)add({date:today(),type:'exercise',item:'걷기',value:String(+v),note:''});}
function quest(C){const qs=questDefs(C),w=week(C.today),sc=C.strW[w]||0,ws=compute().status;
 const wk=raw.filter(e=>e.type==='weight'&&week(e.date)===w);
 return topBar(C)+`<h3>일일 퀘스트</h3>${qs.map(qCard).join('')}<button class="btn g" onclick="add({date:today(),type:'rest',item:'휴식',value:prompt('휴식 이유','통증')||'통증',note:''})">🩹 통증 휴식으로 기록</button>
 <h3>주간 퀘스트 (${w+1}주차, ~${weekEnd(w).slice(5)})</h3>
 ${qCard({ic:'💪',t:'근력 주 2~3회',s:'1회 15분 이상',p:sc,max:2,lab:`${sc} / 2~3회`,xp:100,done:sc>=2})}
 ${qCard({ic:'📉',t:'주간 평균 0.5~1.2kg 감량',s:`주말 정산 · 체중 3일 이상 필요 (지금 ${wk.length}일)`,p:0,max:1,lab:`이전 평균 ${C.lastAvg.toFixed(1)}kg`,xp:100,done:false})}
 ${qCard({ic:'🔥',t:'체중 기록 7일 연속',s:'7일마다 보너스',p:C.streak%7,max:7,lab:`${C.streak} 일`,xp:50,done:false})}
 ${bossCard(C)}`;}
function bossCard(C){const B=C.boss;if(!B){const last=C.bossHist[C.bossHist.length-1];
  return `<div class="card muted">🐉 정체기 보스: 주간 평균이 2주 연속 줄지 않으면 나타나요. (지금 정체 ${C.flatWeeks}주)${last?`<br>지난 보스전: ${last.ok?'클리어! +80 XP':'이번 라운드는 비겼어요'}`:''}</div>`;}
 const live=C.today>=B.start;const it=[[!B.miss,'체중 결근 없음'],[!B.low,'1,600kcal 미만 날 없음'],[B.walkDays>=5,`걷기 40~60분 또는 휴식 ${B.walkDays}/5일`],[B.str>=1,`근력 ${B.str}/1회`],[null,`종료 때 주간 평균 ${B.startAvg.toFixed(1)}kg 아래로`]];
 return `<div class="card" style="border:2px solid #8a63d2"><h3>🐉 정체기 보스 ${live?'전투 중':'예고'}</h3><div class="muted">${B.start.slice(5)} ~ ${B.end.slice(5)} · 클리어 +80 XP · 실패해도 감점 없음 · 굶어서 깨는 건 안 돼요</div>${it.map(([ok,t])=>`<div>${ok===null?'⏳':ok?'✅':'⬜'} ${t}</div>`).join('')}</div>`;}
function chart(C){const pts=C.status.filter(s=>s.weight!=='').map(s=>[dn(s.date),+s.weight]);if(!pts.length)return '';
 const x0=dn(START_DATE),x1=Math.max(dn(C.today),x0+13),lo=Math.min(...pts.map(p=>p[1]),C.pred,settings.month)-1,hi=Math.max(...pts.map(p=>p[1]),START_W)+0.5;
 const X=x=>10+(x-x0)/(x1-x0)*300,Y=y=>10+(hi-y)/(hi-lo)*130;
 const line=(y,c,l)=>y>lo&&y<hi?`<line x1="10" x2="310" y1="${Y(y)}" y2="${Y(y)}" stroke="${c}" stroke-dasharray="4"/><text x="312" y="${Y(y)+4}" font-size="9" fill="${c}">${l}</text>`:'';
 return `<svg viewBox="0 0 340 150" style="width:100%">${line(settings.month,'#f37b72',settings.month+'')}${C.next&&C.next[0]!==settings.month?line(C.next[0],'#8a63d2',C.next[0]+''):''}
 <polyline fill="none" stroke="#5cc79a" stroke-width="2.5" points="${pts.map(p=>X(p[0])+','+Y(p[1])).join(' ')}"/>${pts.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3" fill="#5cc79a"/>`).join('')}
 <circle cx="${X(dn(C.today))}" cy="${Y(C.pred)}" r="4" fill="none" stroke="#e0a000" stroke-width="2"/></svg><div class="muted">초록 실제 · 노란 원 예측 · 점선 목표</div>`;}
function log(C){const T=logDate||C.today,d=C.days[T]||{mealCount:0,kcal:0,prot:0,walk:0,water:0,missingKcal:0};const recent=raw.slice().sort((a,b)=>a.date<b.date?1:-1).slice(0,40);
 const byDate={};C.rows.forEach(r=>{if(r.id)byDate[r.id]=r.xp;});
 const wts=C.status.filter(s=>s.weight!=='').slice(-14);
 return `<div class="card"><h3>새 기록</h3><input type="date" id="dt" value="${T}" max="${C.today}" onchange="logDate=this.value;render()">
 <div class="row"><input id="w" type="number" step="0.1" placeholder="체중 kg"><button class="btn" onclick="sub('weight')">체중</button></div>
 <div class="row"><select id="mealT"><option>아침</option><option>점심</option><option>저녁</option><option>간식</option></select><input id="mealMenu" placeholder="메뉴"></div>
 <div class="row"><input id="kcal" type="number" placeholder="kcal (선택)"><input id="prot" type="number" placeholder="단백질 g (선택)"><button class="btn" onclick="sub('meal')">식사</button></div>
 <div class="row"><select id="exT"><option>걷기</option><option>근력</option></select><input id="min" type="number" placeholder="분"><button class="btn" onclick="sub('exercise')">운동</button></div>
 <div class="row"><input id="wat" type="number" step="0.1" placeholder="물 L"><button class="btn" onclick="sub('water')">물</button></div></div>
 <div class="card"><h3>${T===C.today?'오늘':T.slice(5)} 합계 ${d.closed?'· 마감 ✅':''}</h3>식사 ${d.mealCount}끼 · ${d.kcal}kcal${d.missingKcal?' (kcal 빠진 끼니 '+d.missingKcal+'개)':''} · 단백질 ${d.prot}g
 <div class="bar c" style="margin:6px 0"><i style="width:${Math.min(100,d.kcal/1800*100)}%"></i><span>칼로리 ${d.kcal} / 1,800kcal</span></div><div class="bar" style="margin:6px 0"><i style="width:${Math.min(100,d.prot/130*100)}%"></i><span>단백질 ${d.prot} / 130g</span></div>${d.closed?'':'<div class="muted">미정산</div>'}걷기 ${d.walk}분 · 근력 ${d.strength?'O':'X'} · 물 ${d.water}L${d.rest?' · 휴식':''}
 <div class="muted">목표 1,800kcal 안팎 · 단백질 130g+ · 1,600kcal 미만이면 식단 점수 없음</div>${d.closed?'':`<button class="btn c" style="width:100%;margin-top:8px" onclick="closeMeals('${T}')">🍽️ ${T===C.today?'오늘':T.slice(5)} 식사 마감</button>`}</div>
 <div class="card"><h3>예측 체중</h3><b>${predRange(C)}</b><div class="muted">마감한 날의 먹은 칼로리와 걷기로 계산해요. 가정: 기초대사(Mifflin, 주마다 재계산, 지금 약 ${C.bmr.toLocaleString()}kcal)×1.2 + 운동 (MET−1)×체중×시간(걷기·근력 3.5 MET, 근력 시간 없으면 30분), 7,700kcal≈1kg (건강관리 확인됨). 1,600kcal 미만인 날은 1,600으로 계산해요.</div></div>
 <div class="card"><h3>체중 기록</h3>${chart(C)}<table><tr><th>날짜</th><th>체중</th><th>감량</th></tr>${wts.reverse().map(s=>`<tr><td>${s.date}</td><td>${s.weight}</td><td>${s.lost_kg}</td></tr>`).join('')}</table>
 ${Object.entries(C.weekly).map(([w,W])=>`<div class="muted">${+w+1}주차 평균 ${W.avg?W.avg.toFixed(2)+'kg, 감량 '+W.loss+'kg, +'+W.xp+' XP':'기록 '+W.n+'일 (3일 미만)'}</div>`).join('')}</div>
 <div class="card"><h3>최근 기록</h3><table>${recent.map(e=>`<tr><td>${e.date.slice(5)}</td><td>${e.item}</td><td>${(e.value||'').slice(0,18)}</td><td>${byDate[e.id]??0}XP</td><td onclick="del('${e.id}')">🗑️</td></tr>`).join('')}</table></div>`;}
function sub(t){const d=$('#dt').value||today();
 if(t==='weight'){const v=+$('#w').value;if(v>30)addWeight(d,v);}
 if(t==='meal'){const m=$('#mealMenu').value.trim();if(!m)return toast('메뉴를 적어 주세요');const k=$('#kcal').value,p=$('#prot').value;
  add({date:d,type:'meal',item:$('#mealT').value,value:m,kcal:k,protein_g:p,kcal_source:k?'직접입력':'',note:''});}
 if(t==='exercise'){const m=+$('#min').value;if(m>0)add({date:d,type:'exercise',item:$('#exT').value,value:String(m),note:''});}
 if(t==='water'){const v=+$('#wat').value;if(v>0)add({date:d,type:'water',item:'물',value:String(v),note:''});}}
function ach(C){return topBar(C)+`<div class="card"><h3>단계 목표</h3><div class="muted">주간 평균(3일 이상 기록)으로 판정해요. 기한은 2단계만. 95·86kg은 확정 대기.</div>${LADDER.map(([kg,xp,t],i)=>`<div class="ach ${C.stages[i]?'':'no'}"><div class="ic">${['👣','🎯','📉','💯','🏆','💚'][i]}</div><div style="flex:1"><b>${i+1}단계 ${t}</b><div class="muted">${kg}kg 이하${i===1?' · 2026-12-10까지':''}</div></div><div>${C.stages[i]?C.stages[i].slice(5)+'<br>':''}+${xp}</div></div>`).join('')}</div><div class="card"><h3>업적</h3>${ACH.map(a=>`<div class="ach ${C.got[a[0]]?'':'no'}"><div class="ic">${a[3]}</div><div style="flex:1"><b>${a[0]}</b><div class="muted">${a[1]}</div></div><div>${C.got[a[0]]?C.got[a[0]].slice(5)+'<br>':''}+${a[2]}</div></div>`).join('')}</div>`;}
function me(C){return topBar(C)+(window.DGAuth?DGAuth.accountCard():'')+makeMe(C)+`<div class="card"><h3>내 정보</h3>시작 ${START_W}kg (${START_DATE}) · 현재 ${C.weight.toFixed(1)}kg<br>이번 달 목표 ${settings.month}kg (~12/10) · 장기 목표 ${settings.goal}kg<br>레벨 ${C.level} · 누적 ${C.total} XP · 코인 ${C.coins} · 스트릭 ${C.streak}일
 <div class="row" style="margin-top:8px"><input id="goal" type="number" step="0.5" value="${settings.goal}"><button class="btn" onclick="settings.goal=+$('#goal').value;saveSettings();render()">장기 목표 저장</button></div></div>
 <div class="card"><h3>기록 백업</h3><div class="muted">게임 마스터와 같은 log.csv·status.csv 형식이에요.</div>
 <button class="btn" onclick="exportCsv()">내보내기</button><label class="btn" style="display:inline-block">가져오기 (log.csv)<input type="file" accept=".csv,text/csv" style="display:none" onchange="importCsv(this.files[0])"></label></div>
 <div class="card muted">다이어트 게임 ${VERSION} · 기획서 v3 규칙</div>`;}
// ---------- 나 만들기 (3D 아바타) ----------
const FACEKEY='dg_face_v1';let pvKg=null,meBase=null;
function makeMe(C){const base=meBase??+C.avatarW.toFixed(1),goal=settings.goal,v=pvKg??base,hasFace=!!localStorage.getItem(FACEKEY);
 const lo=86;return `<div class="card" id="makeMe"><h3>🧍 나 만들기</h3>
 <div class="avatar big" id="avatarSlot" data-kg="${v}" data-idle="0.25"><img class="fallback" src="char.png" alt="캐릭터"><div class="avcap" id="pvCap">${pvLabel(base,v)}</div></div>
 <div class="muted" style="text-align:center">손가락으로 좌우로 밀면 돌아가요</div>
 <div class="row"><label class="fld">키(cm)<input type="number" value="${HEIGHT}" disabled></label><label class="fld">현재 체중(kg)<input id="meW" type="number" step="0.1" value="${base}" onchange="setBase(this.value)"></label></div>
 <div class="muted">키는 186cm로 고정이고, 배·허리·팔·다리·볼 두께만 바뀌어요. 홈 아바타는 최근 7일 체중 평균(${C.avatarW.toFixed(1)}kg)을 따라가요.</div>
 <h4 style="margin:12px 0 4px">목표 체형 미리보기</h4>
 <input id="pv" type="range" min="${lo}" max="${Math.max(base,lo+1)}" step="0.5" value="${v}" oninput="previewKg(this.value)" style="padding:0;border:0">
 <div class="row pvbtn"><button class="btn g" onclick="previewKg(${base})">지금 ${base}kg</button><button class="btn g" onclick="previewKg(${goal})">목표 ${goal}kg</button><button class="btn g" onclick="previewKg(86)">86kg</button></div>
 <h4 style="margin:12px 0 4px">얼굴 사진 (선택)</h4>
 <label class="btn" style="display:inline-block">📷 사진 고르기<input type="file" accept="image/*" capture="user" style="display:none" onchange="pickFace(this.files[0])"></label>${hasFace?'<button class="btn g" onclick="delFace()">사진 지우기</button>':''}
 <div class="muted">🔒 사진은 이 폰 안에만 저장돼요. 어디에도 올리지 않아요.</div></div>`;}
function pvLabel(base,v){const d=+(base-v).toFixed(1);return d>0?`지금 ${(+base).toFixed(1)}kg → 미리보기 ${(+v).toFixed(1)}kg (−${d.toFixed(1)}kg)`:`지금 ${(+base).toFixed(1)}kg`;}
function previewKg(v){v=+v;pvKg=v;const base=meBase??+compute().avatarW.toFixed(1);const r=$('#pv');if(r)r.value=v;const c=$('#pvCap');if(c)c.textContent=pvLabel(base,v);
 if(window.DGAvatar)DGAvatar.setWeight(v);}
function setBase(v){v=+v;if(!(v>=40&&v<=250))return;meBase=v;pvKg=v;render();}
function pickFace(file){if(!file)return;const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{
  const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),m=Math.min(img.width,img.height);
  x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,S,S);const url=c.toDataURL('image/jpeg',0.85);
  try{localStorage.setItem(FACEKEY,url);}catch(e){return toast('저장 공간이 부족해요');}
  if(window.DGAvatar)DGAvatar.setFace(url);toast('얼굴을 입혔어요 (폰에만 저장)');render();};
  img.onerror=()=>toast('사진을 읽지 못했어요');img.src=fr.result;};fr.readAsDataURL(file);}
function delFace(){if(!confirm('얼굴 사진을 지울까요?'))return;localStorage.removeItem(FACEKEY);if(window.DGAvatar)DGAvatar.setFace(null);toast('사진을 지웠어요');render();}
// render() 뒤에 아바타 칸에 3D 캔버스를 붙인다 (avatar.js 모듈이 늦게 로드되면 모듈 쪽에서 다시 부름)
window.dgMountAvatar=function(){const el=typeof document!=='undefined'&&document.querySelector('#avatarSlot');if(!el||!window.DGAvatar)return;
 const g=el.dataset.ghost;DGAvatar.mount(el,{kg:+el.dataset.kg,ghostKg:g&&+g<=+el.dataset.kg-0.1?+g:null,idle:+el.dataset.idle});};
// boot() is in index.html after auth.js loads
