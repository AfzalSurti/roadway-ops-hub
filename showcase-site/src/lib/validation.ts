const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_PATTERN = /^[6-9]\d{9}$/;

export function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function validateEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed) {
    return "Email address is required";
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email (e.g. you@company.com)";
  }
  return null;
}

export function validatePhone(phone: string) {
  const digits = normalizePhoneInput(phone);
  if (!digits) {
    return "Mobile number is required";
  }
  if (digits.length !== 10) {
    return "Mobile number must be exactly 10 digits";
  }
  if (!PHONE_PATTERN.test(digits)) {
    return "Enter a valid 10-digit mobile number (no +91)";
  }
  return null;
}

export function validateContactForm(fields: {
  name: string;
  email: string;
  phone: string;
  message: string;
}) {
  const errors: Partial<Record<"name" | "email" | "phone" | "message", string>> = {};

  if (!fields.name.trim() || fields.name.trim().length < 2) {
    errors.name = "Please enter your full name";
  }

  const emailError = validateEmail(fields.email);
  if (emailError) errors.email = emailError;

  const phoneError = validatePhone(fields.phone);
  if (phoneError) errors.phone = phoneError;

  if (!fields.message.trim() || fields.message.trim().length < 10) {
    errors.message = "Tell me about your project (at least 10 characters)";
  }

  return errors;
}
