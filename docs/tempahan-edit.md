# Edit Draf Tempahan

Dikemas kini: 2026-11-17.

## Penggunaan

Dalam **Tempahan → Draf Tempahan**, setiap draf aktif mempunyai butang **Edit**.
Popup memaparkan nilai semasa untuk penerima, KV, alamat, telefon, penerbitan,
perkara/tajuk, semester, tarikh, kuantiti, harga, postage, alamat dan parcel.
Jumlah dikira semula ketika mengisi. **Batal** menutup popup tanpa menyimpan.

No. Tempahan/No. Siri dikunci. ID tempahan dan resit dikekalkan. Draf dalam arkib
perlu dipulihkan dahulu sebelum boleh diedit.

## Penyelarasan data

Suntingan mengemas kini ReceiptDraft, TempahanDraft dan DataParcelDraft berkaitan
dalam satu transaksi. Jika satu bahagian gagal, keseluruhan perubahan dibatalkan.
Rekod jualan membaca pautan penerbitan, kuantiti, harga dan postage terkini.

- Postage masih berbayar: ID serta no. order parcel sedia ada dikekalkan.
- Postage ditukar ke RM0: rekod parcel penghantaran dikeluarkan, tetapi alamat,
  poskod dan telefon disimpan pada tempahan.
- Postage ditukar daripada RM0 kepada berbayar: rekod parcel baharu diwujudkan;
  maklumat penghantaran wajib dilengkapkan.
- Penerbitan pengganti mesti wujud dan aktif. Pautan penerbitan sedia ada tidak
  boleh dikosongkan secara tidak sengaja. Rekod lama tanpa pautan masih boleh diedit.
- Profil Customer dan snapshot Taging Lebihan sedia ada tidak diubah. Selepas
  pembetulan, semak taging dan jana semula dokumen/cetakan yang terjejas.

Semua pengguna yang sudah log masuk boleh menyunting draf aktif, sejajar dengan
aliran tempahan bersama. API menolak permintaan tanpa sesi. Muatan suntingan
mesti mengandungi versi data yang dibaca; jika draf telah berubah, API menjawab
409 dan pengguna perlu membuka semula draf terkini. Data yang tidak sah ditolak
sebelum penulisan; No. Tempahan tidak diterima sebagai medan suntingan.

Tiada migrasi database baharu diperlukan. Fungsi penyediaan jadual sokongan
sedia ada dikongsi oleh endpoint senarai dan endpoint rekod.

## Semakan

- `npm run test:tempahan-edit`: ujian HTTP local dengan fixture sementara sahaja.
  Meliputi rekod berkaitan, ID/nombor kekal, laporan jualan, Customer/taging kekal,
  input tidak sah, arkib, konflik versi, rollback kegagalan parcel dan perubahan
  antara penghantaran/pengambilan. Fixture dibersihkan selepas ujian.
- `npm run test:tags`: regresi carian tempahan, cetakan A6 dan lifecycle tag.
- `npm run typecheck` dan `npm run build`.
- Browser: buka popup, nilai asal, No. Tempahan terkunci, Batal tanpa perubahan,
  simpan nama/kuantiti/postage/parcel serta paparan telefon 390px.

Jalankan ujian integrasi pada local sahaja. Fungsi ini belum dipush atau dideploy
ke NAS pada peringkat penyediaan local ini.
