# Carian seragam

Semua carian teks menggunakan **Cari** atau **Enter**. Menaip sahaja tidak
menghantar permintaan atau menapis senarai. Butang X mengosongkan carian.

## Pemilihan pelanggan

Nama dan KV dalam Resit, Tempahan, Data Parcel dan Penjana Alamat berkongsi
`CustomerSearch`. Kedua-dua medan mencari nama serta kod KV. Satu padanan
diisi terus; beberapa padanan memaparkan nama, KV, telefon dan alamat untuk
pilihan pengguna. Tiada padanan dan kegagalan carian dipaparkan dengan jelas.
Input manual dan callback autofill halaman asal dikekalkan.

Hasil dipaparkan dalam aliran halaman, bukan dropdown bertindih. Mengubah teks
membatalkan carian tertunda dan mengosongkan hasil supaya respons lama tidak
digunakan. Enter pada input carian tidak menghantar borang simpan induk.

## Senarai rekod

Pelanggan, carian KV arkib Resit dan Tempahan, serta senarai Taging Lebihan
menggunakan `SearchInput`. Komponen menyimpan teks yang sedang ditaip berasingan
daripada carian yang sudah dihantar. Pagination, URL pulang dari suntingan,
tab aktif/arkib dan penapis medan/tarikh sedia ada dikekalkan.

Carian No Tempahan dalam Taging Lebihan menggunakan input bersama yang sama;
padanannya kekal berdasarkan nombor penuh dalam Tempahan. Data penerima atau
rekod asal tidak disimpan atau diubah oleh tindakan Cari.
