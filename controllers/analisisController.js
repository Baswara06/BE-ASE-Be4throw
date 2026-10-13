const prisma = require('../utils/prisma');
const { success, fail } = require('../utils/response');
const { buatKodeAkses, hashKodeAkses } = require('../utils/kodeAkses');
const { validasiJawaban, keKondisiBarang } = require('../logic/validasiJawaban');

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

module.exports = { buatAnalisis, ambilAnalisis, updateKondisi };