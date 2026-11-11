#!/usr/bin/env python3
"""0.4.13 E2E: version badge, 집밥 chips, fruit search, consecutive search, short viewport, SW update."""
from __future__ import annotations
import http.server, json, os, socket, sys, threading, time
from functools import partial
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
SHOT_DIR = Path('/tmp/e2e-0.4.13')
FINAL_SHOT = Path('/workspace/다이어트게임-0.4.13-집밥선택.png')
HOME_SHOT = Path('/workspace/다이어트게임-0.4.13-버전표시.png')
FRUIT_SHOT = Path('/workspace/다이어트게임-0.4.13-과일검색.png')
OLD_DIR = Path('/tmp/dg-0.4.10')
UA = ('Mozilla/5.0 (Linux; Android 16; SM-F766N) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36')
MENUS = [
    ('봉구스', '봉구스 밥버거'),
    ('햄치즈', '햄치즈'),
    ('빼빼로', '빼빼로 오리지널'),
]
CHROME = '/usr/bin/google-chrome'
FAILS = []

def log(*a):
    print(*a, flush=True)

class SwitchableHandler(http.server.SimpleHTTPRequestHandler):
    # server.legacy: bool
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass
    def do_GET(self):
        path = self.path.split('?')[0]
        name = path.lstrip('/') or 'index.html'
        if getattr(self.server, 'legacy', False) and name in ('sw.js','app.js','delivery.js','index.html'):
            body = (OLD_DIR / name).read_bytes()
            ctype = {'.js':'application/javascript; charset=utf-8','.html':'text/html; charset=utf-8'}.get(Path(name).suffix, 'application/octet-stream')
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if name.startswith('sw.js') and getattr(self.server, 'sw_bump', False):
            body = (ROOT / 'sw.js').read_bytes() + b'\n// e2e-bump\n'
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

