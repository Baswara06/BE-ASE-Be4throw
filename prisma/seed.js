require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Estimasi berat (kg) = perkiraan awal, nanti bisa dikoreksi admin
const dataKategori = [
  {
    nama: 'Elektronik',
    deskripsi: 'Perangkat listrik dan elektronik',
    barang: [
      { nama: 'Smartphone', estimasiBerat: 0.2, material: 'Elektronik' },
      { nama: 'Laptop', estimasiBerat: 2.0, material: 'Elektronik' },
      { nama: 'Kipas Angin', estimasiBerat: 3.0, material: 'Elektronik' },
    ],
  },
  {
    nama: 'Pakaian',
    deskripsi: 'Pakaian dan tekstil',
    barang: [
      { nama: 'Kaos', estimasiBerat: 0.2, material: 'Tekstil' },
      { nama: 'Celana Jeans', estimasiBerat: 0.6, material: 'Tekstil' },
      { nama: 'Jaket', estimasiBerat: 0.8, material: 'Tekstil' },
    ],
  },
  {
    nama: 'Plastik',
    deskripsi: 'Barang berbahan plastik',
    barang: [
      { nama: 'Botol Plastik', estimasiBerat: 0.03, material: 'Plastik' },
      { nama: 'Wadah Makanan Plastik', estimasiBerat: 0.15, material: 'Plastik' },
      { nama: 'Ember Plastik', estimasiBerat: 0.5, material: 'Plastik' },
    ],
  },
  {
    nama: 'Furnitur',
    deskripsi: 'Perabot rumah tangga',
    barang: [
      { nama: 'Kursi Kayu', estimasiBerat: 5.0, material: 'Kayu' },
      { nama: 'Meja Belajar', estimasiBerat: 15.0, material: 'Kayu' },
      { nama: 'Lemari Kecil', estimasiBerat: 25.0, material: 'Kayu' },
    ],
  },
];

async function main() {
  // 1. Akun admin (kredensial dari .env, bukan hardcode)
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di .env');
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {}, // kalau sudah ada, jangan diubah
    create: {
      nama: 'Admin Be4Throw',
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
    },
  });
  console.log(`✔ Admin: ${ADMIN_EMAIL}`);

  // 2. Kategori + barang contoh
  for (const k of dataKategori) {
    const kategori = await prisma.kategori.upsert({
      where: { nama: k.nama },
      update: {},
      create: { nama: k.nama, deskripsi: k.deskripsi },
    });

    for (const b of k.barang) {
      await prisma.barang.upsert({
        where: { nama_kategoriId: { nama: b.nama, kategoriId: kategori.id } },
        update: {},
        create: { ...b, kategoriId: kategori.id },
      });
    }
    console.log(`✔ Kategori ${k.nama} + ${k.barang.length} barang`);
  }
}

main()
  .catch((err) => {
    console.error('Seed gagal:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());