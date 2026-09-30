import os
import csv
import io
# pyrefly: ignore [missing-import]
from flask import Flask, render_template, request, jsonify, session, redirect
# pyrefly: ignore [missing-import]
from supabase import create_client
from datetime import datetime
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from functools import wraps

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key").strip()

app = Flask(__name__, template_folder="template")
app.secret_key = FLASK_SECRET_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def db(table_name):
    return supabase.table(table_name)

def to_list(result):
    return list(result.data or [])

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("is_admin"):
            return redirect("/admin/login")
        return f(*args, **kwargs)
    return decorated

def handle_error(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
    return decorated


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/cari")
def cari():
    return render_template("cari.html")

@app.route("/admin/login", methods=["GET"])
def admin_login_page():
    return render_template("admin/login.html")

@app.route("/admin/login", methods=["POST"])
def admin_login_post():
    password = request.form.get("password", "")
    if password == ADMIN_PASSWORD:
        session["is_admin"] = True
        return redirect("/admin/dashboard")
    return render_template("admin/login.html", error="Password salah!")

@app.route("/admin/logout")
def admin_logout():
    session.clear()
    return redirect("/admin/login")

@app.route("/admin/dashboard")
@require_admin
def admin_dashboard():
    return render_template("admin/dashboard.html")

@app.route("/admin/siswa")
@require_admin
def admin_siswa():
    return render_template("admin/siswa.html")

@app.route("/admin/pembayaran")
@require_admin
def admin_pembayaran():
    return render_template("admin/pembayaran.html")

@app.route("/admin/transaksi")
@require_admin
def admin_transaksi():
    return render_template("admin/transaksi.html")


@app.route("/api/saldo-kas")
@handle_error
def api_saldo_kas():
    masuk = db("transaksi_kas").select("jumlah").eq("tipe", "pemasukan").execute()
    keluar = db("transaksi_kas").select("jumlah").eq("tipe", "pengeluaran").execute()
    bayar = db("pembayaran").select("jumlah").execute()

    total_masuk = sum(r["jumlah"] for r in masuk.data or [])
    total_keluar = sum(r["jumlah"] for r in keluar.data or [])
    total_bayar = sum(r["jumlah"] for r in bayar.data or [])

    saldo = (total_masuk + total_bayar) - total_keluar
    return jsonify({
        "saldo": saldo,
        "total_masuk": total_masuk + total_bayar,
        "total_keluar": total_keluar
    })

@app.route("/api/cari-siswa")
@handle_error
def api_cari_siswa():
    query = request.args.get("nama", "").strip()
    if not query:
        return jsonify([])
    result = db("siswa").select("*").ilike("nama", f"%{query}%").eq("aktif", True).execute()
    return jsonify(to_list(result))

@app.route("/api/tagihan-siswa/<int:siswa_id>")
@handle_error
def api_tagihan_siswa(siswa_id):
    siswa_res = db("siswa").select("*").eq("id", siswa_id).execute()
    if not siswa_res.data:
        return jsonify({"error": "Siswa tidak ditemukan"}), 404
    siswa = siswa_res.data[0]
    bayar_res = db("pembayaran").select("*").eq("siswa_id", siswa_id).order("tahun", desc=True).order("bulan", desc=True).execute()
    return jsonify({"siswa": siswa, "pembayaran": to_list(bayar_res)})


@app.route("/api/admin/stats")
@require_admin
@handle_error
def api_dashboard_stats():
    now = datetime.now()
    bulan_ini = now.month
    tahun_ini = now.year

    masuk = db("transaksi_kas").select("jumlah").eq("tipe", "pemasukan").execute()
    keluar = db("transaksi_kas").select("jumlah").eq("tipe", "pengeluaran").execute()
    bayar = db("pembayaran").select("jumlah").execute()

    total_masuk = sum(r["jumlah"] for r in masuk.data or [])
    total_keluar = sum(r["jumlah"] for r in keluar.data or [])
    total_bayar = sum(r["jumlah"] for r in bayar.data or [])
    saldo = (total_masuk + total_bayar) - total_keluar

    semua_siswa = db("siswa").select("id").eq("aktif", True).execute()
    total_siswa = len(semua_siswa.data or [])

    sudah_bayar = db("pembayaran").select("siswa_id").eq("bulan", bulan_ini).eq("tahun", tahun_ini).execute()
    jumlah_lunas = len(sudah_bayar.data or [])

    return jsonify({
        "saldo": saldo,
        "total_masuk": total_masuk + total_bayar,
        "total_keluar": total_keluar,
        "total_siswa": total_siswa,
        "lunas_bulan_ini": jumlah_lunas,
        "belum_bayar_bulan_ini": total_siswa - jumlah_lunas,
        "bulan_ini": bulan_ini,
        "tahun_ini": tahun_ini
    })

@app.route("/api/admin/siswa", methods=["GET"])
@require_admin
@handle_error
def api_get_siswa():
    result = db("siswa").select("*").order("nomor_absen").execute()
    return jsonify(to_list(result))

@app.route("/api/admin/siswa", methods=["POST"])
@require_admin
@handle_error
def api_tambah_siswa():
    data = request.get_json(silent=True) or {}
    nama = data.get("nama", "").strip()
    nomor_absen = data.get("nomor_absen")
    if not nama:
        return jsonify({"status": "error", "message": "Nama siswa wajib diisi"}), 400
    db("siswa").insert({"nama": nama, "nomor_absen": nomor_absen}).execute()
    return jsonify({"status": "success", "message": f"Siswa '{nama}' berhasil ditambahkan"}), 201

@app.route("/api/admin/siswa/<int:siswa_id>", methods=["DELETE"])
@require_admin
@handle_error
def api_hapus_siswa(siswa_id):
    db("siswa").delete().eq("id", siswa_id).execute()
    return jsonify({"status": "success", "message": "Siswa berhasil dihapus"})

@app.route("/api/admin/impor-siswa", methods=["POST"])
@require_admin
@handle_error
def api_impor_siswa():
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "File tidak ditemukan"}), 400
    file = request.files["file"]
    raw = file.stream.read().decode("utf-8-sig")
    try:
        dialect = csv.Sniffer().sniff(raw[:1024], delimiters=",;")
    except csv.Error:
        dialect = csv.excel
    stream = io.StringIO(raw)
    reader = csv.DictReader(stream, dialect=dialect)
    if reader.fieldnames:
        reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]
    rows = []
    for row in reader:
        cleaned = {k.strip().lower(): v for k, v in row.items() if k}
        nama = cleaned.get("nama", "").strip()
        if nama:
            absen = cleaned.get("nomor_absen", "").strip()
            rows.append({"nama": nama, "nomor_absen": int(absen) if absen.isdigit() else None})
    if not rows:
        return jsonify({"status": "error", "message": "Tidak ada data valid di CSV. Pastikan kolom 'nama' ada dan terisi."}), 400
    db("siswa").insert(rows).execute()
    return jsonify({"status": "success", "message": f"{len(rows)} siswa berhasil diimpor"}), 201


