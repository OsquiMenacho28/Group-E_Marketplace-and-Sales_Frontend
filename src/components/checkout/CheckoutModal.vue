<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import { useAuthStore } from '@/stores/auth';
import type { CheckoutModalidad, CheckoutMetodoPago } from '@/types';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  X,
  Truck,
  Store,
  CreditCard,
  QrCode,
  Lock,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  MapPin,
  Loader2,
  PackageCheck
} from 'lucide-vue-next';

const router = useRouter();
const cartStore = useCartStore();
const authStore = useAuthStore();

// Estados del formulario de Checkout
const step = ref<'formulario' | 'exito'>('formulario');
const tipoDespacho = ref<CheckoutModalidad>('domicilio');
const metodoPago = ref<CheckoutMetodoPago>('qr');
const direccionEntrega = ref('Av. 6 de Agosto #2450, Sopocachi, La Paz');
const sucursalSeleccionada = ref('suc-01');
const notasEntrega = ref('');

// Datos simulados de tarjeta
const numeroTarjeta = ref('4532 •••• •••• 8892');
const nombreTitular = ref('CÉSAR LÓPEZ');
const fechaVencimiento = ref('08/28');
const cvv = ref('782');

// Copiar QR / Enlace
const isCopied = ref(false);

const sucursales = [
  { id: 'suc-01', nombre: 'Sucursal Sopocachi', direccion: 'Av. 20 de Octubre #1820', tiempo: 'Retiro en 2 horas' },
  { id: 'suc-02', nombre: 'Sucursal Megacenter Calacoto', direccion: 'Av. Rafael Pabón, Local 24', tiempo: 'Retiro en 1 hora' },
  { id: 'suc-03', nombre: 'Sucursal Central Mariscal', direccion: 'Av. Mariscal Santa Cruz #1100', tiempo: 'Retiro en 2 horas' }
];

const costoEnvio = computed(() => {
  return tipoDespacho.value === 'domicilio' ? 15.00 : 0.00;
});

const totalFinal = computed(() => {
  return cartStore.total + costoEnvio.value;
});

// Estilos dinámicos para el banner del temporizador
const bannerStyles = computed(() => {
  if (cartStore.isUrgentTimer) {
    return {
      wrapper: 'bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-200',
      badge: 'bg-rose-600 text-white animate-pulse',
      progressBar: 'bg-rose-500',
      timerText: 'text-rose-600 dark:text-rose-400 font-extrabold animate-pulse'
    };
  }
  if (cartStore.isWarningTimer) {
    return {
      wrapper: 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200',
      badge: 'bg-amber-500 text-slate-900 font-bold',
      progressBar: 'bg-amber-500',
      timerText: 'text-amber-600 dark:text-amber-400 font-bold'
    };
  }
  return {
    wrapper: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
    badge: 'bg-emerald-600 text-white font-semibold',
    progressBar: 'bg-gradient-to-r from-emerald-500 to-blue-500',
    timerText: 'text-emerald-700 dark:text-emerald-300 font-bold'
  };
});

function copiarCodigoPago() {
  navigator.clipboard.writeText(`MAXI-QR-${cartStore.reservaId}-${totalFinal.value}`);
  isCopied.value = true;
  setTimeout(() => {
    isCopied.value = false;
  }, 2000);
}

async function handleConfirmarOrden() {
  if (cartStore.reservaStatus === 'expirada') return;

  const clienteId = authStore.user?.id || 'cliente-anonimo';
  
  await cartStore.finalizarOrdenConReserva(
    {
      tipo_despacho: tipoDespacho.value,
      metodo_pago: metodoPago.value,
      sucursal_id: tipoDespacho.value === 'retiro_sucursal' ? sucursalSeleccionada.value : undefined,
      direccion_entrega: tipoDespacho.value === 'domicilio' ? direccionEntrega.value : undefined,
      costo_envio: costoEnvio.value,
      notas: notasEntrega.value
    },
    clienteId
  );

  step.value = 'exito';
}

