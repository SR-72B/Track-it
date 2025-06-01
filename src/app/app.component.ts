// src/app/app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { Router, RouterModule } from '@angular/router';         // Added RouterModule
import { CommonModule } from '@angular/common';               // Added CommonModule
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController, MenuController, ToastController, IonicModule } from '@ionic/angular'; // Added IonicModule
import { AuthService, User } from './auth/auth.service'; // Ensure User is defined/exported in AuthService
import { filter, switchMap, tap, catchError } from 'rxjs/operators'; // Added catchError
import { Subscription, of } from 'rxjs'; // Added of

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
  // Define the pages for the menu
  // Updated icon names for modern Ionicons (usually with -outline)
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
  currentUser: User | null = null; // Explicitly declare and type currentUser

  private authSubscription: Subscription | undefined;
  private swSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private router: Router,
    private menuCtrl: MenuController,
    private alertController: AlertController,
    private toastController: ToastController,
    private swUpdate: SwUpdate // Ensure ServiceWorkerModule is registered in main.ts providers
  ) {}

  ngOnInit() {
    this.authSubscription = this.authService.currentUser$.pipe(
      tap(user => this.currentUser = user), // Keep currentUser property updated
      switchMap(user => {
        if (user && user.uid) {
          // Assuming authService.isRetailer() internally knows about the current user
          // or uses the latest auth state to determine retailer status.
          return this.authService.isRetailer().pipe(
            catchError(err => {
              console.error('Error determining retailer status:', err);
              // Default to false if there's an error checking retailer status
              return of(false);
            })
          );
        }
        return of(false); // If no user or no uid, default to not being a retailer
      })
    ).subscribe(isRetailerValue => {
      this.isRetailer = isRetailerValue;
    });

    if (this.swUpdate.isEnabled) {
      this.swSubscription = this.swUpdate.versionUpdates.pipe(
        filter((evt: any): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        tap((evt: VersionReadyEvent) => { // Use tap for side-effects like logging
          console.log(`Current version is ${evt.currentVersion.hash}`);
          console.log(`Latest version is ${evt.latestVersion.hash}`);
        })
      ).subscribe(async (evt: VersionReadyEvent) => { // evt is now the VersionReadyEvent
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
      // No need to manually set this.isRetailer = false; authState change should trigger it.
      // No need to manually navigate; AuthService.logout() or routing guards should handle it.
      this.menuCtrl.close();
    } catch (error: any) {
      console.error('Error during logout:', error);
      const toast = await this.toastController.create({ // ToastController is used here
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
