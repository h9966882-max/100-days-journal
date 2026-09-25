/* 100 Days Journal 2.1.0-sync. Notion is canonical; browser answer writes are disabled. */
(() => {
  'use strict';
  const URL='https://wvsogabeckhuhcqelpja.supabase.co';
  const PUBLIC_KEY='sb_publishable_tT9nE3rcfJQnjD7cSp543w_kcJSGq_s';
  const NOTION={original:'https://app.notion.com/p/3e6c70c3c0768111a611e6dc963f7573',follow:'https://app.notion.com/p/3e6c70c3c0768104bf7bf055031709fa'};
  const PREVIEW={id:'preview-1',journal:'Original 100',day:1,
    question:'今の自分を、天気ではなく「時間帯」に例えるなら何時ごろ？',
    chapter:'01｜いまの私',notion_page_id:'3e6c70c3-c076-8122-9cce-f6f445e3c5df'};
  const CHAPTERS=['いまの私','好きと嫌い','からだと感覚','人とのあいだ','選ぶ私','これまでの私','まだ知らない私','世界を見る私','遊ぶ私','これからの私'];
  const JOURNALS=[['hotate_mom','#f0d887','sunflower.webp'],['parumama_journalll','#edd0d5','pink-flower.webp'],['i_am_aioh','#c5d6e1','books.webp'],['haruko117','#cbdcbb','pink-flower.webp'],[null,'#e0d7e9','sunflower.webp'],[null,'#edd8bb','books.webp']];
  const $=id=>document.getElementById(id), gate=$('authGate'),shell=$('appShell'),msg=$('loginMsg'),dialog=$('readerDialog');
  let client,userId=null,generation=0,loading=false,controller=null,lastTry=0,lastSuccess=null;
  let questions=[],entries=new Map(),selected=PREVIEW,scrapMode='discoveries',toastTimer;
  const answeredTime=e=>{const d=e?.answered_on?Date.parse(e.answered_on+'T00:00:00Z'):0;return Number.isFinite(d)?d:0;};
  function latestAnsweredQuestion(){return questions.filter(q=>{const e=entryFor(q);return e&&(e.status==='done'||e.answer||e.discovery||e.note||e.answered_on);}).sort((a,b)=>{const ea=entryFor(a),eb=entryFor(b);return answeredTime(eb)-answeredTime(ea)||Number(b.day||0)-Number(a.day||0);})[0]||null;}
  const element=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
  const entryFor=q=>entries.get(String(q.id));
  function art(file){const i=element('img','art');i.src='assets/'+file;i.alt='';i.loading='lazy';return i;}
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
  function setTab(target,scroll=false){
    if(!['today','original','follow','scraps'].includes(target))target='today';
    document.querySelectorAll('.tab').forEach(t=>{const a=t.dataset.target===target;t.classList.toggle('active',a);t.setAttribute('aria-selected',String(a));t.tabIndex=a?0:-1;});
    document.querySelectorAll('.page-panel').forEach(p=>{p.hidden=p.id!==target;});$('atelier').dataset.view=target;
    if(location.hash!=='#'+target)history.replaceState(null,'','#'+target);
    if(scroll)requestAnimationFrame(()=>window.scrollTo({top:document.querySelector('.book-body').getBoundingClientRect().top+window.scrollY,behavior:'auto'}));
  }
  function questionUrl(q){const id=String(q.notion_page_id||'').replace(/-/g,'');return /^[a-f0-9]{32}$/i.test(id)?'https://app.notion.com/p/'+id:NOTION.original;}
  function renderQuestion(q){
    selected=q;$('questionDay').textContent=String(q.day).padStart(3,'0');$('questionText').textContent=q.question;
    $('questionJournal').textContent=q.account_id||q.journal;$('questionChapter').textContent=q.chapter||'SNSで出会った問い';
    const e=entryFor(q);
    const labels={done:'回答済み',in_progress:'おしゃべり中',not_started:'まだ開いていない問い'};
    $('questionMode').textContent=q.id===PREVIEW.id?'設問プレビュー':labels[e?.status]||'Notionからの設問';
    const a=typeof e?.answer==='string'&&e.answer.length>0,d=typeof e?.discovery==='string'&&e.discovery.length>0,n=typeof e?.note==='string'&&e.note.length>0;
    $('answerArea').hidden=!a&&!d&&!n;
    $('answerText').textContent=a?e.answer:'';$('answerText').style.whiteSpace='pre-wrap';
    $('answerArea').querySelector('h4').hidden=!a;
    $('discoveryArea').hidden=!d;$('discoveryText').textContent=d?e.discovery:'';$('discoveryText').style.whiteSpace='pre-wrap';
    let extra=$('entryNote');if(!extra){extra=element('div');extra.id='entryNote';$('answerArea').append(extra);}extra.replaceChildren();extra.hidden=!n;
    if(n){extra.append(element('h4','','ひとこと'),element('p','',e.note));extra.style.whiteSpace='pre-wrap';}
    let date=$('entryDate');if(!date){date=element('p','muted');date.id='entryDate';$('questionChapter').after(date);}
    date.textContent=e?.answered_on?'回答日：'+e.answered_on:'';date.hidden=!e?.answered_on;
    const nextBtn=$('nextQuestionBtn');
    const next=questions.find(n=>n.journal===q.journal&&Number(n.day)===Number(q.day)+1);
    nextBtn.hidden=!next;nextBtn.disabled=!next;nextBtn.dataset.nextId=next?String(next.id):'';
  }
  function openDialog(title){$('dialogTitle').textContent=title;$('dialogBody').replaceChildren();if(!dialog.open)dialog.showModal();return $('dialogBody');}
  function link(parent,text,href){const a=element('a','dialog-link',text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);}
  function openQuestions(title,test,notionUrl,preview=false){
    const body=openDialog(title);let matches=questions.filter(test);
    if(!matches.length&&preview){matches=[PREVIEW];body.append(element('p','muted','初回同期前のプレビューです。同期の状態は画面下部で確認できます。'));}
    else if(!matches.length)body.append(element('p','muted','まだ表示できる設問がありません。同期の状態を確認してね。Notion正本はそのまま残っています。'));
    matches.forEach(q=>{const b=element('button','question-row');b.type='button';b.append(element('small','','DAY '+String(q.day).padStart(3,'0')),element('span','',q.question));b.addEventListener('click',()=>{renderQuestion(q);dialog.close();setTab('today',true);});body.append(b);});
    link(body,'Notionの正本を開く →',notionUrl);
  }
  function buildShelves(){
    CHAPTERS.forEach((name,index)=>{const b=element('button','chapter-card');b.type='button';b.append(element('b','',String(index+1).padStart(2,'0')),element('span','',name),art(['books.webp','pink-flower.webp','sunflower.webp'][index%3]));b.addEventListener('click',()=>openQuestions(name,q=>q.journal==='Original 100'&&q.day>index*10&&q.day<=(index+1)*10,NOTION.original,index===0));$('chapterGrid').append(b);});
    buildFollowShelf();
  }
  function buildFollowShelf(){
    $('journalCovers').replaceChildren();
    JOURNALS.forEach(([fallback,color,image],index)=>{
      const sourceJournal='Follow '+String(index+1).padStart(2,'0');
      const account=questions.find(q=>q.journal===sourceJournal&&q.account_id)?.account_id||fallback;const b=element('button','journal-cover'+(account?'':' empty'));b.type='button';b.style.setProperty('--book',color);const journal='Follow '+String(index+1).padStart(2,'0');
      b.append(element('small','',journal.toUpperCase()),art(image),element('strong','',account||'新しい一冊のために'),element('span','book-label',account?'本をひらく →':'空いている本棚'));
      b.setAttribute('aria-label',account?account+'の設問をひらく':journal+'・空いている本棚');
      b.addEventListener('click',()=>{if(account)openQuestions(account,q=>q.journal===journal,NOTION.follow);else openDialog('新しい一冊のために').append(element('p','','次に気になるジャーナルと出会ったとき、この場所へ。今は空席のままで大丈夫。'));});$('journalCovers').append(b);
    });
  }
  function renderScraps(){
    const wall=$('scrapWall');wall.replaceChildren();const items=questions.filter(q=>scrapMode==='favorites'?entryFor(q)?.favorite:entryFor(q)?.discovery);
    if(!items.length){const n=element('div','empty-note');n.append(art('pink-flower.webp'),element('span','',scrapMode==='favorites'?'もう一度、ひらきたい。':'ふと生まれた言葉を、ここに。'),element('small','','まだ表示できる記録はありません。会話の記録や回答を、見本として勝手に追加しません。'));wall.append(n);return;}
    items.forEach(q=>{const b=element('button','saved-scrap');b.type='button';b.append(element('small','',(q.account_id||q.journal)+' / DAY '+q.day),element('span','',scrapMode==='favorites'?q.question:entryFor(q).discovery));b.style.whiteSpace='pre-wrap';b.addEventListener('click',()=>{renderQuestion(q);setTab('today',true);});wall.append(b);});
  }
  const timeLabel=iso=>new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Tokyo'}).format(new Date(iso));
  function syncMessage(code,state){
    const keep=lastSuccess?' 最終同期 '+timeLabel(lastSuccess)+' の内容を表示中。':' Notionの正本は変更していません。';
    if(code==='setup_required')return '初回設定が必要です。Notion接続キーと所有者メールを設定してね。'+(lastSuccess?keep:'');
    if(code==='owner_only')return 'このログインアカウントは、この書斎の所有者として設定されていません。';
    if(code==='unauthorized')return 'ログインの有効性を確認できませんでした。再ログインしてね。';
    if(code==='notion_denied')return 'Notionの読み取り権限を確認してね。'+keep;
    if(code==='source_invalid'||code==='source_incomplete')return '設問の重複・不足や項目の変更を検出したため、上書きせず停止しました。'+keep;
    if(code==='cached'&&state==='syncing')return '別の取得処理が進行中です。'+keep;
    if((code==='synced'||code==='cached')&&lastSuccess&&state!=='error')return 'Notionと同期しました · '+timeLabel(lastSuccess)+'。表示中は約30秒ごとに確認。';
    return '最新の同期に失敗しました。'+keep;
  }
  function applySnapshot(data){
    if(!data||!Array.isArray(data.questions)||!Array.isArray(data.entries))throw Error('invalid_snapshot');
    if(data.member===false){questions=[];entries=new Map();lastSuccess=null;renderQuestion(PREVIEW);renderScraps();buildFollowShelf();return;}
    questions=data.questions.filter(q=>typeof q.question==='string');entries=new Map(data.entries.map(e=>[String(e.question_id),e]));
    lastSuccess=data.sync?.last_success_at||lastSuccess;
    const latest=latestAnsweredQuestion();
    const keepSelected=selected&&selected.id!==PREVIEW.id&&questions.find(q=>q.notion_page_id===selected.notion_page_id);
    const next=keepSelected||latest||questions.find(q=>q.journal==='Original 100'&&q.day===1)||PREVIEW;
    renderQuestion(next);renderScraps();buildFollowShelf();
  }
  async function refreshData(manual=false){
    if(!userId||!client||loading||(!manual&&Date.now()-lastTry<15000))return;
    const g=generation;loading=true;lastTry=Date.now();$('refreshBtn').disabled=true;
    const ctl=new AbortController();controller=ctl;const timer=setTimeout(()=>ctl.abort(),55000);
    let code='sync_failed',state=null,readOK=false;
    const read=async()=>{const r=await client.rpc('j100_read_snapshot').abortSignal(ctl.signal);if(r.error)throw Error('read_failed');if(g!==generation)return;applySnapshot(r.data);state=r.data.sync?.state;readOK=true;};
    $('syncStatus').textContent='Notionの更新を確認しています…';
    try{
      // Show the last committed snapshot while the source is being fetched.
      try{await read();}catch{/* keep current in-memory snapshot */}
      if(g!==generation)return;
      const session=await client.auth.getSession();
      if(g!==generation)return;
      const token=session.data?.session?.access_token;
      if(!token){code='unauthorized';throw Error('no_session');}
      const r=await fetch(URL+'/functions/v1/j100-sync',{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:ctl.signal});
      const result=await r.json();if(g!==generation)return;
      code=r.status===401?'unauthorized':r.status===403?'owner_only':result.code||'sync_failed';
      if(code==='owner_only'||code==='unauthorized'){questions=[];entries=new Map();lastSuccess=null;renderQuestion(PREVIEW);renderScraps();}
      else {await read();}
      if(g===generation)$('syncStatus').textContent=syncMessage(code,state);
    }catch{
      if(g===generation){
        if(code==='synced')code='display_failed';
        $('syncStatus').textContent=syncMessage(code,state)+(readOK?'':' 表示データの取得も確認できていません。');
      }
    }finally{
      clearTimeout(timer);if(g===generation){loading=false;controller=null;$('refreshBtn').disabled=false;}
    }
  }
  function renderAuth(session){
    const next=session?.user?.id||null;gate.hidden=Boolean(next);shell.hidden=!next;if(next===userId)return;
    controller?.abort();userId=next;generation++;loading=false;lastTry=0;lastSuccess=null;
    questions=[];entries=new Map();selected=PREVIEW;renderQuestion(PREVIEW);renderScraps();if(dialog.open)dialog.close();
    $('password').value='';$('refreshBtn').disabled=false;
    if(userId)setTimeout(()=>refreshData(true),0);else{setTab('today');window.scrollTo(0,0);}
  }
  $('closeDialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  document.querySelectorAll('.tab').forEach((t,i,tabs)=>{t.addEventListener('click',()=>setTab(t.dataset.target,true));t.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowRight'?1:3))%4;tabs[n].focus();setTab(tabs[n].dataset.target);});});
  window.addEventListener('hashchange',()=>setTab(location.hash.slice(1)));
  document.querySelectorAll('[data-scrap]').forEach(b=>b.addEventListener('click',()=>{scrapMode=b.dataset.scrap;document.querySelectorAll('[data-scrap]').forEach(n=>{const a=n===b;n.classList.toggle('selected',a);n.setAttribute('aria-pressed',String(a));});renderScraps();}));
  $('nextQuestionBtn').addEventListener('click',()=>{const id=$('nextQuestionBtn').dataset.nextId;const next=questions.find(q=>String(q.id)===id);if(!next)return;renderQuestion(next);window.scrollTo({top:document.querySelector('.question-sheet').getBoundingClientRect().top+window.scrollY-90,behavior:'smooth'});});
  $('talkBtn').addEventListener('click',()=>{
    const body=openDialog('篤史と、この問いを。');body.append(element('p','','問いをコピーして、今使っているChatGPTのチャットへ戻ろう。新しいチャットは作らなくて大丈夫。'));
    const field=element('textarea');field.readOnly=true;field.setAttribute('aria-label','コピーする設問');
    field.value='100日ジャーナリング｜'+(selected.account_id||selected.journal)+'｜Day '+selected.day+'\n'+selected.question+'\nこの問いについて、短くおしゃべりしながら考えたい。';
    const copy=element('button','primary','問いをコピー');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(field.value);toast('コピーしたよ。今のチャットへ戻ってね。');}catch{field.focus();field.select();toast('この欄の文章を選択してコピーしてね。');}});body.append(field,copy);link(body,'この問いのNotion正本 →',questionUrl(selected));
  });
  $('refreshBtn').textContent='Notionと同期';$('refreshBtn').addEventListener('click',()=>refreshData(true));
  const setup=element('a','dialog-link','初回の同期設定');setup.href='https://github.com/h9966882-max/100-days-journal/blob/main/docs/SYNC_SETUP.md';setup.target='_blank';setup.rel='noopener noreferrer';$('syncStatus').parentElement.append(setup);
  setInterval(()=>{if(document.visibilityState==='visible')refreshData();},30000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshData();});
  window.addEventListener('focus',()=>refreshData());window.addEventListener('online',()=>refreshData(true));
  buildShelves();renderQuestion(PREVIEW);renderScraps();setTab(location.hash.slice(1));
  try{
    if(!window.supabase?.createClient)throw Error('SDK unavailable');
    client=sdk.createClient(URL,PUBLIC_KEY);
    client.auth.onAuthStateChange((_event,session)=>renderAuth(session));
    client.auth.getSession().then(({data,error})=>{if(error)throw error;renderAuth(data.session);msg.textContent='';$('loginSubmit').disabled=false;})
      .catch(()=>{msg.textContent='ログイン状態を確認できませんでした。通信を確認して、再読み込みしてね。';$('loginSubmit').disabled=false;});
  }catch{msg.textContent='認証機能を読み込めませんでした。通信を確認して、再読み込みしてね。';}
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;$('loginSubmit').disabled=true;msg.textContent='書斎をひらいています…';
    try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;renderAuth(data.session);msg.textContent='';}
    catch{msg.textContent='ログインできませんでした。入力内容と通信を確認してね。';}finally{$('loginSubmit').disabled=false;}});
  $('logoutBtn').addEventListener('click',async()=>{$('logoutBtn').disabled=true;try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;renderAuth(null);}catch{toast('ログアウトできませんでした。通信を確認して、もう一度試してね。');}finally{$('logoutBtn').disabled=false;}});
})();
