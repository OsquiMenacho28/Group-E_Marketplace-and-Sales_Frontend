<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiClient } from '@/api/client';
import type { Producto } from '@/types';
import { useAuthStore } from '@/stores/auth';
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
  Store 
} from 'lucide-vue-next';

interface PosItem {
  id: string;
  variante_id: string;
  sku: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

interface TicketEmitido {
  orden_id: string;
  codigo_orden: string;
  subtotal_neto: number;
  monto_iva: number;
  total: number;
  metodo_pago: string;
  numero_factura: number;
  cuf: string;
  cufd?: string | null;
  qr_url: string;
  qr_code: string;
  items: Array<{
    sku: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    total_linea: number;
  }>;
  ticket_impresion: string;
}

const authStore = useAuthStore();
const skuInput = ref('');
const cajaAbierta = ref(false);
const cajaId = ref<string | null>(null);
const sucursalId = crypto.randomUUID();
const cajeroId = authStore.user?.id || crypto.randomUUID();
const sucursalNombre = ref('Sucursal Central - La Paz');
const cajeroNombre = ref('Cajero: Oscar Menacho (Turno Mañana)');
const catalogoDb = ref<Producto[]>([]);
const cajaError = ref('');
const cobroError = ref('');
const isProcessingPayment = ref(false);
const ticketEmitido = ref<TicketEmitido | null>(null);

// Cargar catálogo de Supabase para obtener precios reales al escanear
async function loadPosCatalog() {
  try {
    const res = await apiClient.get('/api/v1/catalogo/productos');
    catalogoDb.value = Array.isArray(res.data) ? res.data : res.data.productos || [];
    // Actualizar precios de ítems iniciales si coinciden con la BD
    cartItems.value.forEach(item => {
      const match = catalogoDb.value.find(p => p.sku === item.sku);
      if (match && match.precio) {
        item.precio = Number(match.precio);
      }
    });
  } catch (err) {
    console.error('Error cargando catálogo en POS:', err);
  }
}

onMounted(() => {
  loadPosCatalog();
  abrirCaja();
});

const cartItems = ref<PosItem[]>([]);

const suspendedSales = ref<{ id: string; ticket: string; total: number; items: PosItem[] }[]>([]);

const subtotal = computed(() => cartItems.value.reduce((acc, curr) => acc + (curr.precio * curr.cantidad), 0));
const total = computed(() => subtotal.value);
const montoIva = computed(() => Math.round((total.value * 13 / 113) * 100) / 100);
const subtotalNeto = computed(() => Math.round((total.value - montoIva.value) * 100) / 100);

// Modal de Cobro
const isPayModalOpen = ref(false);
const payMethod = ref<'efectivo' | 'tarjeta' | 'qr'>('efectivo');
const cashGiven = ref<number>(11000);
const changeDue = computed(() => Math.max(0, (cashGiven.value || 0) - total.value));
const isReceiptReady = ref(false);

async function abrirCaja() {
  try {
    const { data } = await apiClient.post('/api/v1/pos/caja/abrir', {
      sucursal_id: sucursalId,
      cajero_id: cajeroId,
      fondo_inicial: 0
    });
    cajaId.value = data.id;
    cajaAbierta.value = data.estado === 'abierta';
    cajaError.value = '';
  } catch (error: any) {
    cajaError.value = error.response?.data?.detail || 'No se pudo abrir la caja. Inicia sesión con un usuario autorizado.';
    cajaAbierta.value = false;
  }
}

function addItemByBarcode() {
  if (!skuInput.value.trim()) return;
  const sku = skuInput.value.trim().toUpperCase();
  
  // Buscar en el catálogo real de Supabase
  const match = catalogoDb.value.find(product =>
    product.sku.toUpperCase() === sku || product.variantes?.some(variant => variant.sku.toUpperCase() === sku)
  );
  if (!match) {
    cobroError.value = `No se encontró el producto con SKU ${sku}.`;
    return;
  }
  const variant = match.variantes?.find(item => item.sku.toUpperCase() === sku) || match.variantes?.[0];
  if (!variant) {
    cobroError.value = `El producto ${sku} no tiene una variante facturable.`;
    return;
  }
  const skuVariante = variant.sku || match.sku;
  const existing = cartItems.value.find(i => i.sku === skuVariante);

  if (existing) {
    existing.cantidad += 1;
  } else {
    cartItems.value.push({
      id: Date.now().toString(),
      variante_id: variant.id,
      sku: skuVariante,
      nombre: variant.nombre_variante && (match.variantes?.length ?? 0) > 1 ? `${match.nombre} · ${variant.nombre_variante}` : match.nombre,
      precio: Number(variant.precio || match.precio || 0),
      cantidad: 1
    });
  }
  skuInput.value = '';
}

function removeItem(id: string) {
  cartItems.value = cartItems.value.filter(i => i.id !== id);
}

function suspenderVenta() {
  if (cartItems.value.length === 0) return;
  suspendedSales.value.push({
    id: Date.now().toString(),
    ticket: `Ticket #${suspendedSales.value.length + 1}`,
    total: total.value,
    items: [...cartItems.value]
  });
  cartItems.value = [];
}

function reanudarVenta(index: number) {
  const sale = suspendedSales.value.splice(index, 1)[0];
  cartItems.value = sale.items;
}

async function finalizarCobro() {
  if (!cajaId.value || !cajaAbierta.value) {
    cobroError.value = 'No hay una caja abierta. Vuelve a abrir la caja antes de cobrar.';
    return;
  }
  if (payMethod.value === 'efectivo' && cashGiven.value < total.value) {
    cobroError.value = 'El monto recibido no cubre el total de la venta.';
    return;
  }
  isProcessingPayment.value = true;
  cobroError.value = '';
  try {
    const { data } = await apiClient.post<TicketEmitido>('/api/v1/pos/ventas/cobrar', {
      caja_id: cajaId.value,
      sucursal_id: sucursalId,
      cliente_nit_ci: '0',
      cliente_razon_social: 'CONSUMIDOR FINAL',
      items: cartItems.value.map(item => ({
        variante_id: item.variante_id,
        sku: item.sku,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio
      })),
      metodo_pago: payMethod.value
    });
    ticketEmitido.value = data;
    isReceiptReady.value = true;
  } catch (error: any) {
    cobroError.value = error.response?.data?.detail || 'No se pudo emitir el ticket tributario. No se confirmó el cobro.';
  } finally {
    isProcessingPayment.value = false;
  }
}

function imprimirTicket() {
  window.print();
}

function resetPos() {
  cartItems.value = [];
  isPayModalOpen.value = false;
  isReceiptReady.value = false;
  ticketEmitido.value = null;
  cobroError.value = '';
}
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
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <span class="w-2 h-2 rounded-full" :class="cajaAbierta ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
          {{ cajaAbierta ? 'Caja Abierta' : 'Caja Cerrada' }}
        </span>
        <button class="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 font-medium">
          Arqueo / Cierre
        </button>
      </div>
    </div>
    <p v-if="cajaError" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">{{ cajaError }}</p>

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
        </form>

