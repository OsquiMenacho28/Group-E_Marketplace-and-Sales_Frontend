<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import HasRole from '@/components/HasRole.vue';
import ProductMultimediaManager from '@/components/ProductMultimediaManager.vue';
import { apiClient } from '@/api/client';
import type { Producto } from '@/types';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Users, 
  Package, 
  FileText, 
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Edit3,
  FolderTree,
  ImagePlus,
  Image as ImageIcon,
  Plus,
  Save,
  Store,
  X,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  Eye,
  Settings2
} from 'lucide-vue-next';

interface CategoryNode {
  id: string;
  name: string;
  description: string;
  children?: CategoryNode[];
}

interface AttributeField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  value: string;
  options?: string[];
  custom?: boolean;
}

interface PriceMatrixRow {
  branch: string;
  web: number;
  pos: number;
  b2b: number;
}

interface CatalogCategory {
  id: string;
  nombre: string;
  descripcion?: string;
}

interface PendingImage {
  name: string;
  dataUrl: string;
  size: number;
}

// Control de Pestañas Principales en Admin
const activeAdminTab = ref<'productos' | 'categorias' | 'kpis'>('productos');

// ============================================================================
// HISTORIA KAN-17 / RF-01: GESTIÓN DE PRODUCTOS Y CICLO DE VIDA
// ============================================================================
const productsList = ref<Producto[]>([]);
const isLoadingProducts = ref(false);
const searchProductQuery = ref('');
const statusFilter = ref<string>('todos');
const currentPage = ref(1);
const itemsPerPage = ref(6);

// Modal para KAN-19 / RF-03: Galería Visual y Multimedia
const selectedMultimediaProduct = ref<Producto | null>(null);

// Modal de Edición de Producto (KAN-307)
const isEditModalOpen = ref(false);
const editingProduct = ref<{
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  descripcion: string;
  categoria_id: string;
  precio: number;
  precio_costo: number;
  estado: string;
} | null>(null);
const editFormError = ref('');
const isSavingEdit = ref(false);

// Modal de Confirmación de Eliminación
const productToDelete = ref<Producto | null>(null);
const isDeletingProduct = ref(false);

// Feedback Toast/Banner
const actionFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
function showFeedback(message: string, type: 'success' | 'error' = 'success') {
  actionFeedback.value = { type, message };
  setTimeout(() => {
    actionFeedback.value = null;
  }, 4500);
}

// Cargar listado de productos desde la API (KAN-306 / KAN-291)
async function loadProductsList() {
  isLoadingProducts.value = true;
  try {
    const res = await apiClient.get('/productos');
    const data = res.data.productos || res.data || [];
    productsList.value = Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.warn('Fallo cargando /productos, intentando /v1/catalogo/productos:', err);
    try {
      const altRes = await apiClient.get('/v1/catalogo/productos');
      const altData = Array.isArray(altRes.data) ? altRes.data : altRes.data.productos || [];
      productsList.value = Array.isArray(altData) ? altData : [];
    } catch {
      showFeedback('No se pudo cargar la lista de productos del catálogo.', 'error');
    }
  } finally {
    isLoadingProducts.value = false;
    // Sincronizar selector de matriz de precios con productos reales de la BD
    if (productsList.value.length > 0) {
      priceProducts.value = productsList.value.map(p => ({
        id: p.id,
        name: p.nombre,
        sku: p.sku
      }));
      if (!priceProducts.value.some(p => p.id === selectedPriceProduct.value)) {
        selectedPriceProduct.value = priceProducts.value[0]?.id || '';
      }
    }
  }
}

// Cambio rápido de ciclo de vida (KAN-291: publicado, borrador, inactivo, descontinuado)
async function quickChangeStatus(prod: Producto, nuevoEstado: string) {
  try {
    await apiClient.patch(`/productos/${prod.id}/estado`, { estado: nuevoEstado });
    prod.estado = nuevoEstado;
    showFeedback(`El estado de "${prod.nombre}" ahora es "${nuevoEstado.toUpperCase()}".`);
  } catch (err: any) {
    showFeedback(err.response?.data?.error || 'Error al cambiar estado del producto.', 'error');
  }
}

// Abrir modal de edición reactiva (KAN-307)
function openEditModalProduct(prod: Producto) {
  if (catalogCategories.value.length === 0) {
    loadCatalogCategories();
  }
  editingProduct.value = {
    id: prod.id,
    sku: prod.sku,
    nombre: prod.nombre,
    marca: prod.marca || '',
    descripcion: prod.descripcion || '',
    categoria_id: prod.categoria_id || catalogCategories.value[0]?.id || '',
    precio: prod.precio || 0,
    precio_costo: (prod as any).precio_costo || Math.round((prod.precio || 0) * 0.7),
    estado: prod.estado || 'publicado'
  };
  editFormError.value = '';
  isEditModalOpen.value = true;
}

// Guardar cambios de edición (KAN-306 / KAN-307)
async function submitEditProduct() {
  if (!editingProduct.value) return;
  if (!editingProduct.value.sku.trim() || !editingProduct.value.nombre.trim()) {
    editFormError.value = 'El SKU y el Nombre son campos obligatorios.';
    return;
  }
  isSavingEdit.value = true;
  editFormError.value = '';
  try {
    const res = await apiClient.put(`/productos/${editingProduct.value.id}`, {
      sku: editingProduct.value.sku.trim().toUpperCase(),
      nombre: editingProduct.value.nombre.trim(),
      marca: editingProduct.value.marca.trim() || null,
      descripcion: editingProduct.value.descripcion.trim() || null,
      categoria_id: editingProduct.value.categoria_id || null,
      precio: Number(editingProduct.value.precio) || 0,
      precio_costo: Number(editingProduct.value.precio_costo) || 0,
      estado: editingProduct.value.estado
    });

    const updated = res.data.producto || res.data;
    const index = productsList.value.findIndex(p => p.id === editingProduct.value?.id);
    if (index !== -1) {
      productsList.value[index] = {
        ...productsList.value[index],
        ...updated,
        precio: Number(editingProduct.value.precio),
        precio_costo: Number(editingProduct.value.precio_costo)
      };
    }
    isEditModalOpen.value = false;
    showFeedback('Producto actualizado exitosamente con SKU y validaciones validadas.');
  } catch (err: any) {
    editFormError.value = err.response?.data?.error || 'Error al guardar los cambios del producto.';
  } finally {
    isSavingEdit.value = false;
  }
}

// Eliminar producto con confirmación (KAN-291)
async function confirmDeleteProduct() {
  if (!productToDelete.value) return;
  isDeletingProduct.value = true;
  try {
    await apiClient.delete(`/productos/${productToDelete.value.id}`);
    productsList.value = productsList.value.filter(p => p.id !== productToDelete.value?.id);
    showFeedback(`Producto "${productToDelete.value.nombre}" eliminado del catálogo.`);
    productToDelete.value = null;
  } catch (err: any) {
    showFeedback(err.response?.data?.error || 'Error al eliminar producto.', 'error');
  } finally {
    isDeletingProduct.value = false;
  }
}

// Cuando se suben o reordenan fotos en ProductMultimediaManager (KAN-19)
function handleMultimediaUpdated() {
  loadProductsList();
}

// Filtros y Paginación (KAN-291)
const selectedCategoryFilter = ref('todas');

