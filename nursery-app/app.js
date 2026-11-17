/* ============================================================
   ГЕКТАРЫ СЧАСТЬЯ · Инвентаризация питомника · v3
   8-значные коды, код подписан на этикетках, эмблема в иконке
   ============================================================ */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>{n=+n||0;const o={style:'currency',currency:'RUB',maximumFractionDigits:Number.isInteger(n)?0:2};return new Intl.NumberFormat('ru-RU',o).format(n)};
const dtFull=ts=>new Date(ts).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const dtDay=ts=>new Date(ts).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
function toast(msg,type=''){const t=document.createElement('div');t.className='toast '+type;t.innerHTML=msg;$('#toasts').append(t);setTimeout(()=>t.remove(),4200)}
function beep(){try{const a=beep._a||(beep._a=new (window.AudioContext||window.webkitAudioContext)());const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=1150;g.gain.value=.12;o.start();o.stop(a.currentTime+.12)}catch(e){}}
const vib=ms=>navigator.vibrate&&navigator.vibrate(ms);
function fileCompress(file,max=900,q=.72){return new Promise(res=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{let w=img.width,h=img.height;const k=Math.min(1,max/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',q))};img.src=u})}

/* ---------- настройки ---------- */
let settings={code:'',device:'',low:5,sbUrl:'',sbKey:'',...JSON.parse(localStorage.getItem('pn-set')||'{}')};
if(!settings.device){const ua=navigator.userAgent;settings.device=(/iphone|ipad/i.test(ua)?'iPhone':/android/i.test(ua)?'Android':'Устройство')+'-'+Math.floor(10+Math.random()*90)}
const saveSettings=()=>localStorage.setItem('pn-set',JSON.stringify(settings));

/* ---------- IndexedDB ---------- */
const DB={db:null,
 open(){return new Promise((res,rej)=>{const r=indexedDB.open('nursery-db',1);
  r.onupgradeneeded=e=>{const d=e.target.result;['sites','items','sales','log'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})})};
  r.onsuccess=e=>{DB.db=e.target.result;res()};r.onerror=()=>rej(r.error)})},
 all(s){return new Promise((res,rej)=>{const q=DB.db.transaction(s).objectStore(s).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error)})},
 put(s,v){return new Promise((res,rej)=>{const t=DB.db.transaction(s,'readwrite');t.objectStore(s).put(v);t.oncomplete=res;t.onerror=()=>rej(t.error)})},
 bulk(s,arr){return new Promise(res=>{if(!arr.length)return res();const t=DB.db.transaction(s,'readwrite'),o=t.objectStore(s);arr.forEach(v=>o.put(v));t.oncomplete=res})}};

let state={sites:[],items:[],sales:[],log:[]};
async function loadAll(){[state.sites,state.items,state.sales,state.log]=await Promise.all(['sites','items','sales','log'].map(s=>DB.all(s)));reSort()}
function reSort(){state.sites.sort((a,b)=>(+a.num)-(+b.num));state.items.sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));state.sales.sort((a,b)=>b.ts-a.ts);state.log.sort((a,b)=>b.ts-a.ts)}
const actSites=()=>state.sites.filter(s=>!s.deletedAt);
const actItems=()=>state.items.filter(i=>!i.deletedAt);
const sitesById=()=>Object.fromEntries(actSites().map(s=>[s.id,s]));
const itemsById=()=>Object.fromEntries(actItems().map(i=>[i.id,i]));
const siteOf=it=>sitesById()[it.siteId]||{num:'?',name:''};
const LOWF=()=>+settings.low||5;

/* ---------- себестоимость: партии + средневзвешенная ---------- */
function batchUnit(b){const t=(+b.purchase||0)+(+b.soil||0)+(+b.fert||0)+(+b.pot||0)+(+b.water||0);const n=+b.qty||0;return n>0?t/n:null}
function unitCost(it){
 const bs=(it.batches||[]).map(b=>({q:+b.qty||0,u:batchUnit(b)})).filter(x=>x.u!=null&&x.q>0);
 if(bs.length){const tq=bs.reduce((a,x)=>a+x.q,0);const unit=bs.reduce((a,x)=>a+x.q*x.u,0)/tq;return{unit,batches:bs,avg:true}}
 const c=it.cost||{};const t=(+c.purchase||0)+(+c.soil||0)+(+c.fert||0)+(+c.pot||0)+(+c.water||0);const n=+c.batchQty||0;
 return{unit:n>0?t/n:null,batches:[],avg:false}}
function addLog(type,text){const e={id:uid(),ts:Date.now(),updatedAt:Date.now(),device:settings.device,type,text};state.log.unshift(e);DB.put('log',e);maybeSync()}

/* ---------- Code 128: генератор ---------- */
const C128=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
const PAT2VAL={};C128.forEach((p,i)=>{if(i<=105)PAT2VAL[p]=i});
const STARTB='211214',STOP='2331112';
function c128segments(text){const vals=[104];let sum=104;
 for(let i=0;i<text.length;i++){const v=Math.min(102,Math.max(0,(text.charCodeAt(i)&0x7f)-32));vals.push(v);sum+=v*(i+1)}
 vals.push(sum%103);vals.push(106);
 const segs=[];let x=0;
 for(const v of vals){const p=C128[v];for(let j=0;j<p.length;j++){const w=+p[j];if(j%2===0)segs.push([x,w]);x+=w}}
 return{segs,width:x}}
function svgBarcode(text){const{segs,width}=c128segments(text);
 const bars=segs.map(([x,w])=>`<rect x="${x}" y="0" width="${w}" height="40"/>`).join('');
 return`<svg viewBox="0 0 ${width} 40" preserveAspectRatio="none" fill="#111"><rect width="${width}" height="40" fill="#fff"/>${bars}</svg>`}

/* ---------- Code 128: свой раскодировщик с камеры (офлайн) ---------- */
let decCanvas=null;
function rowRuns(img,W,y,tf){const L=new Uint8Array(W);let min=255,max=0;
 for(let x=0;x<W;x++){const o=(y*W+x)*4;const l=(img[o]*299+img[o+1]*587+img[o+2]*114)/1000;L[x]=l;if(l<min)min=l;if(l>max)max=l}
 if(max-min<50)return null;const thr=min+(max-min)*tf;const runs=[];let b=L[0]<thr,len=1;
 for(let x=1;x<W;x++){const nb=L[x]<thr;if(nb===b)len++;else{runs.push({b,len});b=nb;len=1}}
 runs.push({b,len});if(runs.length&&runs[0].b===false)runs.shift();
 return runs.length>7?runs:null}
function normRuns(sl,mod){const tot=sl.reduce((a,r)=>a+r.len,0);if(!tot)return null;return sl.map(r=>Math.max(1,Math.round(r.len*mod/tot))).join('')}
function decodeRuns(runs){
 for(let i=0;i+6<runs.length;i++){if(!runs[i].b)continue;
  if(normRuns(runs.slice(i,i+6),11)!==STARTB)continue;
  let pos=i+6;const vals=[];let done=null;
  while(pos+6<=runs.length){
   if(pos+7<=runs.length&&normRuns(runs.slice(pos,pos+7),13)===STOP){
    if(vals.length>=2){const check=vals[vals.length-1],data=vals.slice(0,-1);let s=104;data.forEach((v,k)=>s+=v*(k+1));
     if(s%103===check&&!data.some(v=>v>95))done=data.map(v=>String.fromCharCode(v+32)).join('')}
    break}
   if(!runs[pos].b)break;
   const k=normRuns(runs.slice(pos,pos+6),11);const v=k==null?undefined:PAT2VAL[k];
   if(v===undefined)break;
   vals.push(v);pos+=6}
  if(done)return done}
 return null}
function grabDecode(video){if(!decCanvas){decCanvas=document.createElement('canvas');decCanvas.width=480;decCanvas.height=270}
 const ctx=decCanvas.getContext('2d',{willReadFrequently:true});
 try{ctx.drawImage(video,0,0,480,270)}catch(e){return null}
 const img=ctx.getImageData(0,0,480,270).data;
 for(const fy of[0.5,0.44,0.56,0.38,0.62]){const y=Math.floor(270*fy);
  for(const tf of[0.5,0.42,0.58]){const runs=rowRuns(img,480,y,tf);if(!runs)continue;
   const s=decodeRuns(runs);if(s)return s}}
 return null}

