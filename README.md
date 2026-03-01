# Academic Resource Hub

Academic Resource Hub is a full-stack college portal for managing assignments, study materials, users, notifications, and department workflows.

It includes role-based access for Website Manager, Department Admin (HOD), Faculty, and Students, with OTP-based password reset and WhatsApp reminder automation for assignment due dates.

## Tech Stack

- **Frontend:** React (Vite), MUI, React Router, Axios
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth
- **Storage:** Cloudinary (materials/assignments uploads)
- **Messaging:** Nodemailer (OTP email), Twilio WhatsApp (assignment reminders)
- **Scheduling:** node-cron

## Core Features

- Role-based login and protected routes
- Department-scoped user management (students/faculty)
- Year/section/batch aware student management
- Study materials upload, download, and subject filtering
- Assignments upload and student acknowledgement workflow
- Faculty receives student acknowledgement notifications
- Forgot password with OTP (cooldown + lockout)
- Automated assignment reminders:
	- Due tomorrow
	- Due today
	- WhatsApp send status logs
- Reminder logs UI for faculty/admin/hod

## Project Structure

```text
academic-resource-hub/
├─ client/                 # React app
│  ├─ src/pages/           # App pages (Assignments, Notifications, Materials, etc.)
│  └─ ...
├─ server/                 # Express API
│  ├─ models/              # Mongoose schemas
│  ├─ routes/              # API routes
│  ├─ cron/                # Scheduled reminder jobs
│  ├─ utils/               # Helper utilities (WhatsApp, etc.)
│  └─ scripts/             # Utility scripts
├─ TESTING_GUIDE.md
└─ README.md
```

## Prerequisites

- Node.js 18+
- MongoDB running locally or accessible URI
- Cloudinary account
- Gmail App Password (for OTP mail) or another SMTP provider
- Twilio account with WhatsApp sandbox/approved sender

## Setup

### 1) Backend

```powershell
cd server
npm install
```

Create env file:

```powershell
copy .env.example .env
```

Edit `.env` with your real credentials.

Run backend:

```powershell
npm start
```

### 2) Frontend

```powershell
cd client
npm install
npm run dev
```

## Environment Variables (Server)

Use `server/.env.example` as template.

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
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `REMINDER_TIMEZONE` (optional, default `Asia/Kolkata`)

## Reminder Automation Notes

- Reminder job runs once on server startup and then every 5 minutes.
- Notifications are generated for matching class (`department + year + section`) for:
	- due today
	- due tomorrow
- Reminder logs are visible from **Notifications → Reminder Logs**.
- Expired reminder logs are auto-cleaned after due date.

## Scripts

### Server

- `npm start` - start API server
- `npm run dev` - start with nodemon
- `npm test` - run test suite
- `npm run seed` - seed sample data

### Client

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build

## API Highlights

- `POST /api/auth/login`
- `POST /api/auth/forgot-password/request-otp`
- `POST /api/auth/forgot-password/reset`
- `GET /api/materials`
- `POST /api/materials/upload`
- `GET /api/assignments`
- `POST /api/assignments/upload`
- `POST /api/assignments/:id/acknowledge`
- `GET /api/notifications`
- `POST /api/notifications/test-whatsapp`
- `GET /api/notifications/reminder-logs`

## Security Notes

- Never commit real secrets in `.env` or `.env.example`.
- Rotate any credential that was previously exposed.
- Use environment-specific secrets in production.

## License

For academic/internal project use.
