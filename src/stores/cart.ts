import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { ItemCarrito, ReservaStockResponse, ReservaStockStatus, CheckoutPayload } from '@/types';
import { apiClient } from '@/api/client';
import { consultarStock } from '@/api/catalogo';

const STORAGE_KEY_ITEMS = 'maxiconecta_cart_items';
const STORAGE_KEY_RESERVA = 'maxiconecta_checkout_reserva';

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

  // Inicializar carrito desde localStorage para persistencia (RF-13)
  function loadSavedCart(): ItemCarrito[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  const items = ref<ItemCarrito[]>(loadSavedCart());

  // Sincronizar cambios del carrito con localStorage
  watch(
    items,
    (newItems) => {
      try {
        localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(newItems));
      } catch (e) {
        console.warn('Error guardando carrito en localStorage:', e);
      }
    },
    { deep: true }
  );
  const cupon = ref<string | null>(null);

  // Estados de Reserva de Stock Temporal (RF-14 · RIO-INV-02)
  const isCheckoutModalOpen = ref(false);
  const isReserving = ref(false);
  const isProcessingOrder = ref(false);
  const reservaId = ref<string | null>(null);
  const reservaSecondsLeft = ref(900); // 15 minutos en segundos
  const reservaTotalSeconds = ref(900);
  const reservaStatus = ref<ReservaStockStatus>('idle');
  const reservaError = ref<string | null>(null);
  const lastReservaData = ref<ReservaStockResponse | null>(null);
  const lastCreatedOrderCode = ref<string | null>(null);
  const lastEmittedInvoice = ref<any | null>(null);
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  const itemCount = computed(() => items.value.reduce((acc, curr) => acc + curr.cantidad, 0));
  const subtotal = computed(() => items.value.reduce((acc, curr) => acc + curr.total_linea, 0));

  // Descuento reactivo según el cupón activo (RF-17)
  const descuento = computed(() => {
    if (!cupon.value) return 0;
    const clean = cupon.value.toUpperCase();
    if (clean === 'MAXI10') return subtotal.value * 0.10;
    if (clean === 'BIENVENIDO') return subtotal.value * 0.15;
    if (clean === 'VIP20') return subtotal.value * 0.20;
    return 0;
  });

  const total = computed(() => Math.max(0, subtotal.value - descuento.value));

  // Formato visual MM:SS para el contador regresivo
  const formattedTimeLeft = computed(() => {
    const totalSecs = Math.max(0, reservaSecondsLeft.value);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  // Porcentaje restante para la barra de progreso
  const timerProgressPercent = computed(() => {
    if (reservaTotalSeconds.value <= 0) return 0;
    return Math.max(0, Math.min(100, (reservaSecondsLeft.value / reservaTotalSeconds.value) * 100));
  });

  // Indicadores de urgencia de tiempo
  const isUrgentTimer = computed(() => reservaSecondsLeft.value <= 120 && reservaStatus.value === 'activa');
  const isWarningTimer = computed(() => reservaSecondsLeft.value > 120 && reservaSecondsLeft.value <= 300 && reservaStatus.value === 'activa');

  function openDrawer() {
    isDrawerOpen.value = true;
  }

  function closeDrawer() {
    isDrawerOpen.value = false;
  }

  function toggleDrawer() {
    isDrawerOpen.value = !isDrawerOpen.value;
  }

  function quantityForSku(sku: string) {
    return items.value.filter(i => i.sku === sku).reduce((total, i) => total + i.cantidad, 0);
  }

  function addItem(item: Omit<ItemCarrito, 'total_linea'>): boolean {
    error.value = '';
    if (!Number.isInteger(item.stock_disponible) || item.stock_disponible! < 0) {
      error.value = 'No se puede agregar el producto porque su stock no está verificado.';
      isDrawerOpen.value = true;
      return false;
    }

    const existing = items.value.find(i => i.variante_id === item.variante_id);
    if (quantityForSku(item.sku) + item.cantidad > item.stock_disponible!) {
      error.value = item.stock_disponible === 0
        ? `${item.nombre} está agotado.`
        : `Stock insuficiente. Solo hay ${item.stock_disponible} unidad(es) disponibles y ya tienes ${quantityForSku(item.sku)} en el carrito.`;
      isDrawerOpen.value = true;
      return false;
    }

    items.value.filter(i => i.sku === item.sku).forEach(i => { i.stock_disponible = item.stock_disponible; });
    if (existing) {
      existing.cantidad += item.cantidad;
      existing.total_linea = existing.cantidad * existing.precio_unitario;
    } else {
      items.value.push({
        ...item,
        total_linea: item.cantidad * item.precio_unitario
      });
    }
    isDrawerOpen.value = true;
    return true;
  }

  function removeItem(varianteId: string) {
    items.value = items.value.filter(i => i.variante_id !== varianteId);
  }

  function canIncrease(item: ItemCarrito) {
    return item.stock_disponible !== undefined && quantityForSku(item.sku) < item.stock_disponible;
  }

  async function refreshStock() {
    const skus = [...new Set(items.value.map(i => i.sku))];
    await Promise.allSettled(skus.map(async sku => {
      const stock = await consultarStock(sku);
      items.value.filter(i => i.sku === sku).forEach(i => { i.stock_disponible = stock.stock_disponible; });
    }));
  }

  function updateQuantity(varianteId: string, delta: number) {
    const item = items.value.find(i => i.variante_id === varianteId);
    if (item) {
      error.value = '';
      if (delta > 0 && !canIncrease(item)) {
        error.value = item.stock_disponible === undefined
          ? 'Verificando stock del producto, inténtalo nuevamente.'
          : `Stock máximo alcanzado: ${item.stock_disponible} unidad(es).`;
        if (item.stock_disponible === undefined) void refreshStock();
        return;
      }
      item.cantidad += delta;
      if (item.cantidad <= 0) {
        removeItem(varianteId);
      } else {
        item.total_linea = item.cantidad * item.precio_unitario;
      }
    }
  }

  function aplicarCupon(codigo: string): { ok: boolean; mensaje: string } {
    const clean = codigo.trim().toUpperCase();
    if (clean === 'MAXI10') {
      cupon.value = 'MAXI10';
      return { ok: true, mensaje: 'Cupón MAXI10 aplicado: 10% de descuento.' };
    }
    if (clean === 'BIENVENIDO') {
      cupon.value = 'BIENVENIDO';
      return { ok: true, mensaje: 'Cupón BIENVENIDO aplicado: 15% de descuento.' };
    }
    if (clean === 'VIP20') {
      cupon.value = 'VIP20';
      return { ok: true, mensaje: 'Cupón VIP20 aplicado: 20% de descuento.' };
    }
    return { ok: false, mensaje: 'Código de cupón no válido o vencido.' };
  }

  function loadCart() {
    // Sincronizado localmente desde localStorage
  }

  function removerCupon() {
    cupon.value = null;
  }

  // ---------------------------------------------------------------------------
  // Lógica de Reserva Temporal de Stock y Persistencia F5 (RF-14 · RIO-INV-02)
  // ---------------------------------------------------------------------------

  function guardarSesionReserva(id: string, ttl: number, data: ReservaStockResponse) {
    try {
      sessionStorage.setItem(STORAGE_KEY_RESERVA, JSON.stringify({
        reservaId: id,
        expiraEnTimestamp: Date.now() + (ttl * 1000),
        totalSeconds: ttl,
        lastData: data
      }));
    } catch (e) {
      console.warn('Error guardando sesión de checkout en sessionStorage:', e);
    }
  }

  function limpiarSesionReserva() {
    try {
      sessionStorage.removeItem(STORAGE_KEY_RESERVA);
    } catch {
      // ignore
    }
  }

  function iniciarTemporizador(segundos: number) {
    detenerTemporizador();
    reservaTotalSeconds.value = segundos;
    reservaSecondsLeft.value = segundos;

    timerInterval = setInterval(() => {
      if (reservaSecondsLeft.value > 0) {
        reservaSecondsLeft.value--;
      } else {
        detenerTemporizador();
        reservaStatus.value = 'expirada';
        limpiarSesionReserva();
      }
    }, 1000);
  }

  function detenerTemporizador() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  async function recuperarReservaActiva() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_RESERVA);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const now = Date.now();
      const secondsLeft = Math.floor((saved.expiraEnTimestamp - now) / 1000);

      if (secondsLeft > 0 && items.value.length > 0) {
        reservaId.value = saved.reservaId;
        reservaTotalSeconds.value = saved.totalSeconds || 900;
        reservaSecondsLeft.value = secondsLeft;
        reservaStatus.value = 'activa';
        lastReservaData.value = saved.lastData || null;
        iniciarTemporizador(secondsLeft);
        isCheckoutModalOpen.value = true;

        // Opcionalmente validar con el backend para sincronizar segundos exactos de Redis
        try {
          const res = await apiClient.get<{ reserva_id: string; segundos_restantes: number; estado: string }>(
            `/api/v1/carrito/checkout/reserva/${saved.reservaId}`
          );
          if (res.data && res.data.estado === 'ACTIVA') {
            const ttlServer = res.data.segundos_restantes;
            if (ttlServer > 0) {
              iniciarTemporizador(ttlServer);
            }
          } else {
            detenerTemporizador();
            reservaStatus.value = 'expirada';
            limpiarSesionReserva();
          }
        } catch {
          // Si el backend no responde, se mantiene el tiempo calculado localmente
        }
      } else {
        limpiarSesionReserva();
      }
    } catch {
      limpiarSesionReserva();
    }
  }

  async function iniciarCheckoutConReserva(clienteId: string = 'cliente-anonimo') {
    if (items.value.length === 0) return;

    isReserving.value = true;
    reservaError.value = null;
    reservaStatus.value = 'reservando';

    try {
      // Una reserva anterior de esta sesión retiene unidades: se libera antes de volver a reservar.
      if (reservaId.value) {
        await apiClient.post(`/api/v1/carrito/checkout/reserva/${reservaId.value}/cancelar`, {}).catch(() => undefined);
        reservaId.value = null;
        limpiarSesionReserva();
      }

      await refreshStock();
      for (const sku of new Set(items.value.map(i => i.sku))) {
        const line = items.value.find(i => i.sku === sku)!;
        if (quantityForSku(sku) > (line.stock_disponible ?? 0)) {
          throw new Error(`Stock insuficiente para ${line.nombre}. Disponibles: ${line.stock_disponible ?? 0}.`);
        }
      }

      const cartUrl = `/api/v1/carrito/${encodeURIComponent(sessionId.value)}`;
      const remoteCart = await apiClient.get(cartUrl);
      for (const remoteItem of remoteCart.data.items || []) {
        await apiClient.delete(`${cartUrl}/items/${encodeURIComponent(remoteItem.variante_id)}`);
      }
      for (const item of items.value) {
        await apiClient.post(`${cartUrl}/items`, {
          variante_id: item.variante_id,
          sku: item.sku,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        });
      }

      const response = await apiClient.post<ReservaStockResponse>(
        `${cartUrl}/checkout/iniciar`,
        {
          cliente_id: clienteId,
          tipo_despacho: 'domicilio',
          metodo_pago: 'qr'
        }
      );

      const data = response.data;
      reservaId.value = data.reserva_id;
      lastReservaData.value = data;
      reservaStatus.value = 'activa';
      
      const ttl = data.ttl_expira_en_segundos || 900;
      iniciarTemporizador(ttl);
      guardarSesionReserva(data.reserva_id, ttl, data);

      isDrawerOpen.value = false;
      isCheckoutModalOpen.value = true;
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'No fue posible verificar ni reservar el stock.';
      reservaStatus.value = 'error';
      reservaError.value = message;
      error.value = message;
    } finally {
      isReserving.value = false;
    }
  }

  async function renovarReserva(clienteId: string = 'cliente-anonimo') {
    detenerTemporizador();
    limpiarSesionReserva();
    reservaStatus.value = 'idle';
    await iniciarCheckoutConReserva(clienteId);
  }

  async function cancelarReserva() {
    detenerTemporizador();
    limpiarSesionReserva();
    const idToCancel = reservaId.value;

    if (idToCancel) {
      try {
        await apiClient.post(`/api/v1/carrito/checkout/reserva/${idToCancel}/cancelar`, {});
      } catch (e) {
        // Fallback silencioso si el backend no responde
      }
    }

    reservaId.value = null;
    reservaStatus.value = 'idle';
    reservaError.value = null;
    isCheckoutModalOpen.value = false;
  }

  async function finalizarOrdenConReserva(payload: CheckoutPayload, clienteId: string = 'cliente-anonimo') {
    if (reservaStatus.value === 'expirada') {
      throw new Error('La reserva de stock ha expirado. Por favor, renuévala.');
    }

    isProcessingOrder.value = true;

    try {
      const orderPayload = {
        cliente_id: clienteId,
        canal: 'web',
        tipo_despacho: payload.tipo_despacho,
        metodo_pago: payload.metodo_pago,
        sucursal_id: payload.sucursal_id,
        direccion_entrega_id: payload.direccion_entrega || 'Dirección principal',
        subtotal: subtotal.value,
        descuento: descuento.value,
        costo_envio: payload.costo_envio,
        total: total.value + payload.costo_envio,
        reserva_id: reservaId.value,
        datos_fiscales: payload.datos_fiscales,
        items: items.value.map(i => ({
          variante_id: i.variante_id,
          sku: i.sku,
          nombre_producto: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario
        }))
      };

      let orderCode = '';

      try {
        const resp = await apiClient.post('/api/v1/ordenes/', orderPayload);
        orderCode = resp.data?.codigo_orden || resp.data?.codigo || String(resp.data?.id || '');
        if (resp.data?.factura) {
          lastEmittedInvoice.value = resp.data.factura;
        } else if (resp.data?.cuf_factura) {
          lastEmittedInvoice.value = {
            cuf: resp.data.cuf_factura,
            numero_factura: resp.data.numero_factura,
            total: total.value + payload.costo_envio,
            codigo_qr: `https://pilotosiat.impuestos.gob.bo/consulta/QR?nit=1028374029&cuf=${resp.data.cuf_factura}&numero=${resp.data.numero_factura || 1001}&t=${(total.value + payload.costo_envio).toFixed(2)}`,
            datos_comprador: {
              nit_ci: payload.datos_fiscales?.nit_ci || '0',
              razon_social: payload.datos_fiscales?.razon_social || 'CONSUMIDOR FINAL'
            }
          };
        }
      } catch (err: any) {
        throw new Error(err.response?.data?.detail || 'No se pudo registrar la orden. Tu reserva sigue activa, inténtalo nuevamente.');
      }

      lastCreatedOrderCode.value = orderCode;
      detenerTemporizador();
      limpiarSesionReserva();
      reservaStatus.value = 'confirmada';
      
      // Vaciar carrito tras venta exitosa y limpiar storage
      items.value = [];
      cupon.value = null;
      try {
        localStorage.removeItem(STORAGE_KEY_ITEMS);
      } catch {}

      return orderCode;
    } finally {
      isProcessingOrder.value = false;
    }
  }

  // Recuperar sesión activa al inicializar el store
  recuperarReservaActiva();

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
    canIncrease,
    refreshStock,
    aplicarCupon,
    removerCupon,
    // Stock reservation state & methods
    isCheckoutModalOpen,
    isReserving,
    isProcessingOrder,
    reservaId,
    reservaSecondsLeft,
    reservaTotalSeconds,
    reservaStatus,
    reservaError,
    lastReservaData,
    lastCreatedOrderCode,
    lastEmittedInvoice,
    formattedTimeLeft,
    timerProgressPercent,
    isUrgentTimer,
    isWarningTimer,
    iniciarCheckoutConReserva,
    iniciarTemporizador,
    detenerTemporizador,
    renovarReserva,
    cancelarReserva,
    finalizarOrdenConReserva,
    recuperarReservaActiva
  };
});
