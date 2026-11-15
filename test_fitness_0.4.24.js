// 0.4.24 헬스 계획 검증: 주차·날짜 매칭, 칼로리(MET×체중×시간), XP(항목·하루 완료·연속), 시드 65XP·Lv.1 유지
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function boot(){
  const store={};
  const localStorage={getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
  const ctx={console,Date,Math,JSON,Object,Array,String,Number,Boolean,Set,Map,RegExp,parseInt,parseFloat,isNaN,isFinite,Infinity,undefined,NaN,
    Intl,Error,TypeError,URL,Promise,localStorage,
    document:{body:{},createElement(){return {style:{},appendChild(){}};},addEventListener(){},getElementById(){return null;},querySelector(){return null;}},
    window:{},navigator:{serviceWorker:null,onLine:true},location:{pathname:'/',origin:'http://127.0.0.1',search:'',hash:'',href:'http://127.0.0.1/'},
    history:{replaceState(){}},setTimeout,clearTimeout,setInterval,clearInterval};
  ctx.window=ctx;ctx.globalThis=ctx;ctx.self=ctx;vm.createContext(ctx);
  for(const f of ['app.js','today-guide.js','fitness-plan.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+f,'utf8'),ctx,{filename:f});
  ctx.ensureSeed();return ctx;
}
let ctx=boot();const F=ctx.DGFitness;
assert.strictEqual(vm.runInContext('VERSION',ctx),'0.4.24');
// 1) 시드 XP 그대로
let C=ctx.compute('2026-11-11');
assert.strictEqual(C.total,65,'seed XP '+C.total);assert.strictEqual(C.level,1);
// 2) 주차·날짜
const W=[['2026-11-16',0],['2026-11-17',1],['2026-11-23',1],['2026-11-24',2],['2026-11-30',2],['2026-12-01',3],['2026-12-07',3],['2026-12-08',4],['2026-12-16',4],['2026-12-17',0]];
for(const [d,n] of W)assert.strictEqual(F.weekNo(d),n,d);
assert.strictEqual(F.planFor('2026-11-17').dow,2);           // 11/17은 화요일
assert.strictEqual(F.planFor('2026-11-22').rest,true);       // 일
assert.strictEqual(F.planFor('2026-12-08').label,'하체 날');  // 화
assert.strictEqual(F.planFor('2026-12-09').label,'상체 날');  // 수
assert.ok(F.planFor('2026-12-08').items.some(i=>i.id==='legpress'));
assert.ok(!F.planFor('2026-12-09').items.some(i=>i.id==='legpress'));
// 주차별 시간·목표 kcal(113kg) 범위 확인
const mins=[],kcals=[];
for(const d of ['2026-11-17','2026-11-24','2026-12-01','2026-12-08','2026-12-09']){const p=F.planFor(d);mins.push(p.min);kcals.push(Math.round(F.planKcal(p,113)));}
assert.ok(mins[0]>=75&&mins[0]<=90,'w1 min '+mins[0]);assert.strictEqual(mins[1],100);assert.strictEqual(mins[2],120);assert.strictEqual(mins[3],120);assert.strictEqual(mins[4],120);
assert.ok(kcals[0]>=600&&kcals[0]<=750,'w1 '+kcals[0]);assert.ok(kcals[1]>=800&&kcals[1]<=900,'w2 '+kcals[1]);
assert.ok(kcals[2]>=1000&&kcals[2]<=1100,'w3 '+kcals[2]);assert.ok(kcals[3]>=1100&&kcals[3]<=1200,'w4u '+kcals[3]);assert.ok(kcals[4]>=1100&&kcals[4]<=1200,'w4l '+kcals[4]);
// 3) 칼로리 공식 MET×체중×시간
assert.strictEqual(F.kcalOf(5,113,60),565);
assert.strictEqual(Math.round(F.kcalOf(5.5,100,30)),275);
assert.strictEqual(F.kcalOf(5,0,60),565,'체중 없으면 113');
// 4) 기록 → 소모 kcal·XP (체중 기록 없으면 113)
ctx=boot();vm.runInContext('globalThis.__push=e=>raw.push(withId(e))',ctx);
const add=(d,id,min)=>{const it=ctx.DGFitness.itemOf(d,id);ctx.__push(({date:d,type:'gym',item:id,value:String(min??it.min),met:String(it.met),note:it.name}));};
const d1='2026-11-17';
const base=ctx.compute(d1).total;
add(d1,'cardio',60);   // 실제 60분으로 수정한 경우
C=ctx.compute(d1);
assert.strictEqual(C.days[d1].gymKcal,Math.round(5*113*1),'cardio kcal '+C.days[d1].gymKcal);
assert.strictEqual(C.total-base,5,'item xp');
assert.strictEqual(C.days[d1].gymDone,false);
// 체중 기록이 있으면 그 체중
ctx.__push(({date:d1,type:'weight',item:'체중',value:'110.0',note:''}));
vm.runInContext("raw.sort((a,b)=>a.type==='weight'?-1:b.type==='weight'?1:0)",ctx);
C=ctx.compute(d1);
assert.strictEqual(C.days[d1].gymKcal,Math.round(5*110),'uses latest weight');
// 하루 전체 완료
for(const it of ctx.DGFitness.planFor(d1).items)if(it.id!=='cardio')add(d1,it.id);
C=ctx.compute(d1);
assert.strictEqual(C.days[d1].gymDone,true);
const gymXp=C.rows.filter(r=>r.date===d1&&r.type==='gym').reduce((s,r)=>s+r.xp,0);
assert.strictEqual(gymXp,7*5+20,'day xp '+gymXp);
// 예상 체중 계산에는 순증분(MET-1) 반영
assert.ok(C.days[d1].gymNet>0&&C.days[d1].gymNet<C.days[d1].gymKcal);
// 일일 퀘스트 운동 칸이 헬스 완료로 채워짐
assert.strictEqual(C.days[d1].q[2],true);
// 5) 연속 보너스: 11/17~11/19 3일 완료 → 3일째 +10, 일요일은 연속 안 끊음
for(const d of ['2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-23'])for(const it of ctx.DGFitness.planFor(d).items)add(d,it.id);
C=ctx.compute('2026-11-23');
const st=d=>C.rows.filter(r=>r.date===d&&r.item==='헬스연속').reduce((s,r)=>s+r.xp,0);
assert.strictEqual(st('2026-11-18'),0);assert.strictEqual(st('2026-11-19'),10);assert.strictEqual(st('2026-11-21'),10);
assert.strictEqual(C.days['2026-11-23'].gymStreak,6,'sunday keeps streak');assert.strictEqual(st('2026-11-23'),20);
// 하루 빠지면 끊김
for(const it of ctx.DGFitness.planFor('2026-11-25').items)add('2026-11-25',it.id);
C=ctx.compute('2026-11-25');
assert.strictEqual(C.days['2026-11-25'].gymStreak,1,'missed 11/24 resets');
// 오늘 아직 안 했으면 끊지 않음
C=ctx.compute('2026-11-24');assert.strictEqual(C.days['2026-11-24'].gymStreak,6);
// 시드 날짜는 여전히 65
assert.strictEqual(ctx.compute('2026-11-11').total,65);
// 6) 화면 HTML 생성
assert.ok(F.todayCardHTML({today:'2026-11-17',weight:113,days:{},rows:[]}).includes('오늘의 운동'));
assert.ok(F.todayCardHTML({today:'2026-11-16',weight:113,days:{},rows:[]}).includes('시작'));
console.log('fitness tests ok',{w1:kcals[0],w2:kcals[1],w3:kcals[2],w4:[kcals[3],kcals[4]],mins,seed:ctx.compute('2026-11-11').total});
