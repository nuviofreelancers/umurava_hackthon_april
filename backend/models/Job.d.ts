import mongoose from "mongoose";
declare const Job: mongoose.Model<{
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
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
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
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
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
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
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    description: string;
    userId: mongoose.Types.ObjectId;
    title: string;
    department: string;
    location: string;
    employment_type: "" | "Full-time" | "Part-time" | "Contract" | "Internship";
    experience_level: string;
    required_skills: string[];
    preferred_skills: string[];
    currency_symbol: string;
    status: "Draft" | "Active" | "Paused" | "Closed";
    salary_range_min?: number | null;
    salary_range_max?: number | null;
    screening_weights?: {
        skills: number;
        experience: number;
        education: number;
        relevance: number;
    } | null;
    last_screened_at?: NativeDate | null;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default Job;
//# sourceMappingURL=Job.d.ts.map