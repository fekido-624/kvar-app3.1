'use strict';
let state;
let activeTab = 'overview';
const filters = Object.fromEntries(['writers','projects','claims','payments'].map(kind => [kind, { query: '', archived: false }]));
const titles = { overview: ['Rekod yang tersusun.<br>Bayaran yang jelas.', 'Rekod penulis, belanja harian, aset, perjalanan dan upah dalam satu modul.'], writers: ['Penulis & penerima.', 'Maklumat penulis bebas untuk setiap terbitan.'], projects: ['Terbitan & manuskrip.', 'Rekodkan skop kerja, fi dan tarikh penerimaan.'], claims: ['Tuntutan yang jelas.', 'Sediakan draf tuntutan untuk semakan penulis.'], payments: ['Bayaran & baucar.', 'Rekod bayaran sebenar, baki tuntutan dan bukti pembayaran.'] };
const labels = { writers: 'penulis', projects: 'terbitan', claims: 'tuntutan', payments: 'bayaran' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rm = cents => `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const get = id => document.getElementById(id);
const today = () => new Intl.DateTimeFormat('en-CA', { year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Kuala_Lumpur' }).format(new Date());
function defaults(form) { form.querySelectorAll('[data-today]').forEach(input => input.value = today()); }
function notify(message, error = false) {
  const box = get('message'); box.hidden = false; box.className = error ? 'error' : ''; box.textContent = message;
  const dialog = document.querySelector('dialog[open]');
  if (dialog && error) { let alert = dialog.querySelector('.dialog-error'); if (!alert) { alert = document.createElement('p'); alert.className = 'dialog-error'; alert.setAttribute('role','alert'); dialog.prepend(alert); } alert.textContent = message; }
  else box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function request(route, method = 'GET', data) {
  const response = await fetch(route, { method, headers: { 'Content-Type':'application/json' }, ...(data === undefined ? {} : { body:JSON.stringify(data) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Permintaan gagal.');
  return result;
}
const remaining = id => state.claims.find(c => c.id === id).amountCents - state.payments.filter(p => p.claimId === id && !p.voidedAt).reduce((sum,p) => sum + p.amountCents, 0);
function showTab(tab) {
  if(window.compactNavigate && window.compactNavigate(tab))return;
  if (!titles[tab]) return;
  activeTab = tab;
  document.querySelectorAll('.panel').forEach(panel => panel.hidden = panel.id !== `panel-${tab}`);
  document.querySelectorAll('nav [data-tab]').forEach(button => button.getAttribute('data-tab') === tab ? button.setAttribute('aria-current','page') : button.removeAttribute('aria-current'));
  get('page-title').innerHTML = titles[tab][0]; get('page-subtitle').textContent = titles[tab][1];
}
function updateSelects() {
  document.querySelectorAll('[data-options]').forEach(select => {
    const previous = select.value;
    const kind = select.dataset.options;
    const rows = state[kind].filter(row => !row.archived && (kind !== 'claims' || remaining(row.id) > 0));
    select.innerHTML = `<option value="">Pilih ${labels[kind]}…</option>` + rows.map(row => {
      let label = row.name;
      if (kind === 'projects') label = `${row.title} · ${state.writers.find(w => w.id === row.writerId)?.name || ''}`;
      if (kind === 'claims') label = `${row.reference} · ${row.writer.name} · baki ${rm(remaining(row.id))}`;
      return `<option value="${row.id}">${esc(label)}</option>`;
    }).join('');
    if (rows.some(row => row.id === previous)) select.value = previous;
  });
  updateBalance();
}
function updateBalance() {
  const id = get('form-payments').elements.claimId.value;
  get('payment-balance').textContent = id ? `Baki belum dibayar: ${rm(remaining(id))}` : 'Pilih tuntutan untuk melihat baki.';
}
function docLink(type, id, title) { return `<a class="button secondary" target="_blank" rel="noopener" href="/api/kewangan/documents/${type}/${id}">${title} ↗</a>`; }
function rowHtml(kind, row) {
  let title, summary, reference = '', amount = '', badge = row.archived ? '<span class="badge">Arkib</span>' : '';
  let extra = '';
  if (kind === 'writers') { title = row.name; summary = [row.phone,row.email].filter(Boolean).join(' · ') || 'Tiada maklumat hubungan'; extra = `<button class="button secondary" data-action="edit-writer" data-id="${row.id}">Sunting profil</button>`; }
  if (kind === 'projects') { title = row.title; summary = `${state.writers.find(w => w.id === row.writerId)?.name || ''} · ${row.edition || 'Edisi belum diisi'}`; amount = rm(row.agreedCents); reference = row.feeType === 'royalti' ? 'Royalti · amaun rujukan manual' : 'Fi dipersetujui'; }
  if (kind === 'claims') {
    title = row.project.title; summary = `${row.writer.name} · ${row.period || 'Peringkat belum diisi'}`; reference = `${row.reference} · ${row.date}`; amount = rm(row.amountCents);
    badge += remaining(row.id) === 0 ? '<span class="badge paid">Selesai dibayar</span>' : `<span class="badge">Baki ${rm(remaining(row.id))}</span>`;
    extra = docLink('claim', row.id, 'Draf tuntutan');
  }
  if (kind === 'payments') {
    title = row.claim.writer.name; summary = `${row.claim.project.title} · ${row.method}`; reference = `${row.reference} · ${row.date}`; amount = rm(row.amountCents);
    badge += row.voidedAt ? '<span class="badge void">Dibatalkan</span>' : '<span class="badge paid">Bayaran direkod</span>';
    extra = docLink('voucher',row.id,'Baucar A4') + docLink('ack',row.id,'Akuan penerimaan');
    if (!row.voidedAt) extra += `<button class="button danger-button" data-action="void" data-id="${row.id}">Batalkan bayaran</button>`;
  }
  return `<div class="record-item"><div class="row-top"><div><span class="reference">${esc(reference)}</span><h3>${esc(title)}${badge}</h3><p>${esc(summary)}</p></div><span class="total">${amount}</span></div><div class="record-actions"><button class="button secondary" data-action="detail" data-kind="${kind}" data-id="${row.id}">Butiran & bukti</button>${extra}<button class="button ghost" data-action="${row.archived ? 'restore':'archive'}" data-kind="${kind}" data-id="${row.id}">${row.archived ? 'Pulihkan':'Arkibkan'}</button></div></div>`;
}
function renderList(kind) {
  const target = document.querySelector(`[data-list="${kind}"]`);
  const filter = filters[kind];
  const q = filter.query.toLocaleLowerCase();
  const rows = state[kind].filter(row => Boolean(row.archived) === filter.archived && (!q || JSON.stringify(row).toLocaleLowerCase().includes(q))).slice().reverse();
  target.innerHTML = `<div class="record-heading"><h2>Rekod ${labels[kind]}</h2><span class="chip">${rows.length} REKOD</span></div><form class="record-tools" data-search="${kind}"><input name="q" value="${esc(filter.query)}" aria-label="Cari ${labels[kind]}" placeholder="Cari nama, rujukan atau terbitan"><button class="button secondary" type="submit">Cari</button><button class="button ghost" type="button" data-action="reset-search" data-kind="${kind}">Reset</button></form><div class="record-actions"><button class="button ${!filter.archived ? 'primary':'secondary'}" data-action="show-active" data-kind="${kind}">Aktif</button><button class="button ${filter.archived ? 'primary':'secondary'}" data-action="show-archive" data-kind="${kind}">Arkib</button></div>${rows.length ? rows.map(row => rowHtml(kind,row)).join('') : `<div class="empty"><strong>${filter.query ? 'Tiada padanan' : 'Belum ada rekod di sini'}</strong>${filter.query ? 'Cuba kata carian lain.' : `Isi borang untuk tambah ${labels[kind]} pertama.`}</div>`}`;
}
function render() {
  get('business-name').textContent = state.business.name;
  const validPayments = state.payments.filter(p => !p.voidedAt);
  const totalClaims = state.claims.reduce((sum,c) => sum+c.amountCents,0);
  const totalPayments = validPayments.reduce((sum,p) => sum+p.amountCents,0);
  get('stats').innerHTML = [
    ['Penulis aktif',state.writers.filter(w => !w.archived).length,'Penyedia perkhidmatan penulisan'],
    ['Tuntutan penulis',rm(totalClaims),`${state.claims.length} rekod termasuk arkib`],
    ['Bayaran penulis',rm(totalPayments),`${validPayments.length} bayaran sah dalam rekod`],
    ['Baki penulis',rm(totalClaims-totalPayments),'Tuntutan tolak bayaran tidak dibatalkan'],
  ].map(([label,value,note])=>`<article class="stat"><p>${label}</p><strong>${value}</strong><small>${note}</small></article>`).join('');
  get('recent-payments').innerHTML = state.payments.length ? state.payments.slice(-4).reverse().map(p=>rowHtml('payments',p)).join('') : '<div class="empty"><strong>Belum ada bayaran</strong>Baucar akan muncul selepas bayaran pertama direkod.</div>';
  for (const kind of Object.keys(filters)) renderList(kind);
  updateSelects();
  if(window.renderExpenses)window.renderExpenses(state);
}
async function load() { state = await request('/api/kewangan/api/state'); render(); }
function detail(kind,id) {
  const row = state[kind].find(r=>r.id===id);
  const fields = kind === 'writers' ? [['Nama',row.name],['Telefon',row.phone],['E-mel',row.email],['Alamat',row.address],['Bank / akaun',`${row.bank} ${row.account}`],['Catatan',row.notes]] : kind === 'projects' ? [['Judul',row.title],['Penulis',state.writers.find(w=>w.id===row.writerId)?.name],['Edisi',row.edition],['Fi / amaun rujukan',rm(row.agreedCents)],['Skop',row.scope],['Asas royalti',row.royaltyTerms],['Tarikh sasaran',row.dueDate],['Manuskrip diterima',row.acceptedDate],['Rujukan hak / perjanjian',row.rightsNotes]] : kind === 'claims' ? [['Rujukan',row.reference],['Penulis',row.writer.name],['Terbitan',row.project.title],['Butiran',row.description],['Peringkat',row.period],['Jumlah',rm(row.amountCents)],['Baki',rm(remaining(id))],['Tarikh',row.date]] : [['Rujukan',row.reference],['Penulis',row.claim.writer.name],['Terbitan',row.claim.project.title],['Tuntutan',row.claim.reference],['Jumlah bayaran',rm(row.amountCents)],['Tarikh',row.date],['Cara',row.method],['Transaksi',row.transactionRef],['Catatan',row.notes],['Pembatalan',row.voidedAt ? `${row.voidedAt}\n${row.voidReason}` : 'Tidak dibatalkan']];
  const evidence = state.evidence.filter(e=>e.ownerId===id);
  const documents = kind === 'claims' ? docLink('claim',id,'Pratonton draf tuntutan') : kind === 'payments' ? docLink('voucher',id,'Pratonton baucar A4') + docLink('ack',id,'Akuan penerimaan') : '';
  get('detail-content').innerHTML = `${documents ? `<div class="record-actions">${documents}</div>` : ''}<table class="detail-table">${fields.map(([key,value])=>`<tr><th>${esc(key)}</th><td>${esc(value||'—')}</td></tr>`).join('')}</table><h3>Lampiran (${evidence.length})</h3>${evidence.length ? evidence.map(e=>`<a class="evidence-link" href="/api/kewangan/api/evidence/${e.id}">↓ ${esc(e.name)} · ${Math.ceil(e.size/1024)} KB</a>`).join('') : '<p class="muted">Tiada bukti dilampirkan.</p>'}`;
  const form = get('evidence-form'); form.hidden = !['claims','payments'].includes(kind); form.elements.ownerType.value=kind;form.elements.ownerId.value=id;form.elements.file.value='';
  get('detail-dialog').showModal();
}
async function busy(form, action) {
  const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
  try { await action(); } catch(error) { notify(error.message,true); } finally { buttons.forEach(b=>b.disabled=false); }
}
document.addEventListener('submit', async event => {
  if(event.target.dataset.expenseKind || event.target.dataset.expenseSearch || event.target.id==='reimbursement-form')return;
  event.preventDefault(); const form=event.target;
  if(form.dataset.search) {filters[form.dataset.search].query=form.elements.q.value.trim();renderList(form.dataset.search);return;}
  await busy(form,async()=>{
    if(form.dataset.kind){
      const kind=form.dataset.kind; const input=Object.fromEntries(new FormData(form));const editId=input.editId;
      const row=await request(editId?`/api/kewangan/api/writers/${editId}`:`/api/kewangan/api/${kind}`,editId?'PATCH':'POST',editId?{...input,action:'edit'}:input);
      form.reset();defaults(form);get('writer-form-title').textContent='Penulis baharu';await load();
      notify(`${labels[kind][0].toUpperCase()+labels[kind].slice(1)} disimpan${row.reference?' · '+row.reference:''}.`);
      if(kind==='payments'||kind==='claims')detail(kind,row.id);
    }else if(form.id==='business-form'){
      await request('/api/kewangan/api/business','PATCH',Object.fromEntries(new FormData(form)));get('business-dialog').close();await load();notify('Maklumat perniagaan dikemas kini untuk dokumen baharu.');
    }else if(form.id==='evidence-form'){
      const file=form.elements.file.files[0];if(!file||file.size>5*1024*1024)throw new Error('Pilih satu fail PDF / PNG / JPEG maksimum 5 MB.');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Fail gagal dibaca.'));reader.readAsDataURL(file);});
      const kind=form.elements.ownerType.value,id=form.elements.ownerId.value;
      await request('/api/kewangan/api/evidence','POST',{ownerType:kind,ownerId:id,name:file.name,data});await load();get('detail-dialog').close();detail(kind,id);notify('Bukti dilampirkan dan akan disertakan dalam sandaran.');
    }
  });
});
document.addEventListener('click', async event=>{
  const target=event.target.closest('button, [data-tab]');if(!target)return;
  if(target.dataset.tab){showTab(target.dataset.tab);return;}
  if(target.classList.contains('close-dialog')){target.closest('dialog').close();return;}
  if(target.classList.contains('reset-form')){target.closest('form').reset();get('writer-form-title').textContent='Penulis baharu';return;}
  const action=target.dataset.action,kind=target.dataset.kind,id=target.dataset.id;
  if(!action)return;
  try{
    if(action==='reset-search'){filters[kind].query='';renderList(kind);}
    else if(action==='show-active'||action==='show-archive'){filters[kind].archived=action==='show-archive';renderList(kind);}
    else if(action==='detail')detail(kind,id);
    else if(action==='edit-writer'){
      const row=state.writers.find(w=>w.id===id),form=get('form-writers');
      for(const key of ['name','phone','email','address','bank','account','notes'])form.elements[key].value=row[key];
      form.elements.editId.value=id;get('writer-form-title').textContent='Sunting profil penulis';showTab('writers');form.scrollIntoView({behavior:'smooth'});
    }else if(action==='archive'||action==='restore'){target.disabled=true;await request(`/api/kewangan/api/${kind}/${id}`,'PATCH',{action});await load();notify(action==='archive'?'Rekod diarkibkan. Dokumen dan bukti dikekalkan.':'Rekod dipulihkan.');}
    else if(action==='void'){
      const reason=prompt('Sebab pembatalan bayaran (wajib). Rekod dan bukti akan dikekalkan:');if(reason===null)return;if(!reason.trim())throw new Error('Sebab pembatalan diperlukan.');
      if(!confirm('Batalkan bayaran ini dan buka semula baki tuntutan?'))return;
      await request(`/api/kewangan/api/payments/${id}`,'PATCH',{action:'void',reason});await load();notify('Bayaran dibatalkan dengan sebab. Baki tuntutan telah dikemas kini.');
    }
  }catch(error){notify(error.message,true);target.disabled=false;}
});
get('form-payments').elements.claimId.addEventListener('change',updateBalance);
function openBusiness(){const form=get('business-form');for(const [key,value]of Object.entries(state.business))if(form.elements[key])form.elements[key].value=value;get('business-dialog').showModal();}
get('business-open')?.addEventListener('click',openBusiness);
get('business-open-top').addEventListener('click',openBusiness);
get('restore-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>30*1024*1024)throw new Error('Sandaran maksimum 30 MB.');const data=JSON.parse(await file.text());if(!confirm('Pulihkan sandaran kewangan? Rekod kewangan semasa akan digantikan. Rekod tempahan KVar tidak terjejas. Salinan sebelum pemulihan disimpan automatik dalam folder data.'))return;await request('/api/kewangan/api/restore','POST',data);await load();notify('Sandaran dan lampiran berjaya dipulihkan.');}catch(error){notify(error.message,true);}finally{event.target.value='';}
});
document.querySelectorAll('form').forEach(defaults);
load().catch(error=>notify('Gagal memuatkan data: '+error.message,true));
