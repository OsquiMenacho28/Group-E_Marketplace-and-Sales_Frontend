<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useCartStore } from '@/stores/cart';
import { apiClient } from '@/api/client';
import type { Producto, FacetasCatalogo, SugerenciaItem } from '@/types';
import { useWishlistStore } from '@/stores/wishlist';
import { 
  Search, 
  ShoppingBag, 
  Filter, 
  CheckCircle2, 
  Star, 
  ShieldCheck, 
  Tag, 
  Eye, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Layers, 
  Sparkles, 
  Heart, 
  RefreshCw, 
  Clock3,
  SlidersHorizontal,
  RotateCcw,
  Check
} from 'lucide-vue-next';

const cartStore = useCartStore();
const wishlistStore = useWishlistStore();

// -----------------------------------------------------------------------------
// ESTADO DE BÚSQUEDA Y FILTROS FACETADOS (RF-06 / US-06)
// -----------------------------------------------------------------------------
const searchQuery = ref('');
const debouncedQuery = ref('');
const isSearching = ref(false);
const isSyncingCatalog = ref(false);
const catalogUpdatedAt = ref('recién sincronizado');
const showSuggestions = ref(false);
const suggestions = ref<SugerenciaItem[]>([]);
const searchContainerRef = ref<HTMLElement | null>(null);

// Filtros facetados
const selectedCategoryIds = ref<string[]>([]);
const selectedBrands = ref<string[]>([]);
const priceMinInput = ref<number | null>(null);
const priceMaxInput = ref<number | null>(null);
const appliedPriceMin = ref<number | null>(null);
const appliedPriceMax = ref<number | null>(null);
const onlyInStock = ref(false);
const sortBy = ref<'relevancia' | 'precio_asc' | 'precio_desc' | 'nombre'>('relevancia');

// Facetas reactivas devueltas por el backend
const facets = ref<FacetasCatalogo>({
  categorias: [],
  marcas: [],
  precio: { min: 0, max: 0 },
  en_stock: 0,
  total_general: 0
});

// Control responsive del panel lateral de filtros en móviles
const isMobileFiltersOpen = ref(false);

// Estructura interna de producto en Marketplace
interface MarketplaceProduct {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  categoria_id?: string;
  marca?: string;
  precio: number;
  rating: number;
  stock: number;
  badge: string;
  image: string;
  galleryImages: Array<{ id: string; url: string; es_principal: boolean; orden: number }>;
}

const products = ref<MarketplaceProduct[]>([]);
const totalCoincidencias = ref(0);

// Base de catálogo local de respaldo
const fallbackProducts: MarketplaceProduct[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    sku: 'LAP-DELL-XPS15',
    nombre: 'Laptop Dell XPS 15 (OLED 4K, i7 13va Gen)',
    categoria: 'Laptops y PCs',
    categoria_id: '10000000-0000-0000-0000-000000000001',
    marca: 'Dell',
    precio: 8999.00,
    rating: 4.9,
    stock: 8,
    badge: 'Más Vendido',
    image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    sku: 'LAP-APP-MBP16',
    nombre: 'Apple MacBook Pro 16" Chip M3 Pro',
    categoria: 'Laptops y PCs',
    categoria_id: '10000000-0000-0000-0000-000000000001',
    marca: 'Apple',
    precio: 18500.00,
    rating: 5.0,
    stock: 4,
    badge: 'Pro Performance',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    sku: 'MOU-LOG-MX3S',
    nombre: 'Mouse Inalámbrico Logitech MX Master 3S',
    categoria: 'Periféricos',
    categoria_id: '10000000-0000-0000-0000-000000000002',
    marca: 'Logitech',
    precio: 799.00,
    rating: 4.8,
    stock: 24,
    badge: 'Ergonomía Top',
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  },
  {
    id: '20000000-0000-0000-0000-000000000004',
    sku: 'TEC-LOG-MXMECH',
    nombre: 'Teclado Mecánico Inalámbrico Logitech MX Mechanical',
    categoria: 'Periféricos',
    categoria_id: '10000000-0000-0000-0000-000000000002',
    marca: 'Logitech',
    precio: 1150.00,
    rating: 4.8,
    stock: 15,
    badge: 'Productividad',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  },
  {
    id: '20000000-0000-0000-0000-000000000005',
    sku: 'MON-LG-27GP',
    nombre: 'Monitor Gamer LG UltraGear 27" 165Hz IPS',
    categoria: 'Monitores',
    categoria_id: '10000000-0000-0000-0000-000000000003',
    marca: 'LG',
    precio: 2450.00,
    rating: 4.7,
    stock: 5,
    badge: 'Gamer 165Hz',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  },
  {
    id: '20000000-0000-0000-0000-000000000006',
    sku: 'MON-SAM-M8',
    nombre: 'Monitor Inteligente Samsung Smart M8 32" 4K',
    categoria: 'Monitores',
    categoria_id: '10000000-0000-0000-0000-000000000003',
    marca: 'Samsung',
    precio: 4200.00,
    rating: 4.6,
    stock: 7,
    badge: 'Smart 4K',
    image: 'https://images.unsplash.com/photo-1547119957-637f8679db1e?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  },
  {
    id: '20000000-0000-0000-0000-000000000007',
    sku: 'AUR-SONY-WH1000',
    nombre: 'Auriculares Sony WH-1000XM5 Noise Cancelling',
    categoria: 'Audio y Video',
    categoria_id: '10000000-0000-0000-0000-000000000004',
    marca: 'Sony',
    precio: 2890.00,
    rating: 4.9,
    stock: 12,
    badge: 'Hi-Res Audio',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  },
  {
    id: '20000000-0000-0000-0000-000000000008',
    sku: 'CAM-SONY-A7IV',
    nombre: 'Cámara Digital Sony Alpha 7 IV Full-Frame Mirrorless',
    categoria: 'Cámaras y Fotografía',
    categoria_id: '10000000-0000-0000-0000-000000000005',
    marca: 'Sony',
    precio: 16999.00,
    rating: 5.0,
    stock: 3,
    badge: 'Full Frame 4K',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
    galleryImages: []
  }
];

