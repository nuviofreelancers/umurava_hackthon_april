import mongoose from "mongoose";
declare const ScreeningResult: mongoose.Model<{
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
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
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
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
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
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
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    job_id: mongoose.Types.ObjectId;
    applicant_id: mongoose.Types.ObjectId;
    applicant_name: string;
    rank: number;
    match_score: number;
    skills_score: number;
    experience_score: number;
    education_score: number;
    relevance_score: number;
    confidence_level: "High" | "Medium" | "Low";
    recommendation: string;
    strengths: string[];
    gaps: mongoose.Types.DocumentArray<{
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, unknown, {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }, {}, {}> & {
        type: "" | "dealbreaker" | "nice-to-have";
        description: string;
    }>;
    bias_flags: string[];
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default ScreeningResult;
//# sourceMappingURL=ScreeningResult.d.ts.map