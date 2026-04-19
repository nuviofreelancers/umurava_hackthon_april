import { Request, Response, NextFunction } from "express";
interface AuthRequest extends Request {
    user?: any;
}
export declare const protect: (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export {};
//# sourceMappingURL=authMiddleware.d.ts.map