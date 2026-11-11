// 국가건강검진 판정 기준 (앱 표시: 정상 / 주의 / 위험(의심))
// 출처는 source 필드를 참고하세요. 이 파일은 공개 기준만 담고, 개인 검진 값은 넣지 않습니다.
const DG_HEALTH_RANGES={
  source:{
    main:'보건복지부 건강검진 실시기준 별표 「일반건강검진 및 의료급여 생애전환기검진 결과 판정기준」(국민건강보험). 원문의 정상A / 정상B(경계) / 질환의심을 이 앱에서는 정상 / 주의 / 위험(의심)으로 표시해요.',
    hba1c:'당화혈색소(HbA1c)는 국가건강검진 기본 판정표에 없어서, 대한당뇨병학회 진료지침을 참고했어요(5.7% 미만 정상, 5.7~6.4% 전단계, 6.5% 이상 당뇨병 의심).',
    disclaimer:'진단이 아니에요. 정확한 판단은 의사에게 받으세요.',
    refs:[
      'https://www.nhis.or.kr/nhis/policy/wbhada19700m01.do',
      '건강검진 실시기준 별표(법제처/보건복지부)'
    ]
  },
  items:{
    sbp:{key:'sbp',name:'수축기 혈압',unit:'mmHg',group:'bp',okMax:119,warnMax:139,higherBad:true,plausible:[70,250]},
    dbp:{key:'dbp',name:'이완기 혈압',unit:'mmHg',group:'bp',okMax:79,warnMax:89,higherBad:true,plausible:[40,160]},
    fpg:{key:'fpg',name:'공복혈당',unit:'mg/dL',group:'glucose',okMax:99,warnMax:125,higherBad:true,plausible:[40,500]},
    hba1c:{key:'hba1c',name:'당화혈색소(HbA1c)',unit:'%',group:'glucose',okMax:5.69,warnMax:6.49,higherBad:true,plausible:[3,15],note:'hba1c'},
    tc:{key:'tc',name:'총콜레스테롤',unit:'mg/dL',group:'lipid',okMax:199,warnMax:239,higherBad:true,plausible:[50,500]},
    ldl:{key:'ldl',name:'LDL 콜레스테롤',unit:'mg/dL',group:'lipid',okMax:129,warnMax:159,higherBad:true,plausible:[20,400]},
    hdl:{key:'hdl',name:'HDL 콜레스테롤',unit:'mg/dL',group:'lipid',okMin:60,warnMin:40,higherBad:false,plausible:[10,150]},
    tg:{key:'tg',name:'중성지방',unit:'mg/dL',group:'lipid',okMax:149,warnMax:199,higherBad:true,plausible:[20,2000]},
    ast:{key:'ast',name:'AST(SGOT)',unit:'U/L',group:'liver',okMax:40,warnMax:50,higherBad:true,plausible:[1,2000]},
    alt:{key:'alt',name:'ALT(SGPT)',unit:'U/L',group:'liver',okMax:35,warnMax:45,higherBad:true,plausible:[1,2000]},
    ggtp:{key:'ggtp',name:'γ-GTP',unit:'U/L',group:'liver',higherBad:true,plausible:[1,2000],bySex:{
      m:{okMin:11,okMax:63,warnMax:77},
      f:{okMin:8,okMax:35,warnMax:45}
    }},
    creat:{key:'creat',name:'혈청 크레아티닌',unit:'mg/dL',group:'kidney',okMax:1.5,higherBad:true,plausible:[0.2,15]},
    egfr:{key:'egfr',name:'eGFR',unit:'mL/min/1.73m²',group:'kidney',okMin:60,higherBad:false,plausible:[5,200]},
    hb:{key:'hb',name:'혈색소',unit:'g/dL',group:'anemia',plausible:[5,25],bySex:{
      m:{okMin:13.0,okMax:16.5,warnMin:12.0,warnMax:16.5},
      f:{okMin:12.0,okMax:15.5,warnMin:10.0,warnMax:15.5}
    }},
    uprotein:{key:'uprotein',name:'요단백',unit:'',group:'kidney',kind:'urine',plausible:null},
    waist:{key:'waist',name:'허리둘레',unit:'cm',group:'bmi',higherBad:true,plausible:[40,200],bySex:{
      m:{okMax:89.9,riskMin:90},
      f:{okMax:84.9,riskMin:85}
    }},
    bmi:{key:'bmi',name:'BMI',unit:'kg/m²',group:'bmi',okMin:18.5,okMax:24.9,warnMax:29.9,higherBad:true,plausible:[10,80]},
    weight:{key:'weight',name:'체중',unit:'kg',group:'bmi',kind:'record',plausible:[30,300]}
  }
};
if(typeof module!=='undefined'&&module.exports)module.exports=DG_HEALTH_RANGES;
if(typeof window!=='undefined')window.DG_HEALTH_RANGES=DG_HEALTH_RANGES;
