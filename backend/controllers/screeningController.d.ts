import { Request, Response } from "express";
interface AuthRequest extends Request {
    user?: {
        id: string;
    };
}
export declare const runScreening: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getResults: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteResultsByJob: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteResultsByApplicant: (req: AuthRequest, res: Response) => Promise<void>;
export {};
//# sourceMappingURL=screeningController.d.ts.map