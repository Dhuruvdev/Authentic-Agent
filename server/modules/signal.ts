import type { InputClassification, InputType } from "@shared/schema";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_URL_REGEX = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
const URL_REGEX = /^https?:\/\/.+/i;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

export function classifyInput(input: string): InputClassification {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {
      type: "unknown",
      value: trimmed,
      confidence: 0,
      isValid: false,
      validationMessage: "Input is required",
    };
  }

  // Check for email
  if (EMAIL_REGEX.test(trimmed)) {
    return {
      type: "email",
      value: trimmed.toLowerCase(),
      confidence: 0.95,
      isValid: true,
    };
  }

  // Check for image URL
  if (IMAGE_URL_REGEX.test(trimmed)) {
    return {
      type: "image_url",
      value: trimmed,
      confidence: 0.9,
      isValid: true,
    };
  }

  // Check for general URL (might be image)
  if (URL_REGEX.test(trimmed)) {
    const looksLikeImage = trimmed.includes("image") || 
                          trimmed.includes("photo") || 
                          trimmed.includes("avatar") ||
                          trimmed.includes("img");
    return {
      type: "image_url",
      value: trimmed,
      confidence: looksLikeImage ? 0.7 : 0.5,
      isValid: true,
      validationMessage: looksLikeImage ? undefined : "URL detected, treating as potential image URL",
    };
  }

  // Check for username
  if (USERNAME_REGEX.test(trimmed)) {
    return {
      type: "username",
      value: trimmed,
      confidence: 0.85,
      isValid: true,
    };
  }

  // Fallback - treat as username if alphanumeric
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return {
      type: "username",
      value: trimmed,
      confidence: 0.6,
      isValid: true,
      validationMessage: "Treating as username",
    };
  }

  return {
    type: "unknown",
    value: trimmed,
    confidence: 0,
    isValid: false,
    validationMessage: "Unable to classify input. Please enter a valid email, username, or image URL.",
  };
}
