"use strict";
/**
 * Checks whether an AI-extracted candidate meets the standardised resume schema.
 * Returns the candidate annotated with _nonStandard and _missingFields if it fails.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateResume = validateResume;
// Fields that must be present for a resume to be considered "standard"
const REQUIRED_FIELDS = [
    { key: "full_name", label: "Full name" },
    { key: "email", label: "Email address" },
    { key: "current_role", label: "Current / most recent role" },
    { key: "experience_years", label: "Years of experience" },
    { key: "skills", label: "Skills (at least one)" },
];
// Fields that are strongly recommended but not dealbreakers
const RECOMMENDED_FIELDS = [
    { key: "education_level", label: "Education level" },
    { key: "location", label: "Location" },
    { key: "experience", label: "Work experience history" },
];
function isMissing(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === "string" && value.trim() === "")
        return true;
    if (Array.isArray(value) && value.length === 0)
        return true;
    if (typeof value === "number" && value === 0 && value !== undefined)
        return false; // 0 years is valid
    return false;
}
function validateResume(candidate) {
    const missingRequired = [];
    const missingRecommended = [];
    for (const field of REQUIRED_FIELDS) {
        if (isMissing(candidate[field.key])) {
            missingRequired.push(field.label);
        }
    }
    for (const field of RECOMMENDED_FIELDS) {
        if (isMissing(candidate[field.key])) {
            missingRecommended.push(field.label);
        }
    }
    const isNonStandard = missingRequired.length > 0;
    return {
        ...candidate,
        _nonStandard: isNonStandard,
        _missingFields: missingRequired,
        _missingRecommended: missingRecommended,
    };
}
//# sourceMappingURL=resumeValidator.js.map