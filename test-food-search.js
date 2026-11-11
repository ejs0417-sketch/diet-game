// 0.4.10 대표 메뉴 검색 단위 테스트
const assert = require('assert');
const foods = require('./delivery-foods.js');
const search = require('./food-search.js');

function ids(q){return search.searchFoods(q,{foods:foods.FOODS,limit:20}).map(h=>h.item.id);}
function names(q){return search.searchFoods(q,{foods:foods.FOODS,limit:20}).map(h=>h.item.name);}
function has(q, pred, msg){
  const hits=search.searchFoods(q,{foods:foods.FOODS,limit:20});
  assert(hits.some(pred), msg||('expected hit for '+q+' got '+hits.map(h=>h.item.name).join(', ')));
}

// 부분일치
has('짜장', h=>h.item.id==='jajang', '짜장 → 짜장면');
has('김치찌', h=>h.item.id==='kimchi-jjigae', '김치찌 → 김치찌개');
has('떡볶이', h=>h.item.id==='tteokbokki', '떡볶이 정확');
has('떡 볶 이', h=>h.item.id==='tteokbokki', '띄어쓰기 무시');

// 초성
assert.strictEqual(search.toChoseong('김치찌개'), 'ㄱㅊㅉㄱ');
assert.strictEqual(search.toChoseong('짜장면'), 'ㅉㅈㅁ');
assert.strictEqual(search.toChoseong('떡볶이'), 'ㄸㅂㅇ');
assert.ok(search.isChoseongQuery('ㄱㅊㅉㄱ'));
assert.ok(search.isChoseongQuery('ㅉㅈㅁ'));
assert.ok(!search.isChoseongQuery('김치'));
has('ㄱㅊㅉㄱ', h=>h.item.id==='kimchi-jjigae', '초성 ㄱㅊㅉㄱ → 김치찌개');
has('ㅉㅈㅁ', h=>h.item.id==='jajang', '초성 ㅉㅈㅁ → 짜장면');
has('ㄸㅂㅇ', h=>h.item.id==='tteokbokki', '초성 ㄸㅂㅇ → 떡볶이');
has('ㅊㅋ', h=>/치킨/.test(h.item.name), '초성 ㅊㅋ → 치킨');

// 별칭
has('자장면', h=>h.item.id==='jajang', '별칭 자장면=짜장면');
has('치킨', h=>/치킨/.test(h.item.name), '별칭/부분일치 치킨');
has('후라이드치킨', h=>h.item.id==='fried-w'||/후라이드/.test(h.item.name), '후라이드치킨');
has('김찌', h=>h.item.id==='kimchi-jjigae', '검색 별칭 김찌');
has('냉면', h=>h.item.id==='mul-naengmyeon'||h.item.id==='bibim-naengmyeon', '냉면');

// 결과 kcal·단위
const jj=search.searchFoods('짜장면',{foods:foods.FOODS,limit:5})[0];
assert.ok(jj && jj.item.kcal>=700 && jj.item.unit==='1인분', '짜장면 kcal 1인분');

assert.strictEqual(foods.count, 230, '음식 230개 (기존 208 + 과일 22)');

// 짧은 한글 검색이 초성 오탐으로 엉뚱한 메뉴를 넣지 않아요
const kimchi=names('김치');
assert(kimchi.includes('김치찌개') && kimchi.includes('김치볶음밥'), '김치 계열');
assert(!kimchi.some(n=>n.includes('고추마요')||n.includes('설빙')||n.includes('레드콤보')||n.includes('감자튀김')), '김치 오탐 없음: '+kimchi.join(','));
assert.strictEqual(kimchi[0], '김치찌개', '김치 첫 결과 '+kimchi[0]);

console.log('food-search tests ok', {짜장:names('짜장').slice(0,3), 초성:names('ㄱㅊㅉㄱ').slice(0,3), 치킨:names('치킨').slice(0,5)});

