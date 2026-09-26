<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/api/client';
import AuthModal from '@/components/auth/AuthModal.vue';
import FiscalBillingForm from '@/components/FiscalBillingForm.vue';
import type { DatosFiscales, FacturaEmitida } from '@/types';
import { 
  ShoppingBag, 
  Store, 
  LayoutDashboard, 
  X, 
  Trash2, 
  Check, 
  UserCircle, 
  ChevronRight,
  ShieldAlert,
  LogIn,
  Sparkles,
  LogOut,
  User,
  ChevronDown,
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  Printer,
  FileText,
  ShieldCheck,
  ArrowLeft
} from 'lucide-vue-next';

const route = useRoute();
const cartStore = useCartStore();
const authStore = useAuthStore();
const isUserMenuOpen = ref(false);

const cuponInput = ref('');
const cuponMsg = ref('');

function canjearCupon() {
  if (!cuponInput.value) return;
  const ok = cartStore.aplicarCupon(cuponInput.value);
  if (ok) {
    cuponMsg.value = '¡Cupón MAXI10 aplicado (10% de descuento)!';
  } else {
    cuponMsg.value = 'Cupón inválido. Prueba con MAXI10';
  }
}

function handleLogout() {
  authStore.logout();
  isUserMenuOpen.value = false;
}

// ============================================================================
// CHECKOUT WEB CON DATOS FISCALES (KAN-346 / KAN-364 / KAN-367)
// ============================================================================
const isCheckoutModalOpen = ref(false);
const checkoutStep = ref<'datos_y_pago' | 'factura_emitida'>('datos_y_pago');
const webPayMethod = ref<'tarjeta' | 'qr' | 'transferencia'>('tarjeta');
const isProcessingCheckout = ref(false);
const checkoutError = ref('');
const webFacturaEmitida = ref<FacturaEmitida | null>(null);

const webFiscalData = ref<DatosFiscales>({
  modalidad: 'con_factura',
  tipo_documento: 'NIT',
  nit_ci: authStore.user?.nit_ci || '1020304050',
  razon_social: authStore.user?.razon_social || 'EMPRESA MINERA SAN CRISTÓBAL S.A.',
  email_facturacion: authStore.user?.email || 'contabilidad@sancristobal.bo',
  guardar_perfil: true
});
const isWebFiscalValid = ref(true);

function openCheckoutModal() {
  if (cartStore.items.length === 0) return;
  cartStore.isDrawerOpen = false;
  checkoutStep.value = 'datos_y_pago';
  checkoutError.value = '';
  isCheckoutModalOpen.value = true;
}

async function procesarPagoWeb() {
  if (!isWebFiscalValid.value && webFiscalData.value.modalidad === 'con_factura') {
    checkoutError.value = 'Por favor ingresa un NIT/CI y Razón Social válidos antes de continuar.';
    return;
  }

  isProcessingCheckout.value = true;
  checkoutError.value = '';

  try {
    const res = await apiClient.post('/v1/facturacion/emitir', {
      modalidad: webFiscalData.value.modalidad,
      tipo_documento: webFiscalData.value.tipo_documento,
      nit_ci: webFiscalData.value.nit_ci,
      razon_social: webFiscalData.value.razon_social,
      email_facturacion: webFiscalData.value.email_facturacion,
      guardar_perfil: webFiscalData.value.guardar_perfil,
      sucursal: 'Plataforma Online - Marketplace Central',
      punto_venta: 1,
      metodo_pago: webPayMethod.value,
      items: cartStore.items,
      descuento: cartStore.descuento
    });

    webFacturaEmitida.value = res.data.factura;
    checkoutStep.value = 'factura_emitida';
    // Vaciar carrito tras emisión exitosa
    cartStore.items = [];
    cartStore.cupon = null;
    cartStore.descuento = 0;
  } catch (err: any) {
    checkoutError.value = err.response?.data?.error || 'Error al emitir factura electrónica con el microservicio.';
  } finally {
    isProcessingCheckout.value = false;
  }
}

