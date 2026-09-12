<template>
  <AppLayout title="Agendamento e Check-in" subtitle="Agende a chegada de veículos e registre o check-in na portaria">
    <template #actions>
      <Button variant="outline" @click="openWalkInModal" class="mr-2">Check-in Direto</Button>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Agendamento</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="visit-filter-warehouse" label="Armazém">
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
        <FormField id="visit-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="SCHEDULED">Agendado</option>
            <option value="CHECKED_IN">Check-in feito</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="visitList"
      :pagination="pagination"
      empty-title="Nenhuma visita encontrada"
      empty-hint="Ajuste os filtros ou crie um novo agendamento."
      @retry="loadVisits"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Agendamento</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Motorista / Veículo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Agendado para</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Pontualidade</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).warehouse?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          <span v-if="asItem(item).driver">{{ asItem(item).driver!.name }} / {{ asItem(item).vehicle!.plate }}</span>
          <span v-else>-</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(asItem(item).scheduledAt) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            v-if="asItem(item).punctuality"
            :label="PUNCTUALITY_LABELS[asItem(item).punctuality!]"
            :tone="PUNCTUALITY_TONES[asItem(item).punctuality!]"
          />
          <span v-else class="text-sm text-gray-400">-</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="STATUS_LABELS[asItem(item).status]" :tone="STATUS_TONES[asItem(item).status]" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <template v-if="asItem(item).status === 'SCHEDULED'">
            <button @click="openCheckInModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Fazer Check-in</button>
            <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
            <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
          </template>
          <template v-else-if="asItem(item).status === 'CHECKED_IN'">
            <button @click="handleCancel(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Cancelar</button>
          </template>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="showCreateModal" :title="editingVisit ? 'Editar Agendamento' : isWalkIn ? 'Check-in Direto' : 'Novo Agendamento'" @close="closeCreateModal">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="visit-form-warehouse" label="Armazém" required>
            <select v-model="formData.warehouseId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option value="">Selecione...</option>
              <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
            </select>
          </FormField>
          <FormField id="visit-form-service-type" label="Tipo de Serviço" required>
            <select v-model="formData.serviceType" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" @change="onServiceTypeChange">
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="EXPEDICAO">Expedição</option>
              <option value="MULTIUSO">Multiuso</option>
            </select>
          </FormField>
        </div>

        <FormField v-if="formData.serviceType === 'RECEBIMENTO'" id="visit-form-purchase-order" label="Pedido de Compra (opcional)">
          <select v-model="formData.purchaseOrderId" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" @change="onPurchaseOrderChange">
            <option value="">Nenhum (preenchimento manual)</option>
            <option v-for="po in confirmedPurchaseOrders" :key="po.id" :value="po.id">{{ po.orderNumber }} — {{ po.supplier?.name }}</option>
          </select>
        </FormField>

        <FormField id="visit-form-supplier" label="Fornecedor" :required="formData.serviceType !== 'EXPEDICAO'">
          <select v-model="formData.supplierId" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Nenhum</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="visit-form-scheduled-at" label="Data/Hora agendada" required>
            <input v-model="formData.scheduledAt" type="datetime-local" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </FormField>
          <FormField id="visit-form-notes" label="Observação (até 70 caracteres)">
            <input v-model="formData.notes" type="text" maxlength="70" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </FormField>
        </div>

        <template v-if="isWalkIn">
          <FormField id="visit-form-driver" label="Motorista" required>
            <select v-model="formData.driverId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option value="">Selecione...</option>
              <option v-for="d in driverStore.drivers" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </FormField>
          <FormField id="visit-form-vehicle" label="Veículo" required>
            <select v-model="formData.vehicleId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option value="">Selecione...</option>
              <option v-for="v in vehicleStore.vehicles" :key="v.id" :value="v.id">{{ v.plate }}</option>
            </select>
          </FormField>
        </template>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCreateModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingVisit ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showCheckInModal" title="Fazer Check-in" @close="closeCheckInModal">
      <form id="checkin-form" @submit.prevent="handleConfirmCheckIn" class="space-y-4">
        <FormField id="checkin-driver" label="Motorista" required>
          <select v-model="checkInData.driverId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Selecione...</option>
            <option v-for="d in driverStore.drivers" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </FormField>
        <FormField id="checkin-vehicle" label="Veículo" required>
          <select v-model="checkInData.vehicleId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="">Selecione...</option>
            <option v-for="v in vehicleStore.vehicles" :key="v.id" :value="v.id">{{ v.plate }}</option>
          </select>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCheckInModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Confirmar Check-in</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useYardVisitStore } from '@/stores/yard-visit.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useSupplierStore } from '@/stores/supplier.store'
