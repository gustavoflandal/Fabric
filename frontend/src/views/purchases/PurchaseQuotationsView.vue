<template>
  <AppLayout title="Orçamentos de Compra" subtitle="Gerencie orçamentos de fornecedores">
    <template #actions>
      <Button variant="primary" @click="showCreateModal = true"><span class="mr-2">+</span>Novo Orçamento</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="pq-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Buscar..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedLoadQuotations"
          />
        </FormField>
        <FormField id="pq-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="loadQuotations"
          >
            <option value="">Todos os Status</option>
            <option value="PENDING">Pendente</option>
            <option value="SENT">Enviado</option>
            <option value="RECEIVED">Recebido</option>
            <option value="APPROVED">Aprovado</option>
            <option value="REJECTED">Rejeitado</option>
            <option value="EXPIRED">Expirado</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="quotations"
      empty-title="Nenhum orçamento encontrado"
      empty-hint="Ajuste os filtros ou crie um novo orçamento."
      @retry="loadQuotations"
    >
      <template #empty-action>
        <Button @click="showCreateModal = true"><span class="mr-2">+</span>Novo Orçamento</Button>
      </template>

      <template #head>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Número</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Fornecedor</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Data</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Validade</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Status</th>
        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Valor Total</th>
        <th scope="col" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.quotationNumber }}</td>
        <td class="px-4 py-4 text-sm text-gray-900">{{ item.supplier?.name }}</td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(item.requestDate) }}</td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(item.dueDate) }}</td>
        <td class="px-4 py-4 whitespace-nowrap">
          <StatusBadge :label="getStatusLabel(item.status)" :tone="getStatusTone(item.status)" />
        </td>
        <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatCurrency(item.totalValue) }}</td>
        <td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex items-center justify-end space-x-3">
            <button @click="viewQuotation(item)" class="text-primary-600 hover:text-primary-900 whitespace-nowrap">Ver</button>
            <button
              v-if="item.status === 'APPROVED'"
              @click="createOrder(item)"
              class="text-primary-600 hover:text-primary-900 whitespace-nowrap"
            >
              Gerar Pedido
            </button>
            <button @click="deleteQuotation(item.id)" class="text-red-600 hover:text-red-900 whitespace-nowrap">Excluir</button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Modal Criar — Esc/focus trap agora vêm do AppModal (§4.2). -->
    <AppModal v-model="showCreateModal" size="lg" title="Novo Orçamento">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="pq-form-supplier" label="Fornecedor" required>
          <select v-model="form.supplierId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </FormField>

        <FormField id="pq-form-due-date" label="Data de Validade" required>
          <input v-model="form.dueDate" type="date" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <FormField id="pq-form-notes" label="Observações">
          <textarea v-model="form.notes" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <!-- Itens — mesmo tratamento de PurchaseOrdersView: rótulo de grupo único, sem um
             FormField por controle de linha (ids/labels repetidos por índice do array). -->
        <div class="border-t pt-4 mt-4">
          <div class="flex justify-between items-center mb-2">
            <h4 class="text-sm font-semibold text-gray-900">Itens</h4>
            <Button type="button" size="sm" @click="addItem">+ Adicionar Item</Button>
          </div>

          <div v-for="(item, index) in form.items" :key="index" class="flex gap-2 mb-2">
            <select v-model="item.productId" required aria-label="Produto" class="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Produto...</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.code }} - {{ product.name }}
              </option>
            </select>
            <input v-model.number="item.quantity" type="number" placeholder="Qtd" required aria-label="Quantidade" class="w-24 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            <input v-model.number="item.unitPrice" type="number" step="0.01" placeholder="Preço" required aria-label="Preço unitário" class="w-32 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            <input v-model.number="item.discount" type="number" step="0.01" placeholder="Desc %" aria-label="Desconto (%)" class="w-24 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            <Button type="button" variant="danger" size="sm" @click="removeItem(index)">X</Button>
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="showCreateModal = false" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="submitting" class="flex-1">{{ submitting ? 'Salvando...' : 'Salvar' }}</Button>
        </div>
      </form>
    </AppModal>

    <!-- Modal de Visualização -->
    <AppModal v-model="showViewModal" size="lg" title="Detalhes do Orçamento">
      <div v-if="selectedQuotation" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="block text-sm font-medium text-gray-700">Número</p>
            <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.quotationNumber }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Status</p>
            <StatusBadge
              class="mt-1"
              :label="getStatusLabel(selectedQuotation.status)"
              :tone="getStatusTone(selectedQuotation.status)"
            />
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Fornecedor</p>
            <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.supplier?.name }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Data de Solicitação</p>
            <p class="mt-1 text-sm text-gray-900">{{ formatDate(selectedQuotation.requestDate) }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Data de Validade</p>
            <p class="mt-1 text-sm text-gray-900">{{ formatDate(selectedQuotation.dueDate) }}</p>
          </div>
          <div>
            <p class="block text-sm font-medium text-gray-700">Valor Total</p>
            <p class="mt-1 text-sm font-bold text-gray-900">{{ formatCurrency(selectedQuotation.totalValue) }}</p>
          </div>
          <div v-if="selectedQuotation.approvedBy">
            <p class="block text-sm font-medium text-gray-700">Aprovado por</p>
            <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.approvedBy }}</p>
          </div>
        </div>

        <div v-if="selectedQuotation.notes">
          <p class="block text-sm font-medium text-gray-700">Observações</p>
          <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.notes }}</p>
        </div>

        <!-- Itens do orçamento: tabela simples, não DataTable — mesmo raciocínio de
             PurchaseOrdersView (o modal só abre após `getQuotationById` resolver, então
             carregando/erro são inalcançáveis). -->
        <div class="border-t pt-4 mt-4">
          <h4 class="text-sm font-semibold text-gray-900 mb-2">Itens</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Desconto</th>
                  <th scope="col" class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in selectedQuotation.items" :key="item.id">
                  <td class="px-4 py-2 text-sm text-gray-900">{{ item.product?.code }} - {{ item.product?.name }}</td>
                  <td class="px-4 py-2 text-sm text-right text-gray-900">{{ item.quantity }}</td>
                  <td class="px-4 py-2 text-sm text-right text-gray-900">{{ formatCurrency(item.unitPrice) }}</td>
                  <td class="px-4 py-2 text-sm text-right text-gray-900">{{ item.discount || 0 }}%</td>
                  <td class="px-4 py-2 text-sm text-right font-semibold text-gray-900">{{ formatCurrency(item.totalPrice) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <Button type="button" variant="outline" @click="showViewModal = false">Fechar</Button>
          <Button
            v-if="selectedQuotation && selectedQuotation.status === 'APPROVED'"
            variant="outline"
            @click="printQuotationPDF(selectedQuotation)"
          >
            📄 Imprimir PDF
          </Button>
          <Button
            v-if="selectedQuotation && selectedQuotation.status === 'APPROVED'"
            variant="primary"
            @click="createOrder(selectedQuotation)"
          >
            Gerar Pedido
          </Button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePurchaseQuotationStore } from '@/stores/purchase-quotation.store';
import { usePurchaseOrderStore } from '@/stores/purchase-order.store';
import type { PurchaseQuotation } from '@/services/purchase-quotation.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { generatePDF, formatCurrency as formatCurrencyPDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';

const router = useRouter();
const quotationStore = usePurchaseQuotationStore();
const orderStore = usePurchaseOrderStore();
const toast = useToast();

const quotations = ref<PurchaseQuotation[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento é um estado próprio, nunca "lista vazia".
const error = ref('');
const showCreateModal = ref(false);
const showViewModal = ref(false);
const selectedQuotation = ref<PurchaseQuotation | null>(null);
const submitting = ref(false);
const filters = ref({ search: '', status: '' });

const suppliers = ref<any[]>([]);
const products = ref<any[]>([]);

const form = ref({
  supplierId: '',
  dueDate: '',
  notes: '',
  items: [{ productId: '', quantity: 0, unitPrice: 0, discount: 0 }],
});

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// yellow/blue/purple/green/red/gray do badge antigo normalizados para a paleta do
// StatusBadge (§4.2): PENDING = warning (ainda não enviado, exige ação nossa),
// SENT = info e RECEIVED = info (etapas informativas do trâmite com o fornecedor;
// o roxo original não tem equivalente na paleta), APPROVED = success,
// REJECTED = danger, EXPIRED = neutral (estado inerte).
const getStatusTone = (status: string): BadgeTone => {
  const tones: Record<string, BadgeTone> = {
    PENDING: 'warning',
    SENT: 'info',
    RECEIVED: 'info',
    APPROVED: 'success',
    REJECTED: 'danger',
    EXPIRED: 'neutral',
  };
  return tones[status] || 'neutral';
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    SENT: 'Enviado',
    RECEIVED: 'Recebido',
    APPROVED: 'Aprovado',
    REJECTED: 'Rejeitado',
    EXPIRED: 'Expirado',
  };
  return labels[status] || status;
};

const loadQuotations = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await quotationStore.fetchQuotations(filters.value);
    quotations.value = response.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar orçamentos';
  } finally {
    loading.value = false;
  }
};
const debouncedLoadQuotations = useDebounce(loadQuotations, 350);