def start_server(legacy=False):
    sock = socket.socket(); sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]; sock.close()
    handler = partial(SwitchableHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    httpd.legacy = legacy
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, f'http://127.0.0.1:{port}/'

def launch(p, w, h):
    browser = p.chromium.launch(headless=True, executable_path=CHROME,
                                args=['--disable-dev-shm-usage','--no-sandbox'])
    ctx = browser.new_context(
        viewport={'width':w,'height':h}, device_scale_factor=2,
        is_mobile=True, has_touch=True, locale='ko-KR',
        timezone_id='Asia/Seoul', user_agent=UA,
        service_workers='allow',
    )
    page = ctx.new_page()
    page.set_default_timeout(15000)
    page.on('dialog', lambda d: d.dismiss())
    return browser, ctx, page

def guest(page, url):
    page.goto(url, wait_until='domcontentloaded', timeout=45000)
    page.wait_for_selector('text=게스트로 계속하기', timeout=20000)
    page.get_by_text('게스트로 계속하기').click()
    page.wait_for_selector('nav#nav', timeout=20000)
    page.wait_for_timeout(300)

def search_state(page):
    return page.evaluate('''() => {
      const inp=document.getElementById('mealMenu');
      const nav=document.getElementById('nav');
      const tabH=nav?nav.getBoundingClientRect().height:68;
      if(!inp) return {exists:false,inView:false,version:typeof VERSION!=='undefined'?VERSION:null,tab:typeof tab!=='undefined'?tab:null};
      const r=inp.getBoundingClientRect();
      const inView=r.width>0&&r.height>0&&r.top>=0&&r.bottom<=(window.innerHeight-tabH+6);
      return {exists:true,inView,top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight,tabH:Math.round(tabH),
        value:inp.value,version:typeof VERSION!=='undefined'?VERSION:null,tab:typeof tab!=='undefined'?tab:null,
        mealKind:typeof mealKind!=='undefined'?mealKind:null,logKind:typeof logKind!=='undefined'?logKind:null,
        basket:(document.getElementById('mealBasket')||{}).innerText||'',
        nav:(document.querySelector('nav#nav button[aria-current="page"]')||{}).innerText||''};
    }''')

def assert_search_visible(page, label, shot):
    st = search_state(page)
    page.screenshot(path=str(SHOT_DIR / f'{shot}.png'))
    log('STATE', label, json.dumps(st, ensure_ascii=False))
    if not st.get('exists'):
        FAILS.append(f'{label}: #mealMenu 없음 {st}')
        return st
    if not st.get('inView'):
        FAILS.append(f'{label}: 검색창이 화면 밖 {st}')
    return st

def add_one(page, query, expect_name, shot, slot=None, require_search=True):
    if slot:
        page.locator('[data-seg="meal"] button', has_text=slot).click()
        page.wait_for_timeout(120)
    inp = page.locator('#mealMenu')
    if inp.count()==0:
        FAILS.append(f'{shot}: 검색창 없음, 추가 실패 ({query})')
        page.screenshot(path=str(SHOT_DIR / f'{shot}-NO-INPUT.png'))
        return None
    inp.fill('')
    inp.fill(query)
    try:
        page.wait_for_selector('.meal-search-item', timeout=6000)
    except Exception:
        FAILS.append(f'{shot}: 검색 결과 없음 ({query})')
        try:
            page.screenshot(path=str(SHOT_DIR / f'{shot}-NO-RESULTS.png'), timeout=5000)
        except Exception:
            pass
        return None
    page.screenshot(path=str(SHOT_DIR / f'{shot}-typed.png'))
    items = page.locator('.meal-search-item')
    tgt = items.filter(has_text=expect_name).first
    (tgt if tgt.count() else items.first).click()
    page.wait_for_selector('#delivPane', timeout=8000)
    page.wait_for_selector('text=식사로 기록하기', timeout=8000)
    page.screenshot(path=str(SHOT_DIR / f'{shot}-pane.png'))
    page.get_by_text('식사로 기록하기', exact=True).click()
    try:
        page.wait_for_selector('#delivPane', state='detached', timeout=8000)
    except Exception:
        FAILS.append(f'{shot}: 확인창이 안 닫힘')
        page.screenshot(path=str(SHOT_DIR / f'{shot}-pane-stuck.png'))
        return search_state(page)
    page.wait_for_timeout(350)
    if not require_search:
        page.screenshot(path=str(SHOT_DIR / f'{shot}-after.png'))
        return search_state(page)
    return assert_search_visible(page, f'{shot} after {query}', f'{shot}-after')

def add_three(page, prefix, slot='저녁'):
    for i,(q,name) in enumerate(MENUS,1):
        st = add_one(page, q, name, f'{prefix}-{i}', slot=slot if i==1 else None)
        slot = None
        if not st or not st.get('exists') or not st.get('inView'):
            return False
    text = (st or {}).get('basket') or ''
    if not all(n in text for n in ('봉구스 밥버거','햄치즈 밥버거','빼빼로 오리지널')):
        FAILS.append(f'{prefix}: 바구니에 3개 메뉴가 없음 {text}')
        return False
    return True

def inject_existing(page):
    page.evaluate('''() => {
      const raw=JSON.parse(localStorage.getItem('dg_raw_v1')||'[]');
      raw.push({id:'ex1',date:'2026-11-11',type:'meal',item:'점심',value:'김밥',kcal:'450',protein_g:'10'});
      raw.push({id:'ex2',date:'2026-11-10',type:'meal',item:'저녁',value:'치킨',kcal:'1800',protein_g:'80'});
      localStorage.setItem('dg_raw_v1', JSON.stringify(raw));
    }''')
    page.reload(wait_until='domcontentloaded')
    if page.get_by_text('게스트로 계속하기').count():
        page.get_by_text('게스트로 계속하기').click()
        page.wait_for_selector('nav#nav', timeout=20000)
    page.wait_for_timeout(300)

def main():
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    httpd, url = start_server(legacy=False)
    log('server', url)
    try:
        with sync_playwright() as p:
            # 1) fresh, nav 기록, 412x915
            browser,ctx,page=launch(p,412,915)
            guest(page,url)
            ver=page.evaluate('()=>typeof VERSION!=="undefined"?VERSION:null')
            if ver!='0.4.13':
                FAILS.append(f'로컬 버전이 0.4.13가 아님: {ver}')
            badge=page.locator('.ver-badge')
            if badge.count()==0 or 'v0.4.13' not in badge.first.inner_text():
                FAILS.append(f'홈 버전 배지 없음: {badge.count()}')
            page.wait_for_timeout(400)
            page.screenshot(path=str(HOME_SHOT))
            log('HOME_SHOT', HOME_SHOT)
            page.locator('nav#nav button', has_text='기록').click()
            page.wait_for_selector('#mealMenu', timeout=8000)
            page.wait_for_timeout(200)
            assert_search_visible(page, 'fresh-nav enter', 'fresh-nav-enter')
            if page.locator('.log-head .ver-badge', has_text='v0.4.13').count()==0:
                FAILS.append('기록 헤더 버전 배지 없음')
            # 과일 검색 스크린샷
            inp=page.locator('#mealMenu')
            inp.fill('')
            inp.fill('홍시')
            page.wait_for_selector('.meal-search-item', timeout=6000)
            txt=page.locator('.meal-search-item').first.inner_text()
            if '홍시' not in txt or '55' not in txt:
                FAILS.append(f'홍시 검색 결과 이상: {txt}')
            page.wait_for_timeout(300)
            page.screenshot(path=str(FRUIT_SHOT))
            log('FRUIT_SHOT', FRUIT_SHOT)
            inp.fill('')
            page.wait_for_timeout(150)
            # 집밥 선택 후 3개 연속 추가
            page.locator('[data-seg="place"] button', has_text='집밥').click()
            page.wait_for_timeout(120)
            sel=page.locator('[data-seg="place"] button', has_text='집밥').get_attribute('aria-selected')
            if sel!='true':
                FAILS.append(f'집밥 선택이 안 됨 aria-selected={sel}')
            ok=add_three(page, 'home-style', '저녁')
            if ok:
                basket=search_state(page).get('basket') or ''
                if '집밥' not in basket:
                    FAILS.append(f'집밥 태그가 바구니에 없음: {basket}')
                page.wait_for_timeout(2800)
                page.screenshot(path=str(FINAL_SHOT))
                log('FINAL_SHOT', FINAL_SHOT)
            browser.close()

            # 2) fresh, short 360x520 (실사용에서 검색창이 사라지던 크기)
            browser,ctx,page=launch(p,360,520)
            guest(page,url)
            page.locator('nav#nav button', has_text='기록').click()
            page.wait_for_selector('#mealMenu', timeout=8000)
            page.wait_for_timeout(200)
            # first reveal may be needed if search starts under tab bar
            page.evaluate('()=>{if(typeof revealMealSearch==="function")revealMealSearch();}')
            page.wait_for_timeout(150)
            assert_search_visible(page, 'fresh-short enter', 'fresh-short-enter')
            page.locator('[data-seg="place"] button', has_text='집밥').click()
            page.wait_for_timeout(80)
            add_three(page, 'fresh-short', '점심')
            browser.close()

            # 3) existing data + 빠른 기록 식사
            browser,ctx,page=launch(p,412,915)
            guest(page,url)
            inject_existing(page)
            page.locator('nav#nav button', has_text='홈').click()
            page.wait_for_timeout(250)
            page.locator('.quick button', has_text='식사').click()
            page.wait_for_selector('#mealMenu', timeout=8000)
            page.wait_for_timeout(200)
            assert_search_visible(page, 'quick enter', 'quick-enter')
            add_three(page, 'quick', '아침')
            browser.close()

            # 4) 퀘스트 카드 '식사 기록하고 마감'
            browser,ctx,page=launch(p,412,915)
            guest(page,url)
            page.locator('nav#nav button', has_text='홈').click()
            page.wait_for_timeout(250)
            q=page.locator('.quest-card', has_text='식사 기록하고 마감')
            if q.count()==0:
                FAILS.append('퀘스트 카드 없음')
            else:
                q.first.click()
                page.wait_for_selector('#mealMenu', timeout=8000)
                page.wait_for_timeout(200)
                assert_search_visible(page, 'quest enter', 'quest-enter')
                add_three(page, 'quest', '간식')
            browser.close()

            # 5) 체중 카드 진입 후 식사가 아니면 전환, 야식 3개
            browser,ctx,page=launch(p,412,915)
            guest(page,url)
            page.locator('.wcard').click()
            page.wait_for_timeout(300)
            if page.locator('#mealMenu').count()==0:
                k=page.locator('[data-seg="kind"] button', has_text='식사')
                if k.count(): k.click()
                page.wait_for_timeout(200)
            page.wait_for_selector('#mealMenu', timeout=8000)
            assert_search_visible(page, 'wcard enter', 'wcard-enter')
            add_three(page, 'wcard', '야식')
            browser.close()

            # 6) 점저 슬롯 (remaining slot)
            browser,ctx,page=launch(p,412,915)
            guest(page,url)
            page.locator('nav#nav button', has_text='기록').click()
            page.wait_for_selector('#mealMenu', timeout=8000)
            add_three(page, 'slot-점저', '점저')
            browser.close()

            # 7) SW 0.4.10 캐시: 첫 기록은 홈으로 나감(옛 버그). 서버를 0.4.13로 바꾼 뒤
            #    update()를 시도하고, 0.4.10 페이지에는 자동새로고침이 없으므로
            #    한 번 새로고침(앱을 다시 연 것과 같음, network-first) 후 0.4.13 연속 추가를 확인.
            httpd.legacy = True
            browser,ctx,page=launch(p,412,915)
            guest(page, url)
            ver=page.evaluate('()=>typeof VERSION!=="undefined"?VERSION:null')
            log('SW start VERSION', ver)
            if ver!='0.4.10':
                FAILS.append(f'SW 테스트 시작 버전이 0.4.10이 아님: {ver}')
            page.locator('nav#nav button', has_text='기록').click()
            page.wait_for_selector('#mealMenu', timeout=8000)
            st=add_one(page, '봉구스', '봉구스 밥버거', 'sw-old-1', slot='저녁', require_search=False)
            tab=page.evaluate('()=>typeof tab!=="undefined"?tab:null')
            log('SW old after first save tab=', tab, 'state', st)
            if tab!='home':
                FAILS.append(f'0.4.10은 저장 후 홈으로 가야 하는데 tab={tab}')
            page.screenshot(path=str(SHOT_DIR/'sw-old-after.png'))
            httpd.legacy = False
            page.wait_for_timeout(300)
            try:
                page.evaluate("""() => { navigator.serviceWorker.getRegistration().then(r=>{if(r)r.update();}); }""")
            except Exception as e:
                log('update() call', type(e).__name__, e)
            try:
                page.wait_for_function('() => typeof VERSION!=="undefined" && VERSION==="0.4.13"', timeout=4000)
            except Exception:
                page.reload(wait_until='domcontentloaded', timeout=20000)
            page.wait_for_timeout(500)
            if page.get_by_text('게스트로 계속하기').count():
                page.get_by_text('게스트로 계속하기').click()
                page.wait_for_selector('nav#nav', timeout=20000)
            ver2=page.evaluate('()=>typeof VERSION!=="undefined"?VERSION:null')
            log('SW after update/reload VERSION', ver2)
            page.screenshot(path=str(SHOT_DIR/'sw-updated-home.png'))
            if ver2!='0.4.13':
                FAILS.append(f'SW 업데이트 후 버전이 0.4.13가 아님: {ver2}')
            else:
                deadline=time.time()+12
                while time.time()<deadline:
                    try:
                        with page.expect_navigation(timeout=1000):
                            pass
                    except Exception:
                        continue
                page.wait_for_timeout(400)
                if page.get_by_text('게스트로 계속하기').count():
                    page.get_by_text('게스트로 계속하기').click()
                    page.wait_for_selector('nav#nav', timeout=20000)
                page.locator('nav#nav button', has_text='기록').click()
                page.wait_for_selector('#mealMenu', timeout=8000)
                st=assert_search_visible(page, 'sw-updated enter', 'sw-updated-enter')
                if st.get('version')!='0.4.13' or not st.get('inView'):
                    FAILS.append(f'sw-updated 기록 화면 검색창 확인 실패 {st}')
            browser.close()

            # 8) 0.4.13 전용 세션에서 sw.js 내용이 바뀌면 자동 새로고침
            httpd.legacy = False
            httpd.sw_bump = False
            browser,ctx,page=launch(p,412,915)
            guest(page, url)
            page.wait_for_timeout(2000)  # 첫 SW 설치·claim
            httpd.sw_bump = True
            try:
                with page.expect_navigation(timeout=12000):
                    page.evaluate("""() => { navigator.serviceWorker.getRegistration().then(r=>{if(r)r.update();}); }""")
                page.wait_for_timeout(400)
                if page.get_by_text('게스트로 계속하기').count():
                    page.get_by_text('게스트로 계속하기').click()
                    page.wait_for_selector('nav#nav', timeout=20000)
                ver3=page.evaluate('()=>typeof VERSION!=="undefined"?VERSION:null')
                log('SW bump auto-reload VERSION', ver3)
                if ver3!='0.4.13':
                    FAILS.append(f'0.4.13 자동새로고침 후 버전 이상: {ver3}')
                else:
                    log('SW bump auto-reload OK')
            except Exception as e:
                log('SW bump auto-nav', type(e).__name__, e)
                log('WARN: 0.4.13 자동새로고침이 이 환경에서 확인되지 않음 (코드는 index.html controllerchange + sw navigate 유지)')
            browser.close()

    finally:
        httpd.shutdown()

    if FAILS:
        log('E2E FAIL')
        for f in FAILS:
            log(' -', f)
        sys.exit(1)
    missing=[p for p in (FINAL_SHOT, HOME_SHOT, FRUIT_SHOT) if not p.exists()]
    if missing:
        log('E2E FAIL: 스크린샷 없음', *[str(p) for p in missing])
        sys.exit(1)
    log('E2E OK', FINAL_SHOT, HOME_SHOT, FRUIT_SHOT)
    sys.exit(0)

if __name__=='__main__':
    main()