/* ---------- этикетки: canvas (A4 43×25 и термо 46×20), код подписан цифрами ---------- */
function fitText(ctx,text,maxW){let t=text;while(t.length>3&&ctx.measureText(t).width>maxW)t=t.slice(0,-2).trimEnd()+'…';return t}
function renderLabelCanvas(it,thermo){const mm=10,W=(thermo?46:43)*mm,H=(thermo?20:25)*mm;
 const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 x.fillStyle='#fff';x.fillRect(0,0,W,H);x.textBaseline='top';
 const st=siteOf(it),pad=(thermo?1.5:2)*mm;
 const code=String(it.barcode||'');
 if(thermo){
  x.fillStyle='#151515';x.font='700 22px system-ui,Arial';x.fillText(fitText(x,it.name||'',W-2*pad),pad,1.2*mm);
  x.font='500 15px system-ui,Arial';x.fillStyle='#333';x.fillText(fitText(x,(it.variety||'')+' · площ. '+st.num,W-2*pad),pad,4.3*mm);
  x.font='800 21px system-ui,Arial';x.fillStyle='#111';x.fillText(money(it.price),pad,6.9*mm);
  x.font='800 15px system-ui,Arial';x.textAlign='right';x.fillText(code,W-pad,7.2*mm);x.textAlign='left';
  const{segs,width}=c128segments(code||'0');const bw=W-2*pad,bh=9*mm,by=H-bh-0.8*mm,k=bw/width;
  for(const[sx,sw]of segs)x.fillRect(pad+sx*k,by,Math.max(1,sw*k),bh);
 }else{
  x.fillStyle='#151515';x.font='700 25px system-ui,Arial';x.fillText(fitText(x,it.name||'Без названия',W-2*pad),pad,1.6*mm);
  x.font='500 18px system-ui,Arial';x.fillStyle='#333';x.fillText(fitText(x,(it.variety||'сорт —')+' · площ. '+st.num,W-2*pad),pad,5.1*mm);
  x.font='800 26px system-ui,Arial';x.fillStyle='#111';x.fillText(money(it.price),pad,8.2*mm);
  x.font='800 18px system-ui,Arial';x.textAlign='right';x.fillText(code,W-pad,8.8*mm);x.textAlign='left';
  const{segs,width}=c128segments(code||'0');const bw=W-2*pad,bh=10*mm,by=H-bh-1.4*mm,k=bw/width;
  for(const[sx,sw]of segs)x.fillRect(pad+sx*k,by,Math.max(1,sw*k),bh)}
 return c}

