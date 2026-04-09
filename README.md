# Academic Resource Hub

Academic Resource Hub is a full-stack college portal for managing users, assignments, materials, notifications, tests, and academic workflows with role-based access.

## Highlights

- Role-based authentication for Admin, HOD, Faculty, and Students
- Department-scoped user management
- Bulk user import with CSV/Excel support
- Study materials upload and assignment workflow
- Notifications with email delivery tracking
- Reminder logs with search and CSV export
- Test management:
  - Schedule tests by year/section/batch
  - Enter and publish marks
  - Student marks view
  - Test analytics and marks export
- Activity logging with search and CSV export
- Dark mode toggle

## Tech Stack

- Frontend: React (Vite), MUI, React Router, Axios
- Backend: Node.js, Express, MongoDB (Mongoose), JWT
- File/Media: Cloudinary
- Email: Nodemailer (SMTP)
- Scheduler: node-cron

## Project Structure

```text
academic-resource-hub/
├─ client/                  # React frontend
├─ server/                  # Express backend
├─ package.json             # Root scripts for running both apps
├─ TESTING_GUIDE.md
└─ README.md
```

## Prerequisites

- Node.js 18+
- MongoDB running locally or a hosted MongoDB URI
- Cloudinary credentials (for uploads)
- SMTP credentials (for OTP and email notifications)

## Quick Start

1. Install all dependencies from project root:

```powershell
npm run install:all
```

2. Create backend env file:

```powershell
cd server
copy .env.example .env
```

3. Create frontend env file:

```powershell
cd ..\client
copy .env.example .env
```

4. In `client/.env`, set:

```env
VITE_API_URL=http://localhost:5000/api
```

5. Start both backend and frontend from project root:

```powershell
cd ..
npm run dev
```

If you see port conflict errors, run:

```powershell
npm run dev:reset
```

## Scripts

### Root

- `npm run install:all` - install root, server, and client dependencies
- `npm run dev` - run backend and frontend together
- `npm run dev:reset` - clear ports 5000/3000/3001, then run both apps
- `npm run test` - run backend test suite
- `npm run build` - build frontend production bundle

### Server

- `npm start` - start backend server
- `npm run dev` - start backend with nodemon
- `npm test` - run backend tests
- `npm run seed` - seed sample data

### Client

- `npm run dev` - start Vite dev server
- `npm run build` - build client
- `npm run preview` - preview production build

## Environment Variables

Use `server/.env.example` as a template.

Required in most setups:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Optional reminder settings:

- `REMINDER_TIMEZONE` (default: `Asia/Kolkata`)
- `REMINDER_LEAD_DAYS` (default: `2,1,0`)

## Validation

From project root:

```powershell
npm run test
npm run build
```

## Security Notes

- Never commit real secrets in `.env` files.
- Keep `client/.env`, `server/.env`, and `node_modules` out of Git.
- Rotate credentials if they were ever exposed.

## License

For academic and internal use.
