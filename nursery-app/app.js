/* ============================================================
   ПИТОМНИК · Инвентаризация — MVP (offline-first PWA), этап 1
   ============================================================ */
'use strict';

/* ---------- утилиты ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>{n=+n||0;const o={style:'currency',currency:'RUB',maximumFractionDigits:Number.isInteger(n)?0:2};return new Intl.NumberFormat('ru-RU',o).format(n)};
const dtFull=ts=>new Date(ts).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const dtDay=ts=>new Date(ts).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
function toast(msg,type=''){const t=document.createElement('div');t.className='toast '+type;t.innerHTML=msg;$('#toasts').append(t);setTimeout(()=>t.remove(),3400)}
function beep(){try{const a=beep._a||(beep._a=new (window.AudioContext||window.webkitAudioContext)());const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=1150;g.gain.value=.12;o.start();o.stop(a.currentTime+.12)}catch(e){}}
const vib=ms=>navigator.vibrate&&navigator.vibrate(ms);
function fileCompress(file,max=900,q=.72){return new Promise(res=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{let w=img.width,h=img.height;const k=Math.min(1,max/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',q))};img.src=u})}

/* ---------- настройки ---------- */
const DEF_SET={code:'',device:'',low:5,sbUrl:'',sbKey:''};
let settings={...DEF_SET,...JSON.parse(localStorage.getItem('pn-set')||'{}')};
if(!settings.device){const ua=navigator.userAgent;settings.device=(/iphone|ipad/i.test(ua)?'iPhone':/android/i.test(ua)?'Android':'Устройство')+'-'+Math.floor(10+Math.random()*90)}
const saveSettings=()=>localStorage.setItem('pn-set',JSON.stringify(settings));

/* ---------- IndexedDB ---------- */
const DB={db:null,
 open(){return new Promise((res,rej)=>{const r=indexedDB.open('nursery-db',1);
  r.onupgradeneeded=e=>{const d=e.target.result;['sites','items','sales','log'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})})};
  r.onsuccess=e=>{DB.db=e.target.result;res()};r.onerror=()=>rej(r.error)})},
 all(s){return new Promise((res,rej)=>{const q=DB.db.transaction(s).objectStore(s).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error)})},
 put(s,v){return new Promise((res,rej)=>{const t=DB.db.transaction(s,'readwrite');t.objectStore(s).put(v);t.oncomplete=res;t.onerror=()=>rej(t.error)})},
 del(s,id){return new Promise(res=>{const t=DB.db.transaction(s,'readwrite');t.objectStore(s).delete(id);t.oncomplete=res})},
 bulk(s,arr){return new Promise(res=>{const t=DB.db.transaction(s,'readwrite'),o=t.objectStore(s);arr.forEach(v=>o.put(v));t.oncomplete=res})}};

let state={sites:[],items:[],sales:[],log:[]};
async function loadAll(){[state.sites,state.items,state.sales,state.log]=await Promise.all(['sites','items','sales','log'].map(s=>DB.all(s)));
 state.sites.sort((a,b)=>(+a.num)-(+b.num));state.items.sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));state.sales.sort((a,b)=>b.ts-a.ts);state.log.sort((a,b)=>b.ts-a.ts)}
const sitesById=()=>Object.fromEntries(state.sites.map(s=>[s.id,s]));
const itemsById=()=>Object.fromEntries(state.items.map(i=>[i.id,i]));
const siteOf=it=>sitesById()[it.siteId]||{num:'?',name:''};
const LOWF=()=>+settings.low||5;

function unitCost(it){const c=it.cost||{};const t=(+c.purchase||0)+(+c.soil||0)+(+c.fert||0)+(+c.pot||0)+(+c.water||0);const n=+c.batchQty||0;return{total:t,n,unit:n>0?t/n:null}}
function addLog(type,text){const e={id:uid(),ts:Date.now(),device:settings.device,type,text};state.log.unshift(e);DB.put('log',e)}

/* ---------- Code 128 (свой генератор, работает офлайн) ---------- */
const C128=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
function c128segments(text){const vals=[104];let sum=104;
 for(let i=0;i<text.length;i++){const v=Math.min(102,Math.max(0,(text.charCodeAt(i)&0x7f)-32));vals.push(v);sum+=v*(i+1)}
 vals.push(sum%103);vals.push(106);
 const segs=[];let x=0;
 for(const v of vals){const p=C128[v];for(let j=0;j<p.length;j++){const w=+p[j];if(j%2===0)segs.push([x,w]);x+=w}}
 return{segs,width:x}}
function svgBarcode(text){const{segs,width}=c128segments(text);
 const bars=segs.map(([x,w])=>`<rect x="${x}" y="0" width="${w}" height="40"/>`).join('');
 return`<svg viewBox="0 0 ${width} 40" preserveAspectRatio="none" fill="#111"><rect width="${width}" height="40" fill="#fff"/>${bars}</svg>`}

/* ---------- этикетка в canvas (для PDF; кириллица без проблем) ---------- */
function fitText(ctx,text,maxW){let t=text;while(t.length>3&&ctx.measureText(t).width>maxW)t=t.slice(0,-2).trimEnd()+'…';return t}
function renderLabelCanvas(it){const S=10,W=43*S,H=25*S,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#151515';x.textBaseline='top';
 const st=siteOf(it),pad=2*S;
 x.font='700 25px system-ui,Arial';x.fillText(fitText(x,it.name||'Без названия',W-2*pad),pad,1.6*S);
 x.font='500 18px system-ui,Arial';x.fillStyle='#333';
 x.fillText(fitText(x,`${it.variety||'сорт —'} · Площ. №${st.num}`,W-2*pad),pad,5.1*S);
 x.font='800 26px system-ui,Arial';x.fillStyle='#111';x.fillText(money(it.price),pad,8.2*S);
 const{segs,width}=c128segments(it.barcode||'0');const bw=W-2*pad,bh=10*S,by=H-bh-1.4*S,k=bw/width;
 x.fillStyle='#111';for(const[sx,sw]of segs)x.fillRect(pad+sx*k,by,Math.max(1,sw*k),bh);
 return c}