// -----------------------------------------------------------------------------
// DEBOUNCE PARA BÚSQUEDA Y SUGERENCIAS
// -----------------------------------------------------------------------------
let debounceTimeout: any = null;
let suggestionsTimeout: any = null;

watch(searchQuery, (newVal) => {
  clearTimeout(debounceTimeout);
  clearTimeout(suggestionsTimeout);

  // Debounce para el autocompletado predictivo (150ms rápido)
  if (newVal.trim().length >= 1) {
    suggestionsTimeout = setTimeout(() => {
      fetchSuggestions(newVal.trim());
    }, 150);
  } else {
    suggestions.value = [];
    showSuggestions.value = false;
  }

  // Debounce para la búsqueda principal (300ms)
  debounceTimeout = setTimeout(() => {
    debouncedQuery.value = newVal.trim();
    ejecutarBusqueda();
  }, 300);
});

// Detectar click fuera del buscador para ocultar autocompletado
function handleClickOutside(event: MouseEvent) {
  if (searchContainerRef.value && !searchContainerRef.value.contains(event.target as Node)) {
    showSuggestions.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  ejecutarBusqueda();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

// -----------------------------------------------------------------------------
// LLAMADAS AL ENDPOINT DE BÚSQUEDA FACETADA Y SUGERENCIAS
// -----------------------------------------------------------------------------
async function fetchSuggestions(term: string) {
  try {
    const res = await apiClient.get('/api/v1/catalogo/sugerencias', {
      params: { q: term, limite: 5 }
    });
    suggestions.value = Array.isArray(res.data) ? res.data : [];
    showSuggestions.value = suggestions.value.length > 0;
  } catch (err) {
    // Fallback local para sugerencias
    const norm = term.toLowerCase();
    suggestions.value = fallbackProducts
      .filter(p => p.nombre.toLowerCase().includes(norm) || p.sku.toLowerCase().includes(norm) || p.categoria.toLowerCase().includes(norm))
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        categoria: p.categoria,
        marca: p.marca || null,
        precio: p.precio,
        imagen_url: p.image,
        stock: p.stock
      }));
    showSuggestions.value = suggestions.value.length > 0;
  }
}

function selectSuggestion(item: SugerenciaItem) {
  searchQuery.value = item.nombre;
  debouncedQuery.value = item.nombre;
  showSuggestions.value = false;
  ejecutarBusqueda();
}

function clearSearch() {
  searchQuery.value = '';
  debouncedQuery.value = '';
  showSuggestions.value = false;
  ejecutarBusqueda();
}

