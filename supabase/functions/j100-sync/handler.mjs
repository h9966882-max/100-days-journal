/** Read-only, owner-only Notion → 100DJ mirror. No secrets are returned or logged. */
export const SOURCE_ID = '0b1c9a37-8e0d-4d16-8ac3-0b10ad365dc4';
const ORIGIN = 'https://h9966882-max.github.io';
const API_VERSION = '2025-09-03';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS = {'Not started':'not_started','In progress':'in_progress','Done':'done'};
const FIELDS = {'設問':'title','Journal':'select','Day':'number','章':'select','深度':'select',
  'Lens':'multi_select','アカウントID':'rich_text','出典メモ':'rich_text','私の回答':'rich_text',
  '対話からの発見':'rich_text','一言':'rich_text','お気に入り':'checkbox','状態':'status',
  '回答日':'date','公開日':'date'};
export class SyncError extends Error { constructor(code) { super(code); this.code=code; } }
const fail = code => {throw new SyncError(code);};
function dateOnly(value) {
  if (value===null) return null;
  if (typeof value?.start!=='string' || !/^\d{4}-\d{2}-\d{2}/.test(value.start)) fail('source_invalid');
  return value.start.slice(0,10);
}
function plain(items) {
  if (!Array.isArray(items)) fail('source_invalid');
  return items.map(x=>typeof x.plain_text==='string'?x.plain_text:typeof x.text?.content==='string'?x.text.content:fail('source_invalid')).join('');
}
export function normalizePage(page) {
  if (!UUID.test(page.id||'') || !Number.isFinite(Date.parse(page.last_edited_time))) fail('source_invalid');
  const p=page.properties;
  for (const [key,type] of Object.entries(FIELDS)) if(p?.[key]?.type!==type) fail('source_invalid');
  const journal=p.Journal.select?.name, day=p.Day.number;
  if (!/^(Original 100|Follow 0[1-6])$/.test(journal||'') || !Number.isInteger(day) || day<1 || day>100) fail('source_invalid');
  const question=plain(p['設問'].title), status=STATUS[p['状態'].status?.name];
  if (!question.trim() || !status || typeof p['お気に入り'].checkbox!=='boolean') fail('source_invalid');
  if (!Array.isArray(p.Lens.multi_select) || p.Lens.multi_select.some(x=>typeof x.name!=='string')) fail('source_invalid');
  const row={notion_page_id:page.id.toLowerCase(),journal,day,question,
    chapter:p['章'].select?.name??null,depth:p['深度'].select?.name??null,
    lens:p.Lens.multi_select.map(x=>x.name),account_id:plain(p['アカウントID'].rich_text),
    source_note:plain(p['出典メモ'].rich_text),published_on:dateOnly(p['公開日'].date),
    answer:plain(p['私の回答'].rich_text),discovery:plain(p['対話からの発見'].rich_text),
    note:plain(p['一言'].rich_text),favorite:p['お気に入り'].checkbox,status,
    answered_on:dateOnly(p['回答日'].date),source_edited_at:page.last_edited_time};
  if (JSON.stringify(row).length>350000) fail('source_invalid');
  return row;
}
export function validateRows(rows) {
  if (rows.length<100 || rows.length>700) fail('source_incomplete');
  const ids=new Set(),keys=new Set(),days=new Set();
  for(const r of rows) {
    const key=r.journal+'|'+r.day;
    if(ids.has(r.notion_page_id)||keys.has(key)) fail('source_invalid');
    ids.add(r.notion_page_id);keys.add(key);if(r.journal==='Original 100')days.add(r.day);
  }
  if(days.size!==100) fail('source_incomplete');
  return rows;
}
function envKey(env, modern, legacy) {
  try { const obj=JSON.parse(env(modern)||'{}'); if(typeof obj.default==='string')return obj.default; } catch { /* legacy fallback */ }
  return env(legacy)||'';
}
export function createHandler({env,fetcher=fetch,now=()=>new Date(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  return async function handle(req) {
    const origin=req.headers.get('origin');
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
      'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods':'POST, OPTIONS'};
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin && origin!==ORIGIN)return reply({code:'origin_denied'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply({code:'method_not_allowed'},405);
    const auth=req.headers.get('authorization')||'';
    if(!/^Bearer \S+$/i.test(auth))return reply({code:'unauthorized'},401);
    const base=env('SUPABASE_URL'),pub=envKey(env,'SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
    if(!base||!pub)return reply({code:'server_config'},503);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),45000);
    let userId=null,lease=null;
    const rpc=async(name,body)=>{
      const key=envKey(env,'SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
      if(!key)fail('server_config');
      // Legacy service keys need Bearer; new sb_secret keys use apikey only.
      const h={apikey:key,'Content-Type':'application/json'};
      if(!key.startsWith('sb_secret_'))h.Authorization='Bearer '+key;
      const r=await fetcher(base+'/rest/v1/rpc/'+name,{method:'POST',headers:h,body:JSON.stringify(body),signal:controller.signal});
      if(!r.ok)fail('save_failed');
      const text=await r.text();return text?JSON.parse(text):null;
    };
    try {
      const authRes=await fetcher(base+'/auth/v1/user',{headers:{apikey:pub,Authorization:auth},signal:controller.signal});
      if(!authRes.ok)return reply({code:'unauthorized'},401);
      const user=await authRes.json();
      if(!UUID.test(user.id||'')||!user.email_confirmed_at||user.is_anonymous)return reply({code:'unauthorized'},401);
      const owner=(env('J100_OWNER_EMAIL')||'').trim().toLowerCase();
      if(!owner)return reply({code:'setup_required',missing:['J100_OWNER_EMAIL']});
      if((user.email||'').toLowerCase()!==owner)return reply({code:'owner_only'},403);
      userId=user.id;
      const token=(env('J100_NOTION_TOKEN')||'').trim();
      if(!token)return reply({code:'setup_required',missing:['J100_NOTION_TOKEN']});
      const start=await rpc('j100_begin_sync',{p_user_id:userId});
      if(!start?.acquired)return reply({code:'cached',state:start?.state||'syncing'});
      lease=start.lease_id;
      const notion=async(path,method='GET',body)=>{
        for(let attempt=0;attempt<3;attempt++) {
          const r=await fetcher('https://api.notion.com/v1/'+path,{method,
            headers:{Authorization:'Bearer '+token,'Notion-Version':API_VERSION,'Content-Type':'application/json'},
            body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
          if(r.ok)return r.json();
          if(r.status===401||r.status===403||r.status===404)fail('notion_denied');
          if((r.status===429||r.status>=500)&&attempt<2) {
            const seconds=Number(r.headers.get('Retry-After')||attempt+1);
            if(!Number.isFinite(seconds)||seconds>8)fail('notion_unavailable');
            await sleep(Math.max(1,seconds)*1000);continue;
          }
          fail(r.status===400?'source_invalid':'notion_unavailable');
        }
      };
      const rows=[],cursors=new Set();let cursor=null;
      do {
        if(cursors.size>=8)fail('source_incomplete');
        const payload=await notion('data_sources/'+SOURCE_ID+'/query','POST',{
          page_size:100,...(cursor?{start_cursor:cursor}:{})});
        if(!Array.isArray(payload.results)||typeof payload.has_more!=='boolean')fail('source_invalid');
        for(const page of payload.results) {
          if(page.archived||page.in_trash)continue;
          if(page.parent?.data_source_id!==SOURCE_ID)fail('source_invalid');
          // Long rich-text properties are retrieved fully, not truncated silently.
          for(const [name,type] of Object.entries(FIELDS)) {
            const prop=page.properties?.[name];
            if((type==='rich_text'||type==='title')&&Array.isArray(prop?.[type])&&prop[type].length>=25) {
              let pc=null,all=[],seen=new Set();
              do {
                const params=new URLSearchParams({page_size:'100',...(pc?{start_cursor:pc}:{})});
                const propertyId=encodeURIComponent(decodeURIComponent(prop.id));
                const full=await notion('pages/'+page.id+'/properties/'+propertyId+'?'+params);
                if(!Array.isArray(full.results)||typeof full.has_more!=='boolean')fail('source_invalid');
                all.push(...full.results.map(x=>x[type]));
                pc=full.has_more?full.next_cursor:null;
                if(pc){if(seen.has(pc)||seen.size>10)fail('source_incomplete');seen.add(pc);}
              }while(pc);
              prop[type]=all;
              await sleep(350);
            }
          }
          rows.push(normalizePage(page));
        }
        cursor=payload.has_more?payload.next_cursor:null;
        if(payload.has_more&&!cursor)fail('source_incomplete');
        if(cursor){if(cursors.has(cursor))fail('source_incomplete');cursors.add(cursor);await sleep(350);}
      }while(cursor);
      validateRows(rows);
      const saved=await rpc('j100_apply_sync',{p_user_id:userId,p_lease_id:lease,p_rows:rows,p_source_checked_at:now().toISOString()});
      return reply({code:'synced',count:saved.count,last_success_at:saved.last_success_at});
    }catch(error) {
      const code=controller.signal.aborted?'timeout':error instanceof SyncError?error.code:'sync_failed';
      if(userId&&lease&&!controller.signal.aborted) {
        try{await rpc('j100_fail_sync',{p_user_id:userId,p_lease_id:lease,p_code:code});}catch{/* lease expires automatically */}
      }
      return reply({code});
    }finally{clearTimeout(timeout);}
  };
}
