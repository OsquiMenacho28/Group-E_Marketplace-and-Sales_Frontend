<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCartStore } from '@/stores/cart';
import { apiClient } from '@/api/client';
import DualCurrencyPrice from '@/components/DualCurrencyPrice.vue';
import type { Producto } from '@/types';
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
  Layers,
  Sparkles,
  Heart,
  RefreshCw,
  Clock3
} from 'lucide-vue-next';

const cartStore = useCartStore();

const wishlistStore = useWishlistStore();

const searchQuery = ref('');
const selectedCategory = ref('Todos');
const categories = ref<string[]>(['Todos', 'Laptops y PCs', 'Periféricos', 'Monitores', 'Audio y Video']);
const isSyncingCatalog = ref(false);
const catalogUpdatedAt = ref('recién actualizado');

// Catálogo base con precios y ratings
interface MarketplaceProduct {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  precio: number;
  rating: number;
  stock: number;
  badge: string;
  image: string;
  variante_id?: string;
  galleryImages: Array<{ id: string; url: string; es_principal: boolean; orden: number }>;
}

function getDefaultImageForCategory(catName?: string, prodName?: string): string {
  const text = `${catName || ''} ${prodName || ''}`.toLowerCase();
  if (text.includes('mouse') || text.includes('logitech') || text.includes('perifer')) {
    return 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80';
  }
  if (text.includes('laptop') || text.includes('dell') || text.includes('pc') || text.includes('gamer')) {
    return 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80';
  }
  if (text.includes('monitor') || text.includes('pantalla')) {
    return 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80';
  }
  if (text.includes('audio') || text.includes('auricular') || text.includes('sony') || text.includes('sonido')) {
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80';
  }
  if (text.includes('tablet') || text.includes('samsung')) {
    return 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80';
  }
  if (text.includes('webcam') || text.includes('camara') || text.includes('c920')) {
    return 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=600&q=80';
  }
  if (text.includes('hub') || text.includes('anker') || text.includes('usb')) {
    return 'https://images.unsplash.com/photo-1622445262464-84b14e3295b3?auto=format&fit=crop&w=600&q=80';
  }
  return 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80';
}

