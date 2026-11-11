// 다이어트 게임 0.4.3 — Google 로그인·동기화 (Supabase Auth, 기획서 v3 6절)
// SB_ANON은 공개용 anon 키입니다. service_role·관리 토큰·DB 비밀번호는 넣지 않습니다.
const SB_URL='https://ifdgncmhpclthudlvowe.supabase.co';
const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZGduY21ocGNsdGh1ZGx2b3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNDgzMTAsImV4cCI6MjEwOTkyNDMxMH0.XFJoRuKM0FOxmK2fbHb7kkdO_2dKp_RN-YIflWiJzvw';
const SESSKEY='dg_session_v1', GATEKEY='dg_gate_v1', PKCEKEY='dg_pkce_v1', BACKKEY='dg_merge_backup_v1', SYNCKEY='dg_sync_on_v1';
const FACE_NEVER=['dg_face_v1','dg_health_v1','face','faceData','photo','photoDataUrl','avatarFace','health','checkup','checkups','sbp','dbp','fpg','hba1c','lab','labs'];

const DGAuth=(function(){
  let session=null, syncOn=false, syncText='동기화 안 함', pushTimer=0, busy=false;

  function setSyncOn(v,text){
    syncOn=!!v;
    if(syncOn)localStorage.setItem(SYNCKEY,'1');
    else localStorage.removeItem(SYNCKEY);
    if(text)syncText=text;
  }
  const appBase=()=>{let p=location.pathname.replace(/index\.html$/,'');if(!p.endsWith('/'))p+='/';return location.origin+p;};
  const hdr=(tok)=>({apikey:SB_ANON,'Content-Type':'application/json',Authorization:'Bearer '+(tok||SB_ANON)});
  const evKey=e=>[e.date,e.type,e.item,e.value||''].join('\0');
  const evScore=e=>['kcal','protein_g','kcal_source','note','id'].reduce((n,k)=>n+(e[k]?1:0),0);

  function isDefaultLocal(evs){
    evs=evs||[];
    if(!evs.length)return true;
    if(evs.length!==SEED.length)return false;
    const sk=new Set(SEED.map(e=>evKey(e)));
    return evs.every(e=>sk.has(evKey(e)));
  }
  function mergeEvents(a,b){
    const all=[...(a||[]),...(b||[])].map(e=>Object.assign({},e));
    const byId=new Map(), rest=[];
    for(const e of all){if(e.id){const p=byId.get(e.id);if(!p||evScore(e)>evScore(p))byId.set(e.id,e);}else rest.push(e);}
    const byKey=new Map();
    for(const e of [...byId.values(),...rest]){
      const k=evKey(e),p=byKey.get(k);
      if(!p||evScore(e)>evScore(p))byKey.set(k,e);
    }
    return [...byKey.values()].sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:0);
  }
  function backup(side,events,profile){
    try{localStorage.setItem(BACKKEY,JSON.stringify({at:new Date().toISOString(),side,events,profile}));}catch(e){}
  }
  function summaryOf(evs){
    const prev=raw; raw=evs||[];
    let s;
    try{
      const C=compute();
      const dates=(evs||[]).map(e=>e.date).filter(Boolean).sort();
      s={xp:C.total,level:C.level,weight:C.weight,from:dates[0]||'-',to:dates[dates.length-1]||'-',n:(evs||[]).length};
    }finally{raw=prev;}
    return s;
  }
  function sanitizeEvents(evs){
    return (evs||[]).map(e=>{
      const o={}; for(const k in e){if(!FACE_NEVER.includes(k))o[k]=e[k];}
      if(o.type==='health_quest'){o.value='1';o.note='';}
      return o;
    }).filter(e=>e.type!=='health'&&e.type!=='checkup');
  }
  function profileOf(){
    const u=session&&session.user;
    const favs=Array.isArray(settings.favMenus)?settings.favMenus.map(f=>({name:f.name,dishId:f.dishId||'',count:+f.count||1,last:f.last||'',store:f.store||'',kcal:f.kcal,protein:f.protein,carbs:f.carbs,fat:f.fat,sodium:f.sodium})):[];
    const leftovers=(typeof DGDelivery!=='undefined'&&DGDelivery.mergeLeftovers?DGDelivery.mergeLeftovers(settings.leftovers||[],[]):(Array.isArray(settings.leftovers)?settings.leftovers:[])).map(x=>(typeof DGDelivery!=='undefined'&&DGDelivery.sanitizeLeftover?DGDelivery.sanitizeLeftover(x):x)).filter(Boolean);
    let faceParams=null;
    try{
      const raw=localStorage.getItem('dg_face_v1');
      if(raw&&!raw.startsWith('data:')){
        const o=JSON.parse(raw);
        faceParams=(typeof DGFace!=='undefined'&&DGFace.sanitize)?DGFace.sanitize(o):o;
        if(faceParams){delete faceParams.photo;delete faceParams.photoDataUrl;delete faceParams.dataUrl;delete faceParams.image;delete faceParams._ms;}
      }
    }catch(e){faceParams=null;}
    return {goal:settings.goal,month:settings.month,height:HEIGHT,display_name:(u&&(u.name||u.email))||'',vitamins:Array.isArray(settings.vitamins)?settings.vitamins.slice():['종합비타민'],favMenus:favs,leftovers,faceParams};
  }
  function applyProfile(p){
    if(!p||typeof p!=='object')return;
    if(p.goal>0)settings.goal=+p.goal;
    if(p.month>0)settings.month=+p.month;
    if(Array.isArray(p.vitamins)){
      const vs=[...new Set(p.vitamins.map(x=>String(x).trim()).filter(Boolean))];
      settings.vitamins=vs.length?vs:(settings.vitamins||['종합비타민']);
    }
    if(Array.isArray(p.favMenus)){
      const local=Array.isArray(settings.favMenus)?settings.favMenus:[];
      settings.favMenus=(typeof DGDelivery!=='undefined'&&DGDelivery.mergeFavs)?DGDelivery.mergeFavs(local,p.favMenus):p.favMenus.slice();
    }
    if(Array.isArray(p.leftovers)){
      const local=Array.isArray(settings.leftovers)?settings.leftovers:[];
      settings.leftovers=(typeof DGDelivery!=='undefined'&&DGDelivery.mergeLeftovers)?DGDelivery.mergeLeftovers(local,p.leftovers):p.leftovers.slice();
    }
    if(p.faceParams&&typeof p.faceParams==='object'){
      const incoming=(typeof DGFace!=='undefined'&&DGFace.sanitize)?DGFace.sanitize(p.faceParams):p.faceParams;
      delete incoming.photo;delete incoming.photoDataUrl;delete incoming.image;delete incoming.dataUrl;
      try{
        let local={};
        const raw=localStorage.getItem('dg_face_v1');
        if(raw&&!raw.startsWith('data:')) local=JSON.parse(raw)||{};
        const merged=(typeof DGFace!=='undefined'&&DGFace.sanitize)?DGFace.sanitize(Object.assign({},local,incoming)):Object.assign({},local,incoming);
        delete merged.photo;
        localStorage.setItem('dg_face_v1',JSON.stringify(merged));
        if(window.DGAvatar)DGAvatar.setLook(merged);
      }catch(e){}
    }
    localStorage.setItem(SKEY,JSON.stringify(settings));
  }
  function setRaw(evs){raw=Array.isArray(evs)?evs.map(e=>Object.assign({},e)):[];localStorage.setItem(KEY,JSON.stringify(raw));}

  function loadSession(){
    try{session=JSON.parse(localStorage.getItem(SESSKEY)||'null');}catch(e){session=null;}
    if(!session||!session.access_token||!session.user)session=null;
    return session;
  }
  function saveSession(){
    if(session)localStorage.setItem(SESSKEY,JSON.stringify(session));
    else localStorage.removeItem(SESSKEY);
  }
  function clearSession(){session=null;setSyncOn(false,'동기화 안 함');saveSession();localStorage.removeItem(PKCEKEY);}

  async function sha256b64url(s){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function randVerifier(){
    const a=new Uint8Array(32); crypto.getRandomValues(a);
    return Array.from(a,b=>('0'+b.toString(16)).slice(-2)).join(''); // 64 hex chars
  }

  async function refreshIfNeeded(){
    if(!session||!session.refresh_token)return session;
    const now=Date.now()/1000;
    if(session.expires_at && session.expires_at-now>30)return session;
    const r=await fetch(SB_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:hdr(),body:JSON.stringify({refresh_token:session.refresh_token})});
    if(!r.ok){clearSession();return null;}
    await applyToken(await r.json());
    return session;
  }
  async function applyToken(tok, user){
    if(!tok||!tok.access_token)throw new Error('no token');
    let u=user;
    if(!u){
      const r=await fetch(SB_URL+'/auth/v1/user',{headers:hdr(tok.access_token)});
      if(r.ok)u=await r.json();
    }
    const meta=(u&&(u.user_metadata||u.raw_user_meta_data))||{};
    session={
      access_token:tok.access_token,
      refresh_token:tok.refresh_token||(session&&session.refresh_token)||'',
      expires_at: tok.expires_at || (tok.expires_in? (Date.now()/1000+ +tok.expires_in):0),
      user:{id:u&&u.id, email:(u&&u.email)||'', name:meta.full_name||meta.name||meta.user_name||''}
    };
    saveSession();
  }

  async function rest(path, opt){
    const s=await refreshIfNeeded();
    if(!s||!s.access_token)throw new Error('no session');
    const r=await fetch(SB_URL+path,Object.assign({},opt,{headers:Object.assign(hdr(s.access_token),(opt&&opt.headers)||{})}));
    if(r.status===401){
      clearSession();
      throw new Error('auth');
    }
    return r;
  }

  async function pullRow(){
    const r=await rest('/rest/v1/user_data?select=events,profile,updated_at');
    if(!r.ok)throw new Error('pull '+r.status);
    const rows=await r.json();
    return rows[0]||null;
  }
  async function pushRow(){
    if(!session||!session.access_token||session.demo)return;
    if(!syncOn)return;
    const body={
      user_id:session.user.id,
      events:sanitizeEvents(raw),
      profile:profileOf(),
      updated_at:new Date().toISOString()
    };
    const r=await rest('/rest/v1/user_data?on_conflict=user_id',{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(body)
    });
    if(!r.ok){
      const t=await r.text().catch(()=>(''));
      throw new Error('push '+r.status+' '+t.slice(0,120));
    }
    syncText='동기화됨 · 방금';
  }
  function schedulePush(){
    if(!syncOn||!session||!session.access_token||session.demo)return;
    syncText='동기화 대기 중';
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>{pushRow().catch(()=>{syncText='동기화 실패 · 나중에 다시 시도';});},800);
  }

  function awardFirstSync(){
    if(raw.some(e=>e.type==='achievement'&&e.item==='첫 동기화'))return;
    raw.push(withId({date:today(),type:'achievement',item:'첫 동기화',value:'',note:'로컬↔계정 첫 동기화'}));
    localStorage.setItem(KEY,JSON.stringify(raw));
  }

  async function startGoogle(){
    if(!navigator.onLine)return toast('인터넷에 연결한 뒤 로그인해 주세요.');
    try{
      const verifier=randVerifier();
      const challenge=await sha256b64url(verifier);
      localStorage.setItem(PKCEKEY,verifier);
      const redirect=appBase();
      const q=new URLSearchParams({
        provider:'google',
        redirect_to:redirect,
        code_challenge:challenge,
        code_challenge_method:'S256'
      });
      location.href=SB_URL+'/auth/v1/authorize?'+q.toString();
    }catch(e){
      toast('로그인을 시작하지 못했어요');
    }
  }

  async function handleRedirect(){
    const usp=new URLSearchParams(location.search);
    const hash=new URLSearchParams((location.hash||'').replace(/^#/,''));
    const err=usp.get('error')||hash.get('error');
    const desc=usp.get('error_description')||hash.get('error_description');
    const code=usp.get('code');
    const access=hash.get('access_token');
    if(err){
      cleanUrl();
      toast('로그인에 실패했어요'+(desc?': '+decodeURIComponent(desc).slice(0,80):''));
      return false;
    }
    if(code){
      const verifier=localStorage.getItem(PKCEKEY);
      localStorage.removeItem(PKCEKEY);
      cleanUrl();
      if(!verifier){toast('로그인 정보가 만료됐어요. 다시 시도해 주세요.');return false;}
      const r=await fetch(SB_URL+'/auth/v1/token?grant_type=pkce',{
        method:'POST',headers:hdr(),
        body:JSON.stringify({auth_code:code,code_verifier:verifier})
      });
      if(!r.ok){const t=await r.text().catch(()=>(''));toast('로그인에 실패했어요');console.warn('pkce',r.status,t.slice(0,200));return false;}
      await applyToken(await r.json());
      return true;
    }
    if(access){
      cleanUrl();
      await applyToken({
        access_token:access,
        refresh_token:hash.get('refresh_token')||'',
        expires_in:+hash.get('expires_in')||3600
      });
      return true;
    }
    return false;
  }
  function cleanUrl(){
    try{history.replaceState({},'',appBase());}catch(e){}
  }

  function showGate(mode, html){
    document.body.classList.add('gate');
    const el=$('#gate');
    el.className='on';
    if(html)el.innerHTML=html;
    else if(mode==='wait')el.innerHTML=`<div class="gate-night"><div class="gate-stars" aria-hidden="true"></div><div class="gate-inner"><div class="gate-char"><img src="char.png" alt=""></div><h1 style="color:#fff;font-size:36px;line-height:44px;font-weight:900;margin-top:28px">다이어트 게임</h1><p style="margin:8px 0 0;color:#C3C8EE;font-size:16px">로그인하고 있어요…</p></div></div>`;
    $('#nav').style.display='none';
  }
  function hideGate(){
    document.body.classList.remove('gate');
    const el=$('#gate');
    el.className=''; el.innerHTML='';
    $('#nav').style.display='';
  }
  function loginHTML(){
    return `<div class="gate-night"><div class="gate-stars" aria-hidden="true"></div>
      <div class="gate-inner">
      <div class="gate-char"><img src="char.png" alt="캐릭터"></div>
      <h1 style="color:#fff;font-size:36px;line-height:44px;font-weight:900;letter-spacing:-.03em;margin-top:28px">다이어트 게임</h1>
      <p style="margin:8px 0 18px;color:#C3C8EE;font-size:16px">기록할수록 레벨업, 빠질수록 변신</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:36px;flex-wrap:wrap"><span class="stat-chip glass">📋 퀘스트</span><span class="stat-chip glass">⬆️ 레벨업</span><span class="stat-chip glass">🧍 아바타 변신</span></div>
      <button type="button" class="btn-secondary btn-lg" style="border:0;margin-bottom:12px;font-weight:800" onclick="DGAuth.startGoogle()"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.6 7.2l6.2 5.2C37.1 41.5 44 36 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg> Google 계정으로 시작하기</button>
      <button type="button" class="btn-ghost btn-lg" style="color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35)" onclick="DGAuth.continueGuest()">게스트로 계속하기</button>
      <p class="gnote">🔒 얼굴 사진은 폰에만 저장돼요<br>게스트 기록은 나중에 계정으로 옮길 수 있어요</p>
      </div></div>`;
  }
  function showLogin(){showGate('login',loginHTML());}

  function continueGuest(){
    localStorage.setItem(GATEKEY,'guest');
    ensureSeed();
    hideGate();
    tab='home';
    render();
  }

  function openLogin(){showLogin();}

  async function afterLogin(fresh){
    localStorage.setItem(GATEKEY,'in');
    try{
      const row=await pullRow();
      const remoteE=(row&&row.events)||[];
      const remoteP=(row&&row.profile)||{};
      const localE=raw||[];
      const locDef=isDefaultLocal(localE), remDef=isDefaultLocal(remoteE);
      if(locDef && remDef){
        ensureSeed();
        setSyncOn(true,'동기화됨 · 방금');
        awardFirstSync();
        await pushRow();
      }else if(!locDef && remDef){
        const ok=confirm('이 폰 기록을 계정에 올릴까요?');
        if(ok){
          backup('account',remoteE,remoteP);
          setSyncOn(true,'동기화됨 · 방금');
          awardFirstSync();
          await pushRow();
        }else{
          setSyncOn(false,'아직 계정에 올리지 않았어요');
        }
      }else if(locDef && !remDef){
        backup('phone',localE,profileOf());
        setRaw(remoteE);
        applyProfile(remoteP);
        setSyncOn(true,'동기화됨 · 방금');
        awardFirstSync();
        await pushRow();
      }else{
        const choice=await askConflict(localE,remoteE);
        if(choice==='phone'){
          backup('account',remoteE,remoteP);
          setSyncOn(true,'동기화됨 · 방금'); awardFirstSync(); await pushRow();
        }else if(choice==='account'){
          backup('phone',localE,profileOf());
          setRaw(remoteE); applyProfile(remoteP);
          setSyncOn(true,'동기화됨 · 방금'); awardFirstSync(); await pushRow();
        }else{
          backup('both',{local:localE,remote:remoteE},{local:profileOf(),remote:remoteP});
          const merged=mergeEvents(localE,remoteE);
          setRaw(merged);
          // settings: keep local goals if set, else remote
          if(isDefaultLocal(localE))applyProfile(remoteP);
          setSyncOn(true,'동기화됨 · 방금'); awardFirstSync(); await pushRow();
        }
      }
    }catch(e){
      setSyncOn(false, navigator.onLine?'동기화 실패 · 나중에 다시 시도':'오프라인 · 연결되면 다시 시도');
      if(isDefaultLocal(raw))ensureSeed();
    }
    if(fresh)await confirmProfile();
  }

  function askConflict(localE,remoteE){
    const L=summaryOf(localE), R=summaryOf(remoteE);
    return new Promise(res=>{
      const box=`<div class="gate-form"><div class="gwrap">
        <h2 style="text-align:center;margin:8px 0 12px">기록이 둘 다 있어요</h2>
        <p class="muted">이 폰과 계정 기록을 어떻게 할까요? 덮기 전에 반대쪽은 이 폰에 백업해 둡니다.</p>
        <div class="card"><b>이 폰</b><div class="muted">${L.from} ~ ${L.to} · ${L.n}건<br>누적 ${L.xp} XP (Lv.${L.level}) · 최근 ${(+L.weight).toFixed(1)}kg</div></div>
        <div class="card"><b>계정</b><div class="muted">${R.from} ~ ${R.to} · ${R.n}건<br>누적 ${R.xp} XP (Lv.${R.level}) · 최근 ${(+R.weight).toFixed(1)}kg</div></div>
        <button type="button" class="btn-secondary btn-block" onclick="DGAuth._pick('phone')">이 폰 기록으로 덮기</button>
        <button type="button" class="btn-secondary btn-block" style="margin-top:8px" onclick="DGAuth._pick('account')">계정 기록으로 덮기</button>
        <button type="button" class="btn-primary btn-block" style="margin-top:8px" onclick="DGAuth._pick('merge')">합치기</button>
      </div></div>`;
      showGate('merge',box);
      DGAuth._pick=(k)=>{DGAuth._pick=()=>{};res(k);};
    });
  }

  function confirmProfile(){
    return new Promise(res=>{
      const C=compute();
      const box=`<div class="gate-form"><div class="gwrap">
        <h2 style="text-align:center;margin-bottom:8px">프로필 확인</h2>
        <p class="muted">키는 186cm로 고정이에요. 목표만 수정할 수 있어요.</p>
        <div class="rowx" style="margin-bottom:10px"><label class="field"><span class="label">키(cm) 🔒</span><input class="input" type="number" value="${HEIGHT}" disabled></label>
          <label class="field"><span class="label">시작 체중(kg)</span><input class="input" type="number" value="${START_W}" disabled></label></div>
        <label class="field" style="margin-bottom:10px"><span class="label">현재 체중(kg)</span><input class="input" id="pfW" type="number" step="0.1" value="${C.weight.toFixed(1)}" disabled></label>
        <label class="field" style="margin-bottom:10px"><span class="label">이번 달 목표(kg)</span><input class="input" id="pfM" type="number" step="0.5" value="${settings.month}"></label>
        <label class="field" style="margin-bottom:14px"><span class="label">장기 목표(kg)</span><input class="input" id="pfG" type="number" step="0.5" value="${settings.goal}"></label>
        <button type="button" class="btn-primary btn-lg" onclick="DGAuth._saveProfile()">시작하기</button>
      </div></div>`;
      showGate('profile',box);
      DGAuth._saveProfile=()=>{
        const m=+$('#pfM').value,g=+$('#pfG').value;
        if(m>0)settings.month=m; if(g>0)settings.goal=g;
        localStorage.setItem(SKEY,JSON.stringify(settings));
        schedulePush();
        DGAuth._saveProfile=()=>{};
        res();
      };
    });
  }

  async function logout(){
    try{
      if(session&&session.access_token){
        await fetch(SB_URL+'/auth/v1/logout',{method:'POST',headers:hdr(session.access_token)});
      }
    }catch(e){}
    clearSession();
    localStorage.removeItem(GATEKEY);
    toast('로그아웃했어요. 이 폰 기록은 그대로예요.');
    showLogin();
  }

  async function deleteAccount(){
    if(!session||!session.access_token)return toast('로그인이 필요해요');
    if(!confirm('계정을 삭제할까요? 서버에 있는 기록이 지워집니다.'))return;
    if(!confirm('정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;
    const wipe=confirm('폰에 있는 기록도 지울까요?\n확인: 이 폰 기록도 삭제\n취소: 이 폰 기록은 남김');
    try{
      const r=await rest('/rest/v1/rpc/delete_my_account',{method:'POST',body:'{}'});
      if(!r.ok)throw new Error('rpc '+r.status);
    }catch(e){
      return toast('계정 삭제에 실패했어요');
    }
    clearSession();
    localStorage.removeItem(GATEKEY);
    if(wipe){
      raw=[]; settings={goal:95,month:109,vitamins:['종합비타민'],favMenus:[],leftovers:[]};
      localStorage.removeItem(KEY); localStorage.removeItem(SKEY);
    }
    toast(wipe?'계정을 삭제하고 폰 기록도 지웠어요':'계정을 삭제했어요. 이 폰 기록은 남아 있어요.');
    showLogin();
  }

  async function uploadNow(){
    if(!session)return openLogin();
    setSyncOn(true,'동기화 중');
    try{
      awardFirstSync();
      await pushRow();
      toast('계정에 올렸어요');
      render();
    }catch(e){setSyncOn(false,'동기화 실패 · 나중에 다시 시도');toast('올리지 못했어요');}
  }

  const GICO='<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.6 7.2l6.2 5.2C37.1 41.5 44 36 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>';
  function accountCard(){
    if(!session||!session.user){
      return `<div class="card" id="accountCard" style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--mint-50);display:grid;place-items:center;font-size:22px;flex:none">👤</div>
        <div style="flex:1;min-width:0"><b style="color:var(--ink-900)">게스트로 이용 중</b>
          <div class="muted">기록은 이 폰에만 저장돼요. Google 계정으로 백업하고 다른 기기와 맞출 수 있어요.</div></div>
        <button type="button" class="btn-secondary btn-block" style="margin-top:4px" onclick="DGAuth.startGoogle()">${GICO} Google 계정으로 시작하기</button>
      </div>`;
    }
    const u=session.user;
    const who=(u.email||u.name||'로그인됨');
    const canUpload=!syncOn;
    return `<div class="card" id="accountCard" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="width:48px;height:48px;border-radius:50%;background:var(--mint-50);display:grid;place-items:center;font-size:22px;flex:none">☁️</div>
      <div style="flex:1;min-width:0"><b style="color:var(--ink-900)">로그인됨</b>
        <div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${who} · <span id="syncStatus" style="color:var(--mint-700);font-weight:700">${syncText}</span></div></div>
      ${canUpload?'<button type="button" class="btn-primary btn-block" onclick="DGAuth.uploadNow()">이 폰 기록을 계정에 올리기</button>':''}
    </div>`;
  }
  function accountActions(){
    if(!session||!session.user)return '';
    return `<div class="card"><h3>계정</h3><div class="muted" style="margin-bottom:10px">얼굴 사진은 계정에 올리지 않고 이 폰에만 둡니다.</div>
      <div class="rowx"><button type="button" class="btn-secondary" onclick="DGAuth.logout()">로그아웃</button>
      <button type="button" class="btn-ghost" style="color:var(--coral-600);box-shadow:inset 0 0 0 1.5px #FFC9C2" onclick="DGAuth.deleteAccount()">계정 삭제</button></div></div>`;
  }

  async function quietSync(){
    const row=await pullRow();
    if(row&&Array.isArray(row.events)&&row.events.length){
      setRaw(mergeEvents(raw,row.events));
    }
    await pushRow();
  }

  async function boot(){
    loadSession();
    if(session&&localStorage.getItem(SYNCKEY)==='1')setSyncOn(true, navigator.onLine?'동기화 중':'오프라인 · 연결되면 다시 시도');
    const params=location.search+location.hash;
    if(/[?&#](code|error|access_token)=/.test(params)){
      showGate('wait');
      const ok=await handleRedirect();
      if(ok&&session){
        await afterLogin(true);
        hideGate();
        tab='home';
        render();
        return;
      }
      showLogin();
      return;
    }
    if(session){
      try{await refreshIfNeeded();}catch(e){}
      if(session){
        hideGate();
        try{
          if(syncOn)await quietSync();
          else await afterLogin(false);
        }catch(e){if(isDefaultLocal(raw))ensureSeed();}
        if(isDefaultLocal(raw)&&!localStorage.getItem(KEY))ensureSeed();
        tab='home';
        render();
        return;
      }
    }
    if(localStorage.getItem(GATEKEY)==='guest'){
      ensureSeed();
      hideGate();
      render();
      return;
    }
    showLogin();
  }

  if(typeof window!=='undefined'&&window.addEventListener){
    window.addEventListener('online',()=>{
      if(syncOn) schedulePush();
      else if(session&&syncText.indexOf('오프라인')>=0) syncText='온라인 · 다시 시도하세요';
    });
  }
  if(typeof document!=='undefined'&&document.addEventListener){
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'&&syncOn&&session) schedulePush();
    });
  }

  return {
    boot, startGoogle, continueGuest, openLogin, logout, deleteAccount, uploadNow,
    schedulePush, accountCard, accountActions, mergeEvents, isDefaultLocal,
    get session(){return session;},
    setSession(s){session=s;},
    setSync(on,text){setSyncOn(on,text);}
  };
})();
window.DGAuth=DGAuth;
