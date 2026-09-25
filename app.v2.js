/* 100 Days Journal 2.0.0-assets. Notion is canonical; this client is read-only. */
(() => {
  'use strict';
  const URL = 'https://wvsogabeckhuhcqelpja.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_tT9nE3rcfJQnjD7cSp543w_kcJSGq_s';
  const NOTION = {
    original: 'https://app.notion.com/p/3e6c70c3c0768111a611e6dc963f7573',
    follow: 'https://app.notion.com/p/3e6c70c3c0768104bf7bf055031709fa',
    scraps: 'https://app.notion.com/p/3e6c70c3c0768183a975db66f766cee7'
  };
  // This one question was read from the canonical Notion page on 2026-09-25.
  // It is a clearly labelled preview, never presented as a synchronized answer.
  const PREVIEW = { id: 'preview-1', journal: 'Original 100', day: 1,
    question: '今の自分を、天気ではなく「時間帯」に例えるなら何時ごろ？',
    chapter: '01｜いまの私', notion_page_id: '3e6c70c3-c076-8122-9cce-f6f445e3c5df' };
  const CHAPTERS = ['いまの私','好きと嫌い','からだと感覚','人とのあいだ','選ぶ私','これまでの私','まだ知らない私','世界を見る私','遊ぶ私','これからの私'];
  const JOURNALS = [
    ['hotate_mom', '#f0d887', 'sunflower.webp'],
    ['parumama_journalll', '#edd0d5', 'pink-flower.webp'],
    ['i_am_aioh', '#c5d6e1', 'books.webp'],
    ['haruko117', '#cbdcbb', 'pink-flower.webp'],
    [null, '#e0d7e9', 'sunflower.webp'], [null, '#edd8bb', 'books.webp']
  ];
  const $ = id => document.getElementById(id);
  const gate = $('authGate'), shell = $('appShell'), msg = $('loginMsg');
  const dialog = $('readerDialog');
  let client, userId = null, generation = 0, dataGeneration = 0, loading = false;
  let questions = [], entries = new Map(), selected = PREVIEW, scrapMode = 'discoveries', toastTimer;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function art(file) {
    const image = element('img', 'art'); image.src = 'assets/' + file; image.alt = ''; image.loading = 'lazy';
    return image;
  }
  function toast(text) {
    $('toast').textContent = text; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
  }
  function setTab(target, scroll = false) {
    if (!['today','original','follow','scraps'].includes(target)) target = 'today';
    document.querySelectorAll('.tab').forEach(tab => {
      const active = tab.dataset.target === target;
      tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('.page-panel').forEach(panel => { panel.hidden = panel.id !== target; });
    $('atelier').dataset.view = target;
    if (location.hash !== '#' + target) history.replaceState(null, '', '#' + target);
    if (scroll) requestAnimationFrame(() => window.scrollTo({ top: document.querySelector('.book-body').getBoundingClientRect().top + window.scrollY, behavior: 'auto' }));
  }
  function questionUrl(question) {
    const id = String(question.notion_page_id || '').replace(/-/g, '');
    return /^[a-f0-9]{32}$/i.test(id) ? 'https://app.notion.com/p/' + id : NOTION.original;
  }
  function renderQuestion(question) {
    selected = question;
    $('questionDay').textContent = String(question.day).padStart(3, '0');
    $('questionText').textContent = question.question;
    $('questionJournal').textContent = question.account_id || question.journal;
    $('questionChapter').textContent = question.chapter || 'SNSで出会った問い';
    $('questionMode').textContent = question.id === PREVIEW.id ? '設問プレビュー' : '表示データ';
    const entry = entries.get(question.id);
    const hasAnswer = typeof entry?.answer === 'string' && entry.answer.length > 0;
    const hasDiscovery = typeof entry?.discovery === 'string' && entry.discovery.length > 0;
    $('answerArea').hidden = !hasAnswer && !hasDiscovery;
    $('answerText').textContent = hasAnswer ? entry.answer : '';
    $('discoveryArea').hidden = !hasDiscovery;
    $('discoveryText').textContent = hasDiscovery ? entry.discovery : '';
  }
  function openDialog(title) {
    $('dialogTitle').textContent = title; $('dialogBody').replaceChildren();
    if (!dialog.open) dialog.showModal();
    return $('dialogBody');
  }
  function link(parent, text, href) {
    const anchor = element('a', 'dialog-link', text); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; parent.append(anchor);
  }
  function openQuestions(title, test, notionUrl, preview = false) {
    const body = openDialog(title);
    let matches = questions.filter(test);
    if (!matches.length && preview) {
      matches = [PREVIEW];
      body.append(element('p', 'muted', '自動同期は準備中。Notionで確認済みのDay 1をプレビューできます。'));
    } else if (!matches.length) {
      body.append(element('p', 'muted', 'この本の設問は、まだWeb側へ同期されていません。Notion正本はそのまま残っています。'));
    }
    matches.forEach(question => {
      const button = element('button', 'question-row'); button.type = 'button';
      button.append(element('small', '', 'DAY ' + String(question.day).padStart(3, '0')), element('span', '', question.question));
      button.addEventListener('click', () => { renderQuestion(question); dialog.close(); setTab('today', true); });
      body.append(button);
    });
    link(body, 'Notionの正本を開く →', notionUrl);
  }
  function buildShelves() {
    CHAPTERS.forEach((name, index) => {
      const card = element('button', 'chapter-card'); card.type = 'button';
      card.append(element('b', '', String(index + 1).padStart(2, '0')), element('span', '', name), art(['books.webp','pink-flower.webp','sunflower.webp'][index % 3]));
      card.addEventListener('click', () => openQuestions(name, q => q.journal === 'Original 100' && q.day > index * 10 && q.day <= (index + 1) * 10, NOTION.original, index === 0));
      $('chapterGrid').append(card);
    });
    JOURNALS.forEach(([account, color, image], index) => {
      const book = element('button', 'journal-cover' + (account ? '' : ' empty')); book.type = 'button';
      book.style.setProperty('--book', color);
      const journal = 'Follow ' + String(index + 1).padStart(2, '0');
      book.append(element('small', '', journal.toUpperCase()), art(image), element('strong', '', account || '新しい一冊のために'), element('span', 'book-label', account ? '本をひらく →' : '空いている本棚'));
      book.setAttribute('aria-label', account ? account + 'の設問をひらく' : journal + '・空いている本棚');
      book.addEventListener('click', () => {
        if (account) openQuestions(account, q => q.journal === journal, NOTION.follow);
        else { const body = openDialog('新しい一冊のために'); body.append(element('p', '', '次に気になるジャーナルと出会ったとき、この場所へ。今は空席のままで大丈夫。')); }
      });
      $('journalCovers').append(book);
    });
  }
  function renderScraps() {
    const wall = $('scrapWall'); wall.replaceChildren();
    const items = questions.filter(q => {
      const entry = entries.get(q.id); return scrapMode === 'favorites' ? entry?.favorite : entry?.discovery;
    });
    if (!items.length) {
      const note = element('div', 'empty-note');
      note.append(art('pink-flower.webp'), element('span', '', scrapMode === 'favorites' ? 'もう一度、ひらきたい。' : 'ふと生まれた言葉を、ここに。'), element('small', '', 'まだ表示できる記録はありません。会話の記録や回答を、見本として勝手に追加しません。'));
      wall.append(note); return;
    }
    items.forEach(q => {
      const button = element('button', 'saved-scrap'); button.type = 'button';
      button.append(element('small', '', (q.account_id || q.journal) + ' / DAY ' + q.day), element('span', '', scrapMode === 'favorites' ? q.question : entries.get(q.id).discovery));
      button.addEventListener('click', () => { renderQuestion(q); setTab('today', true); }); wall.append(button);
    });
  }
  async function refreshData() {
    if (!userId || !client || loading) return;
    loading = true; $('refreshBtn').disabled = true;
    const authGeneration = generation, requestGeneration = ++dataGeneration;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const [questionResult, entryResult] = await Promise.all([
        client.from('j100_questions').select('id,journal,day,question,chapter,account_id,notion_page_id').order('day').abortSignal(controller.signal),
        client.from('j100_entries').select('question_id,answer,discovery,favorite,status,answered_on').eq('user_id', userId).abortSignal(controller.signal)
      ]);
      if (authGeneration !== generation || requestGeneration !== dataGeneration) return;
      if (questionResult.error || entryResult.error) throw new Error('read-failed');
      questions = Array.isArray(questionResult.data) ? questionResult.data.filter(q => typeof q.question === 'string') : [];
      entries = new Map((entryResult.data || []).map(entry => [entry.question_id, entry]));
      const next = questions.find(q => q.id === selected.id) || questions.find(q => q.journal === 'Original 100' && q.day === 1) || PREVIEW;
      renderQuestion(next); renderScraps();
      $('syncStatus').textContent = questions.length ? '表示データを読み込みました。Notionからの自動同期はまだ未接続です。' : 'Notionの自動同期は未接続。確認済みのDay 1をプレビュー表示。';
    } catch (_) {
      if (authGeneration === generation) $('syncStatus').textContent = '表示データを取得できませんでした。Notionの正本は変更していません。';
    } finally {
      clearTimeout(timer);
      if (authGeneration === generation) { loading = false; $('refreshBtn').disabled = false; }
    }
  }
  function renderAuth(session) {
    const nextUser = session?.user?.id || null;
    gate.hidden = Boolean(nextUser); shell.hidden = !nextUser;
    if (nextUser === userId) return;
    userId = nextUser; generation++; dataGeneration++; loading = false;
    questions = []; entries = new Map(); selected = PREVIEW; renderQuestion(PREVIEW); renderScraps();
    if (dialog.open) dialog.close();
    $('password').value = ''; $('refreshBtn').disabled = false;
    if (userId) setTimeout(refreshData, 0); // Do not await SDK calls in onAuthStateChange.
    else { setTab('today'); window.scrollTo(0, 0); }
  }
  $('closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  document.querySelectorAll('.tab').forEach((tab, i, tabs) => {
    tab.addEventListener('click', () => setTab(tab.dataset.target, true));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (i + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
      tabs[next].focus(); setTab(tabs[next].dataset.target);
    });
  });
  window.addEventListener('hashchange', () => setTab(location.hash.slice(1)));
  document.querySelectorAll('[data-scrap]').forEach(button => button.addEventListener('click', () => {
    scrapMode = button.dataset.scrap;
    document.querySelectorAll('[data-scrap]').forEach(node => { const active = node === button; node.classList.toggle('selected', active); node.setAttribute('aria-pressed', String(active)); });
    renderScraps();
  }));
  $('talkBtn').addEventListener('click', () => {
    const body = openDialog('篤史と、この問いを。');
    body.append(element('p', '', '問いをコピーして、今使っているChatGPTのチャットへ戻ろう。新しいチャットは作らなくて大丈夫。'));
    const field = element('textarea'); field.readOnly = true; field.setAttribute('aria-label', 'コピーする設問');
    field.value = '100日ジャーナリング｜' + (selected.account_id || selected.journal) + '｜Day ' + selected.day + '\n' + selected.question + '\nこの問いについて、短くおしゃべりしながら考えたい。';
    const copy = element('button', 'primary', '問いをコピー'); copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(field.value); toast('コピーしたよ。今のチャットへ戻ってね。'); }
      catch (_) { field.focus(); field.select(); toast('この欄の文章を選択してコピーしてね。'); }
    });
    body.append(field, copy); link(body, 'この問いのNotion正本 →', questionUrl(selected));
  });
  $('refreshBtn').addEventListener('click', refreshData);
  buildShelves(); renderQuestion(PREVIEW); renderScraps(); setTab(location.hash.slice(1));
  try {
    if (!window.supabase?.createClient) throw new Error('SDK unavailable');
    client = window.supabase.createClient(URL, PUBLIC_KEY); // Existing Dialy session storage is preserved.
    client.auth.onAuthStateChange((_event, session) => renderAuth(session));
    client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      renderAuth(data.session); msg.textContent = ''; $('loginSubmit').disabled = false;
    }).catch(() => { msg.textContent = 'ログイン状態を確認できませんでした。通信を確認して、再読み込みしてね。'; $('loginSubmit').disabled = false; });
  } catch (_) { msg.textContent = '認証機能を読み込めませんでした。通信を確認して、再読み込みしてね。'; }
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault(); if (!client) return;
    $('loginSubmit').disabled = true; msg.textContent = '書斎をひらいています…';
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
      if (error) throw error; renderAuth(data.session); msg.textContent = '';
    } catch (_) { msg.textContent = 'ログインできませんでした。入力内容と通信を確認してね。'; }
    finally { $('loginSubmit').disabled = false; }
  });
  $('logoutBtn').addEventListener('click', async () => {
    $('logoutBtn').disabled = true;
    try { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw error; renderAuth(null); }
    catch (_) { toast('ログアウトできませんでした。通信を確認して、もう一度試してね。'); }
    finally { $('logoutBtn').disabled = false; }
  });
})();