/* ---------- роутер ---------- */
let scanCtx=null,saleOpen=null;
window.addEventListener('hashchange',route);
function go(h){location.hash=h}
document.addEventListener('click',e=>{const el=e.target.closest('[data-go]');if(el)go(el.dataset.go)});
$$('#tabbar [data-nav]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.nav)));
async function route(){stopScan();saleOpen=null;$('#modal-root').innerHTML='';
 const h=location.hash||'#/sites';const parts=h.split('/');const part=parts[1]||'sites';const arg=parts[2]||'';
 const tabs={'sites':0,'labels':1,'scan':2,'reports':3,'history':4};
 $$('#tabbar button').forEach((b,i)=>b.classList.toggle('on',i===tabs[part]));
 const v=$('#view');v.style.animation='none';v.offsetHeight;v.style.animation='';
 try{
  if(part==='sites'&&!arg)v.innerHTML=renderSites();
  else if(part==='site')v.innerHTML=renderSitePage(arg);
  else if(part==='item')v.innerHTML=renderItemForm(arg),bindItemForm(arg);
  else if(part==='labels')v.innerHTML=renderLabels(),bindLabels();
  else if(part==='scan')v.innerHTML=renderScan(),bindScan();
  else if(part==='history')v.innerHTML=renderHistory(),bindHistory();
  else if(part==='reports')v.innerHTML=renderReports(),bindReports();
  else if(part==='settings')v.innerHTML=renderSettings(),bindSettings();
  else v.innerHTML=renderSites();
 }catch(err){console.error(err);v.innerHTML='<div class="empty"><span class="big">🌧️</span><b>Ошибка</b>'+esc(err.message)+'</div>'}}

/* ---------- площадки ---------- */
function renderSites(){
 const items=actItems();
 const totalPots=items.reduce((s,i)=>s+(+i.qty||0),0);
 const lowN=items.filter(i=>+i.qty<LOWF()).length;
 let list='';
 const ss=actSites();
 if(!ss.length)list=`<div class="empty"><span class="big">🌱</span><b>Площадок пока нет</b>Создайте первую — например, «№1 — метельчатые гортензии».<br><br><button class="btn primary" onclick="siteForm()">+ Создать площадку</button></div>`;
 for(const s of ss){const its=items.filter(i=>i.siteId===s.id);
  const pots=its.reduce((a,i)=>a+(+i.qty||0),0),low=its.filter(i=>+i.qty<LOWF()).length;
  list+=`<button class="card row-card" data-go="#/site/${s.id}">
   <span class="ph" style="font-family:var(--fd);font-weight:900;color:var(--pine);font-size:20px">№${esc(s.num)}</span>
   <span class="row-main"><h3>${esc(s.name||'Без названия')}</h3>
     <span class="sub">${its.length} позиций · ${pots} горшков ${low?`<span class="low" style="margin-left:6px">⚠ мало: ${low}</span>`:''}</span></span>
   <span class="row-side"><span class="pots">${pots}<small>горшков</small></span></span></button>`}
 return`<div class="pagehead"><h2>Площадки</h2></div>
  <div class="stat-strip">
   <div class="stat"><b>${ss.length}</b><span>площадок</span></div>
   <div class="stat"><b>${items.length}</b><span>позиций</span></div>
   <div class="stat"><b>${totalPots}</b><span>горшков</span></div>
   <div class="stat ${lowN?'warn':''}"><b>${lowN}</b><span>заканч.</span></div>
  </div>${list}
  ${ss.length?'<div class="btnrow"><button class="btn primary big" onclick="siteForm()">+ Новая площадка</button></div>':''}`}
window.siteForm=function(site){const s=site||{};
 $('#modal-root').innerHTML=`<div class="backdrop" onclick="closeSheet()"></div>
 <div class="sheet"><div class="grab"></div>
  <h3 style="margin:0 0 12px;font-family:var(--fd)">${s.id?'Изменить':'Новая'} площадка</h3>
  <div class="grid2"><div class="field"><label>Номер</label><input id="sf-num" value="${esc(s.num??(actSites().length+1))}" inputmode="numeric"></div>
  <div class="field"><label>Название</label><input id="sf-name" value="${esc(s.name||'')}" placeholder="метельчатые гортензии"></div></div>
  <div class="btnrow"><button class="btn ghost" onclick="closeSheet()">Отмена</button>
   <button class="btn primary" id="sf-save">Сохранить</button>
   ${s.id?'<button class="btn danger small" id="sf-del">Удалить</button>':''}</div></div>`;
 $('#sf-save').onclick=async()=>{const num=$('#sf-num').value.trim(),name=$('#sf-name').value.trim();
  if(!num)return toast('Укажите номер','warn');
  if(s.id){const cur=state.sites.find(x=>x.id===s.id);Object.assign(cur,{num,name,updatedAt:Date.now()});await DB.put('sites',cur);addLog('Площадка',`Изменена: №${num} ${name}`)}
  else{const ns={id:uid(),num,name,updatedAt:Date.now()};state.sites.push(ns);await DB.put('sites',ns);addLog('Площадка',`Создана: №${num} ${name}`)}
  closeSheet();toast('✓ Площадка сохранена');maybeSync();refresh()};
 const del=$('#sf-del');if(del)del.onclick=async()=>{if(!confirm('Удалить площадку вместе со всеми позициями?'))return;
  const cur=state.sites.find(x=>x.id===s.id);cur.deletedAt=Date.now();cur.updatedAt=Date.now();await DB.put('sites',cur);
  addLog('Площадка',`Удалена: №${cur.num}`);closeSheet();toast('Площадка удалена');maybeSync();refresh()}}
window.closeSheet=()=>{$('#modal-root').innerHTML='';saleOpen=null};
function refresh(){route()}

/* ---------- карточка площадки ---------- */
function renderSitePage(id){const s=sitesById()[id];if(!s)return'<div class="empty">Площадка не найдена</div>';
 const its=actItems().filter(i=>i.siteId===id),pots=its.reduce((a,i)=>a+(+i.qty||0),0),sum=its.reduce((a,i)=>a+(+i.qty||0)*(+i.price||0),0);
 let rows='';
 if(!its.length)rows=`<div class="empty"><span class="big">🪴</span><b>Позиций пока нет</b>Добавьте первое растение.</div>`;
 for(const it of its){const low=+it.qty<LOWF();
  rows+=`<button class="card row-card" data-go="#/item/${it.id}">
   ${it.photo?`<img class="ph" src="${it.photo}">`:`<span class="ph">🌿</span>`}
   <span class="row-main"><h3>${esc(it.name)}${low?' <span class="low'+(it.qty==0?' red':'')+'">⚠ '+it.qty+'</span>':''}</h3>
    <span class="sub">${esc(it.variety||'')} · код <b>${esc(it.barcode)}</b></span>
    <span class="price-t">${money(it.price)}</span></span>
   <span class="row-side"><span class="pots">${it.qty}<small>горшков</small></span></span></button>`}
 return`<div class="pagehead"><button class="back" data-go="#/sites">←</button>
   <h2>№${esc(s.num)} · ${esc(s.name||'')}<span class="sub">${its.length} позиций · ${pots} горшков · ${money(sum)}</span></h2></div>
  ${rows}
  <div class="btnrow">
   <button class="btn primary big" onclick="go('#/item/new?site=${id}')">+ Добавить растение</button>
   <button class="btn ghost" onclick="siteForm(sitesById()['${id}'])">✎</button>
   <button class="btn ghost" data-go="#/labels?site=${id}">🏷</button>
  </div>`}

/* ---------- позиция растения ---------- */
function nextBarcode(){let c;do{c=String(Math.floor(10000000+Math.random()*90000000))}while(state.items.some(i=>i.barcode===c));return c}
async function migrateCodes(){let ch=0;
 for(const it of state.items){if(!/^\d{8}$/.test(it.barcode||'')){it.barcode=nextBarcode();it.updatedAt=Date.now();await DB.put('items',it);ch++}}
 if(ch){addLog('Система',`Коды заменены на 8-значные у ${ch} позиций`);
  toast(`Коды обновлены на 8-значные (${ch} поз.). Старые этикетки перепечатайте один раз.`,'warn')}}
function renderItemForm(id){
 const isNew=id.startsWith('new')||!itemsById()[id];
 const q=new URLSearchParams((location.hash.split('?')[1])||'');
 const it=isNew?{name:'',variety:'',height:'',age:'',price:'',qty:'',barcode:nextBarcode(),siteId:q.get('site')||actSites()[0]?.id||'',photo:'',batches:[]}:JSON.parse(JSON.stringify(itemsById()[id]));
 if(!actSites().length)return`<div class="pagehead"><button class="back" data-go="#/sites">←</button><h2>Новое растение</h2></div><div class="empty"><span class="big">🏞️</span><b>Сначала создайте площадку</b><br><br><button class="btn primary" onclick="siteForm()">+ Создать площадку</button></div>`;
 const opts=actSites().map(s=>`<option value="${s.id}" ${s.id===it.siteId?'selected':''}>№${esc(s.num)} — ${esc(s.name||'')}</option>`).join('');
 const bs=it.batches||[];
 return`<div class="pagehead"><button class="back" onclick="history.back()">←</button><h2>${isNew?'Новое растение':esc(it.name)}<span class="sub">код штрихкода: <b>${esc(it.barcode)}</b></span></h2></div>
 <div class="card" style="cursor:pointer" id="ph-card">
   ${it.photo?`<img class="ph lg" id="ph-img" src="${it.photo}">`:`<div class="ph lg" id="ph-ph">📷<div style="font-size:14px;color:var(--mut)">Добавить фото</div></div>`}
   <input type="file" id="f-photo" accept="image/*" class="hidden">
 </div>
 <div class="card">
  <div class="field"><label>Название *</label><input id="f-name" value="${esc(it.name)}" placeholder="Гортензия метельчатая"></div>
  <div class="grid2">
   <div class="field"><label>Сорт</label><input id="f-variety" value="${esc(it.variety||'')}" placeholder="Ванилла Фрейз"></div>
   <div class="field"><label>Площадка</label><select id="f-site">${opts}</select></div>
   <div class="field"><label>Высота</label><input id="f-height" value="${esc(it.height||'')}" placeholder="40–60 см"></div>
   <div class="field"><label>Возраст</label><input id="f-age" value="${esc(it.age||'')}" placeholder="2 года"></div>
   <div class="field"><label>Цена, ₽ *</label><input id="f-price" inputmode="decimal" value="${esc(it.price)}" placeholder="650"></div>
   <div class="field"><label>Кол-во горшков *</label><input id="f-qty" inputmode="numeric" value="${esc(it.qty)}" placeholder="30"></div>
  </div>
  <div class="field"><label>Штрихкод (Code 128) — 8 цифр, один на сорт</label>
   <div style="display:flex;gap:8px"><input id="f-bc" value="${esc(it.barcode)}" style="flex:1" inputmode="numeric"><button class="btn ghost small" id="f-bc-gen" type="button">⟳</button></div>
   <div class="bc-preview" id="bc-prev"></div></div>
 </div>
 <div class="card">
  <h3 style="margin:0 0 6px">Партии и себестоимость</h3>
  ${bs.length?bs.map((b,k)=>`<div class="batch-row"><span>Партия ${k+1} · ${new Date(b.ts).toLocaleDateString('ru-RU')} · ${b.qty} шт</span><b>${batchUnit(b)!=null?money(batchUnit(b))+'/шт':'—'}</b></div>`).join(''):''}
  <div class="formula" id="cost-box"></div>
  <div class="btnrow"><button class="btn leaf" id="f-batch" type="button">+ Добавить партию</button></div>
  <div class="muted">Партия увеличивает остаток. Себестоимость продажи = средневзвешенная по партиям.</div>
 </div>
 <div class="btnrow"><button class="btn primary big" id="f-save">${isNew?'Добавить растение':'Сохранить'}</button></div>
 <div class="btnrow">
   <button class="btn ghost" data-go="#/labels?item=${isNew?'':it.id}">🏷 Этикетка</button>
   ${isNew?'':`<button class="btn danger" id="f-del">Удалить</button>`}
 </div>`}
function costBox(it){const box=$('#cost-box');if(!box)return;const uc=unitCost(it);
 if(uc.avg){const tq=uc.batches.reduce((a,x)=>a+x.q,0);
  box.innerHTML=`<div style="font-weight:700;margin-bottom:6px">Средневзвешенная себестоимость</div>
   ${uc.batches.map((x,k)=>`<div class="st"><span>Партия ${k+1}: ${x.q} шт × ${money(x.u)}</span><b>${money(x.q*x.u)}</b></div>`).join('')}
   <div class="st"><span>Итого ÷ ${tq} шт</span><b>${money(uc.batches.reduce((a,x)=>a+x.q*x.u,0))}</b></div>
   <div class="st res"><span>Себестоимость 1 шт</span><span>${money(uc.unit)}</span></div>`;return}
 const c=it.cost||{};const parts=[['purchase','Закупка саженца'],['soil','Земля (торф)'],['fert','Удобрения'],['pot','Горшок'],['water','Полив']];
 const total=parts.reduce((s,[k])=>s+(+c[k]||0),0);const n=+c.batchQty||0;
 box.innerHTML=n?`<div class="st res"><span>Себестоимость 1 шт (старая партия)</span><span>${money(total/n)}</span></div>`
  :`<div class="muted">Себестоимость не задана. Нажмите «+ Добавить партию» и укажите компоненты — расчёт покажем по шагам.</div>`}
function batchSheet(it){
 $('#modal-root').innerHTML=`<div class="backdrop" onclick="closeSheet()"></div>
 <div class="sheet"><div class="grab"></div><h3 style="margin:0 0 10px;font-family:var(--fd)">Новая партия</h3>
  <div class="field"><label>Сколько горшков приехало *</label><input id="b-qty" inputmode="numeric" placeholder="30"></div>
  <div class="grid2">
   <div class="field"><label>Закупка саженца, ₽</label><input id="b-purchase" inputmode="decimal"></div>
   <div class="field"><label>Земля (торф), ₽</label><input id="b-soil" inputmode="decimal"></div>
   <div class="field"><label>Удобрения, ₽</label><input id="b-fert" inputmode="decimal"></div>
   <div class="field"><label>Горшок, ₽</label><input id="b-pot" inputmode="decimal"></div>
   <div class="field"><label>Полив, ₽</label><input id="b-water" inputmode="decimal"></div>
  </div>
  <div class="formula" id="b-box"></div>
  <div class="btnrow"><button class="btn ghost" onclick="closeSheet()">Отмена</button><button class="btn primary" id="b-save">Принять партию</button></div></div>`;
 const calc=()=>{const g=id=>+($('#'+id)?.value||0);
  const parts=[['b-purchase','Закупка саженца'],['b-soil','Земля (торф)'],['b-fert','Удобрения'],['b-pot','Горшок'],['b-water','Полив']];
  const total=parts.reduce((s,[id])=>s+g(id),0);const qty=g('b-qty');
  const empty=parts.filter(([id])=>!$('#'+id).value);
  $('#b-box').innerHTML=`<div style="font-weight:700;margin-bottom:6px">Расчёт по шагам</div>
   ${parts.map(([id,n])=>`<div class="st"><span>${n}${$('#'+id).value?'':' (пусто → 0)'}</span><b>${money(g(id))}</b></div>`).join('')}
   <div class="st"><span>Сумма компонентов</span><b>${money(total)}</b></div>
   <div class="st"><span>Делим на горшков в партии</span><b>÷ ${qty||'—'}</b></div>
   <div class="st res"><span>Себестоимость 1 шт</span><span>${qty>0?money(total/qty):'—'}</span></div>
   ${empty.length?`<div class="warnbox">⚠ Не заполнено: ${empty.map(([,n])=>n).join(', ')} — считаем как 0 ₽.</div>`:''}`};
 ['b-qty','b-purchase','b-soil','b-fert','b-pot','b-water'].forEach(id=>$('#'+id).addEventListener('input',calc));calc();
 $('#b-save').onclick=async()=>{const qty=Math.round(+$('#b-qty').value||0);if(qty<=0)return toast('Укажите количество горшков','warn');
  const b={id:uid(),ts:Date.now(),qty,purchase:+$('#b-purchase').value||0,soil:+$('#b-soil').value||0,fert:+$('#b-fert').value||0,pot:+$('#b-pot').value||0,water:+$('#b-water').value||0};
  const cur=itemsById()[it.id];cur.batches=cur.batches||[];cur.batches.push(b);cur.qty=(+cur.qty||0)+qty;cur.updatedAt=Date.now();
  await DB.put('items',cur);addLog('Партия',`${cur.name}: +${qty} горшков, себестоимость ${money(batchUnit(b)||0)}/шт`);
  closeSheet();toast(`✓ Партия принята: +${qty} горшков`);maybeSync();refresh()}}
function bindItemForm(id){
 const isNew=id.startsWith('new')||!itemsById()[id];
 bindItemForm._photo=isNew?'':(itemsById()[id]?.photo||'');
 $('#ph-card').onclick=()=>$('#f-photo').click();
 $('#f-photo').onchange=async e=>{const f=e.target.files[0];if(!f)return;const data=await fileCompress(f);bindItemForm._photo=data;
  const el=$('#ph-img');if(el)el.src=data;else $('#ph-ph').outerHTML=`<img class="ph lg" id="ph-img" src="${data}">`};
 const updBc=()=>{$('#bc-prev').innerHTML=/^\d{8}$/.test($('#f-bc').value.trim())?svgBarcode($('#f-bc').value.trim())+'<div><code>'+esc($('#f-bc').value.trim())+'</code></div>':'<div class="muted">Код должен состоять из 8 цифр</div>'};
 $('#f-bc').addEventListener('input',updBc);$('#f-bc-gen').onclick=()=>{$('#f-bc').value=nextBarcode();updBc()};
 $('#f-batch').onclick=()=>batchSheet(itemsById()[id]||{id:null});
 if(isNew)$('#f-batch').style.display='none';
 costBox(isNew?{batches:[]}:itemsById()[id]);updBc();
 $('#f-save').onclick=async()=>{
  const name=$('#f-name').value.trim(),price=+$('#f-price').value,qty=Math.round(+$('#f-qty').value||0);
  const bc=$('#f-bc').value.trim();
  if(!name)return toast('Укажите название','warn');
  if(!(price>=0))return toast('Укажите цену','warn');
  if(qty<0)return toast('Количество не может быть отрицательным','warn');
  if(!/^\d{8}$/.test(bc))return toast('Код должен быть из 8 цифр, например 51324567','warn');
  if(state.items.some(i=>i.barcode===bc&&i.id!==id))return toast('Такой код уже есть у другой позиции','warn');
  const data={name,variety:$('#f-variety').value.trim(),height:$('#f-height').value.trim(),age:$('#f-age').value.trim(),
   price,qty,siteId:$('#f-site').value,barcode:bc,photo:bindItemForm._photo||'',updatedAt:Date.now()};
  if(isNew){const it={id:uid(),batches:[],...data};state.items.push(it);await DB.put('items',it);addLog('Позиция',`Добавлена: ${name} — ${qty} горшков, код ${it.barcode}`);toast('✓ Растение добавлено. Добавьте партию для себестоимости.');go('#/item/'+it.id)}
  else{const old=itemsById()[id],it={id,...old,...data};const idx=state.items.findIndex(x=>x.id===id);state.items[idx]=it;await DB.put('items',it);
   addLog('Позиция',`Изменена: ${name}`+(old.qty!==qty?` (остаток ${old.qty} → ${qty})`:'')+(old.barcode!==it.barcode?` (код ${old.barcode} → ${it.barcode})`:''));toast('✓ Сохранено');maybeSync();go('#/site/'+it.siteId)}};
 const del=$('#f-del');if(del)del.onclick=async()=>{if(!confirm('Удалить позицию? История продаж сохранится.'))return;
  const it=itemsById()[id];it.deletedAt=Date.now();it.updatedAt=Date.now();await DB.put('items',it);
  addLog('Позиция',`Удалена: ${it.name}`);toast('Удалено');maybeSync();go('#/site/'+it.siteId)}}

/* ---------- этикетки ---------- */
let labelSel={};
function renderLabels(){
 const q=new URLSearchParams(location.hash.split('?')[1]||'');
 const presetSite=q.get('site')||'',presetItem=q.get('item')||'';
 if(presetItem&&!labelSel[presetItem])labelSel[presetItem]=1;
 const sopts=`<option value="">Все площадки</option>`+actSites().map(s=>`<option value="${s.id}" ${s.id===presetSite?'selected':''}>№${esc(s.num)} — ${esc(s.name||'')}</option>`).join('');
 return`<div class="pagehead"><h2>Этикетки</h2></div>
 <div class="card"><div class="field" style="margin:0"><label>Площадка</label><select id="lbl-site">${sopts}</select></div></div>
 <div class="card" id="lbl-list"></div>
 <div class="btnrow" style="margin-top:0"><button class="btn small ghost" id="lbl-all">Отметить все</button><button class="btn small ghost" id="lbl-none">Снять</button><button class="btn small ghost" id="lbl-eq">Копии = остатку</button></div>
 <div class="lbl-preview" id="lbl-prev"><span class="muted">Выберите позиции — здесь появится предпросмотр</span></div>
 <div class="btnrow"><button class="btn primary big" id="lbl-a4">📄 PDF на A4 (43×25, сетка)</button></div>
 <div class="btnrow"><button class="btn ghost" id="lbl-thermo">🧾 Термо 46×20 (лента)</button><button class="btn ghost" id="lbl-print">🖨 Печать</button></div>
 <div class="note">A4: 4×11 = 44 этикетки 43×25 мм на лист, масштаб печати 100%. Термо: PDF-лента 46×20 мм (страница = этикетка) для Honeywell с компьютера. Код сорта напечатан цифрами на этикетке.</div>`}
function lblList(){const sid=$('#lbl-site')?.value;const its=actItems().filter(i=>!sid||i.siteId===sid);
 const box=$('#lbl-list');if(!box)return;
 if(!its.length){box.innerHTML='<div class="muted" style="padding:6px">Нет позиций — добавьте растения.</div>';return}
 box.innerHTML=its.map(it=>{const st=siteOf(it);return`<div class="lbl-item">
  <input type="checkbox" data-lid="${it.id}" ${labelSel[it.id]?'checked':''}>
  <span class="nm">${esc(it.name)} <b style="color:var(--pine)">${esc(it.barcode)}</b><small>площ. ${esc(st.num)} · ${money(it.price)} · остаток ${it.qty}</small></span>
  <input type="number" min="0" data-cid="${it.id}" value="${labelSel[it.id]||0}" inputmode="numeric"></div>`}).join('');
 box.querySelectorAll('[data-lid]').forEach(c=>c.onchange=()=>{if(c.checked)labelSel[c.dataset.lid]=labelSel[c.dataset.lid]||1;else delete labelSel[c.dataset.lid];lblSync();lblPrev()});
 box.querySelectorAll('[data-cid]').forEach(n=>n.oninput=()=>{const v=Math.max(0,Math.round(+n.value||0));if(v>0)labelSel[n.dataset.cid]=v;else delete labelSel[n.dataset.cid];lblSync();lblPrev()});
 lblPrev()}
function lblSync(){$$('#lbl-list [data-cid]').forEach(n=>{if(labelSel[n.dataset.cid]!==undefined)n.value=labelSel[n.dataset.cid]})}
function lblJobs(){const jobs=[];for(const it of actItems()){const n=labelSel[it.id];if(n>0)for(let k=0;k<n;k++)jobs.push(it)}return jobs}
function lblPrev(){const j=lblJobs()[0];const p=$('#lbl-prev');if(!p)return;
 if(!j){p.innerHTML='<span class="muted">Выберите позиции — здесь появится предпросмотр</span>';return}
 p.innerHTML=`<img src="${renderLabelCanvas(j,false).toDataURL()}">`}
function bindLabels(){
 $('#lbl-site').onchange=()=>{labelSel={};lblList()};
 $('#lbl-all').onclick=()=>{const sid=$('#lbl-site').value;actItems().forEach(i=>{if(!sid||i.siteId===sid)labelSel[i.id]=labelSel[i.id]||1});lblList()};
 $('#lbl-none').onclick=()=>{labelSel={};lblList()};
 $('#lbl-eq').onclick=()=>{const sid=$('#lbl-site').value;actItems().forEach(i=>{if(!sid||i.siteId===sid)labelSel[i.id]=+i.qty||0});lblList();toast('Копии = остатку: у каждого горшка этикетка с кодом сорта')};
 $('#lbl-a4').onclick=()=>makeLabelsPdf('a4');
 $('#lbl-thermo').onclick=()=>makeLabelsPdf('thermo');
 $('#lbl-print').onclick=()=>printLabelsHtml();
 lblList()}
function makeLabelsPdf(mode){const jobs=lblJobs();if(!jobs.length)return toast('Выберите позиции','warn');
 if(!window.jspdf){toast('PDF-библиотека не загрузилась. Использую «Печать».','warn');return printLabelsHtml()}
 const{jsPDF}=window.jspdf;let doc;
 if(mode==='thermo')doc=new jsPDF({unit:'mm',format:[46,20]});else doc=new jsPDF({unit:'mm',format:'a4'});
 jobs.forEach((it,i)=>{const img=renderLabelCanvas(it,mode==='thermo').toDataURL('image/png');
  if(mode==='thermo'){if(i>0)doc.addPage([46,20]);doc.addImage(img,'PNG',0,0,46,20)}
  else{if(i>0&&i%44===0)doc.addPage();const idx=i%44;doc.addImage(img,'PNG',8+(idx%4)*43,8+Math.floor(idx/4)*25,43,25)}});
 doc.save(mode==='thermo'?'etiketki-termo-46x20.pdf':'etiketki-A4-43x25.pdf');
 addLog('Этикетки',`PDF (${mode==='thermo'?'46×20':'A4 43×25'}): ${jobs.length} шт`);toast(`✓ PDF готов: ${jobs.length} этикеток`)}
function printLabelsHtml(){const jobs=lblJobs();if(!jobs.length)return toast('Выберите позиции','warn');
 const w=window.open('','_blank');if(!w)return toast('Разрешите всплывающие окна','err');
 w.document.write(`<!doctype html><meta charset="utf-8"><title>Этикетки 43×25</title><style>
  @page{size:A4;margin:8mm}body{margin:0;font-family:system-ui}.g{display:flex;flex-wrap:wrap}
  img{width:43mm;height:25mm;display:block}@media print{button{display:none}}</style>
  <button onclick="print()" style="margin:8px;padding:10px 18px;font-size:16px">🖨 Печать / Сохранить как PDF</button>
  <div class="g">${jobs.map(it=>`<img src="${renderLabelCanvas(it,false).toDataURL()}">`).join('')}</div>`);w.document.close()}

/* ---------- сканер ---------- */
function renderScan(){return`<div class="pagehead"><h2>Сканер продажи</h2></div>
 <div class="scanbox" id="scanbox">
   <video id="scan-video" playsinline muted></video>
   <div class="frame"><i></i><i></i><i></i><i></i></div><div class="laser"></div>
 </div>
 <div class="scan-hint">Наведите камеру на штрихкод (8 цифр под полосками). Повторное сканирование того же кода = +1 шт. Работает без интернета.</div>
 <div class="btnrow" style="margin-top:0"><button class="btn primary big" id="scan-start">▶ Включить камеру</button></div>
 <div class="card" style="margin-top:12px"><label style="font-size:13px;font-weight:700;color:#41523c">Если камера не читает — выберите сорт или введите код</label>
  <div class="manual-row"><input id="man-code" placeholder="Код, напр. 51324567" autocomplete="off" inputmode="numeric">
   <button class="btn leaf" id="man-go">Найти</button><button class="btn ghost" id="man-list">Список</button></div></div>`}
let scanBusy=0;
function bindScan(){
 $('#scan-start').onclick=startScan;
 $('#man-go').onclick=()=>{const v=$('#man-code').value.trim();if(!v)return;
  const it=actItems().find(i=>(i.barcode||'')===v)||actItems().find(i=>(i.name||'').toLowerCase().includes(v.toLowerCase()));
  if(it){openSale(it);$('#man-code').value=''}else toast('Код «'+esc(v)+'» не найден','err')};
 $('#man-code').addEventListener('keydown',e=>{if(e.key==='Enter')$('#man-go').click()});
 $('#man-list').onclick=openPicker}
window.openPicker=function(){const row=it=>{const st=siteOf(it);
  return`<button class="card row-card" data-pick="${it.id}" style="padding:10px 12px">
   ${it.photo?`<img class="ph" style="width:42px;height:42px" src="${it.photo}">`:'<span class="sale-ico">🌿</span>'}
   <span class="row-main"><b>${esc(it.name)}</b><div class="sub">${esc(it.variety||'')} · код <b>${esc(it.barcode)}</b></div></span>
   <span class="row-side"><span class="pots">${it.qty}<small>шт</small></span></span></button>`};
 const bind=()=>{$$('#pk-list [data-pick]').forEach(b=>b.onclick=()=>openSale(itemsById()[b.dataset.pick]))};
 $('#modal-root').innerHTML=`<div class="backdrop" onclick="closeSheet()"></div>
 <div class="sheet"><div class="grab"></div><h3 style="margin:0 0 10px;font-family:var(--fd)">Выберите сорт</h3>
  <div class="field"><input id="pk-q" placeholder="Поиск: название, сорт или код"></div>
  <div class="picker-list" id="pk-list">${actItems().map(row).join('')}</div></div>`;
 bind();
 $('#pk-q').oninput=()=>{const q=$('#pk-q').value.toLowerCase();
  $('#pk-list').innerHTML=actItems().filter(it=>(it.name+' '+(it.variety||'')+' '+it.barcode).toLowerCase().includes(q)).map(row).join('')||'<div class="muted">Ничего не найдено</div>';
  bind()}}
async function startScan(){
 const btn=$('#scan-start');if(!btn)return;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
  scanCtx={stream};const video=$('#scan-video');video.srcObject=stream;await video.play();
  btn.textContent='⏹ Остановить камеру';btn.onclick=()=>{stopScan();route()};
  if('BarcodeDetector'in window){
   const fmts=await BarcodeDetector.getSupportedFormats().catch(()=>[]);
   if(fmts.includes('code_128')){scanCtx.det=new BarcodeDetector({formats:['code_128']});
    scanCtx.timer=setInterval(async()=>{if(scanBusy)return;try{const c=await scanCtx.det.detect(video);if(c.length)onScan(c[0].rawValue)}catch(e){}},180);return}}
  scanCtx.timer=setInterval(()=>{if(scanBusy)return;const code=grabDecode(video);if(code)onScan(code)},160);
 }catch(err){console.warn(err);toast('Не удалось открыть камеру. Выберите сорт из «Списка» или введите код.','err')}}
