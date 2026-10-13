const prisma = require('../utils/prisma');
const { success, fail } = require('../utils/response');
const { buatKodeAkses, hashKodeAkses } = require('../utils/kodeAkses');
const { validasiJawaban, keKondisiBarang } = require('../logic/validasiJawaban');
const { jalankanAnalisis, SKOR_AWAL } = require('../logic/ruleEngine');
const { LABEL_TINDAKAN } = require('../logic/tindakan');

// Pesan untuk kondisi khusus FR-10 (SDD Use Case Analisis Barang, skenario eksepsional)
const PESAN_TANPA_ATURAN =
  'Aturan untuk kategori atau kondisi barang ini belum tersedia, jadi sistem belum bisa memberi rekomendasi. ' +
  'Saran aman: simpan barang dalam keadaan bersih dan kering, jangan dibakar atau dibuang sembarangan, ' +
  'lalu tanyakan cara penanganannya ke bank sampah atau pengelola sampah setempat.';
const PESAN_TANPA_TINDAKAN_AMAN =
  'Tidak ada tindakan yang aman dan layak untuk barang ini. Jangan dipakai, dijual, atau diberikan ke orang lain. ' +
  'Minta bantuan pihak kompeten, seperti teknisi resmi atau pengelola limbah B3/elektronik.';

const includeAnalisis = {
  kondisi: true,
  barang: { select: { id: true, nama: true, gambar: true, estimasiBerat: true, kategoriId: true } },
};

const pesanSimpan = (kirim) =>
  kirim ? 'Jawaban tersimpan dan siap dianalisis' : 'Jawaban sementara tersimpan';

// Bentuk data yang dikirim ke FE (hash kode akses tidak ikut dikirim)
function formatAnalisis(analisis, kodeAkses) {
  return {
    id: analisis.id,
    status: analisis.status,
    barang: analisis.barang,
    beratKg: analisis.beratKg,
    jawaban: analisis.kondisi?.jawaban ?? {},
    ...(kodeAkses && { kodeAkses }), // hanya muncul sekali, saat tamu membuat analisis
  };
}

// Validasi berat + jawaban berdasarkan pertanyaan aktif kategori
async function olahJawaban(kategoriId, jawaban, beratKg, kirim) {
  const pertanyaan = await prisma.pertanyaan.findMany({
    where: { kategoriId, status: 'aktif' },
    orderBy: { urutan: 'asc' },
  });
  if (!pertanyaan.length) return { tanpaPertanyaan: true };

  const { errors, bersih } = validasiJawaban(pertanyaan, jawaban, kirim);
  if (kirim && beratKg == null) {
    errors.unshift({ field: 'beratKg', message: 'Berat barang wajib diisi' });
  }
  return { errors, kondisi: keKondisiBarang(bersih) };
}

// Ambil analisis kalau yang minta berhak: pemilik (login) atau tamu dengan kode akses cocok.
// Tidak berhak → null, supaya dibalas 404 (orang lain tidak tahu analisis itu ada).
async function cariAnalisis(req, id) {
  const analisis = await prisma.analisisBarang.findUnique({ where: { id }, include: includeAnalisis });
  if (!analisis) return null;

  if (analisis.userId) {
    return req.user?.id === analisis.userId ? analisis : null;
  }

  const kode = req.get('X-Kode-Akses');
  if (!kode || hashKodeAkses(kode) !== analisis.kodeAksesHash) return null;
  return analisis;
}

// POST /api/analisis
async function buatAnalisis(req, res, next) {
  try {
    const { barangId, beratKg = null, jawaban = {}, kirim = false } = req.body;

    const barang = await prisma.barang.findFirst({
      where: { id: barangId, status: 'aktif', kategori: { status: 'aktif' } },
      select: { id: true, kategoriId: true },
    });
    if (!barang) {
      return fail(res, 404, 'Barang tidak ditemukan atau sudah tidak tersedia');
    }

    const hasil = await olahJawaban(barang.kategoriId, jawaban, beratKg, kirim);
    if (hasil.tanpaPertanyaan) {
      return fail(res, 404, 'Pertanyaan untuk kategori ini belum tersedia');
    }
    if (hasil.errors.length) {
      return fail(res, 422, 'Jawaban belum lengkap atau tidak valid', hasil.errors);
    }

    // Tamu dapat kode akses; yang disimpan hanya hash-nya
    const kodeAkses = req.user ? null : buatKodeAkses();

    // Nested write: AnalisisBarang + KondisiBarang dibuat sekaligus
    const analisis = await prisma.analisisBarang.create({
      data: {
        barangId: barang.id,
        userId: req.user ? req.user.id : null,
        beratKg,
        kodeAksesHash: kodeAkses ? hashKodeAkses(kodeAkses) : null,
        kondisi: { create: hasil.kondisi },
      },
      include: includeAnalisis,
    });

    return success(res, 201, pesanSimpan(kirim), formatAnalisis(analisis, kodeAkses));
  } catch (err) {
    next(err);
  }
}

