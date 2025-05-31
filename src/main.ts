// src/main.ts
import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular'; // Ensure IonicModule is imported
import { provideServiceWorker } from '@angular/service-worker';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes'; // Make sure you have an app.routes.ts file or import routes from app-routing.module.ts
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    // If you still have an AppModule and want to import its providers and declared module imports:
    // importProvidersFrom(AppModule), 
    // OR, list providers individually:
    importProvidersFrom(IonicModule.forRoot({})), // Configure Ionic globally
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes), // Setup routing
    provideServiceWorker('ngsw-worker.js', {
        enabled: !isDevMode(),
        registrationStrategy: 'registerWhenStable:30000'
    }),
    // Add other global providers here
    // e.g., importProvidersFrom(HttpClientModule),
    // provideFirebaseApp(() => initializeApp(environment.firebase)), // Example for Firebase
    // provideAuth(() => getAuth()),
    // provideFirestore(() => getFirestore()),
  ]
}).catch(err => console.error(err));