const filteredProductsList = computed(() => {
  return productsList.value.filter(prod => {
    const query = searchProductQuery.value.trim().toLowerCase();
    const matchesSearch = !query ||
      prod.nombre.toLowerCase().includes(query) ||
      prod.sku.toLowerCase().includes(query) ||
      (prod.marca && prod.marca.toLowerCase().includes(query)) ||
      (prod.categorias?.nombre && prod.categorias.nombre.toLowerCase().includes(query));

    const matchesStatus = statusFilter.value === 'todos' || prod.estado?.toLowerCase() === statusFilter.value.toLowerCase();

    const matchesCategory = selectedCategoryFilter.value === 'todas' ||
      prod.categoria_id === selectedCategoryFilter.value ||
      prod.categorias?.id === selectedCategoryFilter.value;

    return matchesSearch && matchesStatus && matchesCategory;
  });
});

const totalPages = computed(() => Math.ceil(filteredProductsList.value.length / itemsPerPage.value) || 1);

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredProductsList.value.slice(start, start + itemsPerPage.value);
});

const productsStats = computed(() => {
  const total = productsList.value.length;
  const publicados = productsList.value.filter(p => p.estado === 'publicado').length;
  const borradores = productsList.value.filter(p => p.estado === 'borrador').length;
  const conImagenes = productsList.value.filter(p => (p.imagenes_producto && p.imagenes_producto.length > 0)).length;
  return { total, publicados, borradores, conImagenes };
});

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

const lowStockAlerts = computed(() => {
  if (productsList.value.length === 0) {
    return [
      { sku: 'MON-LG-27GP', nombre: 'Monitor LG UltraGear 27"', stockActual: 2, puntoReorden: 5 },
      { sku: 'LAP-DELL-XPS15', nombre: 'Laptop Dell XPS 15', stockActual: 0, puntoReorden: 8 }
    ];
  }
  return productsList.value
    .filter(p => p.estado === 'descontinuado' || p.estado === 'borrador')
    .slice(0, 3)
    .map(p => ({
      sku: p.sku,
      nombre: p.nombre,
      stockActual: p.estado === 'descontinuado' ? 0 : 3,
      puntoReorden: 5
    }));
});

const categories = ref<CategoryNode[]>([
  {
    id: '0201bb04-acb2-46fe-8aa9-198a4701ab54',
    name: 'Laptops y PCs',
    description: 'Equipos portátiles y de escritorio.'
  },
  {
    id: 'bfeabe38-3626-49e1-9b4e-ace0315cd91d',
    name: 'Periféricos',
    description: 'Teclados, mouse y accesorios para estaciones de trabajo.'
  },
  {
    id: 'd1543851-f4d8-4c72-b952-dcf4a777666a',
    name: 'Monitores',
    description: 'Pantallas para gaming, diseño y productividad.'
  },
  {
    id: 'd0998a1f-3b78-4099-928a-b05c70ae472b',
    name: 'Audio y Video',
    description: 'Auriculares, micrófonos y cámaras de alta fidelidad.'
  }
]);

const expandedCategoryIds = ref(new Set(['0201bb04-acb2-46fe-8aa9-198a4701ab54', 'bfeabe38-3626-49e1-9b4e-ace0315cd91d']));
const editingCategory = ref<CategoryNode | null>(null);
const editingName = ref('');
const editingDescription = ref('');
const isProductModalOpen = ref(false);
const selectedProductCategory = ref('');
const productName = ref('');
const productSku = ref('');
const productBrand = ref('');
const productDescription = ref('');
const productPrice = ref<number | null>(null);
const productAttributeFields = ref<AttributeField[]>([]);
const catalogCategories = ref<CatalogCategory[]>([]);
const pendingImages = ref<PendingImage[]>([]);
const imageInput = ref<HTMLInputElement | null>(null);
const isSavingProduct = ref(false);
const productFormMessage = ref('');
const priceProducts = ref([
  { id: '7026ea00-797c-43a8-b6e9-58277af347e7', name: 'Monitor Gamer LG UltraGear 27" 165Hz IPS', sku: 'MON-LG-27GP' },
  { id: 'c121e644-d23a-427d-821e-9c4a8bab7812', name: 'Laptop Dell XPS 15 (OLED 4K, i7 13va Gen)', sku: 'LAP-DELL-XPS15' },
  { id: 'a03f1380-bf24-4394-acde-6c726a677df3', name: 'Mouse Inalámbrico Logitech MX Master 3S', sku: 'MOU-LOG-MX3S' }
]);
const selectedPriceProduct = ref('7026ea00-797c-43a8-b6e9-58277af347e7');
const priceMatrix = ref<PriceMatrixRow[]>([
  { branch: 'La Paz Centro', web: 3499, pos: 3420, b2b: 3290 },
  { branch: 'Calacoto', web: 3549, pos: 3490, b2b: 3350 },
  { branch: 'Santa Cruz Equipetrol', web: 3599, pos: 3520, b2b: 3380 },
  { branch: 'Cochabamba Norte', web: 3499, pos: 3390, b2b: 3260 }
]);
const priceMatrixSavedAt = ref('');

const priceValues = computed(() => priceMatrix.value.flatMap((row) => [row.web, row.pos, row.b2b]));
const priceSummary = computed(() => {
  const values = priceValues.value;
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length
  };
});

const attributeTemplates: Record<string, Omit<AttributeField, 'value'>[]> = {
  laptops: [
    { id: 'processor', label: 'Procesador', type: 'text' },
    { id: 'ram', label: 'Memoria RAM', type: 'select', options: ['8 GB', '16 GB', '32 GB', '64 GB'] },
    { id: 'storage', label: 'Almacenamiento', type: 'select', options: ['256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD'] }
  ],
  monitors: [
    { id: 'screen-size', label: 'Tamaño de pantalla', type: 'number' },
    { id: 'resolution', label: 'Resolución', type: 'select', options: ['Full HD', 'QHD', '4K UHD', '5K'] },
    { id: 'refresh-rate', label: 'Tasa de refresco', type: 'number' }
  ],
  'audio-video': [
    { id: 'connectivity', label: 'Conectividad', type: 'text' },
    { id: 'warranty', label: 'Garantía', type: 'select', options: ['6 meses', '1 año', '2 años'] }
  ],
  'keyboards-mice': [
    { id: 'connection', label: 'Tipo de conexión', type: 'select', options: ['USB', 'Bluetooth', 'Inalámbrico 2.4 GHz'] },
    { id: 'layout', label: 'Distribución', type: 'text' }
  ],
  networking: [
    { id: 'ports', label: 'Cantidad de puertos', type: 'number' },
    { id: 'speed', label: 'Velocidad', type: 'text' }
  ]
};

const visibleCategories = computed(() => {
  const visible: Array<CategoryNode & { depth: number; hasChildren: boolean }> = [];

  function append(nodes: CategoryNode[], depth: number) {
    nodes.forEach((category) => {
      visible.push({ ...category, depth, hasChildren: Boolean(category.children?.length) });
      if (category.children?.length && expandedCategoryIds.value.has(category.id)) {
        append(category.children, depth + 1);
      }
    });
  }

  append(categories.value, 0);
  return visible;
});

const categoryOptions = computed(() => {
  const options: CategoryNode[] = [];
  function append(nodes: CategoryNode[]) {
    nodes.forEach((category) => {
      options.push(category);
      if (category.children) append(category.children);
    });
  }
  append(categories.value);
  return options;
});

