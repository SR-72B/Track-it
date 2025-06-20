// src/app/app.module.ts
import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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

// Auth guards
import { AuthGuard } from './auth/auth.guard';
import { RetailerGuard } from './auth/retailer.guard';
import { CustomerGuard } from './auth/customer.guard';
import { SubscriptionGuard } from './auth/subscription.guard';

// Services
import { AuthService } from './auth/auth.service';
import { OrderService } from './retailer/order-management/order.service';
import { CustomerOrderService } from './customer/order/customer-order.service';
import { PaymentService } from './payment/payment.service';
import { FileService } from './shared/services/file.service';

import { ServiceWorkerModule } from '@angular/service-worker';

@NgModule({
  declarations: [
    // Remove AppComponent from declarations since it's standalone
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot({
      rippleEffect: false,
      mode: 'ios'
    }),
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule.enablePersistence(),
    AngularFireStorageModule,
    AngularFireFunctionsModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    // Import standalone AppComponent instead
    AppComponent
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    
    // Auth Guards
    AuthGuard,
    RetailerGuard,
    CustomerGuard,
    SubscriptionGuard,
    
    // Services
    AuthService,
    OrderService,
    CustomerOrderService,
    PaymentService,
    FileService
  ]
  // Remove bootstrap since AppComponent is standalone
})
export class AppModule {}
