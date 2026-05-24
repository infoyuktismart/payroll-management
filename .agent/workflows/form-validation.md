---
description: How to implement project-standard real-time validation for forms
---

# Form Validation Workflow

Follow these steps to implement the standardized `validateField` pattern in any new form component.

## 1. Initialize Errors State
```javascript
const [errors, setErrors] = useState({});
```

## 2. Implement the `validateField` Helper
Refer to [VALIDATION_STANDARDS.md](../../VALIDATION_STANDARDS.md) for specific regex patterns.

```javascript
const validateField = (name, value) => {
    let error = '';
    switch (name) {
        case 'first_name':
            if (!value || value.trim().length < 2) {
                error = 'First name is required (min 2 characters)';
            } else if (!/^[A-Za-z\s]+$/.test(value)) {
                error = 'First name must contain only letters';
            }
            break;
        case 'phone':
            if (!value) {
                error = 'Phone number is required';
            } else if (!/^\d{10}$/.test(value)) {
                error = 'Phone number must be exactly 10 digits';
            }
            break;
        // Add cases for other fields...
    }
    return error;
};
```

## 3. Update Input Handler
Trigger real-time validation in your `handleChange` function.

```javascript
const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Real-time validation
    const fieldError = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: fieldError }));
};
```

## 4. Full Form Validation on Submit
```javascript
const validate = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
        const error = validateField(key, formData[key]);
        if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
};

const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Proceed with submission...
};
```

## 5. UI Integration
Apply the `border-red-500` class and display the error message.

```jsx
<input 
    className={`... ${errors.first_name ? 'border-red-500' : 'border-gray-100'}`}
    name="first_name"
    onChange={handleInputChange}
/>
{errors.first_name && <p className="text-red-500 text-[10px] uppercase">{errors.first_name}</p>}
```
