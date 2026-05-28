# eBay Profit Dashboard

Dashboard static untuk membaca data penjualan dari Google Sheet dan menampilkan ringkasan profit.

## Cara Pakai Lokal

1. Buka folder ini.
2. Jalankan server static:

```bash
python3 -m http.server 8080
```

3. Buka `http://localhost:8080` di browser.

## Data Source

Dashboard membaca CSV dari Google Sheet:

```text
https://docs.google.com/spreadsheets/d/1QY6xEU_ppaR8zZNg44hHJ8OH4w7n-GWO/gviz/tq?tqx=out:csv
```

Pastikan akses Google Sheet minimal `Anyone with the link can view`, supaya dashboard online bisa membaca datanya.

## File Penting

- `index.html` - struktur halaman dashboard
- `styles.css` - desain dashboard
- `app.js` - logic ambil data, filter, hitung metric, dan render tabel/chart

## Deploy Online

Paling gampang pakai Netlify Drop atau Vercel. Upload semua file dalam folder ini, lalu dashboard bisa dibuka lewat link publik.

Google Drive bisa dipakai untuk menyimpan/backup folder ini, tapi Google Drive bukan hosting ideal untuk menjalankan web app modern.
