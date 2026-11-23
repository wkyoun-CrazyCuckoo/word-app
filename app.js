'use strict';
/* 학년별 영단어 PWA. 데이터: words.js의 WORDS 배열 {id,w,p,m,g,lv,alt,der} */

const GRADES = ['', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const UNIT_SIZE = 20;
const INTERVALS = [0, 1, 3, 7, 14, 30];   // 상자(box)별 다음 복습까지 일수
const QUIZ_LEN = 10;
const WRONG_CLEAR = 3;                     // 오답노트에서 연속으로 맞히면 졸업하는 횟수
const KEY = 'wordapp.v1';
const REDUCED_MOTION = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const $view = document.getElementById('view');
const $title = document.getElementById('title');
const $back = document.getElementById('back');
const $gradeBtn = document.getElementById('gradeBtn');

/* ---------- 저장 ---------- */
function defaultState() { return { grade: 0, goal: 20, cards: {}, wrong: {}, days: {} }; }
let S = load();
function load() {
  try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return defaultState(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } }

/* ---------- 날짜 ---------- */
function dateStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dayNum(d) { d = d || new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
const today = () => dayNum();
function todayCount() { return S.days[dateStr()] || 0; }
function bump() { const k = dateStr(); S.days[k] = (S.days[k] || 0) + 1; }
function streak() {
  let n = 0; const d = new Date();
  if (!S.days[dateStr(d)]) d.setDate(d.getDate() - 1);   // 오늘 아직 안 했으면 어제부터 셈
  while (S.days[dateStr(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- 단어 ---------- */
const byGrade = {};
for (const w of WORDS) (byGrade[w.g] = byGrade[w.g] || []).push(w);
const unitsOf = g => Math.ceil((byGrade[g] || []).length / UNIT_SIZE);
const unitWords = (g, u) => (byGrade[g] || []).slice(u * UNIT_SIZE, (u + 1) * UNIT_SIZE);
const W = id => WORDS[id];
const dueIds = () => Object.keys(S.cards).filter(id => S.cards[id].d <= today()).map(Number);
const wrongIds = () => Object.keys(S.wrong).map(Number);

/* ---------- 간격 반복 ---------- */
// rating: 0 몰라요, 1 헷갈려요, 2 알아요
function rate(id, rating) {
  const c = S.cards[id] || { b: 0, d: today() };
  if (rating === 2) { c.b = Math.min(5, c.b + 1); c.d = today() + INTERVALS[c.b]; }
  else if (rating === 1) { c.b = Math.max(1, c.b - 1); c.d = today() + 1; }   // 헷갈림: 한 단계 내리고 내일 다시
  else { c.b = 0; c.d = today() + 1; }                                        // 모름: 처음부터, 내일 다시
  S.cards[id] = c;
}
function quizResult(id, correct) {
  if (correct) {
    const c = S.cards[id] || { b: 0, d: today() };
    c.b = Math.min(5, c.b + 1); c.d = today() + INTERVALS[c.b];
    S.cards[id] = c;
  } else {
    S.cards[id] = { b: 1, d: today() + 1 };
    S.wrong[id] = 0;
  }
}

/* ---------- 도우미 ---------- */
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function setHeader(title, back) {
  $title.textContent = title; $back.hidden = !back;
  $gradeBtn.textContent = S.grade ? GRADES[S.grade] : '학년 선택';
}
function setTab(name) { document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === name)); }
function extraLine(w) {
  const parts = [];
  if (w.alt && w.alt.length) parts.push('= ' + w.alt.join(', '));
  if (w.der && w.der.length) parts.push('관련어: ' + w.der.join(', '));
  return parts.map(esc).join('<br>');
}
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

/* ---------- 화면: 학년 선택 ---------- */
function viewGrade() {
  setHeader('학년 선택', !!S.grade); setTab('');
  const block = (label, from, to) => `<div class="grid-label">${label}</div><div class="grid">` +
    Array.from({ length: to - from + 1 }, (_, i) => from + i).map(g =>
      `<button data-g="${g}" class="${S.grade === g ? 'on' : ''}">${GRADES[g]}</button>`).join('') + '</div>';
  $view.innerHTML = `<div class="card"><h2>몇 학년인가요?</h2>
    <p class="muted">교육부 2022 개정 교육과정 기본어휘 3,000단어를 학년별로 나눠 두었습니다.</p>
    ${block('초등학교', 1, 6)}${block('중학교', 7, 9)}${block('고등학교', 10, 12)}</div>`;
  $view.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { S.grade = +b.dataset.g; save(); location.hash = '#/home'; });
}

/* ---------- 화면: 홈 ---------- */
function viewHome() {
  if (!S.grade) return viewGrade();
  setHeader('학년별 영단어', false); setTab('home');
  const n = todayCount(), goal = S.goal, due = dueIds().length, wr = wrongIds().length;
  const words = byGrade[S.grade];
  const learned = words.filter(w => S.cards[w.id]).length;
  const mastered = words.filter(w => S.cards[w.id] && S.cards[w.id].b >= 3).length;
  // 이어서 할 단원: 아직 학습하지 않은 단어가 있는 첫 단원
  let next = 0;
  for (let u = 0; u < unitsOf(S.grade); u++) { if (unitWords(S.grade, u).some(w => !S.cards[w.id])) { next = u; break; } next = u; }
  $view.innerHTML = `
    <div class="card">
      <h2>오늘의 목표</h2>
      <div class="row"><div><span class="streak">🔥 ${streak()}</span><span class="muted"> 일 연속</span></div>
      <div style="text-align:right"><b>${Math.min(n, goal)}</b><span class="muted"> / ${goal} 단어</span></div></div>
      <div class="bar"><i style="width:${pct(Math.min(n, goal), goal)}%"></i></div>
      <div class="muted">${n >= goal ? '오늘 목표를 달성했습니다! 🎉' : `목표까지 ${goal - n}단어 남았습니다.`}</div>
    </div>
    <div class="card">
      <h2>${GRADES[S.grade]} 진도</h2>
      <div class="row">
        <div class="stat"><b>${learned}</b><small>학습한 단어</small></div>
        <div class="stat"><b>${mastered}</b><small>외운 단어</small></div>
        <div class="stat"><b>${words.length}</b><small>전체</small></div>
      </div>
      <div class="bar"><i style="width:${pct(learned, words.length)}%"></i></div>
      <a class="btn" href="#/flash/${S.grade}/${next}">${next + 1}단원 플래시카드 이어서 하기</a>
      <a class="btn ghost" href="#/quiz/${S.grade}/${next}">${next + 1}단원 퀴즈 풀기</a>
    </div>
    <div class="row">
      <a class="card stat" href="#/review" style="text-decoration:none;color:inherit"><b>${due}</b><small>오늘 복습</small></a>
      <a class="card stat" href="#/wrong" style="text-decoration:none;color:inherit"><b>${wr}</b><small>오답노트</small></a>
    </div>`;
}

/* ---------- 화면: 단원 목록 ---------- */
function viewUnits() {
  if (!S.grade) return viewGrade();
  setHeader(GRADES[S.grade] + ' 단어장', false); setTab('units');
  let html = '';
  for (let u = 0; u < unitsOf(S.grade); u++) {
    const ws = unitWords(S.grade, u);
    const l = ws.filter(w => S.cards[w.id]).length;
    html += `<div class="card unit"><div class="info"><b><a href="#/unit/${S.grade}/${u}" style="color:inherit">${u + 1}단원</a></b>
      <span class="muted">${esc(ws.slice(0, 3).map(w => w.w).join(', '))} …</span>
      <div class="bar"><i style="width:${pct(l, ws.length)}%"></i></div><span class="muted">${l} / ${ws.length}</span></div>
      <div class="acts"><button data-go="#/flash/${S.grade}/${u}">카드</button><button data-go="#/quiz/${S.grade}/${u}">퀴즈</button></div></div>`;
  }
  $view.innerHTML = html;
  $view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
}

function viewUnit(g, u) {
  setHeader(`${GRADES[g]} ${u + 1}단원`, true); setTab('units');
  const ws = unitWords(g, u);
  $view.innerHTML = `<div class="row"><a class="btn" href="#/flash/${g}/${u}">플래시카드</a><a class="btn ghost" href="#/quiz/${g}/${u}">퀴즈</a></div>
    <div class="card" style="margin-top:12px"><ul class="list">${ws.map(w => {
      const c = S.cards[w.id]; const tag = !c ? '' : c.b >= 3 ? '<span class="badge">외움</span>' : '<span class="badge">학습 중</span>';
      return `<li><span class="w">${esc(w.w)}${tag}</span><span class="m">${esc(w.p)} ${esc(w.m)}</span></li>`;
    }).join('')}</ul></div>`;
}

/* ---------- 화면: 플래시카드 ---------- */
function viewFlash(ids, title, backTo) {
  setHeader(title, true);
  if (!ids.length) { $view.innerHTML = `<div class="empty">학습할 단어가 없습니다.</div><a class="btn" href="${backTo}" data-replace>돌아가기</a>`; return; }
  const queue = ids.slice(); const retried = new Set(); const total = ids.length; let done = 0; let known = 0;
  function show() {
    if (!queue.length) {
      $view.innerHTML = `<div class="card done"><div class="big">👏</div><h2>${total}단어를 모두 봤습니다</h2>
        <p class="muted">한 번에 알았던 단어 ${known}개. 헷갈리거나 몰랐던 단어는 복습 일정에 넣어 두었습니다.</p>
        <a class="btn" href="${backTo}" data-replace>완료</a></div>`;
      return;
    }
    const w = W(queue[0]);
    $view.innerHTML = `<div class="progress-txt"><span>${done} / ${total}</span><span>오늘 ${todayCount()} / ${S.goal}</span></div>
      <div class="bar"><i style="width:${pct(done, total)}%"></i></div>
      <div class="flash" id="fc"><div class="inner">
        <div class="face front"><div class="word">${esc(w.w)}</div><div class="hint">탭해서 뜻 보기</div></div>
        <div class="face back"><div class="pos">${esc(w.p)}</div><div class="mean">${esc(w.m)}</div>
          <div class="extra">${esc(w.w)}${w.alt.length || w.der.length ? '<br>' + extraLine(w) : ''}</div></div>
      </div></div>
      <div class="rate"><button class="r0" data-r="0">몰라요</button><button class="r1" data-r="1">헷갈려요</button><button class="r2" data-r="2">알아요</button></div>`;
    const fc = document.getElementById('fc');
    fc.onclick = () => fc.classList.toggle('flip');
    if (entering) { fc.classList.add('enter'); entering = false; }
    let busy = false;
    $view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      if (busy) return; busy = true;   // 애니메이션 중 연속 탭 방지
      const r = +b.dataset.r, id = queue.shift();
      if (!retried.has(id)) { rate(id, r); bump(); if (r === 2) known++; }
      if (r === 0 && !retried.has(id)) { retried.add(id); queue.push(id); }   // 모르는 단어는 이번 학습 끝에 한 번 더
      else done++;
      save();
      // 카드 넘김: 알아요는 오른쪽, 몰라요는 왼쪽, 헷갈려요는 아래로 빠지고 다음 카드가 올라옴
      fc.classList.remove('enter');
      fc.classList.add(['out-left', 'out-down', 'out-right'][r]);
      entering = true;
      setTimeout(show, REDUCED_MOTION ? 0 : 260);
    });
  }
  let entering = false;
  show();
}

/* ---------- 화면: 퀴즈 ---------- */
let quizMode = 'en';   // en: 영어를 보고 뜻 답하기, ko: 뜻을 보고 영어 답하기
let quizType = 'pick'; // pick: 4지선다, type: 직접 쓰기

/* 직접 쓰기 채점 */
const normEn = s => s.toLowerCase().replace(/[^a-z'\-]/g, '');
const normKo = s => s.replace(/\([^)]*\)/g, '').replace(/[~\s.,!?·'"]/g, '');
function meaningParts(m) {
  // "동 일하다 / 명 일", "이모, 고모, 숙모" 같은 뜻을 낱말 단위로 나눔
  return m.split(/[,/;]/).map(x => normKo(x.replace(/^\s*(명|동|형|부|전|접|대|조|관|감|수)\s+/, ''))).filter(Boolean);
}
function checkTyped(w, input, en) {
  if (en) {   // 영어를 보고 한글 뜻 쓰기
    const a = normKo(input); if (!a) return false;
    return meaningParts(w.m).some(p => p === a
      || (a.length >= 2 && (p.startsWith(a) || a.startsWith(p)) && Math.abs(p.length - a.length) <= 1)   // 먹다/먹어 같은 활용 차이
      || (p.length >= 3 && p.endsWith(a) && a.length >= 2) || (a.endsWith('하다') && a.slice(0, -2) === p)
      || (p.endsWith('하다') && p.slice(0, -2) === a));
  }
  const a = normEn(input);   // 한글 뜻을 보고 영어 쓰기
  return [w.w].concat(w.alt || []).some(x => normEn(x) === a);
}
function viewQuiz(ids, title, backTo, opts) {
  opts = opts || {};
  setHeader(title, true);
  if (!ids.length) { $view.innerHTML = `<div class="empty">${opts.emptyMsg || '풀 문제가 없습니다.'}</div><a class="btn" href="${backTo}" data-replace>돌아가기</a>`; return; }
  const qs = shuffle(ids).slice(0, QUIZ_LEN); let i = 0, score = 0; const missed = [];
  function options(w) {
    const pool = (byGrade[w.g] || WORDS).filter(x => x.id !== w.id && x.m !== w.m && x.w !== w.w);
    return shuffle([w].concat(shuffle(pool).slice(0, 3)));
  }
  function start() {
    const desc = quizType === 'pick' ? '4개 중 알맞은 답을 고릅니다.'
      : quizMode === 'en' ? '영어 단어를 보고 한글 뜻을 직접 씁니다. 뜻이 여러 개면 하나만 써도 됩니다.'
      : '한글 뜻을 보고 영어 철자를 직접 씁니다.';
    $view.innerHTML = `<div class="seg"><button data-t="pick" class="${quizType === 'pick' ? 'on' : ''}">고르기</button>
      <button data-t="type" class="${quizType === 'type' ? 'on' : ''}">직접 쓰기</button></div>
      <div class="seg"><button data-m="en" class="${quizMode === 'en' ? 'on' : ''}">영어 → 뜻</button>
      <button data-m="ko" class="${quizMode === 'ko' ? 'on' : ''}">뜻 → 영어</button></div>
      <div class="card"><h2>${qs.length}문제</h2><p class="muted">${desc} 틀린 단어는 오답노트에 모입니다.</p>
      <button class="btn" id="go">시작</button></div>`;
    $view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { quizMode = b.dataset.m; start(); });
    $view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { quizType = b.dataset.t; start(); });
    document.getElementById('go').onclick = ask;
  }
  function record(id, ok) {
    if (ok) score++; else missed.push(id);
    if (opts.onAnswer) opts.onAnswer(id, ok); else quizResult(id, ok);
    bump(); save();
  }
  function askTyped(w, en) {
    $view.innerHTML = `<div class="progress-txt"><span>${i + 1} / ${qs.length}</span><span>맞힘 ${score}</span></div>
      <div class="bar"><i style="width:${pct(i, qs.length)}%"></i></div>
      <div class="q ${en ? '' : 'ko'}">${esc(en ? w.w : w.m)}</div>
      <div class="qsub">${en ? '한글 뜻을 쓰세요' : esc(w.p) + ' · 영어로 쓰세요' + (w.w.length > 2 ? ` (${w.w.length}글자, ${esc(w.w[0])}로 시작)` : '')}</div>
      <form id="tf" class="typed"><input id="ans" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
        lang="${en ? 'ko' : 'en'}" placeholder="${en ? '뜻 입력' : '영어 입력'}" enterkeyhint="done">
        <button class="btn" type="submit">확인</button></form>
      <div id="fb"></div>`;
    const $in = document.getElementById('ans'); $in.focus();
    const $btn = document.querySelector('#tf .btn');
    let phase = 'answer', result = null, advanced = false;
    const next = () => {
      if (advanced) return; advanced = true;
      record(w.id, result); i++; ask();
    };
    document.getElementById('tf').onsubmit = e => {
      e.preventDefault();
      if (phase === 'review') return next();
      if (!$in.value.trim()) return;
      phase = 'review'; $in.readOnly = true;
      result = checkTyped(w, $in.value, en);
      const answer = en ? `${esc(w.p)} ${esc(w.m)}` : esc([w.w].concat(w.alt).join(' / '));
      document.getElementById('fb').innerHTML = result
        ? `<div class="fb ok">정답입니다! <span>${answer}</span></div>`
        : `<div class="fb no">정답: <b>${answer}</b><br><small>내 답: ${esc($in.value)}</small></div>
           ${en ? '<button class="btn ghost" id="ovr" type="button">뜻이 맞아요 (정답 처리)</button>' : ''}`;
      $in.classList.add(result ? 'ok' : 'no');
      $btn.textContent = '다음';
      if (result) setTimeout(next, 900);
      const ovr = document.getElementById('ovr');
      if (ovr) ovr.onclick = () => { result = true; next(); };
    };
  }
  function ask() {
    if (i >= qs.length) return finish();
    const w = W(qs[i]); const en = quizMode === 'en';
    if (quizType === 'type') return askTyped(w, en);
    const os = options(w);
    $view.innerHTML = `<div class="progress-txt"><span>${i + 1} / ${qs.length}</span><span>맞힘 ${score}</span></div>
      <div class="bar"><i style="width:${pct(i, qs.length)}%"></i></div>
      <div class="q ${en ? '' : 'ko'}">${esc(en ? w.w : w.m)}</div><div class="qsub">${en ? '알맞은 뜻은?' : esc(w.p) + ' · 알맞은 영어 단어는?'}</div>
      <div class="opts">${os.map(o => `<button data-id="${o.id}">${esc(en ? o.m : o.w)}</button>`).join('')}</div>`;
    let answered = false;
    $view.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
      if (answered) return; answered = true;
      const ok = +b.dataset.id === w.id;
      $view.querySelectorAll('[data-id]').forEach(x => { if (+x.dataset.id === w.id) x.classList.add('ok'); });
      if (!ok) b.classList.add('no');
      record(w.id, ok);
      setTimeout(() => { i++; ask(); }, ok ? 650 : 1500);
    });
  }
  function finish() {
    $view.innerHTML = `<div class="card done"><div class="big">${score === qs.length ? '🏆' : score >= qs.length * 0.7 ? '😊' : '💪'}</div>
      <h2>${qs.length}문제 중 ${score}문제 맞혔습니다</h2>
      ${missed.length ? `<ul class="list" style="text-align:left">${missed.map(id => `<li><span class="w">${esc(W(id).w)}</span><span class="m">${esc(W(id).m)}</span></li>`).join('')}</ul>` : '<p class="muted">모두 맞혔습니다!</p>'}
      <button class="btn" id="again">다시 풀기</button><a class="btn ghost" href="${backTo}" data-replace>완료</a></div>`;
    document.getElementById('again').onclick = () => route();
  }
  start();
}