// GET /api/analisis/:id
async function ambilAnalisis(req, res, next) {
  try {
    const analisis = await cariAnalisis(req, Number(req.params.id));
    if (!analisis) return fail(res, 404, 'Analisis tidak ditemukan');

    return success(res, 200, 'Data analisis berhasil diambil', formatAnalisis(analisis));
  } catch (err) {
    next(err);
  }
}

// PUT /api/analisis/:id/kondisi
async function updateKondisi(req, res, next) {
  try {
    const analisis = await cariAnalisis(req, Number(req.params.id));
    if (!analisis) return fail(res, 404, 'Analisis tidak ditemukan');

    if (analisis.status === 'selesai') {
      return fail(res, 409, 'Analisis sudah selesai sehingga jawaban tidak bisa diubah');
    }

    const kirim = req.body.kirim ?? false;
    // Field yang tidak dikirim → pakai nilai yang sudah tersimpan
    const beratKg = req.body.beratKg !== undefined ? req.body.beratKg : analisis.beratKg;
    const jawaban = req.body.jawaban ?? analisis.kondisi?.jawaban ?? {};

    const hasil = await olahJawaban(analisis.barang.kategoriId, jawaban, beratKg, kirim);
    if (hasil.tanpaPertanyaan) {
      return fail(res, 404, 'Pertanyaan untuk kategori ini belum tersedia');
    }
    if (hasil.errors.length) {
      return fail(res, 422, 'Jawaban belum lengkap atau tidak valid', hasil.errors);
    }

    const diperbarui = await prisma.analisisBarang.update({
      where: { id: analisis.id },
      data: {
        beratKg,
        kondisi: { upsert: { create: hasil.kondisi, update: hasil.kondisi } },
      },
      include: includeAnalisis,
    });

    return success(res, 200, pesanSimpan(kirim), formatAnalisis(diperbarui));
  } catch (err) {
    next(err);
  }
}

// Alasan tertulis untuk satu tindakan (dipakai FR-11/FR-12)
function alasanRekomendasi(s) {
  if (s.alasan.length) return s.alasan.join(' ');
  if (s.skor < SKOR_AWAL) {
    return 'Tindakan ini masih aman, tetapi skornya lebih rendah karena kondisi barang kurang mendukung.';
  }
  return 'Tindakan ini aman dilakukan, tetapi belum ada aturan khusus yang mendukungnya untuk kondisi barang ini.';
}

// Bentuk hasil analisis yang dikirim ke FE (FR-10)
function formatHasil(analisisId, hasil, rekomendasi, pesanKeterbatasan) {
  const { keselamatan } = hasil;
  return {
    id: analisisId,
    status: 'selesai',
    keselamatan: {
      aman: !keselamatan.adaBahaya,
      tindakanDieliminasi: keselamatan.tindakanDieliminasi,
      peringatan: keselamatan.peringatan,
    },
    skor: hasil.skor.map(({ tindakan, skor, peringkat, aman }) => ({
      tindakan,
      label: LABEL_TINDAKAN[tindakan],
      skor,
      peringkat,
      aman,
    })),
    rekomendasi: rekomendasi.map(({ tindakan, jenis, skor, alasan }) => ({
      tindakan,
      label: LABEL_TINDAKAN[tindakan],
      jenis,
      skor,
      alasan,
    })),
    pesanKeterbatasan,
  };
}

// Kalau proses gagal, cukup tandai "gagal". Jawaban pengguna TIDAK dihapus (NFR-08).
// Analisis yang sudah selesai tidak boleh berubah jadi gagal.
async function tandaiGagal(id) {
  try {
    await prisma.analisisBarang.updateMany({
      where: { id, status: { not: 'selesai' } },
      data: { status: 'gagal' },
    });
  } catch (err) {
    console.error('Gagal menandai analisis gagal:', err.message);
  }
}

