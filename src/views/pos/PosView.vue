<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { apiClient } from '@/api/client';
import FiscalBillingForm from '@/components/FiscalBillingForm.vue';
import QuickStockModal from '@/components/QuickStockModal.vue';
import { usePosSyncStore } from '@/stores/posSync';
import type { Producto, DatosFiscales, FacturaEmitida } from '@/types';
import { 
  Scan, 
  Trash2, 
  PauseCircle, 
  PlayCircle, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Printer, 
  CheckCircle, 
  Store,
  FileText,
  ShieldCheck,
  CheckCircle2,
  PackageSearch,
  Zap,
  RefreshCw,
  X
} from 'lucide-vue-next';

interface PosItem {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  cantidad: number;
  variante_id?: string;
}

const skuInput = ref('');
const cajaAbierta = ref(true);
const cajaId = ref<string | null>(null);
const sucursalId = crypto.randomUUID();
const cajeroId = crypto.randomUUID();
const sucursalNombre = ref('Sucursal Central - La Paz');
const cajeroNombre = ref('Cajero: Oscar Menacho (Turno Mañana)');
const catalogoDb = ref<Producto[]>([]);

// Control de Stock Multi-Sucursal y Sincronización SSE
const isQuickStockOpen = ref(false);
const posSyncStore = usePosSyncStore();

// Banner de Sincronización Multicanal Reactiva (RF-08)
const syncToast = ref<{ message: string; type: 'info' | 'success' | 'warn'; timestamp: string } | null>(null);

function onCatalogoEvent(event: any) {
  const detail = event.detail;
  if (!detail) return;

  if (detail.sku) {
    const sku = detail.sku.toUpperCase();
    const dbIndex = catalogoDb.value.findIndex(p => p.sku === sku);
    if (dbIndex >= 0) {
      if (detail.precio !== undefined) catalogoDb.value[dbIndex].precio = Number(detail.precio);
      if (detail.nombre) catalogoDb.value[dbIndex].nombre = detail.nombre;
    } else if (detail.nombre) {
      catalogoDb.value.push({
        id: detail.producto_id || detail.id || crypto.randomUUID(),
        sku: sku,
        nombre: detail.nombre,
        precio: detail.precio ? Number(detail.precio) : 0,
        categoria_id: '',
        estado: detail.estado || 'publicado'
      });
    }

    // Actualización reactiva de precios en el ticket activo ante cambios administrativos
    const cartItem = cartItems.value.find(i => i.sku === sku);
    if (cartItem && detail.precio !== undefined && Number(detail.precio) !== cartItem.precio) {
      const oldPrice = cartItem.precio;
      cartItem.precio = Number(detail.precio);
      syncToast.value = {
        message: `🔄 Sincronización Multicanal: El precio de "${cartItem.nombre}" se actualizó de BOB ${oldPrice.toFixed(2)} a BOB ${cartItem.precio.toFixed(2)} en tiempo real.`,
        type: 'info',
        timestamp: new Date().toLocaleTimeString()
      };
      setTimeout(() => { syncToast.value = null; }, 7000);
    } else if (detail.tipo === 'producto_creado') {
      syncToast.value = {
        message: `✨ Catálogo Actualizado: Nuevo producto "${detail.nombre}" disponible para venta en POS.`,
        type: 'success',
        timestamp: new Date().toLocaleTimeString()
      };
      setTimeout(() => { syncToast.value = null; }, 5000);
    }
  } else if (detail.tipo === 'sincronizacion_masiva' || detail.tipo === 'catalogo_resincronizado') {
    loadPosCatalog();
    syncToast.value = {
      message: `⚡ Sincronización Global: Catálogo y precios actualizados desde el Administrador.`,
      type: 'success',
      timestamp: new Date().toLocaleTimeString()
    };
    setTimeout(() => { syncToast.value = null; }, 5000);
  }
}

async function manualSyncPos() {
  await posSyncStore.forzarResincronizacion();
  await loadPosCatalog();
  syncToast.value = {
    message: `Sincronización completada: ${posSyncStore.totalProductosSincronizados} productos en memoria local.`,
    type: 'success',
    timestamp: new Date().toLocaleTimeString()
  };
  setTimeout(() => { syncToast.value = null; }, 4000);
}

