# Full Page Capture

Extension Chrome untuk mengambil screenshot satu halaman web secara penuh. Extension ini menggulir halaman secara otomatis, menangkap setiap bagian halaman, lalu menggabungkannya menjadi satu file PNG.

> Semua proses berjalan langsung di browser. Tidak ada gambar atau data halaman yang dikirim ke server pihak ketiga.

## Fitur

- Menangkap halaman web dari atas hingga bagian paling bawah.
- Menggabungkan beberapa hasil capture menjadi satu gambar PNG.
- Menyembunyikan elemen `fixed` dan `sticky` sementara agar header atau navigasi tidak berulang pada setiap bagian gambar.
- Membuka hasil capture di tab preview baru.
- Menyalin hasil gambar ke clipboard.
- Mengunduh hasil sebagai PNG.
- Mengembalikan posisi scroll halaman setelah proses selesai.
- Menangani batas rate limit `captureVisibleTab` Chrome dengan retry dan backoff.
- Memproses seluruh data secara lokal dengan `OffscreenCanvas`.

## Instalasi Lokal

Extension ini belum memerlukan proses build atau dependency tambahan.

1. Download atau clone repository ini.
2. Buka `chrome://extensions` di Google Chrome.
3. Aktifkan **Developer mode**.
4. Klik **Load unpacked**.
5. Pilih folder project `fullpage-capture`.
6. Pin extension dari toolbar Chrome agar mudah diakses.

## Cara Menggunakan

1. Buka halaman web yang ingin diambil screenshot-nya.
2. Klik ikon **Full Page Capture** di toolbar Chrome.
3. Klik **Capture Halaman Ini**.
4. Tunggu hingga proses scroll, capture, dan stitching selesai.
5. Gunakan tab hasil untuk **Copy to Clipboard** atau **Download PNG**.

## Batasan

- Halaman internal browser seperti `chrome://`, `chrome-extension://`, dan `edge://` tidak dapat dicapture karena pembatasan Chrome.
- Halaman yang sangat panjang dibatasi hingga 60 segmen capture untuk mencegah proses tidak pernah selesai.
- Konten yang berubah saat scrolling, lazy loading yang tidak stabil, animasi, atau elemen dinamis dapat menghasilkan sambungan gambar yang kurang sempurna.
- Ukuran gambar akhir bergantung pada tinggi halaman, lebar viewport, dan device pixel ratio. Halaman yang sangat besar dapat membutuhkan memori browser yang lebih tinggi.
- Izin host digunakan agar script dapat membaca metrik halaman dan mengatur posisi scroll pada halaman aktif.

## Privasi dan Keamanan

Full Page Capture dirancang dengan pendekatan local-first:

- Tidak memiliki backend atau endpoint API.
- Tidak menggunakan analytics, tracking, atau layanan cloud.
- Data hasil capture hanya disimpan sementara di `chrome.storage.local` untuk ditampilkan pada tab hasil.
- Akses halaman hanya digunakan untuk mengukur ukuran halaman, melakukan scroll, dan menghindari duplikasi elemen fixed/sticky.

## Struktur Project

```text
fullpage-capture/
├── background.js   # Capture, retry, scroll, dan stitching gambar
├── manifest.json   # Konfigurasi Manifest V3 dan permission
├── popup.html      # Tampilan popup extension
├── popup.js        # Kontrol capture dari popup
├── result.html     # Tampilan preview hasil capture
├── result.js       # Copy dan download hasil gambar
└── icons/          # Icon extension
```

## Teknologi

- Chrome Extensions Manifest V3
- JavaScript vanilla
- Chrome Tabs API dan Scripting API
- `OffscreenCanvas` untuk menggabungkan gambar
- Clipboard API untuk menyalin PNG

## Kontribusi

Perubahan dan pull request dipersilakan. Untuk perubahan besar, buat issue terlebih dahulu agar solusi yang diusulkan dapat didiskusikan.

## Lisensi

Lisensi project belum ditentukan. Tambahkan file `LICENSE` jika project akan didistribusikan dengan lisensi open source tertentu.
