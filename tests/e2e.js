// 자동 기능 테스트: 이 폴더에서 python3 -m http.server 8766 을 켠 뒤 node tests/e2e.js 로 실행합니다 (Playwright 필요).
const { chromium, devices } = require('playwright');
const URL = 'http://localhost:8766/index.html';
const results = []; let cur = '';
const ok = (name, cond, info='') => results.push({ t: cur, name, pass: !!cond, info });
(async () => {
  const b = await chromium.launch();
  for (const dev of ['iPhone 13', 'iPhone SE']) {
    const ctx = await b.newContext({ ...devices[dev] });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    const hash = () => p.evaluate(() => location.hash);
    const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('wordapp.v1') || '{}'));
    const overflow = async (n) => { const o = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); ok(`[${dev}] ${n}: 가로 넘침 없음`, !o); };
    const W = (id) => p.evaluate(i => WORDS[i], id);
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.goto(URL); await p.waitForTimeout(300);

    cur = '학년 선택';
    ok('첫 실행 시 학년 선택 화면', (await p.textContent('#title')) === '학년 선택');
    await overflow('학년 선택');
    await p.click('[data-g="3"]'); await p.waitForTimeout(200);
    ok('초3 선택 후 홈', (await hash()) === '#/home' && (await p.textContent('#gradeBtn')) === '초3');
    ok('초3 전체 156', (await p.textContent('main')).includes('156'));
    await p.click('#gradeBtn'); await p.click('[data-g="7"]'); await p.waitForTimeout(200);
    ok('학년 바꾸기 → 중1, 300단어', (await p.textContent('#gradeBtn')) === '중1' && (await p.textContent('main')).includes('300'));
    await p.click('#gradeBtn'); await p.click('#back'); await p.waitForTimeout(200);
    ok('학년 화면에서 < 누르면 홈', (await hash()) === '#/home');
    await p.click('#gradeBtn'); await p.click('[data-g="1"]'); await p.waitForTimeout(200);
    await overflow('홈');

    cur = '단어장';
    await p.click('[data-tab="units"]'); await p.waitForTimeout(200);
    const units = await p.$$eval('.unit', x => x.length);
    ok('초1 단원 수 5 (88단어)', units === 5, units);
    await p.click('.unit >> nth=4 >> a'); await p.waitForTimeout(200);
    ok('마지막 단원 단어 8개', (await p.$$eval('.list li', x => x.length)) === 8);
    await p.click('#back'); ok('단원 화면 < → 단어장', (await hash()) === '#/units');
    await overflow('단어장');

    cur = '플래시카드 + 뒤로 가기(신고된 버그)';
    await p.click('[data-tab="home"]'); await p.waitForTimeout(200);
    await p.click('a.btn >> nth=0'); await p.waitForTimeout(200);
    ok('홈 → 1단원 카드', (await hash()) === '#/flash/1/0');
    await p.click('#fc'); await p.waitForTimeout(500);
    ok('카드 탭하면 뒤집힘', await p.$eval('#fc', e => e.classList.contains('flip')));
    await overflow('플래시카드');
    let clicks = 0;
    for (let i = 0; i < 40 && await p.$('[data-r]'); i++) { await p.click(`[data-r="${i < 5 ? 0 : i < 10 ? 1 : 2}"]`); clicks++; await p.waitForTimeout(300); }
    ok('20장 + 몰라요 5장 재확인 = 25번', clicks === 25, clicks);
    ok('완료 화면', (await p.textContent('main')).includes('20단어를 모두 봤습니다'));
    await p.click('text=완료'); await p.waitForTimeout(200);
    ok('완료 → 단원 화면', (await hash()) === '#/unit/1/0');
    await p.click('#back'); await p.waitForTimeout(200);
    ok('단원 < → 단어장 (반복 없음)', (await hash()) === '#/units');
    // 브라우저(스와이프) 뒤로 가기로도 카드 화면에 다시 갇히지 않는지
    await p.goto(URL + '#/home'); await p.click('a.btn >> nth=0'); await p.click('#back'); await p.waitForTimeout(200);
    ok('카드 도중 < → 단원 화면', /^#\/unit\/1\/\d$/.test(await hash()), await hash());
    await p.click('#back'); ok('이어서 < → 단어장', (await hash()) === '#/units');
    await p.goto(URL + '#/unit/1/3'); await p.goto(URL + '#/flash/1/3'); await p.waitForTimeout(200);
    await p.click('[data-r="2"]'); await p.click('[data-r="2"]', { force: true }).catch(() => {}); await p.waitForTimeout(400);
    ok('알아요 빠르게 두 번 눌러도 한 장만 넘어감', (await p.textContent('.progress-txt')).startsWith('1 / '), await p.textContent('.progress-txt'));
    await p.click('[data-r="2"]'); await p.waitForTimeout(100);
    ok('넘김 애니메이션 적용', await p.$eval('#fc', e => e.classList.contains('out-right')));
    if (dev === 'iPhone 13') await p.screenshot({ path: 'anim.png' });
    await p.waitForTimeout(250);
    ok('다음 카드 등장 애니메이션', await p.$eval('#fc', e => e.classList.contains('enter')));
    await p.goto(URL + '#/units');
    let s = await st();
    const u0 = await p.evaluate(() => unitWords(1, 0).map(w => String(w.id)));
    s.cards = Object.fromEntries(Object.entries(s.cards).filter(([k]) => u0.includes(k)));
    ok('카드 20개 기록', Object.keys(s.cards).length === 20);
    const boxes = Object.values(s.cards).map(c => c.b);
    ok('몰라요=0단계, 알아요=1단계 이상', boxes.filter(x => x === 0).length === 5 && boxes.filter(x => x >= 1).length === 15, boxes.join(''));

    cur = '고르기 퀴즈';
    await p.goto(URL + '#/quiz/1/1'); await p.waitForTimeout(200);
    await p.click('[data-t="pick"]'); await p.click('[data-m="en"]'); await p.click('#go');
    await overflow('퀴즈');
    for (let i = 0; i < 10; i++) {
      const q = await p.textContent('.q');
      const id = await p.evaluate(q => WORDS.find(w => w.w === q).id, q);
      await p.click(`[data-id="${id}"]`); await p.click(`[data-id="${id}"]`).catch(() => {}); // 두 번 눌러도 한 번만
      await p.waitForTimeout(750);
    }
    ok('영어→뜻 10문제 모두 정답', (await p.textContent('main')).includes('10문제 중 10문제'));
    await p.click('#again'); await p.click('[data-m="ko"]'); await p.click('#go');
    for (let i = 0; i < 10; i++) {
      const q = await p.textContent('.q');
      const ids = await p.$$eval('[data-id]', x => x.map(e => +e.dataset.id));
      const right = await p.evaluate(([q, ids]) => ids.find(i => WORDS[i].m === q), [q, ids]);
      const pick = i < 3 ? ids.find(x => x !== right) : right;
      await p.click(`[data-id="${pick}"]`); await p.waitForTimeout(i < 3 ? 1600 : 750);
    }
    ok('뜻→영어 3개 틀리고 7개 맞음', (await p.textContent('main')).includes('10문제 중 7문제'));
    s = await st(); ok('오답노트에 3개', Object.keys(s.wrong).length === 3, Object.keys(s.wrong).length);
    await p.click('text=완료'); ok('퀴즈 완료 → 단원 화면', (await hash()) === '#/unit/1/1');

    cur = '직접 쓰기 퀴즈';
    await p.goto(URL + '#/quiz/1/2'); await p.waitForTimeout(200);
    await p.click('[data-t="type"]'); await p.click('[data-m="ko"]'); await p.click('#go');
    await overflow('쓰기 퀴즈');
    for (let i = 0; i < 10; i++) {
      const q = await p.textContent('.q');
      const w = await p.evaluate(q => WORDS.find(w => w.m === q && w.g === 1).w, q);
      await p.fill('#ans', i === 0 ? 'zzz' : (i === 1 ? w.toUpperCase() : w));
      await p.press('#ans', 'Enter');
      if (i === 0) { await p.waitForTimeout(150); await p.press('#ans', 'Enter'); } else await p.waitForTimeout(1050);
      await p.waitForTimeout(100);
    }
    ok('뜻→영어 쓰기: 1개 틀림, 대문자도 정답', (await p.textContent('main')).includes('10문제 중 9문제'), (await p.textContent('h2')));
    await p.click('#again'); await p.click('[data-m="en"]'); await p.click('#go');
    for (let i = 0; i < 10; i++) {
      const q = await p.textContent('.q');
      const m = await p.evaluate(q => WORDS.find(w => w.w === q).m, q);
      const first = m.split(/[,/]/)[0].replace(/^\s*(명|동|형|부|전|접|대|조|관|감|수)\s+/, '').trim();
      await p.fill('#ans', i === 0 ? '엉뚱한답' : first);
      await p.press('#ans', 'Enter'); await p.waitForTimeout(150);
      if (i === 0) await p.click('#ovr'); else await p.waitForTimeout(950);
    }
    ok('영어→뜻 쓰기: 첫 뜻 입력 정답 + "뜻이 맞아요" 정답 처리', (await p.textContent('main')).includes('10문제 중 10문제'), await p.textContent('h2'));
    // 빈칸 제출은 무시
    await p.click('#again'); await p.click('#go'); await p.press('#ans', 'Enter'); await p.waitForTimeout(200);
    ok('빈칸 제출은 무시', (await p.textContent('.progress-txt')).startsWith('1 / '));

    cur = '오답노트';
    await p.goto(URL + '#/wrong'); await p.waitForTimeout(200);
    const wc = await p.$$eval('.list li', x => x.length); ok('오답 목록 표시', wc >= 4, wc);
    await overflow('오답노트');
    for (let round = 0; round < 3; round++) {
      await p.goto(URL + '#/wrong'); await p.waitForTimeout(100); await p.goto(URL + '#/wrong/quiz'); await p.waitForTimeout(200);
      await p.click('[data-t="pick"]'); await p.click('[data-m="en"]'); await p.click('#go');
      while (await p.$('.q')) {
        const q = await p.textContent('.q');
        const id = await p.evaluate(q => WORDS.find(w => w.w === q).id, q);
        await p.click(`[data-id="${id}"]`); await p.waitForTimeout(750);
      }
    }
    s = await st(); ok('3번 연속 맞히면 오답노트에서 빠짐', Object.keys(s.wrong).length === 0, JSON.stringify(s.wrong));
    await p.goto(URL + '#/wrong'); ok('빈 오답노트 안내', (await p.textContent('main')).includes('아직 틀린 단어가 없습니다'));
    await p.goto(URL + '#/wrong/quiz'); await p.waitForTimeout(200); ok('빈 오답 퀴즈 안내', (await p.textContent('main')).includes('비어 있습니다'));
    await p.click('text=돌아가기'); ok('돌아가기 → 오답노트', (await hash()) === '#/wrong');

    cur = '복습';
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('wordapp.v1')); let n = 0; for (const k in s.cards) { if (n++ < 6) s.cards[k].d -= 40; } localStorage.setItem('wordapp.v1', JSON.stringify(s)); });
    await p.goto(URL + '#/home'); await p.reload(); await p.waitForTimeout(200);
    ok('홈에 오늘 복습 6', (await p.textContent('.row:last-child')).includes('6'));
    await p.click('[data-tab="review"]'); await p.waitForTimeout(200);
    ok('복습 화면 6개', (await p.textContent('main')).includes('복습할 단어 6개'));
    await overflow('복습');
    await p.click('text=복습 시작'); for (let i = 0; i < 6; i++) { await p.click('[data-r="2"]'); await p.waitForTimeout(300); }
    ok('복습 완료', (await p.textContent('main')).includes('6단어를 모두 봤습니다'));
    await p.click('text=완료'); await p.waitForTimeout(200); ok('복습 완료 → 복습 화면 0개', (await p.textContent('main')).includes('복습할 단어 0개'), (await hash()) + ' ' + (await p.textContent('main')).slice(0,80));
    await p.goto(URL + '#/review/go'); await p.waitForTimeout(200); ok('복습할 것 없을 때 안내', (await p.textContent('main')).includes('학습할 단어가 없습니다'));
    await p.click('#back'); ok('복습 카드 < → 복습', (await hash()) === '#/review');

    cur = '목표와 연속 학습';
    await p.click('[data-tab="settings"]'); await p.click('[data-goal="10"]');
    ok('목표 10 저장', (await st()).goal === 10);
    await overflow('설정');
    await p.click('[data-tab="home"]'); await p.waitForTimeout(200);
    ok('오늘 목표 달성 표시', (await p.textContent('main')).includes('달성'));
    ok('연속 1일', (await p.textContent('.streak')).includes('1'));
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('wordapp.v1')); const d = new Date(); for (let k = 1; k <= 3; k++) { d.setDate(d.getDate() - 1); s.days[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')] = 5; } localStorage.setItem('wordapp.v1', JSON.stringify(s)); });
    await p.reload(); ok('연속 4일 (어제까지 3일 + 오늘)', (await p.textContent('.streak')).includes('4'));
    // 오늘 안 했을 때: 오늘 기록 제거 → 3일 유지
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('wordapp.v1')); const d = new Date(); delete s.days[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')]; localStorage.setItem('wordapp.v1', JSON.stringify(s)); });
    await p.reload(); ok('오늘 아직 안 해도 어제까지 연속 3일 유지', (await p.textContent('.streak')).includes('3'));

    cur = '기록 지우기';
    await p.click('[data-tab="settings"]'); await p.click('#reset'); await p.click('#no');
    ok('취소하면 기록 유지', Object.keys((await st()).cards).length > 0);
    await p.click('#reset'); await p.click('#yes');
    s = await st(); ok('지우면 기록 0, 학년·목표 유지', Object.keys(s.cards).length === 0 && s.grade === 1 && s.goal === 10);

    cur = '오프라인';
    await p.goto(URL); await p.waitForTimeout(800);
    await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(300);
    ok('인터넷 없이 열림', (await p.textContent('#title')).length > 0);
    await ctx.setOffline(false);

    cur = '오류';
    ok(`[${dev}] 콘솔 오류 없음`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
  await b.close();
  const fail = results.filter(r => !r.pass);
  for (const r of results) console.log((r.pass ? 'PASS' : 'FAIL') + ' | ' + r.t + ' | ' + r.name + (r.pass ? '' : ' | ' + r.info));
  console.log(`\n${results.length - fail.length}/${results.length} passed`);
})();
