# FYP UI (Next.js)

Next.js frontend for the career counseling project.

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure the backend URL

Create `.env.local` (see `.env.example`) and set the backend base URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8002
```

`8002` matches the backend README default. If you run the backend on a different port, update the value accordingly.

### 3) Run the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.
