import { Request, Response } from 'express';
import * as storagePositionService from '../services/storage-position.service';

export const generatePositions = async (req: Request, res: Response) => {
  try {
    const { structureId } = req.params;
    
    const positions = await storagePositionService.generatePositions(structureId);
    
    res.json({
      success: true,
      message: `${positions.length} posições geradas com sucesso`,
      data: positions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getPositionsByStructure = async (req: Request, res: Response) => {
  try {
    const { structureId } = req.params;
    
    const positions = await storagePositionService.getPositionsByStructure(structureId);
    
    res.json({
      success: true,
      data: positions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deletePositions = async (req: Request, res: Response) => {
  try {
    const { structureId } = req.params;
    
    const count = await storagePositionService.deletePositionsByStructure(structureId);
    
    res.json({
      success: true,
      message: `${count} posições excluídas com sucesso`
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updatePosition = async (req: Request, res: Response) => {
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
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deletePosition = async (req: Request, res: Response) => {
  try {
    const { positionId } = req.params;
    
    await storagePositionService.deletePosition(positionId);
    
    res.json({
      success: true,
      message: 'Posição excluída com sucesso'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