function handleCerrar() {
  if (step.value === 'exito') {
    cartStore.cancelarReserva();
    step.value = 'formulario';
    router.push('/mi-cuenta');
  } else {
    // Si aún tiene reserva activa, cancelarla y liberar stock
    if (confirm('¿Deseas salir del checkout? Se cancelará tu reserva y el stock volverá al inventario general.')) {
      cartStore.cancelarReserva();
    }
  }
}

function handleRenovarReserva() {
  const clienteId = authStore.user?.id || 'cliente-anonimo';
  cartStore.renovarReserva(clienteId);
}
</script>

<template>
  <!-- Modal Backdrop -->
  <div
    v-if="cartStore.isCheckoutModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-fade-in"
  >
    <div
      class="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
    >
      <!-- Cabecera del Modal -->
      <header class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Lock class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Checkout Seguro · MaxiConecta
              </h2>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                RF-14 · RIO-INV-02
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Reserva temporal y bloqueo concurrente de inventario
            </p>
          </div>
        </div>

        <button
          @click="handleCerrar"
          class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Cerrar y cancelar reserva"
        >
          <X class="w-5 h-5" />
        </button>
      </header>

      <!-- BANNER DE RESERVA TEMPORAL DE STOCK CON CONTADOR EN TIEMPO REAL -->
      <section
        v-if="step === 'formulario'"
        :class="['px-6 py-3.5 border-b transition-colors duration-300 flex flex-col gap-2', bannerStyles.wrapper]"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Información y estado -->
          <div class="flex items-center gap-2.5">
            <span :class="['px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-sm', bannerStyles.badge]">
              <Clock class="w-3.5 h-3.5" />
              <span v-if="cartStore.isUrgentTimer">¡Últimos Minutos!</span>
              <span v-else-if="cartStore.isWarningTimer">Por Vencer</span>
              <span v-else>Stock Bloqueado</span>
            </span>
            <div class="text-xs">
              <span class="font-semibold">Reserva activa:</span>
              <span class="ml-1 font-mono font-bold tracking-wider opacity-90">{{ cartStore.reservaId }}</span>
            </div>
          </div>

          <!-- Reloj Digital con Cuenta Regresiva -->
          <div class="flex items-center gap-2">
            <span class="text-xs opacity-80 hidden sm:inline">Tiempo para completar:</span>
            <div class="flex items-baseline gap-1 bg-white/60 dark:bg-slate-800/80 px-3 py-1 rounded-xl border border-black/5 dark:border-white/5 shadow-inner">
              <Clock class="w-4 h-4 opacity-70" />
              <span :class="['text-xl font-mono tracking-wider', bannerStyles.timerText]">
                {{ cartStore.formattedTimeLeft }}
              </span>
            </div>
          </div>
        </div>

        <!-- Barra de Progreso Decreciente -->
        <div class="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
          <div
            :class="['h-full transition-all duration-1000 ease-linear rounded-full', bannerStyles.progressBar]"
            :style="{ width: `${cartStore.timerProgressPercent}%` }"
          ></div>
        </div>

        <p class="text-[11px] opacity-75 flex items-center gap-1.5">
          <ShieldCheck class="w-3.5 h-3.5 shrink-0" />
          Las existencias han sido bloqueadas temporalmente en el ERP de Inventarios para evitar sobreventas concurrentes mientras completas el pago.
        </p>
      </section>

      <!-- CUERPO PRINCIPAL DEL CHECKOUT -->
      <div class="p-6 overflow-y-auto flex-1 space-y-6 relative">
        <!-- VISTA DE ÉXITO -->
        <div v-if="step === 'exito'" class="py-8 px-4 text-center space-y-5">
          <div class="w-20 h-20 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg border border-emerald-200 dark:border-emerald-800 animate-bounce">
            <CheckCircle2 class="w-10 h-10" />
          </div>

          <div class="space-y-2 max-w-md mx-auto">
            <h3 class="text-2xl font-black text-slate-900 dark:text-white">
              ¡Compra Confirmada con Éxito!
            </h3>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Tu orden ha sido registrada. El stock reservado temporalmente ha pasado a descuento definitivo en Inventarios (RIO-INV-03).
            </p>
          </div>

          <!-- Tarjeta de Resumen de Orden -->
          <div class="max-w-md mx-auto p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-left space-y-3">
            <div class="flex justify-between items-center text-xs pb-3 border-b border-slate-200 dark:border-slate-700">
              <span class="text-slate-500">Código de Orden:</span>
              <span class="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                {{ cartStore.lastCreatedOrderCode }}
              </span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Modalidad:</span>
              <span class="font-medium capitalize">{{ tipoDespacho === 'domicilio' ? 'Envío a Domicilio' : 'Retiro en Sucursal' }}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Método de Pago:</span>
              <span class="font-medium uppercase">{{ metodoPago }}</span>
            </div>
            <div class="flex justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
              <span class="font-bold text-slate-900 dark:text-white">Total Pagado:</span>
              <span class="font-extrabold text-slate-900 dark:text-white text-sm">BOB {{ totalFinal.toFixed(2) }}</span>
            </div>
          </div>

          <div class="pt-4 flex flex-col sm:flex-row justify-center gap-3">
            <button
              @click="handleCerrar"
              class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all"
            >
              Ver mi pedido en Mi Cuenta
            </button>
          </div>
        </div>

        <!-- VISTA DE FORMULARIO DE CHECKOUT -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Columna Izquierda: Pasos de Entrega y Pago (7 cols) -->
          <div class="lg:col-span-7 space-y-6">
            <!-- PASO 1: Modalidad de Entrega (RF-15) -->
            <div class="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                  Modalidad de Entrega (RF-15)
                </h3>
              </div>

              <!-- Selector Radio Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  :class="[
                    'p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between gap-2 transition-all',
                    tipoDespacho === 'domicilio'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                  ]"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Truck class="w-4 h-4 text-blue-600" />
                      <span class="font-bold text-xs">Envío a Domicilio</span>
                    </div>
                    <input type="radio" v-model="tipoDespacho" value="domicilio" class="text-blue-600" />
                  </div>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">Entrega en 24-48 horas (+ BOB 15.00)</span>
                </label>

                <label
                  :class="[
                    'p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between gap-2 transition-all',
                    tipoDespacho === 'retiro_sucursal'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                  ]"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Store class="w-4 h-4 text-emerald-600" />
                      <span class="font-bold text-xs">Retiro en Sucursal</span>
                    </div>
                    <input type="radio" v-model="tipoDespacho" value="retiro_sucursal" class="text-blue-600" />
                  </div>
                  <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">¡Gratis! Sin costo de flete</span>
                </label>
              </div>

              <!-- Campos dinámicos según modalidad -->
              <div v-if="tipoDespacho === 'domicilio'" class="space-y-3 pt-2">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Dirección de entrega completa:
                  </label>
                  <div class="relative">
                    <MapPin class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      v-model="direccionEntrega"
                      type="text"
                      placeholder="Calle, número, zona o edificio"
                      class="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div v-else class="space-y-2 pt-2">
                <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Selecciona la tienda para recoger:
                </label>
                <div class="space-y-2">
                  <label
                    v-for="suc in sucursales"
                    :key="suc.id"
                    :class="[
                      'p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer',
                      sucursalSeleccionada === suc.id
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    ]"
                  >
                    <div>
                      <p class="font-bold text-slate-900 dark:text-white">{{ suc.nombre }}</p>
                      <p class="text-[10px] text-slate-500">{{ suc.direccion }} · <span class="text-emerald-600 font-semibold">{{ suc.tiempo }}</span></p>
                    </div>
                    <input type="radio" v-model="sucursalSeleccionada" :value="suc.id" class="text-emerald-600" />
                  </label>
                </div>
              </div>
            </div>

            <!-- PASO 2: Método de Pago (RF-16) -->
            <div class="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                  Método de Pago (RF-16)
                </h3>
              </div>

              <!-- Opciones de pago -->
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  @click="metodoPago = 'qr'"
                  :class="[
                    'p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold',
                    metodoPago === 'qr'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  ]"
                >
                  <QrCode class="w-5 h-5 text-blue-600" />
                  <span>QR Simple</span>
                </button>

                <button
                  type="button"
                  @click="metodoPago = 'tarjeta'"
                  :class="[
                    'p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold',
                    metodoPago === 'tarjeta'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  ]"
                >
                  <CreditCard class="w-5 h-5 text-indigo-600" />
                  <span>Tarjeta</span>
                </button>

                <button
                  type="button"
                  @click="metodoPago = 'pasarela'"
                  :class="[
                    'p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold',
                    metodoPago === 'pasarela'
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  ]"
                >
                  <Sparkles class="w-5 h-5 text-amber-600" />
                  <span>Pasarela</span>
                </button>
              </div>

              <!-- Vista previa de QR Dinámico -->
              <div v-if="metodoPago === 'qr'" class="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4">
                <div class="w-28 h-28 bg-slate-100 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center p-2 shrink-0">
                  <div class="w-full h-full border-4 border-slate-800 dark:border-white p-1 flex flex-col justify-between">
                    <div class="flex justify-between">
                      <div class="w-4 h-4 bg-slate-800 dark:bg-white"></div>
                      <div class="w-4 h-4 bg-slate-800 dark:bg-white"></div>
                    </div>
                    <div class="text-center font-extrabold text-[9px] text-blue-600">MAXI-QR</div>
                    <div class="flex justify-between">
                      <div class="w-4 h-4 bg-slate-800 dark:bg-white"></div>
                      <div class="w-2 h-2 bg-slate-800 dark:bg-white"></div>
                    </div>
                  </div>
                </div>

                <div class="space-y-1.5 text-center sm:text-left text-xs">
                  <p class="font-bold text-slate-900 dark:text-white">Escanea con tu App Bancaria (BCP, BNB, Banco Unión)</p>
                  <p class="text-[11px] text-slate-500">Monto total a transferir: <strong class="text-blue-600">BOB {{ totalFinal.toFixed(2) }}</strong></p>
                  <button
                    @click="copiarCodigoPago"
                    type="button"
                    class="mt-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5"
                  >
                    <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-600" />
                    <Copy v-else class="w-3.5 h-3.5" />
                    <span>{{ isCopied ? '¡Código Copiado!' : 'Copiar glosa de transferencia' }}</span>
                  </button>
                </div>
              </div>

              <!-- Vista previa de Tarjeta de Crédito / Débito -->
              <div v-else-if="metodoPago === 'tarjeta'" class="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <label class="block text-[11px] font-medium text-slate-500 mb-1">Número de Tarjeta</label>
                  <input v-model="numeroTarjeta" type="text" class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] font-medium text-slate-500 mb-1">Vencimiento</label>
                    <input v-model="fechaVencimiento" type="text" class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900" />
                  </div>
                  <div>
                    <label class="block text-[11px] font-medium text-slate-500 mb-1">CVV</label>
                    <input v-model="cvv" type="password" class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900" />
                  </div>
                </div>
              </div>

              <div v-else class="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                Serás redirigido a la pasarela externa segura con cifrado TLS 1.3 al hacer clic en Confirmar.
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Resumen de Compra y Botón de Pago (5 cols) -->
          <div class="lg:col-span-5 space-y-5">
            <div class="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ítems con Stock Bloqueado ({{ cartStore.itemCount }})
              </h3>

              <!-- Lista de ítems en carrito -->
              <div class="max-h-56 overflow-y-auto space-y-3 pr-1">
                <div
                  v-for="item in cartStore.items"
                  :key="item.variante_id"
                  class="flex items-start justify-between gap-3 text-xs pb-2 border-b border-slate-200/60 dark:border-slate-700/60"
                >
                  <div class="space-y-0.5">
                    <p class="font-bold text-slate-900 dark:text-white line-clamp-1">{{ item.nombre }}</p>
                    <p class="text-[11px] text-slate-500">Cant: {{ item.cantidad }} × BOB {{ item.precio_unitario.toFixed(2) }}</p>
                    <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck class="w-3 h-3" /> 1 unidad reservada
                    </span>
                  </div>
                  <span class="font-bold text-slate-900 dark:text-white shrink-0">
                    BOB {{ item.total_linea.toFixed(2) }}
                  </span>
                </div>
              </div>

              <!-- Desglose de Precios -->
              <div class="space-y-1.5 pt-2 text-xs border-t border-slate-200 dark:border-slate-700">
                <div class="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal productos:</span>
                  <span>BOB {{ cartStore.subtotal.toFixed(2) }}</span>
                </div>
                <div v-if="cartStore.descuento > 0" class="flex justify-between text-emerald-600 font-semibold">
                  <span>Descuento cupón:</span>
                  <span>- BOB {{ cartStore.descuento.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Costo de envío:</span>
                  <span v-if="costoEnvio === 0" class="text-emerald-600 font-semibold">¡Gratis!</span>
                  <span v-else>+ BOB {{ costoEnvio.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-300 dark:border-slate-700">
                  <span>Total Final:</span>
                  <span class="text-blue-600 dark:text-blue-400">BOB {{ totalFinal.toFixed(2) }}</span>
                </div>
              </div>

              <!-- Botones de Acción -->
              <div class="space-y-2 pt-2">
                <button
                  @click="handleConfirmarOrden"
                  :disabled="cartStore.isProcessingOrder || cartStore.reservaStatus === 'expirada'"
                  class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Loader2 v-if="cartStore.isProcessingOrder" class="w-4 h-4 animate-spin" />
                  <span v-else class="flex items-center gap-2">
                    Confirmar Compra y Pagar <ChevronRight class="w-4 h-4" />
                  </span>
                </button>

                <button
                  type="button"
                  @click="handleCerrar"
                  class="w-full py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  Cancelar compra y liberar stock reservado
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- OVERLAY DE EXPIRACIÓN DEL TTL (900 SEGUNDOS AGOTADOS) -->
        <div
          v-if="cartStore.reservaStatus === 'expirada'"
          class="absolute inset-0 bg-slate-950/80 backdrop-blur-md rounded-2xl flex items-center justify-center p-6 z-20 animate-fade-in"
        >
          <div class="max-w-md bg-white dark:bg-slate-900 p-6 rounded-3xl border border-rose-500/40 shadow-2xl text-center space-y-4">
            <div class="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center animate-pulse">
              <AlertTriangle class="w-8 h-8" />
            </div>

            <div class="space-y-2">
              <h4 class="text-lg font-black text-slate-900 dark:text-white">
                ¡Tu Reserva de Stock ha Expirado!
              </h4>
              <p class="text-xs text-slate-600 dark:text-slate-400">
                El tiempo de 15 minutos asignado para tu compra ha concluido. Para evitar sobreventas concurrentes, las existencias han sido liberadas automáticamente en el inventario general.
              </p>
            </div>

            <div class="pt-2 flex flex-col gap-2">
              <button
                @click="handleRenovarReserva"
                class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2"
              >
                <RotateCcw class="w-4 h-4" />
                Renovar Reserva y Continuar
              </button>

              <button
                @click="handleCerrar"
                class="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Regresar a la tienda
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