// POST /api/analisis/:id/proses (FR-10)
async function prosesAnalisis(req, res, next) {
  let analisis = null;
  try {
    analisis = await cariAnalisis(req, Number(req.params.id));
    if (!analisis) return fail(res, 404, 'Analisis tidak ditemukan');

    if (analisis.status === 'selesai') {
      return fail(res, 409, 'Analisis ini sudah selesai diproses');
    }

    // Tahap 1 – Evaluasi kondisi: jawaban harus lengkap & valid (aturan yang sama dengan FR-09)
    const kategoriId = analisis.barang.kategoriId;
    const cek = await olahJawaban(kategoriId, analisis.kondisi?.jawaban ?? {}, analisis.beratKg, true);
    if (cek.tanpaPertanyaan) {
      return fail(res, 404, 'Pertanyaan untuk kategori ini belum tersedia');
    }
    if (!analisis.kondisi || cek.errors.length) {
      return fail(
        res,
        422,
        'Jawaban kondisi belum lengkap atau tidak valid. Perbaiki dulu sebelum dianalisis.',
        cek.errors
      );
    }

    // Aturan aktif untuk kategori ini + aturan umum (kategoriId null). Diambil dari DB (NFR-09).
    const aturan = await prisma.basisPengetahuan.findMany({
      where: { status: 'aktif', OR: [{ kategoriId }, { kategoriId: null }] },
      select: { id: true, versi: true, kondisi: true, tindakan: true, bobot: true, eliminasi: true, alasan: true },
      orderBy: { id: 'asc' },
    });

    // Tahap 2 & 3 – Pemeriksaan keselamatan + hitung skor (logic/ruleEngine.js)
    const hasil = jalankanAnalisis(analisis.kondisi, aturan);

    // Rekomendasi = tindakan yang aman dan skornya di atas 0. Peringkat 1 = utama.
    const rekomendasi = hasil.skor
      .filter((s) => s.aman && s.skor > 0)
      .map((s, i) => ({
        analisisId: analisis.id,
        tindakan: s.tindakan,
        jenis: i === 0 ? 'utama' : 'alternatif',
        skor: s.skor,
        alasan: alasanRekomendasi(s),
        langkahPraktis: [], // diisi di FR-11
        peringatan: [],
      }));

    let pesanKeterbatasan = null;
    if (hasil.keterbatasan) pesanKeterbatasan = PESAN_TANPA_ATURAN;
    else if (rekomendasi.length === 0) pesanKeterbatasan = PESAN_TANPA_TINDAKAN_AMAN;

    const where = { analisisId: analisis.id };

    // Simpan semua hasil sekaligus: kalau satu gagal, semuanya dibatalkan.
    // Hasil lama (dari percobaan sebelumnya) dihapus dulu supaya bisa dicoba ulang (NFR-08).
    await prisma.$transaction([
      prisma.rekomendasi.deleteMany({ where }),
      prisma.skorSolusi.deleteMany({ where }),
      prisma.pemeriksaanKeselamatan.deleteMany({ where }),
      prisma.pemeriksaanKeselamatan.create({
        data: {
          analisisId: analisis.id,
          adaBahaya: hasil.keselamatan.adaBahaya,
          tindakanDieliminasi: hasil.keselamatan.tindakanDieliminasi,
          peringatan: hasil.keselamatan.peringatan,
        },
      }),
      prisma.skorSolusi.createMany({
        data: hasil.skor.map((s) => ({
          analisisId: analisis.id,
          tindakan: s.tindakan,
          skor: s.skor,
          peringkat: s.peringkat,
        })),
      }),
      prisma.rekomendasi.createMany({ data: rekomendasi }),
      prisma.analisisBarang.update({
        where: { id: analisis.id },
        data: { status: 'selesai', versiAturan: hasil.versiAturan, pesanKeterbatasan },
      }),
    ]);

    return success(
      res,
      200,
      'Analisis selesai',
      formatHasil(analisis.id, hasil, rekomendasi, pesanKeterbatasan)
    );
  } catch (err) {
    if (analisis) await tandaiGagal(analisis.id);
    next(err);
  }
}

module.exports = { buatAnalisis, ambilAnalisis, updateKondisi, prosesAnalisis };