/* ---------- 화면: 복습 ---------- */
function viewReview() {
  setHeader('오늘의 복습', false); setTab('review');
  const ids = dueIds();
  const total = Object.keys(S.cards).length;
  const boxes = [0, 0, 0, 0, 0, 0]; Object.values(S.cards).forEach(c => boxes[c.b]++);
  const upcoming = Object.values(S.cards).filter(c => c.d === today() + 1).length;
  $view.innerHTML = `<div class="card"><h2>오늘 복습할 단어 ${ids.length}개</h2>
    <p class="muted">알아요를 누를수록 복습 간격이 1일, 3일, 7일, 14일, 30일로 길어집니다. 내일 복습 예정: ${upcoming}개</p>
    <a class="btn" href="#/review/go" ${ids.length ? '' : 'style="pointer-events:none;opacity:.45"'}>복습 시작</a></div>
    <div class="card"><h2>기억 단계</h2><ul class="list">
      ${['새로 배움', '1일 간격', '3일 간격', '7일 간격', '14일 간격', '30일 간격(완벽)'].map((l, k) => `<li><span>${l}</span><span class="m">${boxes[k]}개</span></li>`).join('')}
    </ul><p class="muted">지금까지 학습한 단어 ${total}개</p></div>`;
}

/* ---------- 화면: 오답노트 ---------- */
function viewWrong() {
  setHeader('오답노트', false); setTab('wrong');
  const ids = wrongIds();
  if (!ids.length) { $view.innerHTML = `<div class="empty">📝<br>아직 틀린 단어가 없습니다.<br>퀴즈에서 틀린 단어가 여기에 모입니다.</div>`; return; }
  $view.innerHTML = `<div class="card"><h2>틀린 단어 ${ids.length}개</h2>
    <p class="muted">오답노트 퀴즈에서 ${WRONG_CLEAR}번 연속 맞히면 목록에서 빠집니다.</p>
    <a class="btn" href="#/wrong/quiz">오답 다시 풀기</a><a class="btn ghost" href="#/wrong/flash">카드로 보기</a></div>
    <div class="card"><ul class="list">${ids.map(id => `<li><span class="w">${esc(W(id).w)} <span class="badge">${GRADES[W(id).g]}</span></span>
      <span class="m">${esc(W(id).m)}<br><small>${'●'.repeat(S.wrong[id])}${'○'.repeat(WRONG_CLEAR - S.wrong[id])}</small></span></li>`).join('')}</ul></div>`;
}
function wrongAnswer(id, ok) {
  quizResult(id, ok);
  if (ok) { S.wrong[id] = (S.wrong[id] || 0) + 1; if (S.wrong[id] >= WRONG_CLEAR) delete S.wrong[id]; }
  else S.wrong[id] = 0;
}

