// 0.4.15 예상 체중·저녁 추천·홈트 단계 진도
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const ctx = {
  console, Date, Math, JSON, Object, Array, String, Number, Boolean, Set, Map,
  RegExp, parseInt, parseFloat, isNaN, isFinite, Infinity, undefined, NaN,
  Intl, Error, TypeError, URL, Promise, localStorage,
  document: { body: {appendChild(){}}, createElement(){return {style:{},appendChild(){},remove(){}};}, addEventListener(){}, getElementById(){return null;} },
  window: {}, globalThis: null, navigator: {serviceWorker:null, onLine:true},
  location: {pathname:'/', origin:'http://127.0.0.1', search:'', hash:'', href:'http://127.0.0.1/'},
  history: {replaceState(){}},
  setTimeout, clearTimeout, setInterval, clearInterval
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.self = ctx;
ctx.root = ctx;
vm.createContext(ctx);
for (const f of ['app.js','delivery-foods.js','today-guide.js','home-workout.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'), ctx, {filename:f});
}
ctx.ensureSeed();

const G = ctx.DGGuide;
const W = ctx.DGWorkout;
assert.ok(G && W, 'DGGuide/DGWorkout 로드');

// 1) Mifflin + 오늘 예상 체중 (남성 186cm 113kg, 2026-11-11 만 38세, ACT 1.2)
const age = G.ageFromBirth('1988-02-25','2026-11-11');
assert.strictEqual(age, 38);
const bmr = G.mifflinBmr(113, 186, 38, 'm');
assert.strictEqual(bmr, 2107.5);
const f = G.forecastWeight({
  weight:113, eatenKcal:1800, exerciseKcal:0, date:'2026-11-11',
  settings:{heightCm:186, birth:'1988-02-25', sex:'m', activity:1.2}, fallback:false
});
assert.ok(f.ok && f.estimate);
assert.strictEqual(f.bmr, 2107.5);
assert.strictEqual(f.tdee, 2529);
assert.ok(Math.abs(f.day - (-729/7700)) < 1e-9, 'day kg '+f.day);
assert.ok(Math.abs(f.month - 30*(-729/7700)) < 1e-9);

// 운동 소모를 빼는지
const f2 = G.forecastWeight({
  weight:113, eatenKcal:1800, exerciseKcal:200, date:'2026-11-11',
  settings:{heightCm:186, birth:'1988-02-25', sex:'m', activity:1.2}, fallback:false
});
assert.ok(Math.abs(f2.day - ((1800-2529-200)/7700)) < 1e-9);

// 2) 프로필 없으면 안내 (fallback 끄기)
const miss = G.forecastWeight({weight:113, eatenKcal:1800, settings:{}, fallback:false});
assert.strictEqual(miss.ok, false);
assert.strictEqual(miss.needProfile, true);
const html = G.forecastHTML({today:'2026-11-11', weight:113, days:{'2026-11-11':{kcal:0}}});
// 브라우저 전역 settings는 시드만 있고 height 없을 수 있으나 fallback 기본은 게임 상수
assert.ok(html.includes('추정치') || html.includes('내정보에'), 'forecast HTML');

// 게임 상수 fallback으로도 계산됨
const fb = G.forecastWeight({weight:113, eatenKcal:1800, date:'2026-11-11', settings:{}, fallback:true});
assert.ok(fb.ok, 'fallback profile ok');
assert.strictEqual(Math.round(fb.tdee), 2529);

// 3) 저녁 추천: 집밥은 한식 쪽, 배달은 브랜드, 공식 kcal만, 한마리 큰 단위는 예산 적을 때 후순위
const foods = ctx.DGFoods.FOODS;
assert.strictEqual(foods.length, 301);
const homeRec = G.recommendDinner({foods, eatenKcal:1000, eatenProt:40, place:'home', limit:3});
assert.strictEqual(homeRec.items.length, 3);
homeRec.items.forEach(d => {
  assert.ok(+d.kcal > 0, '추천 kcal 공식값');
});
const homeCats = homeRec.items.map(d => (d.cat||'')+' '+(d.brand||'')+' '+(d.name||''));
assert.ok(homeRec.items.every(d => !d.brand), '집밥 추천은 브랜드보다 일반 한식을 우선: '+homeCats.join(' | '));

const delivRec = G.recommendDinner({foods, eatenKcal:400, eatenProt:20, place:'delivery', limit:3});
assert.strictEqual(delivRec.items.length, 3);
assert.ok(delivRec.items.some(d => d.brand || /치킨|피자|버거|중식|족발/.test(d.cat||'')), '배달 추천은 브랜드/배달 카테고리');

const tight = G.recommendDinner({foods, eatenKcal:1400, eatenProt:80, place:'home', budget:1800, limit:5});
assert.ok(tight.items.every(d => d.unit !== '한마리' && d.unit !== '1판' && d.unit !== '1팩(L)'),
  '남은 칼로리가 적을 때 한마리/1판은 빼기: '+tight.items.map(d=>d.name+d.unit).join(','));

