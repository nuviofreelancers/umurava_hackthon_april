export interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/** Validate that a parsed CV has the minimum required fields */
export function validateResume(cv: Record<string, unknown>): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!cv.full_name && !(cv.first_name && cv.last_name)) missing.push("name");
  if (!cv.email) missing.push("email");
  if (!cv.headline) warnings.push("headline missing — will be auto-generated");
  if (!cv.location) warnings.push("location not found");
  if (!(cv.skills as unknown[])?.length) warnings.push("no skills extracted");
  if (!(cv.experience as unknown[])?.length) warnings.push("no work experience found");
  if (!(cv.education as unknown[])?.length) warnings.push("no education history found");

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}