function onScan(txt){const code=String(txt||'').trim();if(!code)return;const now=Date.now();
 if(now-scanBusy<1200)return;scanBusy=now;beep();vib(70);
 const it=actItems().find(i=>(i.barcode||'')===code);
 if(!it)return toast('Код «'+esc(code)+'» не найден в базе','err');
 if(saleOpen&&saleOpen.item.id===it.id){saleOpen.qty=Math.min(saleOpen.qty+1,999);updSaleSheet();toast('+1 → '+saleOpen.qty+' шт')}
 else openSale(it)}
function stopScan(){if(scanCtx){clearInterval(scanCtx.timer);scanCtx.stream?.getTracks().forEach(t=>t.stop());scanCtx=null}scanBusy=0}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&scanCtx)stopScan()});

/* ---------- продажа со скидкой ---------- */
function openSale(it){saleOpen={item:it,qty:1,disc:0,_uc:unitCost(it)};
 $('#modal-root').innerHTML=`<div class="backdrop" onclick="closeSheet()"></div><div class="sheet" id="sale-sheet"></div>`;
 updSaleSheet()}
function updSaleSheet(){const{item:it,qty,disc}=saleOpen,st=siteOf(it),uc=saleOpen._uc||unitCost(it);
 const base=qty*(+it.price||0);const total=Math.round(base*(1-disc/100));
 const costTotal=uc.unit!=null?qty*uc.unit:0;const profit=uc.unit!=null?total-costTotal:null;
 $('#sale-sheet').innerHTML=`<div class="grab"></div>
  <div class="sale-head">${it.photo?`<img class="ph" src="${it.photo}">`:'<span class="ph">🌿</span>'}
   <div style="flex:1;min-width:0"><h3 style="margin:0">${esc(it.name)}</h3>
    <span class="sub">${esc(it.variety||'')} · Площадка №${esc(st.num)}</span><br>
    <span class="chip-s">код ${esc(it.barcode)}</span><span class="chip-s">${money(it.price)} / шт</span><span class="chip-s">остаток: ${it.qty}</span></div></div>
  <div class="stepper"><button id="s-minus">−</button><input id="s-qty" inputmode="numeric" value="${qty}"><button id="s-plus">+</button>
   <span class="muted" style="flex:1;text-align:right">или сканируйте ещё раз</span></div>
  <div class="disc-row"><span class="muted">Скидка:</span>
   <div class="chips">${[0,5,10,15].map(d=>`<button data-d="${d}" class="${disc===d?'on':''}">${d}%</button>`).join('')}</div>
   <input id="s-disc" inputmode="numeric" value="${disc}"><span class="muted">%</span></div>
  <div class="sale-sum"><span>Итого${disc?` (скидка −${money(base-total)})`:''}</span><b>${money(total)}</b></div>
  <div class="muted" style="margin:4px 0 10px">Себестоимость: ${uc.unit!=null?money(uc.unit)+' / шт'+(uc.avg?' (средняя по партиям)':''):'не задана'} · Прибыль: ${profit!=null?money(profit):'—'}</div>
  ${qty>+it.qty?'<div class="warnbox">⚠ На площадке только '+it.qty+' горшков. Остаток станет отрицательным.</div>':''}
  <div class="btnrow"><button class="btn ghost" onclick="closeSheet()">Отмена</button>
   <button class="btn primary" id="s-ok" style="flex:2">✓ Продать ${qty} шт · ${money(total)}</button></div>`;
 $('#s-minus').onclick=()=>{saleOpen.qty=Math.max(1,saleOpen.qty-1);updSaleSheet()};
 $('#s-plus').onclick=()=>{saleOpen.qty=Math.min(saleOpen.qty+1,999);updSaleSheet()};
 $('#s-qty').oninput=e=>{saleOpen.qty=Math.max(1,Math.round(+e.target.value||1))};
 $('#s-disc').oninput=e=>{saleOpen.disc=Math.max(0,Math.min(99,Math.round(+e.target.value||0)))};
 $$('#sale-sheet [data-d]').forEach(b=>b.onclick=()=>{saleOpen.disc=+b.dataset.d;updSaleSheet()});
 $('#s-ok').onclick=confirmSale}