/* ---------- 화면: 설정 ---------- */
function viewSettings() {
  setHeader('설정', false); setTab('settings');
  const days = Object.keys(S.days).length;
  const totalActs = Object.values(S.days).reduce((a, b) => a + b, 0);
  $view.innerHTML = `<div class="card"><h2>하루 목표</h2><div class="grid">
      ${[10, 20, 30].map(n => `<button data-goal="${n}" class="${S.goal === n ? 'on' : ''}">${n}단어</button>`).join('')}</div></div>
    <div class="card"><h2>학년</h2><button class="btn ghost" id="chg">학년 바꾸기 (지금: ${S.grade ? GRADES[S.grade] : '없음'})</button></div>
    <div class="card"><h2>기록</h2><p class="muted">공부한 날 ${days}일 · 누적 학습 ${totalActs}회 · 현재 연속 ${streak()}일</p>
      <button class="btn ghost" id="reset" style="color:var(--bad)">학습 기록 모두 지우기</button></div>
    <div class="card"><h2>앱 정보</h2><p class="muted">단어 출처: 교육부 고시 2022 개정 영어과 교육과정 [별표 3] 기본 어휘 3,000단어. 학년 배정과 한글 뜻은 학습 편의를 위해 앱에서 정한 것입니다.<br>
      학습 기록은 이 기기에만 저장됩니다.</p></div>
    <dialog id="dlg"><h2>정말 지울까요?</h2><p class="muted">모든 학습 기록, 복습 일정, 오답노트가 지워집니다.</p>
      <div class="row"><button class="btn ghost" id="no">취소</button><button class="btn" id="yes" style="background:var(--bad)">지우기</button></div></dialog>`;
  $view.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => { S.goal = +b.dataset.goal; save(); viewSettings(); });
  document.getElementById('chg').onclick = () => location.hash = '#/grade';
  const dlg = document.getElementById('dlg');
  document.getElementById('reset').onclick = () => dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
  document.getElementById('no').onclick = () => dlg.close();
  document.getElementById('yes').onclick = () => { const g = S.grade, goal = S.goal; S = defaultState(); S.grade = g; S.goal = goal; save(); dlg.close(); viewSettings(); };
}