const defaultProducts: MarketplaceProduct[] = [
  {
    id: 'lap-dell-xps15',
    sku: 'LAP-DELL-XPS15',
    nombre: 'Laptop Dell XPS 15 (OLED 4K, Intel Core i7 13va Gen, 32GB RAM, 1TB SSD)',
    categoria: 'Laptops y PCs',
    precio: 6767.00,
    rating: 4.9,
    stock: 15,
    badge: 'Más Vendido',
    image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80',
    variante_id: '0f92a03b-df62-4916-ac39-4506b575d8af',
    galleryImages: [
      { id: 'img-1', url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 },
      { id: 'img-2', url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80', es_principal: false, orden: 2 }
    ]
  },
  {
    id: 'mou-log-mx3s',
    sku: 'MOU-LOG-MX3S',
    nombre: 'Mouse Inalámbrico Logitech MX Master 3S con Sensor Darkfield 8K DPI',
    categoria: 'Periféricos',
    precio: 899.00,
    rating: 4.8,
    stock: 25,
    badge: 'Popular',
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
    variante_id: 'e38572aa-a259-40ce-ac39-6e0a4e4fd2c2',
    galleryImages: [
      { id: 'img-3', url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 }
    ]
  },
  {
    id: 'mon-sam-odyssey',
    sku: 'MON-SAM-ODYSSEY',
    nombre: 'Monitor Gamer Samsung Odyssey G7 27 pulg QHD 240Hz 1ms Curvo 1000R',
    categoria: 'Monitores',
    precio: 3450.00,
    rating: 4.7,
    stock: 10,
    badge: 'Envío Gratis',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
    variante_id: 'var-mon-sam-odyssey',
    galleryImages: [
      { id: 'img-4', url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 }
    ]
  },
  {
    id: 'aud-sony-wh1000xm5',
    sku: 'AUD-SONY-WH1000XM5',
    nombre: 'Auriculares Inalámbricos Sony WH-1000XM5 Noise Cancelling LDAC',
    categoria: 'Audio y Video',
    precio: 2650.00,
    rating: 4.9,
    stock: 18,
    badge: 'En Stock',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    variante_id: 'var-aud-sony-wh1000xm5',
    galleryImages: [
      { id: 'img-5', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 },
      { id: 'img-6', url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80', es_principal: false, orden: 2 }
    ]
  },
  {
    id: 'tec-key-k2pro',
    sku: 'TEC-KEY-K2PRO',
    nombre: 'Teclado Mecánico Inalámbrico Keychron K2 Pro QMK/VIA Custom RGB',
    categoria: 'Periféricos',
    precio: 720.00,
    rating: 4.8,
    stock: 30,
    badge: 'En Stock',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
    variante_id: 'var-tec-key-k2pro',
    galleryImages: [
      { id: 'img-7', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 }
    ]
  },
  {
    id: 'cam-log-brio4k',
    sku: 'CAM-LOG-BRIO4K',
    nombre: 'Cámara Web Profesional Logitech Brio 4K Ultra HD HDR con Windows Hello',
    categoria: 'Audio y Video',
    precio: 1150.00,
    rating: 4.6,
    stock: 12,
    badge: 'En Stock',
    image: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=800&q=80',
    variante_id: 'var-cam-log-brio4k',
    galleryImages: [
      { id: 'img-8', url: 'https://images.unsplash.com/photo-1588702547919-26089e690ecc?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 }
    ]
  },
  {
    id: 'lap-mac-m3pro',
    sku: 'LAP-MAC-M3PRO',
    nombre: 'Apple MacBook Pro 14 pulgadas Chip M3 Pro (18GB Memoria Unificada, 512GB SSD)',
    categoria: 'Laptops y PCs',
    precio: 14200.00,
    rating: 5.0,
    stock: 8,
    badge: 'Alta Gama',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    variante_id: 'var-lap-mac-m3pro',
    galleryImages: [
      { id: 'img-9', url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 }
    ]
  },
  {
    id: 'mon-lg-ultragear',
    sku: 'MON-LG-ULTRAGEAR',
    nombre: 'Monitor Gamer Curvo LG UltraGear 34 pulg WQHD 160Hz 1ms Nano IPS',
    categoria: 'Monitores',
    precio: 4100.00,
    rating: 4.9,
    stock: 6,
    badge: 'Últimas unidades',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80',
    variante_id: 'var-mon-lg-ultragear',
    galleryImages: [
      { id: 'img-10', url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80', es_principal: true, orden: 1 }
    ]
  }
];

const products = ref<MarketplaceProduct[]>([...defaultProducts]);

// Cargar categorías y productos directamente desde la base de datos Supabase
async function syncWithSupabase() {
  isSyncingCatalog.value = true;
  try {
    // 1. Cargar categorías de la base de datos
    try {
      const catRes = await apiClient.get('/v1/catalogo/categorias');
      const dbCats = Array.isArray(catRes.data) ? catRes.data : [];
      if (dbCats.length > 0) {
        const nombresUnicos = Array.from(new Set(dbCats.map((c: any) => c.nombre).filter(Boolean)));
        categories.value = ['Todos', ...nombresUnicos];
      }
    } catch (catErr) {
      console.warn('Aviso cargando categorías de la BD:', catErr);
    }

    // 2. Cargar productos y variantes con precios reales de la BD
    const res = await apiClient.get('/v1/catalogo/productos');
    const dbProducts: Producto[] = Array.isArray(res.data) ? res.data : (res.data as any)?.productos || [];

    if (dbProducts.length > 0) {
      // Filtrar productos publicados o con catálogo activo
      const productosValidos = dbProducts.filter(p => p.estado !== 'borrador');
      const listado = productosValidos.length > 0 ? productosValidos : dbProducts;

      products.value = listado.map((dbp, idx) => {
        const gallery = (dbp.imagenes_producto || []).sort((a, b) => a.orden - b.orden);
        const cover = gallery.find(i => i.es_principal) || gallery[0];
        
        // Extraer precio real de la variante o campo calculado
        const realPrice = dbp.precio !== undefined && dbp.precio !== null && Number(dbp.precio) > 0
          ? Number(dbp.precio)
          : (dbp.variantes?.[0]?.precio ? Number(dbp.variantes[0].precio) : 999.00);

        const imgUrl = cover?.url || getDefaultImageForCategory(dbp.categorias?.nombre, dbp.nombre);
        const stockUnits = dbp.estado === 'descontinuado' ? 0 : (8 + ((idx * 3) % 15));

        return {
          id: dbp.id,
          sku: dbp.sku,
          nombre: dbp.nombre,
          categoria: dbp.categorias?.nombre || 'Laptops y PCs',
          precio: realPrice,
          rating: Number((4.6 + ((idx % 4) * 0.1)).toFixed(1)),
          stock: stockUnits,
          badge: dbp.estado === 'descontinuado' 
            ? 'Últimas unidades' 
            : (idx === 0 ? 'Más Vendido' : (idx === 1 ? 'Popular' : (idx === 2 ? 'Envío Gratis' : 'En Stock'))),
          image: imgUrl,
          variante_id: dbp.variante_id || dbp.variantes?.[0]?.id,
          galleryImages: gallery
        };
      });
    }

    catalogUpdatedAt.value = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    console.warn('Aviso sincronizando productos de Supabase:', err);
  } finally {
    isSyncingCatalog.value = false;
  }
}

onMounted(() => {
  syncWithSupabase();
});

// Modal de Galería de Producto
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

const filteredProducts = computed(() => {
  return products.value.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          p.categoria.toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchesCategory = selectedCategory.value === 'Todos' || 
      p.categoria.trim().toLowerCase() === selectedCategory.value.trim().toLowerCase();
    return matchesSearch && matchesCategory;
  });
});

const inventorySummary = computed(() => {
  const units = filteredProducts.value.reduce((total, product) => total + product.stock, 0);
  return { products: filteredProducts.value.length, units };
});

function showOffers() {
  selectedCategory.value = 'Todos';
  searchQuery.value = '';
}

function refreshCatalog() {
  syncWithSupabase();
}

function agregarAlCarrito(prod: any) {
  cartStore.addItem({
    variante_id: prod.variante_id || prod.variantes?.[0]?.id || prod.id,
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
    <section class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 via-cyan-50 to-amber-100 p-7 sm:p-10 md:p-14 text-slate-950 shadow-xl shadow-teal-950/10 border border-white surface-grid">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(251,191,36,0.42),transparent_24%),radial-gradient(circle_at_20%_100%,rgba(45,212,191,0.28),transparent_32%)]" />
      <div class="relative z-10 grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-8 items-end">
        <div class="max-w-2xl space-y-5">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-teal-900 backdrop-blur-md border border-teal-200 shadow-sm">
            <Sparkles class="w-3.5 h-3.5 text-amber-600" /> Selección tecnológica curada
          </span>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">MaxiConecta marketplace</p>
          <h1 class="display-font text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.03]">
            Tecnología lista para tu próximo movimiento.
          </h1>
          <p class="max-w-xl text-slate-700 text-sm sm:text-base leading-relaxed">
            Compara equipos, encuentra disponibilidad inmediata y compra con la misma experiencia que conecta nuestras sucursales.
          </p>
          <div class="flex flex-wrap gap-3 pt-1">
            <button @click="showOffers" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-300 hover:bg-amber-200 text-slate-950 text-sm font-bold shadow-lg shadow-amber-950/20">
              Ver catálogo <ChevronRight class="w-4 h-4" />
            </button>
            <button @click="selectedCategory = 'Laptops y PCs'" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/80 hover:bg-white border border-teal-200 text-teal-900 text-sm font-semibold shadow-sm backdrop-blur-sm">
              Explorar laptops
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 max-w-sm lg:justify-self-end">
          <div class="rounded-xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur-sm">
            <span class="block text-3xl font-black text-amber-500">{{ inventorySummary.products }}</span>
            <span class="block mt-1 text-[11px] uppercase tracking-wider text-slate-600">productos visibles</span>
          </div>
          <div class="rounded-xl bg-white/80 p-4 border border-white shadow-sm backdrop-blur-sm">
            <span class="block text-3xl font-black text-teal-800">{{ inventorySummary.units }}</span>
            <span class="block mt-1 text-[11px] uppercase tracking-wider text-slate-600">unidades en stock</span>
          </div>
          <div class="col-span-2 rounded-xl bg-slate-900/85 p-4 border border-slate-900 flex items-center gap-3 shadow-lg shadow-slate-900/10">
            <ShieldCheck class="w-9 h-9 text-teal-300 shrink-0" />
            <p class="text-xs leading-relaxed text-slate-100">Precios sincronizados con catálogo y disponibilidad por sucursal.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/90 dark:bg-slate-900/90 p-4 rounded-xl border border-white shadow-lg shadow-slate-300/30 dark:border-slate-800 dark:shadow-none backdrop-blur-sm">
      <div class="flex items-center gap-3 w-full md:w-auto">
        <span class="w-10 h-10 shrink-0 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
          <Filter class="w-4 h-4" />
        </span>
        <div>
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">Encuentra tu próximo equipo</h2>
          <p class="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 soft-pulse"></span>
            {{ inventorySummary.products }} resultados · Catálogo sincronizado {{ catalogUpdatedAt }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 w-full md:w-auto">
        <div class="relative w-full md:w-80">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nombre, marca o SKU..."
          class="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        </div>
        <button
          type="button"
          class="shrink-0 w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-200 text-slate-500 hover:text-teal-700 flex items-center justify-center"
          :title="isSyncingCatalog ? 'Actualizando catálogo' : 'Actualizar catálogo'"
          :disabled="isSyncingCatalog"
          @click="refreshCatalog"
        >
          <RefreshCw :class="['w-4 h-4', isSyncingCatalog ? 'animate-spin' : '']" />
        </button>
      </div>

      <!-- Píldoras de Categorías -->
      <div class="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
        <button
          v-for="cat in categories"
          :key="cat"
          @click="selectedCategory = cat"
          :class="[
            'px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
            selectedCategory === cat
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          ]"
        >
          {{ cat }}
        </button>
      </div>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-3 px-1 text-[11px] text-slate-500">
      <span class="inline-flex items-center gap-1.5"><Clock3 class="w-3.5 h-3.5 text-teal-600" /> Inventario y precios conectados al gateway</span>
      <span class="font-semibold text-slate-700">Categoría activa: {{ selectedCategory }}</span>
    </div>

    <!-- Grid de Productos -->
    <section v-if="filteredProducts.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <article
        v-for="prod in filteredProducts"
        :key="prod.id"
        class="reveal-up group flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-900/10 transition-all duration-300"
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
              'absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 hover:bg-white shadow-sm backdrop-blur-sm transition-colors',
              wishlistStore.estaEnDeseos(prod.id) ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
            ]"
            :title="wishlistStore.estaEnDeseos(prod.id) ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos'"
            @click="alternarDeseo(prod)"
          >
            <Heart :class="['w-5 h-5', wishlistStore.estaEnDeseos(prod.id) ? 'fill-current' : '']" />
          </button>
          
          <span class="absolute top-2.5 left-2.5 bg-teal-700/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
            {{ prod.badge }}
          </span>

          <!-- Indicador de Galería si tiene más fotos -->
          <button
            v-if="prod.galleryImages && prod.galleryImages.length > 0"
            @click="openProductGallery(prod)"
            class="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/80 text-white text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm shadow"
            title="Ver galería completa"
          >
            <Layers class="w-3 h-3 text-cyan-400" />
            <span>{{ prod.galleryImages.length }} fotos</span>
          </button>

          <div class="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-sm">
            <Star class="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>{{ prod.rating }}</span>
          </div>
        </div>

        <!-- Contenido -->
        <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <span class="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              {{ prod.categoria }}
            </span>
            <h3 
              @click="openProductGallery(prod)"
              class="font-semibold text-sm line-clamp-2 text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors cursor-pointer"
            >
              {{ prod.nombre }}
            </h3>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5">SKU: {{ prod.sku }}</p>
          </div>

          <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span class="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Precio oficial</span>
              <DualCurrencyPrice :price="prod.precio" size="sm" layout="stacked" />
            </div>
            <button
              @click="agregarAlCarrito(prod)"
              class="p-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-sm active:scale-95 transition-all"
              title="Añadir al carrito"
            >
              <ShoppingBag class="w-4 h-4" />
            </button>
          </div>
        </div>
      </article>
    </section>

    <section v-else class="py-16 text-center bg-white/80 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <Search class="w-10 h-10 mx-auto text-slate-300" />
      <h2 class="mt-4 text-lg font-bold text-slate-800 dark:text-white">No encontramos coincidencias</h2>
      <p class="mt-1 text-sm text-slate-500">Prueba con otra categoría o restablece tu búsqueda.</p>
      <button @click="showOffers" class="mt-5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold">Ver todo el catálogo</button>
    </section>

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
            <span class="text-xs text-slate-400 font-mono">SKU: {{ activeGalleryProduct.sku }}</span>
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
                ? 'border-blue-600 ring-2 ring-blue-500/20 scale-105'
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
            <span class="text-xl font-extrabold text-blue-600 dark:text-blue-400">
              BOB {{ activeGalleryProduct.precio.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}
            </span>
          </div>
          <button
            @click="agregarAlCarrito(activeGalleryProduct); activeGalleryProduct = null"
            class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2"
          >
            <ShoppingBag class="w-4 h-4" />
            <span>Añadir al Carrito</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
