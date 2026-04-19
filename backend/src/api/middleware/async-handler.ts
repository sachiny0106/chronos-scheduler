import { Request, Response, NextFunction } from 'express';

// Express 4 doesn't catch async rejections — this wrapper does.
export function asyncHandler(
  fn: (req: Request<any>, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
