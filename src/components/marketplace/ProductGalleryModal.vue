<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MarketplaceProduct } from '@/types';
import { X, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-vue-next';

const props = defineProps<{
  product: MarketplaceProduct | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'addToCart', product: MarketplaceProduct): void;
}>();

const currentIndex = ref(0);

// Reiniciar índice cuando cambia el producto activo
watch(() => props.product, () => {
  currentIndex.value = 0;
});

const currentImage = computed<string | undefined>(() => {
  if (!props.product) return undefined;
  const imgs = props.product.galleryImages;
  if (!imgs || imgs.length === 0) return props.product.image;
  return imgs[currentIndex.value]?.url || props.product.image;
});

function prevImage() {
  if (!props.product || !props.product.galleryImages.length) return;
  const len = props.product.galleryImages.length;
  currentIndex.value = (currentIndex.value - 1 + len) % len;
}

function nextImage() {
  if (!props.product || !props.product.galleryImages.length) return;
  const len = props.product.galleryImages.length;
  currentIndex.value = (currentIndex.value + 1) % len;
}

function handleAddToCart() {
  if (props.product) {
    emit('addToCart', props.product);
    emit('close');
  }
}
</script>

<template>
  <div
    v-if="product"
    class="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header del Modal -->
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">{{ product.nombre }}</h3>
          <span class="text-xs text-slate-400 font-mono">SKU: {{ product.sku }} · {{ product.categoria }}</span>
        </div>
        <button @click="$emit('close')" class="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Imagen Principal Seleccionada -->
      <div class="relative bg-slate-950 flex items-center justify-center h-80 overflow-hidden">
        <img
          :src="currentImage"
          :alt="product.nombre"
          class="max-h-full max-w-full object-contain"
        />

        <!-- Botones de Navegación si hay múltiples imágenes -->
        <button
          v-if="product.galleryImages && product.galleryImages.length > 1"
          @click="prevImage"
          class="absolute left-3 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
          title="Foto anterior"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <button
          v-if="product.galleryImages && product.galleryImages.length > 1"
          @click="nextImage"
          class="absolute right-3 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
          title="Siguiente foto"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>

      <!-- Tira de Miniaturas (Thumbnails) -->
      <div
        v-if="product.galleryImages && product.galleryImages.length > 0"
        class="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto"
      >
        <button
          v-for="(img, idx) in product.galleryImages"
          :key="img.id"
          @click="currentIndex = idx"
          :class="[
            'w-16 h-16 rounded-xl border-2 overflow-hidden shrink-0 transition-all',
            currentIndex === idx
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
            BOB {{ product.precio.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}
          </span>
        </div>
        <button
          @click="handleAddToCart"
          class="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-colors active:scale-95"
          :disabled="product.stock <= 0"
        >
          <ShoppingBag class="w-4 h-4" />
          <span>Añadir al Carrito</span>
        </button>
      </div>
    </div>
  </div>
</template>
