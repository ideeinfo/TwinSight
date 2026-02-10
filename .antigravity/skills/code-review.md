---
name: code-review
description: Checklist for validating code changes. Use before verifying or committing code.
---
# Code Review Checklist

## 1. Correctness
- [ ] Does the code met the user's requirements?
- [ ] Are edge cases handled (e.g., null/undefined checks)?
- [ ] data types consistent?

## 2. Style & Naming (Refer to project-rules)
- [ ] Variable names in camelCase?
- [ ] DB columns in snake_case?
- [ ] Comments in Chinese?

## 3. Security
- [ ] No hardcoded secrets (.env used)?
- [ ] Input validation present?

## 4. Performance
- [ ] No unnecessary re-renders?
- [ ] Efficient DB queries?
