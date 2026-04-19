import { Request, Response } from "express";
interface AuthRequest extends Request {
    user?: {
        id: string;
    };
}
export declare const createJob: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getJobs: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getJobById: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateJob: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteJob: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=jobController.d.ts.map