async function confirmSale(){const it=itemsById()[saleOpen.item.id];if(!it)return closeSheet();
 const qty=saleOpen.qty,price=+it.price||0,disc=saleOpen.disc||0,uc=unitCost(it);
 const base=qty*price;const sum=Math.round(base*(1-disc/100));
 const costUnit=uc.unit||0;const costTotal=costUnit*qty;
 const sale={id:uid(),ts:Date.now(),updatedAt:Date.now(),itemId:it.id,itemName:it.name,variety:it.variety||'',siteNum:siteOf(it).num,
  qty,price,discountPct:disc,sum,costUnit,costTotal,profit:sum-costTotal,device:settings.device};
 it.qty=(+it.qty||0)-qty;it.updatedAt=Date.now();
 await DB.put('items',it);await DB.put('sales',sale);state.sales.unshift(sale);
 addLog('Продажа',`${it.name} × ${qty} шт на ${money(sum)}${disc?` (скидка ${disc}%)`:''} · ${settings.device}`);
 beep();vib([60,40,60]);closeSheet();toast(`✓ Продано: ${esc(it.name)} × ${qty} = <b>${money(sum)}</b>`);
 if(+it.qty<LOWF()&&+it.qty>=0)toast(`⚠ Мало осталось: ${esc(it.name)} — ${it.qty} шт`,'warn');
 maybeSync();
 if(location.hash.startsWith('#/site')||location.hash.startsWith('#/sites'))refresh()}

