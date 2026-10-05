# CAB CRM — frontend/backend connection

## Local Windows setup

1. Open PowerShell in this project folder.
2. Import/create the MySQL database using `backend/database/schema.sql`.
3. Set backend environment variables from `backend/.env.example`.
4. Run the new migration:

```powershell
php backend/database/migrations/005_notes_and_call_sync.php
```

5. Start PHP:

```powershell
php -S localhost:8000 -t backend backend/router.php
```

6. In another PowerShell window:

```powershell
npm install
npm run dev
```

The web app uses `http://localhost:8000/api` by default. Change `VITE_API_BASE_URL` for a deployed backend.

## Netlify

Set the Netlify environment variable:

`VITE_API_BASE_URL=https://YOUR-BACKEND-HOST/api`

Do not set it to `https://cab-crm-frontend.netlify.app`; that is the frontend URL.

## Security

Do not commit backend `.env` files, database credentials, SMTP passwords, session cookies, CSRF tokens, or real user passwords.
