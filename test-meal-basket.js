// 0.4.11 한 끼 여러 메뉴: 슬롯 목록·합계, 저장 형식·XP 호환
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

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
  document: { body: {}, createElement(){return {style:{},appendChild(){}};}, addEventListener(){}, getElementById(){return null;}, querySelector(){return null;}, querySelectorAll(){return [];} },
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
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'), ctx, {filename:'app.js'});
ctx.ensureSeed();

const lunch = ctx.mealsForSlot('2026-11-11','점심');
assert.ok(lunch.length>=1, '시드 점심이 있어야 함');
assert.ok(lunch.some(e=>/율민샐러드/.test(e.value||'')), '시드 율민샐러드 유지');
assert.ok(lunch.every(e=>e.type==='meal'&&e.item==='점심'&&e.date==='2026-11-11'));

const base = ctx.compute('2026-11-11');
assert.strictEqual(base.total, 65);
assert.strictEqual(base.level, 1);

// 같은 점심 슬롯에 메뉴를 더 넣어도 슬롯 XP는 한 번만(+5), 합계 65 유지
ctx._tmp={date:'2026-11-11',type:'meal',item:'점심',value:'봉구스 밥버거',kcal:'545',protein_g:'14'};
vm.runInContext('raw.push(withId(_tmp))', ctx);
const afterSameSlot = ctx.compute('2026-11-11');
assert.strictEqual(afterSameSlot.total, 65, '같은 끼니 추가 메뉴는 XP가 늘면 안 됨, got '+afterSameSlot.total);
assert.strictEqual(ctx.mealsForSlot('2026-11-11','점심').length, lunch.length+1);

const dinners = [
  {date:'2026-11-11',type:'meal',item:'저녁',value:'봉구스 햄치즈 밥버거',kcal:'698',protein_g:'25'},
  {date:'2026-11-11',type:'meal',item:'저녁',value:'빼빼로 오리지널',kcal:'270',protein_g:''},
  {date:'2026-11-11',type:'meal',item:'저녁',value:'빼빼로 아몬드',kcal:'200',protein_g:''}
];
dinners.forEach(e=>{ctx._tmp=e;vm.runInContext('raw.push(withId(_tmp))', ctx);});
const rows = ctx.mealsForSlot('2026-11-11','저녁');
assert.strictEqual(rows.length, 3);
const sum = ctx.slotMealSum(rows);
assert.strictEqual(sum.kcal, 698+270+200);
assert.ok(rows.every(e=>e.type==='meal'&&e.item==='저녁'&&e.date==='2026-11-11'&&e.value));

const withDinner = ctx.compute('2026-11-11');
assert.strictEqual(withDinner.total, 70, '저녁 첫 기록만 +5여야 함, got '+withDinner.total);
assert.strictEqual(withDinner.level, 1);

// 항목 삭제 후 목록·합계만 줄고, 남은 저녁이 있으면 슬롯 XP는 유지
const dropId = rows[0].id;
ctx._dropId=dropId;vm.runInContext('raw=raw.filter(e=>e.id!==_dropId)', ctx);
const afterDel = ctx.mealsForSlot('2026-11-11','저녁');
assert.strictEqual(afterDel.length, 2);
assert.strictEqual(ctx.slotMealSum(afterDel).kcal, 270+200);
assert.strictEqual(ctx.compute('2026-11-11').total, 70);
assert.ok(ctx.mealsForSlot('2026-11-11','점심').some(e=>/율민샐러드/.test(e.value||'')));

const html = ctx.mealBasketHTML('2026-11-11','저녁');
assert.ok(/2개/.test(html) && /470kcal/.test(html), html);
assert.ok(/빼빼로 오리지널/.test(html) && /빼빼로 아몬드/.test(html));
assert.ok(!/햄치즈/.test(html));
assert.ok(/removeSlotMeal\(/.test(html));

console.log('meal basket tests ok', {lunch:ctx.mealsForSlot('2026-11-11','점심').length, dinner:afterDel.length, xp:ctx.compute('2026-11-11').total});