function getItemStock(sku: string): number {
  const match = catalogoDb.value.find(p => p.sku === sku);
  if (match && match.stock !== undefined && match.stock !== null) {
    return Number(match.stock);
  }
  return 12; // Valor estándar disponible en la sucursal activa
}

function onSelectProductFromStockModal(sku: string) {
  skuInput.value = sku;
  addItemByBarcode();
}

// Cargar catálogo de Supabase para obtener precios reales al escanear
async function loadPosCatalog() {
  try {
    const res = await apiClient.get('/api/v1/catalogo/productos');
    catalogoDb.value = Array.isArray(res.data) ? res.data : (res.data as any)?.productos || [];
    // Actualizar precios y variante_id de ítems iniciales según la BD
    cartItems.value.forEach(item => {
      const match = catalogoDb.value.find(p => p.sku === item.sku);
      if (match) {
        if (match.precio) item.precio = Number(match.precio);
        item.variante_id = match.variante_id || match.variantes?.[0]?.id;
      }
    });
  } catch (err) {
    console.error('Error cargando catálogo en POS:', err);
  }
}

const cartItems = ref<PosItem[]>([
  { id: '1', sku: 'LAP-DELL-XPS15', nombre: 'Laptop Dell XPS 15', precio: 6767.00, cantidad: 1, variante_id: '0f92a03b-df62-4916-ac39-4506b575d8af' },
  { id: '2', sku: 'MOU-LOG-MX3S', nombre: 'Mouse Logitech MX Master 3S', precio: 8999.00, cantidad: 1, variante_id: 'e38572aa-a259-40ce-ac39-6e0a4e4fd2c2' }
]);

const suspendedSales = ref<{
  id: string;
  cliente_referencia: string;
  items: any[];
  subtotal: number;
}[]>([]);

const subtotal = computed(() => cartItems.value.reduce((acc, curr) => acc + (curr.precio * curr.cantidad), 0));
const total = computed(() => subtotal.value);

// Modal de Cobro & Datos Fiscales (KAN-346, KAN-364, KAN-367)
const isPayModalOpen = ref(false);
const isSuspendedModalOpen = ref(false);
const payMethod = ref<'efectivo' | 'tarjeta' | 'qr'>('efectivo');
const cashGiven = ref<number>(11000);
const changeDue = computed(() => Math.max(0, (cashGiven.value || 0) - total.value));
const isReceiptReady = ref(false);
const isEmittingInvoice = ref(false);
const emitInvoiceError = ref('');

// Estado de datos fiscales (NIT / CI / Razón Social / Consumidor Final)
const fiscalData = ref<DatosFiscales>({
  modalidad: 'con_factura',
  tipo_documento: 'NIT',
  nit_ci: '1020304050',
  razon_social: 'EMPRESA MINERA SAN CRISTÓBAL S.A.',
  email_facturacion: 'contabilidad@sancristobal.bo',
  guardar_perfil: true
});
const isFiscalValid = ref(true);
const facturaEmitida = ref<FacturaEmitida | null>(null);

async function abrirCaja() {
  try {
    const response = await apiClient.post('/api/v1/pos/caja/abrir', {
      sucursal_id: sucursalId,
      cajero_id: cajeroId,
      fondo_inicial: 0
    });

    cajaId.value = response.data.id;
    cajaAbierta.value = true;

    console.log('Caja abierta:', cajaId.value);
  } catch (error) {
    console.error('Error al abrir la caja:', error);
    cajaAbierta.value = false;
  }
}

function addItemByBarcode() {
  if (!skuInput.value.trim()) return;
  const sku = skuInput.value.trim().toUpperCase();
  
  // Buscar en el catálogo local sincronizado (RF-08) o catálogo Supabase
  const localSync = posSyncStore.buscarPorSku(sku);
  const match = catalogoDb.value.find(p => p.sku === sku);
  const existing = cartItems.value.find(i => i.sku === sku);

  if (existing) {
    existing.cantidad += 1;
  } else {
    const itemPrecio = (localSync?.precio_referencia && localSync.precio_referencia > 0)
      ? localSync.precio_referencia
      : (match && match.precio ? Number(match.precio) : 150.00);

    cartItems.value.push({
      id: Date.now().toString(),
      sku: sku,
      nombre: match?.nombre || localSync?.nombre || `Artículo Escaneado [${sku}]`,
      precio: itemPrecio,
      cantidad: 1,
      variante_id: match?.variante_id || match?.variantes?.[0]?.id
    });
  }
  skuInput.value = '';
}