@app.route("/api/admin/pembayaran", methods=["GET"])
@require_admin
@handle_error
def api_get_pembayaran():
    result = db("pembayaran").select("*, siswa(nama, nomor_absen)").order("tanggal_bayar", desc=True).execute()
    return jsonify(to_list(result))

@app.route("/api/admin/pembayaran", methods=["POST"])
@require_admin
@handle_error
def api_catat_pembayaran():
    data = request.get_json(silent=True) or {}
    siswa_id = data.get("siswa_id")
    bulan = data.get("bulan")
    tahun = data.get("tahun")
    jumlah = data.get("jumlah")

    if not all([siswa_id, bulan, tahun, jumlah]):
        return jsonify({"status": "error", "message": "Semua field wajib diisi"}), 400

    cek = db("pembayaran").select("id").eq("siswa_id", siswa_id).eq("bulan", bulan).eq("tahun", tahun).execute()
    if cek.data:
        return jsonify({"status": "error", "message": "Siswa ini sudah tercatat bayar untuk bulan tersebut"}), 409

    db("pembayaran").insert({
        "siswa_id": int(siswa_id),
        "bulan": int(bulan),
        "tahun": int(tahun),
        "jumlah": int(jumlah),
        "keterangan": data.get("keterangan", "")
    }).execute()
    return jsonify({"status": "success", "message": "Pembayaran berhasil dicatat"}), 201

@app.route("/api/admin/pembayaran/<int:bayar_id>", methods=["DELETE"])
@require_admin
@handle_error
def api_hapus_pembayaran(bayar_id):
    db("pembayaran").delete().eq("id", bayar_id).execute()
    return jsonify({"status": "success", "message": "Catatan pembayaran dihapus"})

@app.route("/api/admin/belum-bayar")
@require_admin
@handle_error
def api_belum_bayar():
    now = datetime.now()
    bulan = request.args.get("bulan", now.month)
    tahun = request.args.get("tahun", now.year)

    semua = db("siswa").select("id, nama, nomor_absen").eq("aktif", True).order("nomor_absen").execute()
    sudah = db("pembayaran").select("siswa_id").eq("bulan", int(bulan)).eq("tahun", int(tahun)).execute()

    id_sudah_bayar = {r["siswa_id"] for r in sudah.data or []}
    belum = [s for s in (semua.data or []) if s["id"] not in id_sudah_bayar]
    return jsonify(belum)


@app.route("/api/admin/transaksi", methods=["GET"])
@require_admin
@handle_error
def api_get_transaksi():
    result = db("transaksi_kas").select("*").order("tanggal", desc=True).execute()
    return jsonify(to_list(result))

@app.route("/api/admin/transaksi", methods=["POST"])
@require_admin
@handle_error
def api_tambah_transaksi():
    data = request.get_json(silent=True) or {}
    tipe = data.get("tipe")
    jumlah = data.get("jumlah")
    keterangan = data.get("keterangan", "").strip()

    if tipe not in ["pemasukan", "pengeluaran"]:
        return jsonify({"status": "error", "message": "Tipe tidak valid"}), 400
    if not jumlah or int(jumlah) <= 0:
        return jsonify({"status": "error", "message": "Jumlah harus lebih dari 0"}), 400
    if not keterangan:
        return jsonify({"status": "error", "message": "Keterangan wajib diisi"}), 400

    db("transaksi_kas").insert({"tipe": tipe, "jumlah": int(jumlah), "keterangan": keterangan}).execute()
    return jsonify({"status": "success", "message": "Transaksi berhasil ditambahkan"}), 201

@app.route("/api/admin/transaksi/<int:trx_id>", methods=["DELETE"])
@require_admin
@handle_error
def api_hapus_transaksi(trx_id):
    db("transaksi_kas").delete().eq("id", trx_id).execute()
    return jsonify({"status": "success", "message": "Transaksi berhasil dihapus"})


if __name__ == "__main__":
    app.run(debug=True)