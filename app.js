const SUPABASE_URL='https://wvsogabeckhuhcqelpja.supabase.co';
const SUPABASE_KEY='sb_publishable_tT9nE3rcfJQnjD7cSp543w_kcJSGq_s';
const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const gate=document.getElementById('authGate'),shell=document.getElementById('appShell'),msg=document.getElementById('loginMsg');
function render(session){const logged=!!session;gate.hidden=logged;shell.hidden=!logged;document.body.classList.toggle('is-authenticated',logged);if(logged){gate.setAttribute('aria-hidden','true')}else{gate.removeAttribute('aria-hidden')}}
client.auth.getSession().then(({data})=>render(data.session));
client.auth.onAuthStateChange((_e,session)=>render(session));
document.getElementById('loginForm').addEventListener('submit',async e=>{e.preventDefault();msg.textContent='';const email=document.getElementById('email').value,password=document.getElementById('password').value;const {error}=await client.auth.signInWithPassword({email,password});if(error)msg.textContent='メールアドレスかパスワードを確認してね。'});
document.getElementById('logoutBtn').addEventListener('click',()=>client.auth.signOut());
const toast=document.getElementById('toast');document.querySelectorAll('.card,.talk').forEach(b=>b.addEventListener('click',()=>{toast.textContent=b.dataset.note?b.dataset.note+' — Visual PoC':'ここからChatGPTへ戻る導線を接続予定';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}));