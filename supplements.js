// 다이어트 게임 0.4.4 — 영양제 카탈로그·추천 (기기 안, 참고용)
(function(root){
const DISCLAIMER='건강 정보는 참고용이에요. 진단이 아니며, 정확한 판단은 의사에게 받으세요.';
const XP_GENERIC=5, XP_NEED=7, XP_CAP=15;

const CATALOG=[
  {id:'multi',name:'종합비타민',for:'전반적인 영양을 보충할 때',caution:'식사와 함께. 다른 단일 비타민·미네랄과 양이 겹칠 수 있어요.',overlap:['비타민D','비타민B군','비타민C','아연','철분','칼슘']},
  {id:'vitd',name:'비타민D',for:'뼈·근육과 일상 컨디션을 챙길 때',caution:'고용량은 의사와 상의해 주세요.',tags:['vitd']},
  {id:'omega3',name:'오메가3',for:'혈행·중성지방을 식습관과 함께 챙길 때',caution:'항응고제를 쓰면 의사와 상의해 주세요.',tags:['lipid']},
  {id:'mag',name:'마그네슘',for:'근육 긴장·피로를 덜고 싶을 때',caution:'많이 먹으면 설사를 할 수 있어요.'},
  {id:'probiotic',name:'유산균',for:'장 건강을 챙길 때',caution:'항생제와는 시간을 띄워 주세요.'},
  {id:'vitb',name:'비타민B군',for:'에너지 대사·피로를 챙길 때',caution:'소변 색이 진해질 수 있어요. 해롭지 않은 경우가 많아요.',overlap:['종합비타민']},
  {id:'vitc',name:'비타민C',for:'항산화·일상 면역을 챙길 때',caution:'고용량은 속이 불편할 수 있어요.',overlap:['종합비타민']},
  {id:'zinc',name:'아연',for:'면역·피부를 챙길 때',caution:'공복에 구역이 날 수 있어요.',overlap:['종합비타민']},
  {id:'iron',name:'철분',for:'빈혈·피로를 챙길 때',caution:'과다 복용에 주의하고, 차·커피와는 시간을 띄워 주세요. 진단 없이 고용량은 피하세요.',tags:['anemia'],overlap:['종합비타민','칼슘']},
  {id:'calcium',name:'칼슘',for:'뼈·치아를 챙길 때',caution:'철분과는 시간을 띄워 주세요.',overlap:['종합비타민','철분']},
  {id:'lutein',name:'루테인',for:'눈 건강을 챙길 때',caution:'흡연자는 고용량 카로티노이드를 의사와 상의하세요.'},
  {id:'milkthistle',name:'밀크시슬',for:'간 건강을 보조할 때',caution:'간 질환이 있으면 의사와 상의해 주세요. 치료제가 아니에요.',tags:['liver']},
  {id:'coq10',name:'코큐텐10',for:'에너지·항산화를 챙길 때',caution:'혈압약을 쓰면 의사와 상의해 주세요.'},
  {id:'protein',name:'단백질',for:'근육 유지와 포만감을 챙길 때 (분말·음료 포함)',caution:'신장 기능이 걱정되면 먼저 의사와 상의해 주세요.',tags:['protein','kidney-caution']},
];

const ALIAS={
  '마그네싘':'마그네슘','마그네슘':'마그네슘','magnesium':'마그네슘',
  '코큐텐':'코큐텐10','코엔자임큐텐':'코큐텐10','코큐텐10':'코큐텐10','coq10':'코큐텐10','CoQ10':'코큐텐10',
  '비타민 D':'비타민D','비타민d':'비타민D','vitamind':'비타민D','Vitamin D':'비타민D',
  '오메가-3':'오메가3','오메가 3':'오메가3','omega3':'오메가3','Omega-3':'오메가3','omega-3':'오메가3',
  '비타민 C':'비타민C','비타민c':'비타민C',
  '비타민 B군':'비타민B군','비타민B':'비타민B군','비타민b군':'비타민B군','비타민 B':'비타민B군',
  '프로바이오틱스':'유산균','유산균':'유산균',
  '밀크시슬':'밀크시슬','밀크씨슬':'밀크시슬',
  '종합 비타민':'종합비타민','멀티비타민':'종합비타민','멀티':'종합비타민',
  '프로틴':'단백질','프로틴파우더':'단백질','단백질 파우더':'단백질',
};

function norm(name){
  const s=String(name||'').trim();
  if(!s)return '';
  if(ALIAS[s])return ALIAS[s];
  const compact=s.replace(/\s+/g,'');
  if(ALIAS[compact])return ALIAS[compact];
  const hit=CATALOG.find(c=>c.name===s||c.name===compact||c.id===s);
  return hit?hit.name:s;
}
function byName(name){const n=norm(name);return CATALOG.find(c=>c.name===n)||null;}
function migrateList(arr){
  const src=Array.isArray(arr)&&arr.length?arr:['종합비타민'];
  const out=[];
  src.forEach(x=>{const n=norm(x);if(n&&!out.includes(n))out.push(n);});
  return out.length?out:['종합비타민'];
}

function flagsFromHealth(){
  const set=new Set();
  try{
    if(typeof DGHealth==='undefined'||!DGHealth.latest)return set;
    const cu=DGHealth.latest();if(!cu)return set;
    const cls=DGHealth.classify(cu.values||{},cu.sex);
    (cls.conditions||[]).forEach(c=>{if(c.code)set.add(c.code);});
    const rows=cls.rows||[];
    if(rows.some(r=>r.key==='tg'&&(r.level==='risk'||r.level==='warn')))set.add('tg');
  }catch(e){}
  return set;
}

function recommend(opt){
  opt=opt||{};
  const flags=opt.flags||flagsFromHealth();
  const has=k=>flags.has?flags.has(k):!!flags[k];
  const recs=[];
  const add=(name,why)=>{
    if(recs.some(r=>r.name===name))return;
    const spec=byName(name);
    recs.push({name,why,caution:spec&&spec.caution||'',need:true});
  };
  const losing=opt.weight!=null&&opt.goal!=null&&opt.weight>opt.goal+0.3;
  const prot=opt.prot,kcal=opt.kcal,closed=!!opt.closed;
  if(has('anemia'))add('철분','검진에서 빈혈 관련 표시가 있어요.');
  if(has('lipid')||has('tg'))add('오메가3','검진에서 지질·중성지방 관련 표시가 있어요.');
  if(has('liver'))add('밀크시슬','검진에서 간 관련 표시가 있어요. 치료제는 아니에요.');
  if(losing){
    add('단백질','감량 중에는 근육을 지키려고 단백질을 넉넉히 가져가는 편이 좋아요.');
    add('비타민D','감량 중에 자주 챙기는 항목이에요. 혈액 수치를 알면 더 정확해요.');
  }
  if((closed||(prot!=null&&prot>0))&&prot!=null&&prot<100)add('단백질','오늘 단백질이 목표(130g)보다 많이 부족해 보여요.');
  else if((closed||(prot!=null&&prot>0))&&prot!=null&&prot<130)add('단백질','오늘 단백질이 아직 130g에 못 미쳐요.');
  // 신장 주의: 단백질 추천에서 경고만 강화
  if(has('kidney')){
    recs.forEach(r=>{if(r.name==='단백질')r.caution='신장 기능 표시가 있어 단백질은 의사와 먼저 상의하는 게 좋아요. '+r.caution;});
  }
  return recs;
}

function overlaps(stack){
  const names=(stack||[]).map(norm);
  const out=[];
  names.forEach(n=>{
    const spec=byName(n);if(!spec||!spec.overlap)return;
    spec.overlap.forEach(o=>{
      if(names.includes(o)){
        const a=n<o?n:o,b=n<o?o:n;
        if(!out.some(x=>x.a===a&&x.b===b))out.push({a,b,text:`${n}와 ${o}는 성분이 겹칠 수 있어요. 용량을 한 번 확인해 주세요.`});
      }
    });
  });
  return out;
}
function missing(stack,recs){
  const have=new Set((stack||[]).map(norm));
  return (recs||[]).filter(r=>!have.has(norm(r.name)));
}
function unitFor(e){
  if(!e)return XP_GENERIC;
  if(e.need==='1'||e.value==='need')return XP_NEED;
  return XP_GENERIC;
}

const api={CATALOG,ALIAS,DISCLAIMER,XP_GENERIC,XP_NEED,XP_CAP,norm,byName,migrateList,flagsFromHealth,recommend,overlaps,missing,unitFor};
root.DGSup=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
