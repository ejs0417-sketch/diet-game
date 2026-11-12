const V='dg-0.4.20';
const FILES=['./','index.html','app.js','auth.js','health.js','health-ranges.js','supplements.js','coach.js','today-guide.js','recipes.js','home-workout.js','delivery-foods.js','food-search.js','photo-meal.js','delivery.js','char.png','icon-192.png','icon-512.png','manifest.webmanifest','face.js','avatar.js','vendor/three.custom.min.js','assets/avatar/char-current-0.4.9.glb','assets/avatar/char-goal-0.4.9.glb','assets/avatar/char-00-0.4.15.glb','assets/avatar/char-25-0.4.15.glb','assets/avatar/char-50-0.4.15.glb','assets/avatar/char-75-0.4.15.glb','assets/avatar/char-100-0.4.15.glb','design-tokens.css','screens.css','vendor/fonts/PretendardVariable.woff2','vendor/fonts/Lexend-latin.woff2','vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs'];
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(V);
    FILES.forEach(f=>c.add(new Request(f,{cache:'no-cache'})).catch(()=>{}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  const ks=await caches.keys();
  const old=ks.filter(k=>k!==V&&/^dg-\d/.test(k));
  await Promise.all(old.map(k=>caches.delete(k)));
  await self.clients.claim();
  if(old.some(k=>String(k).indexOf('dg-')===0)){
    const cls=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(cls.map(c=>c.navigate?c.navigate(c.url):null));
  }
})());});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method==='POST'&&/share-delivery\/?$/.test(u.pathname)){
    e.respondWith((async()=>{
      try{
        const fd=await e.request.formData();
        const file=fd.get('image')||fd.get('file')||[...fd.values()].find(v=>v&&v.type&&String(v.type).startsWith('image/'));
        if(file){
          const cache=await caches.open('dg-share-v1');
          await cache.put('pending',new Response(file,{headers:{'Content-Type':file.type||'image/png','X-Filename':encodeURIComponent(file.name||'order.png')}}));
        }
      }catch(err){}
      return Response.redirect(new URL('./index.html?delivery=1',u).href,303);
    })());
    return;
  }
  if(u.origin!==location.origin){e.respondWith(fetch(e.request));return;}
  if(e.request.method!=='GET'){e.respondWith(fetch(e.request));return;}
  // GitHub Pages는 max-age=600이라 기본 fetch면 최대 10분 동안 옛 JS를 줍니다. 같은 출처 GET은 HTTP 캐시를 건너뜁니다.
  e.respondWith(fetch(new Request(e.request,{cache:'no-cache'})).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));
});