/* ---------- роутер ---------- */
let scanCtx=null, saleOpen=null;
window.addEventListener('hashchange',route);
function go(h){location.hash=h}
document.addEventListener('click',e=>{const el=e.target.closest('[data-go]');if(el){go(el.dataset.go)}});
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
 }catch(err){console.error(err);v.innerHTML='<div class="empty"><span class="big">🌧️</span><b>Ошибка отрисовки</b>'+esc(err.message)+'</div>'}}

/* ---------- ЭКРАН: площадки ---------- */
function renderSites(){
 const totalPots=state.items.reduce((s,i)=>s+(+i.qty||0),0);
 const lowN=state.items.filter(i=>+i.qty<LOWF()).length;
 let list='';
 if(!state.sites.length)list=`<div class="empty"><span class="big">🌱</span><b>Площадок пока нет</b>Создайте первую — например, «№1 — метельчатые гортензии».<br><br><button class="btn primary" onclick="siteForm()">+ Создать площадку</button></div>`;
 for(const s of state.sites){const its=state.items.filter(i=>i.siteId===s.id);
  const pots=its.reduce((a,i)=>a+(+i.qty||0),0),low=its.filter(i=>+i.qty<LOWF()).length;
  list+=`<button class="card row-card" data-go="#/site/${s.id}">
   <span class="ph" style="font-family:var(--fd);font-weight:900;color:var(--pine);font-size:20px">№${esc(s.num)}</span>
   <span class="row-main"><h3>${esc(s.name||'Без названия')}</h3>
     <span class="sub">${its.length} позиций · ${pots} горшков ${low?`<span class="low" style="margin-left:6px">⚠ мало: ${low}</span>`:''}</span></span>
   <span class="row-side"><span class="pots">${pots}<small>горшков</small></span></span></button>`}
 return`<div class="pagehead"><h2>Площадки</h2></div>
  <div class="stat-strip">
   <div class="stat"><b>${state.sites.length}</b><span>площадок</span></div>
   <div class="stat"><b>${state.items.length}</b><span>позиций</span></div>
   <div class="stat"><b>${totalPots}</b><span>горшков</span></div>
   <div class="stat ${lowN?'warn':''}"><b>${lowN}</b><span>заканч.</span></div>
  </div>
  ${list}
  ${state.sites.length?'<div class="btnrow"><button class="btn primary big" onclick="siteForm()">+ Новая площадка</button></div>':''}`}

window.siteForm=function(site){const s=site||{};
 $('#modal-root').innerHTML=`<div class="backdrop" onclick="closeSheet()"></div>
 <div class="sheet"><div class="grab"></div>
  <h3 style="margin:0 0 12px;font-family:var(--fd)">${s.id?'Изменить':'Новая'} площадка</h3>
  <div class="grid2"><div class="field"><label>Номер</label><input id="sf-num" value="${esc(s.num??(state.sites.length+1))}" inputmode="numeric"></div>
  <div class="field"><label>Название</label><input id="sf-name" value="${esc(s.name||'')}" placeholder="метельчатые гортензии"></div></div>
  <div class="btnrow"><button class="btn ghost" onclick="closeSheet()">Отмена</button>
   <button class="btn primary" id="sf-save">Сохранить</button>
   ${s.id?'<button class="btn danger small" id="sf-del">Удалить</button>':''}</div></div>`;
 $('#sf-save').onclick=async()=>{const num=$('#sf-num').value.trim(),name=$('#sf-name').value.trim();
  if(!num)return toast('Укажите номер','warn');
  if(s.id){Object.assign(s,{num,name,updatedAt:Date.now()});await DB.put('sites',s);addLog('Площадка',`Изменена: №${num} ${name}`)}
  else{const ns={id:uid(),num,name,updatedAt:Date.now()};state.sites.push(ns);await DB.put('sites',ns);addLog('Площадка',`Создана: №${num} ${name}`)}
  closeSheet();toast('✓ Площадка сохранена');refresh()};
 const del=$('#sf-del');if(del)del.onclick=async()=>{if(!confirm('Удалить площадку вместе со всеми позициями?'))return;
  const its=state.items.filter(i=>i.siteId===s.id);
  for(const i of its){state.items=state.items.filter(x=>x.id!==i.id);await DB.del('items',i.id)}
  state.sites=state.sites.filter(x=>x.id!==s.id);await DB.del('sites',s.id);
  addLog('Площадка',`Удалена: №${s.num} (${its.length} позиций)`);closeSheet();toast('Площадка удалена');refresh()}}

window.closeSheet=()=>{$('#modal-root').innerHTML='';saleOpen=null};
function refresh(){route()}

/* ---------- ЭКРАН: карточка площадки ---------- */
function renderSitePage(id){const s=sitesById()[id];if(!s)return'<div class="empty">Площадка не найдена</div>';
 const its=state.items.filter(i=>i.siteId===id),pots=its.reduce((a,i)=>a+(+i.qty||0),0),sum=its.reduce((a,i)=>a+(+i.qty||0)*(+i.price||0),0);
 let rows='';
 if(!its.length)rows=`<div class="empty"><span class="big">🪴</span><b>Позиций пока нет</b>Добавьте первое растение на эту площадку.</div>`;
 for(const it of its){const low=+it.qty<LOWF();
  rows+=`<button class="card row-card" data-go="#/item/${it.id}">
   ${it.photo?`<img class="ph" src="${it.photo}">`:`<span class="ph">🌿</span>`}
   <span class="row-main"><h3>${esc(it.name)}${low?' <span class="low'+(it.qty==0?' red':'')+'">⚠ '+it.qty+'</span>':''}</h3>
    <span class="sub">${esc(it.variety||'')}${it.height?' · '+esc(it.height):''}</span>
    <span class="price-t">${money(it.price)}</span></span>
   <span class="row-side"><span class="pots">${it.qty}<small>горшков</small></span></span></button>`}
 return`<div class="pagehead"><button class="back" data-go="#/sites">←</button>
   <h2>№${esc(s.num)} · ${esc(s.name||'')}<span class="sub">${its.length} позиций · ${pots} горшков · ${money(sum)}</span></h2></div>
  ${rows}
  <div class="btnrow">
   <button class="btn primary big" onclick="go('#/item/new?site=${id}')">+ Добавить растение</button>
   <button class="btn ghost" onclick="siteForm(sitesById()['${id}'])">✎</button>
   <button class="btn ghost" data-go="#/labels?site=${id}">🏷 Этикетки</button>
  </div>`}

