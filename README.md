# Shop API - E-commerce Backend 

Backend API skalabel untuk aplikasi E-commerce, dibangun menggunakan **NestJS**. Project ini menangani manajemen produk, keranjang belanja, pesanan (orders), dan autentikasi pengguna dengan keamanan tingkat industri.

## Tech Stack

- **Framework:** [NestJS](https://nestjs.com/) (Node.js Framework)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/)
- **Caching:** Redis
- **Authentication:** JWT (JSON Web Tokens) & Passport
- **Security:** Helmet, Bcrypt, CORS
- **Documentation:** Swagger UI (OpenAPI)
- **Containerization:** Docker & Docker Compose

## Fitur Utama

- **Authentication & Authorization**
  - Register & Login (JWT).
  - Role-Based Access Control (Admin vs User).
  - Password Hashing dengan Bcrypt.
  
- **Product Management**
  - CRUD Produk (Create, Read, Update, Delete).
  - Manajemen Stok Real-time.
  - Tipe data harga presisi (Decimal) untuk akurasi keuangan.

- **Shopping Cart**
  - Menambah item ke keranjang.
  - Validasi stok otomatis saat penambahan.
  - Menghitung total harga secara dinamis.

- **Order System**
  - **Atomic Transactions:** Menggunakan Prisma Transaction untuk memastikan stok berkurang hanya jika order berhasil dibuat.
  - Status Order (Pending, Paid, Shipped, Delivered, Canceled).
  - User bisa membatalkan pesanan (dengan pengembalian stok otomatis).
  - Admin bisa update status pesanan.

## 🛠️ Prasyarat

Sebelum menjalankan project, pastikan Anda telah menginstall:
- [Node.js](https://nodejs.org/) (v16 atau lebih baru)
- [Docker Desktop](https://www.docker.com/) (untuk menjalankan PostgreSQL & Redis)
- [Git](https://git-scm.com/)

## 📦 Instalasi & Setup

1. **Clone Repository**
   ```bash
   git clone [https://github.com/adibayuluthfiansyah/shopapi.git](https://github.com/adibayuluthfiansyah/shopapi.git)
   cd shopapi

2. **Instal Dependencies**
   npm install

3. **Setup Environment Variables**
# Database (Sesuaikan dengan docker-compose)
DATABASE_URL="postgresql://namedatabase:password@localhost:5433/shopapi_db"
# Security
JWT_SECRET="ganti-dengan-secret-key-yang-panjang-dan-acak"
# Caching
REDIS_HOST="localhost"
REDIS_PORT=6379
# Frontend Integration
FRONTEND_URL="http://localhost:3000"
# PORT=3001
 jika kamu pakai next js, agar portnya tidak bentrok 

4. **Jalankan Database (Docker)**
docker-compose up -d

5. **Migrasi Database (Prisma)**
npx prisma migrate dev --name init

6. **Jalankan Server**
npm run start:dev

7. **Dokumentasi API Swagger**
Dokumentasi lengkap endpoint API tersedia secara otomatis melalui Swagger UI. Setelah server berjalan, buka browser dan akses:
http://localhost:4000/api/docs
Di sana Anda bisa melihat daftar endpoint, skema data, dan mencoba request langsung (Try it out).
📂 Struktur Project
src/
├── auth/          # Logika Autentikasi (Login/Register/Guards)
├── cart/          # Manajemen Keranjang Belanja
├── category/      # Manajemen Kategori Produk
├── order/         # Manajemen Pesanan & Transaksi
├── product/       # Manajemen Produk & Stok
├── prisma/        # Konfigurasi Database & Service
├── main.ts        # Entry point & Config (Swagger/CORS)
└── app.module.ts  # Root Module