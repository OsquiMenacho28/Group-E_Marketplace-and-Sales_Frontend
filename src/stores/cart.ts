import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Carrito, ItemCarrito } from '@/types';
import { apiClient } from '@/api/client';

function cartSessionId() {
  const key = 'maxiconecta_cart_session';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const sessionId = `guest-${crypto.randomUUID()}`;
  localStorage.setItem(key, sessionId);
  return sessionId;
}

export const useCartStore = defineStore('cart', () => {
  const sessionId = ref(cartSessionId());
  const isDrawerOpen = ref(false);
  const isLoading = ref(false);
  const error = ref('');
  const items = ref<ItemCarrito[]>([]);
  const cupon = ref<string | null>(null);
  const descuento = ref(0);

  const itemCount = computed(() => items.value.reduce((total, item) => total + item.cantidad, 0));
  const subtotal = computed(() => items.value.reduce((total, item) => total + item.total_linea, 0));
  const total = computed(() => Math.max(0, subtotal.value - descuento.value));

  function applyCart(cart: Carrito) {
    items.value = cart.items;
    cupon.value = cart.cupon_codigo || null;
    descuento.value = Number(cart.descuento_cupon || 0);
  }

  async function loadCart() {
    isLoading.value = true;
    error.value = '';
    try {
      const response = await apiClient.get<Carrito>(`/api/v1/carrito/${sessionId.value}`);
      applyCart(response.data);
    } catch {
      error.value = 'No fue posible sincronizar tu carrito.';
    } finally {
      isLoading.value = false;
    }
  }

  function openDrawer() {
    isDrawerOpen.value = true;
    void loadCart();
  }

  function closeDrawer() {
    isDrawerOpen.value = false;
  }

  function toggleDrawer() {
    if (isDrawerOpen.value) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  async function addItem(item: Omit<ItemCarrito, 'total_linea'>) {
    isLoading.value = true;
    error.value = '';
    try {
      const response = await apiClient.post<Carrito>(`/api/v1/carrito/${sessionId.value}/items`, item);
      applyCart(response.data);
      isDrawerOpen.value = true;
    } catch {
      error.value = 'No fue posible agregar el producto al carrito.';
    } finally {
      isLoading.value = false;
    }
  }

  async function removeItem(varianteId: string) {
    isLoading.value = true;
    try {
      const response = await apiClient.delete<Carrito>(`/api/v1/carrito/${sessionId.value}/items/${varianteId}`);
      applyCart(response.data);
    } catch {
      error.value = 'No fue posible quitar el producto.';
    } finally {
      isLoading.value = false;
    }
  }

  async function updateQuantity(varianteId: string, delta: number) {
    const item = items.value.find((entry) => entry.variante_id === varianteId);
    if (!item) return;
    if (item.cantidad + delta <= 0) {
      await removeItem(varianteId);
      return;
    }
    isLoading.value = true;
    try {
      const response = await apiClient.put<Carrito>(`/api/v1/carrito/${sessionId.value}/items/${varianteId}`, { cantidad: item.cantidad + delta });
      applyCart(response.data);
    } catch {
      error.value = 'No fue posible actualizar la cantidad.';
    } finally {
      isLoading.value = false;
    }
  }

  async function aplicarCupon(codigo: string) {
    error.value = '';
    try {
      const response = await apiClient.post<Carrito>(`/api/v1/carrito/${sessionId.value}/cupon`, { codigo });
      applyCart(response.data);
      return true;
    } catch {
      error.value = 'Cupón inválido o vencido.';
      return false;
    }
  }

  return {
    sessionId,
    isDrawerOpen,
    isLoading,
    error,
    items,
    cupon,
    descuento,
    itemCount,
    subtotal,
    total,
    loadCart,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    addItem,
    removeItem,
    updateQuantity,
    aplicarCupon,
  };
});
