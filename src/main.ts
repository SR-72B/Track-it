// src/main.ts
// TEST COMMENT TO VERIFY PUSH - June 1, 2025, 12:08 PM EDT
//import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
// ... rest of your main.ts file
import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { provideServiceWorker } from '@angular/service-worker';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes'; // Ensure this path is correct and file exports 'routes'
import { environment } from './environments/environment';

// Import HttpClient provider function if you use HttpClient
// import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

// For AngularFire compat
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireStorageModule } from '@angular/fire/compat/storage'; // If you use storage

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
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

    // Firebase providers (using @angular/fire/compat)
    // This is necessary for AngularFireAuth, AngularFirestore from the 'compat' path to work.
    { provide: FIREBASE_OPTIONS, useValue: environment.firebase },
    importProvidersFrom(
      AngularFireModule.initializeApp(environment.firebase), // Not strictly needed if FIREBASE_OPTIONS is provided, but often included
      AngularFireAuthModule,
      AngularFirestoreModule,
      AngularFireStorageModule
    ),


    // Example: HttpClient providers (if you use HttpClient for non-Firebase requests)
    // provideHttpClient(withInterceptorsFromDi()),


    // Add other global providers your app needs here.
    // Services already marked with `providedIn: 'root'` generally don't need to be added here
    // unless they require specific `forRoot` configuration that isn't handled by `importProvidersFrom`.
  ]
}).catch(err => console.error(err));


