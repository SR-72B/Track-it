// src/app/retailer/profile/retailer-profile.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router'; // Added RouterModule
import { CommonModule } from '@angular/common'; // Added CommonModule
import { AlertController, LoadingController, IonicModule, ToastController } from '@ionic/angular'; // Added IonicModule, ToastController
import { Observable, Subscription, of, forkJoin, firstValueFrom } from 'rxjs'; // Added of, forkJoin, firstValueFrom
import { map, first, filter, catchError, finalize, switchMap, tap } from 'rxjs/operators';

import { AuthService, User } from '../../auth/auth.service'; // Ensure User is exported
import { OrderService, Order } from '../order-management/order.service'; // Ensure Order is exported
import { FormBuilderService, OrderForm } from '../form-builder/form-builder.service'; // Ensure OrderForm is exported

@Component({
  selector: 'app-retailer-profile',
  templateUrl: './retailer-profile.component.html',
  styleUrls: ['./retailer-profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class RetailerProfileComponent implements OnInit, OnDestroy {
  user: User | null = null; // Store the user object directly
  isLoading = true;
  errorMessage: string | null = null;
  statistics = {
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalForms: 0
  };

  private profileDataSubscription: Subscription | undefined;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private formBuilderService: FormBuilderService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController // Added ToastController
  ) {}

  ngOnInit() {
    this.loadProfileData();
  }

  async loadProfileData(refresherEvent?: any) {
    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      loader = await this.loadingController.create({
        message: 'Loading profile...',
        spinner: 'crescent'
      });
      await loader.present();
    }

    if (this.profileDataSubscription) {
      this.profileDataSubscription.unsubscribe();
    }

    this.profileDataSubscription = this.authService.currentUser$.pipe(
      first((user): user is User => !!user && !!user.uid), // Get first valid user
      switchMap(user => {
        this.user = user; // Set the user property

        const orders$ = this.orderService.getRetailerOrders(user.uid).pipe(
          catchError(err => {
            console.error('Error loading orders for statistics:', err);
            this.errorMessage = 'Could not load order statistics.';
            return of([]); // Return empty array on error for orders
          })
        );

        const forms$ = this.formBuilderService.getRetailerForms(user.uid).pipe(
          catchError(err => {
            console.error('Error loading forms for statistics:', err);
            if (!this.errorMessage) this.errorMessage = 'Could not load form statistics.';
            return of([]); // Return empty array on error for forms
          })
        );

        return forkJoin({ orders: orders$, forms: forms$ });
      }),
      catchError(authError => {
        console.error('Error fetching current user for profile:', authError);
        this.errorMessage = 'Failed to load user data. Please try logging in again.';
        this.user = null; // Clear user on auth error
        return of(null); // Stop the stream or return a default structure for forkJoin
      }),
      finalize(async () => {
        this.isLoading = false;
        if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
      })
    ).subscribe(result => {
      if (result && result.orders && result.forms) {
        const { orders, forms } = result;
        this.statistics.totalOrders = orders.length;
        this.statistics.activeOrders = orders.filter(
          o => o.status !== 'delivered' && o.status !== 'cancelled'
        ).length;
        this.statistics.completedOrders = orders.filter(
          o => o.status === 'delivered'
        ).length;
        this.statistics.totalForms = forms.length;
      } else if (!this.errorMessage) {
        // This case might be hit if currentUser$ was null or errored before switchMap
        this.errorMessage = this.errorMessage || 'Profile data could not be loaded.';
      }
    });
  }

  editProfile() {
    this.router.navigate(['/auth/account-management']); // Corrected path if account-management is under auth
  }

  viewSubscription() {
    this.router.navigate(['/payment/subscription-details']);
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          cssClass: 'alert-button-danger',
          handler: async () => {
            const loading = await this.loadingController.create({ message: 'Logging out...' });
            await loading.present();
            try {
              await this.authService.logout();
              // Navigation to login is handled by AuthService or App routing guards
            } catch (error: any) {
              console.error('Logout failed:', error);
              this.showToast(`Logout failed: ${error.message || 'Unknown error'}`, 'danger');
            } finally {
              await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  doRefresh(event: any) {
    this.loadProfileData(event);
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  ngOnDestroy() {
    if (this.profileDataSubscription) {
      this.profileDataSubscription.unsubscribe();
    }
  }
}
