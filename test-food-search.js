// 0.4.9 대표 메뉴 검색 단위 테스트
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

assert.strictEqual(foods.count, 184, '음식 184개 (기존 178 + 보강 6)');

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
