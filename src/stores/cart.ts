import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { ItemCarrito, ReservaStockResponse, ReservaStockStatus, CheckoutPayload } from '@/types';
import { apiClient } from '@/api/client';

const STORAGE_KEY_ITEMS = 'maxiconecta_cart_items';
const STORAGE_KEY_RESERVA = 'maxiconecta_checkout_reserva';

export const useCartStore = defineStore('cart', () => {
  const isDrawerOpen = ref(false);
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

  function toggleDrawer() {
    isDrawerOpen.value = !isDrawerOpen.value;
  }

  function addItem(item: Omit<ItemCarrito, 'total_linea'>) {
    const existing = items.value.find(i => i.variante_id === item.variante_id);
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
  }

  function removeItem(varianteId: string) {
    items.value = items.value.filter(i => i.variante_id !== varianteId);
  }

  function updateQuantity(varianteId: string, delta: number) {
    const item = items.value.find(i => i.variante_id === varianteId);
    if (item) {
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
      const response = await apiClient.post<ReservaStockResponse>(
        `/api/v1/carrito/${clienteId}/checkout/iniciar`,
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
      console.warn('API Gateway offline o error de red. Activando modo mock local para reserva:', err);
      
      if (err.response?.status === 409) {
        reservaStatus.value = 'error';
        reservaError.value = err.response?.data?.detail || 'Stock insuficiente para uno o más productos del carrito.';
        return;
      }

      const mockId = `RES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      reservaId.value = mockId;
      const mockData: ReservaStockResponse = {
        reserva_id: mockId,
        ttl_expira_en_segundos: 900,
        monto_total: total.value,
        metodo_pago: 'qr',
        status: 'RESERVA_CONFIRMADA'
      };
      lastReservaData.value = mockData;
      reservaStatus.value = 'activa';
      iniciarTemporizador(900);
      guardarSesionReserva(mockId, 900, mockData);

      isDrawerOpen.value = false;
      isCheckoutModalOpen.value = true;
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
        items: items.value.map(i => ({
          variante_id: i.variante_id,
          sku: i.sku,
          nombre_producto: i.nombre,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario
        }))
      };

      let orderCode = `ORD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      try {
        const resp = await apiClient.post('/api/v1/ordenes/', orderPayload);
        if (resp.data?.codigo_orden) {
          orderCode = resp.data.codigo_orden;
        }
      } catch (err) {
        console.warn('Backend órdenes no disponible, usando código generado localmente:', orderCode);
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
    isDrawerOpen,
    items,
    cupon,
    descuento,
    itemCount,
    subtotal,
    total,
    toggleDrawer,
    addItem,
    removeItem,
    updateQuantity,
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
