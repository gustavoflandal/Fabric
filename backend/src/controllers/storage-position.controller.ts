import { Request, Response, NextFunction } from 'express';
import * as storagePositionService from '../services/storage-position.service';
import { parsePositiveInt } from '../utils/validation.util';

export const generatePositions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { structureId } = req.params;

    const positions = await storagePositionService.generatePositions(structureId);

    res.json({
      success: true,
      message: `${positions.length} posições geradas com sucesso`,
      data: positions
    });
  } catch (error: any) {
    next(error);
  }
};

export const getPositionsByStructure = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { structureId } = req.params;

    const positions = await storagePositionService.getPositionsByStructure(structureId);

    res.json({
      success: true,
      data: positions
    });
  } catch (error: any) {
    next(error);
  }
};

// F0.2: busca de posição pelo endereço (`ARM-RUA-AA-PP`), pré-requisito de
// leitura por coletor/scanner.
export const getPositionByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;

    const position = await storagePositionService.getPositionByCode(code);

    res.json({
      success: true,
      data: position
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * F2.4: histórico de movimentação de um endereço (origem OU destino).
 *
 * `limit` passa por `parsePositiveInt` com teto de 500 — mesmo tratamento (e
 * mesmos números) que `stock.controller.ts::getMovements` já dá ao histórico de
 * produto, para que os dois históricos não tenham regras de paginação
 * diferentes.
 */
export const getPositionMovements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parsePositiveInt(req.query.limit, 100, 500);

    const data = await storagePositionService.getPositionMovements(id, {
      limit,
      productId: req.query.productId as string | undefined
    });

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    next(error);
  }
};

export const deletePositions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { structureId } = req.params;

    const count = await storagePositionService.deletePositionsByStructure(structureId);

    res.json({
      success: true,
      message: `${count} posições excluídas com sucesso`
    });
  } catch (error: any) {
    next(error);
  }
};

export const updatePosition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { positionId } = req.params;
    const data = req.body;

    const position = await storagePositionService.updatePosition(positionId, data);

    res.json({
      success: true,
      message: 'Posição atualizada com sucesso',
      data: position
    });
  } catch (error: any) {
    next(error);
  }
};

export const deletePosition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { positionId } = req.params;

    await storagePositionService.deletePosition(positionId);

    res.json({
      success: true,
      message: 'Posição excluída com sucesso'
    });
  } catch (error: any) {
    next(error);
  }
};
