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

6. In another PowerShell window, from the `frontend` folder:

```powershell
npm install
npm run dev
```

`frontend/.env.example` points `VITE_API_BASE_URL` at `https://vehicocrm.gdaisolutions.com/api`. For this local PHP server, set `VITE_API_BASE_URL=http://localhost:8000/api`.

## Netlify

Set the Netlify environment variable:

`VITE_API_BASE_URL=https://vehicocrm.gdaisolutions.com/api`

Do not set it to `https://cab-crm-frontend.netlify.app`; that is the frontend URL.

## Security

Do not commit backend `.env` files, database credentials, SMTP passwords, session cookies, CSRF tokens, or real user passwords.
