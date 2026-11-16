'use strict';
// Compact navigation reuses the original forms, keeping each category's draft in the DOM.
(()=>{
 const kinds={payments:'Bayaran Penulis',general:'Belanja Umum',asset:'Pembelian Aset',travel:'Perjalanan',helper:'Upah Pembantu'};
 const nav=document.querySelector('nav'); document.querySelector('.workspace').prepend(nav);nav.classList.add('finance-nav');
 nav.innerHTML='<button data-tab="overview" aria-current="page">01 <span>Ringkasan</span></button><button data-tab="people">02 <span>Penulis & Terbitan</span></button><button data-tab="records">03 <span>Rekod Belanja</span></button>';
 titles.people=['Penulis & terbitan.','Urus penulis, buku dan tuntutan sebelum merekod bayaran.'];
 titles.records=['Rekod belanja.','Semua kategori dalam satu senarai.'];
 const footer=document.querySelector('.app-footer');
 footer.insertAdjacentHTML('beforebegin',`<section class="panel" id="panel-people" hidden><label class="compact-selector">Pilihan<select id="people-category"><option value="writers">Penulis</option><option value="projects">Terbitan</option><option value="claims">Tuntutan Penulis</option></select></label><div id="people-content"></div></section><section class="panel" id="panel-records" hidden><div class="compact-toolbar"><button class="button primary" id="add-record">+ Tambah Rekod</button><span class="muted">Pilih kategori apabila menambah rekod baharu.</span></div><article class="card" id="record-composer" hidden><div class="card-heading"><h2>Tambah rekod</h2><button class="button ghost" id="close-composer">Tutup borang</button></div><label class="compact-selector">Kategori<select id="record-category">${Object.entries(kinds).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><p class="form-note">Input setiap kategori dikekalkan sementara halaman ini dibuka.</p><div id="category-forms"></div></article><article class="card"><form id="unified-search" class="record-tools"><input name="q" aria-label="Cari rekod" placeholder="Cari nama, rujukan atau butiran"><select name="category" aria-label="Tapis kategori"><option value="">Semua kategori</option>${Object.entries(kinds).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><select name="status" aria-label="Status rekod"><option value="active">Aktif</option><option value="archived">Arkib</option></select><button class="button secondary">Cari</button><button class="button ghost" type="reset">Reset</button></form><div id="unified-records"></div></article></section>`);
 for(const kind of ['writers','projects','claims']){
  const panel=get(`panel-${kind}`);panel.classList.remove('panel');get('people-content').append(panel);
 }
 for(const kind of Object.keys(kinds)){
  const panel=get(`panel-${kind}`),card=panel.querySelector('.work-grid > .card');
  card.classList.add('category-form');card.dataset.category=kind;card.hidden=true;get('category-forms').append(card);
  panel.hidden=true;
 }
 let query='',category='',archived=false;
 function people(kind){get('people-category').value=kind;for(const k of ['writers','projects','claims'])get(`panel-${k}`).hidden=k!==kind;}
 function choose(kind){get('record-category').value=kind;document.querySelectorAll('.category-form').forEach(card=>card.hidden=card.dataset.category!==kind);}
 window.compactNavigate=tab=>{
  if(['writers','projects','claims'].includes(tab)){people(tab);showTab('people');return true;}
  if(Object.hasOwn(kinds,tab)){choose(tab);get('record-composer').hidden=false;showTab('records');return true;}
  if(tab==='people')people(get('people-category').value);
  return false;
 };
 function unified(){
  if(!state)return;
  const rows=[...state.expenses.map(e=>({...e,listKind:e.kind})),...state.payments.map(p=>({...p,listKind:'payments',payee:p.claim.writer.name,description:p.claim.project.title}))].filter(r=>Boolean(r.archived)===archived&&(!category||r.listKind===category)&&(!query||JSON.stringify(r).toLowerCase().includes(query))).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));
  get('unified-records').innerHTML=rows.length?`<p class="muted">${rows.length} rekod</p><div class="table-scroll"><table class="detail-table compact-table"><thead><tr><th>Tarikh / Rujukan</th><th>Kategori / Penerima</th><th>Amaun</th><th>Tindakan</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}<br><span class="reference">${esc(r.reference)}</span>${r.voidedAt?'<br><span class="badge void">Dibatalkan</span>':''}</td><td><strong>${esc(kinds[r.listKind])}</strong><br>${esc(r.payee)}<br><span class="muted">${esc(r.description)}</span></td><td>${rm(r.amountCents)}</td><td>${r.listKind==='payments'?`<button class="button secondary" data-action="detail" data-kind="payments" data-id="${r.id}">Butiran & bukti</button>${!r.voidedAt?`<button class="button danger-button" data-action="void" data-id="${r.id}">Batalkan</button>`:''}<button class="button ghost" data-action="${r.archived?'restore':'archive'}" data-kind="payments" data-id="${r.id}">${r.archived?'Pulihkan':'Arkibkan'}</button>`:`<button class="button secondary" data-expense-action="detail" data-id="${r.id}">Butiran & bukti</button><button class="button ghost" data-expense-action="${r.archived?'restore':'archive'}" data-id="${r.id}">${r.archived?'Pulihkan':'Arkibkan'}</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><strong>Tiada rekod sepadan</strong>Cuba kategori atau carian lain.</div>';
 }
 const previous=window.renderExpenses;window.renderExpenses=()=>{previous();unified();};
 get('add-record').onclick=()=>{get('record-composer').hidden=false;get('record-category').focus();};
 get('close-composer').onclick=()=>get('record-composer').hidden=true;
 get('record-category').onchange=e=>choose(e.target.value);
 get('people-category').onchange=e=>people(e.target.value);
 get('unified-search').addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();const f=e.target;query=f.elements.q.value.trim().toLowerCase();category=f.elements.category.value;archived=f.elements.status.value==='archived';unified();});
 get('unified-search').addEventListener('reset',()=>{query='';category='';archived=false;setTimeout(unified,0);});
 // Optional fields collapse; required fields remain visible and validatable.
 document.querySelectorAll('.category-form form').forEach(form=>{
  const details=document.createElement('details');details.className='extra-fields';details.innerHTML='<summary>Butiran tambahan (pilihan)</summary>';
  for(const name of ['notes','model','serial','location','inUseDate','vehicle','invoiceRef']){
   const field=form.elements[name];if(!field)continue;
   const label=field.closest('label');details.append(label);
  }
  if(details.children.length>1)form.insertBefore(details,form.querySelector('button[type="submit"]'));
 });
 people('writers');choose('payments');unified();
})();