/* ---------- ЭКРАН: позиция растения ---------- */
function nextBarcode(){let n=state.items.length+1,code;do{code='N'+String(n).padStart(3,'0');n++}while(state.items.some(i=>i.barcode===code));return code}
function renderItemForm(id){
 const isNew=id.startsWith('new')||!itemsById()[id];
 const q=new URLSearchParams((location.hash.split('?')[1])||'');
 const it=isNew?{name:'',variety:'',height:'',age:'',price:'',qty:'',barcode:nextBarcode(),siteId:q.get('site')||state.sites[0]?.id||'',photo:'',cost:{purchase:'',soil:'',fert:'',pot:'',water:'',batchQty:''}}:JSON.parse(JSON.stringify(itemsById()[id]));
 if(!state.sites.length)return`<div class="pagehead"><button class="back" data-go="#/sites">←</button><h2>Новое растение</h2></div><div class="empty"><span class="big">🏞️</span><b>Сначала создайте площадку</b><br><br><button class="btn primary" onclick="siteForm()">+ Создать площадку</button></div>`;
 const opts=state.sites.map(s=>`<option value="${s.id}" ${s.id===it.siteId?'selected':''}>№${esc(s.num)} — ${esc(s.name||'')}</option>`).join('');
 const c=it.cost||{};
 return`<div class="pagehead"><button class="back" onclick="history.back()">←</button><h2>${isNew?'Новое растение':esc(it.name)}</h2></div>
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
  <div class="field"><label>Штрихкод (Code 128)</label>
   <div style="display:flex;gap:8px"><input id="f-bc" value="${esc(it.barcode)}" style="flex:1"><button class="btn ghost small" id="f-bc-gen" type="button">⟳ Новый</button></div>
   <div class="bc-preview" id="bc-prev"></div></div>
 </div>
 <div class="card">
  <h3 style="margin:0 0 4px">Себестоимость партии</h3>
  <div class="muted" style="margin-bottom:10px">Стоимость компонентов на всю партию, ₽</div>
  <div class="grid2">
   <div class="field"><label>Закупка саженца</label><input id="c-purchase" inputmode="decimal" value="${esc(c.purchase||'')}"></div>
   <div class="field"><label>Земля (торф)</label><input id="c-soil" inputmode="decimal" value="${esc(c.soil||'')}"></div>
   <div class="field"><label>Удобрения</label><input id="c-fert" inputmode="decimal" value="${esc(c.fert||'')}"></div>
   <div class="field"><label>Горшок</label><input id="c-pot" inputmode="decimal" value="${esc(c.pot||'')}"></div>
   <div class="field"><label>Полив</label><input id="c-water" inputmode="decimal" value="${esc(c.water||'')}"></div>
   <div class="field"><label>Горшков в партии</label><input id="c-batch" inputmode="numeric" value="${esc(c.batchQty||'')}" placeholder="= кол-ву"></div>
  </div>
  <div class="formula" id="cost-box"></div>
 </div>
 <div class="btnrow">
   <button class="btn primary big" id="f-save">${isNew?'Добавить растение':'Сохранить'}</button>
 </div>
 <div class="btnrow">
   <button class="btn ghost" data-go="#/labels?item=${isNew?'':it.id}">🏷 Этикетка</button>
   ${isNew?'':`<button class="btn danger" id="f-del">Удалить</button>`}
 </div>`}

function costCalc(){const g=id=>+($('#'+id)?.value||0);
 const parts=[['c-purchase','Закупка саженца'],['c-soil','Земля (торф)'],['c-fert','Удобрения'],['c-pot','Горшок'],['c-water','Полив']];
 const total=parts.reduce((s,[id])=>s+g(id),0);
 const qty=+($('#f-qty')?.value||0),batch=+($('#c-batch')?.value||0)||qty;
 const box=$('#cost-box');if(!box)return;
 const empty=parts.filter(([id])=>!$('#'+id).value&&$('#'+id).value!=='0');
 const unit=batch>0?total/batch:null;
 box.innerHTML=`<div style="font-weight:700;margin-bottom:6px">Расчёт по шагам</div>
  ${parts.map(([id,n])=>`<div class="st"><span>${n}${$('#'+id)?.value?'':' <em style="color:#a08a20">(не заполнено → 0)</em>'}</span><b>${money(g(id))}</b></div>`).join('')}
  <div class="st"><span>Сумма компонентов</span><b>${money(total)}</b></div>
  <div class="st"><span>Делим на горшков в партии</span><b>÷ ${batch||'—'}</b></div>
  <div class="st res"><span>Себестоимость 1 шт</span><span>${unit!=null?money(unit):'—'}</span></div>
  ${unit!=null&&+($('#f-price')?.value||0)?`<div class="st"><span>Наценка</span><b style="color:var(--ok)">${money(+$('#f-price').value-unit)} / шт</b></div>`:''}
  ${empty.length?`<div class="warnbox">⚠ Не заполнено: ${empty.map(([,n])=>n).join(', ')}. Считаем как 0 ₽ — себестоимость может быть занижена.</div>`:''}`}

