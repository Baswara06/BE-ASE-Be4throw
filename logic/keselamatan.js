// Pemeriksaan keselamatan (FR-10, SDD Skema Pengujian no. 2).
// Aturan dasar sengaja ditulis di kode, bukan di DB, supaya tidak bisa hilang
// kalau admin salah hapus/nonaktifkan aturan. Admin tetap bisa MENAMBAH aturan
// keselamatan lewat BasisPengetahuan (eliminasi = true), lihat ruleEngine.js.
const { TINDAKAN } = require('./tindakan');

// Per jenis bahaya: tindakan yang dibuang + peringatan untuk pengguna
const ATURAN_BAHAYA = {
  baterai: {
    eliminasi: ['gunakan_kembali', 'jual', 'donasikan'],
    peringatan:
      'Baterai yang menggembung, bocor, atau panas berisiko terbakar. Jangan dicas atau dipakai, ' +
      'jauhkan dari sumber panas, dan jangan dibuang ke tempat sampah biasa. Perbaikan hanya di servis resmi.',
  },
  limbah_elektronik: {
    eliminasi: ['gunakan_kembali', 'jual', 'donasikan'],
    peringatan:
      'Komponen elektronik yang terbuka, gosong, atau bocor bisa melepaskan zat berbahaya. ' +
      'Jangan dibongkar sendiri; serahkan ke teknisi atau dropbox limbah elektronik resmi.',
  },
  benda_tajam: {
    eliminasi: ['gunakan_kembali', 'jual', 'donasikan'],
    peringatan:
      'Ada bagian tajam yang bisa melukai. Bungkus bagian tajam dengan aman sebelum barang ' +
      'dipindahkan atau diserahkan ke pihak lain.',
  },
  bahan_kimia: {
    eliminasi: ['gunakan_kembali', 'perbaiki', 'jual', 'donasikan'],
    peringatan:
      'Barang terkontaminasi bahan kimia. Jangan dipakai untuk makanan/minuman atau diberikan ' +
      'ke orang lain; serahkan ke pengelola limbah B3.',
  },
};

// Pengguna jawab "tidak tahu" → anggap berisiko, jangan oper risiko ke orang lain
const BAHAYA_TIDAK_DIKETAHUI = {
  eliminasi: ['jual', 'donasikan'],
  peringatan:
    'Kamu belum yakin apakah barang ini berbahaya. Pastikan dulu ke pihak yang kompeten ' +
    '(teknisi atau pengelola limbah) sebelum menyerahkannya ke orang lain.',
};

// kondisi: kolom KondisiBarang (mengandungBahaya, jenisBahaya)
// aturanEliminasiDb: aturan BasisPengetahuan dengan eliminasi = true yang cocok dengan kondisi
function periksaKeselamatan(kondisi, aturanEliminasiDb = []) {
  const dibuang = new Set();
  const peringatan = [];

  const terapkan = (aturan) => {
    aturan.eliminasi.forEach((t) => dibuang.add(t));
    peringatan.push(aturan.peringatan);
  };

  const { mengandungBahaya, jenisBahaya = [] } = kondisi;

  if (mengandungBahaya === null || mengandungBahaya === undefined) {
    terapkan(BAHAYA_TIDAK_DIKETAHUI);
  } else if (mengandungBahaya === true) {
    const dikenal = jenisBahaya.filter((j) => ATURAN_BAHAYA[j]);
    // Jaga-jaga: jawab "ya" tapi jenisnya kosong/tidak dikenal → perlakukan seperti "tidak tahu"
    if (dikenal.length === 0) terapkan(BAHAYA_TIDAK_DIKETAHUI);
    dikenal.forEach((j) => terapkan(ATURAN_BAHAYA[j]));
  }

  // Aturan keselamatan tambahan dari admin
  for (const aturan of aturanEliminasiDb) {
    dibuang.add(aturan.tindakan);
    peringatan.push(aturan.alasan);
  }

  // Pakai urutan TINDAKAN biar hasilnya selalu konsisten
  const tindakanDieliminasi = TINDAKAN.filter((t) => dibuang.has(t));

  return {
    adaBahaya: tindakanDieliminasi.length > 0,
    tindakanDieliminasi,
    peringatan: [...new Set(peringatan)], // buang peringatan dobel
  };
}

module.exports = { periksaKeselamatan, ATURAN_BAHAYA };
