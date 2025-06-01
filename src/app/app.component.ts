// src/app/app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';         // Import RouterModule
import { CommonModule } from '@angular/common';               // Import CommonModule
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController, MenuController, ToastController, IonicModule } from '@ionic/angular'; // Import IonicModule
import { AuthService, User } from './auth/auth.service'; // Ensure User is defined/exported in AuthService
import { filter, map } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'], // Ensure 'app.component.scss' exists in this folder
  standalone: true,                  // Mark as standalone
  imports: [
    CommonModule,                    // For *ngIf, *ngFor
    RouterModule,                  // For routerLink, routerLinkActive, <router-outlet>
    IonicModule                      // For all ion-* components (ion-app, ion-menu, ion-icon, etc.)
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  // Ensure your icon names are up-to-date with Ionicons (often adding -outline)
  retailerPages = [
    { title: 'Dashboard', url: '/retailer/dashboard', icon: 'grid-outline' },
    { title: 'Orders', url: '/retailer/orders', icon: 'cart-outline' },
    { title: 'Order Forms', url: '/retailer/forms', icon: 'document-text-outline' },
    { title: 'Manage Subscription', url: '/payment/manage-subscription', icon: 'card-outline' },
    { title: 'Analytics', url: '/retailer/analytics', icon: 'analytics-outline'},
    { title: 'Profile', url: '/retailer/profile', icon: 'person-circle-outline' },
    { title: 'Messages', url: '/communication/chats', icon: 'chatbubbles-outline' },
    { title: 'Notifications', url: '/communication/notifications', icon: 'notifications-outline' }
  ];

  customerPages = [
    { title: 'Dashboard', url: '/customer/dashboard', icon: 'grid-outline' },
    { title: 'My Orders', url: '/customer/orders', icon: 'cart-outline' },
    { title: 'Place Order', url: '/customer/forms', icon: 'document-text-outline' },
    { title: 'Account', url: '/auth/account-management', icon: 'person-circle-outline'},
    { title: 'Messages', url: '/communication/chats', icon: 'chatbubbles-outline' },
    { title: 'Notifications', url: '/communication/notifications', icon: 'notifications-outline' }
  ];

  isRetailer: boolean = false;
  currentUser: User | null = null;

  private authSubscription: Subscription | undefined;
  private swSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private router: Router,
    private menuCtrl: MenuController,
    private alertController: AlertController,
    private toastController: ToastController, // Injected, used in logout
    private swUpdate: SwUpdate
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.uid) {
        this.authService.isRetailer().subscribe(isRetailerValue => {
          this.isRetailer = isRetailerValue;
        });
      } else {
        this.isRetailer = false;
      }
    });

    if (this.swUpdate.isEnabled) {
      this.swSubscription = this.swUpdate.versionUpdates.pipe(
        filter((evt: any): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        map((evt: VersionReadyEvent) => {
          console.log(`Current version is ${evt.currentVersion.hash}`);
          console.log(`Latest version is ${evt.latestVersion.hash}`);
        })
      ).subscribe(async () => {
        const alert = await this.alertController.create({
          header: 'Update Available',
          message: 'A new version of the app is available. Load the new version?',
          backdropDismiss: false,
          buttons: [
            { text: 'Not Now', role: 'cancel' },
            {
              text: 'Update',
              handler: () => {
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
      this.menuCtrl.close();
      // Navigation to login page is typically handled by the AuthService or routing guards
      // If not, uncomment: this.router.navigate(['/auth/login']);
    } catch (error: any) {
      console.error('Error during logout:', error);
      const toast = await this.toastController.create({
        message: `Logout failed: ${error.message || 'Please try again.'}`,
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      toast.present();
    }
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.swSubscription) {
      this.swSubscription.unsubscribe();
    }
  }
}
