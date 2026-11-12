// 0.4.19 사진 인식: 음식 표 매칭, 공식 영양만 사용, AI kcal 무시
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
assert.strictEqual(egg.food&&egg.food.id,'side-egg-jeon','달걀전은 공식 달걀전 항목');
assert.ok(egg.food.id!=='staple-egg');
assert.ok(!(egg.candidates||[]).some(c=>/치킨|닭강정/.test(c.name)),'달걀전 후보에 치킨이 들어가면 안 됨');
assert.strictEqual(idOf('계란전'),'side-egg-jeon');
const tofu=PM.matchDish('두부조림');
assert.strictEqual(tofu.food&&tofu.food.id,'side-tofu-jorim');
assert.ok(tofu.food.id!=='staple-tofu','두부조림을 생두부로 매칭하면 안 됨');
const quail=PM.matchDish('메추리알 장조림');
assert.ok(!quail.food,'메추리알 장조림은 공식 값이 없어 자동 매칭 금지');
const kimchi=PM.matchDish('배추김치');
assert.strictEqual(kimchi.food&&kimchi.food.id,'side-baechu-kimchi');
assert.ok(kimchi.food.id!=='kimchi-jjigae','배추김치를 김치찌개로 매칭하면 안 됨');
assert.strictEqual(idOf('깍두기'),'side-kkakdugi');
assert.strictEqual(idOf('고등어구이'),'side-mackerel');
assert.strictEqual(idOf('멸치볶음'),'side-anchovy');
assert.strictEqual(idOf('시금치나물'),'side-spinach-namul');
assert.strictEqual(idOf('미역국'),'side-miyeokguk');

// 후보에는 가까운 메뉴가 있어야 함

// AI가 kcal를 넣어도 버리고, 영양은 음식 표만
const dirty={dishes:[
  {name:'쌀밥',portion:'보통',kcal:9999,protein:99,calories:888},
  {name:'된장찌개',portion:'조금',kcal:1},
  {name:'달걀전',portion:'많이',kcal:5000}
]};
const clean=PM.sanitizeDishes(dirty);
assert.deepStrictEqual(clean.map(d=>Object.keys(d).sort()),clean.map(()=>['name','portion','qty'].sort()));
assert.ok(clean.every(d=>d.kcal==null&&d.calories==null&&d.protein==null&&d.qty===1));
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
const eggRow=rows[2];
assert.strictEqual(eggRow.food.id,'side-egg-jeon');
const nu3=PM.nutritionOf(eggRow.food,1.5);
assert.strictEqual(nu3.kcal,Math.round(foods.find(f=>f.id==='side-egg-jeon').kcal*1.5));
assert.strictEqual(tot.kcal,nu.kcal+nu2.kcal+nu3.kcal);
assert.ok(tot.kcal<9999);
assert.notStrictEqual(nu3.kcal,5000);



// 0.4.19 끼니: 사진 EXIF(서울) 우선, 현재 시각(밤에 야식)은 쓰지 않음
assert.strictEqual(PM.suggestMealSlotAt(new Date('2026-11-12T12:24:59+09:00')),'점심');
assert.strictEqual(PM.suggestMealSlotAt(new Date('2026-11-12T22:07:00+09:00')),'야식');
assert.strictEqual(PM.suggestMealSlotAt(new Date('2026-11-12T08:10:00+09:00')),'아침');
assert.strictEqual(PM.suggestMealSlotAt(new Date('2026-11-12T16:00:00+09:00')),'간식');
assert.strictEqual(PM.suggestMealSlotAt(new Date('2026-11-12T18:30:00+09:00')),'저녁');
assert.strictEqual(PM.suggestMealSlotAt(new Date('2026-11-12T20:59:00+09:00')),'저녁');
assert.strictEqual(PM.suggestMealSlotAt(new Date('2026-11-12T21:00:00+09:00')),'야식');
const exifJpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/4QCcRXhpZgAATU0AKgAAAAgAAgEyAAIAAAAUAAAAJodpAAQAAAABAAAAOgAAAAAyMDI2OjExOjEyIDEyOjI0OjU5AAADkAMAAgAAABQAAABkkAQAAgAAABQAAAB4kBEAAgAAAAcAAACMAAAAADIwMjY6MTE6MTIgMTI6MjQ6NTkAMjAyNjoxMToxMiAxMjoyNDo1OQArMDk6MDAAAP/bAEMABQMEBAQDBQQEBAUFBQYHDAgHBwcHDwsLCQwRDxISEQ8RERMWHBcTFBoVEREYIRgaHR0fHx8TFyIkIh4kHB4fHv/bAEMBBQUFBwYHDggIDh4UERQeHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHv/AABEIABAAEAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AMSiiivz8/ZT/9k=','base64');
const exifDate=PM.parseJpegExifDate(new Uint8Array(exifJpeg));
assert.ok(exifDate);
assert.strictEqual(PM.seoulParts(exifDate).date,'2026-11-12');
assert.strictEqual(PM.seoulParts(exifDate).time,'12:24');
assert.strictEqual(PM.suggestMealSlotAt(exifDate),'점심');

// 배달 결제내역: 주소·전화·카드·주문번호·결제 정보는 버림
const dirtyReceipt={
  store:'테스트치킨 서울시 테스트구 가상로 1 010-0000-0000',
  address:'서울시 테스트구 가상로 1',
  phone:'010-0000-0000',
  card:'1234-5678-9012-3456',
  order_number:'B0123456789',
  payment:'22,000원',
  ordered_at:'2026-11-12 12:30',
  items:[{name:'후라이드 치킨 한마리 22,000원 010-1111-2222',qty:1},{name:'콜라',qty:2}]
};
const rec=PM.sanitizeReceipt(dirtyReceipt);
const recJson=JSON.stringify(rec);
assert.strictEqual(rec.store,'테스트치킨');
assert.ok(rec.ordered_at.indexOf('2026-11-12T12:30')===0);
assert.ok(!/010-|1234-5678|B012345|가상로|22,000|address|phone|card|order_number|payment/.test(recJson));
assert.strictEqual(rec.items[0].name,'후라이드 치킨 한마리');
assert.strictEqual(idOf('후라이드 치킨 한마리'),'fried-w');
const recRows=PM.matchDishes(rec.items);
assert.strictEqual(recRows[0].food.id,'fried-w');
assert.strictEqual(recRows[0].qty,1);
assert.strictEqual(PM.nutritionOf(recRows[0].food,recRows[0].portionMul).kcal,foods.find(f=>f.id==='fried-w').kcal);
assert.strictEqual(recRows[1].qty,2);
assert.ok(!rec.payment&&rec.address==null);

console.log('photo-meal 0.4.19 slot/receipt tests ok',{exif:'12:24 점심',store:rec.store});

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
