# Sistem Admin Gym

Web admin internal untuk mencatat pelanggan gym dari HP/laptop. Data audit masuk ke Google Sheet lewat Google Apps Script, sedangkan frontend bisa di-host di GitHub Pages.

Versi ini sudah disesuaikan:

- PIN admin dihapus.
- No HP dihapus.
- Jenis kunjungan dihapus.
- Catatan dihapus.
- Ada tombol/halaman **Member Lifetime**.
- Data kunci dan member lifetime auto-refresh tiap beberapa detik.

## Alur Sistem

```text
Pegawai buka web admin dari HP/laptop
↓
Input nama admin, nama pelanggan, no kunci, status masuk/keluar
↓
Data masuk ke LOG_GYM
↓
Status kunci update di DATA_KUNCI
↓
Data member lifetime dibaca dari MEMBER_LIFETIME
```

## Struktur Folder

```text
sistem-gym-admin/
├── index.html
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── config.js
└── backend/
    └── google-apps-script/
        ├── Code.gs
        └── appsscript.json
```

## Sheet yang Dipakai

### `LOG_GYM`

Sheet ini untuk audit. Setiap aksi masuk/keluar akan jadi baris baru.

```text
ID | Timestamp | Tanggal | Jam | Nama Pelanggan | No Kunci | Status | Admin
```

### `DATA_KUNCI`

Sheet ini untuk monitoring kunci yang sedang dipakai.

```text
No Kunci | Status | Dipakai Oleh | Jam Masuk | Update Terakhir
```

### `MEMBER_LIFETIME`

Sheet ini untuk data member lifetime. Divisi lain bisa input langsung ke sheet ini, lalu web admin akan membaca datanya otomatis.

Header yang disarankan:

```text
ID Member | Nama Member | Tanggal Daftar | Status | Diinput Oleh | Update Terakhir
```

Minimal yang wajib ada supaya muncul di web:

```text
Nama Member
```

Kode backend juga bisa membaca beberapa nama header alternatif, misalnya `Nama`, `No Member`, `Admin`, atau `Tanggal`.

## Cara Setup Google Sheet

1. Buat Google Sheet baru.
2. Copy Spreadsheet ID dari URL.

Contoh URL:

```text
https://docs.google.com/spreadsheets/d/1ABCxxxxxxxxxxxxxxxxxxxxx/edit
```

Yang dipakai sebagai ID adalah bagian ini:

```text
1ABCxxxxxxxxxxxxxxxxxxxxx
```

## Cara Setup Google Apps Script

1. Buka `https://script.google.com`.
2. Klik **New project**.
3. Hapus isi file `Code.gs` default.
4. Copy semua isi file ini:

```text
backend/google-apps-script/Code.gs
```

5. Paste ke file `Code.gs` di Apps Script.
6. Ubah bagian paling atas:

```javascript
const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const MAX_KEY_NUMBER = 100;
```

Menjadi misalnya:

```javascript
const SPREADSHEET_ID = '1ABCxxxxxxxxxxxxxxxxxxxxx';
const MAX_KEY_NUMBER = 100;
```

7. Buka **Project Settings** di Apps Script.
8. Centang **Show appsscript.json manifest file in editor**.
9. Buka file `appsscript.json`, lalu isi dengan isi file:

```text
backend/google-apps-script/appsscript.json
```

10. Jalankan function `setupGymSheets` sekali.
11. Saat diminta permission, izinkan akses ke Google Sheet.

## Cara Deploy Backend sebagai Web App

1. Di Apps Script, klik **Deploy**.
2. Pilih **New deployment**.
3. Pilih type **Web app**.
4. Isi:

```text
Execute as: Me
Who has access: Anyone
```

5. Klik **Deploy**.
6. Copy URL Web App yang berakhiran `/exec`.

Contoh:

```text
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

## Cara Sambungkan Frontend ke Backend

Buka file:

```text
frontend/config.js
```

Ubah:

```javascript
window.GYM_CONFIG = {
  SCRIPT_URL: "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE",
  APP_NAME: "Sistem Admin Gym",
  GYM_NAME: "Nama Gym Kamu",
  REFRESH_INTERVAL_MS: 5000,
  ENABLE_LOCAL_SCRIPT_URL_SETTING: true
};
```

Menjadi:

```javascript
window.GYM_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec",
  APP_NAME: "Sistem Admin Gym",
  GYM_NAME: "Gym Kamu",
  REFRESH_INTERVAL_MS: 5000,
  ENABLE_LOCAL_SCRIPT_URL_SETTING: true
};
```

`REFRESH_INTERVAL_MS: 5000` artinya web membaca ulang data tiap 5 detik. Kalau mau lebih ringan, ubah ke `10000` untuk 10 detik.

## Cara Upload ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `sistem-gym-admin`.
2. Upload semua isi folder ini ke repository.
3. Masuk ke **Settings** repository.
4. Pilih **Pages**.
5. Pada bagian source, pilih branch `main` dan folder `/root`.
6. Buka URL GitHub Pages yang diberikan GitHub.

Biasanya bentuknya seperti ini:

```text
https://username.github.io/sistem-gym-admin/
```

## Cara Pakai Harian

1. Pegawai buka link GitHub Pages dari HP/laptop.
2. Isi nama admin/pegawai.
3. Isi nama pelanggan, nomor kunci, dan status.
4. Klik **Simpan ke Google Sheet**.
5. Untuk audit, buka Google Sheet dan lihat sheet `LOG_GYM`.
6. Untuk melihat member lifetime, klik tombol **Member Lifetime** di web.

## Cara Divisi Lain Update Member Lifetime

Divisi lain cukup buka Google Sheet yang sama, lalu isi data di sheet:

```text
MEMBER_LIFETIME
```

Contoh:

```text
ID Member | Nama Member | Tanggal Daftar | Status | Diinput Oleh | Update Terakhir
L001      | Budi Santoso | 30/04/2026     | Lifetime | Admin 2 | 30/04/2026 18:30
```

Web admin akan membaca ulang data itu otomatis sesuai `REFRESH_INTERVAL_MS`.

## Catatan Penting

- Ini bukan realtime websocket asli, tapi auto-refresh/polling. Untuk kebutuhan admin gym dan audit Sheet, ini biasanya sudah cukup.
- Karena PIN dihapus, siapa pun yang punya link web dan URL backend bisa input data. Kalau nanti butuh keamanan lagi, bisa ditambah login Google atau PIN per pegawai.
- Jangan ubah nama sheet kecuali juga mengubah constant di `Code.gs`.

## Kalau Ada Error Umum

### `SPREADSHEET_ID belum diisi`

Artinya ID Google Sheet belum ditempel ke `Code.gs`.

### Dashboard tidak bisa refresh

Cek lagi:

- URL Apps Script sudah benar dan berakhiran `/exec`.
- Deploy Web App aksesnya `Anyone`.
- Function `setupGymSheets` sudah dijalankan sekali.
- File `frontend/config.js` sudah diisi URL backend.

### Data member lifetime tidak muncul

Cek:

- Nama sheet harus `MEMBER_LIFETIME`.
- Baris pertama adalah header.
- Minimal ada kolom `Nama Member` atau `Nama`.
- Data member mulai dari baris kedua.
