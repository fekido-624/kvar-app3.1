'use strict';
(()=>{
const names={general:'Belanja Umum',asset:'Aset',travel:'Perjalanan',helper:'Upah Pembantu'};
const queries=Object.fromEntries(Object.keys(names).map(kind=>[kind,{q:'',archived:false}]));
Object.assign(titles,{general:['Belanja harian bisnes.','Rekod belian, resit dan sumber bayaran sebenar.'],asset:['Aset & peralatan.','Printer dan aset pejabat direkod berasingan daripada belanja operasi.'],travel:['Perjalanan bisnes.','Tujuan, laluan, jarak dan kos sebenar dengan bukti sokongan.'],helper:['Upah pembantu.','Catat kerja, kuantiti, kadar dan bayaran kepada penerima sebenar.']});
const portion=e=>Number((BigInt(e.amountCents)*BigInt(e.businessBps)+5000n)/10000n);
const refunded=e=>e.reimbursements.filter(r=>!r.voidedAt).reduce((sum,r)=>sum+r.amountCents,0);
const due=e=>!e.voidedAt&&e.paidBy==='owner'?portion(e)-refunded(e):0;
const input=(label,name,attrs='')=>`<label>${label}<input name="${name}" ${attrs}></label>`;
const select=(label,name,items)=>`<label>${label}<select name="${name}">${items.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></label>`;
const specific={
 general:select('Kategori','category',[['Alat tulis','Alat tulis / stationery'],['Ink & percetakan','Ink & percetakan'],['Bahan pembungkusan','Bahan pembungkusan'],['Petrol','Petrol (rujuk log perjalanan)'],['Makanan','Makanan (nyatakan penerima & tujuan)'],['Utiliti','Utiliti / langganan'],['Peribadi pemilik','Peribadi / ambilan pemilik'],['Lain-lain','Lain-lain']]),
 asset:input('Nama aset','assetName','required maxlength="200" placeholder="Contoh: printer"')+`<div class="pair">${input('Model','model','maxlength="100"')}${input('No. siri','serial','maxlength="100"')}</div>`+input('Lokasi aset','location','maxlength="200"')+input('Tarikh mula digunakan','inUseDate','type="date"')+'<p class="form-note">Tiada susut nilai / elaun modal automatik. Invois belian dan bukti bayaran boleh dilampirkan selepas simpan.</p>',
 travel:`<div class="pair">${input('Dari','from','required maxlength="200"')}${input('Ke','to','required maxlength="200"')}</div><div class="pair">${input('Jarak perjalanan ini (km)','distance','required inputmode="decimal" placeholder="0.00"')}${input('Kenderaan / no. pendaftaran','vehicle','maxlength="100"')}</div><label>Asas amaun / pecahan kos<textarea name="costBasis" required maxlength="700" rows="2" placeholder="Contoh: tol, parking dan petrol berkaitan. Tiada kadar per km ditetapkan sistem."></textarea></label>`,
 helper:`<div class="pair">${input('Kerja dari','periodFrom','type="date" required data-today')}${input('Hingga','periodTo','type="date" required data-today')}</div><div class="pair">${input('Kuantiti kerja','quantity','required inputmode="decimal" value="1"')}${select('Unit','unit',[['hari','Hari'],['jam','Jam'],['tugasan','Tugasan'],['bungkus','Bungkus']])}</div>`+input('Kadar seunit (RM)','rate','required inputmode="decimal" placeholder="0.00"')+select('Status hubungan kerja — untuk semakan','workerStatus',[['belum-disemak','Belum disemak'],['pekerja','Pekerja'],['bebas','Penyedia perkhidmatan bebas']])+'<p class="form-note">Label ini bukan penentuan undang-undang. Kewajipan penggajian / caruman perlu disemak jika penerima ialah pekerja.</p>'
};
const nav=document.querySelector('nav');
Object.entries(names).forEach(([kind,label],i)=>nav.insertAdjacentHTML('beforeend',`<button data-tab="${kind}">0${i+6} <span>${label}</span></button>`));
const footer=document.querySelector('.app-footer');
for(const [kind,label]of Object.entries(names)){
 footer.insertAdjacentHTML('beforebegin',`<section id="panel-${kind}" class="panel" hidden><div class="work-grid"><article class="card"><h2>${label} baharu</h2><p class="muted">Satu transaksi sebenar, satu rekod belanja.</p><form data-expense-kind="${kind}" id="expense-${kind}"><div class="pair">${input('Tarikh transaksi','date','type="date" required data-today')}${input(kind==='helper'?'Nama pembantu':'Penerima / pembekal','payee','required maxlength="160"')}</div><label>${kind==='helper'?'Kerja dilaksanakan':kind==='travel'?'Tujuan perjalanan':'Butiran / tujuan bisnes'}<textarea name="description" rows="2" required maxlength="1500"></textarea></label>${specific[kind]}<div class="pair">${input('Jumlah transaksi sebenar (RM)','amount',`required inputmode="decimal" placeholder="0.00" ${kind==='helper'?'readonly':''}`)}${input('Bahagian perniagaan (%)','businessPercent','required inputmode="decimal" value="100"')}</div><p class="form-note">Peribadi sepenuhnya: 0%. Campuran: masukkan bahagian bisnes yang boleh disokong. Ini bukan kelulusan potongan cukai.</p>${select('Sumber wang','paidBy',[['business','Akaun / tunai bisnes'],['owner','Pemilik dahulukan wang peribadi']])}<div class="pair">${select('Cara bayaran','method',[['bank','Pindahan bank'],['tunai','Tunai'],['ewallet','E-wallet']])}${input('Rujukan transaksi','transactionRef','maxlength="150"')}</div><div class="pair">${select('Resit / invois','receiptStatus',[['ada','Ada — lampirkan selepas simpan'],['tiada','Tiada resit']])}${input('No. resit / invois','invoiceRef','maxlength="100"')}</div><label>Sebab tiada resit (wajib jika tiada)<textarea name="noReceiptReason" maxlength="700" rows="2"></textarea></label><label>Catatan / penerima makanan jika berkenaan<textarea name="notes" maxlength="1500" rows="2"></textarea></label><p class="balance-note" data-expense-preview="${kind}">Isi amaun untuk melihat pecahan.</p><button class="button primary" type="submit">Simpan ${label.toLowerCase()}</button><button class="button ghost" type="reset">Kosongkan</button></form></article><article class="card" data-expense-list="${kind}"></article></div></section>`);
 defaults(get(`expense-${kind}`));
}
document.querySelector('.topbar>div').insertAdjacentHTML('beforeend','<a class="text-link" href="/api/kewangan/api/export-expenses.csv">CSV belanja</a>');
document.querySelector('a[href="/api/kewangan/api/export.csv"]').textContent='CSV penulis';
get('panel-overview').insertAdjacentHTML('beforeend','<h2 class="expense-summary-heading">Belanja selain penulis</h2><div class="stats" id="expense-stats"></div><p class="form-note">Bahagian perniagaan bukan potongan cukai yang diluluskan. Aset diasingkan daripada operasi. Bayaran balik pemilik tidak menambah kos asal.</p>');
document.body.insertAdjacentHTML('beforeend',`<dialog id="expense-dialog"><div class="dialog-heading"><h2>Butiran belanja & bukti</h2><button class="icon-button close-dialog" aria-label="Tutup belanja">×</button></div><div id="expense-detail"></div><form id="expense-evidence"><input name="ownerType" type="hidden" value="expenses"><input name="ownerId" type="hidden"><label>Lampirkan PDF / PNG / JPEG maksimum 5 MB<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required></label><button class="button primary">Simpan bukti</button></form><div id="reimburse-section"><h3>Bayar balik pendahuluan pemilik</h3><form id="reimbursement-form"><input name="expenseId" type="hidden"><div class="pair">${input('Tarikh bayaran balik','date','type="date" required data-today')}${input('Amaun bayaran balik (RM)','amount','required inputmode="decimal"')}</div>${input('Rujukan transaksi bayaran balik','transactionRef','required maxlength="150"')}<label>Catatan<textarea name="notes" maxlength="700" rows="2"></textarea></label><button class="button primary">Rekod bayaran balik</button></form></div></dialog>`);
function list(kind){
 const filter=queries[kind],q=filter.q.toLowerCase();const rows=state.expenses.filter(e=>e.kind===kind&&e.archived===filter.archived&&(!q||JSON.stringify(e).toLowerCase().includes(q))).slice().reverse();
 document.querySelector(`[data-expense-list="${kind}"]`).innerHTML=`<div class="record-heading"><h2>Rekod ${names[kind].toLowerCase()}</h2><span class="chip">${rows.length} REKOD</span></div><form class="record-tools" data-expense-search="${kind}"><input name="q" aria-label="Cari ${names[kind]}" value="${esc(filter.q)}" placeholder="Rujukan, pembekal atau butiran"><button class="button secondary">Cari</button><button type="button" class="button ghost" data-expense-action="reset-search" data-kind="${kind}">Reset</button></form><div class="record-actions"><button class="button ${filter.archived?'secondary':'primary'}" data-expense-action="active" data-kind="${kind}">Aktif</button><button class="button ${filter.archived?'primary':'secondary'}" data-expense-action="archived" data-kind="${kind}">Arkib</button></div>${rows.length?rows.map(e=>`<div class="record-item"><div class="row-top"><div><span class="reference">${esc(e.reference)} · ${esc(e.date)}</span><h3>${esc(e.kind==='asset'?e.asset.name:e.payee)}${e.voidedAt?'<span class="badge void">Dibatalkan</span>':''}</h3><p>${esc(e.description)}</p><p>Bahagian bisnes ${rm(portion(e))} / ${(e.businessBps/100).toFixed(2)}% · ${e.paidBy==='owner'?'Didahulukan pemilik':'Akaun bisnes'}</p><p>${e.receiptStatus==='tiada'?'Tanpa resit':`Resit: ${state.evidence.some(f=>f.ownerId===e.id)?'bukti dilampirkan':'belum dilampirkan'}`}${e.paidBy==='owner'?` · Baki pemilik ${rm(due(e))}`:''}</p></div><strong class="total">${rm(e.amountCents)}</strong></div><div class="record-actions"><button class="button secondary" data-expense-action="detail" data-id="${e.id}">Butiran & bukti</button>${docLink('expense',e.id,'Borang A4')}${e.receiptStatus==='tiada'?docLink('no-receipt',e.id,'Catatan tanpa resit'):''}<button class="button ghost" data-expense-action="${e.archived?'restore':'archive'}" data-id="${e.id}">${e.archived?'Pulihkan':'Arkibkan'}</button>${!e.voidedAt?`<button class="button danger-button" data-expense-action="void" data-id="${e.id}">Batalkan</button>`:''}</div></div>`).join(''):'<div class="empty"><strong>Tiada rekod sepadan</strong>Isi borang untuk mula merekod.</div>'}`;
}
window.renderExpenses=()=>{
 for(const kind of Object.keys(names))list(kind);
 const totals=state.expenseTotals;
 const writerCash=state.payments.filter(p=>!p.voidedAt).reduce((sum,p)=>sum+p.amountCents,0);
 get('expense-stats').innerHTML=[['Belanja operasi (bahagian bisnes)',totals.operatingCents,'Selain penulis; tidak termasuk aset'],['Aset (bahagian bisnes)',totals.assetCents,'Tiada elaun modal automatik'],['Baki didahulukan pemilik',totals.ownerOutstandingCents,'Belum dibayar balik'],['Wang keluar akaun bisnes',totals.cashOutCents+writerCash,'Penulis + belanja + bayaran balik']].map(([label,value,note])=>`<article class="stat"><p>${label}</p><strong>${rm(value)}</strong><small>${note}</small></article>`).join('');
};
function detail(id){
 const e=state.expenses.find(e=>e.id===id),evidence=state.evidence.filter(f=>f.ownerId===id);
 const rows=[['Rujukan',e.reference],['Penerima',e.payee],['Butiran',e.description],['Amaun penuh',rm(e.amountCents)],['Bahagian bisnes',`${rm(portion(e))} / ${(e.businessBps/100).toFixed(2)}%`],['Bahagian peribadi',rm(e.amountCents-portion(e))],['Dibayar oleh',e.paidBy==='owner'?'Pemilik (wang peribadi)':'Akaun bisnes'],['Resit',e.receiptStatus],['Sebab tiada resit',e.noReceiptReason],['Semakan cukai',e.taxReview],['Pembatalan',e.voidedAt?e.voidReason:'Tidak dibatalkan']];
 if(e.asset)rows.push(['Aset',`${e.asset.name} / ${e.asset.model} / ${e.asset.serial}`],['Lokasi / mula guna',`${e.asset.location} / ${e.asset.inUseDate}`]);
 if(e.travel)rows.push(['Laluan',`${e.travel.from} → ${e.travel.to}`],['Jarak',`${(e.travel.kmHundredths/100).toFixed(2)} km`],['Asas amaun',e.travel.costBasis]);
 if(e.helper)rows.push(['Kiraan upah',`${(e.helper.quantityHundredths/100).toFixed(2)} ${e.helper.unit} × ${rm(e.helper.rateCents)}`],['Tempoh',`${e.helper.periodFrom} hingga ${e.helper.periodTo}`],['Status untuk semakan',e.helper.workerStatus]);
 get('expense-detail').innerHTML=`<div class="record-actions">${docLink('expense',id,'Pratonton A4')}${e.receiptStatus==='tiada'?docLink('no-receipt',id,'Catatan tanpa resit'):''}</div><table class="detail-table">${rows.map(([label,value])=>`<tr><th>${esc(label)}</th><td>${esc(value||'—')}</td></tr>`).join('')}</table><h3>Lampiran (${evidence.length})</h3>${evidence.map(f=>`<a class="evidence-link" href="/api/kewangan/api/evidence/${f.id}">${esc(f.name)}</a>`).join('')||'<p class="muted">Belum dilampirkan.</p>'}${e.paidBy==='owner'?`<h3>Bayaran balik · Baki ${rm(due(e))}</h3>${e.reimbursements.map(r=>`<div class="record-item"><strong>${esc(r.reference)} · ${rm(r.amountCents)}</strong><p>${esc(r.date)} · ${esc(r.transactionRef)} ${r.voidedAt?'· Dibatalkan':''}</p>${!r.voidedAt?`<button class="button danger-button" data-expense-action="void-reimbursement" data-id="${e.id}" data-reimbursement="${r.id}">Batalkan bayaran balik</button>`:''}</div>`).join('')||'<p class="muted">Belum ada bayaran balik.</p>'}`:''}`;
 get('expense-evidence').elements.ownerId.value=id;get('expense-evidence').elements.file.value='';
 get('reimburse-section').hidden=e.paidBy!=='owner'||e.voidedAt||e.archived||due(e)<=0;
 get('reimbursement-form').elements.expenseId.value=id;defaults(get('reimbursement-form'));
 if(!get('expense-dialog').open)get('expense-dialog').showModal();
}
function preview(form){
 const amount=Math.round(Number(form.elements.amount.value)*100),percent=Number(form.elements.businessPercent.value);
 const node=document.querySelector(`[data-expense-preview="${form.dataset.expenseKind}"]`);
 node.textContent=Number.isFinite(amount)&&amount>0&&percent>=0&&percent<=100?`Bahagian bisnes: ${rm(Math.round(amount*percent/100))}. Peribadi: ${rm(amount-Math.round(amount*percent/100))}. Untuk semakan accountant.`:'Isi amaun dan peratus perniagaan yang sah.';
}
document.addEventListener('input',event=>{
 const form=event.target.closest('form[data-expense-kind]');if(!form)return;
 if(form.dataset.expenseKind==='helper'&&['quantity','rate'].includes(event.target.name)){
  const q=form.elements.quantity.value,r=form.elements.rate.value;
  if(/^\d+(\.\d{1,2})?$/.test(q)&&/^\d+(\.\d{1,2})?$/.test(r)){
   const hundredths=value=>{const [w,f='']=value.split('.');return BigInt(w)*100n+BigInt(f.padEnd(2,'0'));};
   const cents=(hundredths(q)*hundredths(r)+50n)/100n;form.elements.amount.value=(Number(cents)/100).toFixed(2);
  }else form.elements.amount.value='';
 }
 preview(form);
});
document.addEventListener('change',event=>{
 const form=event.target.closest('form[data-expense-kind]');if(form&&event.target.name==='category'&&event.target.value==='Peribadi pemilik'){form.elements.businessPercent.value='0';preview(form);}
});
document.addEventListener('reset',event=>{if(event.target.dataset.expenseKind)setTimeout(()=>{defaults(event.target);preview(event.target);},0);});
document.addEventListener('submit',async event=>{
 const form=event.target;if(form.dataset.expenseSearch){event.preventDefault();queries[form.dataset.expenseSearch].q=form.elements.q.value.trim();list(form.dataset.expenseSearch);return;}
 if(!form.dataset.expenseKind&&form.id!=='reimbursement-form')return;event.preventDefault();
 await busy(form,async()=>{
  const input=Object.fromEntries(new FormData(form));let row;
  if(form.dataset.expenseKind){
   input.kind=form.dataset.expenseKind;if(input.kind!=='general')input.category=names[input.kind];input.task=input.description;input.purpose=input.description;
   row=await request('/api/kewangan/api/expenses','POST',input);form.reset();defaults(form);preview(form);
  }else row=await request(`/api/kewangan/api/expenses/${input.expenseId}`,'PATCH',{...input,action:'reimburse'});
  await load();detail(row.id);notify('Rekod disimpan · '+row.reference+'.');
 });
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-expense-action]');if(!button)return;
 const action=button.dataset.expenseAction,id=button.dataset.id,kind=button.dataset.kind;
 if(action==='reset-search'){queries[kind].q='';list(kind);return;}
 if(action==='active'||action==='archived'){queries[kind].archived=action==='archived';list(kind);return;}
 if(action==='detail'){detail(id);return;}
 try{
  const input={action};
  if(action==='void'||action==='void-reimbursement'){
   const reason=prompt('Sebab pembatalan (rekod asal dikekalkan):');if(reason===null)return;if(!reason.trim())throw new Error('Sebab pembatalan diperlukan.');
   if(!confirm('Sahkan pembatalan rekod ini?'))return;input.reason=reason;input.reimbursementId=button.dataset.reimbursement;
  }
  button.disabled=true;await request(`/api/kewangan/api/expenses/${id}`,'PATCH',input);await load();if(get('expense-dialog').open)detail(id);notify('Rekod dikemas kini.');
 }catch(error){notify(error.message,true);button.disabled=false;}
});
// Reuse the existing evidence uploader without adding a second expense or cost.
get('expense-evidence').addEventListener('submit',async event=>{
 event.preventDefault();event.stopPropagation();const form=event.target;
 await busy(form,async()=>{
  const file=form.elements.file.files[0];if(!file||file.size>5*1024*1024)throw new Error('Pilih PDF / PNG / JPEG maksimum 5 MB.');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Fail gagal dibaca.'));reader.readAsDataURL(file);});
  const id=form.elements.ownerId.value;await request('/api/kewangan/api/evidence','POST',{ownerType:'expenses',ownerId:id,name:file.name,data});await load();detail(id);notify('Bukti belanja dilampirkan.');
 });
});
if(typeof state!=='undefined'&&state)window.renderExpenses(state);
})();