function bindItemForm(id){
 const isNew=id.startsWith('new')||!itemsById()[id];
 bindItemForm._photo=isNew?'':(itemsById()[id]?.photo||'');
 $('#ph-card').onclick=()=>$('#f-photo').click();
 $('#f-photo').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  const data=await fileCompress(f);bindItemForm._photo=data;
  const el=$('#ph-img');
  if(el)el.src=data;else{$('#ph-ph').outerHTML=`<img class="ph lg" id="ph-img" src="${data}">`}};
 const updBc=()=>{$('#bc-prev').innerHTML=$('#f-bc').value?svgBarcode($('#f-bc').value.trim())+'<div><code>'+esc($('#f-bc').value.trim())+'</code></div>':''};
 $('#f-bc').addEventListener('input',updBc);$('#f-bc-gen').onclick=()=>{$('#f-bc').value=nextBarcode();updBc()};
 ['f-price','f-qty','c-purchase','c-soil','c-fert','c-pot','c-water','c-batch'].forEach(f=>$('#'+f)?.addEventListener('input',costCalc));
 costCalc();updBc();
 $('#f-save').onclick=async()=>{
  const name=$('#f-name').value.trim(),price=+$('#f-price').value,qty=Math.round(+$('#f-qty').value||0);
  if(!name)return toast('Укажите название','warn');
  if(!(price>=0))return toast('Укажите цену','warn');
  if(qty<0)return toast('Количество не может быть отрицательным','warn');
  const c={purchase:+$('#c-purchase').value||0,soil:+$('#c-soil').value||0,fert:+$('#c-fert').value||0,pot:+$('#c-pot').value||0,water:+$('#c-water').value||0,batchQty:+$('#c-batch').value||qty};
  const data={name,variety:$('#f-variety').value.trim(),height:$('#f-height').value.trim(),age:$('#f-age').value.trim(),
   price,qty,siteId:$('#f-site').value,barcode:($('#f-bc').value.trim()||nextBarcode()),photo:bindItemForm._photo||'',cost:c,updatedAt:Date.now()};
  if(isNew){const it={id:uid(),...data};state.items.push(it);await DB.put('items',it);addLog('Позиция',`Добавлена: ${name} — ${qty} горшков, ${money(price)}`);toast('✓ Растение добавлено');go('#/site/'+it.siteId)}
  else{const old=itemsById()[id],it={id,...old,...data};const idx=state.items.findIndex(x=>x.id===id);state.items[idx]=it;await DB.put('items',it);
   addLog('Позиция',`Изменена: ${name}`+(old.qty!==qty?` (остаток ${old.qty} → ${qty})`:''));toast('✓ Сохранено');go('#/site/'+it.siteId)}};
 const del=$('#f-del');if(del)del.onclick=async()=>{if(!confirm('Удалить позицию? История продаж сохранится.'))return;
  const it=itemsById()[id];state.items=state.items.filter(x=>x.id!==id);await DB.del('items',id);
  addLog('Позиция',`Удалена: ${it.name}`);toast('Удалено');go('#/site/'+it.siteId)}}

/* ---------- ЭКРАН: этикетки ---------- */
let labelSel={};
function renderLabels(){
 const q=new URLSearchParams(location.hash.split('?')[1]||'');
 const presetSite=q.get('site')||'',presetItem=q.get('item')||'';
 if(presetItem&&!labelSel[presetItem])labelSel[presetItem]=1;
 const sopts=`<option value="">Все площадки</option>`+state.sites.map(s=>`<option value="${s.id}" ${s.id===presetSite?'selected':''}>№${esc(s.num)} — ${esc(s.name||'')}</option>`).join('');
 return`<div class="pagehead"><h2>Этикетки 43×25 мм</h2></div>
 <div class="card"><div class="field" style="margin:0"><label>Площадка</label><select id="lbl-site">${sopts}</select></div></div>
 <div class="card" id="lbl-list"></div>
 <div class="btnrow" style="margin-top:0"><button class="btn small ghost" id="lbl-all">Отметить все</button><button class="btn small ghost" id="lbl-none">Снять</button><button class="btn small ghost" id="lbl-eq">Копии = остатку</button></div>
 <div class="lbl-preview" id="lbl-prev"><span class="muted">Выберите позиции — здесь появится предпросмотр</span></div>
 <div class="btnrow"><button class="btn primary big" id="lbl-a4">📄 PDF на A4 (сетка)</button></div>
 <div class="btnrow"><button class="btn ghost" id="lbl-thermo">🧾 PDF для термопринтера</button><button class="btn ghost" id="lbl-print">🖨 Печать</button></div>
 <div class="note">Лист 43×25 мм: 4×11 = 44 этикетки на A4. В настройках печати принтера поставьте масштаб 100%.</div>`}
function lblList(){const sid=$('#lbl-site')?.value;const its=state.items.filter(i=>!sid||i.siteId===sid);
 const box=$('#lbl-list');if(!box)return;
 if(!its.length){box.innerHTML='<div class="muted" style="padding:6px">Нет позиций — добавьте растения.</div>';return}
 box.innerHTML=its.map(it=>{const st=siteOf(it);return`<div class="lbl-item">
  <input type="checkbox" data-lid="${it.id}" ${labelSel[it.id]?'checked':''}>
  <span class="nm">${esc(it.name)}<small>№${esc(st.num)} · ${money(it.price)} · остаток ${it.qty}</small></span>
  <input type="number" min="0" data-cid="${it.id}" value="${labelSel[it.id]||0}" inputmode="numeric"></div>`}).join('');
 box.querySelectorAll('[data-lid]').forEach(c=>c.onchange=()=>{if(c.checked)labelSel[c.dataset.lid]=labelSel[c.dataset.lid]||1;else delete labelSel[c.dataset.lid];lblSync();lblPrev()});
 box.querySelectorAll('[data-cid]').forEach(n=>n.oninput=()=>{const v=Math.max(0,Math.round(+n.value||0));if(v>0)labelSel[n.dataset.cid]=v;else delete labelSel[n.dataset.cid];lblSync();lblPrev()});
 lblPrev()}
