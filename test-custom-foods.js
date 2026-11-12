// 0.4.22 인터넷 검색값: 출처 없는 값은 거부, 공식 표 우선, 폰 안에만 저장
const assert=require('assert');
const vm=require('vm');
const fs=require('fs');
const path=require('path');
const store={};
const localStorage={
  getItem:k=> (k in store?store[k]:null),
  setItem:(k,v)=>{store[k]=String(v);},
  removeItem:k=>{delete store[k];}
};
const ctx={console,window:{},module:{exports:{}},globalThis:null,localStorage,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,parseInt,parseFloat,isNaN,isFinite,Uint8Array,ArrayBuffer,Promise,setTimeout,Intl,Error};
ctx.globalThis=ctx;ctx.window=ctx;ctx.root=ctx;
const dir=__dirname;
vm.runInNewContext(fs.readFileSync(path.join(dir,'delivery-foods.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(dir,'custom-foods.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(dir,'food-search.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(dir,'photo-meal.js'),'utf8'),ctx);
const CF=ctx.DGCustomFoods, PM=ctx.DGPhotoMeal, FS=ctx.DGFoodSearch;
assert.ok(CF&&PM);

// 출처 없으면 거부
assert.strictEqual(CF.sanitizeLookup({found:true,name:'계란말이',serving:'100g',kcal:200,protein:12,sources:[]}).found,false);
assert.strictEqual(CF.sanitizeLookup({found:true,name:'계란말이',kcal:200,sources:[{url:'http://insecure.example/'}]}).found,false);
assert.strictEqual(CF.sanitizeLookup({found:false,kcal:200,sources:[{url:'https://various.go.kr/x'}]}).found,false);
const ok=CF.sanitizeLookup({found:true,name:'계란말이',serving:'100g',kcal:180.4,protein:11.2,sources:[{url:'https://various.go.kr/food/egg?x=1#a',title:'식약처'}],address:'비밀',phone:'010-0000-0000'});
assert.strictEqual(ok.found,true);
assert.strictEqual(ok.kcal,180);
assert.strictEqual(ok.protein,11.2);
assert.strictEqual(ok.sources[0].url,'https://various.go.kr/food/egg?x=1');
assert.ok(!('address' in ok)&&!('phone' in ok));

// 저장 후 사진 매칭·검색에 바로 사용
assert.ok(!PM.matchDish('메추리알 장조림').food,'공식 표에 없으면 자동 매칭 없음');
const saved=CF.upsert({name:'메추리알 장조림',unit:'100g',kcal:170,protein:14,sources:[{url:'https://various.go.kr/food/quail',title:'식약처 식품영양성분'}]},'메추리알 장조림');
assert.ok(saved&&saved.id.startsWith('custom-')&&saved.custom);
const m=PM.matchDish('메추리알 장조림');
assert.strictEqual(m.food&&m.food.id,saved.id);
assert.strictEqual(m.food.kcal,170);
assert.ok(m.food.src.indexOf('인터넷 검색값')>=0);
const hits=FS.searchFoods('메추리알 장조림');
assert.ok(hits.length&&hits[0].item.id===saved.id);

// 공식 표가 커스텀보다 우선: 같은 이름 커스텀은 usable에서 제외, 쌀밥은 rice
const bad=CF.upsert({name:'쌀밥',unit:'1인분',kcal:999,protein:1,sources:[{url:'https://example.com/fake',title:'가짜'}]},'쌀밥');
assert.ok(bad);
assert.ok(!CF.usable().some(f=>f.name==='쌀밥'||f.id===bad.id),'공식과 겹치면 검색에서 제외');
const rice=PM.matchDish('쌀밥');
assert.strictEqual(rice.food&&rice.food.id,'rice');
assert.notStrictEqual(rice.food.kcal,999);

// 삭제
CF.remove(saved.id);
assert.ok(!PM.matchDish('메추리알 장조림').food);
assert.ok(!CF.byId(saved.id));

// 수정은 출처를 유지
const g=CF.upsert({name:'계란말이',unit:'100g',kcal:200,protein:12,sources:[{url:'https://various.go.kr/food/gyeran',title:'식약처'}]},'계란말이');
const ed=CF.update(g.id,{name:'계란말이',unit:'1장',kcal:210,protein:13});
assert.strictEqual(ed.kcal,210);
assert.strictEqual(ed.unit,'1장');
assert.strictEqual(ed.sourceUrl,'https://various.go.kr/food/gyeran');
assert.ok(ed.edited);

// 클라우드 동기화 키와 다름, 저장소 키만 로컬
assert.strictEqual(CF.CKEY,'dg_custom_foods_v1');
assert.ok(localStorage.getItem(CF.CKEY));
assert.ok(!/AIza|GEMINI_API_KEY/.test(fs.readFileSync(path.join(dir,'custom-foods.js'),'utf8')));
assert.ok(/^https:\/\/52-79-146-61\.sslip\.io\/lookup$/.test(CF.LOOKUP_URL));

console.log('custom-foods tests ok',{saved:saved.name,rice:rice.food.id,edit:ed.kcal});
