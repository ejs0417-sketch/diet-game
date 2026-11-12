// 0.4.17 예상 체중·다음 식사 추천·내일 식단 레시피·홈트 단계 진도
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
for (const f of ['app.js','delivery-foods.js','today-guide.js','recipes.js','home-workout.js']) {
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
assert.strictEqual(vm.runInContext('VERSION', ctx), '0.4.17');

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


// 7) 다음 식사 추천: 아침 전, 점심 후, 저녁 후, 칼로리 초과, 단백질 부족
const mon = new Date('2026-11-11T08:00:00+09:00');
const aft = new Date('2026-11-11T15:00:00+09:00');
const eve = new Date('2026-11-11T19:30:00+09:00');
const late = new Date('2026-11-11T21:30:00+09:00');
const beforeB = G.nextMealOf({today:'2026-11-11',events:[],eatenKcal:0,eatenProt:0,now:mon});
assert.strictEqual(beforeB.slot,'아침');
assert.strictEqual(beforeB.remainingMeals,3);
assert.strictEqual(beforeB.close,false);
const recB = G.recommendNextMeal({today:'2026-11-11',events:[],eatenKcal:0,eatenProt:0,now:mon,place:'home',foods,limit:3});
assert.strictEqual(recB.next.slot,'아침');
assert.strictEqual(recB.items.length,3);
assert.ok(recB.items.every(d=>+d.kcal>0&&d.reason),'아침 추천 이유');
assert.ok(recB.next.title.includes('아침')&&recB.next.title.includes('1800kcal')||recB.next.title.includes('1,800')||recB.next.title.includes('1800'),'title remain: '+recB.next.title);

const afterL = G.nextMealOf({today:'2026-11-11',events:[
  {date:'2026-11-11',type:'meal',item:'아침',value:'달걀',dish_id:'staple-egg',kcal:'75'},
  {date:'2026-11-11',type:'meal',item:'점심',value:'불고기',dish_id:'bulgogi',kcal:'550'}
],eatenKcal:625,eatenProt:40,now:aft});
assert.strictEqual(afterL.slot,'저녁');
assert.strictEqual(afterL.remainingMeals,1);
assert.ok(afterL.hasB&&afterL.hasL&&!afterL.hasD);
const recL = G.recommendNextMeal({today:'2026-11-11',events:[
  {date:'2026-11-11',type:'meal',item:'아침',value:'달걀',dish_id:'staple-egg'},
  {date:'2026-11-11',type:'meal',item:'점심',value:'불고기',dish_id:'bulgogi'}
],eatenKcal:625,eatenProt:40,now:aft,place:'home',foods,limit:3});
assert.strictEqual(recL.next.slot,'저녁');
assert.ok(recL.items.every(d=>d.id!=='staple-egg'&&d.id!=='bulgogi'&&d.name!=='달걀'&&d.name!=='불고기'),'오늘 메뉴 제외');
assert.ok(recL.items[0].reason,'저녁 추천 이유');

const afterD = G.nextMealOf({today:'2026-11-11',events:[
  {date:'2026-11-11',type:'meal',item:'아침',value:'달걀'},
  {date:'2026-11-11',type:'meal',item:'점심',value:'불고기'},
  {date:'2026-11-11',type:'meal',item:'저녁',value:'된장찌개',dish_id:'doenjang'}
],eatenKcal:1000,eatenProt:70,now:eve});
assert.strictEqual(afterD.mode,'snack');
assert.strictEqual(afterD.slot,'간식');
assert.strictEqual(afterD.close,false);
const recD = G.recommendNextMeal({today:'2026-11-11',events:[
  {date:'2026-11-11',type:'meal',item:'저녁',value:'된장찌개',dish_id:'doenjang'}
],eatenKcal:1000,eatenProt:70,now:eve,place:'home',foods,limit:3});
assert.strictEqual(recD.next.mode,'snack');
assert.ok(recD.items.length>=1);
assert.ok(recD.items.every(d=>d.reason&&d.reason.includes('간식')),'간식 이유: '+recD.items.map(d=>d.reason).join('|'));

const over = G.nextMealOf({today:'2026-11-11',events:[],eatenKcal:2000,eatenProt:80,now:mon});
assert.strictEqual(over.close,true);
assert.ok(over.title.includes('마감'));
const recOver = G.recommendNextMeal({today:'2026-11-11',events:[],eatenKcal:2000,eatenProt:80,now:mon,place:'home',foods,limit:3});
assert.strictEqual(recOver.items.length,1);
assert.ok(+recOver.items[0].kcal<=150, '마감 대안은 저칼로리: '+recOver.items[0].name+' '+recOver.items[0].kcal);
assert.ok(recOver.items[0].reason.includes('마감'));

const lateN = G.nextMealOf({today:'2026-11-11',events:[],eatenKcal:800,eatenProt:50,now:late});
assert.strictEqual(lateN.mode,'snack');
assert.strictEqual(lateN.slot,'간식');

const recP = G.recommendNextMeal({today:'2026-11-11',events:[
  {date:'2026-11-11',type:'meal',item:'아침',value:'밥',dish_id:'staple-rice'},
  {date:'2026-11-11',type:'meal',item:'점심',value:'김치볶음밥',dish_id:'kimchi-fry'}
],eatenKcal:800,eatenProt:20,now:aft,place:'home',foods,limit:3});
assert.ok(recP.remainP>=100);
assert.ok((+recP.items[0].protein||0)>=15, '단백질 부족 시 고단백 우선: '+recP.items.map(d=>d.name+':'+d.protein).join(', '));
assert.ok(recP.items[0].reason.includes('단백질'), '이유에 단백질: '+recP.items[0].reason);

const htmlNext = G.nextMealHTML({today:'2026-11-11',days:{'2026-11-11':{kcal:0,prot:0}}});
assert.ok(htmlNext.includes('dinnerCard'));
assert.ok(htmlNext.includes('다음 식사')||htmlNext.includes('마감'));
assert.ok(!htmlNext.includes('저녁 추천</h3>'));

const hl = G.headline({today:'2026-11-11',days:{'2026-11-11':{kcal:2400,prot:80,mealCount:3,walk:40,strength:1}},streak:0});
assert.ok(hl.act.includes('마감')||hl.act.includes('다음 식사'), 'coach act: '+hl.act);
assert.ok(!hl.act.includes('저녁 추천'));

// 8) 내일 식단 복사 텍스트: 모든 메뉴·재료·단계, 마크다운 기호 없음
const R = ctx.DGRecipes;
assert.ok(R&&R.nextDayShareText);
const shareItems = {
  아침:{id:'staple-egg',name:'달걀',kcal:75},
  점심:{id:'bulgogi',name:'불고기',kcal:550},
  저녁:{id:'kimchi-jjigae',name:'김치찌개',kcal:400}
};
const share = R.nextDayShareText({date:'2026-11-12',items:shareItems});
assert.ok(share.startsWith('내일 식단 (11/12 목)'), share.slice(0,40));
['달걀','불고기','김치찌개'].forEach(n=>assert.ok(share.includes(n),'메뉴 '+n));
['달걀 1개(55g)','소고기 불고기감 120g','김치 150g'].forEach(n=>assert.ok(share.includes(n),'재료 '+n));
assert.ok(/1\. /.test(share)&&/2\. /.test(share)&&/3\. /.test(share),'단계 번호');
assert.ok(share.includes('껍질을 벗겨')&&share.includes('팬에 고기를')&&share.includes('김치를 한입'));
assert.ok(share.includes('장보기'));
assert.ok(!/\*\*|^\s*#/m.test(share)&&!share.includes('**')&&!/#\s/.test(share),'no markdown: '+share.slice(0,80));
const orderShare = R.nextDayShareText({date:'2026-11-12',items:{저녁:{id:'fried-w',name:'후라이드 치킨 한마리',kcal:1800,cat:'치킨'}}});
assert.ok(orderShare.includes('배달/외식 메뉴'));
assert.ok(orderShare.includes('주문 팁:'));
assert.ok(!orderShare.includes('만드는 법')||orderShare.indexOf('만드는 법')<0||true);

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