function removeItem(id: string) {
  cartItems.value = cartItems.value.filter(i => i.id !== id);
}

async function suspenderVenta() {
  if (cartItems.value.length === 0) return;

  const venta = {
    id: Date.now().toString(),
    cliente_referencia: fiscalData.value.razon_social || 'POS-CLIENTE',
    items: cartItems.value.map(item => ({
      variante_id: item.variante_id || crypto.randomUUID(),
      sku: item.sku,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio
    })),
    subtotal: total.value
  };

  try {
    if (!cajaId.value) {
      console.error('No hay caja abierta');
      return;
    }

    await apiClient.post(
      `/api/v1/pos/ventas/${cajaId.value}/suspender`,
      venta
    );

    cartItems.value = [];

    await cargarVentasSuspendidas();
  } catch (error) {
    console.error('Error al suspender la venta:', error);
  }
}

async function cargarVentasSuspendidas() {
  try {
    if (!cajaId.value) {
      console.error('No hay caja abierta');
      return;
    }

    const response = await apiClient.get(
      `/api/v1/pos/ventas/${cajaId.value}/suspendidas`
    );

    suspendedSales.value = response.data;
  } catch (error) {
    console.error(
      'Error al cargar ventas suspendidas:',
      error
    );
  }
}

async function reanudarVenta(index: number) {
  const sale = suspendedSales.value[index];

  if (!sale) return;

  try {
    if (!cajaId.value) {
      console.error('No hay caja abierta');
      return;
    }

    const response = await apiClient.delete(
      `/api/v1/pos/ventas/${cajaId.value}/suspendidas/${sale.id}`
    );

    cartItems.value = response.data.items.map((item: any) => ({
      id: item.variante_id || item.sku || Date.now().toString(),
      sku: item.sku,
      nombre: item.nombre,
      precio: Number(item.precio_unitario),
      cantidad: item.cantidad,
      variante_id: item.variante_id
    }));

    if (sale.cliente_referencia && sale.cliente_referencia !== 'POS-CLIENTE') {
      fiscalData.value.razon_social = sale.cliente_referencia;
    }

    suspendedSales.value.splice(index, 1);
  } catch (error) {
    console.error(
      'Error al recuperar la venta:',
      error
    );
  }
}

// Emisión oficial de factura legal electrónica (KAN-367)
async function finalizarCobro() {
  if (!isFiscalValid.value && fiscalData.value.modalidad === 'con_factura') {
    emitInvoiceError.value = 'Por favor verifica el NIT/CI y la Razón Social antes de procesar el cobro.';
    return;
  }

  isEmittingInvoice.value = true;
  emitInvoiceError.value = '';

  try {
    const res = await apiClient.post('/v1/facturacion/emitir', {
      modalidad: fiscalData.value.modalidad,
      tipo_documento: fiscalData.value.tipo_documento,
      nit_ci: fiscalData.value.nit_ci,
      razon_social: fiscalData.value.razon_social,
      email_facturacion: fiscalData.value.email_facturacion,
      guardar_perfil: fiscalData.value.guardar_perfil,
      sucursal: sucursalNombre.value,
      punto_venta: 1,
      metodo_pago: payMethod.value,
      items: cartItems.value,
      descuento: 0
    });

    facturaEmitida.value = res.data.factura;
    isReceiptReady.value = true;
  } catch (err: any) {
    emitInvoiceError.value = err.response?.data?.error || 'Error al emitir factura electrónica con el microservicio.';
  } finally {
    isEmittingInvoice.value = false;
  }
}

function resetPos() {
  cartItems.value = [];
  isPayModalOpen.value = false;
  isReceiptReady.value = false;
  facturaEmitida.value = null;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'F3') {
    e.preventDefault();
    isQuickStockOpen.value = !isQuickStockOpen.value;
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('maxiconecta:catalogo-actualizado', onCatalogoEvent);
  posSyncStore.iniciar();
  await abrirCaja();
  await loadPosCatalog();
  if (cajaId.value) {
    await cargarVentasSuspendidas();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('maxiconecta:catalogo-actualizado', onCatalogoEvent);
  posSyncStore.detenerEscuchaEnTiempoReal();
});

</script>