// 0.4.9: '치킨' 검색에 샐러드랩이 섞이지 않고, 대표 치킨이 먼저
{
  const n=names('치킨');
  assert.ok(!n.includes('샐러드랩'), "'치킨' 결과에 샐러드랩이 없어야 함: "+n.join(', '));
  assert.ok(/치킨/.test(n[0]) && n[0].includes('후라이드'), "'치킨' 첫 결과는 대표 치킨: "+n[0]);
  has('치킨랩', h=>h.item.id==='salad-wrap', "'치킨랩'은 여전히 샐러드랩을 찾음");
  has('랩', h=>h.item.id==='salad-wrap', "'랩'은 샐러드랩");
}
console.log('0.4.9 food-search extra tests ok');

// 0.4.10 봉구스밥버거 브랜드 검색
{
  const n=names('봉구스');
  assert.ok(n.length>0, "봉구스 검색 결과 있음");
  assert.ok(n.some(x=>x.includes('봉구스')||x.includes('햄치즈')||x.includes('제육')), "봉구스 대표 메뉴: "+n.join(', '));
  assert.strictEqual(n[0], '봉구스 밥버거', "봉구스 첫 결과는 오리지널: "+n[0]);
  const hits=search.searchFoods('봉구스',{foods:foods.FOODS,limit:20});
  assert.ok(hits.every(h=>h.item.brand==='봉구스밥버거'), "봉구스 결과는 브랜드명 있음");
  has('봉구스밥버거', h=>h.item.id==='bg-original', '봉구스밥버거');
  has('밥버거', h=>h.item.brand==='봉구스밥버거', '밥버거 → 봉구스');
  has('ㅂㄱㅅ', h=>h.item.brand==='봉구스밥버거', '초성 ㅂㄱㅅ → 봉구스');
  has('햄치즈', h=>h.item.id==='bg-hamcheese', '햄치즈');
  has('제육밥버거', h=>h.item.id==='bg-jeyuk', '제육밥버거');
  has('참치마요', h=>h.item.id==='bg-original', '참치마요 → 오리지널 봉구스');
  const orig=search.searchFoods('봉구스',{foods:foods.FOODS,limit:5}).find(h=>h.item.id==='bg-original');
  assert.ok(orig && orig.item.kcal===545, '봉구스 오리지널 545kcal, got '+(orig&&orig.item.kcal));
  const chicken=names('치킨');
  assert.ok(!chicken.some(x=>x.includes('밥버거')), "'치킨' 결과에 밥버거가 없어야 함: "+chicken.join(', '));
  assert.ok(/치킨/.test(chicken[0]) && chicken[0].includes('후라이드'), "'치킨' 첫 결과는 대표 치킨: "+chicken[0]);
  const jeyuk=names('제육');
  assert.strictEqual(jeyuk[0], '제육볶음', "'제육' 첫 결과는 제육볶음: "+jeyuk[0]);
  assert.ok(!jeyuk.includes('제육 밥버거'), "'제육'만 치면 제육밥버거가 섞이지 않음: "+jeyuk.join(', '));
  const kimchi=names('김치');
  assert.ok(!kimchi.some(x=>x.includes('밥버거')), "'김치' 결과에 밥버거가 없어야 함: "+kimchi.join(', '));
}