function lblSync(){$$('#lbl-list [data-cid]').forEach(n=>{if(labelSel[n.dataset.cid]!==undefined)n.value=labelSel[n.dataset.cid]})}
function lblJobs(){const jobs=[];for(const it of state.items){const n=labelSel[it.id];if(n>0)for(let k=0;k<n;k++)jobs.push(it)}return jobs}
function lblPrev(){const j=lblJobs()[0]||state.items.find(i=>labelSel[i.id]);const p=$('#lbl-prev');if(!p)return;
 if(!j){p.innerHTML='<span class="muted">Выберите позиции — здесь появится предпросмотр</span>';return}
 p.innerHTML=`<img src="${renderLabelCanvas(j).toDataURL()}">`}
function bindLabels(){
 $('#lbl-site').onchange=()=>{labelSel={};lblList()};
 $('#lbl-all').onclick=()=>{const sid=$('#lbl-site').value;state.items.forEach(i=>{if(!sid||i.siteId===sid)labelSel[i.id]=labelSel[i.id]||1});lblList()};
 $('#lbl-none').onclick=()=>{labelSel={};lblList()};
 $('#lbl-eq').onclick=()=>{const sid=$('#lbl-site').value;state.items.forEach(i=>{if(!sid||i.siteId===sid)labelSel[i.id]=+i.qty||0});lblList();toast('Копии = остатку горшков')};
 $('#lbl-a4').onclick=()=>makeLabelsPdf('a4');
 $('#lbl-thermo').onclick=()=>makeLabelsPdf('thermo');
 $('#lbl-print').onclick=()=>printLabelsHtml();
 lblList()}
function makeLabelsPdf(mode){const jobs=lblJobs();if(!jobs.length)return toast('Выберите позиции','warn');
 if(!window.jspdf){toast('PDF-библиотека не загрузилась (офлайн). Использую «Печать».','warn');return printLabelsHtml()}
 const{jsPDF}=window.jspdf;let doc;
 if(mode==='thermo')doc=new jsPDF({unit:'mm',format:[43,25]});else doc=new jsPDF({unit:'mm',format:'a4'});
 jobs.forEach((it,i)=>{const img=renderLabelCanvas(it).toDataURL('image/png');
  if(mode==='thermo'){if(i>0)doc.addPage([43,25]);doc.addImage(img,'PNG',0,0,43,25)}
  else{if(i>0&&i%44===0)doc.addPage();const idx=i%44;doc.addImage(img,'PNG',8+(idx%4)*43,8+Math.floor(idx/4)*25,43,25)}});
 doc.save(mode==='thermo'?'etiketki-termo.pdf':'etiketki-A4.pdf');
 addLog('Этикетки',`Сформирован PDF (${mode==='thermo'?'термо':'A4'}): ${jobs.length} шт`);toast(`✓ PDF готов: ${jobs.length} этикеток`)}
function printLabelsHtml(){const jobs=lblJobs();if(!jobs.length)return toast('Выберите позиции','warn');
 const w=window.open('','_blank');if(!w)return toast('Разрешите всплывающие окна','err');
 w.document.write(`<!doctype html><meta charset="utf-8"><title>Этикетки 43×25</title><style>
  @page{size:A4;margin:8mm}body{margin:0;font-family:system-ui}.g{display:flex;flex-wrap:wrap}
  img{width:43mm;height:25mm;display:block}@media print{button{display:none}}</style>
  <button onclick="print()" style="margin:8px;padding:10px 18px;font-size:16px">🖨 Печать / Сохранить как PDF</button>
  <div class="g">${jobs.map(it=>`<img src="${renderLabelCanvas(it).toDataURL()}">`).join('')}</div>`);w.document.close()}

/* ---------- ЭКРАН: сканер ---------- */
function renderScan(){return`<div class="pagehead"><h2>Сканер продажи</h2></div>
 <div class="scanbox" id="scanbox">
   <video id="scan-video" playsinline muted></video>
   <div class="frame"><i></i><i></i><i></i><i></i></div><div class="laser"></div>
 </div>
 <div class="scan-hint">Наведите камеру на штрихкод этикетки. Повторное сканирование того же кода — +1 к количеству.</div>
 <div class="btnrow" style="margin-top:0"><button class="btn primary big" id="scan-start">▶ Включить камеру</button></div>
 <div class="card" style="margin-top:12px"><label style="font-size:13px;font-weight:700;color:#41523c">Ручной ввод кода (если камера недоступна)</label>
  <div class="manual-row"><input id="man-code" placeholder="Например, N001" autocomplete="off"><button class="btn leaf" id="man-go">Найти</button></div></div>`}
let scanBusy=0;
function bindScan(){
 $('#scan-start').onclick=startScan;
 $('#man-go').onclick=()=>{const v=$('#man-code').value.trim();if(!v)return;const it=state.items.find(i=>(i.barcode||'').toLowerCase()===v.toLowerCase());
  if(it){openSale(it);$('#man-code').value=''}else toast('Код «'+esc(v)+'» не найден','err')};
 $('#man-code').addEventListener('keydown',e=>{if(e.key==='Enter')$('#man-go').click()})}
async function startScan(){
 const btn=$('#scan-start');if(!btn)return;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
  scanCtx={stream,stop:[]};const video=$('#scan-video');video.srcObject=stream;await video.play();
  btn.textContent='⏹ Остановить камеру';btn.onclick=()=>{stopScan();route()};
  if('BarcodeDetector'in window){
    const fmts=await BarcodeDetector.getSupportedFormats().catch(()=>[]);
    if(!fmts.length||fmts.includes('code_128')){
      scanCtx.det=new BarcodeDetector({formats:fmts.includes('code_128')?['code_128']:undefined});
      scanCtx.timer=setInterval(detectFrame,180);return}}
  if(window.Html5Qrcode){const hq=new Html5Qrcode('scanbox');
   await hq.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:150}},txt=>onScan(txt));
   scanCtx.hq=hq;return}
  toast('Камера работает, но авто-распознавание недоступно офлайн. Введите код вручную.','warn');
 }catch(err){console.warn(err);
  toast('Не удалось открыть камеру. Проверьте разрешение в браузере или введите код вручную.','err')}}
