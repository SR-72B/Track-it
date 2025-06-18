// src/app/app.module.ts
import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

// Firebase imports
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { AngularFireFunctionsModule } from '@angular/fire/compat/functions';

// Environment configuration
import { environment } from '../environments/environment';

// Auth guard
import { AuthGuard } from './auth/auth.guard';
import { RetailerGuard } from './auth/retailer.guard';
import { CustomerGuard } from './auth/customer.guard';
import { SubscriptionGuard } from './auth/subscription.guard';
import { ServiceWorkerModule } from '@angular/service-worker';

@NgModule({
  // AppComponent is standalone and bootstrapped in main.ts (via bootstrapApplication),
  // so it should not be declared in any NgModule.
  declarations: [],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AngularFireStorageModule,
    AngularFireFunctionsModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    AuthGuard,
    RetailerGuard,
    CustomerGuard,
    SubscriptionGuard
  ],
  // AppComponent is standalone and bootstrapped in main.ts via bootstrapApplication.
})
export class AppModule {}
