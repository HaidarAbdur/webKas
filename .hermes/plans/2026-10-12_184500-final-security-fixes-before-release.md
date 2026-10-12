# Rencana Final Perbaikan Keamanan & Kesiapan Rilis WebKas

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Memperbaiki bug runtime Python (`TypeError` pada validasi bulan), menutup celah bypass admin password kosong, merapikan deklarasi scope JavaScript, dan menyelesaikan checklist rilis Vercel.

**Architecture:** Validasi input ketat berstandar Python, autentikasi berbasis digest dengan proteksi null-guard, dan deployment hygiene untuk environment variable serverless.

**Tech Stack:** Python 3 (Flask, Flask-Limiter, Supabase-py), JavaScript (Vanilla ES6).

---

### Task 1: Perbaiki Runtime Error Sintaks Rentang Bulan di `app.py`

**Objective:** Memperbaiki validasi bulan agar tidak memicu `TypeError: argument of type 'int' is not a container or iterable`.

**Files:**
- Modify: `app.py:284`

**Step 1: Inspeksi kode bermasalah**
Baris 284 saat ini:
```python
if not 1-12 in curr_bulan:
    return jsonify({"status": "error", "message": "Bulan harus diantara 1 sampai 12."}), 400
```
Sintaks ini mengevaluasi `-11 in curr_bulan` yang menyebabkan crash fatal saat mencatat pembayaran.

**Step 2: Ganti dengan validasi rentang Python yang benar**
```python
if not (1 <= curr_bulan <= 12):
    return jsonify({"status": "error", "message": "Bulan harus diantara 1 sampai 12."}), 400
```

**Step 3: Uji coba sintaks**
Jalankan kompilasi:
`python3 -m py_compile app.py`
Expected: Berhasil tanpa error.

---

### Task 2: Tambahkan Guard Password Kosong pada Login Admin di `app.py`

**Objective:** Mencegah siapapun login jika variabel lingkungan `ADMIN_PASSWORD` kosong di server.

**Files:**
- Modify: `app.py:91-95`

**Step 1: Inspeksi kode login**
Baris 92 saat ini:
```python
if password == ADMIN_PASSWORD and hmac.compare_digest(password, ADMIN_PASSWORD):
```
Jika `ADMIN_PASSWORD = ""`, kondisi bernilai `True` dan siapapun bisa login dengan password kosong.

**Step 2: Tambahkan pengecekan keberadaan string password admin**
```python
if ADMIN_PASSWORD and hmac.compare_digest(password, ADMIN_PASSWORD):
    session["is_admin"] = True
    return redirect("/admin/dashboard")
return render_template("admin/login.html", error="Password salah!")
```

---

### Task 3: Deklarasikan Scope Variabel `cacheSiswa` di `static/main.js`

**Objective:** Mencegah pembuatan implicit global variable di JavaScript window object.

**Files:**
- Modify: `static/main.js:240-248`

**Step 1: Deklarasikan `let cacheSiswa = [];` sebelum pemanggilan `loadSiswa`**
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
    // ... render tbody ...
```

---

### Task 4: Checklist Pra-Deploy Vercel

**Objective:** Memastikan seluruh kunci rahasia terpasang sebelum rilis publik.

1. Generate secret key di terminal:
   `python3 -c "import secrets; print(secrets.token_hex(32))"`
2. Set Environment Variables di Vercel Dashboard:
   - `FLASK_SECRET_KEY`: [hasil token hex]
   - `ADMIN_PASSWORD`: [password admin kuat]
   - `SUPABASE_URL`: [URL Supabase]
   - `SUPABASE_SERVICE_ROLE_KEY`: [Key Service Role Supabase]
3. Pastikan file `.env` masuk ke dalam `.gitignore`.