async function detectFrame(){if(!scanCtx?.det||scanBusy)return;const v=$('#scan-video');if(!v||v.readyState<2)return;
 try{const codes=await scanCtx.det.detect(v);if(codes.length)onScan(codes[0].rawValue)}catch(e){}}
function onScan(txt){const code=String(txt||'').trim();if(!code)return;const now=Date.now();
 if(now-scanBusy<1200)return;scanBusy=now;beep();vib(70);
 const it=state.items.find(i=>(i.barcode||'').toLowerCase()===code.toLowerCase());
 if(!it)return toast('Код «'+esc(code)+'» не найден в базе','err');
 if(saleOpen&&saleOpen.item.id===it.id){saleOpen.qty=Math.min(saleOpen.qty+1,+it.qty||99);updSaleSheet();toast('+1 → '+saleOpen.qty+' шт')}
 else openSale(it)}
function stopScan(){if(scanCtx){clearInterval(scanCtx.timer);scanCtx.stream?.getTracks().forEach(t=>t.stop());
  if(scanCtx.hq)scanCtx.hq.stop().then(()=>scanCtx.hq.clear()).catch(()=>{});scanCtx=null}scanBusy=0}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&scanCtx)stopScan()});

/* ---------- шторка продажи ---------- */
function openSale(it){saleOpen={item:it,qty:1,_uc:unitCost(it)};
 $('#modal-root').innerHTML=`<div class="backdrop" onclick="closeSheet()"></div>
 <div class="sheet" id="sale-sheet"></div>`;
 updSaleSheet()}
function updSaleSheet(){const{item:it,qty}=saleOpen,st=siteOf(it),uc=saleOpen._uc||unitCost(it);
 const total=qty*(+it.price||0),profit=uc.unit!=null?qty*((+it.price||0)-uc.unit):null;
 $('#sale-sheet').innerHTML=`<div class="grab"></div>
  <div class="sale-head">${it.photo?`<img class="ph" src="${it.photo}">`:'<span class="ph">🌿</span>'}
   <div style="flex:1;min-width:0"><h3 style="margin:0">${esc(it.name)}</h3>
    <span class="sub">${esc(it.variety||'')} · Площадка №${esc(st.num)}</span><br>
    <span class="chip-s">${money(it.price)} / шт</span><span class="chip-s">остаток: ${it.qty}</span></div></div>
  <div class="stepper"><button id="s-minus">−</button><input id="s-qty" inputmode="numeric" value="${qty}"><button id="s-plus">+</button>
   <span class="muted" style="flex:1;text-align:right">или сканируйте ещё раз</span></div>
  <div class="sale-sum"><span>Итого</span><b>${money(total)}</b></div>
  <div class="muted" style="margin:4px 0 10px">Себестоимость: ${uc.unit!=null?money(uc.unit)+' / шт':'не задана'} · Прибыль: ${profit!=null?money(profit):'—'}</div>
  ${qty>+it.qty?'<div class="warnbox">⚠ На площадке только '+it.qty+' горшков. Продаём '+qty+' — остаток станет отрицательным.</div>':''}
  <div class="btnrow"><button class="btn ghost" onclick="closeSheet()">Отмена</button>
   <button class="btn primary" id="s-ok" style="flex:2">✓ Продать ${qty} шт · ${money(total)}</button></div>`;
 $('#s-minus').onclick=()=>{saleOpen.qty=Math.max(1,saleOpen.qty-1);updSaleSheet()};
 $('#s-plus').onclick=()=>{saleOpen.qty=Math.min(saleOpen.qty+1,999);updSaleSheet()};
 $('#s-qty').oninput=e=>{saleOpen.qty=Math.max(1,Math.round(+e.target.value||1))};
 $('#s-ok').onclick=confirmSale}
async function confirmSale(){const it=itemsById()[saleOpen.item.id];if(!it)return closeSheet();
 const qty=saleOpen.qty,price=+it.price||0,uc=unitCost(it);
 const sale={id:uid(),ts:Date.now(),itemId:it.id,itemName:it.name,variety:it.variety||'',siteNum:siteOf(it).num,
  qty,price,sum:qty*price,costUnit:uc.unit||0,costTotal:(uc.unit||0)*qty,profit:(uc.unit!=null?qty*(price-uc.unit):null),device:settings.device};
 it.qty=(+it.qty||0)-qty;it.updatedAt=Date.now();
 await DB.put('items',it);await DB.put('sales',sale);state.sales.unshift(sale);
 addLog('Продажа',`${it.name} × ${qty} шт на ${money(sale.sum)} (${settings.device})`);
 beep();vib([60,40,60]);closeSheet();toast(`✓ Продано: ${esc(it.name)} × ${qty} = <b>${money(sale.sum)}</b>`);
 if(+it.qty<LOWF()&&+it.qty>=0)toast(`⚠ Мало осталось: ${esc(it.name)} — ${it.qty} шт`,'warn');
 if(location.hash.startsWith('#/site')||location.hash.startsWith('#/sites'))refresh()}