function toggleCategory(categoryId: string) {
  const nextExpandedIds = new Set(expandedCategoryIds.value);
  if (nextExpandedIds.has(categoryId)) {
    nextExpandedIds.delete(categoryId);
  } else {
    nextExpandedIds.add(categoryId);
  }
  expandedCategoryIds.value = nextExpandedIds;
}

function openEditModal(category: CategoryNode) {
  editingCategory.value = category;
  editingName.value = category.name;
  editingDescription.value = category.description;
}

function findCategory(categoryId: string, nodes: CategoryNode[]): CategoryNode | undefined {
  for (const category of nodes) {
    if (category.id === categoryId) return category;
    if (category.children) {
      const match = findCategory(categoryId, category.children);
      if (match) return match;
    }
  }
}

function saveCategory() {
  if (!editingCategory.value || !editingName.value.trim()) return;
  const category = findCategory(editingCategory.value.id, categories.value);
  if (category) {
    category.name = editingName.value.trim();
    category.description = editingDescription.value.trim();
  }
  editingCategory.value = null;
}

// Categorías de respaldo para garantizar disponibilidad inmediata
const FALLBACK_CATEGORIES: CatalogCategory[] = [
  { id: '0201bb04-acb2-46fe-8aa9-198a4701ab54', nombre: 'Laptops y PCs', descripcion: 'Equipos portátiles y de escritorio' },
  { id: 'bfeabe38-3626-49e1-9b4e-ace0315cd91d', nombre: 'Periféricos', descripcion: 'Teclados, mouse y accesorios' },
  { id: 'd1543851-f4d8-4c72-b952-dcf4a777666a', nombre: 'Monitores', descripcion: 'Pantallas para gaming y productividad' },
  { id: 'd0998a1f-3b78-4099-928a-b05c70ae472b', nombre: 'Audio y Video', descripcion: 'Auriculares, micrófonos y cámaras' }
];

async function loadCatalogCategories() {
  try {
    const response = await apiClient.get<CatalogCategory[]>('/v1/catalogo/categorias');
    const cats = Array.isArray(response.data) ? response.data : [];
    catalogCategories.value = cats.length > 0 ? cats : FALLBACK_CATEGORIES;
    if (!selectedProductCategory.value && catalogCategories.value.length > 0) {
      selectedProductCategory.value = catalogCategories.value[0].id;
    }
  } catch (err) {
    console.warn('Aviso cargando categorías de Supabase, usando catálogo base:', err);
    catalogCategories.value = FALLBACK_CATEGORIES;
    if (!selectedProductCategory.value && catalogCategories.value.length > 0) {
      selectedProductCategory.value = catalogCategories.value[0].id;
    }
  }
}

function openProductModal() {
  if (catalogCategories.value.length === 0) {
    loadCatalogCategories();
  }
  isProductModalOpen.value = true;
  productName.value = '';
  productSku.value = '';
  productBrand.value = '';
  productDescription.value = '';
  productPrice.value = null;
  selectedProductCategory.value = catalogCategories.value[0]?.id || '0201bb04-acb2-46fe-8aa9-198a4701ab54';
  productAttributeFields.value = [];
  pendingImages.value = [];
  productFormMessage.value = '';
  if (selectedProductCategory.value) {
    updateProductCategory(selectedProductCategory.value);
  }
}

function updateProductCategory(categoryId: string) {
  selectedProductCategory.value = categoryId;
  const category = catalogCategories.value.find((item) => item.id === categoryId);
  const templateKey = category?.nombre.toLowerCase().includes('laptop') ? 'laptops'
    : category?.nombre.toLowerCase().includes('monitor') ? 'monitors'
    : category?.nombre.toLowerCase().includes('audio') ? 'audio-video'
    : category?.nombre.toLowerCase().includes('teclado') || category?.nombre.toLowerCase().includes('mouse') ? 'keyboards-mice'
    : category?.nombre.toLowerCase().includes('red') ? 'networking'
    : '';
  productAttributeFields.value = (attributeTemplates[templateKey] || []).map((field) => ({
    ...field,
    value: ''
  }));
}

function formatImageSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function addProductImages(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || []);
  const remainingSlots = 5 - pendingImages.value.length;
  const validFiles = files.slice(0, remainingSlots).filter((file) => file.size <= 5 * 1024 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
  if (validFiles.length !== files.length) {
    productFormMessage.value = 'Solo se aceptan hasta 5 imágenes JPEG, PNG o WebP de máximo 5 MB.';
  }
  const images = await Promise.all(validFiles.map((file) => new Promise<PendingImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result), size: file.size });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  })));
  pendingImages.value.push(...images);
  if (imageInput.value) imageInput.value.value = '';
}

function removeProductImage(index: number) {
  pendingImages.value.splice(index, 1);
}

function addCustomAttribute() {
  productAttributeFields.value.push({
    id: `custom-${Date.now()}`,
    label: 'Nuevo atributo',
    type: 'text',
    value: '',
    custom: true
  });
}

function removeAttribute(fieldId: string) {
  productAttributeFields.value = productAttributeFields.value.filter((field) => field.id !== fieldId);
}

async function saveProduct() {
  if (!productName.value.trim() || !productSku.value.trim() || !selectedProductCategory.value || productPrice.value === null) {
    productFormMessage.value = 'Completa nombre, SKU, categoría y precio antes de guardar.';
    return;
  }
  isSavingProduct.value = true;
  productFormMessage.value = '';
  const attributes = productAttributeFields.value.reduce<Record<string, string>>((result, field) => {
    if (field.label.trim()) result[field.label.trim()] = field.value;
    return result;
  }, {});
  try {
    const response = await apiClient.post('/api/v1/catalogo/productos', {
      sku: productSku.value.trim(),
      nombre: productName.value.trim(),
      marca: productBrand.value.trim() || null,
      descripcion: productDescription.value.trim() || null,
      categoria_id: selectedProductCategory.value,
      precio: productPrice.value,
      variantes: [{
        sku: `${productSku.value.trim()}-BASE`,
        nombre_variante: 'Configuración principal',
        atributos: attributes,
        precio: productPrice.value,
        precio_costo: 0
      }],
      imagenes: pendingImages.value.map((image) => ({ data_url: image.dataUrl, nombre: image.name }))
    });
    priceProducts.value.unshift({ id: response.data.id, name: response.data.nombre, sku: response.data.sku });
    selectedPriceProduct.value = response.data.id;
    isProductModalOpen.value = false;
    await loadProductsList();
    showFeedback(`Producto "${response.data.nombre || productName.value}" creado con éxito.`);
  } catch (error: any) {
    productFormMessage.value = error.response?.data?.detail || 'No se pudo guardar el producto en el catálogo.';
  } finally {
    isSavingProduct.value = false;
  }
}

