import axios from 'axios';

export const CountingAssignmentService = {
  assignUser: async (sessionId: string, userId: string, role: string) => {
    const response = await axios.post(`/api/counting/sessions/${sessionId}/assign`, { userId, role });
    return response.data;
  },
  
  unassignUser: async (sessionId: string, userId: string) => {
    await axios.delete(`/api/counting/sessions/${sessionId}/assign/${userId}`);
  },
  
  listAssignments: async (sessionId: string) => {
    const response = await axios.get(`/api/counting/sessions/${sessionId}/assign`);
    return response.data;
  },
  
  updateRole: async (sessionId: string, userId: string, role: string) => {
    const response = await axios.patch(`/api/counting/sessions/${sessionId}/assign/${userId}`, { role });
    return response.data;
  }
};