import { useDriverStore } from '@/stores/driver.store'
import { useVehicleStore } from '@/stores/vehicle.store'
import purchaseOrderService, { type PurchaseOrder } from '@/services/purchase-order.service'
import type { YardVisit, YardVisitStatus, PunctualityStatus } from '@/services/yard-visit.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const STATUS_LABELS: Record<YardVisitStatus, string> = {
  SCHEDULED: 'Agendado',
  CHECKED_IN: 'Check-in feito',
  CANCELLED: 'Cancelado',
}
const STATUS_TONES: Record<YardVisitStatus, 'success' | 'warning' | 'danger'> = {
  SCHEDULED: 'warning',
  CHECKED_IN: 'success',
  CANCELLED: 'danger',
}
const PUNCTUALITY_LABELS: Record<Exclude<PunctualityStatus, null>, string> = {
  NO_HORARIO: 'No horário',
  ANTECIPADO: 'Antecipado',
  ATRASADO: 'Atrasado',
}
const PUNCTUALITY_TONES: Record<Exclude<PunctualityStatus, null>, 'success' | 'warning' | 'danger'> = {
  NO_HORARIO: 'success',
  ANTECIPADO: 'warning',
  ATRASADO: 'danger',
}

const yardVisitStore = useYardVisitStore()
const warehouseStore = useWarehouseStore()
const supplierStore = useSupplierStore()
const driverStore = useDriverStore()
const vehicleStore = useVehicleStore()
const toast = useToast()

