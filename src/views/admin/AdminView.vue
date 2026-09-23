<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { apiClient } from '@/api/client';
import type { Producto, Categoria } from '@/types';
import ProductMultimediaManager from '@/components/ProductMultimediaManager.vue';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Users, 
  Package, 
  FileText, 
  AlertTriangle,
  ArrowUpRight,
  Image as ImageIcon,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-vue-next';

// Pestaña activa: 'dashboard' o 'multimedia'
const activeTab = ref<'dashboard' | 'multimedia'>('multimedia');

// Estado de productos y categorías desde Supabase
const productos = ref<Producto[]>([]);
const categorias = ref<Categoria[]>([]);
const isLoadingCatalog = ref(false);
const catalogSearch = ref('');
const selectedCategoriaFilter = ref('Todas');

// Producto seleccionado para gestionar su galería
const selectedProduct = ref<Producto | null>(null);

// Modal para crear nuevo producto
const showNewProductModal = ref(false);
const isCreatingProduct = ref(false);
const newProductForm = ref({
  sku: '',
  nombre: '',
  marca: '',
  categoria_id: '',
  descripcion: '',
  estado: 'publicado'
});
const createProductError = ref<string | null>(null);

// KPIs simulados para el dashboard
const kpis = ref({
  ventasHoy: 15420.50,
  ventasMes: 348920.00,
  ordenesHoy: 34,
  ticketPromedio: 453.54,
  tasaConversion: 3.85
});

const recentOrders = ref([
  { id: 'ORD-2026-081', cliente: 'Carlos Mendoza', total: 8999.00, canal: 'Web', estado: 'Confirmada', fecha: '12/09 10:45' },
  { id: 'ORD-2026-080', cliente: 'Empresa Minera San Cristóbal (B2B)', total: 45000.00, canal: 'B2B', estado: 'En Preparación', fecha: '12/09 09:30' },
  { id: 'POS-2026-112', cliente: 'Cliente Mostrador', total: 1598.00, canal: 'POS', estado: 'Entregada', fecha: '12/09 09:12' },
  { id: 'ORD-2026-079', cliente: 'Sofía Doria Medina', total: 2450.00, canal: 'Web', estado: 'Despachada', fecha: '11/09 18:20' }
]);

const lowStockAlerts = ref([
  { sku: 'MON-LG-27GP', nombre: 'Monitor LG UltraGear 27"', stockActual: 2, puntoReorden: 5 },
  { sku: 'LAP-DELL-XPS15', nombre: 'Laptop Dell XPS 15', stockActual: 3, puntoReorden: 8 }
]);

// Cargar catálogo de Supabase
async function fetchCatalog() {
  isLoadingCatalog.value = true;
  try {
    const [pRes, cRes] = await Promise.all([
      apiClient.get('/productos'),
      apiClient.get('/categorias')
    ]);
    productos.value = pRes.data.productos || [];
    categorias.value = cRes.data.categorias || [];

    // Si había un producto seleccionado, actualizarlo con los datos frescos
    if (selectedProduct.value) {
      const refreshed = productos.value.find(p => p.id === selectedProduct.value?.id);
      if (refreshed) {
        selectedProduct.value = refreshed;
      }
    }
  } catch (err) {
    console.error('Error cargando catálogo desde Supabase:', err);
  } finally {
    isLoadingCatalog.value = false;
  }
}

onMounted(() => {
  fetchCatalog();
});

// Filtrar productos
const filteredProductos = computed(() => {
  return productos.value.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(catalogSearch.value.toLowerCase()) ||
                          p.sku.toLowerCase().includes(catalogSearch.value.toLowerCase()) ||
                          (p.marca && p.marca.toLowerCase().includes(catalogSearch.value.toLowerCase()));
    const matchesCategory = selectedCategoriaFilter.value === 'Todas' ||
                            p.categorias?.nombre === selectedCategoriaFilter.value;
    return matchesSearch && matchesCategory;
  });
});