async function ejecutarBusqueda() {
  isSearching.value = true;
  try {
    const params: Record<string, any> = {
      ordenar_por: sortBy.value,
      pagina: 1,
      limite: 40
    };

    if (debouncedQuery.value) {
      params.q = debouncedQuery.value;
    }
    if (selectedCategoryIds.value.length > 0) {
      params.categoria_ids = selectedCategoryIds.value.join(',');
    }
    if (selectedBrands.value.length > 0) {
      params.marcas = selectedBrands.value.join(',');
    }
    if (appliedPriceMin.value !== null && appliedPriceMin.value > 0) {
      params.precio_min = appliedPriceMin.value;
    }
    if (appliedPriceMax.value !== null && appliedPriceMax.value > 0) {
      params.precio_max = appliedPriceMax.value;
    }
    if (onlyInStock.value) {
      params.en_stock = true;
    }

    const res = await apiClient.get('/api/v1/catalogo/buscar', { params });
    const data = res.data;

    if (data && Array.isArray(data.items)) {
      totalCoincidencias.value = data.total_coincidencias ?? data.items.length;
      facets.value = data.facetas || {
        categorias: [],
        marcas: [],
        precio: { min: 0, max: 0 },
        en_stock: 0,
        total_general: data.items.length
      };

      products.value = data.items.map((dbp: any) => {
        const gallery = (dbp.imagenes_producto || []).sort((a: any, b: any) => a.orden - b.orden);
        const cover = gallery.find((i: any) => i.es_principal) || gallery[0];
        const realPrice = Number(dbp.precio || 0);

        return {
          id: dbp.id,
          sku: dbp.sku,
          nombre: dbp.nombre,
          categoria: dbp.categorias?.nombre || 'General',
          categoria_id: dbp.categoria_id,
          marca: dbp.marca || 'MaxiConecta',
          precio: realPrice > 0 ? realPrice : 999.00,
          rating: 4.8,
          stock: dbp.stock ?? 10,
          badge: realPrice > 8000 ? 'Pro' : (dbp.stock < 5 ? 'Pocas unidades' : 'Disponible'),
          image: cover?.url || (dbp.imagenes && dbp.imagenes[0]) || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80',
          galleryImages: gallery
        };
      });
      catalogUpdatedAt.value = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (err) {
    console.warn('Aviso: backend no disponible, ejecutando motor facetado en memoria local:', err);
    // Filtrado en memoria si el backend estuviera offline
    aplicarFiltrosLocales();
  } finally {
    isSearching.value = false;
  }
}

function aplicarFiltrosLocales() {
  const normQ = debouncedQuery.value.toLowerCase();
  let filtered = [...fallbackProducts];

  if (normQ) {
    filtered = filtered.filter(p => 
      p.nombre.toLowerCase().includes(normQ) ||
      p.sku.toLowerCase().includes(normQ) ||
      p.categoria.toLowerCase().includes(normQ) ||
      (p.marca && p.marca.toLowerCase().includes(normQ))
    );
  }

  // Recalcular facetas sobre el universo de texto
  const catMap: Record<string, { id: string; etiqueta: string; total: number }> = {};
  const brandMap: Record<string, number> = {};
  let minP = Infinity;
  let maxP = 0;
  let inStockCount = 0;

  filtered.forEach(p => {
    if (p.precio < minP) minP = p.precio;
    if (p.precio > maxP) maxP = p.precio;
    if (p.stock > 0) inStockCount++;

    if (p.categoria_id) {
      if (!catMap[p.categoria_id]) {
        catMap[p.categoria_id] = { id: p.categoria_id, etiqueta: p.categoria, total: 0 };
      }
      catMap[p.categoria_id].total++;
    }

    if (p.marca) {
      brandMap[p.marca] = (brandMap[p.marca] || 0) + 1;
    }
  });

  facets.value = {
    categorias: Object.values(catMap).map(c => ({
      ...c,
      seleccionado: selectedCategoryIds.value.includes(c.id)
    })),
    marcas: Object.entries(brandMap).map(([brand, count]) => ({
      id: brand,
      etiqueta: brand,
      total: count,
      seleccionado: selectedBrands.value.includes(brand)
    })),
    precio: { min: minP === Infinity ? 0 : minP, max: maxP },
    en_stock: inStockCount,
    total_general: fallbackProducts.length
  };

  // Filtros acumulativos
  if (selectedCategoryIds.value.length > 0) {
    filtered = filtered.filter(p => p.categoria_id && selectedCategoryIds.value.includes(p.categoria_id));
  }
  if (selectedBrands.value.length > 0) {
    filtered = filtered.filter(p => p.marca && selectedBrands.value.includes(p.marca));
  }
  if (appliedPriceMin.value !== null) {
    filtered = filtered.filter(p => p.precio >= appliedPriceMin.value!);
  }
  if (appliedPriceMax.value !== null) {
    filtered = filtered.filter(p => p.precio <= appliedPriceMax.value!);
  }
  if (onlyInStock.value) {
    filtered = filtered.filter(p => p.stock > 0);
  }

  // Ordenamiento
  if (sortBy.value === 'precio_asc') {
    filtered.sort((a, b) => a.precio - b.precio);
  } else if (sortBy.value === 'precio_desc') {
    filtered.sort((a, b) => b.precio - a.precio);
  } else if (sortBy.value === 'nombre') {
    filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  products.value = filtered;
  totalCoincidencias.value = filtered.length;
}

// -----------------------------------------------------------------------------
// CONTROLADORES DE FILTROS FACETADOS
// -----------------------------------------------------------------------------
function toggleCategoria(catId: string) {
  const index = selectedCategoryIds.value.indexOf(catId);
  if (index > -1) {
    selectedCategoryIds.value.splice(index, 1);
  } else {
    selectedCategoryIds.value.push(catId);
  }
  ejecutarBusqueda();
}

function toggleMarca(brandName: string) {
  const index = selectedBrands.value.indexOf(brandName);
  if (index > -1) {
    selectedBrands.value.splice(index, 1);
  } else {
    selectedBrands.value.push(brandName);
  }
  ejecutarBusqueda();
}

function aplicarRangoPrecio() {
  appliedPriceMin.value = priceMinInput.value;
  appliedPriceMax.value = priceMaxInput.value;
  ejecutarBusqueda();
}

function aplicarRangoRapido(min: number | null, max: number | null) {
  priceMinInput.value = min;
  priceMaxInput.value = max;
  appliedPriceMin.value = min;
  appliedPriceMax.value = max;
  ejecutarBusqueda();
}

function toggleStock() {
  onlyInStock.value = !onlyInStock.value;
  ejecutarBusqueda();
}

function limpiarTodosLosFiltros() {
  searchQuery.value = '';
  debouncedQuery.value = '';
  selectedCategoryIds.value = [];
  selectedBrands.value = [];
  priceMinInput.value = null;
  priceMaxInput.value = null;
  appliedPriceMin.value = null;
  appliedPriceMax.value = null;
  onlyInStock.value = false;
  sortBy.value = 'relevancia';
  ejecutarBusqueda();
}

const activeFiltersCount = computed(() => {
  let count = 0;
  if (debouncedQuery.value) count++;
  count += selectedCategoryIds.value.length;
  count += selectedBrands.value.length;
  if (appliedPriceMin.value !== null || appliedPriceMax.value !== null) count++;
  if (onlyInStock.value) count++;
  return count;
});

// Resumen del inventario
const inventorySummary = computed(() => {
  const units = products.value.reduce((total, product) => total + (product.stock || 0), 0);
  return { products: totalCoincidencias.value, units };
});

function refreshCatalog() {
  isSyncingCatalog.value = true;
  ejecutarBusqueda().finally(() => {
    isSyncingCatalog.value = false;
  });
}

// -----------------------------------------------------------------------------
// MODAL DE GALERÍA Y ACCIONES DE CARRITO / DESEOS
// -----------------------------------------------------------------------------
const activeGalleryProduct = ref<MarketplaceProduct | null>(null);
const currentGalleryIndex = ref(0);

function openProductGallery(prod: MarketplaceProduct) {
  activeGalleryProduct.value = prod;
  currentGalleryIndex.value = 0;
}

const currentGalleryImage = computed<string | undefined>(() => {
  if (!activeGalleryProduct.value) return undefined;
  const imgs = activeGalleryProduct.value.galleryImages;
  if (imgs.length === 0) return activeGalleryProduct.value.image;
  return imgs[currentGalleryIndex.value]?.url || activeGalleryProduct.value.image;
});

function agregarAlCarrito(prod: MarketplaceProduct) {
  cartStore.addItem({
    variante_id: prod.id,
    sku: prod.sku,
    nombre: prod.nombre,
    cantidad: 1,
    precio_unitario: prod.precio
  });
}

function alternarDeseo(prod: MarketplaceProduct) {
  const yaEsta = wishlistStore.estaEnDeseos(prod.id);
  if (yaEsta) {
    wishlistStore.eliminarDeseo('demo-client', prod.id);
  } else {
    wishlistStore.agregarDeseo('demo-client', prod.id);
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Hero Banner Promocional -->
    <section class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 via-cyan-50 to-amber-100 p-7 sm:p-10 md:p-12 text-slate-950 shadow-xl shadow-teal-950/10 border border-white surface-grid">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(251,191,36,0.42),transparent_24%),radial-gradient(circle_at_20%_100%,rgba(45,212,191,0.28),transparent_32%)]" />
      <div class="relative z-10 grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-8 items-end">
        <div class="max-w-2xl space-y-4">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-teal-900 backdrop-blur-md border border-teal-200 shadow-sm">
            <Sparkles class="w-3.5 h-3.5 text-amber-600" /> Búsqueda de Catálogo Facetada (RF-06)
          </span>
          <h1 class="display-font text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight text-slate-900">
            Encuentra exactamente lo que buscas.
          </h1>
          <p class="max-w-xl text-slate-700 text-sm sm:text-base leading-relaxed">
            Búsqueda por texto completo con filtros acumulativos por categoría, marca, precio y disponibilidad en tiempo real.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3 max-w-sm lg:justify-self-end">
          <div class="rounded-xl bg-white/80 p-3.5 border border-white shadow-sm backdrop-blur-sm">
            <span class="block text-2xl font-black text-amber-600">{{ totalCoincidencias }}</span>
            <span class="block mt-0.5 text-[11px] uppercase tracking-wider text-slate-600 font-semibold">coincidencias</span>
          </div>
          <div class="rounded-xl bg-white/80 p-3.5 border border-white shadow-sm backdrop-blur-sm">
            <span class="block text-2xl font-black text-teal-800">{{ inventorySummary.units }}</span>
            <span class="block mt-0.5 text-[11px] uppercase tracking-wider text-slate-600 font-semibold">unidades stock</span>
          </div>
          <div class="col-span-2 rounded-xl bg-slate-900/90 p-3.5 border border-slate-800 flex items-center gap-3 shadow-md">
            <ShieldCheck class="w-8 h-8 text-teal-300 shrink-0" />
            <p class="text-xs leading-snug text-slate-200">Filtros acumulativos con recuento dinámico y FTS insensible a tildes.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Barra de Búsqueda Predictiva con Autocompletado (RF-06 / US-06) -->
    <section class="bg-white/95 dark:bg-slate-900/95 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
      <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        <!-- Input de Búsqueda con Dropdown de Typeahead -->
        <div ref="searchContainerRef" class="relative flex-1 max-w-2xl">
          <div class="relative">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              v-model="searchQuery"
              @focus="showSuggestions = suggestions.length > 0"
              type="text"
              placeholder="Buscar por nombre, SKU, marca o descripción (ej: camara, xps15, logitech)..."
              class="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-all placeholder:text-slate-400"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="clearSearch"
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
              title="Limpiar búsqueda"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Menú Flotante de Sugerencias Predictivas (Typeahead) -->
          <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <div
              v-if="showSuggestions && suggestions.length > 0"
              class="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800"
            >
              <div class="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span class="flex items-center gap-1.5">
                  <Sparkles class="w-3 h-3 text-amber-500" /> Coincidencias predictivas
                </span>
                <span>{{ suggestions.length }} sugerencias</span>
              </div>
              <ul class="max-h-72 overflow-y-auto">
                <li
                  v-for="sug in suggestions"
                  :key="sug.id"
                  @click="selectSuggestion(sug)"
                  class="p-2.5 hover:bg-teal-50/70 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors"
                >
                  <img
                    v-if="sug.imagen_url"
                    :src="sug.imagen_url"
                    :alt="sug.nombre"
                    class="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{{ sug.nombre }}</p>
                    <div class="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span class="bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-semibold px-1.5 py-0.5 rounded">{{ sug.categoria }}</span>
                      <span class="font-mono">SKU: {{ sug.sku }}</span>
                      <span v-if="sug.marca" class="font-medium text-slate-600 dark:text-slate-400">· {{ sug.marca }}</span>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-xs font-black text-teal-700 dark:text-teal-400">
                      Bs. {{ Number(sug.precio).toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </transition>
        </div>

        <!-- Controles de Ordenamiento y Botón de Filtros Móvil -->
        <div class="flex items-center gap-2.5">
          <!-- Selector de Ordenamiento -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500 font-medium hidden sm:inline">Ordenar:</span>
            <select
              v-model="sortBy"
              @change="ejecutarBusqueda"
              class="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="relevancia">Más relevantes</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="nombre">Nombre A - Z</option>
            </select>
          </div>

          <!-- Botón Filtros en Pantallas Chicas -->
          <button
            type="button"
            @click="isMobileFiltersOpen = !isMobileFiltersOpen"
            class="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold shadow-sm"
          >
            <SlidersHorizontal class="w-3.5 h-3.5" />
            <span>Filtros</span>
            <span v-if="activeFiltersCount > 0" class="ml-1 px-1.5 py-0.2 rounded-full bg-teal-600 text-white text-[10px]">
              {{ activeFiltersCount }}
            </span>
          </button>

          <!-- Botón de Sincronizar / Refrescar Catálogo -->
          <button
            type="button"
            class="shrink-0 w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 hover:border-teal-300 text-slate-500 hover:text-teal-700 flex items-center justify-center transition-all"
            :title="isSyncingCatalog ? 'Sincronizando...' : 'Actualizar catálogo'"
            :disabled="isSyncingCatalog || isSearching"
            @click="refreshCatalog"
          >
            <RefreshCw :class="['w-4 h-4', (isSyncingCatalog || isSearching) ? 'animate-spin text-teal-600' : '']" />
          </button>
        </div>
      </div>

      <!-- Barra de Chips de Filtros Activos -->
      <div v-if="activeFiltersCount > 0" class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filtros aplicados:</span>
        
        <!-- Chip de Texto -->
        <span
          v-if="debouncedQuery"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 text-xs font-medium"
        >
          Texto: "{{ debouncedQuery }}"
          <button @click="clearSearch" class="hover:text-rose-600"><X class="w-3 h-3" /></button>
        </span>

        <!-- Chips de Categorías -->
        <span
          v-for="cid in selectedCategoryIds"
          :key="cid"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-xs font-medium"
        >
          {{ facets.categorias.find(c => c.id === cid)?.etiqueta || 'Categoría' }}
          <button @click="toggleCategoria(cid)" class="hover:text-rose-600"><X class="w-3 h-3" /></button>
        </span>

        <!-- Chips de Marcas -->
        <span
          v-for="brand in selectedBrands"
          :key="brand"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 text-xs font-medium"
        >
          {{ brand }}
          <button @click="toggleMarca(brand)" class="hover:text-rose-600"><X class="w-3 h-3" /></button>
        </span>

        <!-- Chip de Precio -->
        <span
          v-if="appliedPriceMin !== null || appliedPriceMax !== null"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs font-medium"
        >
          Bs. {{ appliedPriceMin || 0 }} - {{ appliedPriceMax ? 'Bs. ' + appliedPriceMax : 'Sin límite' }}
          <button @click="aplicarRangoRapido(null, null)" class="hover:text-rose-600"><X class="w-3 h-3" /></button>
        </span>

        <!-- Chip de Stock -->
        <span
          v-if="onlyInStock"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-medium"
        >
          Solo en stock
          <button @click="toggleStock" class="hover:text-rose-600"><X class="w-3 h-3" /></button>
        </span>

        <!-- Botón Limpiar Todo -->
        <button
          @click="limpiarTodosLosFiltros"
          class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 ml-auto hover:underline"
        >
          <RotateCcw class="w-3 h-3" /> Limpiar todos
        </button>
      </div>
    </section>

    <!-- Layout Principal: Barra Lateral de Filtros Facetados + Cuadrícula de Productos -->
    <div class="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-8 items-start">
      
      <!-- ===================================================================== -->
      <!-- BARRA LATERAL DE FILTROS FACETADOS ACUMULATIVOS (RF-06 / US-06)      -->
      <!-- ===================================================================== -->
      <aside
        :class="[
          'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-6 shadow-sm sticky top-6',
          isMobileFiltersOpen ? 'block fixed inset-x-4 top-20 z-50 max-h-[85vh] overflow-y-auto shadow-2xl border-teal-500' : 'hidden lg:block'
        ]"
      >
        <!-- Encabezado Sidebar Móvil -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
            <Filter class="w-4 h-4 text-teal-600" />
            <span>Filtros Facetados</span>
          </div>
          <button
            v-if="isMobileFiltersOpen"
            @click="isMobileFiltersOpen = false"
            class="lg:hidden p-1 text-slate-400 hover:text-slate-600"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- 1. Faceta: Categorías con recuento dinámico -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Categorías</h3>
            <span class="text-[10px] text-slate-400 font-semibold">{{ facets.categorias.length }}</span>
          </div>
          <div class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            <label
              v-for="cat in facets.categorias"
              :key="cat.id"
              class="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:text-teal-700 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div class="flex items-center gap-2.5 truncate">
                <input
                  type="checkbox"
                  :checked="selectedCategoryIds.includes(cat.id)"
                  @change="toggleCategoria(cat.id)"
                  class="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span class="truncate" :title="cat.etiqueta">{{ cat.etiqueta }}</span>
              </div>
              <span
                :class="[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  selectedCategoryIds.includes(cat.id)
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                ]"
              >
                {{ cat.total }}
              </span>
            </label>
          </div>
        </div>

        <!-- 2. Faceta: Marcas con recuento dinámico -->
        <div class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Marcas</h3>
            <span class="text-[10px] text-slate-400 font-semibold">{{ facets.marcas.length }}</span>
          </div>
          <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <label
              v-for="brand in facets.marcas"
              :key="brand.id"
              class="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:text-teal-700 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div class="flex items-center gap-2.5 truncate">
                <input
                  type="checkbox"
                  :checked="selectedBrands.includes(brand.id)"
                  @change="toggleMarca(brand.id)"
                  class="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span class="truncate">{{ brand.etiqueta }}</span>
              </div>
              <span
                :class="[
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                  selectedBrands.includes(brand.id)
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                ]"
              >
                {{ brand.total }}
              </span>
            </label>
          </div>
        </div>

        <!-- 3. Faceta: Rango de Precios en BOB -->
        <div class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Precio (BOB)</h3>
            <span class="text-[10px] text-slate-400 font-mono">
              Bs. {{ facets.precio.min }} - {{ facets.precio.max }}
            </span>
          </div>

          <!-- Píldoras de rango rápido -->
          <div class="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              @click="aplicarRangoRapido(null, 1000)"
              class="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:border-teal-300 font-medium"
            >
              &lt; Bs. 1.000
            </button>
            <button
              type="button"
              @click="aplicarRangoRapido(1000, 3000)"
              class="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:border-teal-300 font-medium"
            >
              1.000 - 3.000
            </button>
            <button
              type="button"
              @click="aplicarRangoRapido(3000, 8000)"
              class="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:border-teal-300 font-medium"
            >
              3.000 - 8.000
            </button>
            <button
              type="button"
              @click="aplicarRangoRapido(8000, null)"
              class="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 hover:border-teal-300 font-medium"
            >
              &gt; Bs. 8.000
            </button>
          </div>

          <!-- Inputs manuales Min y Max -->
          <div class="flex items-center gap-2 pt-1">
            <input
              v-model.number="priceMinInput"
              type="number"
              placeholder="Mín"
              class="w-1/2 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <span class="text-slate-400 text-xs">-</span>
            <input
              v-model.number="priceMaxInput"
              type="number"
              placeholder="Máx"
              class="w-1/2 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <button
            type="button"
            @click="aplicarRangoPrecio"
            class="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            Aplicar Precio
          </button>
        </div>

        <!-- 4. Faceta: Disponibilidad y Stock -->
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
          <label class="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                :checked="onlyInStock"
                @change="toggleStock"
                class="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span class="font-medium">Solo en stock inmediato</span>
            </div>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {{ facets.en_stock }}
            </span>
          </label>
        </div>

        <!-- Botón Reset Filtros -->
        <div v-if="activeFiltersCount > 0" class="pt-2">
          <button
            type="button"
            @click="limpiarTodosLosFiltros"
            class="w-full py-2 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Restablecer Filtros</span>
          </button>
        </div>
      </aside>

      <!-- ===================================================================== -->
      <!-- CUADRÍCULA DE PRODUCTOS O ESTADO VACÍO                                -->
      <!-- ===================================================================== -->
      <main class="space-y-6">
        
        <!-- Indicador de Resultados y Estado -->
        <div class="flex items-center justify-between text-xs text-slate-500 px-1">
          <p class="flex items-center gap-1.5 font-medium">
            <span class="w-2 h-2 rounded-full bg-teal-500"></span>
            Mostrando <strong class="text-slate-900 dark:text-white">{{ products.length }}</strong> de {{ totalCoincidencias }} productos encontrados
          </p>
          <span class="text-[11px] text-slate-400 hidden sm:inline">
            Sincronizado: {{ catalogUpdatedAt }}
          </span>
        </div>

        <!-- Grid de Tarjetas de Productos -->
        <section v-if="products.length > 0" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <article
            v-for="prod in products"
            :key="prod.id"
            class="reveal-up group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:shadow-teal-900/10 transition-all duration-300"
          >
            <!-- Imagen de Portada y Galería -->
            <div class="relative h-56 bg-slate-100 dark:bg-slate-950 overflow-hidden">
              <img
                :src="prod.image"
                :alt="prod.nombre"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                @click="openProductGallery(prod)"
              />
              
              <button
                type="button"
                :class="[
                  'absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 hover:bg-white shadow-sm backdrop-blur-sm transition-colors z-10',
                  wishlistStore.estaEnDeseos(prod.id) ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
                ]"
                :title="wishlistStore.estaEnDeseos(prod.id) ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos'"
                @click="alternarDeseo(prod)"
              >
                <Heart :class="['w-4 h-4', wishlistStore.estaEnDeseos(prod.id) ? 'fill-current' : '']" />
              </button>
              
              <span class="absolute top-2.5 left-2.5 bg-teal-700/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm z-10">
                {{ prod.badge }}
              </span>

              <!-- Indicador de Galería si tiene más fotos -->
              <button
                v-if="prod.galleryImages && prod.galleryImages.length > 0"
                @click="openProductGallery(prod)"
                class="absolute bottom-2.5 left-2.5 bg-black/60 hover:bg-black/80 text-white text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm shadow z-10"
                title="Ver galería completa"
              >
                <Layers class="w-3 h-3 text-cyan-400" />
                <span>{{ prod.galleryImages.length }} fotos</span>
              </button>

              <div class="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-sm z-10">
                <Star class="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>{{ prod.rating }}</span>
              </div>
            </div>

            <!-- Contenido de la Tarjeta -->
            <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                    {{ prod.categoria }}
                  </span>
                  <span v-if="prod.marca" class="text-[11px] font-semibold text-slate-400">
                    {{ prod.marca }}
                  </span>
                </div>
                <h3 
                  @click="openProductGallery(prod)"
                  class="font-bold text-sm line-clamp-2 text-slate-800 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors cursor-pointer mt-1"
                >
                  {{ prod.nombre }}
                </h3>
                <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-1">
                  <span>SKU: {{ prod.sku }}</span>
                  <span :class="prod.stock > 0 ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'">
                    {{ prod.stock > 0 ? `${prod.stock} disp.` : 'Agotado' }}
                  </span>
                </div>
              </div>

              <!-- Precio y Acción de Compra -->
              <div class="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span class="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Precio Contado</span>
                  <span class="text-lg font-black text-slate-900 dark:text-white">
                    BOB {{ prod.precio.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}
                  </span>
                </div>
                <button
                  @click="agregarAlCarrito(prod)"
                  class="p-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-md active:scale-95 transition-all"
                  title="Añadir al carrito"
                  :disabled="prod.stock <= 0"
                >
                  <ShoppingBag class="w-4 h-4" />
                </button>
              </div>
            </div>
          </article>
        </section>

        <!-- Estado Vacío Cuando no hay Coincidencias -->
        <section v-else class="py-16 px-6 text-center bg-white/90 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Search class="w-8 h-8" />
          </div>
          <div class="max-w-md mx-auto space-y-1.5">
            <h2 class="text-lg font-black text-slate-800 dark:text-white">No encontramos coincidencias</h2>
            <p class="text-xs text-slate-500 leading-relaxed">
              No hay productos que coincidan simultáneamente con todos los filtros aplicados. Prueba quitando algunos filtros o buscando un término más general.
            </p>
          </div>
          <div class="pt-2 flex justify-center gap-3">
            <button
              @click="limpiarTodosLosFiltros"
              class="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md inline-flex items-center gap-2"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              <span>Restablecer todos los filtros</span>
            </button>
          </div>
        </section>
      </main>
    </div>

    <!-- MODAL: Visor de Galería Visual del Producto -->
    <div
      v-if="activeGalleryProduct"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      @click.self="activeGalleryProduct = null"
    >
      <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Header del Modal -->
        <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">{{ activeGalleryProduct.nombre }}</h3>
            <span class="text-xs text-slate-400 font-mono">SKU: {{ activeGalleryProduct.sku }} · {{ activeGalleryProduct.categoria }}</span>
          </div>
          <button @click="activeGalleryProduct = null" class="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Imagen Principal Seleccionada -->
        <div class="relative bg-slate-950 flex items-center justify-center h-80 overflow-hidden">
          <img
            :src="currentGalleryImage"
            :alt="activeGalleryProduct.nombre"
            class="max-h-full max-w-full object-contain"
          />

          <!-- Botones de Navegación si hay múltiples imágenes -->
          <button
            v-if="activeGalleryProduct.galleryImages.length > 1"
            @click="currentGalleryIndex = (currentGalleryIndex - 1 + activeGalleryProduct.galleryImages.length) % activeGalleryProduct.galleryImages.length"
            class="absolute left-3 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm"
          >
            <ChevronLeft class="w-5 h-5" />
          </button>
          <button
            v-if="activeGalleryProduct.galleryImages.length > 1"
            @click="currentGalleryIndex = (currentGalleryIndex + 1) % activeGalleryProduct.galleryImages.length"
            class="absolute right-3 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm"
          >
            <ChevronRight class="w-5 h-5" />
          </button>
        </div>

        <!-- Tira de Miniaturas (Thumbnails) -->
        <div
          v-if="activeGalleryProduct.galleryImages.length > 0"
          class="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto"
        >
          <button
            v-for="(img, idx) in activeGalleryProduct.galleryImages"
            :key="img.id"
            @click="currentGalleryIndex = idx"
            :class="[
              'w-16 h-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all',
              currentGalleryIndex === idx
                ? 'border-teal-600 ring-2 ring-teal-500/20 scale-105'
                : 'border-transparent opacity-70 hover:opacity-100'
            ]"
          >
            <img :src="img.url" class="w-full h-full object-cover" alt="Thumbnail" />
          </button>
        </div>

        <!-- Footer con Acción de Compra -->
        <div class="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <span class="text-xs text-slate-400 block">Precio Oficial</span>
            <span class="text-xl font-extrabold text-teal-700 dark:text-teal-400">
              BOB {{ activeGalleryProduct.precio.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}
            </span>
          </div>
          <button
            @click="agregarAlCarrito(activeGalleryProduct); activeGalleryProduct = null"
            class="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2"
          >
            <ShoppingBag class="w-4 h-4" />
            <span>Añadir al Carrito</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