/* ---------- история ---------- */
let histTab='sales',histPeriod='all';
function renderHistory(){return`<div class="pagehead"><h2>История</h2></div>
 <div class="seg"><button id="ht-s" class="${histTab==='sales'?'on':''}">Продажи</button><button id="ht-o" class="${histTab==='log'?'on':''}">Операции</button></div>
 <div class="chips" id="h-chips">${['day','week','month','all'].map(p=>`<button data-p="${p}" class="${histPeriod===p?'on':''}">${{day:'Сегодня',week:'7 дней',month:'Месяц',all:'Всё время'}[p]}</button>`).join('')}</div>
 <div id="h-body"></div>`}
function periodRange(p){const n=new Date(),d0=new Date(n.getFullYear(),n.getMonth(),n.getDate());
 if(p==='day')return[+d0,Date.now()];if(p==='week')return[+d0-6*864e5,Date.now()];
 if(p==='month')return[+new Date(n.getFullYear(),n.getMonth(),1),Date.now()];
 if(p==='season'){const y=n.getMonth()>=3?n.getFullYear():n.getFullYear()-1;return[+new Date(y,3,1),Math.min(+new Date(y,9,1)-1,Date.now())]}
 return[0,Date.now()]}
function bindHistory(){$('#ht-s').onclick=()=>{histTab='sales';hBody()};$('#ht-o').onclick=()=>{histTab='log';hBody()};
 $$('#h-chips button').forEach(b=>b.onclick=()=>{histPeriod=b.dataset.p;$$('#h-chips button').forEach(x=>x.classList.toggle('on',x===b));hBody()});hBody()}
function hBody(){const box=$('#h-body'),[f,t]=periodRange(histPeriod);
 if(histTab==='log'){const rows=state.log.filter(e=>e.ts>=f&&e.ts<=t&&!e.deletedAt).slice(0,300);
  box.innerHTML=rows.length?rows.map(e=>`<div class="card" style="padding:10px 12px"><div style="display:flex;justify-content:space-between;gap:8px">
   <b style="font-size:14px">${esc(e.text)}</b><span class="sub" style="white-space:nowrap">${dtFull(e.ts)}</span></div>
   <span class="sub">${esc(e.type)} · ${esc(e.device)}</span></div>`).join(''):'<div class="empty">Операций за период нет</div>';return}
 const ss=state.sales.filter(s=>s.ts>=f&&s.ts<=t);
 if(!ss.length){box.innerHTML='<div class="empty"><span class="big">🧾</span><b>Продаж за период нет</b>Отсканируйте первую этикетку.</div>';return}
 const sum=ss.reduce((a,s)=>a+s.sum,0),prof=ss.reduce((a,s)=>a+(s.profit||0),0);
 let html=`<div class="stat-strip"><div class="stat"><b>${money(sum)}</b><span>выручка</span></div>
  <div class="stat"><b>${money(prof)}</b><span>прибыль</span></div><div class="stat"><b>${ss.reduce((a,s)=>a+s.qty,0)}</b><span>штук</span></div></div>`;
 const groups={};ss.forEach(s=>{const k=new Date(s.ts).toDateString();(groups[k]=groups[k]||[]).push(s)});
 for(const k in groups){const daySum=groups[k].reduce((a,s)=>a+s.sum,0);
  html+=`<div class="day-h"><span>${dtDay(groups[k][0].ts)}</span><span>${money(daySum)}</span></div>`+
  groups[k].map(s=>`<div class="card sale-row" style="padding:10px 12px">
   <span class="sale-ico">🌿</span><span class="row-main"><b style="font-size:15px">${esc(s.itemName)}</b>
   <div class="sub">${s.qty} шт × ${money(s.price)}${s.discountPct?` · скидка ${s.discountPct}%`:''} · №${esc(s.siteNum)} · ${esc(s.device)}</div></span>
   <span class="row-side"><b>${money(s.sum)}</b>${s.profit!=null?`<div class="sub" style="color:${s.profit>=0?'var(--ok)':'var(--danger)'}">прибыль ${money(s.profit)}</div>`:''}</span></div>`).join('')}
 box.innerHTML=html}

/* ---------- отчёты ---------- */
let repPeriod='month';
function renderReports(){return`<div class="pagehead"><h2>Отчёты</h2></div>
 <div class="chips" id="r-chips">${['day','month','season','all'].map(p=>`<button data-p="${p}" class="${repPeriod===p?'on':''}">${{day:'Сегодня',month:'Месяц',season:'Сезон (апр–сен)',all:'Всё время'}[p]}</button>`).join('')}</div>
 <div id="r-body"></div>`}
function bindReports(){$$('#r-chips button').forEach(b=>b.onclick=()=>{repPeriod=b.dataset.p;$$('#r-chips button').forEach(x=>x.classList.toggle('on',x===b));rBody()});rBody()}
function reportData(p){const[f,t]=periodRange(p);const ss=state.sales.filter(s=>s.ts>=f&&s.ts<=t);
 return{ss,sum:ss.reduce((a,s)=>a+s.sum,0),cost:ss.reduce((a,s)=>a+(s.costTotal||0),0),profit:ss.reduce((a,s)=>a+(s.profit||0),0),qty:ss.reduce((a,s)=>a+s.qty,0),
  low:actItems().filter(i=>+i.qty<LOWF()).sort((a,b)=>a.qty-b.qty)}}