        <!-- Tabla de Productos Escaneados -->
        <div class="flex-1 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
              <tr>
                <th class="p-3">SKU</th>
                <th class="p-3">Descripción</th>
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
                <td colspan="6" class="p-8 text-center text-slate-400">
                  No hay productos escaneados en esta transacción.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Ventas Suspendidas (RF-12) -->
        <div v-if="suspendedSales.length > 0" class="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
          <div class="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
            <PauseCircle class="w-4 h-4 text-amber-600" />
            <span>{{ suspendedSales.length }} venta(s) suspendida(s) en espera:</span>
          </div>
          <div class="flex gap-2">
            <button
              v-for="(s, idx) in suspendedSales"
              :key="s.id"
              @click="reanudarVenta(idx)"
              class="text-xs bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded font-medium flex items-center gap-1 shadow-sm"
            >
              <PlayCircle class="w-3.5 h-3.5" /> {{ s.ticket }} (BOB {{ s.total.toFixed(2) }})
            </button>
          </div>
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
              <span>Subtotal neto:</span>
              <span>BOB {{ subtotalNeto.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between">
              <span>IVA (13% incluido):</span>
              <span>BOB {{ montoIva.toFixed(2) }}</span>
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

    <!-- Modal de Cobro y Factura Rápida (RF-10) -->
    <div v-if="isPayModalOpen" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div v-if="!isReceiptReady" class="space-y-4">
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">Procesar Cobro en Caja</h3>
          <p v-if="cobroError" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{{ cobroError }}</p>
          
          <!-- Método de Pago -->
          <div class="grid grid-cols-3 gap-3">
            <button
              @click="payMethod = 'efectivo'"
              :class="['p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold', payMethod === 'efectivo' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200']"
            >
              <Banknote class="w-5 h-5" /> Efectivo
            </button>
            <button
              @click="payMethod = 'tarjeta'"
              :class="['p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold', payMethod === 'tarjeta' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200']"
            >
              <CreditCard class="w-5 h-5" /> Tarjeta POS
            </button>
            <button
              @click="payMethod = 'qr'"
              :class="['p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold', payMethod === 'qr' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200']"
            >
              <QrCode class="w-5 h-5" /> QR Simple
            </button>
          </div>

          <!-- Monto Recibido y Cambio -->
          <div v-if="payMethod === 'efectivo'" class="space-y-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold">Monto Recibido (BOB):</label>
              <input
                v-model.number="cashGiven"
                type="number"
                class="w-32 text-right font-bold text-base p-1.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div class="flex justify-between items-center text-sm font-bold text-emerald-600">
              <span>Cambio a Entregar:</span>
              <span class="text-lg">BOB {{ changeDue.toFixed(2) }}</span>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button @click="isPayModalOpen = false" class="px-4 py-2 text-sm text-slate-500 font-medium">Cancelar</button>
            <button @click="finalizarCobro" :disabled="isProcessingPayment || !cajaAbierta" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg">
              {{ isProcessingPayment ? 'Timbrando factura...' : 'Confirmar y emitir factura' }}
            </button>
          </div>
        </div>

        <div v-else-if="ticketEmitido" class="space-y-4">
          <div class="text-center">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle class="h-6 w-6" />
            </div>
            <h3 class="mt-2 text-lg font-bold text-slate-900 dark:text-white">Factura emitida y timbrada</h3>
          </div>
          <article id="pos-ticket-print" class="mx-auto max-h-[55vh] w-full max-w-[72mm] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 font-mono text-[10px] text-black shadow-sm">
            <header class="text-center">
              <h4 class="text-sm font-black">MAXICONECTA</h4>
              <p>{{ sucursalNombre }}</p>
              <p>FACTURA ELECTRÓNICA</p>
              <p>No. {{ ticketEmitido.numero_factura }}</p>
            </header>
            <div class="my-2 border-t border-dashed border-black"></div>
            <p>Orden: {{ ticketEmitido.codigo_orden }}</p>
            <p>Fecha: {{ new Date().toLocaleString('es-BO') }}</p>
            <p>NIT/CI: 0</p>
            <p>Cliente: CONSUMIDOR FINAL</p>
            <div class="my-2 border-t border-dashed border-black"></div>
            <div v-for="item in ticketEmitido.items" :key="item.sku" class="mb-2">
              <p class="break-words font-bold">{{ item.nombre }}</p>
              <div class="flex justify-between gap-2">
                <span>{{ item.cantidad }} x {{ item.precio_unitario.toFixed(2) }}</span>
                <span>{{ item.total_linea.toFixed(2) }}</span>
              </div>
              <p class="text-[9px]">SKU: {{ item.sku }}</p>
            </div>
            <div class="my-2 border-t border-dashed border-black"></div>
            <div class="flex justify-between"><span>Subtotal neto</span><span>BOB {{ ticketEmitido.subtotal_neto.toFixed(2) }}</span></div>
            <div class="flex justify-between"><span>IVA 13% incluido</span><span>BOB {{ ticketEmitido.monto_iva.toFixed(2) }}</span></div>
            <div class="mt-1 flex justify-between text-xs font-black"><span>TOTAL</span><span>BOB {{ ticketEmitido.total.toFixed(2) }}</span></div>
            <p class="mt-1">Pago: {{ ticketEmitido.metodo_pago.toUpperCase() }}</p>
            <div class="my-2 border-t border-dashed border-black"></div>
            <p class="break-all text-[8px]">CUF: {{ ticketEmitido.cuf }}</p>
            <div class="mt-3 flex flex-col items-center text-center">
              <img :src="ticketEmitido.qr_code" alt="QR tributario de verificación" class="h-36 w-36" />
              <p class="mt-1 text-[8px]">Escanea para verificar en el SIN</p>
            </div>
          </article>
          <div class="flex flex-wrap justify-center gap-2">
            <button @click="imprimirTicket" class="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700">
              <Printer class="h-4 w-4" /> Imprimir ticket 80 mm
            </button>
            <button @click="resetPos" class="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
              Nueva venta
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  @page {
    size: 80mm auto;
    margin: 4mm;
  }

  body * {
    visibility: hidden !important;
  }

  #pos-ticket-print,
  #pos-ticket-print * {
    visibility: visible !important;
  }

  #pos-ticket-print {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    display: block !important;
    width: 72mm !important;
    max-width: 72mm !important;
    max-height: none !important;
    overflow: visible !important;
    border: 0 !important;
    padding: 0 !important;
    background: white !important;
    box-shadow: none !important;
    color: black !important;
  }
}
</style>