const loadSuppliers = async () => {
  try {
    const response = await fetch('http://localhost:3005/api/v1/suppliers', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    const data = await response.json();
    suppliers.value = data.data.data || [];
  } catch (error) {
    console.error('Erro ao carregar fornecedores:', error);
  }
};

const loadProducts = async () => {
  try {
    const response = await fetch('http://localhost:3005/api/v1/products', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
    });
    const data = await response.json();
    products.value = data.data.data || [];
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
  }
};

const addItem = () => {
  form.value.items.push({ productId: '', quantity: 0, unitPrice: 0, discount: 0 });
};

const removeItem = (index: number) => {
  form.value.items.splice(index, 1);
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    await quotationStore.createQuotation(form.value);
    showCreateModal.value = false;
    await loadQuotations();
    toast.success('Orçamento criado com sucesso!');
  } catch (error: any) {
    toast.error(error.message || 'Erro ao criar orçamento');
  } finally {
    submitting.value = false;
  }
};

const viewQuotation = async (quotation: PurchaseQuotation) => {
  try {
    // Buscar detalhes completos do orçamento
    const response = await quotationStore.getQuotationById(quotation.id);
    selectedQuotation.value = response;
    showViewModal.value = true;
  } catch (error: any) {
    toast.error(error.message || 'Erro ao carregar detalhes do orçamento');
  }
};