function rBody(){const d=reportData(repPeriod);
 const stock=actSites().map(s=>{const its=actItems().filter(i=>i.siteId===s.id);return{s,n:its.length,pots:its.reduce((a,i)=>a+(+i.qty||0),0),val:its.reduce((a,i)=>a+(+i.qty||0)*(+i.price||0),0)}});
 $('#r-body').innerHTML=`
 <div class="kpis">
  <div class="kpi"><span>Выручка</span><b>${money(d.sum)}</b></div>
  <div class="kpi"><span>Себестоимость</span><b>${money(d.cost)}</b></div>
  <div class="kpi ${d.profit>=0?'green':'red'}"><span>Прибыль</span><b>${money(d.profit)}</b></div>
  <div class="kpi gold"><span>Продано штук</span><b>${d.qty}</b></div>
 </div>
 <div class="btnrow" style="margin-top:0"><button class="btn primary big" id="r-pdf">📄 Отчёт в PDF</button></div>
 <h3 style="margin:18px 2px 8px;font-family:var(--fd);font-size:16px">Остатки по площадкам</h3>
 <div class="card" style="padding:6px 12px"><table class="tbl"><tr><th>Площадка</th><th class="num">Позиций</th><th class="num">Горшков</th><th class="num">По ценам</th></tr>
  ${stock.map(r=>`<tr><td>№${esc(r.s.num)} ${esc(r.s.name||'')}</td><td class="num">${r.n}</td><td class="num"><b>${r.pots}</b></td><td class="num">${money(r.val)}</td></tr>`).join('')||'<tr><td colspan=4 class="muted">Нет площадок</td></tr>'}
 </table></div>
 <h3 style="margin:18px 2px 8px;font-family:var(--fd);font-size:16px">⚠ Заканчиваются (меньше ${LOWF()})</h3>
 ${d.low.length?d.low.map(i=>{const st=siteOf(i);return`<div class="card sale-row" style="padding:10px 12px">
   ${i.photo?`<img class="ph" style="width:42px;height:42px" src="${i.photo}">`:'<span class="sale-ico">🌿</span>'}
   <span class="row-main"><b>${esc(i.name)}</b><div class="sub">${esc(i.variety||'')} · площ. ${esc(st.num)} · код ${esc(i.barcode)}</div></span>
   <span class="low ${i.qty==0?'red':''}">${i.qty} шт</span></div>`}).join(''):'<div class="note">Всё в порядке — запасов достаточно 🌿</div>'}`;
 $('#r-pdf').onclick=()=>printReport(repPeriod)}
function printReport(p){const d=reportData(p);
 const labels={day:'за сегодня',month:'за месяц',season:'за сезон (апр–сен)',all:'за всё время'};
 const byDay={};d.ss.forEach(s=>{const k=new Date(s.ts).toLocaleDateString('ru-RU');(byDay[k]=byDay[k]||{n:0,sum:0,prof:0});byDay[k].n+=s.qty;byDay[k].sum+=s.sum;byDay[k].prof+=s.profit||0});
 const w=window.open('','_blank');if(!w)return toast('Разрешите всплывающие окна','err');
 w.document.write(`<!doctype html><meta charset="utf-8"><title>Отчёт — Гектары Счастья</title><style>
  @page{size:A4;margin:14mm}body{font:14px/1.5 system-ui,Arial;color:#111}h1{font-size:20px}h2{font-size:15px;margin:18px 0 6px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}td,th{border:1px solid #bbb;padding:5px 7px;text-align:left}
  th{background:#eef3e8}.num{text-align:right}.k{display:inline-block;border:1px solid #bbb;border-radius:8px;padding:8px 14px;margin:4px 8px 4px 0}
  .k b{display:block;font-size:17px}@media print{button{display:none}}</style>
  <button onclick="print()" style="padding:10px 20px;font-size:15px;margin-bottom:10px">🖨 Печать / Сохранить как PDF</button>
  <h1>Гектары Счастья · отчёт ${esc(settings.code||'')}</h1>
  <div>Продажи ${labels[p]} · сформирован ${new Date().toLocaleString('ru-RU')} · устройство: ${esc(settings.device)}</div>
  <div style="margin-top:10px">
   <span class="k">Выручка<b>${money(d.sum)}</b></span><span class="k">Себестоимость<b>${money(d.cost)}</b></span>
   <span class="k">Прибыль<b>${money(d.profit)}</b></span><span class="k">Продано, шт<b>${d.qty}</b></span></div>
  <h2>Продажи по дням</h2><table><tr><th>Дата</th><th class="num">Штук</th><th class="num">Выручка</th><th class="num">Прибыль</th></tr>
  ${Object.entries(byDay).map(([k,v])=>`<tr><td>${k}</td><td class="num">${v.n}</td><td class="num">${money(v.sum)}</td><td class="num">${money(v.prof)}</td></tr>`).join('')||'<tr><td colspan=4>Продаж нет</td></tr>'}</table>
  <h2>Остатки по площадкам</h2><table><tr><th>Площадка</th><th class="num">Позиций</th><th class="num">Горшков</th></tr>
  ${actSites().map(s=>{const its=actItems().filter(i=>i.siteId===s.id);return`<tr><td>№${esc(s.num)} ${esc(s.name||'')}</td><td class="num">${its.length}</td><td class="num">${its.reduce((a,i)=>a+(+i.qty||0),0)}</td></tr>`}).join('')}</table>
  <h2>Заканчиваются (меньше ${LOWF()} шт)</h2><table><tr><th>Позиция</th><th>Площадка</th><th class="num">Остаток</th></tr>
  ${d.low.map(i=>`<tr><td>${esc(i.name)} ${esc(i.variety||'')} (код ${esc(i.barcode)})</td><td>№${esc(siteOf(i).num)}</td><td class="num"><b>${i.qty}</b></td></tr>`).join('')||'<tr><td colspan=3>Таких позиций нет</td></tr>'}</table>`);
 w.document.close();addLog('Отчёт','Сформирован печатный отчёт '+labels[p])}