function formatPrice(value: number) {
  return value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function savePriceMatrix() {
  priceMatrixSavedAt.value = new Date().toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(() => {
  loadCatalogCategories();
  loadProductsList();
});
const sucursales = ref([
  {
    id: 'suc-central',
    nombre: 'Sucursal Central - La Paz',
    precios: {
      web: 'Lista Web Retail',
      pos: 'Lista POS Retail',
      b2b: 'Lista B2B Corporativa'
    }
  },
  {
    id: 'suc-sur',
    nombre: 'Sucursal Sur - La Paz',
    precios: {
      web: 'Lista Web Retail',
      pos: 'Lista POS Retail',
      b2b: 'Lista B2B Corporativa'
    }
  },
  {
    id: 'suc-calacoto',
    nombre: 'Sucursal Calacoto',
    precios: {
      web: 'Lista Web Retail',
      pos: 'Lista POS Retail',
      b2b: 'Lista B2B Corporativa'
    }
  }
]);

const listasPrecios = [
  'Lista Web Retail',
  'Lista POS Retail',
  'Lista B2B Corporativa',
  'Lista Promocional'
];

const tipoCambioUsd = 6.96;

const preciosDual = ref([
  {
    id: 'precio-001',
    producto: 'Monitor LG UltraGear 27"',
    lista: 'Lista Web Retail',
    precioBob: 8999.00
  },
  {
    id: 'precio-002',
    producto: 'Laptop Dell XPS 15',
    lista: 'Lista Web Retail',
    precioBob: 12500.00
  },
  {
    id: 'precio-003',
    producto: 'Laptop Dell XPS 15',
    lista: 'Lista B2B Corporativa',
    precioBob: 11200.00
  },
  {
    id: 'precio-004',
    producto: 'Monitor LG UltraGear 27"',
    lista: 'Lista POS Retail',
    precioBob: 8799.00
  }
]);

function convertirAUsd(precioBob: number) {
  return precioBob / tipoCambioUsd;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Banner de Notificación / Feedback en Tiempo Real -->
    <div
      v-if="actionFeedback"
      :class="[
        'p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-2 shadow-sm',
        actionFeedback.type === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
      ]"
    >
      <div class="flex items-center gap-2.5">
        <CheckCircle2 v-if="actionFeedback.type === 'success'" class="w-4 h-4 text-emerald-600 shrink-0" />
        <AlertTriangle v-else class="w-4 h-4 text-rose-600 shrink-0" />
        <span>{{ actionFeedback.message }}</span>
      </div>
      <button @click="actionFeedback = null" class="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Header Panel Administrativo -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white">Panel de Control y Analítica</h1>
          <span class="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider">
            Admin ERP
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-1">Supervisión omnicanal de catálogo de productos, galería multimedia, sucursales y ventas en tiempo real.</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="loadProductsList" :disabled="isLoadingProducts" class="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5" title="Recargar datos">
          <RefreshCw :class="['w-3.5 h-3.5', isLoadingProducts ? 'animate-spin' : '']" />
          <span class="hidden sm:inline">Actualizar</span>
        </button>
        <HasRole :roles="['administrador', 'gerente_comercial']">
          <button @click="openProductModal" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5">
            <Plus class="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </HasRole>
      </div>
    </div>

    <!-- Selector de Pestañas del Panel de Administración -->
    <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
      <button
        @click="activeAdminTab = 'productos'"
        :class="[
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0',
          activeAdminTab === 'productos'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
      >
        <Package class="w-4 h-4" />
        <span>Gestión de Catálogo & Multimedia (RF-01 / RF-03)</span>
        <span :class="['px-2 py-0.5 rounded-full text-[10px] font-extrabold', activeAdminTab === 'productos' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200']">
          {{ productsList.length }}
        </span>
      </button>

      <button
        @click="activeAdminTab = 'categorias'"
        :class="[
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0',
          activeAdminTab === 'categorias'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
      >
        <FolderTree class="w-4 h-4" />
        <span>Categorías & Matriz de Precios</span>
      </button>

      <button
        @click="activeAdminTab = 'kpis'"
        :class="[
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0',
          activeAdminTab === 'kpis'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
      >
        <TrendingUp class="w-4 h-4" />
        <span>KPIs & Operaciones ERP</span>
      </button>
    </div>

    <!-- ===================================================================== -->
    <!-- PESTAÑA 1: GESTIÓN DE PRODUCTOS Y MULTIMEDIA (RF-01 / RF-03)          -->
    <!-- ===================================================================== -->
    <div v-if="activeAdminTab === 'productos'" class="space-y-6">
      <!-- Tarjetas de Resumen Rápido de Catálogo -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span class="block text-[11px] font-semibold text-slate-500">Total en Catálogo</span>
          <strong class="block text-2xl font-black text-slate-900 dark:text-white mt-1">{{ productsStats.total }}</strong>
          <span class="text-[10px] text-slate-400">SKUs registrados</span>
        </div>
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span class="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Publicados (Web/POS)</span>
          <strong class="block text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{{ productsStats.publicados }}</strong>
          <span class="text-[10px] text-slate-400">Visibles para venta</span>
        </div>
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span class="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">En Borrador / Revisión</span>
          <strong class="block text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{{ productsStats.borradores }}</strong>
          <span class="text-[10px] text-slate-400">Edición en progreso</span>
        </div>
        <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span class="block text-[11px] font-semibold text-blue-600 dark:text-blue-400">Con Galería Multimedia</span>
          <strong class="block text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">{{ productsStats.conImagenes }}</strong>
          <span class="text-[10px] text-slate-400">Fotos en Supabase Storage</span>
        </div>
      </div>

      <!-- Barra de Filtros, Búsqueda y Paginación (KAN-291) -->
      <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Buscador -->
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchProductQuery"
            type="text"
            placeholder="Buscar producto por SKU, nombre o marca..."
            class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <!-- Filtro por Categoría (KAN-291) -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <Layers class="w-3.5 h-3.5" /> Categoría:
            </span>
            <select
              v-model="selectedCategoryFilter"
              @change="currentPage = 1"
              class="px-2.5 py-1 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500"
            >
              <option value="todas">Todas las categorías</option>
              <option v-for="cat in catalogCategories" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
            </select>
          </div>

          <!-- Filtros por Estado del Ciclo de Vida (KAN-291) -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span class="text-xs text-slate-400 font-semibold mr-1 flex items-center gap-1">
              <Filter class="w-3.5 h-3.5" /> Estado:
            </span>
            <button
              v-for="st in ['todos', 'publicado', 'borrador', 'inactivo', 'descontinuado']"
              :key="st"
              @click="statusFilter = st; currentPage = 1"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors',
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              ]"
            >
              {{ st }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla de Ciclo de Vida de Productos (KAN-291) -->
      <section class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package class="w-4 h-4 text-blue-600" />
              Catálogo de Productos y Estado de Ciclo de Vida (RF-01)
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Control de SKU único, precios base, galería multimedia y estados de publicación.</p>
          </div>
          <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg self-start sm:self-auto">
            Mostrando {{ paginatedProducts.length }} de {{ filteredProductsList.length }} productos
          </span>
        </div>

        <div v-if="isLoadingProducts" class="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-3">
          <RefreshCw class="w-6 h-6 animate-spin text-blue-600" />
          <span>Cargando catálogo de productos y recursos multimedia...</span>
        </div>

        <div v-else-if="filteredProductsList.length === 0" class="p-12 text-center space-y-3">
          <Package class="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
          <p class="text-sm font-bold text-slate-700 dark:text-slate-300">No se encontraron productos</p>
          <p class="text-xs text-slate-400">Intenta con otro término de búsqueda o crea un nuevo producto en el catálogo.</p>
          <button @click="openProductModal" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm">
            + Crear Primer Producto
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[800px] text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="p-3.5">Portada & Multimedia</th>
                <th class="p-3.5">Producto / SKU</th>
                <th class="p-3.5">Categoría</th>
                <th class="p-3.5">Precio Web</th>
                <th class="p-3.5">Ciclo de Vida (Estado)</th>
                <th class="p-3.5 text-right">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="prod in paginatedProducts" :key="prod.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <!-- Portada y Multimedia (KAN-19 / KAN-78) -->
                <td class="p-3.5">
                  <div class="flex items-center gap-3">
                    <div
                      class="relative w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 cursor-pointer group shadow-sm"
                      @click="selectedMultimediaProduct = prod"
                      title="Abrir gestor multimedia"
                    >
                      <img
                        v-if="prod.imagenes_producto && prod.imagenes_producto.length > 0"
                        :src="(prod.imagenes_producto.find(i => i.es_principal) || prod.imagenes_producto[0]).url"
                        :alt="prod.nombre"
                        class="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div v-else class="w-full h-full flex items-center justify-center text-slate-400">
                        <ImageIcon class="w-5 h-5" />
                      </div>
                      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye class="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <button
                        @click="selectedMultimediaProduct = prod"
                        class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <ImageIcon class="w-3.5 h-3.5" />
                        <span>{{ (prod.imagenes_producto && prod.imagenes_producto.length) || 0 }} foto(s)</span>
                      </button>
                      <span v-if="prod.imagenes_producto && prod.imagenes_producto.some(i => i.es_principal)" class="text-[9px] text-emerald-600 font-bold block">
                        ★ Con Portada
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Nombre y SKU con unicidad KAN-287 -->
                <td class="p-3.5">
                  <p class="font-bold text-slate-900 dark:text-white line-clamp-1">{{ prod.nombre }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {{ prod.sku }}
                    </span>
                    <span v-if="prod.marca" class="text-[10px] text-slate-400">{{ prod.marca }}</span>
                  </div>
                </td>

                <!-- Categoría -->
                <td class="p-3.5">
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {{ prod.categorias?.nombre || 'General' }}
                  </span>
                </td>

                <!-- Precio -->
                <td class="p-3.5">
                  <span class="font-bold text-slate-900 dark:text-white block">
                    BOB {{ formatPrice(prod.precio || 0) }}
                  </span>
                  <span v-if="(prod as any).precio_costo" class="text-[10px] text-slate-400 block">
                    Costo: BOB {{ formatPrice((prod as any).precio_costo) }}
                  </span>
                </td>

                <!-- Ciclo de Vida: Selector rápido (KAN-291) -->
                <td class="p-3.5">
                  <div class="flex items-center gap-1.5">
                    <select
                      :value="prod.estado || 'publicado'"
                      @change="quickChangeStatus(prod, ($event.target as HTMLSelectElement).value)"
                      :class="[
                        'px-2.5 py-1 rounded-lg text-xs font-bold outline-none border transition-colors cursor-pointer',
                        prod.estado === 'publicado'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : prod.estado === 'borrador'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : prod.estado === 'inactivo'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      ]"
                    >
                      <option value="publicado">Publicado</option>
                      <option value="borrador">Borrador</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="descontinuado">Descontinuado</option>
                    </select>
                  </div>
                </td>

                <!-- Acciones Rápidas (KAN-291, KAN-19) -->
                <td class="p-3.5 text-right">
                  <div class="inline-flex items-center gap-1.5">
                    <!-- Botón Gestor Multimedia (KAN-19) -->
                    <button
                      type="button"
                      @click="selectedMultimediaProduct = prod"
                      class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors flex items-center gap-1"
                      title="Administrar galería multimedia (Subir, ordenar y portada)"
                    >
                      <ImageIcon class="w-3.5 h-3.5" />
                      <span class="hidden md:inline">Multimedia</span>
                    </button>

                    <!-- Botón Editar Producto (KAN-307) -->
                    <button
                      type="button"
                      @click="openEditModalProduct(prod)"
                      class="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Editar datos del producto"
                    >
                      <Edit3 class="w-4 h-4" />
                    </button>

                    <!-- Botón Eliminar Producto (KAN-291) -->
                    <button
                      type="button"
                      @click="productToDelete = prod"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Eliminar producto"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginador Interactivo (KAN-291) -->
        <div v-if="totalPages > 1" class="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <p class="text-xs text-slate-500">
            Página <strong class="text-slate-800 dark:text-slate-200">{{ currentPage }}</strong> de <strong class="text-slate-800 dark:text-slate-200">{{ totalPages }}</strong>
          </p>
          <div class="flex items-center gap-1.5">
            <button
              :disabled="currentPage === 1"
              @click="currentPage--"
              class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
            >
              <ChevronLeft class="w-3.5 h-3.5" /> Anterior
            </button>
            <div class="flex items-center gap-1">
              <button
                v-for="p in totalPages"
                :key="p"
                @click="currentPage = p"
                :class="[
                  'w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-colors',
                  currentPage === p
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                ]"
              >
                {{ p }}
              </button>
            </div>
            <button
              :disabled="currentPage === totalPages"
              @click="currentPage++"
              class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
            >
              Siguiente <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- ===================================================================== -->
    <!-- PESTAÑA 2: CATEGORÍAS & MATRIZ DE PRECIOS                             -->
    <!-- ===================================================================== -->
    <div v-show="activeAdminTab === 'categorias'" class="space-y-6">
      <!-- Gestión de Categorías -->
      <section class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-start gap-3">
            <span class="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <FolderTree class="w-5 h-5" />
            </span>
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-white">Árbol de categorías</h2>
              <p class="text-xs text-slate-500 mt-1">Organiza la jerarquía del catálogo y actualiza sus datos.</p>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg">
            {{ categories.length }} categorías principales
          </span>
        </div>

        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          <div
            v-for="category in visibleCategories"
            :key="category.id"
            class="min-h-16 px-5 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            :style="{ paddingLeft: `${1.25 + category.depth * 2}rem` }"
          >
            <button
              v-if="category.hasChildren"
              type="button"
              class="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
              :aria-label="expandedCategoryIds.has(category.id) ? `Contraer ${category.name}` : `Expandir ${category.name}`"
              @click="toggleCategory(category.id)"
            >
              <ChevronDown v-if="expandedCategoryIds.has(category.id)" class="w-4 h-4" />
              <ChevronRight v-else class="w-4 h-4" />
            </button>
            <span v-else class="w-6" aria-hidden="true" />

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span :class="category.depth === 0 ? 'text-sm font-bold' : 'text-sm font-medium'" class="text-slate-800 dark:text-slate-100">
                  {{ category.name }}
                </span>
                <span v-if="category.hasChildren" class="text-[10px] text-slate-400">{{ category.children?.length }} subcategorías</span>
              </div>
              <p class="text-xs text-slate-500 truncate mt-0.5">{{ category.description }}</p>
            </div>

            <HasRole :roles="['administrador', 'gerente_comercial']">
              <button
                type="button"
                class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                :aria-label="`Editar ${category.name}`"
                @click="openEditModal(category)"
              >
                <Edit3 class="w-3.5 h-3.5" />
                Editar
              </button>
            </HasRole>
          </div>
        </div>
      </section>

      <!-- Matriz de precios por sucursal y canal -->
      <HasRole :roles="['administrador', 'gerente_comercial']">
        <section class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div class="flex items-start gap-3">
              <span class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <DollarSign class="w-5 h-5" />
              </span>
              <div>
                <h2 class="text-sm font-bold text-slate-900 dark:text-white">Matriz de precios</h2>
                <p class="text-xs text-slate-500 mt-1">Define precios diferenciados por sucursal y canal de venta.</p>
              </div>
            </div>
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Producto
              <select v-model="selectedPriceProduct" class="min-w-56 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500">
                <option v-for="product in priceProducts" :key="product.id" :value="product.id">{{ product.name }}</option>
              </select>
            </label>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
            <div class="px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800/70">
              <span class="block text-[11px] text-slate-500">Precio mínimo</span>
              <strong class="block text-lg text-slate-900 dark:text-white mt-1">BOB {{ formatPrice(priceSummary.minimum) }}</strong>
            </div>
            <div class="px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800/70">
              <span class="block text-[11px] text-slate-500">Precio máximo</span>
              <strong class="block text-lg text-slate-900 dark:text-white mt-1">BOB {{ formatPrice(priceSummary.maximum) }}</strong>
            </div>
            <div class="px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
              <span class="block text-[11px] text-emerald-700 dark:text-emerald-400">Promedio de matriz</span>
              <strong class="block text-lg text-emerald-800 dark:text-emerald-300 mt-1">BOB {{ formatPrice(priceSummary.average) }}</strong>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[680px] text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th class="p-4">Sucursal</th>
                  <th class="p-4"><span class="inline-flex items-center gap-1.5"><ShoppingBag class="w-3.5 h-3.5 text-blue-500" /> Web</span></th>
                  <th class="p-4"><span class="inline-flex items-center gap-1.5"><Store class="w-3.5 h-3.5 text-emerald-500" /> POS</span></th>
                  <th class="p-4"><span class="inline-flex items-center gap-1.5"><Users class="w-3.5 h-3.5 text-indigo-500" /> B2B</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="row in priceMatrix" :key="row.branch" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <th class="p-4 font-semibold text-slate-800 dark:text-slate-200">{{ row.branch }}</th>
                  <td class="p-3">
                    <label class="sr-only">Precio Web en {{ row.branch }}</label>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-400">BOB</span>
                      <input v-model.number="row.web" type="number" min="0" step="0.01" class="w-28 px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </td>
                  <td class="p-3">
                    <label class="sr-only">Precio POS en {{ row.branch }}</label>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-400">BOB</span>
                      <input v-model.number="row.pos" type="number" min="0" step="0.01" class="w-28 px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                  </td>
                  <td class="p-3">
                    <label class="sr-only">Precio B2B en {{ row.branch }}</label>
                    <div class="flex items-center gap-1.5">
                      <span class="text-slate-400">BOB</span>
                      <input v-model.number="row.b2b" type="number" min="0" step="0.01" class="w-28 px-2.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="p-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="text-[11px] text-slate-500">
              {{ priceMatrixSavedAt ? `Matriz guardada a las ${priceMatrixSavedAt}.` : 'Los cambios se aplican al producto seleccionado en esta sesión.' }}
            </p>
            <button type="button" class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm" @click="savePriceMatrix">
              <Save class="w-3.5 h-3.5" />
              Guardar matriz
            </button>
          </div>
        </section>
      </HasRole>
    </div>

    <!-- ===================================================================== -->
    <!-- PESTAÑA 3: KPIS & OPERACIONES ERP                                     -->
    <!-- ===================================================================== -->
    <div v-show="activeAdminTab === 'kpis'" class="space-y-6">
      <!-- Cards de KPIs Clave (RF-46) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex justify-between items-center text-slate-500">
            <span class="text-xs font-semibold">Ventas Totales Hoy</span>
            <span class="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg"><DollarSign class="w-4 h-4" /></span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">BOB {{ kpis.ventasHoy.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}</div>
          <span class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowUpRight class="w-3.5 h-3.5" /> +14.2% vs ayer
          </span>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex justify-between items-center text-slate-500">
            <span class="text-xs font-semibold">Ventas del Mes</span>
            <span class="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg"><TrendingUp class="w-4 h-4" /></span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">BOB {{ kpis.ventasMes.toLocaleString('es-BO', { minimumFractionDigits: 2 }) }}</div>
          <span class="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
            <ArrowUpRight class="w-3.5 h-3.5" /> Meta mensual: 87%
          </span>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div class="flex justify-between items-center text-slate-500">
            <span class="text-xs font-semibold">Órdenes Procesadas Hoy</span>
            <span class="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg"><ShoppingBag class="w-4 h-4" /></span>
          </div>
          <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ kpis.ordenesHoy }}</div>
          <span class="text-[11px] text-slate-400">Canal Web (22) / POS (12)</span>
        </div>

        <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
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
        <div class="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText class="w-4 h-4 text-blue-500" /> Órdenes y Ventas Recientes (RF-27 al RF-37)
            </h3>
            <router-link to="/admin" class="text-xs text-blue-600 hover:underline font-semibold">Ver todas</router-link>
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
        <div class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center gap-2 text-rose-600 font-bold text-sm">
            <AlertTriangle class="w-4 h-4" />
            <span>Alertas de Quiebre de Stock (RF-42)</span>
          </div>
          <p class="text-xs text-slate-400">Productos que alcanzaron el punto de reorden para Compras:</p>

          <div class="space-y-3">
            <div
              v-for="alert in lowStockAlerts"
              :key="alert.sku"
              class="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg space-y-1"
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

          <button class="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg mt-2">
            Disparar Solicitud a Compras (ERP)
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Edición de Categoría -->
    <div
      v-if="editingCategory"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      @click.self="editingCategory = null"
    >
      <div class="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700">
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="category-modal-title" class="text-base font-bold text-slate-900 dark:text-white">Editar categoría</h2>
            <p class="text-xs text-slate-500 mt-1">Actualiza la información visible en el catálogo.</p>
          </div>
          <button
            type="button"
            class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Cerrar modal"
            @click="editingCategory = null"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form class="p-5 space-y-4" @submit.prevent="saveCategory">
          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre</span>
            <input
              v-model="editingName"
              type="text"
              required
              autofocus
              class="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Descripción</span>
            <textarea
              v-model="editingDescription"
              rows="3"
              class="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
            />
          </label>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="editingCategory = null"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
            >
              <Save class="w-3.5 h-3.5" />
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de Nuevo Producto con Atributos Dinámicos -->
    <div
      v-if="isProductModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      @click.self="isProductModalOpen = false"
    >
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700">
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="product-modal-title" class="text-base font-bold text-slate-900 dark:text-white">Nuevo producto</h2>
            <p class="text-xs text-slate-500 mt-1">Selecciona una categoría para cargar sus atributos sugeridos.</p>
          </div>
          <button type="button" class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar modal" @click="isProductModalOpen = false">
            <X class="w-4 h-4" />
          </button>
        </div>

        <form class="p-5 space-y-5" @submit.prevent="saveProduct">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="block space-y-1.5">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre del producto</span>
              <input v-model="productName" type="text" required placeholder="Ej. Laptop Lenovo ThinkPad" class="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </label>
            <label class="block space-y-1.5">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">SKU</span>
              <input v-model="productSku" type="text" required placeholder="Ej. LAP-LEN-T14" class="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none uppercase" />
            </label>
            <label class="block space-y-1.5">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Marca</span>
              <input v-model="productBrand" type="text" placeholder="Ej. Lenovo" class="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </label>
            <label class="block space-y-1.5">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Precio web (BOB)</span>
              <input v-model.number="productPrice" type="number" min="0" step="0.01" required placeholder="0.00" class="w-full px-3 py-2.5 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
            </label>
          </div>

          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Descripción</span>
            <textarea v-model="productDescription" rows="2" placeholder="Describe las características principales del producto" class="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" />
          </label>

          <label class="block space-y-1.5">
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Categoría</span>
            <select
              :value="selectedProductCategory"
              required
              class="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              @change="updateProductCategory(($event.target as HTMLSelectElement).value)"
            >
              <option value="">Selecciona una categoría</option>
              <option v-for="category in catalogCategories" :key="category.id" :value="category.id">{{ category.nombre }}</option>
            </select>
          </label>

          <section class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div class="p-4 bg-slate-50 dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Imágenes del producto</h3>
                <p class="text-[11px] text-slate-500 mt-1">Hasta 5 archivos JPEG, PNG o WebP. Máximo 5 MB por imagen.</p>
              </div>
              <button type="button" class="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:border-blue-400 text-xs font-semibold text-slate-700" @click="imageInput?.click()">
                <ImagePlus class="w-4 h-4 text-blue-600" />
                Añadir imágenes
              </button>
              <input ref="imageInput" class="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple @change="addProductImages" />
            </div>
            <div v-if="pendingImages.length" class="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div v-for="(image, index) in pendingImages" :key="image.dataUrl" class="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 aspect-square group">
                <img :src="image.dataUrl" :alt="image.name" class="w-full h-full object-cover" />
                <div class="absolute inset-x-0 bottom-0 p-2 bg-slate-950/75 text-white">
                  <p class="truncate text-[10px] font-semibold">{{ image.name }}</p>
                  <p class="text-[10px] text-slate-300">{{ formatImageSize(image.size) }}</p>
                </div>
                <button type="button" class="absolute top-2 right-2 p-1.5 rounded-md bg-white text-rose-600 shadow-sm opacity-0 group-hover:opacity-100" :aria-label="`Eliminar ${image.name}`" @click="removeProductImage(index)">
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div v-else class="p-6 text-center text-xs text-slate-400">Agrega una imagen para mostrar este producto en Marketplace.</div>
          </section>

          <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div class="p-4 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Atributos del producto</h3>
                <p class="text-[11px] text-slate-500 mt-1">Los campos cambian automáticamente según la categoría.</p>
              </div>
              <button type="button" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40" @click="addCustomAttribute">
                <Plus class="w-3.5 h-3.5" />
                Añadir campo
              </button>
            </div>

            <div v-if="productAttributeFields.length" class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div v-for="field in productAttributeFields" :key="field.id" class="relative space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <input v-if="field.custom" v-model="field.label" type="text" class="min-w-0 flex-1 px-2 py-1 text-xs font-semibold bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-blue-500 outline-none" aria-label="Nombre del atributo personalizado" />
                  <span v-else class="text-xs font-semibold text-slate-700 dark:text-slate-300">{{ field.label }}</span>
                  <button v-if="field.custom" type="button" class="p-1 text-slate-400 hover:text-rose-600" :aria-label="`Eliminar ${field.label}`" @click="removeAttribute(field.id)">
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
                <select v-if="field.type === 'select'" v-model="field.value" class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500">
                  <option value="">Selecciona una opción</option>
                  <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
                </select>
                <input v-else v-model="field.value" :type="field.type" :placeholder="field.type === 'number' ? 'Ingresa un valor' : 'Ingresa un valor'" class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500" />
              </div>
            </div>
            <div v-else class="p-8 text-center text-xs text-slate-400">
              Selecciona una categoría para mostrar sus atributos.
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <button type="button" class="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" @click="isProductModalOpen = false">Cancelar</button>
            <button type="submit" :disabled="isSavingProduct" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm">
              <Save class="w-3.5 h-3.5" />
              {{ isSavingProduct ? 'Guardando...' : 'Guardar producto' }}
            </button>
          </div>
          <p v-if="productFormMessage" class="text-xs font-medium text-rose-600">{{ productFormMessage }}</p>
        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL DE GESTIÓN MULTIMEDIA (KAN-19 / RF-03)                         -->
    <!-- Subtareas: KAN-75, KAN-76, KAN-77, KAN-78                           -->
    <!-- =================================================================== -->
    <div
      v-if="selectedMultimediaProduct"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      @click.self="selectedMultimediaProduct = null"
    >
      <div class="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 sm:p-4">
        <ProductMultimediaManager
          :producto="selectedMultimediaProduct"
          @close="selectedMultimediaProduct = null"
          @updated="handleMultimediaUpdated"
        />
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL FORMULARIO REACTIVO DE EDICIÓN DE PRODUCTO (KAN-307 / RF-01)  -->
    <!-- =================================================================== -->
    <div
      v-if="isEditModalOpen && editingProduct"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      @click.self="isEditModalOpen = false"
    >
      <div class="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit3 class="w-4 h-4 text-blue-600" />
              Editar Producto (RF-01 / KAN-307)
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Actualiza las características, precio y estado del ciclo de vida.</p>
          </div>
          <button @click="isEditModalOpen = false" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="submitEditProduct" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU *</label>
              <input v-model="editingProduct.sku" type="text" required class="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
              <input v-model="editingProduct.nombre" type="text" required class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Marca</label>
              <input v-model="editingProduct.marca" type="text" class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio Web (BOB) *</label>
              <input v-model.number="editingProduct.precio" type="number" min="0" step="0.01" required class="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Precio Costo (BOB)</label>
              <input v-model.number="editingProduct.precio_costo" type="number" min="0" step="0.01" class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
              <select v-model="editingProduct.categoria_id" class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500">
                <option value="">Sin categoría asignada</option>
                <option v-for="cat in catalogCategories" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado de Ciclo de Vida</label>
              <select v-model="editingProduct.estado" class="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500">
                <option value="publicado">Publicado (Visible en tienda)</option>
                <option value="borrador">Borrador (Oculto)</option>
                <option value="inactivo">Inactivo (Pausado)</option>
                <option value="descontinuado">Descontinuado (Sin reposición)</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
            <textarea v-model="editingProduct.descripcion" rows="3" class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 resize-none"></textarea>
          </div>

          <div v-if="editFormError" class="p-2.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-medium">
            {{ editFormError }}
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" @click="isEditModalOpen = false" class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
            <button type="submit" :disabled="isSavingEdit" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm disabled:opacity-60">
              <Save class="w-3.5 h-3.5" />
              {{ isSavingEdit ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE PRODUCTO (KAN-291)          -->
    <!-- =================================================================== -->
    <div
      v-if="productToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div class="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Trash2 class="w-6 h-6" />
        </div>
        <div class="text-center space-y-1">
          <h3 class="text-base font-bold text-slate-900 dark:text-white">¿Eliminar este producto?</h3>
          <p class="text-xs text-slate-500">
            Se eliminará el producto <strong class="text-slate-800 dark:text-slate-200">"{{ productToDelete.nombre }}"</strong> (SKU: {{ productToDelete.sku }}) junto con todos sus recursos multimedia asociados en Supabase Storage.
          </p>
        </div>
        <div class="flex justify-center gap-3 pt-2">
          <button @click="productToDelete = null" class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button @click="confirmDeleteProduct" :disabled="isDeletingProduct" class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm disabled:opacity-60">
            {{ isDeletingProduct ? 'Eliminando...' : 'Sí, eliminar producto' }}
          </button>
        </div>
      </div>

            <!-- Matriz de asignación de precios (KAN-298) -->
      <div
        class="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
      >
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Settings2 class="w-4 h-4 text-blue-500" />
              Matriz de asignación de precios
            </h3>

            <p class="text-xs text-slate-500 mt-1">
              Asigna la lista de precios correspondiente a cada sucursal y canal.
            </p>
          </div>

          <span
            class="px-2.5 py-1 rounded-full text-[10px] font-bold
                  bg-blue-50 text-blue-700
                  dark:bg-blue-950/40 dark:text-blue-300"
          >
            KAN-298
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead
              class="bg-slate-50 dark:bg-slate-800
                    text-slate-500 font-semibold"
            >
              <tr>
                <th class="p-3">Sucursal</th>
                <th class="p-3">Web</th>
                <th class="p-3">POS</th>
                <th class="p-3">B2B</th>
              </tr>
            </thead>

            <tbody
              class="divide-y divide-slate-100
                    dark:divide-slate-800"
            >
              <tr
                v-for="sucursal in sucursales"
                :key="sucursal.id"
              >
                <td class="p-3">
                  <div class="font-semibold text-slate-800 dark:text-slate-200">
                    {{ sucursal.nombre }}
                  </div>
                </td>

                <td class="p-3">
                  <select
                    v-model="sucursal.precios.web"
                    class="w-full min-w-[170px] px-2.5 py-2
                          border border-slate-200 dark:border-slate-700
                          rounded-lg bg-white dark:bg-slate-800
                          text-slate-700 dark:text-slate-200
                          text-xs focus:outline-none focus:ring-2
                          focus:ring-blue-500"
                  >
                    <option
                      v-for="lista in listasPrecios"
                      :key="`web-${sucursal.id}-${lista}`"
                      :value="lista"
                    >
                      {{ lista }}
                    </option>
                  </select>
                </td>

                <td class="p-3">
                  <select
                    v-model="sucursal.precios.pos"
                    class="w-full min-w-[170px] px-2.5 py-2
                          border border-slate-200 dark:border-slate-700
                          rounded-lg bg-white dark:bg-slate-800
                          text-slate-700 dark:text-slate-200
                          text-xs focus:outline-none focus:ring-2
                          focus:ring-blue-500"
                  >
                    <option
                      v-for="lista in listasPrecios"
                      :key="`pos-${sucursal.id}-${lista}`"
                      :value="lista"
                    >
                      {{ lista }}
                    </option>
                  </select>
                </td>

                <td class="p-3">
                  <select
                    v-model="sucursal.precios.b2b"
                    class="w-full min-w-[170px] px-2.5 py-2
                          border border-slate-200 dark:border-slate-700
                          rounded-lg bg-white dark:bg-slate-800
                          text-slate-700 dark:text-slate-200
                          text-xs focus:outline-none focus:ring-2
                          focus:ring-blue-500"
                  >
                    <option
                      v-for="lista in listasPrecios"
                      :key="`b2b-${sucursal.id}-${lista}`"
                      :value="lista"
                    >
                      {{ lista }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          class="flex items-center justify-between pt-3
                border-t border-slate-100 dark:border-slate-800"
        >
          <p class="text-[11px] text-slate-400">
            Los cambios realizados en esta vista representan la asignación
            actual de cada lista por sucursal y canal.
          </p>

          <button
            type="button"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700
                  text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Guardar asignaciones
          </button>
        </div>
      </div>

            <!-- Visualización de precios dual BOB / USD (KAN-299) -->
      <div
        class="bg-white dark:bg-slate-900 p-5 rounded-xl
              border border-slate-200 dark:border-slate-800
              shadow-sm space-y-4"
      >
        <div class="flex flex-col sm:flex-row justify-between
                    items-start sm:items-center gap-3">

          <div>
            <h3
              class="text-sm font-bold text-slate-800
                    dark:text-white flex items-center gap-2"
            >
              <DollarSign class="w-4 h-4 text-emerald-500" />

              Visualización de precios
            </h3>

            <p class="text-xs text-slate-500 mt-1">
              Consulta los precios en moneda nacional y su equivalente en dólares.
            </p>
          </div>

          <span
            class="px-2.5 py-1 rounded-full text-[10px]
                  font-bold bg-emerald-50 text-emerald-700
                  dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            BOB / USD
          </span>
        </div>

        <!-- Tipo de cambio -->
        <div
          class="flex items-center justify-between
                px-4 py-3 rounded-lg
                bg-slate-50 dark:bg-slate-800
                border border-slate-100 dark:border-slate-700"
        >
          <span class="text-xs text-slate-500">
            Tipo de cambio referencial
          </span>

          <span class="text-sm font-bold text-slate-800 dark:text-white">
            1 USD = {{ tipoCambioUsd.toFixed(2) }} BOB
          </span>
        </div>

        <!-- Lista de precios -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div
            v-for="precio in preciosDual"
            :key="precio.id"
            class="p-4 rounded-xl
                  border border-slate-200
                  dark:border-slate-700
                  hover:shadow-sm transition"
          >
            <div class="flex justify-between items-start gap-3">

              <div>
                <p
                  class="text-sm font-bold
                        text-slate-800 dark:text-white"
                >
                  {{ precio.producto }}
                </p>

                <p class="text-[11px] text-slate-400 mt-1">
                  {{ precio.lista }}
                </p>
              </div>

              <span
                class="text-[10px] font-semibold
                      px-2 py-1 rounded-full
                      bg-blue-50 text-blue-700
                      dark:bg-blue-950/40
                      dark:text-blue-300"
              >
                Precio
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-4">

              <!-- BOB -->
              <div
                class="p-3 rounded-lg
                      bg-slate-50 dark:bg-slate-800"
              >
                <p class="text-[10px] uppercase
                          text-slate-400 font-semibold">
                  Bolivianos
                </p>

                <p
                  class="text-lg font-extrabold
                        text-slate-900 dark:text-white mt-1"
                >
                  BOB
                  {{ precio.precioBob.toLocaleString('es-BO', {
                    minimumFractionDigits: 2
                  }) }}
                </p>
              </div>

              <!-- USD -->
              <div
                class="p-3 rounded-lg
                      bg-emerald-50
                      dark:bg-emerald-950/30"
              >
                <p class="text-[10px] uppercase
                          text-emerald-600
                          dark:text-emerald-400
                          font-semibold">
                  Dólares
                </p>

                <p
                  class="text-lg font-extrabold
                        text-emerald-700
                        dark:text-emerald-300 mt-1"
                >
                  USD
                  {{ convertirAUsd(precio.precioBob).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }) }}
                </p>
              </div>

            </div>
          </div>

        </div>

        <p class="text-[10px] text-slate-400">
          El equivalente USD se calcula a partir del precio BOB utilizando
          el tipo de cambio referencial mostrado arriba.
        </p>
      </div>
    </div>
  </div>
</template>
