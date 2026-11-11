// 다이어트 게임 0.4.8 — 대표 메뉴 이름·초성 검색 (기존 음식 표 재사용)
(function(root){
const CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHO_SET=new Set(CHO);
const JAMO_CHO={
  'ᄀ':'ㄱ','ᄁ':'ㄲ','ᄂ':'ㄴ','ᄃ':'ㄷ','ᄄ':'ㄸ','ᄅ':'ㄹ','ᄆ':'ㅁ','ᄇ':'ㅂ','ᄈ':'ㅃ','ᄉ':'ㅅ','ᄊ':'ㅆ','ᄋ':'ㅇ','ᄌ':'ㅈ','ᄍ':'ㅉ','ᄎ':'ㅊ','ᄏ':'ㅋ','ᄐ':'ㅌ','ᄑ':'ㅍ','ᄒ':'ㅎ'
};
// 검색 전용 별칭. 배달 OCR 별칭과 분리해서, 짧은 별칭이 주문 인식에 엉뚱하게 붙지 않게 했어요.
const SEARCH_SYNONYMS={
  '치킨':['후라이드치킨','양념치킨','간장치킨'],
  '후라이드치킨':['후라이드 치킨','후라이드'],
  '프라이드치킨':['후라이드 치킨','후라이드'],
  '후치킨':['후라이드'],
  '자장면':['짜장면'],
  '자장':['짜장'],
  '김찌':['김치찌개'],
  '된찌':['된장찌개'],
  '순찌':['순두부찌개'],
  '부찌':['부대찌개'],
  '냉면':['물냉면','비빔냉면'],
  '물냉':['물냉면'],
  '비냉':['비빔냉면'],
  '치맥':['치킨'],
  '피자':['피자'],
  '돈가스':['돈까스','돈카츠'],
  '돈까스':['돈카츠'],
  '스시':['초밥'],
  '짜장':['짜장면'],
  '떡볶이':['떡볶이']
};

// 0.4.9: 이 별칭은 질의가 별칭 전체를 다 입력했을 때만 맞춰요. ('치킨' 검색에 별칭 '치킨랩' 때문에 샐러드랩이 섞이던 문제)
const FULL_ONLY_ALIASES=new Set(['치킨랩']);

function foods(){return (root.DGFoods&&DGFoods.FOODS)||[];}

function norm(s){
  return String(s||'').toLowerCase()
    .replace(/[()\[\]{}]/g,'|') // 괄호 안이 앞 글자와 붙지 않게 구분 (감자튀김(치킨) ≠ 김치)
    .replace(/[~\-_/.,'"·]/g,'')
    .replace(/\s+/g,'');
}

function toChoseongChar(ch){
  const code=ch.charCodeAt(0);
  if(code>=0xAC00&&code<=0xD7A3)return CHO[Math.floor((code-0xAC00)/588)];
  if(CHO_SET.has(ch))return ch;
  if(JAMO_CHO[ch])return JAMO_CHO[ch];
  return '';
}

function toChoseong(s){
  let out='';
  for(const ch of String(s||'')){
    const c=toChoseongChar(ch);
    if(c)out+=c;
  }
  return out;
}

function isChoseongQuery(s){
  const raw=String(s||'').replace(/\s+/g,'');
  if(!raw)return false;
  for(const ch of raw){
    if(!(CHO_SET.has(ch)||JAMO_CHO[ch]))return false;
  }
  return raw.length>=1;
}

function foodKeys(item){
  const names=[item.name].concat(item.aliases||[]).concat(item.searchAliases||[]);
  return names.filter(Boolean);
}

function scoreOne(qNorm,qCho,isCho,text){
  const n=norm(text);
  if(!n)return 0;
  const c=toChoseong(text);
  if(isCho){
    if(!qCho)return 0;
    if(c===qCho)return 94;
    if(c.startsWith(qCho))return 86;
    if(c.includes(qCho))return 78;
    return 0;
  }
  let best=0;
  if(qNorm){
    if(n===qNorm)best=Math.max(best,100);
    else if(n.startsWith(qNorm))best=Math.max(best,90);
    else if(qNorm.startsWith(n)&&n.length>=2)best=Math.max(best,84);
    else if(n.includes(qNorm))best=Math.max(best,80);
  }
  // 일반 한글 검색(예: '김치'→ㄱㅊ)은 짧은 초성 부분일치로 다른 메뉴가 섞이지 않게 해요.
  // 초성 입력(ㄱㅊㅉㄱ, ㅊㅋ)일 때만 초성 포함 검색을 씁니다.
  if(qCho&&c){
    if(isCho){
      if(c===qCho)best=Math.max(best,94);
      else if(c.startsWith(qCho))best=Math.max(best,86);
      else if(qCho.length>=2&&c.includes(qCho))best=Math.max(best,78);
    }else if(qCho.length>=3){
      if(c===qCho)best=Math.max(best,88);
      else if(c.startsWith(qCho))best=Math.max(best,74);
    }
  }
  return best;
}

function expandQueries(query){
  const n=norm(query);
  const out=[query];
  if(!n)return out;
  const syn=SEARCH_SYNONYMS[n]||SEARCH_SYNONYMS[query];
  if(syn)syn.forEach(s=>out.push(s));
  return out;
}

function unitBoost(item){
  const u=item.unit||'';
  if(u==='1인분')return 2;
  if(u==='1개'||u==='1줄'||u==='1조각')return 1;
  if(u==='반마리')return 0;
  if(u==='한마리'||u==='1판')return -1;
  return 0;
}

function searchFoods(query,opts){
  opts=opts||{};
  const list=opts.foods||foods();
  const limit=opts.limit==null?12:opts.limit;
  const q=String(query||'').trim();
  if(!q)return [];
  const variants=expandQueries(q);
  const scored=[];
  list.forEach(item=>{
    let best=0,via='';
    variants.forEach((v,vi)=>{
      const qNorm=norm(v);
      const qCho=isChoseongQuery(v)?norm(v).split('').map(ch=>JAMO_CHO[ch]||ch).join(''):toChoseong(v);
      const isCho=isChoseongQuery(v);
      foodKeys(item).forEach(key=>{
        // '짜장말고짬뽕'처럼 부정 표현 별칭은 검색에서 빼요.
        if(/말고/.test(key)&&!norm(item.name).includes(qNorm))return;
        if(FULL_ONLY_ALIASES.has(key)&&key!==item.name&&qNorm.length<norm(key).length)return;
        let s=scoreOne(qNorm,qCho,isCho,key);
        if(vi>0&&s>0)s=Math.max(0,s-6);
        if(s>best){best=s;via=key;}
      });
    });
    if(best>=68)scored.push({item,score:best+unitBoost(item),via});
  });
  scored.sort((a,b)=>b.score-a.score||a.item.name.length-b.item.name.length||String(a.item.name).localeCompare(b.item.name,'ko'));
  return scored.slice(0,limit);
}

const POPULAR_IDS=['jajang','kimchi-jjigae','tteokbokki','fried-w','gimbap','bibimbap','ramyeon','jeyuk'];

function popularFoods(list){
  list=list||foods();
  const byId=new Map(list.map(f=>[f.id,f]));
  return POPULAR_IDS.map(id=>byId.get(id)).filter(Boolean);
}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

function resultHTML(hits,query){
  if(!hits.length){
    return `<div class="meal-search-hint">‘${esc(query)}’에 맞는 메뉴가 없어요. 이름을 직접 적어도 기록할 수 있어요.</div>`;
  }
  return hits.map(h=>{
    const f=h.item;
    const kcal=Math.round(+f.kcal||0);
    return `<button type="button" class="meal-search-item" data-food-id="${esc(f.id)}" onclick="DGFoodSearch.pick('${escJs(f.id)}')">
      <span class="nm"><b>${esc(f.name)}</b><span>${esc(f.cat||'')} · ${esc(f.unit||'1인분')}</span></span>
      <span class="kcal"><span class="num">${kcal.toLocaleString('ko-KR')}</span>kcal</span>
    </button>`;
  }).join('');
}

function emptyHTML(){
  const pops=popularFoods();
  const chips=pops.map(f=>`<button type="button" class="chip" onclick="DGFoodSearch.pick('${escJs(f.id)}')">${esc(f.name.replace(/\s*한마리$/,'') )}${f.kcal?` · ${Math.round(f.kcal).toLocaleString('ko-KR')}kcal`:''}</button>`).join('');
  return `<div class="meal-search-hint">대표적인 메뉴를 이름이나 초성(예: ㄱㅊㅉㄱ)으로 찾아 보세요. 띄어쓰기는 없어도 돼요.</div>
    <div class="meal-search-chips look-picks">${chips}</div>`;
}

function render(query){
  const box=typeof document!=='undefined'?document.getElementById('mealSearchBox'):null;
  if(!box)return;
  const q=String(query==null?((typeof document!=='undefined'&&document.getElementById('mealMenu'))||{}).value||'':query);
  if(!String(q).trim()){
    box.innerHTML=emptyHTML();
    box.hidden=false;
    return;
  }
  const hits=searchFoods(q,{limit:12});
  box.innerHTML=resultHTML(hits,q);
  box.hidden=false;
}

function pick(id){
  if(root.DGDelivery&&typeof DGDelivery.openFromSearch==='function'){
    DGDelivery.openFromSearch(id);
    return;
  }
  const item=foods().find(f=>f.id===id);
  if(!item)return;
  const name=typeof document!=='undefined'?document.getElementById('mealMenu'):null;
  const kcal=typeof document!=='undefined'?document.getElementById('kcal'):null;
  const prot=typeof document!=='undefined'?document.getElementById('prot'):null;
  if(name)name.value=item.name;
  if(kcal)kcal.value=item.kcal==null?'':String(Math.round(+item.kcal||0));
  if(prot)prot.value=item.protein==null?'':String(item.protein);
  const box=typeof document!=='undefined'?document.getElementById('mealSearchBox'):null;
  if(box){box.innerHTML=emptyHTML();}
}

const api={norm,toChoseong,isChoseongQuery,searchFoods,popularFoods,SEARCH_SYNONYMS,render,pick,resultHTML,emptyHTML};
root.DGFoodSearch=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