// Abrir gestor multimedia de un producto
function openMultimediaManager(prod: Producto) {
  selectedProduct.value = prod;
  activeTab.value = 'multimedia';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Obtener la imagen principal de un producto
function getCoverUrl(prod: Producto): string | null {
  if (!prod.imagenes_producto || prod.imagenes_producto.length === 0) return null;
  const principal = prod.imagenes_producto.find(i => i.es_principal);
  return principal ? principal.url : prod.imagenes_producto[0].url;
}

// Crear nuevo producto en Supabase
async function handleCreateProduct() {
  if (!newProductForm.value.sku || !newProductForm.value.nombre) {
    createProductError.value = 'El SKU y el Nombre del producto son obligatorios.';
    return;
  }
  isCreatingProduct.value = true;
  createProductError.value = null;
  try {
    const res = await apiClient.post('/productos', newProductForm.value);
    await fetchCatalog();
    showNewProductModal.value = false;
    // Abrir directamente la galería del nuevo producto para empezar a subir fotos
    if (res.data.producto) {
      openMultimediaManager(res.data.producto);
    }
    // Reiniciar formulario
    newProductForm.value = {
      sku: '',
      nombre: '',
      marca: '',
      categoria_id: '',
      descripcion: '',
      estado: 'publicado'
    };
  } catch (err: any) {
    console.error('Error creando producto:', err);
    createProductError.value = err.response?.data?.error || 'No se pudo crear el producto.';
  } finally {
    isCreatingProduct.value = false;
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header Panel Administrativo -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
      <div>
        <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
          Panel de Control y Analítica
          <span class="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
            Supabase Postgres
          </span>
        </h1>
        <p class="text-xs text-slate-500 mt-1">Supervisión omnicanal de ventas, catálogo y recursos multimedia en tiempo real.</p>
      </div>

      <!-- Navegación de Pestañas y Acciones Principales -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
          <button
            id="tab-btn-multimedia"
            @click="activeTab = 'multimedia'"
            :class="[
              'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5',
              activeTab === 'multimedia'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            ]"
          >
            <ImageIcon class="w-3.5 h-3.5" />
            <span>Galería y Catálogo (RF-03)</span>
            <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-bold">
              {{ productos.length }}
            </span>
          </button>
          <button
            id="tab-btn-dashboard"
            @click="activeTab = 'dashboard'"
            :class="[
              'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5',
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            ]"
          >
            <TrendingUp class="w-3.5 h-3.5" />
            <span>Métricas y KPIs</span>
          </button>
        </div>

        <button
          id="btn-add-new-product"
          @click="showNewProductModal = true"
          class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
        >
          <Plus class="w-4 h-4" />
          <span>+ Nuevo Producto</span>
        </button>
      </div>
    </div>

    <!-- SECCIÓN 1: GESTOR DE RECURSOS MULTIMEDIA (HISTORIA DE USUARIO RF-03 / KAN-75, 76, 77, 78) -->
    <div v-if="activeTab === 'multimedia'" class="space-y-6">
      <!-- Si un producto está seleccionado para edición de galería, mostramos el componente dedicado -->
      <div v-if="selectedProduct" class="space-y-4">
        <ProductMultimediaManager
          :producto="selectedProduct"
          @close="selectedProduct = null"
          @updated="fetchCatalog"
        />
      </div>

      <!-- Listado de Catálogo de Productos para Gestión Visual -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <!-- Barra de Búsqueda y Filtro de Categoría -->
        <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-950/40">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package class="w-4 h-4 text-blue-600" />
              Catálogo de Productos en Supabase
            </h2>
            <span class="text-xs text-slate-400">Selecciona un producto para cargar, reordenar y configurar su galería</span>
          </div>

          <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <!-- Selector de Categoría -->
            <select
              v-model="selectedCategoriaFilter"
              class="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todas">Todas las categorías</option>
              <option v-for="cat in categorias" :key="cat.id" :value="cat.nombre">{{ cat.nombre }}</option>
            </select>

            <!-- Input de búsqueda -->
            <div class="relative flex-1 sm:w-64">
              <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="catalogSearch"
                type="text"
                placeholder="Buscar por SKU, nombre..."
                class="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Tabla / Lista de Productos -->
        <div v-if="isLoadingCatalog" class="py-16 text-center text-slate-400 space-y-2">
          <Loader2 class="w-7 h-7 animate-spin mx-auto text-blue-600" />
          <p class="text-xs">Cargando catálogo desde Supabase...</p>
        </div>

        <div v-else-if="filteredProductos.length === 0" class="py-12 text-center text-slate-400 space-y-2">
          <Package class="w-10 h-10 text-slate-300 mx-auto" />
          <p class="text-sm font-semibold">No se encontraron productos</p>
          <p class="text-xs">Prueba con otro término de búsqueda o crea uno nuevo con el botón superior.</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="p-3.5 pl-5">Portada</th>
                <th class="p-3.5">SKU / Identificador</th>
                <th class="p-3.5">Nombre y Marca</th>
                <th class="p-3.5">Categoría</th>
                <th class="p-3.5">Recursos Multimedia</th>
                <th class="p-3.5">Estado</th>
                <th class="p-3.5 pr-5 text-right">Acción RF-03</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr 
                v-for="prod in filteredProductos" 
                :key="prod.id"
                :class="[
                  'hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors',
                  selectedProduct?.id === prod.id ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                ]"
              >
                <!-- Miniatura de portada -->
                <td class="p-3.5 pl-5">
                  <div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    <img 
                      v-if="getCoverUrl(prod)" 
                      :src="getCoverUrl(prod)!" 
                      :alt="prod.nombre"
                      class="w-full h-full object-cover"
                    />
                    <ImageIcon v-else class="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  </div>
                </td>

                <!-- SKU -->
                <td class="p-3.5">
                  <span class="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                    {{ prod.sku }}
                  </span>
                </td>

                <!-- Nombre y Marca -->
                <td class="p-3.5">
                  <div class="font-semibold text-slate-900 dark:text-white">{{ prod.nombre }}</div>
                  <div class="text-[11px] text-slate-400">{{ prod.marca || 'Sin marca especificada' }}</div>
                </td>

                <!-- Categoría -->
                <td class="p-3.5">
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {{ prod.categorias?.nombre || 'General' }}
                  </span>
                </td>

                <!-- Badge de Imágenes -->
                <td class="p-3.5">
                  <span 
                    :class="[
                      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                      (prod.imagenes_producto?.length || 0) > 0 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' 
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                    ]"
                  >
                    <ImageIcon class="w-3 h-3" />
                    {{ prod.imagenes_producto?.length || 0 }} {{ (prod.imagenes_producto?.length || 0) === 1 ? 'imagen' : 'imágenes' }}
                  </span>
                </td>

                <!-- Estado -->
                <td class="p-3.5">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                    {{ prod.estado }}
                  </span>
                </td>

                <!-- Botón Acción -->
                <td class="p-3.5 pr-5 text-right">
                  <button
                    :id="`btn-manage-gallery-${prod.sku}`"
                    @click="openMultimediaManager(prod)"
                    class="px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 ml-auto"
                  >
                    <ImageIcon class="w-3.5 h-3.5" />
                    <span>Gestionar Multimedia</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 2: DASHBOARD GENERAL Y KPIS -->
    <div v-else class="space-y-8">
      <!-- Cards de KPIs Clave (RF-46) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex justify-between items-center text-slate-500">
            <span class="text-xs font-semibold">Ventas Totales Hoy</span>
            <span class="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg"><DollarSign class="w-4 h-4" /></span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">BOB {{ kpis.ventasHoy.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}</div>
          <span class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowUpRight class="w-3.5 h-3.5" /> +14.2% vs ayer
          </span>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex justify-between items-center text-slate-500">
            <span class="text-xs font-semibold">Ventas del Mes</span>
            <span class="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg"><TrendingUp class="w-4 h-4" /></span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">BOB {{ kpis.ventasMes.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}</div>
          <span class="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
            <ArrowUpRight class="w-3.5 h-3.5" /> Meta mensual: 87%
          </span>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex justify-between items-center text-slate-500">
            <span class="text-xs font-semibold">Órdenes Procesadas Hoy</span>
            <span class="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg"><ShoppingBag class="w-4 h-4" /></span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ kpis.ordenesHoy }}</div>
          <span class="text-[11px] text-slate-400">Canal Web (22) / POS (12)</span>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex justify-between items-center text-slate-500">
            <span class="text-xs font-semibold">Ticket Promedio</span>
            <span class="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg"><Users class="w-4 h-4" /></span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">BOB {{ kpis.ticketPromedio.toFixed(2) }}</div>
          <span class="text-[11px] text-purple-600 font-semibold">Conversión: {{ kpis.tasaConversion }}%</span>
        </div>
      </div>

      <!-- Grilla de Tablas Operativas -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Tabla de Órdenes Recientes -->
        <div class="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText class="w-4 h-4 text-blue-500" /> Órdenes y Ventas Recientes (RF-27 al RF-37)
            </h3>
            <button @click="activeTab = 'multimedia'" class="text-xs text-blue-600 hover:underline font-semibold">Ir a Galería Multimedia</button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th class="p-2.5">Código</th>
                  <th class="p-2.5">Cliente</th>
                  <th class="p-2.5">Canal</th>
                  <th class="p-2.5">Total</th>
                  <th class="p-2.5">Estado</th>
                  <th class="p-2.5">Fecha</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="ord in recentOrders" :key="ord.id">
                  <td class="p-2.5 font-mono font-bold text-blue-600">{{ ord.id }}</td>
                  <td class="p-2.5 text-slate-800 dark:text-slate-200 font-medium">{{ ord.cliente }}</td>
                  <td class="p-2.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 uppercase">{{ ord.canal }}</span>
                  </td>
                  <td class="p-2.5 font-bold">BOB {{ ord.total.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}</td>
                  <td class="p-2.5">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {{ ord.estado }}
                    </span>
                  </td>
                  <td class="p-2.5 text-slate-400">{{ ord.fecha }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Alertas de Stock y Quiebre (RF-42) -->
        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center gap-2 text-rose-600 font-bold text-sm">
            <AlertTriangle class="w-4 h-4" />
            <span>Alertas de Quiebre de Stock (RF-42)</span>
          </div>
          <p class="text-xs text-slate-400">Productos que alcanzaron el punto de reorden para Compras:</p>

          <div class="space-y-3">
            <div
              v-for="alert in lowStockAlerts"
              :key="alert.sku"
              class="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl space-y-1"
            >
              <div class="flex justify-between items-start">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200">{{ alert.nombre }}</span>
                <span class="text-[10px] font-mono px-1.5 py-0.5 bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 rounded font-bold">
                  Quedan {{ alert.stockActual }}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 flex justify-between">
                <span>SKU: {{ alert.sku }}</span>
                <span>Reorden: {{ alert.puntoReorden }}</span>
              </div>
            </div>
          </div>

          <button class="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl mt-2 transition-colors">
            Disparar Solicitud a Compras (ERP)
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: Crear Nuevo Producto -->
    <div
      v-if="showNewProductModal"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
        <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
          <div class="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
            <Package class="w-5 h-5 text-blue-600" />
            <span>Crear Nuevo Producto en Catálogo</span>
          </div>
          <button @click="showNewProductModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div v-if="createProductError" class="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
          {{ createProductError }}
        </div>

        <form @submit.prevent="handleCreateProduct" class="space-y-4 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU Único *</label>
              <input
                v-model="newProductForm.sku"
                type="text"
                placeholder="Ej: TEC-KEY-LOGI"
                required
                class="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Marca</label>
              <input
                v-model="newProductForm.marca"
                type="text"
                placeholder="Ej: Logitech"
                class="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Comercial del Producto *</label>
            <input
              v-model="newProductForm.nombre"
              type="text"
              placeholder="Ej: Teclado Mecánico Inalámbrico MX Keys Mini"
              required
              class="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
              <select
                v-model="newProductForm.categoria_id"
                class="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona una categoría</option>
                <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
              <select
                v-model="newProductForm.estado"
                class="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="publicado">Publicado</option>
                <option value="borrador">Borrador</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
            <textarea
              v-model="newProductForm.descripcion"
              rows="3"
              placeholder="Breve descripción de especificaciones técnicas y características..."
              class="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              @click="showNewProductModal = false"
              class="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="isCreatingProduct"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Loader2 v-if="isCreatingProduct" class="w-3.5 h-3.5 animate-spin" />
              <span>Guardar y Cargar Multimedia</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