// 4) 홈트 단계 해금·내리기
vm.runInContext('settings.hw={stage:1,unlocked:1,done:{}}', ctx);
assert.strictEqual(W.state().stage, 1);
assert.strictEqual(W.state().unlocked, 1);
W.registerComplete(1);
W.registerComplete(1);
assert.strictEqual(W.state().unlocked, 1);
assert.strictEqual(W.state().stage, 1);
W.registerComplete(1);
assert.ok(W.canUnlock(1));
assert.strictEqual(W.state().unlocked, 2);
assert.strictEqual(W.state().stage, 2, '3회 완료 후 다음 단계로');
W.stepDown();
assert.strictEqual(W.state().stage, 1);
assert.strictEqual(W.state().unlocked, 2, '내려도 해금은 유지');
W.stepDown();
assert.strictEqual(W.state().stage, 1, '1단계 아래로 안 내려감');
W.setStage(5);
assert.strictEqual(W.state().stage, 2, '해금 안 된 단계는 못 감');
assert.strictEqual(vm.runInContext('VERSION', ctx), '0.4.15');

const st1 = W.stageOf(1);
assert.ok(st1.moves.length >= 4);
assert.ok(W.sessionMinutes(st1) > 0);
assert.ok(W.sessionKcal(st1, 113) > 0);
// MET 주석 값 사용: 제자리걷기 3.5
assert.strictEqual(W.MET.walk, 3.5);
assert.strictEqual(W.MET.squat, 5.0);
assert.strictEqual(W.MET.pushHard, 8.0);
assert.strictEqual(W.MET.plank, 4.0);

// 5) 하루 단위 예상: +10/+20분, 30일 문구 없음, 누적 트레일
const plus10=G.walkExtraKg(113,10), plus20=G.walkExtraKg(113,20);
assert.ok(Math.abs(plus10 - (-((3.5-1)*113*10/60)/7700))<1e-9, 'walk +10min kg');
assert.ok(Math.abs(plus20 - 2*plus10)<1e-9, 'walk +20min is 2x');
const htmlDay=G.forecastHTML({today:'2026-11-11', weight:113, days:{'2026-11-11':{kcal:1800,walk:0,strMin:0}}});
assert.ok(htmlDay.includes('오늘') && htmlDay.includes('추정치'), 'daily forecast html');
assert.ok(!/30일|한달|1주/.test(htmlDay), 'no 30-day or weekly projection in UI: '+htmlDay.slice(0,200));
assert.ok(htmlDay.includes('+10분') && htmlDay.includes('+20분'), 'extra walk lines');

const C0=ctx.compute('2026-11-11');
const tr=G.forecastTrail({C:C0, days:C0.days, today:'2026-11-11', settings:{heightCm:186,birth:'1988-02-25',sex:'m',activity:1.2}, fallback:false});
assert.ok(tr.ok && tr.pts.length>=2, 'trail points');
const d0=tr.pts.find(p=>p.date==='2026-11-10');
const d1=tr.pts.find(p=>p.date==='2026-11-11');
assert.ok(d0 && d0.actual===113, 'seed weight on start day');
assert.ok(d1 && d1.logged, 'lunch day is logged');
assert.ok(d1.body!==d0.body, 'body kg changes the next logged day');
assert.ok(Math.abs(tr.bodyKg-d1.body)<1e-9);

// 6) 내일 식단: 오늘 먹은 것과 중복 없음, 교체 가능
const evToday=[{date:'2026-11-11',type:'meal',item:'점심',value:'우유',dish_id:'staple-milk',kcal:'125'}];
const nd=G.recommendNextDay({today:'2026-11-11',events:evToday,place:'home',date:'2026-11-12'});
assert.ok(nd.items.아침&&nd.items.점심&&nd.items.저녁, 'three slots');
assert.notStrictEqual(nd.items.아침.id,'staple-milk');
assert.notStrictEqual(nd.items.점심.id,'staple-milk');
assert.notStrictEqual(nd.items.저녁.id,'staple-milk');
const names=Object.values(nd.items).map(d=>d.name);
assert.ok(!names.includes('우유'), '오늘 우유 제외: '+names.join(','));
assert.strictEqual(nd.date,'2026-11-12');
const ids=new Set(Object.values(nd.items).map(d=>d.id));
assert.strictEqual(ids.size,3, '세 끼 서로 다른 메뉴');

// XP 공식은 그대로
const C = ctx.compute('2026-11-11');
assert.strictEqual(C.total, 65);
assert.strictEqual(C.level, 1);

console.log('today-guide/workout tests ok', {
  day: f.day.toFixed(4), month: f.month.toFixed(2), tdee: f.tdee,
  home: homeRec.items.map(d=>d.name),
  delivery: delivRec.items.map(d=>d.name),
  hw: W.state()
});
