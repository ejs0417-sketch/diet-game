// 0.4.17 사진 인식: 음식 표 매칭, 공식 영양만 사용, AI kcal 무시
const assert=require('assert');
const vm=require('vm');
const fs=require('fs');
const path=require('path');
const ctx={console,window:{},module:{exports:{}},globalThis:null};
ctx.globalThis=ctx;
ctx.window=ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'delivery-foods.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'food-search.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'photo-meal.js'),'utf8'),ctx);
const PM=ctx.DGFoods&&ctx.DGPhotoMeal?ctx.DGPhotoMeal:ctx.DGPhotoMeal;
assert.ok(PM,'DGPhotoMeal');
const foods=ctx.DGFoods.FOODS;

function idOf(q){const m=PM.matchDish(q);return m.food&&m.food.id;}

// 점심 사진에 나올 법한 이름
assert.strictEqual(idOf('쌀밥'),'rice','쌀밥은 공기밥(1인분)으로');
assert.strictEqual(idOf('공기밥'),'rice');
assert.strictEqual(idOf('흰밥'),'rice');
assert.strictEqual(idOf('된장찌개'),'doenjang');
assert.strictEqual(idOf('애호박 두부 된장찌개'),'doenjang','재료가 붙은 된장찌개');
assert.strictEqual(idOf('김치찌개'),'kimchi-jjigae');

// 조리법이 다른 반찬은 날것의 달걀·두부에 자동 매칭하면 안 됨
const egg=PM.matchDish('달걀전');
assert.ok(!egg.food,'달걀전은 표에 없으면 자동 매칭 금지 (초성으로 닭강정에 붙으면 안 됨)');
assert.ok(!(egg.candidates||[]).some(c=>/치킨|닭강정/.test(c.name)),'달걀전 후보에 치킨이 들어가면 안 됨');
const tofu=PM.matchDish('두부조림');
assert.ok(!tofu.food || tofu.food.id!=='staple-tofu','두부조림을 생두부로 자동 매칭하면 안 됨');
const quail=PM.matchDish('메추리알 장조림');
assert.ok(!quail.food,'메추리알 장조림은 표에 없으면 자동 매칭 금지');
const kimchi=PM.matchDish('배추김치');
assert.ok(!kimchi.food || kimchi.food.id!=='kimchi-jjigae','배추김치를 김치찌개로 매칭하면 안 됨');

// 후보에는 가까운 메뉴가 있어야 함
assert.ok((egg.candidates||[]).length>=1 || egg.status!=='match','달걀전 후보');

// AI가 kcal를 넣어도 버리고, 영양은 음식 표만
const dirty={dishes:[
  {name:'쌀밥',portion:'보통',kcal:9999,protein:99,calories:888},
  {name:'된장찌개',portion:'조금',kcal:1},
  {name:'달걀전',portion:'많이',kcal:5000}
]};
const clean=PM.sanitizeDishes(dirty);
assert.deepStrictEqual(clean.map(d=>Object.keys(d).sort()),clean.map(()=>['name','portion'].sort()));
assert.ok(clean.every(d=>d.kcal==null&&d.calories==null));
const rows=PM.matchDishes(dirty);
const rice=rows[0];
assert.strictEqual(rice.food.id,'rice');
assert.strictEqual(rice.portionMul,1);
const nu=PM.nutritionOf(rice.food,rice.portionMul);
const riceFood=foods.find(f=>f.id==='rice');
assert.strictEqual(nu.kcal,Math.round(riceFood.kcal));
assert.notStrictEqual(nu.kcal,9999);
const dj=rows[1];
assert.strictEqual(dj.food.id,'doenjang');
assert.strictEqual(dj.portionMul,0.5);
const nu2=PM.nutritionOf(dj.food,0.5);
assert.strictEqual(nu2.kcal,Math.round(foods.find(f=>f.id==='doenjang').kcal*0.5));
// 조금=0.5, 보통=1, 많이=1.5
assert.strictEqual(PM.nutritionOf(riceFood,0.5).kcal,Math.round(riceFood.kcal*0.5));
assert.strictEqual(PM.nutritionOf(riceFood,1.5).kcal,Math.round(riceFood.kcal*1.5));

const tot=PM.totals(rows.filter(r=>r.food),'');
assert.strictEqual(tot.kcal,nu.kcal+nu2.kcal);
assert.ok(tot.kcal<9999);

// 프록시 URL에 키가 없고 github.io 공개 저장소 값을 쓰지 않음
assert.ok(/^https:\/\/52-79-146-61\.sslip\.io\//.test(PM.PROXY_URL));
assert.ok(!/AIza|GEMINI|api[_-]?key/i.test(fs.readFileSync(path.join(__dirname,'photo-meal.js'),'utf8')));
assert.ok(!/AIza|GEMINI_API_KEY/.test(fs.readFileSync(path.join(__dirname,'app.js'),'utf8')));

console.log('photo-meal tests ok',{
  rice:idOf('쌀밥'),
  stew:idOf('애호박 두부 된장찌개'),
  eggStatus:egg.status,
  tofuStatus:tofu.status,
  kimchiStatus:kimchi.status,
  tot:tot.kcal
});
