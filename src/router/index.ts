import { createRouter, createWebHistory } from 'vue-router';
import MarketplaceView from '@/views/marketplace/MarketplaceView.vue';
import PosView from '@/views/pos/PosView.vue';
import AdminView from '@/views/admin/AdminView.vue';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';

type ProtectedRouteMeta = {
  title: string;
  requiresAuth?: boolean;
  allowedRoles?: UserRole[];
};

const routes = [
  {
    path: '/',
    redirect: '/marketplace'
  },
  {
    path: '/marketplace',
    name: 'marketplace',
    component: MarketplaceView,
    meta: { title: 'Marketplace Digital — MaxiConecta' } satisfies ProtectedRouteMeta
  },
  {
    path: '/pos',
    name: 'pos',
    component: PosView,
    meta: {
      title: 'Punto de Venta Físico (POS) — MaxiConecta',
      requiresAuth: true,
      allowedRoles: ['cajero', 'administrador']
    } satisfies ProtectedRouteMeta
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: {
      title: 'Panel Administrativo — MaxiConecta',
      requiresAuth: true,
      allowedRoles: ['administrador', 'gerente_comercial']
    } satisfies ProtectedRouteMeta
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  document.title = (to.meta.title as string) || 'MaxiConecta';

  const authStore = useAuthStore();
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const allowedRoles = to.meta.allowedRoles as UserRole[] | undefined;

  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'marketplace', query: { redirect: to.fullPath } };
  }

  if (allowedRoles && !allowedRoles.includes(authStore.userRole)) {
    return { name: 'marketplace', query: { forbidden: 'true' } };
  }

  return true;
});

export default router;
