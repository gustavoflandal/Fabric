import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class CountingAssignmentService {
  /**
   * Atribuir contador à sessão
   */
  async assignUser(sessionId: string, userId: string, role: string) {
    return await prisma.countingAssignment.create({
      data: {
        sessionId,
        userId,
        role
      },
      include: {
        user: true
      }
    });
  }

  /**
   * Remover atribuição
   */
  async unassignUser(sessionId: string, userId: string) {
    return await prisma.countingAssignment.delete({
      where: {
        sessionId_userId: {
          sessionId,
          userId
        }
      }
    });
  }

  /**
   * Listar atribuições da sessão
   */
  async listAssignments(sessionId: string) {
    return await prisma.countingAssignment.findMany({
      where: { sessionId },
      include: {
        user: true
      }
    });
  }

  /**
   * Atualizar papel do contador
   */
  async updateRole(sessionId: string, userId: string, role: string) {
    return await prisma.countingAssignment.update({
      where: {
        sessionId_userId: {
          sessionId,
          userId
        }
      },
      data: { role }
    });
  }
}

export default new CountingAssignmentService();