const createOrder = async (quotation: PurchaseQuotation) => {
  if (await confirmDialog(`Gerar pedido de compra a partir do orçamento ${quotation.quotationNumber}?`)) {
    try {
      await orderStore.createFromQuotation(quotation.id);
      toast.success('Pedido criado com sucesso!');
      router.push('/purchases/orders');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar pedido');
    }
  }
};

const deleteQuotation = async (id: string) => {
  if (await confirmDialog('Deseja realmente excluir este orçamento?')) {
    try {
      await quotationStore.deleteQuotation(id);
      await loadQuotations();
      toast.success('Orçamento excluído com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir orçamento');
    }
  }
};

const printQuotationPDF = (quotation: PurchaseQuotation) => {
  try {
    const pdfData: Record<string, any> = {
      'Fornecedor': quotation.supplier?.name || '',
      'Data de Solicitação': formatDatePDF(quotation.requestDate),
      'Data de Validade': formatDatePDF(quotation.dueDate),
      'Status': getStatusLabel(quotation.status),
      'Valor Total': formatCurrencyPDF(quotation.totalValue),
    };

    if (quotation.approvedBy) {
      pdfData['Aprovado por'] = quotation.approvedBy;
    }

    pdfData['Observações'] = quotation.notes || 'Nenhuma';

    const pdf = generatePDF({
      title: 'ORÇAMENTO DE COMPRA',
      subtitle: quotation.quotationNumber,
      data: pdfData,
      items: quotation.items?.map(item => ({
        produto: `${item.product?.code} - ${item.product?.name}`,
        quantidade: item.quantity,
        unitario: formatCurrencyPDF(item.unitPrice),
        desconto: `${item.discount || 0}%`,
        total: formatCurrencyPDF(item.totalPrice),
      })) || [],
      itemsColumns: [
        { header: 'Produto', key: 'produto', align: 'left' },
        { header: 'Quantidade', key: 'quantidade', align: 'right' },
        { header: 'Preço Unit.', key: 'unitario', align: 'right' },
        { header: 'Desconto', key: 'desconto', align: 'right' },
        { header: 'Total', key: 'total', align: 'right' },
      ],
      signature: { label: 'Assinatura do Fornecedor' },
    });

    pdf.save(`Orcamento_${quotation.quotationNumber}.pdf`);
  } catch (error: any) {
    toast.error('Erro ao gerar PDF: ' + error.message);
  }
};

onMounted(() => {
  loadQuotations();
  loadSuppliers();
  loadProducts();
});
</script>
