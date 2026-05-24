# Project Validation Standards

This document outlines the standard validation rules to be implemented across all forms in this project to ensure data integrity and a consistent user experience.

## 1. Core Field Types

### A. Name Fields (First Name, Last Name, Contact Person)
- **Rule**: Must contain only alphabetical characters and spaces.
- **Regex**: `/^[A-Za-z\s]+$/`
- **Error**: "{Field Name} must contain only letters"

### B. Email Address
- **Rule**: Standard RFC 5322 pattern.
- **Regex**: `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`
- **Error**: "Please enter a valid email address (e.g., name@company.com)"

### C. Phone Numbers (Primary & Emergency)
- **Rule**: Exactly 10 numeric digits.
- **Regex**: `/^\d{10}$/`
- **Error**: "{Field Name} must be exactly 10 digits"
- **Constraint**: Use `maxLength={10}` on input.

### D. Government IDs (India)
- **PAN Number**: `/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/` (Case-insensitive check, usually auto-uppercased)
- **Aadhaar Number**: Strict 12 digits (`/^\d{12}$/`)
- **UAN/ESI**: Numeric strings (verify specific length if required).

### E. Financial Inputs (Salary, Amounts)
- **Rule**: Positive numbers only.
- **Error**: "{Field Name} must be a positive number"

### F. Addresses
- **Rule**: Minimum 10 characters for meaningful input.
- **Error**: "{Field Name} is required (min 10 characters)"

## 2. Implementation Guidelines

1. **Real-time Feedback**: Always implement validation in `onChange` (or `handleInputChange`) to provide immediate feedback.
2. **Visual Indicators**: Highlight invalid fields with a red border (`border-red-500`) and display error text in red below the input.
3. **Submission Blocking**: The form must perform a full validation check before allowing submission.
4. **Helper Pattern**: Use a `validateField(name, value)` helper function to keep logic centralized.
