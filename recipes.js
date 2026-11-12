// 다이어트 게임 0.4.20 — 내일 식단 레시피(1인분). 영양값은 음식 표를 그대로 쓰고 여기서 숫자를 만들지 않음.
(function(root){
function weekday(d){return ['일','월','화','수','목','금','토'][new Date(d+'T12:00:00+09:00').getDay()];}
function md(d){return d?d.slice(5).replace('-','/'):'';}
const SLOT_EMOJI={아침:'🍳',아점:'🥐',점심:'🍱',점저:'🥘',저녁:'🍽️',간식:'🍪',야식:'🌙'};

function H(ing,steps){return {kind:'home',ingredients:ing,steps:steps};}
function O(tip){return {kind:'order',label:'배달/외식 메뉴',tip:tip};}

const RECIPES={
'staple-milk':H(['우유 200g(1컵)'],['컵에 따라 바로 마신다.','따뜻하게 마시려면 약한 불에서 데우기만 한다.']),
'staple-lowfat-milk':H(['저지방우유 200mL(1컵)'],['컵에 따라 바로 마신다.','다른 끼니 사이에 칼슘 간식으로 곁들인다.']),
'staple-plain-yogurt':H(['떠먹는 플레인 요구르트 100g'],['그릇에 덜어 그대로 먹는다.','과일이나 견과를 올릴 때는 미리 섞지 말고 먹기 직전에 올린다.']),
'staple-rice':H(['밥 70g(1/3공기)'],['따뜻한 밥을 공기나 그릇에 담는다.','반찬과 함께 천천히 먹는다.']),
'staple-mixed-rice':H(['잡곡밥 70g(1/3공기)'],['잡곡밥이 없으면 흰밥에 잡곡을 조금 섞어 짓는다.','70g만 덜어 공기 1/3 정도로 담는다.']),
'staple-brown-rice':H(['현미밥 70g(1/3공기)'],['불린 현미로 밥을 짓거나 있는 현미밥을 데운다.','70g만 덜어 반찬과 함께 먹는다.']),
'staple-potato':H(['감자 140g(중 1개)','소금 약간'],['감자를 깨끗이 씻어 껍질째 또는 벗겨 둔다.','찜기나 전자레인지에 익혀 포크로 찔러 본다.','소금만 살짝 뿌려 먹는다.']),
'staple-goguma':H(['고구마 70g(중 1/2개)'],['고구마를 씻어 반으로 가른다.','찜기나 에어프라이어에 익혀 속이 말랑해지면 꺼낸다.','그대로 또는 껍질을 벗겨 먹는다.']),
'staple-bread':H(['식빵 35g(1장)'],['식빵 한 장을 그대로 또는 약하게 굽는다.','버터를 두껍게 바르지 말고 담백하게 먹는다.']),
'staple-tofu':H(['두부 80g(1/4모)','소금 또는 저염간장 약간'],['두부를 한입 크기로 자른다.','끓는 물에 살짝 데치거나 팬에 겉만 굽는다.','소금이나 저염간장을 조금 찍어 먹는다.']),
'staple-egg':H(['달걀 1개(55g)','소금 약간'],['냄비에 달걀이 잠길 물을 붓고 중불로 끓인다.','끓은 뒤 8~10분 더 삶아 찬물에 담근다.','껍질을 벗겨 소금만 살짝 찍어 먹는다.']),
'staple-spinach':H(['시금치 70g','소금 약간','깨 약간(선택)'],['시금치를 씻어 끓는 소금물에 살짝 데친다.','찬물에 헹궈 물기를 꼭 짠다.','소금과 깨만 조금 넣어 무친다.']),
'staple-beansprout':H(['콩나물 70g','소금 약간','대파 약간(선택)'],['콩나물을 씻어 냄비에 넣고 잠길 듯 말 듯 물을 붓는다.','뚜껑을 덮고 5~7분 쪄 낸다.','소금과 파를 조금 넣어 무친다.']),
'staple-shiitake':H(['표고버섯 50g','저염간장 약간'],['표고는 기둥을 떼고 얇게 썬다.','팬에 기름을 거의 두르지 않고 굽는다.','간장 몇 방울만 둘러 간을 맞춘다.']),
'staple-cucumber':H(['오이 70g(1/3개)','소금 약간'],['오이를 씻어 반으로 가르거나 얇게 썬다.','소금만 살짝 뿌려 아삭하게 먹는다.']),
'staple-gim':H(['김 1장(2g)'],['김을 그대로 또는 반으로 접어 먹는다.','밥 한술에 싸 먹으면 양이 조절된다.']),
'staple-peanut':H(['땅콩 8g(약 8개)'],['정해 둔 개수만 덜어 놓고 먹는다.','한 줌을 통째로 집어 들지 않는다.']),
'staple-walnut':H(['호두 8g(중 1.5개)'],['껍질을 벗긴 호두를 8g만 덜어 먹는다.','다른 간식과 함께 쌓아 두지 않는다.']),
'kimchi-jjigae':H(['김치 150g','두부 80g','돼지고기 또는 참치 조금(있으면)','대파 약간','물 300mL'],['김치를 한입 크기로 자르고 냄비에 살짝 볶는다.','물을 붓고 끓으면 두부와 고기를 넣는다.','중불에서 10분 정도 끓인다.','대파를 넣고 간을 본 뒤 바로 불에서 내린다.']),
'doenjang':H(['된장 1큰술','두부 80g','애호박·양파 조금','물 350mL'],['물에 된장을 풀어 끓인다.','썬 채소와 두부를 넣는다.','중불에서 8~10분 끓인다.','간을 보고 바로 담아 먹는다.']),
'sundubu':H(['순두부 1팩 또는 연두부 150g','달걀 1개','대파·고춧가루 약간','물 또는 육수 250mL'],['냄비에 물과 고춧가루를 넣고 끓인다.','순두부를 넣고 저어가며 데운다.','달걀을 풀어 넣고 한소끔 더 끓인다.','대파를 올려 마무리한다.']),
'cheonggukjang':H(['청국장 1작은 팩','두부 조금','호박·양파 조금','물 300mL'],['물에 청국장을 풀어 중불로 끓인다.','채소와 두부를 넣고 5~8분 더 끓인다.','짜면 물만 조금 보태 간을 맞춘다.']),
'budae':H(['햄·소시지 조금','김치 한 줌','두부 또는 버섯 조금','물 400mL'],['김치와 햄을 냄비에 살짝 볶는다.','물을 붓고 끓인다.','두부와 버섯을 넣고 8분 정도 더 끓인다.','라면 사리는 넣지 않거나 반만 넣는다.']),
'jeyuk':H(['돼지고기 앞다리 또는 불고기감 120g','양파 1/4개','고추장 1작은술','마늘 조금'],['고기에 고추장과 마늘을 살짝 버무린다.','팬을 달궈 고기를 먼저 볶는다.','양파를 넣고 윤기가 날 때까지만 볶는다.','밥은 1/3공기만 곁들인다.']),
'bulgogi':H(['소고기 불고기감 120g','양파 1/4개','저염간장 1작은술','마늘·참기름 약간'],['간장과 마늘에 고기를 잠시 재운다.','팬에 고기를 펼쳐 볶는다.','양파를 넣고 숨이 죽을 때까지만 볶는다.','기름이 많으면 조금 덜어 내고 담는다.']),
'dakgalbi':H(['닭다리살 또는 가슴살 120g','양배추·양파 조금','고추장 1작은술'],['닭은 한입 크기로 썰어 고추장에 버무린다.','팬에 닭을 먼저 볶아 익힌다.','채소를 넣고 수분 있게 볶는다.','떡은 넣지 않거나 조금만 넣는다.']),
'dakdoritang':H(['닭고기 150g','감자 조금','당근·양파 조금','간장·고춧가루 약간'],['닭을 한입 크기로 썰어 헹군다.','냄비에 닭과 물을 넣고 한소끔 끓여 거품을 걷는다.','감자와 채소를 넣고 양념해 자작하게 조린다.','국물은 남기지 말고 고기와 채소 위주로 담는다.']),
'omurice':H(['밥 140g','달걀 1개','양파 조금','케첩 조금'],['팬에 양파를 살짝 볶고 밥을 넣어 케첩으로 간한다.','달걀을 얇게 부쳐 밥을 감싼다.','케첩은 많이 뿌리지 않는다.']),
'bibimbap':H(['밥 140g','나물 세 가지(시금치·콩나물·고사리 등)','달걀 1개 또는 두부 조금','고추장 1작은술'],['나물을 각각 살짝 무쳐 둔다.','따뜻한 밥 위에 나물을 나눠 담는다.','달걀프라이나 데친 두부를 올린다.','고추장은 1작은술만 넣고 비빈다.']),
'dolsot':H(['밥 140g','나물 조금','달걀 1개','고추장 1작은술'],['돌솥이나 두꺼운 팬에 밥을 얇게 깔아 바닥만 누룽지처럼 지진다.','나물과 달걀을 올린다.','고추장은 적게 넣고 비빈다.']),
'kimchi-fry':H(['밥 140g','김치 80g','달걀 1개(선택)','대파 약간'],['김치를 먼저 팬에 볶아 신맛을 줄인다.','밥을 넣고 눌러가며 볶는다.','달걀을 곁들이면 그릇 옆에 따로 올린다.','기름은 최소만 두른다.']),
'samgyeop':H(['삼겹살 100~120g','쌈 채소·마늘','쌈장 약간'],['팬에 삼겹살을 구워 기름을 중간에 따라 낸다.','채소에 고기와 마늘만 얹어 싼다.','쌈장은 얇게만 바른다.']),
'eggstew':H(['달걀 2개','물 또는 육수 120mL','소금 약간','대파 조금'],['달걀과 물을 풀어 체에 한 번 내린다.','소금으로 간하고 그릇에 담아 찜기에 넣는다.','중약불에서 10분 안팎 쪄 가운데가 살짝 굳으면 대파를 올린다.']),
'mul-naengmyeon':H(['냉면 사리 1인분','냉면 육수 300mL','오이·달걀 고명'],['육수는 차갑게 둔다.','면은 끓는 물에 짧게 삶아 찬물에 헹군다.','육수를 붓고 고명을 올린다.','식초·겨자는 기호에 따라 조금만 넣는다.']),
'bibim-naengmyeon':H(['냉면 사리 1인분','비빔 양념 1큰술','오이 고명'],['면을 삶아 찬물에 헹궈 물기를 뺀다.','양념은 1큰술만 넣고 먼저 비빈다.','모자라면 조금 더하고, 처음에는 적게 시작한다.']),
'bibim-guksu':H(['소면 1인분','고추장 양념 1작은술','오이·김 고명'],['소면을 삶아 찬물에 헹군다.','양념을 적게 넣고 비빈다.','오이와 김을 올려 섞는다.']),
'mandu-guk':H(['만두 5~6개','달걀 조금','대파 약간','물 또는 육수 400mL'],['육수나 물을 끓인다.','만두를 넣고 떠오를 때까지 끓인다.','달걀을 풀어 넣고 대파를 올린다.','만두 개수를 정해 두고 더 넣지 않는다.']),
'hobak-juk':H(['호박 200g','밥 한 숟갈 또는 찹쌀가루 조금','소금 약간'],['호박을 쪄서 포크로 으깬다.','물과 밥을 넣고 약불에서 저어가며 끓인다.','소금만 살짝 넣어 마무리한다.']),
'gimbap':H(['밥 140g','김 1장','단무지·오이·계란 채'],['밥에 소금을 아주 조금 넣어 식힌다.','김 위에 밥과 채소를 얹고 말아 자른다.','참기름은 밥에 많이 섞지 않는다.']),
'tuna-gimbap':H(['밥 140g','김 1장','참치(기름 따른 것) 조금','단무지·오이'],['참치는 기름을 따라 내고 밥과 따로 둔다.','김 위에 밥과 속 재료를 올려 만다.','참치 마요는 조금만 쓴다.']),
'cheese-gimbap':H(['밥 140g','김 1장','치즈 1장','단무지·오이'],['밥은 얇게 편다.','치즈와 채소를 넣고 만다.','치즈는 한 장만 넣는다.']),
'don-gimbap':H(['밥 140g','김 1장','얇은 돈까스 한 줄','단무지'],['돈까스는 기름을 키친타월로 한 번 닦는다.','밥과 함께 말아 한입 크기로 썬다.']),
'tteokbokki':H(['떡볶이 떡 150g','어묵 조금','고추장 양념 1큰술','물 200mL'],['물에 양념을 풀어 끓인다.','떡과 어묵을 넣고 떡이 말랑해질 때까지 조린다.','국물이 너무 졸으면 물만 조금 보탠다.']),
'rose-tteok':H(['떡볶이 떡 150g','우유 또는 저지방우유 80mL','고추장 조금'],['고추장과 우유를 넣고 끓인다.','떡을 넣어 말랑하게 조린다.','생크림은 넣지 않거나 아주 조금만 넣는다.']),
'cheese-tteok':H(['떡볶이 떡 150g','치즈 1장','고추장 양념 1큰술'],['양념 국물에 떡을 조린다.','불에서 내린 뒤 치즈 한 장만 올린다.']),
'ramyeon':H(['라면 1개','물 550mL','대파 조금'],['물을 끓여 면과 분말 스프를 넣는다.','면이 익으면 바로 불을 끈다.','스프는 전량보다 덜 넣어도 된다.']),
'cheese-ramyeon':H(['라면 1개','치즈 1장','물 550mL'],['라면을 끓인다.','불에서 내린 뒤 치즈 한 장만 올린다.']),
'jjolmyeon':H(['쫄면 1인분','비빔 양념 1큰술','양배추·오이 조금'],['면을 삶아 찬물에 헹군다.','양념을 적게 넣고 채소와 비빈다.']),
'sundae':H(['순대 150g','소금 또는 삼장 약간'],['순대를 찜기에 데운다.','한입 크기로 썰어 소금만 찍어 먹는다.','튀기지 않는다.']),
'sundae-b':H(['순대 150g','양파·배추 조금','고춧가루 약간'],['팬에 채소를 먼저 볶는다.','순대를 넣고 고춧가루만 살짝 둘러 볶는다.','기름은 최소로 한다.']),
'odeng':H(['어묵 3~4장','무 조금','물 400mL','간장 조금'],['물에 무와 간장을 넣고 끓인다.','어묵을 넣어 5분 정도 더 끓인다.','국물보다 어묵 위주로 건져 먹는다.']),
'rabokki':H(['떡 조금','라면 사리 반 개','고추장 양념'],['양념 국물을 끓인다.','떡을 먼저 넣고, 라면은 반만 넣어 익힌다.']),
'tteok-skew':H(['떡꼬치 2개'],['팬이나 에어프라이어에 겉만 굽는다.','소스는 반만 바르거나 따로 찍어 먹는다.']),
'twigim':H(['모듬튀김 6개'],['키친타월에 올려 기름을 한 번 뺀다.','소스는 찍어 먹되 많이 담그지 않는다.']),
'chicken-sal':H(['샐러드 채소 한 접시','닭가슴살 또는 치킨 토핑','드레싱 1큰술'],['채소를 그릇에 담는다.','토핑을 올리고 드레싱은 1큰술만 뿌린다.','드레싱을 미리 버무리지 않는다.']),
'salmon-sal':H(['샐러드 채소 한 접시','연어 슬라이스','드레싱 1큰술'],['채소를 담고 연어를 올린다.','드레싱은 먹기 직전에 조금만 뿌린다.']),
'ricotta-sal':H(['샐러드 채소 한 접시','리코타 치즈 조금','드레싱 1큰술'],['채소 위에 리코타를 뜬다.','드레싱은 적게 뿌린다.']),
'poke-salmon':H(['밥 또는 채소 베이스','연어 큐브','소스 1큰술'],['베이스를 담고 연어를 올린다.','소스는 1큰술만 둘러 섞는다.']),
'poke-tuna':H(['밥 또는 채소 베이스','참치 큐브','소스 1큰술'],['베이스를 담고 참치를 올린다.','소스는 적게 넣고 비빈다.']),
'breast-sal':H(['샐러드 채소 한 접시','닭가슴살 100g','드레싱 1큰술'],['채소를 씻어 물기를 턴다.','데치거나 구운 닭가슴살을 올린다.','드레싱은 1큰술만 뿌린다.']),
'sousvide-sal':H(['샐러드 채소 한 접시','수비드 닭가슴살 1팩','드레싱 1큰술'],['채소를 담고 닭가슴살을 잘라 올린다.','드레싱은 따로 찍어 먹거나 조금만 뿌린다.']),
'today-sal':H(['샐러드 채소 한 접시','단백질 토핑','드레싱 1큰술'],['채소를 담아 토핑을 올린다.','드레싱은 적게 쓴다.']),
'caesar':H(['로메인 또는 상추','닭가슴살 조금','시저 드레싱 1큰술'],['잎채소를 담고 닭을 올린다.','드레싱과 치즈는 적게 올린다.','크루통은 빼도 된다.']),
'club-sand':H(['식빵 2장','닭가슴살 또는 햄','채소·계란'],['빵 사이에 채소와 단백질을 넣는다.','마요네즈는 얇게만 바른다.','세 장 클럽이면 빵을 한 장 빼도 된다.']),
'salad-wrap':H(['또띠아 또는 쌈','샐러드 채소','단백질 토핑','드레싱 조금'],['채소와 단백질을 올리고 드레싱은 조금만 뿌린다.','단단히 말아 한입 크기로 자른다.']),
'yogurt-bowl':H(['플레인 또는 그릭 요거트 150g','과일 한 줌','견과 조금'],['요거트를 그릇에 담는다.','과일과 견과를 먹기 직전에 올린다.','시리얼이나 시럽은 넣지 않는다.'])
};

function fruitRecipe(name,unit){
  return H([name+' '+ (unit||'1회분')],['깨끗이 씻거나 껍질을 벗긴다.','정해 둔 양만 접시에 덜어 먹는다.','다른 간식과 같이 쌓아 두지 않는다.']);
}
['fruit-hongsi','fruit-dangam','fruit-gotgam','fruit-apple','fruit-pear','fruit-mandarin','fruit-banana','fruit-strawberry','fruit-grape','fruit-shine','fruit-watermelon','fruit-chamoe','fruit-peach','fruit-kiwi','fruit-blueberry','fruit-tomato','fruit-cherrytomato','fruit-orange','fruit-grapefruit','fruit-mango','fruit-pineapple','fruit-cherry'].forEach(id=>{
  if(!RECIPES[id]) RECIPES[id]=fruitRecipe(id.replace('fruit-',''));
});
// prettier names for fruit
RECIPES['fruit-hongsi']=fruitRecipe('홍시','80g');
RECIPES['fruit-dangam']=fruitRecipe('단감','80g');
RECIPES['fruit-gotgam']=fruitRecipe('곶감','100g');
RECIPES['fruit-apple']=fruitRecipe('사과','100g');
RECIPES['fruit-pear']=fruitRecipe('배','100g');
RECIPES['fruit-mandarin']=fruitRecipe('감귤','120g');
RECIPES['fruit-banana']=fruitRecipe('바나나','80g');
RECIPES['fruit-strawberry']=fruitRecipe('딸기','150g');
RECIPES['fruit-grape']=fruitRecipe('포도','80g');
RECIPES['fruit-shine']=fruitRecipe('샤인머스캣','80g');
RECIPES['fruit-watermelon']=fruitRecipe('수박','150g');
RECIPES['fruit-chamoe']=fruitRecipe('참외','100g');
RECIPES['fruit-peach']=fruitRecipe('복숭아','100g');
RECIPES['fruit-kiwi']=fruitRecipe('키위','80g');
RECIPES['fruit-blueberry']=fruitRecipe('블루베리','100g');
RECIPES['fruit-tomato']=fruitRecipe('토마토','250g');
RECIPES['fruit-cherrytomato']=fruitRecipe('방울토마토','200g');
RECIPES['fruit-orange']=fruitRecipe('오렌지','100g');
RECIPES['fruit-grapefruit']=fruitRecipe('자몽','150g');
RECIPES['fruit-mango']=fruitRecipe('망고','100g');
RECIPES['fruit-pineapple']=fruitRecipe('파인애플','100g');
RECIPES['fruit-cherry']=fruitRecipe('체리','80g');

function defaultTip(dish){
  const c=dish.cat||'', n=dish.name||'';
  if(/치킨/.test(c+n))return '소스 따로, 무는 소스 없이 달라고 해 보세요.';
  if(/피자/.test(c+n))return '치즈 적게, 사이드와 콜라 대신 물을 요청해 보세요.';
  if(/버거|밥버거/.test(c+n))return '음료는 제로로, 감자튀김은 빼 보세요.';
  if(/족발|보쌈/.test(c+n))return '쌈과 함께 먹고, 소스는 적게 찍어 보세요.';
  if(/중식|짜장|짬뽕/.test(c+n))return '밥은 반 공기만, 기름기는 덜어 달라고 해 보세요.';
  if(/분식|떡볶이|라면/.test(c+n))return '양은 1인분만, 떡·면은 남기더라도 국물은 적게 드세요.';
  return '소스 따로, 밥은 반 공기만 요청해 보세요.';
}
function placeBucket(dish){
  if(dish.brand)return 'delivery';
  const c=dish.cat||'';
  if(/한식|과일|샐러드|분식|죽|유제품|곡류|채소|견과|어육류|달걀|해조/.test(c))return 'home';
  if(/치킨|피자|중식|버거|족발|밥버거|배달/.test(c))return 'delivery';
  return 'out';
}
function recipeOf(dish){
  if(!dish)return null;
  if(RECIPES[dish.id])return Object.assign({id:dish.id,name:dish.name},RECIPES[dish.id]);
  if(placeBucket(dish)!=='home'||dish.brand)return Object.assign({id:dish.id,name:dish.name},O(defaultTip(dish)));
  return Object.assign({id:dish.id,name:dish.name},H(
    [dish.name+(dish.unit?' '+dish.unit:'')+' 1인분','기본 양념 조금'],
    [dish.name+' 재료를 손질해 한입 크기로 준비한다.','팬이나 냄비에 최소 양념만 넣고 익힌다.','1인분 그릇에만 덜어 먹는다.']
  ));
}
function recipeHTML(dish){
  const r=recipeOf(dish); if(!r)return '';
  if(r.kind==='order'){
    return `<div class="recipe"><div class="recipe-k">배달/외식 메뉴</div><div class="recipe-tip">주문 팁: ${esc(r.tip)}</div></div>`;
  }
  const ing=(r.ingredients||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  const st=(r.steps||[]).map((x,i)=>`<li>${esc(x)}</li>`).join('');
  return `<div class="recipe"><div class="recipe-k">재료 (1인분)</div><ul class="recipe-ing">${ing}</ul><div class="recipe-k">만드는 법</div><ol class="recipe-st">${st}</ol></div>`;
}
function shoppingList(dishes){
  const map=new Map();
  dishes.forEach(d=>{
    const r=recipeOf(d);
    if(!r||r.kind==='order')return;
    (r.ingredients||[]).forEach(line=>{
      const key=line.replace(/\s+/g,' ').trim();
      if(!key)return;
      if(!map.has(key))map.set(key,true);
    });
  });
  return Array.from(map.keys());
}
function nextDayShareText(opt){
  opt=opt||{};
  const date=opt.date||'';
  const title='내일 식단 ('+md(date)+(date?' '+weekday(date):'')+')';
  const slots=opt.slots||['아침','점심','저녁'];
  const items=opt.items||{};
  const lines=[title,''];
  const dishes=[];
  slots.forEach(slot=>{
    const d=items[slot]; if(!d)return;
    dishes.push(d);
    const kcal=d.kcal!=null?Math.round(+d.kcal):null;
    const em=SLOT_EMOJI[slot]||'•';
    lines.push(em+' '+slot+': '+d.name+(kcal!=null?' ('+kcal+'kcal)':''));
    const r=recipeOf(d);
    if(r&&r.kind==='order'){
      lines.push('배달/외식 메뉴');
      lines.push('주문 팁: '+(r.tip||''));
    }else if(r){
      lines.push('재료');
      (r.ingredients||[]).forEach(x=>lines.push('- '+x));
      lines.push('만드는 법');
      (r.steps||[]).forEach((x,i)=>lines.push((i+1)+'. '+x));
    }
    lines.push('');
  });
  const shop=shoppingList(dishes);
  lines.push('장보기');
  if(shop.length) shop.forEach(x=>lines.push('- '+x));
  else lines.push('- 배달/외식 메뉴만 있어 장볼 재료가 없어요');
  return lines.join('\n');
}
function copyText(text){
  const ok=()=>{if(typeof toast==='function')toast('복사됐어요');return Promise.resolve(true);};
  const fail=()=>{
    try{
      const ta=document.createElement('textarea');
      ta.value=text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.select();
      const done=document.execCommand('copy');
      document.body.removeChild(ta);
      if(done){if(typeof toast==='function')toast('복사됐어요');return Promise.resolve(true);}
    }catch(e){}
    if(typeof toast==='function')toast('복사에 실패했어요');
    return Promise.resolve(false);
  };
  if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).then(ok).catch(fail);
  }
  return fail();
}
function shareText(text,title){
  if(typeof navigator!=='undefined'&&navigator.share){
    return navigator.share({title:title||'내일 식단',text:text}).catch(()=>{});
  }
  return copyText(text);
}
function hasShare(){return typeof navigator!=='undefined'&&typeof navigator.share==='function';}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const api={RECIPES,recipeOf,recipeHTML,shoppingList,nextDayShareText,copyText,shareText,hasShare,defaultTip,SLOT_EMOJI,weekday,md};
root.DGRecipes=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
