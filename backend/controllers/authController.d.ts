import { Request, Response } from "express";
interface AuthRequest extends Request {
    user?: any;
}
export declare const register: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getMe: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateMe: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=authController.d.ts.map