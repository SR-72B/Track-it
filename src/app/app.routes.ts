// src/app/app.routes.ts
import { Routes } from '@angular/router';

// Optional: Import a PageNotFoundComponent if you have one for wildcard routes
// import { PageNotFoundComponent } from './core/components/page-not-found/page-not-found.component'; // Example path

// Optional: Import your auth guard if you use one
import { AuthGuard } from './auth/auth.guard'; // Ensure this path and guard are correct

export const routes: Routes = [
  // Default redirect:
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  // Authentication routes
  // Assumes you will create an 'auth.routes.ts' file exporting AUTH_ROUTES
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(r => r.AUTH_ROUTES)
    // No AuthGuard here typically, or a reverse guard (e.g., if logged in, redirect away from login)
  },

  // Retailer specific routes
  // Assumes you will create a 'retailer.routes.ts' file exporting RETAILER_ROUTES
  {
    path: 'retailer',
    loadChildren: () => import('./retailer/retailer.routes').then(r => r.RETAILER_ROUTES),
    canActivate: [AuthGuard] // Protected section
  },

  // Customer specific routes
  // Assumes you will create a 'customer.routes.ts' file exporting CUSTOMER_ROUTES
  {
    path: 'customer',
    loadChildren: () => import('./customer/customer.routes').then(r => r.CUSTOMER_ROUTES),
    canActivate: [AuthGuard] // Protected section
  },

  // Communication routes (chats, notifications)
  // Assumes you will create a 'communication.routes.ts' file exporting COMMUNICATION_ROUTES
  {
    path: 'communication',
    loadChildren: () => import('./communication/communication.routes').then(r => r.COMMUNICATION_ROUTES),
    canActivate: [AuthGuard] // Protected section
  },

  // Payment routes (subscription details)
  // Assumes you will create a 'payment.routes.ts' file exporting PAYMENT_ROUTES
  {
    path: 'payment',
    loadChildren: () => import('./payment/payment.routes').then(r => r.PAYMENT_ROUTES), // Assuming plural 'routes'
    canActivate: [AuthGuard] // Protected section
  },

  // Example of a route to a root-level standalone component:
  // {
  //   path: 'about-us',
  //   loadComponent: () => import('./about-us/about-us.component').then(c => c.AboutUsComponent)
  // },

  // Wildcard route for 404 Page Not Found
  // Ensure this is the LAST route in the configuration.
  // { path: '**', component: PageNotFoundComponent } // Create and import PageNotFoundComponent
  // OR, redirect to a known page:
  { path: '**', redirectTo: '/auth/login' } // Or your preferred 404 handling
];