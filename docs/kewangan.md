# Modul Kewangan KVar

Modul ini berada di `/kewangan` dan menggunakan sesi KVar sedia ada. Halaman, API,
borang, fail bukti, CSV, sandaran dan cetakan semuanya memerlukan role `admin`.
Paparan borang lab yang sudah diuji dikekalkan dalam iframe sama origin untuk
mengasingkan CSS dan JavaScript daripada borang tempahan KVar. Tiada server lab,
port tambahan, sambungan localhost atau simpanan JSON diperlukan untuk modul ini.

## Data dan integriti

- Jadual Prisma khusus: `FinanceRecord` (rekod serta snapshot), `FinanceConfig`
  (profil perniagaan dan nombor rujukan), `FinanceAttachment` (metadata dan binari
  bukti), `FinanceAudit` (pengguna, operasi dan masa).
- Setiap perubahan memuatkan data terkini dan mengesahkan baki serta nombor
  rujukan dalam transaksi SQLite yang sama dengan simpanan. Amaun disimpan dalam sen.
- Tiada hubungan wajib dengan tempahan, pelanggan, penerbitan jualan atau parcel.
  Terbitan penulis kekal khusus untuk skop kerja dan fi penulisan.
- Jadual kewangan bermula kosong. Data contoh prototaip tidak diimport.
- Arkib mengekalkan jumlah kewangan; pembatalan menyimpan sebab. Bayaran balik
  pemilik mengurangkan baki pendahuluan dan tidak menambah belanja asal.
- Paparan dokumen mengekalkan perubahan yang dipersetujui: tiada perenggan
  pecahan perniagaan/peribadi, nota susut nilai aset atau pengesahan tambahan.
  Pengesahan penerima upah masih ada pada borang upah pembantu.

## Sandaran dan TrueNAS

Butang **Sandaran kewangan** memuat turun JSON untuk modul kewangan sahaja,
termasuk lampiran. **Pulih kewangan** menggantikan rekod kewangan sahaja, bukan
rekod tempahan KVar. Sebelum pemulihan, salinan kewangan terdahulu disimpan dalam
`data/kewangan-backups/`. Audit pemulihan dikekalkan dalam database.

Bukti binari berada dalam SQLite KVar, yang sudah menggunakan volume
`docker-data/data:/app/data`. Tiada volume atau port baharu diperlukan. Dockerfile
menyalin aset UI kewangan yang dilindungi ke imej runtime. Migrasi hanya menambah
empat jadual baharu; startup sedia ada menjalankan `prisma migrate deploy`.

Sebelum deployment sebenar, hentikan penulisan dan buat snapshot/backup keseluruhan
volume `docker-data/data` serta simpan imej aplikasi lama. Untuk undur deployment,
pulihkan database/volume dan imej yang sepadan. Jangan guna reset atau db push pada NAS.

Had lampiran: PDF/PNG/JPEG 5 MB setiap fail. Pemulihan JSON maksimum 30 MB.
Salinan automatik sebelum pemulihan mungkin mengandungi maklumat peribadi dan
perlu dilindungi bersama backup database. Jangan masukkan folder data ke Git.

## Semakan local

- `npm run typecheck`
- `npm run test:finance`
- Dengan server local berjalan: `npm run test:finance:integration`
- `npm run test:tags`
- `npm run build`

Ujian integrasi menggunakan admin local, menyimpan sandaran modul dahulu,
menambah rekod sementara dan pengguna biasa, lalu memulihkan keadaan asal dalam
`finally`. Jangan jalankan pada NAS atau data produksi.
