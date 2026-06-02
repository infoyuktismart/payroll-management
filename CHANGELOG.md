# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2024-01-01

### Added

- Automated unit tests for taxUtils, payrollUtils, ptSlabs (Vitest)
- E2E tests for auth, payroll run, leave approval (Playwright)
- TanStack Query for server state management and caching
- src/services/ data layer abstraction
- React.lazy() code splitting for all 21 page routes
- Server-side pagination on all list endpoints
- Sentry error tracking and per-route ErrorBoundary
- withRetry utility for transient network failure recovery
- GitHub Actions CI pipeline (lint → build → test)
- husky pre-commit hooks with lint-staged
- CSP meta tag in index.html
- Auth form rate limiting
- JSDoc type definitions for all data models
- Accessibility: focus trapping, ARIA labels, sr-only loading states

### Fixed

- sanitize.js is now enforced on all form submissions
- sessionStorage replaces localStorage for payroll state
- All ESLint errors resolved
- All console.error() replaced with structured logger
