# Local Setup & Run Guide

Follow these steps to get the **Payroll Management System** running on your local machine.

## 1. Prerequisites
Ensure you have the following installed:
- **Node.js** (v18 or higher recommended)
- A **Supabase** account and project

## 2. Install Dependencies
Open your terminal in the project root directory and run:
```bash
npm install
```

## 3. Supabase Database Setup
Before running the app, you MUST set up your database schema in the [Supabase SQL Editor](https://app.supabase.com/).

Run the following scripts from the `db/` folder in this order:
1. `schema.sql` (Initial core structure)
2. `migration_leave_balance.sql` (Added recently for leave tracking)
3. `create_holidays_table.sql` (Added recently for holiday logic)
4. `sync_existing_leaves.sql` (To sync any data you entered previously)
5. *Any other scripts if you haven't run them already (e.g., Reports, Payroll tables).*

## 4. Environment Variables
Create a file named `.env` in the root directory (one is already there, but ensure it has your correct keys):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```
> [!TIP]
> You can find these keys in your Supabase Dashboard under **Project Settings** -> **API**.

## 5. Run the Application
Start the development server:
```bash
npm run dev
```

The app should now be running at `http://localhost:5173`.

---

## Troubleshooting
- **PowerShell "running scripts is disabled" Error:** This is a Windows security setting. Run this command in your terminal to fix it for the current session:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
  ```
- **White Screen / Console Errors:** Ensure your `.env` keys are correct and you've run the SQL migrations in Supabase.
- **Login Issues:** Ensure you have created a regular user in the Supabase **Authentication** tab or that you are using a valid email/password.