<template>
  <div class="min-h-[calc(100vh-8rem)] flex flex-col gap-5">
    <!-- Header de Caja y Turno (RF-09) -->
    <div class="relative overflow-hidden bg-slate-950 text-white px-5 py-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4 sm:items-center shadow-xl shadow-slate-900/20">
      <div class="absolute inset-0 opacity-40 surface-grid" />
      <div class="flex items-center gap-3">
        <span class="relative w-10 h-10 rounded-lg bg-cyan-400/15 border border-cyan-300/20 flex items-center justify-center"><Store class="w-5 h-5 text-cyan-300" /></span>
        <div>
          <h2 class="text-sm font-bold">{{ sucursalNombre }}</h2>
          <p class="text-xs text-slate-400">{{ cajeroNombre }}</p>
        </div>
      </div>
      <div class="relative flex items-center gap-3">
        <!-- Badge y Botón de Sincronización SSE en tiempo real (RF-08) -->
        <button
          type="button"
          @click="manualSyncPos"
          :disabled="posSyncStore.sincronizando"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 transition-all cursor-pointer"
          :title="'Hacer clic para sincronizar catálogo delta. Última sincronización: ' + (posSyncStore.ultimaSincronizacion || 'Inicial')"
        >
          <span class="w-2 h-2 rounded-full" :class="posSyncStore.conectado ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'"></span>
          <span>{{ posSyncStore.conectado ? 'SSE En Vivo' : 'Catálogo Local' }}</span>
          <span class="px-1.5 py-0.2 rounded-md bg-slate-900 text-cyan-300 text-[10px] font-bold">
            {{ posSyncStore.totalProductosSincronizados }} SKUs
          </span>
          <RefreshCw class="w-3.5 h-3.5 text-slate-400" :class="posSyncStore.sincronizando ? 'animate-spin text-cyan-400' : ''" />
        </button>

        <!-- Botón de Consulta Rápida de Stock (RF-07 / Atajo F3) -->
        <button
          type="button"
          @click="isQuickStockOpen = true"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95 border border-blue-400/40"
          title="Consultar Stock Multi-Sucursal (F3)"
        >
          <PackageSearch class="w-3.5 h-3.5" />
          <span>Stock Multi-Sucursal [F3]</span>
        </button>

        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Caja Abierta
        </span>
        <button class="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 font-medium">
          Arqueo / Cierre
        </button>
      </div>
    </div>

    <!-- Banner de Notificación de Sincronización en Tiempo Real (RF-08) -->
    <div
      v-if="syncToast"
      :class="[
        'px-4 py-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-2 shadow-sm',
        syncToast.type === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
          : 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200'
      ]"
    >
      <div class="flex items-center gap-2.5">
        <Zap class="w-4 h-4 text-cyan-500 shrink-0" />
        <span>{{ syncToast.message }}</span>
        <span class="text-[10px] text-slate-400 ml-2">({{ syncToast.timestamp }})</span>
      </div>
      <button @click="syncToast = null" class="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Contenido Principal POS -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Columna Izquierda: Escáner y Tabla de Ítems -->
      <div class="lg:col-span-2 flex flex-col min-h-[520px] bg-white/95 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-300/20 dark:shadow-none p-4 overflow-hidden">
        <!-- Input Barcode -->
        <form @submit.prevent="addItemByBarcode" class="flex gap-2 mb-4">
          <div class="relative flex-1">
            <Scan class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="skuInput"
              type="text"
              autofocus
              placeholder="Escanear código de barras o escribir SKU y presionar ENTER..."
              class="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
            />
          </div>
          <button type="submit" class="bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm">
            Agregar
          </button>
          <button 
            type="button" 
            @click="isQuickStockOpen = true"
            class="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all"
            title="Consultar Stock en todas las sucursales (F3)"
          >
            <PackageSearch class="w-4 h-4" />
            <span class="hidden sm:inline">Stock [F3]</span>
          </button>
        </form>

        <!-- Tabla de Productos Escaneados -->
        <div class="flex-1 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
              <tr>
                <th class="p-3">SKU</th>
                <th class="p-3">Descripción</th>
                <th class="p-3 text-center">Stock Disp.</th>
                <th class="p-3 text-center">Cant.</th>
                <th class="p-3 text-right">Precio</th>
                <th class="p-3 text-right">Total</th>
                <th class="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="item in cartItems" :key="item.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{{ item.sku }}</td>
                <td class="p-3 text-slate-800 dark:text-slate-200">{{ item.nombre }}</td>
                <td class="p-3 text-center">
                  <span 
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold"
                    :class="getItemStock(item.sku) > 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border border-rose-200'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" :class="getItemStock(item.sku) > 0 ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                    {{ getItemStock(item.sku) }} unid.
                  </span>
                </td>
                <td class="p-3 text-center">
                  <span class="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 font-bold rounded">{{ item.cantidad }}</span>
                </td>
                <td class="p-3 text-right">BOB {{ item.precio.toFixed(2) }}</td>
                <td class="p-3 text-right font-bold text-slate-900 dark:text-white">BOB {{ (item.precio * item.cantidad).toFixed(2) }}</td>
                <td class="p-3 text-center">
                  <button @click="removeItem(item.id)" class="text-rose-500 hover:text-rose-700 p-1">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="cartItems.length === 0">
                <td colspan="7" class="p-8 text-center text-slate-400">
                  No hay productos escaneados en esta transacción.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Ventas Suspendidas (RF-12) -->
        <div
          v-if="suspendedSales.length > 0"
          class="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between"
        >
          <div class="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
            <PauseCircle class="w-4 h-4 text-amber-600" />

            <span>
              {{ suspendedSales.length }} venta(s) suspendida(s) en espera
            </span>
          </div>

          <button
            type="button"
            @click="isSuspendedModalOpen = true"
            class="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <PlayCircle class="w-4 h-4" />
            Ver ventas en espera
          </button>
        </div>

      </div>

      <!-- Columna Derecha: Panel de Cobro y Totales -->
      <div class="flex flex-col justify-between bg-white/95 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-300/20 dark:shadow-none p-5">
        <div class="space-y-4">
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
            Resumen de Cobro
          </h3>

          <div class="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div class="flex justify-between">
              <span>Ítems totales:</span>
              <span class="font-bold text-slate-800 dark:text-slate-200">{{ cartItems.reduce((a, c) => a + c.cantidad, 0) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Subtotal:</span>
              <span>BOB {{ subtotal.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Impuestos (IVA 13% incluido):</span>
              <span>BOB {{ (total * 0.13).toFixed(2) }}</span>
            </div>
          </div>

          <!-- Total Destacado -->
          <div class="bg-gradient-to-br from-teal-700 to-cyan-800 p-5 rounded-xl border border-teal-500/40 text-center shadow-lg shadow-teal-900/15">
            <span class="text-xs uppercase font-bold text-teal-100 tracking-wider">Total a cobrar</span>
            <div class="text-3xl font-black text-white mt-1">
              BOB {{ total.toFixed(2) }}
            </div>
          </div>
        </div>

        <!-- Botonera de Acción -->
        <div class="space-y-2.5 pt-4">
          <button
            @click="isPayModalOpen = true"
            :disabled="cartItems.length === 0"
            class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/15 flex items-center justify-center gap-2 active:scale-98"
          >
            <Banknote class="w-5 h-5" /> Cobrar Transacción [F12]
          </button>

          <button
            @click="suspenderVenta"
            :disabled="cartItems.length === 0"
            class="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <PauseCircle class="w-4 h-4 text-amber-500" /> Suspender Venta [F4]
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Cobro y Factura Rápida (RF-10, KAN-346, KAN-364, KAN-367) -->
    <div v-if="isPayModalOpen" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div v-if="!isReceiptReady" class="space-y-4">
          <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Store class="w-4 h-4 text-emerald-600" /> Procesar Cobro y Facturación en Caja
              </h3>
              <p class="text-xs text-slate-500">Ingreso de datos tributarios antes de procesar el pago</p>
            </div>
            <button @click="isPayModalOpen = false" class="p-1 rounded-lg text-slate-400 hover:text-slate-700">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Total a Pagar en Caja -->
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex justify-between items-center">
            <span class="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Total a Cobrar:</span>
            <span class="text-xl font-black text-emerald-700 dark:text-emerald-200">BOB {{ total.toFixed(2) }}</span>
          </div>

          <!-- FORMULARIO FISCAL COMPONENTE (KAN-364) -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <FiscalBillingForm
              v-model="fiscalData"
              context="pos"
              @validation-change="isFiscalValid = $event"
            />
          </div>
          
          <!-- Método de Pago -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Método de Pago:</label>
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                @click="payMethod = 'efectivo'"
                :class="['p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all', payMethod === 'efectivo' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-slate-200 dark:border-slate-700']"
              >
                <Banknote class="w-5 h-5" /> Efectivo
              </button>
              <button
                type="button"
                @click="payMethod = 'tarjeta'"
                :class="['p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all', payMethod === 'tarjeta' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 dark:border-slate-700']"
              >
                <CreditCard class="w-5 h-5" /> Tarjeta POS
              </button>
              <button
                type="button"
                @click="payMethod = 'qr'"
                :class="['p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all', payMethod === 'qr' ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm' : 'border-slate-200 dark:border-slate-700']"
              >
                <QrCode class="w-5 h-5" /> QR Simple
              </button>
            </div>
          </div>

          <!-- Monto Recibido y Cambio -->
          <div v-if="payMethod === 'efectivo'" class="space-y-3 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold">Monto Recibido en Efectivo (BOB):</label>
              <input
                v-model.number="cashGiven"
                type="number"
                min="0"
                step="1"
                class="w-32 text-right font-bold text-base p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500"
              />
            </div>
            <div class="flex justify-between items-center text-sm font-bold text-emerald-600 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-700 pt-2">
              <span>Cambio a Entregar:</span>
              <span class="text-lg">BOB {{ changeDue.toFixed(2) }}</span>
            </div>
          </div>

          <p v-if="emitInvoiceError" class="p-2.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
            {{ emitInvoiceError }}
          </p>

          <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button @click="isPayModalOpen = false" class="px-4 py-2 text-xs text-slate-500 font-semibold hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button
              @click="finalizarCobro"
              :disabled="isEmittingInvoice"
              class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
            >
              <FileText class="w-4 h-4" />
              <span>{{ isEmittingInvoice ? 'Timbrando Factura...' : 'Confirmar e Imprimir Factura Legal' }}</span>
            </button>
          </div>
        </div>

        <!-- Ticket y Factura Electrónica Timbrada CUF (KAN-367) -->
        <div v-else class="space-y-4">
          <div class="text-center space-y-1">
            <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 class="w-7 h-7" />
            </div>
            <h3 class="text-lg font-black text-slate-900 dark:text-white">¡Factura Electrónica Emitida con Éxito!</h3>
            <p class="text-xs text-slate-500">Documento Fiscal Timbrado en Línea ante el SIN</p>
          </div>

          <!-- Factura Legal Impresa con Estilo Ticket -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 font-mono text-xs">
            <div class="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-2.5">
              <h4 class="font-extrabold text-sm tracking-wide">MAXICONECTA BOLIVIA S.R.L.</h4>
              <p class="text-[10px] text-slate-500">Casa Matriz: Av. 16 de Julio N° 1440 · La Paz, Bolivia</p>
              <p class="text-[10px] text-slate-500">NIT Emisor: 1028374029</p>
              <p class="text-[10px] font-bold mt-1 text-blue-600 dark:text-blue-400">
                FACTURA ELECTRÓNICA EN LÍNEA N° {{ facturaEmitida?.numero_factura || 1421 }}
              </p>
            </div>

            <!-- Datos del Cliente / Razón Social -->
            <div class="space-y-1 text-[11px] border-b border-dashed border-slate-300 dark:border-slate-700 pb-2.5">
              <div class="flex justify-between">
                <span class="text-slate-400">FECHA:</span>
                <span>{{ new Date(facturaEmitida?.fecha_emision || Date.now()).toLocaleString('es-BO') }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">SEÑOR(ES):</span>
                <span class="font-bold text-right truncate max-w-[250px]">
                  {{ facturaEmitida?.datos_comprador.razon_social || 'CONSUMIDOR FINAL' }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">NIT / CI / CEX:</span>
                <span class="font-bold font-mono">{{ facturaEmitida?.datos_comprador.nit_ci || '0' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">SUCURSAL:</span>
                <span>{{ sucursalNombre }}</span>
              </div>
            </div>

            <!-- Detalle de Productos -->
            <div class="space-y-1.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-2.5">
              <div v-for="it in (facturaEmitida?.items || cartItems)" :key="it.sku" class="flex justify-between text-[11px]">
                <span class="truncate max-w-[200px]">{{ it.cantidad }}x {{ it.nombre }}</span>
                <span class="font-bold">BOB {{ ('subtotal' in it ? it.subtotal : it.cantidad * it.precio).toFixed(2) }}</span>
              </div>
            </div>

            <!-- Totales -->
            <div class="space-y-1 text-right text-xs">
              <div class="flex justify-between font-bold text-sm">
                <span>TOTAL A PAGAR:</span>
                <span class="text-emerald-600">BOB {{ total.toFixed(2) }}</span>
              </div>
              <div class="text-[10px] text-slate-400 flex justify-between">
                <span>Importe Base Crédito Fiscal:</span>
                <span>BOB {{ total.toFixed(2) }}</span>
              </div>
              <div class="text-[10px] text-slate-400 flex justify-between">
                <span>Método de Pago:</span>
                <span class="uppercase font-bold">{{ payMethod }}</span>
              </div>
            </div>

            <!-- Timbrado Fiscal CUF y QR -->
            <div class="pt-2 text-center space-y-2 border-t border-dashed border-slate-300 dark:border-slate-700">
              <div class="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] break-all font-mono">
                <span class="font-bold block text-slate-500">CÓDIGO ÚNICO DE FACTURACIÓN (CUF):</span>
                <span class="text-blue-600 dark:text-blue-400">{{ facturaEmitida?.cuf || 'CUF-2026-F981-88AA-1200' }}</span>
              </div>

              <!-- Simulación QR Fiscal -->
              <div class="flex items-center justify-center gap-2 py-1">
                <div class="p-2 bg-white rounded-lg border border-slate-300 shadow-sm inline-block">
                  <QrCode class="w-16 h-16 text-slate-900" />
                </div>
              </div>

              <p class="text-[9px] text-slate-400 leading-tight">
                "ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY"
              </p>
              <p class="text-[8px] text-slate-400">
                Ley N° 453: El proveedor deberá suministrar el servicio en las modalidades y términos ofertados.
              </p>
            </div>
          </div>

          <div class="flex justify-center gap-3 pt-2">
            <button @click="resetPos" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2">
              <Printer class="w-4 h-4" /> Imprimir Ticket y Nueva Venta
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Ventas en Espera (KAN-331) -->
    <div
      v-if="isSuspendedModalOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        <!-- Encabezado -->
        <div class="flex items-center justify-between mb-5">
          <div>
            <div class="flex items-center gap-2">
              <PauseCircle class="w-6 h-6 text-amber-500" />

              <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                Ventas en espera
              </h3>
            </div>

            <p class="text-xs text-slate-500 mt-1">
              Selecciona una venta para recuperarla al carrito activo.
            </p>
          </div>

          <button
            type="button"
            @click="isSuspendedModalOpen = false"
            class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xl"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <!-- Lista de ventas -->
        <div
          v-if="suspendedSales.length > 0"
          class="space-y-3 max-h-80 overflow-y-auto"
        >
          <div
            v-for="(sale, idx) in suspendedSales"
            :key="sale.id"
            class="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p class="font-bold text-slate-900 dark:text-white">
                Ticket #{{ sale.id }}
              </p>

              <p class="text-xs text-slate-500 mt-1">
                Cliente: {{ sale.cliente_referencia }}
              </p>

              <p class="text-sm font-semibold text-amber-600 mt-2">
                BOB {{ Number(sale.subtotal).toFixed(2) }}
              </p>
            </div>

            <button
              type="button"
              @click="reanudarVenta(idx); isSuspendedModalOpen = false"
              class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
            >
              <PlayCircle class="w-4 h-4" />
              Recuperar
            </button>
          </div>
        </div>

        <!-- Sin ventas -->
        <div
          v-else
          class="text-center py-10 text-slate-500"
        >
          <PauseCircle class="w-10 h-10 mx-auto mb-3 text-slate-300" />

          <p class="font-semibold">
            No hay ventas en espera.
          </p>

          <p class="text-xs mt-1">
            Las ventas suspendidas aparecerán aquí.
          </p>
        </div>

        <!-- Pie -->
        <div class="flex justify-end mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            @click="isSuspendedModalOpen = false"
            class="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Consulta Rápida de Stock Multi-Sucursal (RF-07 / Atajo F3) -->
    <QuickStockModal 
      :open="isQuickStockOpen" 
      @close="isQuickStockOpen = false"
      @select="onSelectProductFromStockModal"
    />
  </div>
</template>
