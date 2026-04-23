/**
 * Normalize an AI-extracted CV, a URL-scraped candidate, or Umurava-format
 * JSON export into the internal Applicant schema shape.
 * Handles both camelCase and Umurava's "Space Case" field names.
 */
export function normalizeCandidate(raw: Record<string, unknown>): Record<string, unknown> {
  const r = raw as Record<string, unknown>;

  // ── Name ──────────────────────────────────────────────────────────────────
  const firstName  = (r["firstName"] ?? r["first_name"] ?? r["First Name"] ?? "") as string;
  const lastName   = (r["lastName"]  ?? r["last_name"]  ?? r["Last Name"]  ?? "") as string;
  const fullName   = (r["full_name"] ?? r["fullName"]   ?? r["Full Name"]  ?? `${firstName} ${lastName}`.trim()) as string;

  // ── Skills ────────────────────────────────────────────────────────────────
  const rawSkills = (r["skills"] ?? []) as Array<unknown>;
  const skills = rawSkills.map((s) => {
    if (typeof s === "string") return { name: s, level: "Intermediate" };
    const sk = s as Record<string, unknown>;
    return {
      name:              String(sk.name ?? sk.Name ?? ""),
      level:             String(sk.level ?? sk.Level ?? "Intermediate"),
      yearsOfExperience: sk.yearsOfExperience ?? sk["Years of Experience"] ?? undefined,
    };
  }).filter((s) => s.name);

  // ── Languages ─────────────────────────────────────────────────────────────
  const rawLangs = (r["languages"] ?? []) as Array<unknown>;
  const languages = rawLangs.map((l) => {
    if (typeof l === "string") return { name: l, proficiency: "Conversational" };
    const la = l as Record<string, unknown>;
    return {
      name:        String(la.name ?? la.Name ?? ""),
      proficiency: String(la.proficiency ?? la.Proficiency ?? "Conversational"),
    };
  }).filter((l) => l.name);

  // ── Experience ────────────────────────────────────────────────────────────
  const rawExp = (r["experience"] ?? r["workExperience"] ?? []) as Array<unknown>;
  const experience = rawExp.map((e) => {
    const ex = e as Record<string, unknown>;
    return {
      company:     String(ex.company     ?? ex.Company     ?? ""),
      role:        String(ex.role        ?? ex.Role        ?? ex.title ?? ""),
      startDate:   String(ex.startDate   ?? ex["Start Date"] ?? ""),
      endDate:     String(ex.endDate     ?? ex["End Date"]   ?? "Present"),
      description: String(ex.description ?? ex.Description  ?? ""),
      technologies: Array.isArray(ex.technologies) ? ex.technologies : [],
      isCurrent:   Boolean(ex.isCurrent  ?? ex["Is Current"] ?? ex.endDate === "Present"),
    };
  }).filter((e) => e.company || e.role);

  // ── Education ─────────────────────────────────────────────────────────────
  const rawEdu = (r["education"] ?? []) as Array<unknown>;
  const education = rawEdu.map((e) => {
    const ed = e as Record<string, unknown>;
    return {
      institution: String(ed.institution  ?? ed.Institution  ?? ""),
      degree:      String(ed.degree       ?? ed.Degree       ?? ""),
      fieldOfStudy:String(ed.fieldOfStudy ?? ed["Field of Study"] ?? ed.field ?? ""),
      startYear:   ed.startYear   ?? ed["Start Year"]  ?? undefined,
      endYear:     ed.endYear     ?? ed["End Year"]    ?? ed.year ?? undefined,
    };
  }).filter((e) => e.institution || e.degree);

  // ── Certifications ────────────────────────────────────────────────────────
  const rawCerts = (r["certifications"] ?? []) as Array<unknown>;
  const certifications = rawCerts.map((c) => {
    const ce = c as Record<string, unknown>;
    return {
      name:      String(ce.name      ?? ce.Name      ?? ""),
      issuer:    String(ce.issuer    ?? ce.Issuer    ?? ""),
      issueDate: String(ce.issueDate ?? ce["Issue Date"] ?? ce.date ?? ""),
    };
  }).filter((c) => c.name);

  // ── Projects ──────────────────────────────────────────────────────────────
  const rawProj = (r["projects"] ?? []) as Array<unknown>;
  const projects = rawProj.map((p) => {
    const pr = p as Record<string, unknown>;
    return {
      name:         String(pr.name        ?? pr.Name        ?? ""),
      description:  String(pr.description ?? pr.Description ?? ""),
      technologies: Array.isArray(pr.technologies) ? pr.technologies : [],
      role:         String(pr.role  ?? pr.Role  ?? ""),
      link:         String(pr.link  ?? pr.Link  ?? pr.url ?? pr.URL ?? ""),
      startDate:    String(pr.startDate  ?? pr["Start Date"] ?? ""),
      endDate:      String(pr.endDate    ?? pr["End Date"]   ?? ""),
    };
  }).filter((p) => p.name);

  // ── Availability ──────────────────────────────────────────────────────────
  const rawAvail = (r["availability"] ?? {}) as Record<string, unknown>;
  const availability = {
    status:    String(rawAvail.status    ?? rawAvail.Status    ?? "Available"),
    type:      String(rawAvail.type      ?? rawAvail.Type      ?? "Full-time"),
    startDate: rawAvail.startDate ?? rawAvail["Start Date"] ?? undefined,
  };

  // ── Social Links ──────────────────────────────────────────────────────────
  const rawSocial = (r["socialLinks"] ?? r["social_links"] ?? {}) as Record<string, unknown>;
  const socialLinks = {
    linkedin:  rawSocial.linkedin  ?? undefined,
    github:    rawSocial.github    ?? undefined,
    portfolio: rawSocial.portfolio ?? undefined,
    website:   rawSocial.website   ?? undefined,
    twitter:   rawSocial.twitter   ?? undefined,
  };

  // ── Education level normalization ─────────────────────────────────────────
  const eduLevelRaw = String(r["education_level"] ?? r["educationLevel"] ?? "").toLowerCase();
  const eduLevelMap: Record<string, string> = {
    bachelor: "Bachelor", bachelors: "Bachelor", "bachelor's": "Bachelor", bsc: "Bachelor", ba: "Bachelor",
    master:   "Master",   masters:   "Master",   "master's":   "Master",   msc: "Master",   mba: "Master",
    phd:      "PhD",      doctorate: "PhD",      doctoral:     "PhD",
    associate:"Associate",
    "high school": "High School", secondary: "High School",
  };
  const education_level = Object.entries(eduLevelMap).find(([k]) => eduLevelRaw.includes(k))?.[1] ?? "";

  return {
    full_name:    fullName,
    first_name:   firstName || fullName.split(" ")[0],
    last_name:    lastName  || fullName.split(" ").slice(1).join(" "),
    email:        String(r["email"] ?? r["Email"] ?? "").toLowerCase().trim(),
    phone:        String(r["phone"] ?? r["Phone"] ?? r["phone_number"] ?? ""),
    headline:     String(r["headline"] ?? r["Headline"] ?? r["current_role"] ?? ""),
    bio:          String(r["bio"] ?? r["Bio"] ?? r["summary"] ?? ""),
    location:     String(r["location"] ?? r["Location"] ?? ""),
    current_role:     String(r["current_role"] ?? r["currentRole"] ?? ""),
    current_company:  String(r["current_company"] ?? r["currentCompany"] ?? ""),
    experience_years: Number(r["experience_years"] ?? r["experienceYears"] ?? 0) || 0,
    skills,
    languages,
    experience,
    education,
    certifications,
    projects,
    availability,
    socialLinks,
    education_level,
    education_field: String(r["education_field"] ?? r["educationField"] ?? ""),
    portfolio_url: String(r["portfolio_url"] ?? r["portfolioUrl"] ?? socialLinks.portfolio ?? ""),
  };
}
