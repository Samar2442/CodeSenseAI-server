# 🚀 CodeSense AI – Server (Backend)

CodeSense AI is an AI-powered code review platform.
This repository contains the **backend (server)** responsible for authentication, API handling, database management, and AI-powered code analysis.

---

## 🌟 Features

* 🔐 JWT Authentication (Login / Register)
* 🧠 AI Code Review API (Groq / OpenAI)
* 📊 Code Analysis (Score + Issues Detection)
* 📜 Review History Storage
* 🛡️ Secure Protected Routes (Middleware)
* ⚡ Fast API with Express
* 🗄️ Database Integration (Prisma ORM)
* 🔄 RESTful API Architecture

---

## 🧱 Tech Stack

* 🟢 Node.js
* 🚀 Express.js
* 🗄️ Prisma ORM
* 🧾 SQLite / PostgreSQL
* 🔐 JWT (Authentication)
* 🤖 AI Integration (Groq / OpenAI)
* 🌍 REST API

---

## 📂 Project Structure

```id="3yx9d6"
server/
│── src/
│   ├── controllers/        # Route Controllers
│   ├── routes/             # API Routes
│   ├── middleware/         # Auth Middleware
│   ├── services/           # AI Logic (ai.service.ts)
│   ├── prisma/             # Prisma Client Setup
│   ├── utils/              # Helper Functions
│   └── index.ts            # Entry Point
│
├── prisma/
│   └── schema.prisma       # Database Schema
│
├── .env                    # Environment Variables
├── package.json
└── tsconfig.json
```

---

## ⚙️ Installation & Setup

### 1️⃣ Navigate to Server Folder

```id="6x2e8f"
cd server
```

---

### 2️⃣ Install Dependencies

```id="o6i7v2"
npm install
```

---

### 3️⃣ Configure Environment Variables

Create a `.env` file in `/server`:

```id="zfw4tr"
PORT=5000
DATABASE_URL="file:dev.db"
JWT_SECRET="your_secret_key"
GROQ_API_KEY=your_groq_api_key
```

---

### 4️⃣ Setup Database (Prisma)

```id="k3svk1"
npx prisma generate
npx prisma migrate dev
```

---

### 5️⃣ Run Server

```id="1h98hb"
npm run dev
```

---

## 🌐 Server URL

```id="psg9zd"
http://localhost:5000
```

---

## 🔗 API Endpoints

### 🔐 Auth Routes

```id="2nn8h2"
POST /api/auth/register
POST /api/auth/login
```

---

### 🤖 Code Review

```id="1y3j7r"
POST /api/code-review
```

**Request Body:**

```json id="a9qx4k"
{
  "code": "your code here",
  "language": "javascript"
}
```

---

### 📜 History

```id="4ycb2c"
GET /api/history
```

(Protected route – requires JWT token)

---

## 🔐 Authentication Flow

* User registers or logs in
* Server generates JWT token
* Token sent to client
* Client stores token
* Token used for protected routes

---

## 🧠 AI Code Review Flow

1. Request received at `/api/code-review`
2. Controller processes request
3. `ai.service.ts` sends code to AI (Groq/OpenAI)
4. AI returns analysis
5. Response stored in database
6. Result sent back to frontend

---

## 🛡️ Middleware

* JWT verification for protected routes
* Request validation
* Error handling

---

## 🧪 Debug Tips

* Check terminal logs for errors
* Verify `.env` variables
* Ensure database is connected
* Check API responses using Postman

---

## 🚀 Future Enhancements

* 📊 Advanced analytics (code quality trends)
* 🤖 Multi-model AI support
* 📁 File upload parsing
* 🔐 OAuth authentication (Google/GitHub)
* ⚡ Rate limiting & caching
* 🧾 Export reports (PDF/JSON)

---

## 💡 Author

**Samaresh Debnath**

---

🔥 Powering intelligent code reviews.
