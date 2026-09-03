import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import AppLayout from '../AppLayout.vue'

const push = vi.fn()
const logout = vi.fn().mockResolvedValue(undefined)

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useRouter: () => ({ push }),
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup: (props, { slots }) => () => h('a', { href: String(props.to) }, slots.default?.()),
    }),
  }
})

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Gustavo', logout }),
}))

// AppLayout existe para eliminar as 26 copias do header + handleLogout (I1).
// O teste fixa o header exato de SuppliersView.vue:3-24 e o comportamento de logout.
function mountLayout(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(AppLayout, { props, slots })
}

describe('AppLayout', () => {
  beforeEach(() => {
    push.mockClear()
    logout.mockClear()
  })

  it('renderiza o header canonico: logo, saudacao, link Inicio e botao Sair', () => {
    const wrapper = mountLayout({ title: 'Fornecedores' })

    const logo = wrapper.find('img')
    expect(logo.attributes('src')).toBe('/logo.png')
    expect(logo.attributes('alt')).toBe('Fabric')

    expect(wrapper.find('h1').text()).toBe('Fabric')
    expect(wrapper.text()).toContain('Olá,')
    expect(wrapper.text()).toContain('Gustavo')

    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/dashboard')
    expect(link.text()).toBe('Início')

    expect(wrapper.text()).toContain('Sair')
  })

  it('renderiza title e subtitle com a tipografia canonica', () => {
    const wrapper = mountLayout({ title: 'Fornecedores', subtitle: 'Gerencie os fornecedores' })
    const h2 = wrapper.find('h2')
    expect(h2.text()).toBe('Fornecedores')
    expect(h2.classes()).toEqual(expect.arrayContaining(['text-3xl', 'font-bold', 'text-gray-900']))

    const p = wrapper.find('main p')
    expect(p.text()).toBe('Gerencie os fornecedores')
    expect(p.classes()).toEqual(expect.arrayContaining(['mt-1', 'text-sm', 'text-gray-600']))
  })

  it('renderiza o slot actions ao lado do titulo', () => {
    const wrapper = mountLayout(
      { title: 'Fornecedores' },
      { actions: '<button class="acao">+ Novo Fornecedor</button>' }
    )
    expect(wrapper.find('button.acao').exists()).toBe(true)
  })

  it('renderiza o slot default dentro do main com a largura canonica', () => {
    const wrapper = mountLayout({ title: 'X' }, { default: '<div id="conteudo">tabela</div>' })
    const main = wrapper.find('main')
    expect(main.classes()).toEqual(
      expect.arrayContaining(['max-w-7xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8', 'py-8'])
    )
    expect(main.find('#conteudo').exists()).toBe(true)
  })

  it('faz logout e redireciona para /login ao clicar em Sair', async () => {
    const wrapper = mountLayout({ title: 'X' })
    const sair = wrapper.findAll('button').find((b) => b.text() === 'Sair')!
    await sair.trigger('click')
    await flushPromises()

    expect(logout).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/login')
  })

  it('omite o bloco de titulo quando nao ha title nem actions', () => {
    const wrapper = mountLayout({}, { default: '<div>só conteúdo</div>' })
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('permite substituir a navegacao pelo slot nav', () => {
    const wrapper = mountLayout({ title: 'Usuários' }, { nav: '<a href="/roles">Perfis</a>' })
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/roles')
    expect(hrefs).not.toContain('/dashboard')
  })
})
