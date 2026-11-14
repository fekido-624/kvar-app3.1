# Taging Lebihan

Halaman `/taging-lebihan` boleh digunakan oleh pengguna yang telah log masuk,
mengikut akses modul Tempahan sedia ada.

## Aliran

1. Cari No Tempahan penuh, iaitu nilai pada kolum No Siri dalam Tempahan
   (`ReceiptDraft.noResit`), contohnya `5025`. Nombor pendek parcel seperti `25`
   tidak digunakan untuk carian tag. Jika beberapa padanan ditemui, pilih
   penerima menggunakan nama, KV, alamat dan telefon yang dipaparkan.
2. Jika tiada padanan, gunakan carian Nama / KV dalam rekod Customer. No Tempahan
   yang dimasukkan dikekalkan dan boleh disunting.
3. Semak nama, KV, alamat, poskod dan telefon. Maklumat ini disimpan sebagai
   salinan dalam tag; suntingan tidak mengubah Customer, Data Parcel atau Tempahan.
4. Isi kuantiti Lebihan dan Naskah Guru sebagai integer bukan negatif.
   Kedua-duanya sifar tidak dibenarkan.
5. Simpan, pilih satu atau beberapa rekod, kemudian tekan **PDF pilihan**.
   Pratonton terus dalam halaman dan fail PDF menggunakan susun atur yang sama.

## Cetakan

- Satu halaman A6 landscape (148 × 105 mm) untuk setiap rekod yang dipilih.
- Bahagian atas untuk Lebihan; bahagian bawah untuk Naskah Guru.
- Bahagian Naskah Guru mempunyai bingkai dua garisan dengan corak serong hitam
  putih supaya mudah dikenal pasti pada cetakan monokrom. Bingkai tidak dicetak
  jika kuantiti Naskah Guru ialah sifar.
- Kuantiti sifar meninggalkan bahagian tersebut kosong.
- Garisan putus-putus melintang di tengah untuk panduan potong.
- Cetak pada A6, landscape, **100% / Actual size**.
- Alamat panjang dibalut dan saiz teks dilaraskan hingga minimum 9 pt. Jika
  masih tidak muat, PDF ditolak dengan arahan untuk meringkaskan maklumat tag.
- Fon PDF standard menyokong teks Latin. Aksara yang tidak disokong menghasilkan
  mesej ralat; teks tidak diganti atau dibuang secara senyap.

## Rekod

- Rekod kekal dalam SQLite melalui model Prisma `LebihanTag`.
- Tab Aktif dan Arkib masing-masing menyokong carian No Tempahan, nama, KV dan telefon.
- Nama medan simpanan `noOrder` dikekalkan untuk keserasian; bagi tag baharu ia
  menyimpan nombor penuh Tempahan. Rekod tag lama tidak ditukar secara automatik;
  nombornya boleh dibetulkan melalui Sunting.
- Rekod boleh disunting, diarkib, dipulihkan dan dipadam kekal selepas pengesahan.
- Maksimum 200 rekod bagi satu tindakan pukal / PDF. Pilihan merentasi halaman
  senarai dikekalkan; perubahan carian atau tab mengosongkan pilihan.

## Pemasangan dan pengesahan

Migrasi `20261114050000_add_lebihan_tags` hanya menambah jadual dan indeks baharu.
Untuk pemasangan lokal, hentikan server sebelum menjalankan:

```powershell
npm run db:generate
npx prisma migrate deploy
npm run dev
```

Deployment Docker sedia ada menjana Prisma Client semasa build dan menjalankan
`prisma migrate deploy` semasa container bermula. Database kekal pada volume
SQLite sedia ada; tiada sambungan produksi diperlukan untuk pembangunan lokal.

Ujian integrasi memerlukan server lokal berjalan serta `DATABASE_URL` dan
`AUTH_SECRET` yang sama dalam `.env`:

```powershell
npm run typecheck
npm run test:tags
```

Ujian menjana fixture dengan pengecam unik dan membersihkan fixture itu sahaja.
Ia menyemak autentikasi, padanan berganda, carian Nama / KV, pengasingan data asal,
kuantiti tidak sah, PDF A6 pukal, ruang kosong sifar, limpahan teks serta kitaran
arkib/pulih/padam. Ujian cetakan fizikal masih perlu dibuat pada pencetak sasaran.
