const V='dg-0.4.6';
const FILES=['./','index.html','app.js','auth.js','health.js','health-ranges.js','supplements.js','coach.js','delivery-foods.js','delivery.js','char.png','icon-192.png','icon-512.png','manifest.webmanifest','avatar.js','vendor/three.custom.min.js','design-tokens.css','screens.css','vendor/fonts/PretendardVariable.woff2','vendor/fonts/Lexend-latin.woff2','vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))));self.clients.claim();});
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
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));
});
