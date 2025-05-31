// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker'; // Import VersionReadyEvent
import { AlertController, MenuController, ToastController } from '@ionic/angular';
import { AuthService } from './auth/auth.service';
import { filter, map } from 'rxjs/operators'; // Import filter and map

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  // Define the pages for the menu
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
    { title: 'Place Order', url: '/customer/forms', icon: 'document-text' }, // This likely navigates to a list of available forms
    { title: 'Messages', url: '/communication/chats', icon: 'chatbubbles' },
    { title: 'Notifications', url: '/communication/notifications', icon: 'notifications' }
  ];

  // Declare the isRetailer property
  isRetailer: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private menuCtrl: MenuController,
    private alertController: AlertController,
    private toastController: ToastController, // ToastController is injected but not used in this snippet, ensure it's used if needed
    private swUpdate: SwUpdate
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.authService.isRetailer().subscribe(isRetailerValue => { // Use a different variable name to avoid shadowing
          this.isRetailer = isRetailerValue;
        });
      } else {
        // If no user, they are not a retailer
        this.isRetailer = false;
      }
    });

    // Check for app updates
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt: any): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        map((evt: VersionReadyEvent) => {
          console.log(`Current version is ${evt.currentVersion.hash}`);
          console.log(`Latest version is ${evt.latestVersion.hash}`);
          // The actual event data isn't strictly needed for the subscribe handler below
          // if you're just reacting to the fact that a version is ready.
        })
      ).subscribe(async () => { // This will trigger when a VERSION_READY event is emitted
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
                // Activate the update and reload for the new version to take effect.
                this.swUpdate.activateUpdate().then(() => document.location.reload());
              }
            }
          ]
        });
        await alert.present();
      });
    }
  }

  async logout() {
    try {
      await this.authService.logout();
      this.isRetailer = false; // Reset state on logout
      this.menuCtrl.close();
      this.router.navigate(['/auth/login']); // Redirect to login after logout
    } catch (error) {
      console.error('Error during logout:', error);
      const toast = await this.toastController.create({
        message: 'Logout failed. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }
}