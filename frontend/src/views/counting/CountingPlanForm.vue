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

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">
            {{ isEditing ? 'Editar Plano' : 'Novo Plano de Contagem' }}
          </h2>
          <p class="mt-2 text-sm text-gray-600">
            {{ isEditing ? 'Atualize as informações do plano' : 'Crie um novo plano de contagem de estoque' }}
          </p>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <!-- Informações Básicas -->
        <div class="mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Código <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.code"
                type="text"
                required
                class="w-full border-gray-300 rounded-md shadow-sm"
                placeholder="Ex: CONT-001"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nome <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full border-gray-300 rounded-md shadow-sm"
                placeholder="Ex: Contagem Mensal"
              />
            </div>
          </div>
        </div>

        <!-- Configurações -->
        <div class="mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Configurações</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span class="text-red-500">*</span>
              </label>
              <select v-model="form.type" required class="w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Selecione...</option>
                <option value="FULL_INVENTORY">Contagem Completa</option>
                <option value="SPOT">Contagem Parcial</option>
                <option value="CYCLIC">Contagem Cíclica</option>
                <option value="BLIND">Contagem Cega</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Frequência <span class="text-red-500">*</span>
              </label>
              <select v-model="form.frequency" required class="w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Selecione...</option>
                <option value="DAILY">Diária</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Prioridade <span class="text-red-500">*</span>
              </label>
              <select v-model.number="form.priority" required class="w-full border-gray-300 rounded-md shadow-sm">
                <option :value="1">1 - Baixa</option>
                <option :value="5">5 - Média</option>
                <option :value="10">10 - Alta</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Datas -->
        <div class="mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Agendamento</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Data de Início <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.startDate"
                type="date"
                required
                class="w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Data de Término
              </label>
              <input
                v-model="form.endDate"
                type="date"
                class="w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
          </div>
        </div>

        <!-- Descrição -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full border-gray-300 rounded-md shadow-sm"
            placeholder="Descreva o objetivo e detalhes do plano..."
          ></textarea>
        </div>

        <!-- Produtos Selecionados -->
        <div class="mb-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Produtos do Plano</h3>
            <button
              type="button"
              @click="showProductModal = true"
              class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
            >
              + Adicionar Produtos
            </button>
          </div>
          
          <div v-if="selectedProducts.length === 0" class="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            Nenhum produto adicionado. Clique em "Adicionar Produtos" para selecionar.
          </div>
          
          <div v-else class="space-y-2">
            <div
              v-for="(product, index) in selectedProducts"
              :key="product.id"
              class="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <span class="text-gray-500 font-medium">{{ index + 1 }}.</span>
                <div>
                  <div class="font-medium text-gray-900">{{ product.name }}</div>
                  <div class="text-sm text-gray-500">{{ product.code }}</div>
                </div>
              </div>
              <button
                type="button"
                @click="removeProduct(product.id)"
                class="text-red-500 hover:text-red-700"
              >
                Remover
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-between items-center pt-4 border-t border-gray-200">
          <button
            v-if="isEditing && authStore.canPrintCountingPlan"
            type="button"
            @click="generatePDF"
            :disabled="generatingPDF"
            class="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-md hover:bg-green-100 disabled:opacity-50 flex items-center space-x-2"
          >
            <svg v-if="!generatingPDF" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <svg v-else class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ generatingPDF ? 'Gerando PDF...' : 'Imprimir PDF' }}</span>
          </button>
          <div v-else></div>
          
          <div class="flex space-x-3">
            <button
              type="button"
              @click="router.back()"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="loading"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {{ loading ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Plano') }}
            </button>
          </div>
        </div>
      </form>
    </main>
    
    <!-- Product Selector Modal -->
    <ProductSelectorModal
      :is-open="showProductModal"
      :initial-selection="selectedProducts.map(p => p.id)"
      @close="showProductModal = false"
      @select="handleProductsSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import { useAuthStore } from '@/stores/auth.store';
import Button from '@/components/common/Button.vue';
import ProductSelectorModal from '@/components/counting/ProductSelectorModal.vue';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const router = useRouter();
const route = useRoute();
const countingStore = useCountingStore();
const authStore = useAuthStore();

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};

const loading = ref(false);
const isEditing = ref(false);
const generatingPDF = ref(false);
const showProductModal = ref(false);
const selectedProducts = ref<any[]>([]);

const form = ref({
  code: '',
  name: '',
  type: '',
  frequency: '',
  priority: 5,
  startDate: '',
  endDate: '',
  description: '',
});

onMounted(async () => {
  const planId = route.params.id as string;
  if (planId && planId !== 'new') {
    isEditing.value = true;
    await loadPlan(planId);
  }
});

const loadPlan = async (id: string) => {
  try {
    loading.value = true;
    const plan = await countingStore.fetchPlan(id);
    form.value = {
      code: plan.code,
      name: plan.name,
      type: plan.type,
      frequency: plan.frequency,
      priority: plan.priority || 5,
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : '',
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : '',
      description: plan.description || '',
    };
    
    // Carregar produtos do plano
    await loadPlanProducts(id);
  } catch (error) {
    console.error('Erro ao carregar plano:', error);
  } finally {
    loading.value = false;
  }
};

const loadPlanProducts = async (planId: string) => {
  try {
    const response = await axios.get(`/api/v1/counting/products/plans/${planId}/products`, {
      headers: {
        'Authorization': `Bearer ${authStore.accessToken}`
      }
    });
    selectedProducts.value = response.data.map((item: any) => item.product);
  } catch (error) {
    console.error('Erro ao carregar produtos do plano:', error);
  }
};

const handleProductsSelected = (products: any[]) => {
  selectedProducts.value = products;
};

const removeProduct = (productId: string) => {
  selectedProducts.value = selectedProducts.value.filter(p => p.id !== productId);
};

const handleSubmit = async () => {
  try {
    loading.value = true;

    const data = {
      ...form.value,
      startDate: form.value.startDate ? new Date(form.value.startDate) : undefined,
      endDate: form.value.endDate ? new Date(form.value.endDate) : undefined,
    };

    let planId: string;
    
    if (isEditing.value) {
      await countingStore.updatePlan(route.params.id as string, data);
      planId = route.params.id as string;
    } else {
      const newPlan = await countingStore.createPlan(data);
      planId = newPlan.id;
    }

    // Adicionar produtos ao plano
    if (selectedProducts.value.length > 0) {
      for (let i = 0; i < selectedProducts.value.length; i++) {
        const product = selectedProducts.value[i];
        try {
          await axios.post(`/api/v1/counting/products/plans/${planId}/products`, {
            productId: product.id,
            priority: selectedProducts.value.length - i
          }, {
            headers: {
              'Authorization': `Bearer ${authStore.accessToken}`
            }
          });
        } catch (productError: any) {
          console.error('Erro ao adicionar produto:', productError);
          // Continue mesmo se um produto falhar
        }
      }
    }

    alert('Plano salvo com sucesso!');
    router.push('/counting/plans');
  } catch (error: any) {
    console.error('Erro ao salvar plano:', error);
    const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
    alert(`Erro ao salvar plano: ${errorMessage}`);
  } finally {
    loading.value = false;
  }
};

const generatePDF = async () => {
  try {
    generatingPDF.value = true;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTO DE CONTAGEM DE ESTOQUE', pageWidth / 2, 20, { align: 'center' });
    
    // Linha divisória
    doc.setLineWidth(0.5);
    doc.line(15, 25, pageWidth - 15, 25);
    
    // Informações do Plano
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Informações do Plano', 15, 35);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let yPos = 42;
    
    const typeLabels: Record<string, string> = {
      'FULL_INVENTORY': 'Contagem Completa',
      'SPOT': 'Contagem Parcial',
      'CYCLIC': 'Contagem Cíclica',
      'BLIND': 'Contagem Cega'
    };
    
    const frequencyLabels: Record<string, string> = {
      'DAILY': 'Diária',
      'WEEKLY': 'Semanal',
      'MONTHLY': 'Mensal',
      'QUARTERLY': 'Trimestral',
      'YEARLY': 'Anual'
    };
    
    doc.text(`Código: ${form.value.code}`, 15, yPos);
    yPos += 7;
    doc.text(`Nome: ${form.value.name}`, 15, yPos);
    yPos += 7;
    doc.text(`Tipo: ${typeLabels[form.value.type] || form.value.type}`, 15, yPos);
    doc.text(`Frequência: ${frequencyLabels[form.value.frequency] || form.value.frequency}`, pageWidth / 2, yPos);
    yPos += 7;
    doc.text(`Prioridade: ${form.value.priority}`, 15, yPos);
    yPos += 7;
    
    if (form.value.startDate) {
      doc.text(`Data de Início: ${new Date(form.value.startDate).toLocaleDateString('pt-BR')}`, 15, yPos);
    }
    if (form.value.endDate) {
      doc.text(`Data de Término: ${new Date(form.value.endDate).toLocaleDateString('pt-BR')}`, pageWidth / 2, yPos);
    }
    yPos += 7;
    
    if (form.value.description) {
      doc.text(`Descrição: ${form.value.description}`, 15, yPos);
      yPos += 7;
    }
    
    yPos += 5;
    
    // Tabela de Produtos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Produtos para Contagem', 15, yPos);
    yPos += 7;
    
    if (selectedProducts.value.length > 0) {
      const tableData = selectedProducts.value.map((product, index) => [
        (index + 1).toString(),
        product.code,
        product.name,
        '____________',
        '____________'
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Código', 'Produto', 'Qtd. Contada', 'Responsável']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 5,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 70 },
          3: { cellWidth: 35 },
          4: { cellWidth: 40 },
        },
        didDrawPage: (data: any) => {
          // Rodapé em cada página
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
          doc.text(
            `Data de Impressão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
            15,
            pageHeight - 10
          );
        },
      });
      
      // Observações
      const finalY = (doc as any).lastAutoTable.finalY || yPos + 20;
      
      if (finalY + 40 < pageHeight - 20) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Observações:', 15, finalY + 15);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.line(15, finalY + 20, pageWidth - 15, finalY + 20);
        doc.line(15, finalY + 27, pageWidth - 15, finalY + 27);
        doc.line(15, finalY + 34, pageWidth - 15, finalY + 34);
        
        // Assinaturas
        const signatureY = finalY + 50;
        if (signatureY + 20 < pageHeight - 20) {
          doc.line(15, signatureY, 80, signatureY);
          doc.text('Contador', 47.5, signatureY + 5, { align: 'center' });
          
          doc.line(pageWidth - 80, signatureY, pageWidth - 15, signatureY);
          doc.text('Supervisor', pageWidth - 47.5, signatureY + 5, { align: 'center' });
        }
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.text('Nenhum produto adicionado ao plano.', 15, yPos);
    }
    
    // Salvar PDF
    const fileName = `contagem_${form.value.code}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Erro ao gerar PDF. Tente novamente.');
  } finally {
    generatingPDF.value = false;
  }
};
</script>
