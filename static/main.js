const BULAN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_FULL = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

function formatTanggal(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

let toastTimer;
function showToast(message, type = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

async function postJSON(url, body) {
    return apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function deleteReq(url) {
    return apiFetch(url, { method: 'DELETE' });
}

function confirmDelete(message) {
    return confirm(message || 'Yakin ingin menghapus data ini?');
}


const page = document.body.dataset.page;


if (page === 'index') {
    loadSaldo();

    async function loadSaldo() {
        const el = document.getElementById('saldo-amount');
        const masukEl = document.getElementById('total-masuk');
        const keluarEl = document.getElementById('total-keluar');
        try {
            const { data } = await apiFetch('/api/saldo-kas');
            el.textContent = formatRupiah(data.saldo);
            if (masukEl) masukEl.textContent = formatRupiah(data.total_masuk);
            if (keluarEl) keluarEl.textContent = formatRupiah(data.total_keluar);
        } catch {
            el.textContent = 'Gagal memuat';
        }
    }

    let timer;
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        const q = this.value.trim();
        if (q.length < 2) {
            searchResults.innerHTML = '';
            return;
        }
        timer = setTimeout(() => doSearch(q), 400);
    });

    async function doSearch(q) {
        searchResults.innerHTML = '<div class="loading">Mencari...</div>';
        try {
            const { ok, data } = await apiFetch(`/api/cari-siswa?nama=${encodeURIComponent(q)}`);
            if (!ok || !Array.isArray(data)) {
                const errMsg = (data && data.message) ? data.message : 'Terjadi kesalahan koneksi server database';
                searchResults.innerHTML = `<div class="search-empty" style="color: var(--danger, #ef4444);">⚠️ ${errMsg}</div>`;
                return;
            }
            if (data.lenght === 0) {
                searchResults.innerHTML = '<div class="search-empty">Nama tidak ditemukan di database</div>';
                return;
            }
            searchResults.innerHTML = data.map(s => `
                <a href="/cari?id=${s.id}" class="result-item" >
                   <span class="result-name">${s.nama}</span>
                   <span class="result-absen">Absen ${s.nomor_absen || '-'}</span>
                </a>`).join('');
        } catch {
            searchResults.innerHTML = '<div class="search-empty">Terjadi kesalahan. Coba lagi.</div>';
        }
    }
}


if (page === 'cari') {
    const params = new URLSearchParams(window.location.search);
    const siswaId = params.get('id');

    if (!siswaId) {
        window.location.href = '/';
    } else {
        loadTagihan(siswaId);
    }

    async function loadTagihan(id) {
        try {
            const { ok, data } = await apiFetch(`/api/tagihan-siswa/${id}`);
            if (!ok) { window.location.href = '/'; return; }

            const { siswa, pembayaran } = data;

            document.getElementById('siswa-initial').textContent = siswa.nama.charAt(0).toUpperCase();
            document.getElementById('siswa-nama').textContent = siswa.nama;
            document.getElementById('siswa-absen').textContent = `Nomor Absen: ${siswa.nomor_absen || '-'}`;

            const now = new Date();
            const tahunIni = now.getFullYear();
            const bayarSet = new Set(pembayaran.filter(p => p.tahun === tahunIni).map(p => p.bulan));

            const grid = document.getElementById('payment-grid');
            grid.innerHTML = '';
            for (let b = 1; b <= 12; b++) {
                const lunas = bayarSet.has(b);
                grid.innerHTML += `
                    <div class="payment-month ${lunas ? 'lunas' : 'belum'}">
                        <span class="month-name">${BULAN[b]}</span>
                        <span class="month-icon">${lunas ? '✅' : '❌'}</span>
                    </div>
                `;
            }

            const tbody = document.getElementById('riwayat-tbody');
            if (!pembayaran.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="search-empty">Belum ada riwayat pembayaran</td></tr>';
            } else {
                tbody.innerHTML = pembayaran.map(p => `
                    <tr>
                        <td>${BULAN_FULL[p.bulan]} ${p.tahun}</td>
                        <td>${formatRupiah(p.jumlah)}</td>
                        <td>${formatTanggal(p.tanggal_bayar)}</td>
                        <td>${p.keterangan || '-'}</td>
                    </tr>
                `).join('');
            }
        } catch {
            window.location.href = '/';
        }
    }
}


if (page === 'dashboard') {
    loadStats();

    async function loadStats() {
        const { data } = await apiFetch('/api/admin/stats');

        document.getElementById('stat-saldo').textContent = formatRupiah(data.saldo);
        document.getElementById('stat-siswa').textContent = data.total_siswa;
        document.getElementById('stat-lunas').textContent = data.lunas_bulan_ini;
        document.getElementById('stat-belum').textContent = data.belum_bayar_bulan_ini;
        document.getElementById('bulan-label').textContent = `${BULAN_FULL[data.bulan_ini]} ${data.tahun_ini}`;

        loadBelumBayar(data.bulan_ini, data.tahun_ini);
    }

    async function loadBelumBayar(bulan, tahun) {
        const { data } = await apiFetch(`/api/admin/belum-bayar?bulan=${bulan}&tahun=${tahun}`);
        const tbody = document.getElementById('belum-tbody');
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="2" class="search-empty">🎉 Semua siswa sudah lunas!</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(s => `
            <tr>
                <td>${s.nomor_absen || '-'}</td>
                <td>${s.nama}</td>
            </tr>
        `).join('');
    }
}


if (page === 'siswa') {
    loadSiswa();

    async function loadSiswa() {
        const { data } = await apiFetch('/api/admin/siswa');
        const tbody = document.getElementById('siswa-tbody');
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="search-empty">Belum ada data siswa</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(s => `
            <tr>
                <td>${s.nomor_absen || '-'}</td>
                <td>${s.nama}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="hapusSiswa(${s.id}, '${s.nama}')">Hapus</button>
                </td>
            </tr>
        `).join('');
    }

    window.hapusSiswa = async function (id, nama) {
        if (!confirmDelete(`Hapus siswa "${nama}"? Semua riwayat pembayarannya juga akan ikut terhapus.`)) return;
        const { ok, data } = await deleteReq(`/api/admin/siswa/${id}`);
        showToast(data.message, ok ? 'success' : 'error');
        if (ok) loadSiswa();
    };

    document.getElementById('form-siswa').addEventListener('submit', async function (e) {
        e.preventDefault();
        const nama = document.getElementById('input-nama').value.trim();
        const absen = document.getElementById('input-absen').value.trim();
        const { ok, data } = await postJSON('/api/admin/siswa', { nama, nomor_absen: absen || null });
        showToast(data.message, ok ? 'success' : 'error');
        if (ok) { this.reset(); loadSiswa(); }
    });

    document.getElementById('form-csv').addEventListener('submit', async function (e) {
        e.preventDefault();
        const file = document.getElementById('input-csv').files[0];
        if (!file) { showToast('Pilih file CSV terlebih dahulu', 'error'); return; }
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/admin/impor-siswa', { method: 'POST', body: formData });
        const data = await res.json();
        showToast(data.message, res.ok ? 'success' : 'error');
        if (res.ok) { this.reset(); loadSiswa(); }
    });
}


if (page === 'pembayaran') {
    loadAllSiswaOptions();
    loadRiwayatPembayaran();

    const now = new Date();
    document.getElementById('input-bulan').value = now.getMonth() + 1;
    document.getElementById('input-tahun').value = now.getFullYear();
    document.getElementById('input-jumlah').value = 12000;

    async function loadAllSiswaOptions() {
        const { data } = await apiFetch('/api/admin/siswa');
        const sel = document.getElementById('input-siswa');
        sel.innerHTML = '<option value="">-- Pilih Siswa --</option>' +
            data.map(s => `<option value="${s.id}">${s.nomor_absen ? `[${s.nomor_absen}] ` : ''}${s.nama}</option>`).join('');
    }

    async function loadRiwayatPembayaran() {
        const { data } = await apiFetch('/api/admin/pembayaran');
        const tbody = document.getElementById('bayar-tbody');
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="search-empty">Belum ada catatan pembayaran</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.siswa?.nama || '-'}</td>
                <td>${BULAN_FULL[p.bulan]} ${p.tahun}</td>
                <td>${formatRupiah(p.jumlah)}</td>
                <td>${formatTanggal(p.tanggal_bayar)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="hapusPembayaran(${p.id})">Hapus</button>
                </td>
            </tr>
        `).join('');
    }

    window.hapusPembayaran = async function (id) {
        if (!confirmDelete('Hapus catatan pembayaran ini?')) return;
        const { ok, data } = await deleteReq(`/api/admin/pembayaran/${id}`);
        showToast(data.message, ok ? 'success' : 'error');
        if (ok) loadRiwayatPembayaran();
    };

    document.getElementById('form-pembayaran').addEventListener('submit', async function (e) {
        e.preventDefault();
        const payload = {
            siswa_id: document.getElementById('input-siswa').value,
            bulan: document.getElementById('input-bulan').value,
            tahun: document.getElementById('input-tahun').value,
            jumlah: document.getElementById('input-jumlah').value,
            keterangan: document.getElementById('input-ket-bayar').value
        };
        const { ok, data } = await postJSON('/api/admin/pembayaran', payload);
        showToast(data.message, ok ? 'success' : 'error');
        if (ok) { this.reset(); loadRiwayatPembayaran(); loadAllSiswaOptions(); }
    });
}


if (page === 'transaksi') {
    loadTransaksi();

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.tab).classList.add('active');
        });
    });

    async function loadTransaksi() {
        const { data } = await apiFetch('/api/admin/transaksi');
        const tbody = document.getElementById('trx-tbody');
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="search-empty">Belum ada transaksi</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(t => `
            <tr>
                <td><span class="badge ${t.tipe === 'pemasukan' ? 'badge-success' : 'badge-danger'}">${t.tipe}</span></td>
                <td>${t.keterangan}</td>
                <td>${formatRupiah(t.jumlah)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="hapusTrx(${t.id})">Hapus</button>
                </td>
            </tr>
        `).join('');
    }

    window.hapusTrx = async function (id) {
        if (!confirmDelete('Hapus transaksi ini?')) return;
        const { ok, data } = await deleteReq(`/api/admin/transaksi/${id}`);
        showToast(data.message, ok ? 'success' : 'error');
        if (ok) loadTransaksi();
    };

    ['form-masuk', 'form-keluar'].forEach(formId => {
        document.getElementById(formId).addEventListener('submit', async function (e) {
            e.preventDefault();
            const tipe = formId === 'form-masuk' ? 'pemasukan' : 'pengeluaran';
            const suffix = formId === 'form-masuk' ? 'masuk' : 'keluar';
            const payload = {
                tipe,
                jumlah: document.getElementById(`jumlah-${suffix}`).value,
                keterangan: document.getElementById(`ket-${suffix}`).value
            };
            const { ok, data } = await postJSON('/api/admin/transaksi', payload);
            showToast(data.message, ok ? 'success' : 'error');
            if (ok) { this.reset(); loadTransaksi(); }
        });
    });
}
