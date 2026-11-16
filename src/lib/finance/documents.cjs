'use strict';
const { find } = require('./domain.cjs');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rm = cents => `RM ${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function documentHtml(state, id, type) {
  const isClaim = type === 'claim';
  if (!['claim', 'voucher', 'ack'].includes(type)) throw new Error('Jenis dokumen tidak sah.');
  const payment = isClaim ? null : find(state, 'payments', id);
  const claim = isClaim ? find(state, 'claims', id) : payment.claim;
  const business = claim.business;
  const writer = claim.writer;
  const project = claim.project;
  const reference = isClaim ? claim.reference : payment.reference;
  const title = isClaim ? 'Draf tuntutan bayaran penulisan' : type === 'ack' ? 'Akuan penerimaan bayaran' : 'Baucar bayaran';
  const warnings = payment?.voidedAt ? `DIBATALKAN — ${payment.voidReason}` : isClaim ? 'DRAF — Untuk semakan dan pengesahan penulis. Bukan invois penulis yang telah disahkan.' : type === 'ack' ? 'BELUM DISAHKAN — Ruang penerimaan mesti diisi oleh penerima sebenar.' : 'Rekod bayaran dalaman. Lampirkan bukti pembayaran.';
  const row = (label, value) => `<tr><th>${esc(label)}</th><td>${esc(value || '—')}</td></tr>`;
  const attachments = state.evidence.filter(e => e.ownerId === id);
  return `<!doctype html><html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(reference)} — ${esc(title)}</title><link rel="stylesheet" href="/api/kewangan/print.css"></head><body>
    <div class="print-toolbar"><a href="/kewangan">← Kembali ke rekod</a><button id="print-document">Cetak / Simpan PDF</button><span>Pilih A4 · skala 100% · matikan header/footer browser.</span></div>
    <main class="paper"><header><div><p class="eyebrow">IZOTECH · REKOD PENULIS</p><h1>${esc(business.name)}</h1><p>${esc(business.registration || 'No. pendaftaran belum diisi')}</p><p class="multiline">${esc(business.address)}</p><p>${esc(business.phone)}</p></div><div class="reference"><strong>${esc(reference)}</strong><p>${esc(isClaim ? claim.date : payment.date)}</p></div></header>
    <h2>${esc(title)}</h2><p class="notice ${payment?.voidedAt ? 'danger' : ''}">${esc(warnings)}</p>
    <table class="details">${row('Nama penulis', writer.name)}${row('Alamat', writer.address)}${row('Telefon / e-mel', [writer.phone, writer.email].filter(Boolean).join(' / '))}${row('Buku / terbitan', project.title)}${row('Edisi', project.edition)}${row('Jenis bayaran', project.feeType === 'royalti' ? 'Royalti — berdasarkan pengiraan yang dilampirkan' : 'Fi penulisan')}${row('Peringkat kerja', claim.period)}${row('Rujukan penulis', claim.authorReference)}${row('Butiran tuntutan', claim.description)}${!isClaim ? row('Rujukan tuntutan', claim.reference) + row('Cara bayaran', { bank: 'Pindahan bank', tunai: 'Tunai', ewallet: 'E-wallet' }[payment.method]) + row('Rujukan transaksi', payment.transactionRef) + row('Bank / akaun penerima', [writer.bank, writer.account].filter(Boolean).join(' / ')) : ''}</table>
    <div class="amount"><span>${isClaim ? 'Jumlah dituntut' : 'Jumlah bayaran ini'}</span><strong>${rm(isClaim ? claim.amountCents : payment.amountCents)}</strong></div>
    ${!isClaim ? `<p>Jumlah tuntutan: ${rm(claim.amountCents)}. Baucar ini merekod satu bayaran sahaja dan bukan pengesahan pelunasan keseluruhan tuntutan.</p>` : ''}
    ${project.feeType === 'royalti' ? `<h3>Asas / pengiraan royalti</h3><p class="multiline">${esc(project.royaltyTerms)}</p>` : ''}
    ${payment?.notes ? `<h3>Catatan bayaran</h3><p class="multiline">${esc(payment.notes)}</p>` : ''}
    <h3>Lampiran berdaftar</h3><p>${attachments.length ? attachments.map(e => esc(e.name)).join('<br>') : 'Tiada lampiran. Sertakan bukti berkaitan sebelum semakan accountant.'}</p>
    <div class="signatures"><section><h3>${type === 'ack' ? 'Pengesahan penerima' : isClaim ? 'Pengesahan penulis' : 'Disediakan / disemak oleh'}</h3><p>${type === 'ack' ? `Saya, ${esc(writer.name)}, mengesahkan penerimaan bayaran yang dinyatakan di atas setelah menandatangani dokumen ini.` : 'Untuk diisi dan ditandatangani oleh pihak sebenar.'}</p><div class="sign-line"></div><p>Nama: __________________________</p><p>Tarikh: _________________________</p></section><section><h3>${isClaim ? 'Semakan Izotech Enterprise' : 'Catatan / pengesahan tambahan'}</h3><div class="sign-line"></div><p>Nama: __________________________</p><p>Tarikh: _________________________</p></section></div>
    <footer>Dokumen dalaman yang dijana daripada rekod pengguna. Tiada tandatangan atau pengesahan penerimaan dijana automatik. Kelayakan potongan cukai tertakluk semakan accountant.</footer></main><script src="/api/kewangan/print.js"></script></body></html>`;
}
module.exports = { documentHtml, esc, rm };