const visitList = ref<YardVisit[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showCreateModal = ref(false)
const showCheckInModal = ref(false)
const isWalkIn = ref(false)
const editingVisit = ref<YardVisit | null>(null)
const checkingInVisit = ref<YardVisit | null>(null)
const checkInData = ref({ driverId: '', vehicleId: '' })
const confirmedPurchaseOrders = ref<PurchaseOrder[]>([])
const filters = ref({ warehouseId: '', status: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({
  warehouseId: '',
  serviceType: 'RECEBIMENTO' as YardVisit['serviceType'],
  supplierId: '',
  purchaseOrderId: '',
  scheduledAt: '',
  notes: '',
  driverId: '',
  vehicleId: '',
})

const loadVisits = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await yardVisitStore.fetchVisits(pagination.value.page, pagination.value.limit, {
      warehouseId: filters.value.warehouseId || undefined,
      status: (filters.value.status || undefined) as YardVisitStatus | undefined,
    })
    visitList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar visitas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadVisits() }
const changePage = (page: number) => { pagination.value.page = page; loadVisits() }
const resetFormData = () => ({
  warehouseId: '', serviceType: 'RECEBIMENTO' as YardVisit['serviceType'], supplierId: '',
  purchaseOrderId: '', scheduledAt: '', notes: '', driverId: '', vehicleId: '',
})

const loadConfirmedPurchaseOrders = async () => {
  const result = await purchaseOrderService.getAll(1, 100, { status: 'CONFIRMED' })
  confirmedPurchaseOrders.value = result.data.data
}

const onServiceTypeChange = () => {
  if (formData.value.serviceType !== 'RECEBIMENTO') formData.value.purchaseOrderId = ''
}

const onPurchaseOrderChange = () => {
  const po = confirmedPurchaseOrders.value.find((p) => p.id === formData.value.purchaseOrderId)
  if (po) {
    formData.value.supplierId = po.supplierId
    formData.value.scheduledAt = toLocalDatetimeInputValue(po.expectedDate)
  }
}

const openCreateModal = () => { isWalkIn.value = false; editingVisit.value = null; formData.value = resetFormData(); showCreateModal.value = true }
const openWalkInModal = () => { isWalkIn.value = true; editingVisit.value = null; formData.value = resetFormData(); showCreateModal.value = true }
const openEditModal = (visit: YardVisit) => {
  isWalkIn.value = false
  editingVisit.value = visit
  formData.value = {
    warehouseId: visit.warehouseId,
    serviceType: visit.serviceType,
    supplierId: visit.supplierId || '',
    purchaseOrderId: visit.purchaseOrderId || '',
    scheduledAt: toLocalDatetimeInputValue(visit.scheduledAt),
    notes: visit.notes || '',
    driverId: '',
    vehicleId: '',
  }
  showCreateModal.value = true
}
const closeCreateModal = () => { showCreateModal.value = false; editingVisit.value = null }

const openCheckInModal = (visit: YardVisit) => {
  checkingInVisit.value = visit
  checkInData.value = { driverId: '', vehicleId: '' }
  showCheckInModal.value = true
}
const closeCheckInModal = () => { showCheckInModal.value = false; checkingInVisit.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingVisit.value) {
      const data = {
        serviceType: formData.value.serviceType,
        supplierId: formData.value.supplierId || null,
        purchaseOrderId: formData.value.purchaseOrderId || null,
        scheduledAt: fromLocalDatetimeInputValue(formData.value.scheduledAt),
        notes: formData.value.notes || null,
      }
      await yardVisitStore.updateVisit(editingVisit.value.id, data)
      toast.success('Agendamento atualizado com sucesso!')
    } else {
      const data = {
        ...formData.value,
        supplierId: formData.value.supplierId || null,
        purchaseOrderId: formData.value.purchaseOrderId || null,
        scheduledAt: fromLocalDatetimeInputValue(formData.value.scheduledAt),
        notes: formData.value.notes || null,
        driverId: isWalkIn.value ? formData.value.driverId : undefined,
        vehicleId: isWalkIn.value ? formData.value.vehicleId : undefined,
      }
      await yardVisitStore.createVisit(data)
      toast.success(isWalkIn.value ? 'Check-in registrado com sucesso!' : 'Agendamento criado com sucesso!')
    }
    closeCreateModal()
    await loadVisits()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar')
  } finally {
    saving.value = false
  }
}

const handleConfirmCheckIn = async () => {
  if (!checkingInVisit.value) return
  try {
    await yardVisitStore.checkIn(checkingInVisit.value.id, checkInData.value)
    toast.success('Check-in realizado com sucesso!')
    closeCheckInModal()
    await loadVisits()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao fazer check-in')
  }
}

const handleDelete = async (visit: YardVisit) => {
  if (await confirmDialog('Deseja realmente excluir este agendamento?')) {
    try {
      await yardVisitStore.deleteVisit(visit.id)
      toast.success('Agendamento excluído com sucesso!')
      await loadVisits()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir agendamento')
    }
  }
}

const handleCancel = async (visit: YardVisit) => {
  if (await confirmDialog('Deseja realmente cancelar esta visita?')) {
    try {
      await yardVisitStore.cancelVisit(visit.id)
      toast.success('Visita cancelada com sucesso!')
      await loadVisits()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cancelar visita')
    }
  }
}

const asItem = (item: unknown) => item as YardVisit
const formatDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR')

// Converte um ISO UTC (vindo da API) para o formato que <input type="datetime-local">
// espera, já no fuso horário LOCAL do navegador (não corta a string UTC direto).
const toLocalDatetimeInputValue = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Converte o valor naive de <input type="datetime-local"> (interpretado como
// horário LOCAL do navegador) para um ISO UTC de verdade, pronto pra mandar à API.
const fromLocalDatetimeInputValue = (localValue: string): string => {
  return new Date(localValue).toISOString()
}

onMounted(async () => {
  await Promise.all([
    warehouseStore.fetchWarehouses(),
    supplierStore.fetchSuppliers(),
    driverStore.fetchDrivers(),
    vehicleStore.fetchVehicles(),
    loadConfirmedPurchaseOrders(),
  ])
  await loadVisits()
})
</script>
