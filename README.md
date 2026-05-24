# Enterprise Payroll & HR Management System

A comprehensive, fully responsive, enterprise-grade HR & Payroll management application built with React, Tailwind CSS, and Supabase.

## Features

1.  **Dashboard**: Rich overview of HR activities, headcounts, and key metrics with interactive charts.
2.  **User Authentication**: Role-based access control with secure Supabase Auth integration (Admin/HR/Employee).
3.  **Employee Management**: Manage profiles, documents, bank details, organization structure, and track probation periods.
4.  **Attendance & Time Tracking**: Web Punch-In with IP logging, visual calendar grid, and manager approval for regularization requests.
5.  **Leave Management**: Accrual tracking, balance history, and multi-level approval workflows.
6.  **Payroll & Salary Processing**: State-aware Professional Tax, PF/ESI deductions, Income Tax (TDS), and automated bulk processing.
7.  **Statutory Compliance**: Automated generation of Form 16, EPFO ECR, ESIC registers, and State-wise PT/LWF slabs.
8.  **Employee Self-Service (ESS) Portal**: Let employees view payslips, declare taxes, manage time off, request regularization, and initiate resignations.
9.  **Company Settings**: Whitelabel branding with custom logos and legal identifiers for enterprise use.
10. **PWA Support**: Installable Progressive Web App for desktop and mobile access.

## Tech Stack

-   **Frontend**: React 19 (Vite)
-   **Styling**: Tailwind CSS 4
-   **Backend/Database**: Supabase (PostgreSQL + Auth + Storage)
-   **Routing**: React Router DOM v6
-   **Icons**: Lucide React
-   **Date Handling**: native JS Date & intelligent formatting
-   **PDF Generation**: jsPDF + autoTable
-   **PWA**: Standard Service Worker integration

## Setup Instructions

### 1. Prerequisites
-   Node.js (v16+)
-   NPM
-   A Supabase Account

### 2. Installation

1.  Clone the repository or navigate to the project directory.
2.  Install dependencies:
    ```bash
    npm install
    ```

### 3. Database Setup (Supabase)

1.  Create a new project in Supabase.
2.  Go to the **SQL Editor** in your Supabase dashboard.
3.  Copy the contents of `db/schema.sql` and run it. This will create all necessary tables and security policies.
4.  Go to **Project Settings > API**.
5.  Copy the `Project URL` and `anon public` Key.

### 4. Configuration

1.  Create a `.env` file in the root directory (copy `.env.example` if it exists).
2.  Add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

### 5. Running the Application

1.  Start the development server:
    ```bash
    npm run dev
    ```
2.  Open your browser at `http://localhost:5173`.

## Usage Guide

-   **Login**: Use the login page to sign in. New users can sign up via Supabase Auth (or you can enable signup in the UI if extended).
-   **Admin Access**: By default, the schema assigns 'employee' role. You can manually update the `role` column in the `profiles` table to 'admin' for your user to unlock management features.

## Project Structure

-   `src/components`: Reusable UI components.
-   `src/layouts`: Layout wrappers (Sidebar, etc.).
-   `src/pages`: Feature-specific pages.
-   `src/context`: React Context providers (Auth).
-   `src/lib`: Utility libraries (Supabase client).

## License

MIT
