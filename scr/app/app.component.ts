// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { AlertController, MenuController, ToastController } from '@ionic/angular';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  retailerPages = [
    { title: 'Dashboard', url: '/retailer/dashboard', icon: 'grid' },
    { title: 'Orders', url: '/retailer/orders', icon: 'cart' },
    { title: 'Order Forms', url: '/retailer/forms', icon: 'document-text' },
    { title: 'Subscription', url: '/payment/subscription-details', icon: 'card' },
    { title: 'Messages', url: '/communication/chats', icon: 'chatbubbles' },
    { title: 'Notifications', url: '/communication/notifications', icon: 'notifications' }
  ];

  customerPages = [
    { title: 'Dashboard', url: '/customer/dashboard', icon: 'grid' },
    { title: 'My Orders', url: '/customer/orders', icon: 'cart' },
    { title: 'Place Order', url: '/customer/forms', icon: 'document-text' },
    { title: 'Messages', url: '/communication/chats', icon: 'chatbubbles' },
    { title: 'Notifications', url: '/communication/notifications', icon: 'notifications' }
  ];

  isRetailer = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private menuCtrl: MenuController,
    private alertController: AlertController,
    private toastController: ToastController,
    private swUpdate: SwUpdate
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.authService.isRetailer().subscribe(isRetailer => {
          this.isRetailer = isRetailer;
        });
      }
    });

    // Check for app updates
    if (this.swUpdate.isEnabled) {
      this.swUpdate.available.subscribe(async () => {
        const alert = await this.alertController.create({
          header: 'Update Available',
          message: 'A new version of the app is available. Load the new version?',
          buttons: [
            {
              text: 'Not Now',
              role: 'cancel'
            },
            {
              text: 'Update',
              handler: () => {
                window.location.reload();
              }
            }
          ]
        });
        await alert.present();
      });
    }
  }

  logout() {
    this.authService.logout();
    this.menuCtrl.close();
  }
}