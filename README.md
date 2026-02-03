# Shop API - E-commerce Backend 

A scalable and robust E-commerce Backend API engineered with **NestJS**. This project orchestrates comprehensive product management, shopping cart functionality, complex order processing, and secure user authentication, adhering to industry-standard security practices.

##  Tech Stack

- **Framework:** [NestJS](https://nestjs.com/) (Node.js Framework)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/)
- **Caching:** Redis
- **Authentication:** JWT (JSON Web Tokens) & Passport
- **Security:** Helmet, Bcrypt, CORS
- **Documentation:** Swagger UI (OpenAPI)
- **Containerization:** Docker & Docker Compose

##  Key Features

- **Authentication & Authorization**
  - Secure Registration & Login flow using JWT.
  - **Role-Based Access Control (RBAC):** Distinct permissions for Admin and User roles.
  - Advanced password security utilizing **Bcrypt** hashing.
  
- **Product Management**
  - Full CRUD operations (Create, Read, Update, Delete) for products.
  - Real-time inventory and stock management.
  - **Financial Accuracy:** Utilizes Decimal data types for precise pricing calculations.

- **Shopping Cart**
  - Seamless item addition to the user's cart.
  - **Auto-Validation:** Automatically checks stock availability before adding items.
  - Dynamic total price calculation.

- **Order System**
  - **Atomic Transactions:** Leverages Prisma Transactions to ensure stock is deducted *only* when an order is successfully created, preventing data inconsistency.
  - Comprehensive Order Status workflow (Pending, Paid, Shipped, Delivered, Canceled).
  - User-initiated order cancellation with automatic stock restoration.
  - Administrative capabilities for updating order status.

##  Prerequisites

Before initializing the project, ensure the following environments are installed on your machine:
- [Node.js](https://nodejs.org/) (v16 or newer)
- [Docker Desktop](https://www.docker.com/) (Required for running PostgreSQL & Redis)
- [Git](https://git-scm.com/)

## 📦 Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone [https://github.com/adibayuluthfiansyah/shopapi.git](https://github.com/adibayuluthfiansyah/shopapi.git)
   cd shopapi
Install Dependencies

Bash
npm install
Configure Environment Variables Create a .env file in the root directory and configure it as follows:

Cuplikan kode
# Database (Ensure this matches your docker-compose config)
DATABASE_URL="postgresql://namedb:passworddb@localhost:5433/shopapi_db"

# Security
JWT_SECRET="change-this-to-a-secure-random-string"

# Caching
REDIS_HOST="localhost"
REDIS_PORT=6379

# Frontend Integration
FRONTEND_URL="http://localhost:3000"

# Server Port
# Use a different port (e.g., 4000) to avoid conflict with Next.js/Frontend (port 3000)
PORT=4000
Initialize Database Services (Docker) Launch PostgreSQL and Redis containers instantly using Docker Compose:

Bash
docker-compose up -d
Run Database Migrations Push the schema to your PostgreSQL database:

Bash
npx prisma migrate dev --name init
Start the Server

Bash
npm run start:dev
The server will be accessible at http://localhost:4000.

API Documentation (Swagger)
Comprehensive API documentation is automatically generated via Swagger UI. Once the server is running, you can access endpoints, view data schemas, and test requests directly at:

 http://localhost:4000/api/docs

 Project Structure
Bash
src/
├── auth/          # Authentication Logic (Login/Register/Guards)
├── cart/          # Shopping Cart Management
├── category/      # Product Category Management
├── order/         # Order Processing & Transactions
├── product/       # Product & Inventory Management
├── prisma/        # Database Configuration & Services
├── main.ts        # Entry point & Global Config (Swagger/CORS)
└── app.module.ts  # Root Application Module