function cerrarCheckoutModal() {
  isCheckoutModalOpen.value = false;
  checkoutStep.value = 'datos_y_pago';
  webFacturaEmitida.value = null;
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <!-- Navbar Superior Profesional -->
    <header class="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <!-- Logo y Marca -->
        <div class="flex items-center gap-6">
          <router-link to="/" class="flex items-center gap-2 group">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-extrabold shadow-md group-hover:scale-105 transition-transform">
              M
            </div>
            <div>
              <span class="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                MaxiConecta
              </span>
              <span class="block text-[10px] text-slate-400 font-medium -mt-1">Marketplace y Ventas (Grupo E)</span>
            </div>
          </router-link>

          <!-- Selector de Portales (Marketplace / POS / Admin) -->
          <nav class="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <router-link
              to="/marketplace"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                route.path.startsWith('/marketplace')
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              ]"
            >
              <ShoppingBag class="w-3.5 h-3.5" /> Marketplace
            </router-link>

            <router-link
              to="/pos"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                route.path.startsWith('/pos')
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              ]"
            >
              <Store class="w-3.5 h-3.5" /> Punto de Venta (POS)
            </router-link>

            <router-link
              to="/admin"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                route.path.startsWith('/admin')
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              ]"
            >
              <LayoutDashboard class="w-3.5 h-3.5" /> Panel Admin
            </router-link>
          </nav>
        </div>

        <!-- Acciones Derecha (Identidad/Login & Carrito) -->
        <div class="flex items-center gap-3">
          <!-- Estado No Autenticado (Invitado) -->
          <div v-if="!authStore.isAuthenticated" class="flex items-center gap-2">
            <button
              @click="authStore.openAuthModal('login')"
              class="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <LogIn class="w-3.5 h-3.5" /> Iniciar Sesión
            </button>
            <button
              @click="authStore.openAuthModal('register')"
              class="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md transition-all"
            >
              <Sparkles class="w-3.5 h-3.5" /> Registrarse (+50 pts)
            </button>
          </div>

          <!-- Estado Autenticado -->
          <div v-else class="flex items-center gap-2">
            <!-- Badge de Puntos para Cliente -->
            <router-link
              to="/mi-cuenta"
              v-if="authStore.userRole === 'cliente'"
              class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors"
              title="Ver mis puntos acumulados"
            >
              <Sparkles class="w-3.5 h-3.5 text-amber-500" />
              <span>{{ authStore.pointsBalance }} pts</span>
            </router-link>

            <!-- Botón / Menú de Usuario -->
            <div class="relative">
              <button
                @click="isUserMenuOpen = !isUserMenuOpen"
                class="flex items-center gap-2 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-200/60 dark:border-slate-700"
              >
                <div class="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                  {{ authStore.user?.nombre_completo.charAt(0).toUpperCase() || 'U' }}
                </div>
                <span class="max-w-[110px] truncate hidden sm:inline">{{ authStore.user?.nombre_completo.split(' ')[0] }}</span>
                <span 
                  :class="[
                    'text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded',
                    authStore.userRole === 'administrador' 
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                      : authStore.userRole === 'cajero'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  ]"
                >
                  {{ authStore.userRole }}
                </span>
                <ChevronDown class="w-3.5 h-3.5 text-slate-400" />
              </button>

              <!-- Dropdown Flotante -->
              <div
                v-if="isUserMenuOpen"
                class="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in"
              >
                <div class="p-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p class="font-bold text-slate-900 dark:text-white truncate">{{ authStore.user?.nombre_completo }}</p>
                  <p class="text-[10px] text-slate-400 truncate">{{ authStore.user?.email }}</p>
                </div>

                <router-link
                  to="/mi-cuenta"
                  @click="isUserMenuOpen = false"
                  class="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  <User class="w-3.5 h-3.5 text-blue-500" /> Mi Cuenta y Compras
                </router-link>

                <router-link
                  v-if="authStore.hasRole(['cajero', 'administrador'])"
                  to="/pos"
                  @click="isUserMenuOpen = false"
                  class="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  <Store class="w-3.5 h-3.5 text-emerald-500" /> Terminal POS
                </router-link>

                <router-link
                  v-if="authStore.hasRole(['administrador', 'gerente_comercial'])"
                  to="/admin"
                  @click="isUserMenuOpen = false"
                  class="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  <LayoutDashboard class="w-3.5 h-3.5 text-indigo-500" /> Panel Administrador
                </router-link>

                <div class="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                <button
                  @click="handleLogout"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-semibold"
                >
                  <LogOut class="w-3.5 h-3.5" /> Cerrar Sesión
                </button>
              </div>
            </div>
          </div>

          <!-- Botón Carrito Flotante (RF-13) -->
          <button
            @click="cartStore.toggleDrawer"
            class="relative p-2.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-xl"
            title="Abrir Carrito"
          >
            <ShoppingBag class="w-5 h-5" />
            <span
              v-if="cartStore.itemCount > 0"
              class="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-bounce"
            >
              {{ cartStore.itemCount }}
            </span>
          </button>
        </div>
      </div>
    </header>

    <!-- Contenedor de Vistas -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <router-view />
    </main>

    <!-- Drawer Deslizante de Carrito Persistente (RF-13, RF-14) -->
    <div
      v-if="cartStore.isDrawerOpen"
      class="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity"
    >
      <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div class="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
          <!-- Drawer Header -->
          <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <ShoppingBag class="w-5 h-5 text-blue-600" />
              <h2 class="text-base font-bold">Carrito de Compras (Redis)</h2>
            </div>
            <button @click="cartStore.toggleDrawer" class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X class="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <!-- Drawer Body: Lista de Ítems -->
          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div
              v-for="item in cartStore.items"
              :key="item.variante_id"
              class="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
            >
              <div class="flex-1">
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">{{ item.nombre }}</h4>
                <span class="text-[11px] font-mono text-slate-400">BOB {{ item.precio_unitario.toFixed(2) }} c/u</span>
                
                <div class="flex items-center gap-2 mt-2">
                  <button @click="cartStore.updateQuantity(item.variante_id, -1)" class="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-xs font-bold">-</button>
                  <span class="text-xs font-bold px-1">{{ item.cantidad }}</span>
                  <button @click="cartStore.updateQuantity(item.variante_id, 1)" class="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 text-xs font-bold">+</button>
                </div>
              </div>

              <div class="flex flex-col justify-between items-end">
                <button @click="cartStore.removeItem(item.variante_id)" class="text-rose-500 hover:text-rose-700 p-1">
                  <Trash2 class="w-4 h-4" />
                </button>
                <span class="text-sm font-bold text-blue-600">BOB {{ item.total_linea.toFixed(2) }}</span>
              </div>
            </div>

            <div v-if="cartStore.items.length === 0" class="py-12 text-center text-slate-400 space-y-2">
              <ShoppingBag class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p class="text-sm">Tu carrito está vacío.</p>
            </div>
          </div>

          <!-- Drawer Footer: Cupones y Checkout -->
          <div class="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 space-y-3">
            <!-- Input Cupón (RF-17) -->
            <div class="flex gap-2">
              <input
                v-model="cuponInput"
                type="text"
                placeholder="Código Cupón (ej. MAXI10)"
                class="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg uppercase"
              />
              <button @click="canjearCupon" class="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold rounded-lg">
                Aplicar
              </button>
            </div>
            <p v-if="cuponMsg" class="text-[11px] text-emerald-600 font-semibold">{{ cuponMsg }}</p>

            <div class="space-y-1 text-xs text-slate-500 pt-1">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>BOB {{ cartStore.subtotal.toFixed(2) }}</span>
              </div>
              <div v-if="cartStore.descuento > 0" class="flex justify-between text-emerald-600 font-semibold">
                <span>Descuento cupón:</span>
                <span>- BOB {{ cartStore.descuento.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200">
                <span>Total:</span>
                <span>BOB {{ cartStore.total.toFixed(2) }}</span>
              </div>
            </div>

            <button
              @click="openCheckoutModal"
              :disabled="cartStore.items.length === 0"
              class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <FileText class="w-4 h-4" />
              <span>Continuar al Pago y Facturación</span>
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL DE CHECKOUT WEB CON FACTURACIÓN ELECTRÓNICA (KAN-346, KAN-364) -->
    <!-- =================================================================== -->
    <div
      v-if="isCheckoutModalOpen"
      class="fixed inset-0 z-50 overflow-y-auto bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div class="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 space-y-6">
        <!-- Paso 1: Ingreso de Datos Fiscales y Selección de Pago -->
        <div v-if="checkoutStep === 'datos_y_pago'" class="space-y-5">
          <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText class="w-5 h-5 text-blue-600" />
                <span>Checkout y Emisión de Factura Legal</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Captura de NIT/CI y Razón Social antes de procesar el pago (KAN-346)</p>
            </div>
            <button @click="cerrarCheckoutModal" class="p-1 rounded-lg text-slate-400 hover:text-slate-700">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Resumen de Pedido -->
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div>
              <span class="text-xs font-semibold text-slate-500">Monto Total de Compra:</span>
              <p class="text-xs text-slate-400">{{ cartStore.items.length }} producto(s) en orden</p>
            </div>
            <div class="text-right">
              <span class="text-xl font-black text-blue-600 dark:text-blue-400">BOB {{ cartStore.total.toFixed(2) }}</span>
              <span v-if="cartStore.descuento > 0" class="block text-[10px] text-emerald-600 font-bold">Cupón aplicado: -BOB {{ cartStore.descuento.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Componente Formulario Fiscal (KAN-364) -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
            <FiscalBillingForm
              v-model="webFiscalData"
              context="web"
              @validation-change="isWebFiscalValid = $event"
            />
          </div>

          <!-- Selector de Método de Pago Online -->
          <div class="space-y-2">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Selecciona tu método de pago:</label>
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                @click="webPayMethod = 'tarjeta'"
                :class="[
                  'p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all',
                  webPayMethod === 'tarjeta'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                ]"
              >
                <CreditCard class="w-5 h-5" /> Tarjeta de Débito / Crédito
              </button>
              <button
                type="button"
                @click="webPayMethod = 'qr'"
                :class="[
                  'p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all',
                  webPayMethod === 'qr'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                ]"
              >
                <QrCode class="w-5 h-5" /> Pago QR Simple
              </button>
              <button
                type="button"
                @click="webPayMethod = 'transferencia'"
                :class="[
                  'p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all',
                  webPayMethod === 'transferencia'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                ]"
              >
                <Building class="w-5 h-5" /> Transferencia Bancaria
              </button>
            </div>
          </div>

          <p v-if="checkoutError" class="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200">
            {{ checkoutError }}
          </p>

          <div class="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              @click="cerrarCheckoutModal"
              class="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Volver al carrito
            </button>
            <button
              type="button"
              @click="procesarPagoWeb"
              :disabled="isProcessingCheckout"
              class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ isProcessingCheckout ? 'Procesando y Timbrando...' : 'Confirmar Pago y Emitir Factura' }}</span>
            </button>
          </div>
        </div>

        <!-- Paso 2: Factura Electrónica Emitida con Éxito (KAN-367) -->
        <div v-else class="space-y-5 text-center">
          <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 class="w-8 h-8" />
          </div>
          <div>
            <h3 class="text-xl font-black text-slate-900 dark:text-white">¡Compra y Factura Electrónica Procesadas!</h3>
            <p class="text-xs text-slate-500 mt-1">La factura legal con timbrado digital CUF ha sido emitida exitosamente.</p>
          </div>

          <!-- Documento Tributario Digital -->
          <div class="p-5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-left font-mono text-xs space-y-3 shadow-sm">
            <div class="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-3">
              <h4 class="font-extrabold text-sm">MAXICONECTA BOLIVIA S.R.L.</h4>
              <p class="text-[10px] text-slate-500">Casa Matriz: Av. 16 de Julio N° 1440 · La Paz, Bolivia</p>
              <p class="text-[10px] text-slate-500">NIT Emisor: 1028374029</p>
              <span class="inline-block px-2.5 py-0.5 mt-1.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                FACTURA ELECTRÓNICA EN LÍNEA N° {{ webFacturaEmitida?.numero_factura }}
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] border-b border-dashed border-slate-300 dark:border-slate-700 pb-3">
              <div>
                <span class="text-slate-400 block text-[10px]">FECHA Y HORA:</span>
                <span class="font-bold">{{ new Date(webFacturaEmitida?.fecha_emision || Date.now()).toLocaleString('es-BO') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[10px]">NIT / CI / CEX:</span>
                <span class="font-bold font-mono">{{ webFacturaEmitida?.datos_comprador.nit_ci }}</span>
              </div>
              <div class="sm:col-span-2">
                <span class="text-slate-400 block text-[10px]">RAZÓN SOCIAL:</span>
                <span class="font-bold text-slate-900 dark:text-white uppercase">{{ webFacturaEmitida?.datos_comprador.razon_social }}</span>
              </div>
              <div v-if="webFacturaEmitida?.datos_comprador.email_facturacion" class="sm:col-span-2">
                <span class="text-slate-400 block text-[10px]">CORREO DE ENVÍO FACTURA:</span>
                <span>{{ webFacturaEmitida.datos_comprador.email_facturacion }}</span>
              </div>
            </div>

            <div class="space-y-1 text-right text-xs">
              <div class="flex justify-between font-bold text-sm">
                <span>TOTAL PAGADO:</span>
                <span class="text-emerald-600 font-black">BOB {{ webFacturaEmitida?.total.toFixed(2) }}</span>
              </div>
              <div class="text-[10px] text-slate-400 flex justify-between">
                <span>Método de Pago:</span>
                <span class="uppercase font-bold">{{ webFacturaEmitida?.metodo_pago }}</span>
              </div>
            </div>

            <!-- CUF y QR Fiscal -->
            <div class="pt-2 text-center space-y-2 border-t border-dashed border-slate-300 dark:border-slate-700">
              <div class="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] break-all font-mono">
                <span class="font-bold text-slate-500 block">CÓDIGO ÚNICO DE FACTURACIÓN (CUF):</span>
                <span class="text-blue-600 dark:text-blue-400 font-bold">{{ webFacturaEmitida?.cuf }}</span>
              </div>

              <div class="flex justify-center py-1">
                <div class="p-2 bg-white rounded-lg border border-slate-300 shadow-sm inline-block">
                  <QrCode class="w-16 h-16 text-slate-900" />
                </div>
              </div>

              <p class="text-[9px] text-slate-400">
                "ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY"
              </p>
            </div>
          </div>

          <div class="flex justify-center gap-3 pt-2">
            <button
              @click="cerrarCheckoutModal"
              class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg"
            >
              Aceptar y Seguir Explorando
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Institucional UCB -->
    <footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500">
      <div class="max-w-7xl mx-auto px-4 space-y-1">
        <p class="font-semibold text-slate-700 dark:text-slate-300">
          MaxiConecta — Marketplace y Ventas | Grupo E
        </p>
        <p>
          Taller de Sistemas de Información · Universidad Católica Boliviana "San Pablo" · La Paz, Bolivia
        </p>
      </div>
    </footer>

    <!-- Modal de Autenticación Unificado (Login / Registro / Cuentas Demo) -->
    <AuthModal />
  </div>
</template>
