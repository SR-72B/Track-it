// src/app/app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController, MenuController, ToastController, IonicModule } from '@ionic/angular';
import { AuthService, User } from './auth/auth.service';
import { filter, map, takeUntil } from 'rxjs/operators';
import { Subscription, Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonicModule
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  retailerPages = [
    { title: 'Dashboard', url: '/retailer/dashboard', icon: 'grid-outline' },
    { title: 'Orders', url: '/retailer/orders', icon: 'cart-outline' },
    { title: 'Order Forms', url: '/retailer/forms', icon: 'document-text-outline' },
    { title: 'Manage Subscription', url: '/payment/subscription-details', icon: 'card-outline' },
    { title: 'Analytics', url: '/retailer/analytics', icon: 'analytics-outline' },
    { title: 'Profile', url: '/retailer/profile', icon: 'person-circle-outline' },
    { title: 'Messages', url: '/communication/chats', icon: 'chatbubbles-outline' },
    { title: 'Notifications', url: '/communication/notifications', icon: 'notifications-outline' }
  ];

  customerPages = [
    { title: 'Dashboard', url: '/customer/dashboard', icon: 'grid-outline' },
    { title: 'My Orders', url: '/customer/orders', icon: 'cart-outline' },
    { title: 'Place Order', url: '/customer/forms', icon: 'document-text-outline' },
    { title: 'Order Tracking', url: '/customer/tracking', icon: 'location-outline' },
    { title: 'Account', url: '/customer/profile', icon: 'person-circle-outline' },
    { title: 'Messages', url: '/communication/chats', icon: 'chatbubbles-outline' },
    { title: 'Notifications', url: '/communication/notifications', icon: 'notifications-outline' }
  ];

  isRetailer: boolean = false;
  currentUser: User | null = null;
  isLoading: boolean = true;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private menuCtrl: MenuController,
    private alertController: AlertController,
    private toastController: ToastController,
    private swUpdate: SwUpdate
  ) {}

  ngOnInit() {
    this.initializeAuth();
    this.initializeServiceWorker();
  }

  private initializeAuth() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.isLoading = false;
          
          if (user && user.uid) {
            this.authService.isRetailer()
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (isRetailerValue) => {
                  this.isRetailer = isRetailerValue;
                },
                error: (error) => {
                  console.error('Error checking retailer status:', error);
                  this.isRetailer = false;
                }
              });
          } else {
            this.isRetailer = false;
          }
        },
        error: (error) => {
          console.error('Error in auth subscription:', error);
          this.isLoading = false;
          this.currentUser = null;
          this.isRetailer = false;
        }
      });
  }

  private initializeServiceWorker() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(
          filter((evt: any): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: async (evt: VersionReadyEvent) => {
            console.log(`Current version: ${evt.currentVersion.hash}`);
            console.log(`Latest version: ${evt.latestVersion.hash}`);
            await this.promptForUpdate();
          },
          error: (error) => {
            console.error('Service Worker update error:', error);
          }
        });

      this.swUpdate.checkForUpdate().catch(error => {
        console.error('Error checking for updates:', error);
      });
    }
  }

  private async promptForUpdate() {
    const alert = await this.alertController.create({
      header: 'Update Available',
      message: 'A new version of the app is available. Would you like to update now?',
      backdropDismiss: false,
      buttons: [
        { 
          text: 'Not Now', 
          role: 'cancel',
          handler: () => {
            console.log('User declined update');
            return true;
          }
        },
        {
          text: 'Update',
          handler: async () => {
            try {
              await this.swUpdate.activateUpdate();
              document.location.reload();
              return true;
            } catch (error) {
              console.error('Error activating update:', error);
              this.showToast('Update failed. Please try again.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async logout() {
    const loading = await this.showToast('Logging out...', 'medium', 1000);
    
    try {
      await this.authService.logout();
      await this.menuCtrl.close();
      this.router.navigate(['/auth/login']);
      this.showToast('Logged out successfully', 'success');
    } catch (error: any) {
      console.error('Error during logout:', error);
      this.showToast(
        `Logout failed: ${error.message || 'Please try again.'}`, 
        'danger'
      );
    }
  }

  async closeMenu() {
    await this.menuCtrl.close();
  }

  navigateToPage(url: string) {
    this.router.navigate([url]);
    this.closeMenu();
  }

  getDisplayName(): string {
    if (this.currentUser?.displayName) {
      return this.currentUser.displayName;
    }
    if (this.currentUser?.email) {
      return this.currentUser.email.split('@')[0];
    }
    return 'User';
  }

  getAccountType(): string {
    return this.isRetailer ? 'Retailer Account' : 'Customer Account';
  }

  private async showToast(message: string, color: string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'top',
      buttons: duration > 2000 ? [
        {
          icon: 'close',
          role: 'cancel'
        }
      ] : undefined
    });
    await toast.present();
    return toast;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

