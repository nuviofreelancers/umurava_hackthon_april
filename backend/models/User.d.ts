import mongoose from "mongoose";
declare const User: mongoose.Model<{
    email: string;
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
} & mongoose.DefaultTimestampProps, {}, {}, {
    id: string;
}, mongoose.Document<unknown, {}, {
    email: string;
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
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
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
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
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    email: string;
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
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
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, unknown, {
    email: string;
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>, {
    email: string;
    password: string;
    full_name: string;
    role: "admin" | "hr" | "recruiter";
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export default User;
//# sourceMappingURL=User.d.ts.map