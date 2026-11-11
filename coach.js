// 다이어트 게임 0.4.5 — 규칙 기반 코치 (기기 안, 참고용)
(function(root){
const DISCLAIMER='건강 정보는 참고용이에요. 진단이 아니며, 정확한 판단은 의사에게 받으세요.';
const SOURCE='기준: 식단 1,600~2,000kcal · 단백질 130g+, 물 2L, 걷기 40~60분 (게임 규칙). 검진 표시는 국가건강검진 판정을 참고했어요.';

function tips(C,ctx){
  if(!C||!C.days)return [];
  ctx=ctx||{};
  const d=C.today|| (typeof today==='function'?today():'');
  const t=C.days[d]||{};
  const out=[];
  const push=(id,text,pri)=>out.push({id,text,pri});
  const last=ctx.lastMeal|| (typeof window!=='undefined'&&window._dgLastMealLog);
  if(last&&last.value&&(!last.date||last.date===d)){
    const k=+last.kcal||0,p=+(last.protein_g!=null?last.protein_g:last.protein)||0,na=+(last.sodium_mg!=null?last.sodium_mg:last.sodium)||0;
    const slot=last.item||'이 끼니';
    push('meal-just','방금 '+slot+' '+last.value+'는 약 '+Math.round(k)+'kcal, 단백질 '+Math.round(p)+'g'+(na?(', 나트륨 '+Math.round(na)+'mg'):'')+'이에요.',8);
    const remainK=1800-(t.kcal||0),remainP=130-(t.prot||0);
    if(remainP>40)push('next-prot','다음 끼니는 단백질 '+Math.round(remainP)+'g 정도를 채워 보세요. 포케·국밥·닭가슴살샐러드가 잘 맞아요.',9);
    else if(remainK<400)push('next-light','오늘은 벌써 '+Math.round(t.kcal||0)+'kcal예요. 다음 끼니는 가볍게 샐러드나 국물로 맞춰 보세요.',9);
    else push('next-kcal','다음 끼니는 대략 '+Math.round(Math.max(0,remainK))+'kcal, 단백질 '+Math.round(Math.max(0,remainP))+'g을 목표로 하면 하루 균형이 맞아요.',9);
    if((t.sodium||0)>=1600)push('na','오늘 나트륨이 약 '+Math.round(t.sodium)+'mg이에요. 목표 2,300mg(한국인 영양소 섭취기준) 안쪽으로 다음 끼니는 싱겁게 해 보세요.',10);
  }
  // checkup flags (short, non-diagnostic)
  try{
    if(typeof DGHealth!=='undefined'&&DGHealth.latest){
      const cu=DGHealth.latest();
      if(cu){
        const cls=DGHealth.classify(cu.values||{},cu.sex);
        const codes=new Set((cls.conditions||[]).map(c=>c.code));
        if(codes.has('htn'))push('flag-bp','혈압 표시가 있어요. 짜게 먹지 않고, 가능하면 집에서 한 번 재 보세요.',10);
        if(codes.has('dm'))push('flag-dm','혈당 관련 표시가 있어요. 달달한 음료를 줄이고 식후에 가볍게 걸어 보세요.',10);
        if(codes.has('lipid'))push('flag-lipid','지질 관련 표시가 있어요. 튀김을 줄이고 오늘 걷기만 채워도 도움이 돼요.',11);
        if(codes.has('bmi')||codes.has('waist'))push('flag-wt','체중·허리 표시가 있어요. 단백질을 챙기면서 천천히 줄이는 쪽이 좋아요.',12);
      }
    }
  }catch(e){}
  const prot=t.prot||0,kcal=t.kcal||0,closed=!!t.closed,meals=t.mealCount||0;
  if(meals>0||closed){
    if(prot<100)push('prot-low','오늘 단백질이 '+Math.round(prot)+'g이에요. 목표 130g까지 닭가슴살·계란·그릭요거트로 채워 보세요.',20);
    else if(prot<130)push('prot-mid','단백질 '+Math.round(prot)+'g, 아직 130g이 안 됐어요. 저녁에 한 끼만 보강해도 좋아요.',24);
    else push('prot-ok','단백질 '+Math.round(prot)+'g으로 목표(130g)를 넘겼어요. 이 페이스를 유지해 보세요.',80);
  }else{
    push('meal-none','아직 식사가 없어요. 끼니를 적으면 칼로리·단백질 팁을 바로 보여 드려요.',40);
  }
  if(closed){
    if(kcal<1600)push('kcal-low','오늘 '+Math.round(kcal)+'kcal로 마감됐어요. 1,600kcal 미만이면 식단 점수가 없고, 너무 적게 먹으면 오래가기 어려워요.',18);
    else if(kcal>2300)push('kcal-high','오늘 '+Math.round(kcal)+'kcal이에요. 목표 1,800kcal 안팎보다 많아요. 다음 끼니만 조금 가볍게 해 보세요.',22);
    else if(kcal<=2000)push('kcal-ok','칼로리 '+Math.round(kcal)+'kcal로 목표 구간에 있어요.',82);
  }
  if((t.water||0)<2)push('water','물이 '+(t.water||0)+'L예요. 2L를 채우면 +5 XP도 있어요.',30);
  else push('water-ok','물 '+(t.water||0)+'L를 채웠어요.',85);
  if(!t.rest&&(t.walk||0)<40)push('walk','걷기가 '+(t.walk||0)+'분이에요. 40~60분이 가장 가산이 커요.',28);
  else if(!t.rest&&(t.walk||0)>60)push('walk-long','오늘 '+(t.walk||0)+'분 걸었어요. 많이 걸은 날은 무릎만 무리 없게 쉬어 주세요.',50);
  const mealsMap=t.meals||{};
  if(mealsMap['야식']&&!mealsMap['아침'])push('timing','아침에 비고 야식이 있어요. 다음엔 아침·아점을 먼저 채워 보세요.',26);
  else if(mealsMap['야식'])push('night','야식이 기록돼 있어요. 가능하면 저녁을 조금 앞당기고 야식은 가볍게 해 보세요.',36);
  else if(meals>0&&!mealsMap['아침']&&!mealsMap['아점'])push('no-breakfast','아침·아점 기록이 없어요. 하루 앞쪽에 단백질을 두면 저녁이 덜 세져요.',38);
  // pick 1-3 highest priority (lower pri number = more important), avoid too many "ok"
  out.sort((a,b)=>a.pri-b.pri);
  const urgent=out.filter(x=>x.pri<70).slice(0,3);
  if(urgent.length)return urgent;
  return out.slice(0,2);
}

function weekSummary(C){
  if(!C||!C.days)return null;
  const end=C.today|| (typeof today==='function'?today():'');
  const dn=typeof window!=='undefined'&&window.dn?window.dn:(root.dn);
  const ds=typeof window!=='undefined'&&window.ds?window.ds:(root.ds);
  // use C.days keys: last 7 days including today
  const dates=Object.keys(C.days).filter(d=>d<=end).sort();
  const last=dates.slice(-7);
  if(!last.length)return null;
  let w=[],kcal=[],prot=[],walk=0,water=0,closed=0,meals=0;
  last.forEach(d=>{
    const t=C.days[d];if(!t)return;
    if(t.weight!=null)w.push(t.weight);
    if(t.closed){closed++;kcal.push(t.kcal||0);prot.push(t.prot||0);}
    meals+=t.mealCount||0;
    if((t.walk||0)>=40)walk++;
    if((t.water||0)>=2)water++;
  });
  const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length):null;
  const lines=[];
  if(w.length>=2){
    const d=+(w[w.length-1]-w[0]).toFixed(1);
    lines.push('체중 '+(d>0?'+':'')+d+'kg ('+w[0].toFixed(1)+'→'+w[w.length-1].toFixed(1)+')');
  }else if(w.length===1)lines.push('체중 기록 '+w[0].toFixed(1)+'kg');
  else lines.push('이번 주 체중 기록이 아직 없어요');
  if(closed)lines.push('마감 '+closed+'일 · 평균 '+(avg(kcal)|0)+'kcal · 단백질 '+(avg(prot)|0)+'g');
  else if(meals)lines.push('식사는 적었지만 마감이 없어요. 적고 마감하면 점수가 붙어요.');
  lines.push('걷기 40분+ '+walk+'일 · 물 2L '+water+'일');
  return {days:last.length,from:last[0],to:last[last.length-1],lines};
}

function card(C,ctx){
  const t=tips(C,ctx);
  const w=weekSummary(C);
  const tipsH=t.length?t.map(x=>`<div class="coach-tip">${esc(x.text)}</div>`).join(''):'<div class="muted">기록이 쌓이면 오늘 팁을 보여 드려요.</div>';
  const weekH=w?`<div class="coach-week"><b>이번 주 한눈에</b>${w.lines.map(l=>`<div>${esc(l)}</div>`).join('')}</div>`:'';
  return `<div class="card coach-card" id="coachCard"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">오늘의 코치</h3><span class="muted" style="font-size:11px">규칙 기반</span></div>
    ${tipsH}
    ${weekH}
    <div class="muted" style="font-size:11px;line-height:15px;margin-top:8px">${esc(SOURCE)}</div>
    <div class="muted" style="font-size:11px;margin-top:4px">${esc(DISCLAIMER)}</div></div>`;
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const api={DISCLAIMER,SOURCE,tips,weekSummary,card};
root.DGCoach=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