/* ---------- 라우터 ---------- */
function route() {
  const p = (location.hash || '#/home').slice(2).split('/');
  window.scrollTo(0, 0);
  switch (p[0]) {
    case 'grade': return viewGrade();
    case 'units': return viewUnits();
    case 'unit': return viewUnit(+p[1], +p[2]);
    case 'flash': setTab('units'); return viewFlash(unitWords(+p[1], +p[2]).map(w => w.id), `${GRADES[+p[1]]} ${+p[2] + 1}단원 카드`, `#/unit/${p[1]}/${p[2]}`);
    case 'quiz': setTab('units'); return viewQuiz(unitWords(+p[1], +p[2]).map(w => w.id), `${GRADES[+p[1]]} ${+p[2] + 1}단원 퀴즈`, `#/unit/${p[1]}/${p[2]}`);
    case 'review':
      if (p[1] === 'go') { setTab('review'); return viewFlash(shuffle(dueIds()), '복습 카드', '#/review'); }
      return viewReview();
    case 'wrong':
      if (p[1] === 'quiz') { setTab('wrong'); return viewQuiz(wrongIds(), '오답 퀴즈', '#/wrong', { onAnswer: wrongAnswer, emptyMsg: '오답노트가 비어 있습니다.' }); }
      if (p[1] === 'flash') { setTab('wrong'); return viewFlash(shuffle(wrongIds()), '오답 카드', '#/wrong'); }
      return viewWrong();
    case 'settings': return viewSettings();
    default: return viewHome();
  }
}
// 뒤로 가기는 브라우저 기록이 아니라 화면의 상위 화면으로 이동합니다(기록을 쓰면 카드 ↔ 단원 사이를 맴돌 수 있음).
function parentOf(hash) {
  const p = (hash || '#/home').slice(2).split('/');
  switch (p[0]) {
    case 'flash': case 'quiz': return `#/unit/${p[1]}/${p[2]}`;
    case 'unit': return '#/units';
    case 'review': return p[1] ? '#/review' : '#/home';
    case 'wrong': return p[1] ? '#/wrong' : '#/home';
    default: return '#/home';
  }
}
function go(hash) { location.replace(hash); }
$back.onclick = () => go(parentOf(location.hash));
// 완료·돌아가기 링크도 기록을 쌓지 않고 이동
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-replace]');
  if (a) { e.preventDefault(); go(a.getAttribute('href')); }
});
$gradeBtn.onclick = () => location.hash = '#/grade';
window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
