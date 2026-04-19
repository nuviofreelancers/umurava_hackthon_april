import mongoose from "mongoose";
declare const Applicant: mongoose.Model<{
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, {
    timestamps: true;
    toJSON: {
        virtuals: true;
    };
    toObject: {
        virtuals: true;
    };
}> & Omit<{
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
    toJSON: {
        virtuals: true;
    };
    toObject: {
        virtuals: true;
    };
}, {
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, Omit<mongoose.DefaultSchemaOptions, "timestamps" | "toJSON" | "toObject"> & {
    timestamps: true;
    toJSON: {
        virtuals: true;
    };
    toObject: {
        virtuals: true;
    };
}> & Omit<{
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    email: string;
    full_name: string;
    location: string;
    skills: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
        yearsOfExperience?: number | null;
    }>;
    experience: mongoose.Types.DocumentArray<{
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }, {}, {}> & {
        role?: string | null;
        company?: string | null;
        startDate?: string | null;
        endDate?: string | null;
    }>;
    education: mongoose.Types.DocumentArray<{
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }, {}, {}> & {
        year?: string | null;
        institution?: string | null;
        degree?: string | null;
        field?: string | null;
    }>;
    phone: string;
    current_role: string;
    current_company: string;
    experience_years: number;
    headline: string;
    bio: string;
    education_level: "" | "High School" | "Associate" | "Bachelor" | "Master" | "PhD" | "Other";
    education_field: string;
    portfolio_url: string;
    certifications: mongoose.Types.DocumentArray<{
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }, {}, {}> & {
        name?: string | null;
        year?: string | null;
        issuer?: string | null;
    }>;
    languages: mongoose.Types.DocumentArray<{
        name?: string | null;
        level?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        level?: string | null;
    }, {}, {}> & {
        name?: string | null;
        level?: string | null;
    }>;
    projects: mongoose.Types.DocumentArray<{
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }, {}, {}> & {
        name?: string | null;
        description?: string | null;
        url?: string | null;
    }>;
    interview_status: "not_scheduled" | "scheduled" | "completed" | "cancelled";
    interview_platform: "" | "Online" | "In Person";
    interview_link: string;
    interview_location: string;
    interview_notes: string;
    profile_completeness: number;
    sourceType: "manual" | "pdf" | "csv" | "json";
    userId?: mongoose.Types.ObjectId | null;
    socialLinks?: {
        linkedin: string;
        github: string;
        website: string;
    } | null;
    interview_date?: string | null;
    interview_time?: string | null;
    interview_reminder_at?: NativeDate | null;
    availability?: {
        type: string;
        status: string;
    } | null;
    jobId?: mongoose.Types.ObjectId | null;
    rawText?: string | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default Applicant;
//# sourceMappingURL=Applicant.d.ts.map