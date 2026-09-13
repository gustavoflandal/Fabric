import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import HelpView from '../HelpView.vue'
import helpService from '@/services/help.service'

vi.mock('@/services/help.service', () => ({
  default: { getContent: vi.fn() },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))
vi.mock('@/stores/theme.store', () => ({ useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }) }))

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/help', component: HelpView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

const SAMPLE_MARKDOWN = `# Manual

## Módulo A

Texto do módulo A.

### Listar registros

Como listar.

## Módulo B

### Listar registros

Cabeçalho repetido de propósito, pra testar o sufixo de id único.
`

describe('HelpView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carrega o markdown, renderiza como HTML e monta o sumário a partir dos headings reais', async () => {
    vi.mocked(helpService.getContent).mockResolvedValue({
      data: { status: 'success', data: { content: SAMPLE_MARKDOWN, updatedAt: '2026-09-13T00:00:00Z' } },
    } as any)

    const router = makeRouter()
    router.push('/help')
    await router.isReady()

    const wrapper = mount(HelpView, { global: { plugins: [router] } })
    await flushPromises()

    // Conteúdo virou HTML de verdade (heading renderizado), não markdown cru.
    // (h2 escopado ao artigo — a própria AppLayout também renderiza um h2 pro título "Ajuda".)
    expect(wrapper.find('.help-content h2').text()).toContain('Módulo A')
    expect(wrapper.text()).toContain('Texto do módulo A.')

    // Sumário reflete os h2/h3 encontrados, incluindo o heading repetido
    // ("Listar registros" aparece em Módulo A e Módulo B) com id único.
    const tocLinks = wrapper.findAll('nav a')
    const hrefs = tocLinks.map((a) => a.attributes('href'))
    expect(hrefs).toContain('#modulo-a')
    expect(hrefs).toContain('#modulo-b')
    expect(hrefs).toContain('#listar-registros')
    expect(hrefs).toContain('#listar-registros-2')
  })

  it('exibe mensagem de erro quando a chamada falha', async () => {
    vi.mocked(helpService.getContent).mockRejectedValue({ response: { data: { message: 'Falhou' } } })

    const router = makeRouter()
    router.push('/help')
    await router.isReady()

    const wrapper = mount(HelpView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Falhou')
  })
})
