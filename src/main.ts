// src/main.ts
import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular'; // Ensure IonicModule is imported
import { provideServiceWorker } from '@angular/service-worker';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes'; // Corrected: app.routes (plural)
import { environment } from './environments/environment';

// Import HttpClient provider function if you use HttpClient
// import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

// If you use AngularFire, import necessary providers
// import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
// import { provideAuth, getAuth } from '@angular/fire/auth';
// import { provideFirestore, getFirestore } from '@angular/fire/firestore';
// import { provideStorage, getStorage } from '@angular/fire/storage';
// import { FIREBASE_OPTIONS } from '@angular/fire/compat';


if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    // If you still have an AppModule and want to import its providers (less common with full standalone)
    // importProvidersFrom(AppModule),

    // Ionic Global Providers
    importProvidersFrom(IonicModule.forRoot({})), // Configure Ionic globally
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    // Angular Router Provider
    provideRouter(routes), // Setup routing with your app.routes.ts

    // Angular Service Worker Provider
    provideServiceWorker('ngsw-worker.js', {
        enabled: !isDevMode(), // Enable for production, disable for development
        registrationStrategy: 'registerWhenStable:30000'
    }),

    // Example: HttpClient providers (if you use HttpClient)
    // provideHttpClient(withInterceptorsFromDi()),

    // Example: Firebase providers (using @angular/fire modern providers)
    // importProvidersFrom(provideFirebaseApp(() => initializeApp(environment.firebase))),
    // importProvidersFrom(provideAuth(() => getAuth())),
    // importProvidersFrom(provideFirestore(() => getFirestore())),
    // importProvidersFrom(provideStorage(() => getStorage())),

    // Example: Firebase providers (using @angular/fire/compat)
    // { provide: FIREBASE_OPTIONS, useValue: environment.firebase },

    // Add other global providers your app needs here
    // e.g., your AuthService, OrderService, etc., if they are not providedIn: 'root'
    // or if you need to configure them globally.
  ]
}).catch(err => console.error(err));

