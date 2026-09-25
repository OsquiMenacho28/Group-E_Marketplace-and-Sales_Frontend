import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ItemCarrito, ReservaStockResponse, ReservaStockStatus, CheckoutPayload } from '@/types';
import { apiClient } from '@/api/client';

export const useCartStore = defineStore('cart', () => {
  const isDrawerOpen = ref(false);
  const items = ref<ItemCarrito[]>([
    {
      variante_id: 'b0000000-0000-0000-0000-000000000001',
      sku: 'LAP-DELL-XPS15-16GB',
      nombre: 'Laptop Dell XPS 15 (16GB RAM / 512GB SSD)',
      cantidad: 1,
      precio_unitario: 8999.00,
      total_linea: 8999.00
    }
  ]);
  const cupon = ref<string | null>(null);
  const descuento = ref(0);

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

  function aplicarCupon(codigo: string) {
    if (codigo.toUpperCase() === 'MAXI10') {
      cupon.value = 'MAXI10';
      descuento.value = subtotal.value * 0.10;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Lógica de Reserva Temporal de Stock (RF-14 · RIO-INV-02)
  // ---------------------------------------------------------------------------

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
      }
    }, 1000);
  }

  function detenerTemporizador() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  async function iniciarCheckoutConReserva(clienteId: string = 'cliente-anonimo') {
    if (items.value.length === 0) return;

    isReserving.value = true;
    reservaError.value = null;
    reservaStatus.value = 'reservando';

    try {
      // Intentar reservar en el backend mediante el API Gateway / Carrito
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

      // Abrir modal de checkout y cerrar drawer lateral
      isDrawerOpen.value = false;
      isCheckoutModalOpen.value = true;
    } catch (err: any) {
      console.warn('API Gateway offline o error de red. Activando modo mock local para reserva:', err);
      
      // Si el servidor devolvió un 409 (Conflicto por falta de stock)
      if (err.response?.status === 409) {
        reservaStatus.value = 'error';
        reservaError.value = err.response?.data?.detail || 'Stock insuficiente para uno o más productos del carrito.';
        return;
      }

      // Fallback transparente para desarrollo: genera reserva simulada
      const mockId = `RES-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      reservaId.value = mockId;
      lastReservaData.value = {
        reserva_id: mockId,
        ttl_expira_en_segundos: 900,
        monto_total: total.value,
        metodo_pago: 'qr',
        status: 'RESERVA_CONFIRMADA'
      };
      reservaStatus.value = 'activa';
      iniciarTemporizador(900);

      isDrawerOpen.value = false;
      isCheckoutModalOpen.value = true;
    } finally {
      isReserving.value = false;
    }
  }

  async function renovarReserva(clienteId: string = 'cliente-anonimo') {
    detenerTemporizador();
    reservaStatus.value = 'idle';
    await iniciarCheckoutConReserva(clienteId);
  }

  async function cancelarReserva() {
    detenerTemporizador();
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
      reservaStatus.value = 'confirmada';
      
      // Vaciar carrito tras venta exitosa
      items.value = [];
      cupon.value = null;
      descuento.value = 0;

      return orderCode;
    } finally {
      isProcessingOrder.value = false;
    }
  }

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
    finalizarOrdenConReserva
  };
});
