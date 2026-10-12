# Audit Keamanan & Perbaikan Celah WebKas Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Menutup sisa celah keamanan (XSS pada riwayat, bypass admin password kosong, attribute-based JS error di tombol hapus, dan validasi input pembayaran) sebelum webKas siap rilis.

**Architecture:** Defense-in-depth: sanitasi konteks DOM di frontend (`escapeHtml` konsisten dan pemisahan event handler), validasi ketat serta perbandingan aman di backend Flask (`secrets.compare_digest`), penanganan error terisolasi, dan konfigurasi cookie session aman.

**Tech Stack:** Python 3 (Flask, Flask-Limiter, Supabase-py), JavaScript (Vanilla ES6), HTML5/CSS3.

---

### Task 1: Tutup Celah XSS pada Halaman Riwayat Pengeluaran

**Objective:** Mencegah Stored XSS saat menampilkan teks keterangan transaksi pengeluaran di tabel riwayat.

**Files:**
- Modify: `static/main.js:415-425`

**Step 1: Inspeksi kode eksisting**
Pada `static/main.js`, baris 420 saat ini:
```javascript
<td>${item.keterangan || '-'}</td>
```
Variabel `item.keterangan` dimasukkan mentah ke `innerHTML` tanpa fungsi `escapeHtml`.

**Step 2: Terapkan escapeHtml**
Ubah baris 420 menjadi:
```javascript
<td>${escapeHtml(item.keterangan || '-')}</td>
```

**Step 3: Verifikasi frontend**
Jalankan browser atau periksa render string pada `static/main.js` memastikan karakter `<img src=x onerror=alert(1)>` ter-encode menjadi `&lt;img ...&gt;`.

---

### Task 2: Perbaiki Inline Event Injection pada Tombol Hapus Siswa

**Objective:** Mencegah syntax error dan potensi DOM injection akibat single-quote pada nama siswa di atribut `onclick`.

**Files:**
- Modify: `static/main.js:245-263`

**Step 1: Inspeksi kode eksisting**
Pada baris 251:
```javascript
<button class="btn btn-danger btn-sm" onclick="hapusSiswa(${s.id}, '${escapeHtml(s.nama)}')">Hapus</button>
```
Atribut HTML mendecode `&#39;` kembali menjadi `'`, merusak sintaks jika nama siswa mengandung tanda petik (contoh: `Syafi'i`).

**Step 2: Simpan data siswa ke scope lokal dan hanya kirim ID ke onclick**
Ubah baris 240-262:
```javascript
let cacheSiswa = [];

async function loadSiswa() {
    const { data } = await apiFetch('/api/admin/siswa');
    const tbody = document.getElementById('siswa-tbody');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="search-empty">Belum ada data siswa</td></tr>';
        return;
    }
    cacheSiswa = data;
    tbody.innerHTML = data.map(s => `
        <tr>
            <td>${escapeHtml(s.nomor_absen || '-')}</td>
            <td>${escapeHtml(s.nama)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="hapusSiswa(${s.id})">Hapus</button>
            </td>
        </tr>
    `).join('');
}

window.hapusSiswa = async function (id) {
    const target = cacheSiswa.find(s => s.id === id);
    const nama = target ? target.nama : 'siswa ini';
    if (!confirmDelete(`Hapus siswa "${nama}"? Semua riwayat pembayarannya juga akan ikut terhapus.`)) return;
    const { ok, data } = await deleteReq(`/api/admin/siswa/${id}`);
    showToast(data.message, ok ? 'success' : 'error');
    if (ok) loadSiswa();
};
```

**Step 3: Verifikasi**
Tombol hapus berfungsi normal tanpa eval string di HTML inline attribute.

---

### Task 3: Cegah Bypass Password Admin Kosong & Gunakan Timing-Safe Comparison

**Objective:** Mencegah akses admin jika environment variable `ADMIN_PASSWORD` tidak terisi, serta mencegah timing attack.

**Files:**
- Modify: `app.py:85-93`

**Step 1: Tambahkan import secrets**
Gunakan `secrets.compare_digest` standar Python.

**Step 2: Perketat pengecekan password di `/admin/login`**
Ganti:
```python
@app.route("/admin/login", methods=["POST"])
@limiter.limit("3 per minute")
def admin_login_post():
    password = request.form.get("password", "")
    if password == ADMIN_PASSWORD:
        session["is_admin"] = True
        return redirect("/admin/dashboard")
    return render_template("admin/login.html", error="Password salah!")
```
Menjadi:
```python
import hmac

@app.route("/admin/login", methods=["POST"])
@limiter.limit("3 per minute")
def admin_login_post():
    password = request.form.get("password", "")
    if ADMIN_PASSWORD and hmac.compare_digest(password, ADMIN_PASSWORD):
        session["is_admin"] = True
        return redirect("/admin/dashboard")
    return render_template("admin/login.html", error="Password salah!")
```

**Step 3: Verifikasi logika**
Jika `ADMIN_PASSWORD = ""` atau tidak disetel di `.env`, login dengan password kosong tetap ditolak (`False`).

---

### Task 4: Perketat Validasi Rentang Bulan dan Alokasi Pembayaran

**Objective:** Memastikan parameter bulan berada di rentang 1-12 dan batas pembayaran selaras dengan batas iterasi.

**Files:**
- Modify: `app.py:270-285`

**Step 1: Validasi bulan (1..12) dan tahun**
Tambahkan pengecekan:
```python
if curr_bulan < 1 or curr_bulan > 12:
    return jsonify({"status": "error", "message": "Bulan harus antara 1 sampai 12"}), 400
if curr_tahun < 2020 or curr_tahun > 2100:
    return jsonify({"status": "error", "message": "Tahun tidak valid"}), 400
```

**Step 2: Sinkronkan sisa_bayar dengan alokasi iterasi**
Batas input `144000` (maksimal 1 tahun kas lunas):
```python
if sisa_bayar <= 0 or sisa_bayar > 144000:
    return jsonify({"status": "error", "message": "Jumlah harus antara 1 sampai 144.000 (maks. 1 tahun)."}), 400
```
Tingkatkan batas guard `max_iterasi = 24` agar tidak ada sisa bayar terpotong di tengah jalan.

---

### Checklist Kesiapan Deploy Vercel

1. [ ] Generate `FLASK_SECRET_KEY` acak 32-karakter dan daftarkan di dashboard Vercel.
2. [ ] Daftarkan `ADMIN_PASSWORD`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY` di Environment Variables Vercel.
3. [ ] Pastikan file `.env` tidak pernah di-commit ke Git repo (tercantum di `.gitignore`).
4. [ ] Jalankan testing fungsional lokal: login admin, input bayar, cari siswa, hapus siswa.