/* ---------- СИНХРОНИЗАЦИЯ (Supabase) ---------- */
let syncTimer=null;
function maybeSync(){if(!settings.sbUrl||!settings.sbKey||!navigator.onLine)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(false),4000)}
async function syncNow(manual){
 if(!settings.sbUrl||!settings.sbKey){if(manual)toast('Синхронизация не настроена: вставьте Supabase URL и ключ в настройках','warn');return}
 if(!navigator.onLine){if(manual)toast('Сейчас нет сети — попробуем позже','warn');return}
 const base=settings.sbUrl.replace(/\/$/,'');
 const H={apikey:settings.sbKey,Authorization:'Bearer '+settings.sbKey,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'};
 try{
  const r=await fetch(base+'/rest/v1/docs?select=kind,id,doc,updated_at&limit=10000',{headers:H});
  if(!r.ok)throw new Error('HTTP '+r.status+(r.status===401||r.status===403?' — проверьте ключ':''));
  const rows=await r.json();const rem={};rows.forEach(x=>rem[x.kind+'|'+x.id]=x);
  let adopted=0;
  for(const x of rows){const arr=state[x.kind];if(!arr||!x.doc)continue;const i=arr.findIndex(o=>o.id===x.id);
   if(i<0){arr.push(x.doc);await DB.put(x.kind,x.doc);adopted++}
   else if((arr[i].updatedAt||0)<(x.doc.updatedAt||0)){arr[i]=x.doc;await DB.put(x.kind,x.doc);adopted++}}
  const push=[];
  for(const kind of['sites','items','sales','log'])for(const o of state[kind]){
   const x=rem[kind+'|'+o.id];
   if(!x||(x.doc.updatedAt||0)<(o.updatedAt||0))push({kind,id:o.id,doc:o,updated_at:o.updatedAt||0})}
  if(push.length){const p=await fetch(base+'/rest/v1/docs',{method:'POST',headers:H,body:JSON.stringify(push)});if(!p.ok)throw new Error('отправка HTTP '+p.status)}
  localStorage.setItem('pn-lastsync',String(Date.now()));reSort();updSyncUi();
  if(adopted&&!location.hash.includes('scan'))refresh();
  if(manual)toast(`✓ Синхронизировано: получено ${adopted}, отправлено ${push.length}`);
 }catch(e){console.warn(e);if(manual)toast('Ошибка синхронизации: '+e.message,'err')}}
function updSyncUi(){const el=$('#sync-line');if(!el)return;
 const ls=+localStorage.getItem('pn-lastsync')||0;
 el.textContent=settings.sbUrl?(navigator.onLine?'Синхронизация включена. ':'Нет сети. ')+(ls?'Последняя: '+dtFull(ls):'Ещё не синхронизировались'):'Не настроена: укажите Supabase URL и ключ ниже'}
window.addEventListener('online',()=>{updHeader();syncNow(false)});
setInterval(()=>syncNow(false),60000);

/* ---------- настройки ---------- */
function renderSettings(){const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 return`<div class="pagehead"><h2>Настройки</h2></div>
 <div class="card">
  <div class="field"><label>Код питомника</label><input id="set-code" value="${esc(settings.code)}" placeholder="ГЕКТАРЫ СЧАСТЬЯ"></div>
  <div class="field"><label>Имя устройства</label><input id="set-device" value="${esc(settings.device)}"></div>
 </div>
 <div class="card"><h3 style="margin:0 0 8px">Синхронизация между устройствами</h3>
  <div class="sync-line" id="sync-line"></div>
  <div class="field"><label>Supabase URL</label><input id="set-sburl" value="${esc(settings.sbUrl)}" placeholder="https://xxxx.supabase.co"></div>
  <div class="field"><label>Supabase anon key</label><input id="set-sbkey" value="${esc(settings.sbKey)}"></div>
  <div class="btnrow" style="margin-top:6px"><button class="btn primary" id="set-sync">🔄 Синхронизировать</button></div>
  <details class="note"><summary>Как подключить (5 минут, бесплатно)</summary>
   <ol style="margin:8px 0;padding-left:18px">
    <li>supabase.com → Sign up → New project.</li>
    <li>SQL Editor → вставьте код ниже → Run.</li>
    <li>Settings → API → скопируйте Project URL и anon public key в поля выше.</li>
    <li>Нажмите «Синхронизировать». То же — на втором телефоне.</li>
   </ol>
   <pre>create table if not exists docs (
  kind text not null, id text not null,
  doc jsonb not null,
  updated_at bigint not null default 0,
  primary key (kind, id));
alter table docs enable row level security;
create policy docs_select on docs for select using (true);
create policy docs_insert on docs for insert with check (true);
create policy docs_update on docs for update using (true) with check (true);
create policy docs_delete on docs for delete using (true);</pre>
  </details>
 </div>
 <div class="card">
  <div class="btnrow" style="margin-top:0"><button class="btn ghost" id="set-export">⬇ Экспорт (JSON)</button><button class="btn ghost" id="set-import">⬆ Импорт</button></div>
  <input type="file" id="imp-file" accept="application/json" class="hidden">
  <div class="btnrow"><button class="btn leaf" id="set-demo">🌱 Демо-данные</button><button class="btn danger" id="set-reset">Сбросить всё</button></div>
  <div class="btnrow"><button class="btn primary" id="set-install" style="display:none">📲 Установить приложение</button></div>
  ${ios?'<div class="note">iPhone: «Поделиться» → «На экран Домой» — ярлык с гномиком на рабочем столе.</div>':''}
 </div>
 <div class="muted" style="text-align:center;margin:18px 0">Гектары Счастья · v3 · офлайн-PWA</div>`}
function bindSettings(){updSyncUi();
 const sv=()=>{settings.code=$('#set-code').value.trim();settings.device=$('#set-device').value.trim()||'Устройство';
  settings.sbUrl=$('#set-sburl').value.trim();settings.sbKey=$('#set-sbkey').value.trim();saveSettings();updHeader();updSyncUi()};
 ['set-code','set-device','set-sburl','set-sbkey'].forEach(id=>$('#'+id).addEventListener('change',sv));
 $('#set-sync').onclick=()=>syncNow(true);
 $('#set-export').onclick=()=>{const data={settings,sites:state.sites,items:state.items,sales:state.sales,log:state.log,exportedAt:new Date().toISOString()};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'}));
  a.download='gektary-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click()};
 $('#set-import').onclick=()=>$('#imp-file').click();
 $('#imp-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  try{const d=JSON.parse(await f.text());
   if(!confirm('Импорт заменит текущие данные данными из файла. Продолжить?'))return;
   state.sites=d.sites||[];state.items=d.items||[];state.sales=d.sales||[];state.log=d.log||[];
   await DB.bulk('sites',state.sites);await DB.bulk('items',state.items);await DB.bulk('sales',state.sales);await DB.bulk('log',state.log);
   if(d.settings)settings={...settings,...d.settings};saveSettings();addLog('Импорт','Данные загружены из JSON');toast('✓ Импорт завершён');updHeader();maybeSync();go('#/sites');refresh()}
  catch(err){toast('Файл не распознан','err')}};
 $('#set-demo').onclick=async()=>{if(actItems().length&&!confirm('Демо добавит примеры к текущим данным. Продолжить?'))return;await seedDemo();toast('✓ Демо-данные загружены');refresh();go('#/sites')};
 $('#set-reset').onclick=async()=>{if(!confirm('Удалить ВСЕ данные безвозвратно?'))return;
  for(const s of['sites','items','sales','log']){const all=await DB.all(s);for(const r of all){r.deletedAt=Date.now();r.updatedAt=Date.now();await DB.put(s,r)}}
  state={sites:[],items:[],sales:[],log:[]};addLog('Система','Сброс данных');refresh();go('#/sites')};
 if(deferredPrompt)$('#set-install').style.display=''}

/* ---------- демо ---------- */
function demoPhoto(a,b,e){const c=document.createElement('canvas');c.width=c.height=480;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,480,480);g.addColorStop(0,a);g.addColorStop(1,b);x.fillStyle=g;x.fillRect(0,0,480,480);
 x.font='230px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(e,240,255);return c.toDataURL('image/jpeg',.8)}
async function seedDemo(){
 const mk=async(num,name)=>{const s={id:uid(),num,name,updatedAt:Date.now()};state.sites.push(s);await DB.put('sites',s);return s};
 const s1=await mk(1,'Метельчатые гортензии'),s2=await mk(2,'Плодовые'),s3=await mk(3,'Саженцы роз');
 const demo=[
  [s1,'Гортензия метельчатая','Ванилла Фрейз','40–60 см','2 года',650,30,'#dce9ff','#8fb4e8','🌸',{purchase:9000,soil:1500,fert:600,pot:1200,water:300}],
  [s1,'Гортензия метельчатая','Лаймлайт','30–40 см','2 года',590,4,'#e8f5dc','#9ccb7a','🌿',{purchase:1200,soil:200,fert:80,pot:160,water:40}],
  [s2,'Яблоня','Антоновка','120–150 см','3 года',900,12,'#f6ead2','#d9b56a','🍎',{purchase:5400,soil:900,fert:400,pot:800,water:200}],
  [s2,'Груша','Лада','120–150 см','3 года',950,3,'#f2e4c8','#c99f52','🍐',{purchase:1500,soil:250,fert:110,pot:220,water:60}],
  [s3,'Роза флорибунда','Лавли Лидия','30 см','1 год',450,48,'#ffd9dc','#e88a96','🌹',{purchase:7200,soil:1000,fert:500,pot:900,water:250}],
  [s3,'Роза плетистая','Эльф','50 см','2 года',780,0,'#e4d9f5','#a98fd6','🌹',{purchase:600,soil:90,fert:40,pot:70,water:20}]];
 for(const[site,name,variety,h,age,price,qty,c1,c2,e,cost]of demo){
  const it={id:uid(),siteId:site.id,name,variety,height:h,age,price,qty,barcode:nextBarcode(),batches:[],
   photo:demoPhoto(c1,c2,e),cost:{...cost,batchQty:qty||1},updatedAt:Date.now()};
  state.items.push(it);await DB.put('items',it)}
 addLog('Система','Загружены демо-данные')}

/* ---------- установка, сеть, старт ---------- */
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=$('#set-install');if(b)b.style.display=''});
$('#app').addEventListener('click',async e=>{if(e.target.closest('#set-install')&&deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;const b=$('#set-install');if(b)b.style.display='none'}});
function updHeader(){$('#hdr-code').textContent='код: '+(settings.code||'—');
 const net=$('#hdr-net');const on=navigator.onLine;net.classList.toggle('off',!on);net.querySelector('span').textContent=on?'онлайн':'офлайн'}
window.addEventListener('offline',updHeader);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
(async function init(){
 await DB.open();await loadAll();await migrateCodes();saveSettings();updHeader();
 if(!localStorage.getItem('pn-welcomed')){
  $('#modal-root').innerHTML=`<div class="backdrop"></div><div class="sheet"><div class="grab"></div>
   <img class="welcome-logo" src="logo.png" onerror="this.remove()">
   <h3 style="font-family:var(--fd);margin:0 0 6px;text-align:center">Гектары Счастья</h3>
   <div class="muted" style="margin-bottom:12px;text-align:center">Учёт растений, штрихкоды и продажи — прямо с телефона, работает без интернета.</div>
   <div class="field"><label>Код питомника</label><input id="w-code" placeholder="ГЕКТАРЫ СЧАСТЬЯ"></div>
   <div class="field"><label>Имя устройства</label><input id="w-device" value="${esc(settings.device)}"></div>
   <div class="btnrow"><button class="btn primary big" id="w-go">Начать работу</button></div>
   <button class="btn ghost big" id="w-demo" style="margin-top:8px">🌱 Сразу с демо-данными</button></div>`;
  const done=async demo=>{settings.code=$('#w-code').value.trim();settings.device=$('#w-device').value.trim()||settings.device;saveSettings();updHeader();
   localStorage.setItem('pn-welcomed','1');closeSheet();if(demo){await seedDemo();refresh();go('#/sites')}};
  $('#w-go').onclick=()=>done(false);$('#w-demo').onclick=()=>done(true)}
 if(location.hash)route();else{history.replaceState(null,'','#/sites');route()}
})();