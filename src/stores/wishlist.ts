import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WishlistItem } from '@/types';
import { apiClient } from '@/api/client';
import { useCartStore } from '@/stores/cart';
import { consultarStock } from '@/api/catalogo';

const STORAGE_KEY_WISHLIST = 'maxiconecta_wishlist_items';

function isValidUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function loadSavedWishlist(): WishlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WISHLIST);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useWishlistStore = defineStore('wishlist', () => {
  const items = ref<WishlistItem[]>(loadSavedWishlist());
  const loading = ref(false);
  const error = ref<string | null>(null);

  const itemCount = computed(() => items.value.length);

  function persistirLocal() {
    try {
      localStorage.setItem(STORAGE_KEY_WISHLIST, JSON.stringify(items.value));
    } catch (err) {
      console.warn('Error guardando lista de deseos localmente:', err);
    }
  }

  /**
   * RF-21: Carga la lista de deseos desde el backend para un cliente autenticado,
   * combinándola con los ítems existentes.
   */
  async function cargarDeseos(clienteId?: string) {
    if (!clienteId || !isValidUuid(clienteId)) {
      items.value = loadSavedWishlist();
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.get<WishlistItem[]>(
        `/api/v1/carrito/${clienteId}/deseos`
      );

      if (Array.isArray(response.data)) {
        // Enriquecer y sincronizar con los items locales
        const remoteItems = response.data;
        const localMap = new Map(items.value.map(i => [i.variante_id, i]));

        const merged: WishlistItem[] = remoteItems.map(remote => {
          const local = localMap.get(remote.variante_id);
          return {
            ...remote,
            nombre: remote.nombre || local?.nombre || 'Producto Favorito',
            sku: remote.sku || local?.sku || 'SKU-ITEM',
            precio: remote.precio !== undefined ? Number(remote.precio) : (local?.precio ?? 0),
            imagen_url: remote.imagen_url || local?.imagen_url || '',
          };
        });

        // Mantener items locales agregados recientemente que no estén en remoto
        for (const localItem of items.value) {
          if (!merged.some(m => m.variante_id === localItem.variante_id)) {
            merged.push(localItem);
          }
        }

        items.value = merged;
        persistirLocal();
      }
    } catch (err) {
      console.warn('No se pudo cargar la lista de deseos del servidor, usando local:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * RF-21: Agrega un producto a la lista de deseos de forma reactiva e inmediata.
   */
  async function agregarDeseo(
    producto: {
      id: string;
      sku?: string;
      nombre?: string;
      precio?: number;
      image?: string;
      variante_id?: string;
    },
    clienteId?: string
  ): Promise<boolean> {
    error.value = null;
    const varianteId = producto.variante_id || producto.id;

    if (estaEnDeseos(varianteId)) {
      return true;
    }

    const nuevoItem: WishlistItem = {
      id: crypto.randomUUID(),
      cliente_id: clienteId,
      variante_id: varianteId,
      sku: producto.sku || 'SKU-FAV',
      nombre: producto.nombre || 'Producto Favorito',
      precio: producto.precio ?? 0,
      imagen_url: producto.image || '',
      created_at: new Date().toISOString()
    };

    items.value.unshift(nuevoItem);
    persistirLocal();

    if (clienteId && isValidUuid(clienteId)) {
      try {
        const response = await apiClient.post<WishlistItem>(
          `/api/v1/carrito/${clienteId}/deseos`,
          { variante_id: varianteId }
        );
        if (response.data?.id) {
          nuevoItem.id = response.data.id;
          persistirLocal();
        }
      } catch (err) {
        console.warn('Guardado local exitoso, error al sincronizar con backend:', err);
      }
    }

    return true;
  }

  /**
   * RF-21: Elimina un producto de la lista de deseos.
   */
  async function eliminarDeseo(varianteId: string, clienteId?: string): Promise<boolean> {
    error.value = null;
    items.value = items.value.filter(item => item.variante_id !== varianteId);
    persistirLocal();

    if (clienteId && isValidUuid(clienteId)) {
      try {
        await apiClient.delete(`/api/v1/carrito/${clienteId}/deseos/${varianteId}`);
      } catch (err) {
        console.warn('Eliminado local exitoso, no se pudo sincronizar con backend:', err);
      }
    }

    return true;
  }

  /**
   * Alterna el estado de un producto (agregar si no está, quitar si ya está).
   */
  async function alternarDeseo(producto: any, clienteId?: string): Promise<boolean> {
    const varianteId = producto.variante_id || producto.id;
    if (estaEnDeseos(varianteId)) {
      await eliminarDeseo(varianteId, clienteId);
      return false; // Ahora no está en la lista
    } else {
      await agregarDeseo(producto, clienteId);
      return true; // Ahora está en la lista
    }
  }

  /**
   * US-21: Mover un producto individual de la lista de deseos al carrito.
   */
  async function moverAlCarrito(varianteId: string, clienteId?: string): Promise<boolean> {
    const item = items.value.find(i => i.variante_id === varianteId);
    if (!item) return false;

    const cartStore = useCartStore();
    try {
      const sku = item.sku || '';
      const stock = await consultarStock(sku);
      const added = cartStore.addItem({
        variante_id: item.variante_id,
        sku,
        nombre: item.nombre || 'Producto',
        cantidad: 1,
        precio_unitario: item.precio || 0,
        stock_disponible: stock.stock_disponible
      });
      if (!added) return false;
    } catch {
      cartStore.error = `No se pudo verificar el stock de ${item.nombre || 'este producto'}.`;
      cartStore.openDrawer();
      return false;
    }

    eliminarDeseo(varianteId, clienteId);
    return true;
  }

  /**
   * US-21 / Criterio de Aceptación:
   * Acción masiva "Mover todos al Carrito".
   */
  async function moverTodosAlCarrito(clienteId?: string): Promise<number> {
    if (items.value.length === 0) return 0;

    let count = 0;
    for (const item of [...items.value]) {
      if (await moverAlCarrito(item.variante_id, clienteId)) count++;
    }

    return count;
  }

  function estaEnDeseos(varianteId: string): boolean {
    return items.value.some(item => item.variante_id === varianteId);
  }

  function vaciarLista(clienteId?: string) {
    const todos = [...items.value];
    items.value = [];
    persistirLocal();

    if (clienteId && isValidUuid(clienteId)) {
      for (const item of todos) {
        apiClient.delete(`/api/v1/carrito/${clienteId}/deseos/${item.variante_id}`).catch(() => {});
      }
    }
  }

  return {
    items,
    loading,
    error,
    itemCount,
    cargarDeseos,
    agregarDeseo,
    eliminarDeseo,
    alternarDeseo,
    moverAlCarrito,
    moverTodosAlCarrito,
    estaEnDeseos,
    vaciarLista
  };
});