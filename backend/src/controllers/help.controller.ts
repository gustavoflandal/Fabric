import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

const HELP_FILE = path.join(__dirname, '..', '..', '..', 'docs', 'operacao', 'GUIA_USUARIO.md');

export class HelpController {
  async getContent(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!fs.existsSync(HELP_FILE)) {
        throw new AppError(404, 'Arquivo de ajuda não encontrado');
      }
      const content = fs.readFileSync(HELP_FILE, 'utf-8');
      const { mtime } = fs.statSync(HELP_FILE);
      res.status(200).json({ status: 'success', data: { content, updatedAt: mtime.toISOString() } });
    } catch (error) {
      next(error);
    }
  }
}

export default new HelpController();
