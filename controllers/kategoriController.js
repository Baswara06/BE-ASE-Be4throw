const prisma = require('../utils/prisma');
const { success } = require('../utils/response');

// GET /api/kategori
async function listKategori(req, res, next) {
  try {
    const kategori = await prisma.kategori.findMany({
      where: { status: 'aktif' },
      select: {
        id: true,
        nama: true,
        deskripsi: true,
        // Hitung jumlah barang aktif di tiap kategori
        _count: { select: { barang: { where: { status: 'aktif' } } } },
      },
      orderBy: { id: 'asc' }, // urutan sesuai seed: Elektronik, Pakaian, Plastik, Furnitur
    });

    // Ubah _count jadi field yang lebih enak dibaca front-end
    const data = kategori.map(({ _count, ...k }) => ({ ...k, jumlahBarang: _count.barang }));

    return success(res, 200, 'Daftar kategori berhasil diambil', data);
  } catch (err) {
    next(err);
  }
}

module.exports = { listKategori };