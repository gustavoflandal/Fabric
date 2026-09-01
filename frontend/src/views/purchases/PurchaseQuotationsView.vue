<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800">Fabric</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
              Início
            </RouterLink>
            <span class="text-sm text-gray-700">
              Olá, <span class="font-semibold">{{ authStore.userName }}</span>
            </span>
            <Button variant="outline" size="sm" @click="handleLogout">
              Sair
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Orçamentos de Compra</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gerencie orçamentos de fornecedores
          </p>
        </div>
        <Button @click="showCreateModal = true">
          + Novo Orçamento
        </Button>
      </div>

      <Card>
        <div class="mb-4 flex gap-4">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Buscar..."
            class="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="loadQuotations"
          />
          <select v-model="filters.status" @change="loadQuotations" class="rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Todos os Status</option>
            <option value="PENDING">Pendente</option>
            <option value="SENT">Enviado</option>
            <option value="RECEIVED">Recebido</option>
            <option value="APPROVED">Aprovado</option>
            <option value="REJECTED">Rejeitado</option>
            <option value="EXPIRED">Expirado</option>
          </select>
        </div>

        <div v-if="loading" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p class="mt-2 text-gray-600">Carregando...</p>
        </div>

        <div v-else-if="quotations.length === 0" class="text-center py-8">
          <p class="text-gray-500">Nenhum orçamento encontrado</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fornecedor</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validade</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="quotation in quotations" :key="quotation.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ quotation.quotationNumber }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ quotation.supplier?.name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(quotation.requestDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(quotation.dueDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusClass(quotation.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ getStatusLabel(quotation.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatCurrency(quotation.totalValue) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Button variant="outline" size="sm" @click="viewQuotation(quotation)" class="mr-2">
                    Ver
                  </Button>
                  <Button v-if="quotation.status === 'APPROVED'" variant="primary" size="sm" @click="createOrder(quotation)" class="mr-2">
                    Gerar Pedido
                  </Button>
                  <Button variant="danger" size="sm" @click="deleteQuotation(quotation.id)">
                    Excluir
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </main>

    <!-- Modal Criar/Editar -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Novo Orçamento</h3>
          <button @click="showCreateModal = false" class="text-gray-400 hover:text-gray-500">
            <span class="text-2xl">&times;</span>
          </button>
        </div>
        
        <form @submit.prevent="handleSubmit">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Fornecedor</label>
              <select v-model="form.supplierId" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                <option value="">Selecione...</option>
                <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
                  {{ supplier.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Data de Validade</label>
              <input v-model="form.dueDate" type="date" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Observações</label>
              <textarea v-model="form.notes" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
            </div>

            <div>
              <div class="flex justify-between items-center mb-2">
                <label class="block text-sm font-medium text-gray-700">Itens</label>
                <Button type="button" size="sm" @click="addItem">+ Adicionar Item</Button>
              </div>
              
              <div v-for="(item, index) in form.items" :key="index" class="flex gap-2 mb-2">
                <select v-model="item.productId" required class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                  <option value="">Produto...</option>
                  <option v-for="product in products" :key="product.id" :value="product.id">
                    {{ product.code }} - {{ product.name }}
                  </option>
                </select>
                <input v-model.number="item.quantity" type="number" placeholder="Qtd" required class="w-24 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                <input v-model.number="item.unitPrice" type="number" step="0.01" placeholder="Preço" required class="w-32 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                <input v-model.number="item.discount" type="number" step="0.01" placeholder="Desc %" class="w-24 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                <Button type="button" variant="danger" size="sm" @click="removeItem(index)">X</Button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" @click="showCreateModal = false">
              Cancelar
            </Button>
            <Button type="submit" :disabled="submitting">
              {{ submitting ? 'Salvando...' : 'Salvar' }}
            </Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de Visualização -->
    <div v-if="showViewModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Detalhes do Orçamento</h3>
          <button @click="showViewModal = false" class="text-gray-400 hover:text-gray-500">
            <span class="text-2xl">&times;</span>
          </button>
        </div>
        
        <div v-if="selectedQuotation" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Número</label>
              <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.quotationNumber }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Status</label>
              <span :class="getStatusClass(selectedQuotation.status)" class="mt-1 inline-flex px-2 text-xs leading-5 font-semibold rounded-full">
                {{ getStatusLabel(selectedQuotation.status) }}
              </span>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Fornecedor</label>
              <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.supplier?.name }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Data de Solicitação</label>
              <p class="mt-1 text-sm text-gray-900">{{ formatDate(selectedQuotation.requestDate) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Data de Validade</label>
              <p class="mt-1 text-sm text-gray-900">{{ formatDate(selectedQuotation.dueDate) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Valor Total</label>
              <p class="mt-1 text-sm font-bold text-gray-900">{{ formatCurrency(selectedQuotation.totalValue) }}</p>
            </div>
            <div v-if="selectedQuotation.approvedBy">
              <label class="block text-sm font-medium text-gray-700">Aprovado por</label>
              <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.approvedBy }}</p>
            </div>
          </div>

          <div v-if="selectedQuotation.notes">
            <label class="block text-sm font-medium text-gray-700">Observações</label>
            <p class="mt-1 text-sm text-gray-900">{{ selectedQuotation.notes }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Itens</label>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Desconto</th>
                    <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
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

          <div class="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" @click="showViewModal = false">
              Fechar
            </Button>
            <Button v-if="selectedQuotation.status === 'APPROVED'" variant="outline" @click="printQuotationPDF(selectedQuotation)">
              📄 Imprimir PDF
            </Button>
            <Button v-if="selectedQuotation.status === 'APPROVED'" variant="primary" @click="createOrder(selectedQuotation)">
              Gerar Pedido
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { usePurchaseQuotationStore } from '@/stores/purchase-quotation.store';
import { usePurchaseOrderStore } from '@/stores/purchase-order.store';
import type { PurchaseQuotation } from '@/services/purchase-quotation.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import { generatePDF, formatCurrency as formatCurrencyPDF, formatDate as formatDatePDF } from '@/utils/pdf-generator';

const router = useRouter();
const authStore = useAuthStore();
const quotationStore = usePurchaseQuotationStore();
const orderStore = usePurchaseOrderStore();

const quotations = ref<PurchaseQuotation[]>([]);
const loading = ref(false);
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

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    SENT: 'bg-blue-100 text-blue-800',
    RECEIVED: 'bg-purple-100 text-purple-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
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
  try {
    const response = await quotationStore.fetchQuotations(filters.value);
    quotations.value = response.data;
  } catch (error: any) {
    alert(error.message || 'Erro ao carregar orçamentos');
  } finally {
    loading.value = false;
  }
};

const loadSuppliers = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/v1/suppliers', {
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
    const response = await fetch('http://localhost:3001/api/v1/products', {
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
    alert('Orçamento criado com sucesso!');
  } catch (error: any) {
    alert(error.message || 'Erro ao criar orçamento');
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
    alert(error.message || 'Erro ao carregar detalhes do orçamento');
  }
};

const createOrder = async (quotation: PurchaseQuotation) => {
  if (confirm(`Gerar pedido de compra a partir do orçamento ${quotation.quotationNumber}?`)) {
    try {
      await orderStore.createFromQuotation(quotation.id);
      alert('Pedido criado com sucesso!');
      router.push('/purchases/orders');
    } catch (error: any) {
      alert(error.message || 'Erro ao criar pedido');
    }
  }
};

const deleteQuotation = async (id: string) => {
  if (confirm('Deseja realmente excluir este orçamento?')) {
    try {
      await quotationStore.deleteQuotation(id);
      await loadQuotations();
      alert('Orçamento excluído com sucesso!');
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir orçamento');
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
      supplierSignature: true,
    });
    
    pdf.save(`Orcamento_${quotation.quotationNumber}.pdf`);
  } catch (error: any) {
    alert('Erro ao gerar PDF: ' + error.message);
  }
};

onMounted(() => {
  loadQuotations();
  loadSuppliers();
  loadProducts();
});
</script>