/* ---------- ЭКРАН: история ---------- */
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
 if(histTab==='log'){const rows=state.log.filter(e=>e.ts>=f&&e.ts<=t).slice(0,300);
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
   <div class="sub">${s.qty} шт × ${money(s.price)} · площ. №${esc(s.siteNum)} · ${esc(s.device)}</div></span>
   <span class="row-side"><b>${money(s.sum)}</b>${s.profit!=null?`<div class="sub" style="color:${s.profit>=0?'var(--ok)':'var(--danger)'}">прибыль ${money(s.profit)}</div>`:''}</span></div>`).join('')}
 box.innerHTML=html}

/* ---------- ЭКРАН: отчёты ---------- */
let repPeriod='month';
function renderReports(){return`<div class="pagehead"><h2>Отчёты</h2></div>
 <div class="chips" id="r-chips">${['day','month','season','all'].map(p=>`<button data-p="${p}" class="${repPeriod===p?'on':''}">${{day:'Сегодня',month:'Месяц',season:'Сезон (апр–сен)',all:'Всё время'}[p]}</button>`).join('')}</div>
 <div id="r-body"></div>`}
function bindReports(){$$('#r-chips button').forEach(b=>b.onclick=()=>{repPeriod=b.dataset.p;$$('#r-chips button').forEach(x=>x.classList.toggle('on',x===b));rBody()});rBody()}
function reportData(p){const[f,t]=periodRange(p);const ss=state.sales.filter(s=>s.ts>=f&&s.ts<=t);
 return{ss,sum:ss.reduce((a,s)=>a+s.sum,0),cost:ss.reduce((a,s)=>a+(s.costTotal||0),0),profit:ss.reduce((a,s)=>a+(s.profit||0),0),qty:ss.reduce((a,s)=>a+s.qty,0),
  low:state.items.filter(i=>+i.qty<LOWF()).sort((a,b)=>a.qty-b.qty)}}
function rBody(){const d=reportData(repPeriod);
 const stock=state.sites.map(s=>{const its=state.items.filter(i=>i.siteId===s.id);return{s,n:its.length,pots:its.reduce((a,i)=>a+(+i.qty||0),0),val:its.reduce((a,i)=>a+(+i.qty||0)*(+i.price||0),0)}});
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
   <span class="row-main"><b>${esc(i.name)}</b><div class="sub">${esc(i.variety||'')} · №${esc(st.num)}</div></span>
   <span class="low ${i.qty==0?'red':''}">${i.qty} шт</span></div>`}).join(''):'<div class="note">Всё в порядке — запасов достаточно 🌿</div>'}`;
 $('#r-pdf').onclick=()=>printReport(repPeriod)}
function printReport(p){const d=reportData(p);
 const labels={day:'за сегодня',month:'за месяц',season:'за сезон (апр–сен)',all:'за всё время'};
 const byDay={};d.ss.forEach(s=>{const k=new Date(s.ts).toLocaleDateString('ru-RU');(byDay[k]=byDay[k]||{n:0,sum:0,prof:0});byDay[k].n+=s.qty;byDay[k].sum+=s.sum;byDay[k].prof+=s.profit||0});
 const w=window.open('','_blank');if(!w)return toast('Разрешите всплывающие окна','err');
 w.document.write(`<!doctype html><meta charset="utf-8"><title>Отчёт — Питомник</title><style>
  @page{size:A4;margin:14mm}body{font:14px/1.5 system-ui,Arial;color:#111}h1{font-size:20px}h2{font-size:15px;margin:18px 0 6px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}td,th{border:1px solid #bbb;padding:5px 7px;text-align:left}
  th{background:#eef3e8}.num{text-align:right}.k{display:inline-block;border:1px solid #bbb;border-radius:8px;padding:8px 14px;margin:4px 8px 4px 0}
  .k b{display:block;font-size:17px}@media print{button{display:none}}</style>
  <button onclick="print()" style="padding:10px 20px;font-size:15px;margin-bottom:10px">🖨 Печать / Сохранить как PDF</button>
  <h1>Отчёт питомника ${esc(settings.code||'')}</h1>
  <div>Продажи ${labels[p]} · сформирован ${new Date().toLocaleString('ru-RU')} · устройство: ${esc(settings.device)}</div>
  <div style="margin-top:10px">
   <span class="k">Выручка<b>${money(d.sum)}</b></span><span class="k">Себестоимость<b>${money(d.cost)}</b></span>
   <span class="k">Прибыль<b>${money(d.profit)}</b></span><span class="k">Продано, шт<b>${d.qty}</b></span></div>
  <h2>Продажи по дням</h2><table><tr><th>Дата</th><th class="num">Штук</th><th class="num">Выручка</th><th class="num">Прибыль</th></tr>
  ${Object.entries(byDay).map(([k,v])=>`<tr><td>${k}</td><td class="num">${v.n}</td><td class="num">${money(v.sum)}</td><td class="num">${money(v.prof)}</td></tr>`).join('')||'<tr><td colspan=4>Продаж нет</td></tr>'}</table>
  <h2>Остатки по площадкам</h2><table><tr><th>Площадка</th><th class="num">Позиций</th><th class="num">Горшков</th></tr>
  ${state.sites.map(s=>{const its=state.items.filter(i=>i.siteId===s.id);return`<tr><td>№${esc(s.num)} ${esc(s.name||'')}</td><td class="num">${its.length}</td><td class="num">${its.reduce((a,i)=>a+(+i.qty||0),0)}</td></tr>`}).join('')}</table>
  <h2>Заканчиваются (меньше ${LOWF()} шт)</h2><table><tr><th>Позиция</th><th>Площадка</th><th class="num">Остаток</th></tr>
  ${d.low.map(i=>`<tr><td>${esc(i.name)} ${esc(i.variety||'')}</td><td>№${esc(siteOf(i).num)}</td><td class="num"><b>${i.qty}</b></td></tr>`).join('')||'<tr><td colspan=3>Таких позиций нет</td></tr>'}</table>`);
 w.document.close();addLog('Отчёт','Сформирован печатный отчёт '+labels[p])}

/* ---------- ЭКРАН: настройки ---------- */
function renderSettings(){const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 return`<div class="pagehead"><h2>Настройки</h2></div>
 <div class="card">
  <div class="field"><label>Код питомника</label><input id="set-code" value="${esc(settings.code)}" placeholder="например, ROMASHKA"></div>
  <div class="field"><label>Имя устройства</label><input id="set-device" value="${esc(settings.device)}"></div>
  <div class="muted">Код и имя устройства попадают в каждую продажу и в журнал операций. Пароли не нужны.</div>
 </div>
 <div class="card"><h3 style="margin:0 0 8px">Синхронизация</h3>
  <span class="chip-s">Режим: локальные данные (этап 1)</span>
  <div class="muted" style="margin:8px 0">Работаем без интернета: всё хранится на устройстве. Этап 2 — облачная синхронизация через Supabase (поля ниже уже готовы), конфликты «последняя операция побеждает».</div>
  <div class="field"><label>Supabase URL (этап 2)</label><input id="set-sburl" value="${esc(settings.sbUrl)}" placeholder="https://xxxx.supabase.co"></div>
  <div class="field"><label>Supabase anon key (этап 2)</label><input id="set-sbkey" value="${esc(settings.sbKey)}"></div>
 </div>
 <div class="card">
  <div class="btnrow" style="margin-top:0"><button class="btn ghost" id="set-export">⬇ Экспорт данных (JSON)</button><button class="btn ghost" id="set-import">⬆ Импорт</button></div>
  <input type="file" id="imp-file" accept="application/json" class="hidden">
  <div class="btnrow"><button class="btn leaf" id="set-demo">🌱 Загрузить демо-данные</button><button class="btn danger" id="set-reset">Сбросить всё</button></div>
  <div class="btnrow"><button class="btn primary" id="set-install" style="display:none">📲 Установить приложение</button></div>
  ${ios?'<div class="note">iPhone/iPad: нажмите «Поделиться» → <b>«На экран Домой»</b>, чтобы установить ярлык.</div>':''}
 </div>
 <div class="muted" style="text-align:center;margin:18px 0">Питомник · Инвентаризация · MVP, этап 1</div>`}
function bindSettings(){
 const sv=()=>{settings.code=$('#set-code').value.trim();settings.device=$('#set-device').value.trim()||'Устройство';
  settings.sbUrl=$('#set-sburl').value.trim();settings.sbKey=$('#set-sbkey').value.trim();saveSettings();updHeader()};
 ['set-code','set-device','set-sburl','set-sbkey'].forEach(id=>$('#'+id).addEventListener('change',sv));
 $('#set-export').onclick=()=>{const data={settings,sites:state.sites,items:state.items,sales:state.sales,log:state.log,exportedAt:new Date().toISOString()};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'}));
  a.download='pitomnik-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();addLog('Экспорт','Выгружен JSON с данными')};
 $('#set-import').onclick=()=>$('#imp-file').click();
 $('#imp-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  try{const d=JSON.parse(await f.text());
   if(!confirm('Импорт заменит текущие данными из файла. Продолжить?'))return;
   for(const s of['sites','items','sales','log']){const all=await DB.all(s);for(const r of all)await DB.del(s,r.id)}
   state.sites=d.sites||[];state.items=d.items||[];state.sales=d.sales||[];state.log=d.log||[];
   await DB.bulk('sites',state.sites);await DB.bulk('items',state.items);await DB.bulk('sales',state.sales);await DB.bulk('log',state.log);
   if(d.settings)settings={...settings,...d.settings};saveSettings();addLog('Импорт','Данные загружены из JSON');toast('✓ Импорт завершён');updHeader();go('#/sites');refresh()}
  catch(err){toast('Файл не распознан','err')}};
 $('#set-demo').onclick=async()=>{if(state.items.length&&!confirm('Демо добавит примеры к текущим данным. Продолжить?'))return;await seedDemo();toast('✓ Демо-данные загружены');refresh();go('#/sites')};
 $('#set-reset').onclick=async()=>{if(!confirm('Удалить ВСЕ данные безвозвратно?'))return;
  for(const s of['sites','items','sales','log']){const all=await DB.all(s);for(const r of all)await DB.del(s,r.id)}
  state={sites:[],items:[],sales:[],log:[]};addLog('Система','Сброс данных');refresh();go('#/sites')};
 if(deferredPrompt)$('#set-install').style.display=''}

/* ---------- демо-данные ---------- */
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
 let n=state.items.length+1;
 for(const[site,name,variety,h,age,price,qty,c1,c2,e,cost]of demo){
  const it={id:uid(),siteId:site.id,name,variety,height:h,age,price,qty,barcode:'N'+String(n++).padStart(3,'0'),
   photo:demoPhoto(c1,c2,e),cost:{...cost,batchQty:qty||1},updatedAt:Date.now()};
  state.items.push(it);await DB.put('items',it)}
 addLog('Система','Загружены демо-данные')}

/* ---------- установка, сеть, старт ---------- */
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=$('#set-install');if(b)b.style.display=''});
$('#app').addEventListener('click',async e=>{if(e.target.closest('#set-install')&&deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;const b=$('#set-install');if(b)b.style.display='none'}});
function updHeader(){$('#hdr-code').textContent='код: '+(settings.code||'—');
 const net=$('#hdr-net');const on=navigator.onLine;net.classList.toggle('off',!on);net.querySelector('span').textContent=on?'онлайн':'офлайн'}
window.addEventListener('online',updHeader);window.addEventListener('offline',updHeader);
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

(async function init(){
 await DB.open();await loadAll();saveSettings();updHeader();
 if(!localStorage.getItem('pn-welcomed')){
  $('#modal-root').innerHTML=`<div class="backdrop"></div><div class="sheet"><div class="grab"></div>
   <h3 style="font-family:var(--fd);margin:0 0 6px">Добро пожаловать 🌿</h3>
   <div class="muted" style="margin-bottom:12px">Учёт растений, штрихкоды и продажи — прямо с телефона, работает без интернета.</div>
   <div class="field"><label>Код питомника</label><input id="w-code" placeholder="например, ROMASHKA"></div>
   <div class="field"><label>Имя устройства</label><input id="w-device" value="${esc(settings.device)}"></div>
   <div class="btnrow"><button class="btn primary big" id="w-go">Начать работу</button></div>
   <button class="btn ghost big" id="w-demo" style="margin-top:8px">🌱 Сразу с демо-данными</button></div>`;
  const done=async demo=>{settings.code=$('#w-code').value.trim();settings.device=$('#w-device').value.trim()||settings.device;saveSettings();updHeader();
   localStorage.setItem('pn-welcomed','1');closeSheet();if(demo){await seedDemo();refresh();go('#/sites')}};
  $('#w-go').onclick=()=>done(false);$('#w-demo').onclick=()=>done(true)}
 if(location.hash)route();else{history.replaceState(null,'','#/sites');route()}
})();