// 0.4.10 빼빼로 브랜드 검색
{
  const n=names('빼빼로');
  assert.ok(n.includes('빼빼로 오리지널(초코)') && n.includes('빼빼로 아몬드') && n.includes('빼빼로 누드') && n.includes('빼빼로 화이트쿠키'), "빼빼로 대표 제품: "+n.join(', '));
  assert.strictEqual(n[0], '빼빼로 오리지널(초코)', "빼빼로 첫 결과는 오리지널: "+n[0]);
  const hits=search.searchFoods('빼빼로',{foods:foods.FOODS,limit:20});
  assert.ok(hits.every(h=>h.item.brand==='롯데웰푸드' && h.item.unit==='1갑'), "빼빼로 결과는 롯데웰푸드·1갑");
  has('ㅃㅃㄹ', h=>h.item.id==='pepero-choco', '초성 ㅃㅃㄹ → 빼빼로');
  has('페페로', h=>h.item.id==='pepero-choco', '오타 페페로 → 빼빼로');
  const kcal=Object.fromEntries(hits.map(h=>[h.item.id,h.item.kcal]));
  assert.strictEqual(kcal['pepero-choco'], 270, '오리지널 270kcal');
  assert.strictEqual(kcal['pepero-almond'], 200, '아몬드 200kcal');
  assert.strictEqual(kcal['pepero-nude'], 235, '누드 235kcal');
  assert.strictEqual(kcal['pepero-whitecookie'], 185, '화이트쿠키 185kcal');
  assert.strictEqual(kcal['pepero-crunky'], 205, '크런키 205kcal');
}

console.log('0.4.10 brand-search tests ok', {봉구스:names('봉구스').slice(0,5), 빼빼로:names('빼빼로'), ㅂㄱㅅ:names('ㅂㄱㅅ').slice(0,3), ㅃㅃㄹ:names('ㅃㅃㄹ').slice(0,3), 페페로:names('페페로').slice(0,3)});

// 0.4.13 과일 검색
{
  has('홍시', h=>h.item.id==='fruit-hongsi'&&h.item.kcal===55, '홍시 55kcal');
  has('연시', h=>h.item.id==='fruit-hongsi', '별칭 연시=홍시');
  has('단감', h=>h.item.id==='fruit-dangam'&&h.item.kcal===46, '단감');
  has('곶감', h=>h.item.id==='fruit-gotgam'&&h.item.kcal===219, '곶감 100g 219');
  has('사과', h=>h.item.id==='fruit-apple'&&h.item.kcal===52, '사과');
  has('귤', h=>h.item.id==='fruit-mandarin'&&h.item.kcal===47, '귤=감귤');
  has('밀감', h=>h.item.id==='fruit-mandarin', '밀감=감귤');
  has('감귤', h=>h.item.id==='fruit-mandarin', '감귤');
  has('바나나', h=>h.item.id==='fruit-banana'&&h.item.kcal===62, '바나나');
  has('샤인머스캣', h=>h.item.id==='fruit-shine'&&h.item.kcal===53, '샤인머스캣');
  has('샤인머스켓', h=>h.item.id==='fruit-shine', '오타 샤인머스켓');
  has('ㅎㅅ', h=>h.item.id==='fruit-hongsi', '초성 ㅎㅅ → 홍시');
  has('ㄱㄱ', h=>h.item.id==='fruit-gotgam'||h.item.id==='fruit-mandarin', '초성 ㄱㄱ');
  has('토마토', h=>h.item.id==='fruit-tomato', '토마토');
  const tomato=names('토마토');
  assert.ok(tomato.includes('토마토'), '토마토 결과');
  has('체리', h=>h.item.id==='fruit-cherry'&&h.item.kcal===46, '체리');
  const cherry=search.searchFoods('체리',{foods:foods.FOODS,limit:8});
  assert.strictEqual(cherry[0].item.id,'fruit-cherry','체리 1순위');
  const hong=search.searchFoods('홍시',{foods:foods.FOODS,limit:5})[0];
  assert.ok(hong&&hong.item.unit==='1회(80g)'&&hong.item.grams===80&&hong.item.kcal100===69, '홍시 환산 기준');
  assert.strictEqual(foods.nutritionForPlace({kcal:10,home:{kcal:8}},'home').kcal, 8);
  assert.strictEqual(foods.nutritionForPlace({kcal:10},'home').kcal, 10, '집밥 전용값 없으면 동일');
  console.log('0.4.13 fruit-search tests ok', {홍시:names('홍시').slice(0,3), 귤:names('귤').slice(0,3), 샤인:names('샤인').slice(0,3)});
}
