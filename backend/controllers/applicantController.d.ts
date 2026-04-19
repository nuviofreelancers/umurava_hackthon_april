import { Request, Response } from "express";
interface AuthRequest extends Request {
    user?: {
        id: string;
    };
}
export declare const createApplicant: (req: AuthRequest, res: Response) => Promise<void>;
export declare const bulkCreateApplicants: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getApplicants: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getApplicantById: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateApplicant: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteApplicant: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const parseUploadedCandidates: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const parseUploadedJobs: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=applicantController.d.ts.map