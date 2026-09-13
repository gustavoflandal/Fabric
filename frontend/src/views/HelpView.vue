<template>
  <AppLayout title="Ajuda" subtitle="Manual do usuário — todas as telas e fluxos do sistema">
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Carregando manual...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center dark:bg-red-950 dark:border-red-900">
      <p class="text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="flex flex-col lg:flex-row gap-8 items-start">
      <!-- Sumário: gerado a partir dos headings realmente renderizados (h2/h3),
           nunca de uma lista escrita à mão no markdown — não tem como
           dessincronizar do conteúdo. -->
      <nav
        v-if="toc.length > 0"
        class="w-full lg:w-64 flex-none lg:sticky lg:top-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-[80vh] overflow-y-auto"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Sumário</p>
        <ul class="space-y-1 text-sm">
          <li v-for="entry in toc" :key="entry.id">
            <a
              :href="`#${entry.id}`"
              class="block py-0.5 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
              :class="entry.level === 3 ? 'pl-4 text-gray-500 dark:text-gray-500' : 'font-medium'"
              @click.prevent="scrollTo(entry.id)"
            >
              {{ entry.text }}
            </a>
          </li>
        </ul>
      </nav>

      <!-- eslint-disable-next-line vue/no-v-html -- conteúdo do próprio repositório (docs/operacao/GUIA_USUARIO.md), não gerado por usuário nem por IA em tempo real; sem vetor de XSS. -->
      <article ref="contentRef" class="help-content flex-1 min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 sm:p-8" v-html="renderedHtml"></article>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import AppLayout from '@/components/common/AppLayout.vue'
import helpService from '@/services/help.service'

interface TocEntry {
  id: string
  text: string
  level: 2 | 3
}

const loading = ref(true)
const error = ref('')
const renderedHtml = ref('')
const contentRef = ref<HTMLElement | null>(null)
const toc = ref<TocEntry[]>([])

const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas diacríticas combinantes pós-NFD)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

// Atribui um id único (com sufixo -2, -3... em caso de heading repetido, como
// "Listar" aparecendo em vários módulos) a cada h2/h3 do conteúdo renderizado,
// e monta o sumário a partir dos mesmos elementos — sumário e âncoras nunca
// podem dessincronizar porque vêm da mesma varredura do DOM.
const buildToc = (): void => {
  if (!contentRef.value) return
  const used = new Map<string, number>()
  const headings = contentRef.value.querySelectorAll<HTMLElement>('h2, h3')
  const entries: TocEntry[] = []

  headings.forEach((heading) => {
    const text = heading.textContent?.trim() ?? ''
    if (!text) return
    const base = slugify(text) || 'secao'
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    heading.id = id
    entries.push({ id, text, level: heading.tagName === 'H3' ? 3 : 2 })
  })

  toc.value = entries
}

const scrollTo = (id: string): void => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const loadHelp = async (): Promise<void> => {
  try {
    loading.value = true
    error.value = ''
    const result = await helpService.getContent()
    renderedHtml.value = await marked.parse(result.data.data.content)
    // loading precisa virar false ANTES do nextTick: é o que faz o v-else
    // (o <article ref="contentRef">) entrar no DOM — buildToc() rodando
    // ainda dentro do v-if="loading" encontraria contentRef.value nulo.
    loading.value = false
    await nextTick()
    buildToc()
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar o manual do usuário'
    loading.value = false
  }
}

onMounted(loadHelp)
</script>

<style scoped>
.help-content :deep(h1) {
  @apply text-2xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-4 first:mt-0;
}
.help-content :deep(h2) {
  @apply text-xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-3 pt-4 border-t border-gray-200 dark:border-gray-700 first:mt-0 first:pt-0 first:border-0;
}
.help-content :deep(h3) {
  @apply text-base font-semibold text-gray-900 dark:text-gray-100 mt-5 mb-2;
}
.help-content :deep(p) {
  @apply text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed;
}
.help-content :deep(ul) {
  @apply list-disc list-outside pl-5 mb-3 text-sm text-gray-700 dark:text-gray-300 space-y-1;
}
.help-content :deep(ol) {
  @apply list-decimal list-outside pl-5 mb-3 text-sm text-gray-700 dark:text-gray-300 space-y-1;
}
.help-content :deep(a) {
  @apply text-primary-600 dark:text-primary-400 hover:underline;
}
.help-content :deep(strong) {
  @apply font-semibold text-gray-900 dark:text-gray-100;
}
.help-content :deep(code) {
  @apply font-mono text-xs bg-gray-100 dark:bg-gray-900 text-primary-700 dark:text-primary-300 px-1 py-0.5 rounded;
}
.help-content :deep(pre) {
  @apply bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto mb-3;
}
.help-content :deep(pre code) {
  @apply bg-transparent p-0;
}
.help-content :deep(table) {
  @apply w-full text-sm text-left mb-4 border-collapse;
}
.help-content :deep(th) {
  @apply border-b-2 border-gray-300 dark:border-gray-600 px-2 py-1.5 font-semibold text-gray-700 dark:text-gray-300;
}
.help-content :deep(td) {
  @apply border-b border-gray-200 dark:border-gray-700 px-2 py-1.5 text-gray-700 dark:text-gray-300;
}
.help-content :deep(blockquote) {
  @apply border-l-4 border-primary-300 dark:border-primary-700 pl-4 italic text-gray-600 dark:text-gray-400 mb-3;
}
.help-content :deep(hr) {
  @apply my-6 border-gray-200 dark:border-gray-700;
}
</style>
