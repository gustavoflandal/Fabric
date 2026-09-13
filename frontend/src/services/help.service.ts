import api from './api.service'

export interface HelpContentResponse {
  content: string
  updatedAt: string
}

class HelpService {
  private readonly basePath = '/help'

  async getContent() {
    return api.get(`${this.basePath}`)
  }
}

export default new HelpService()
