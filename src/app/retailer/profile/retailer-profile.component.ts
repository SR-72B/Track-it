// src/app/retailer/profile/retailer-profile.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../auth/auth.service';
import { OrderService } from '../order-management/order.service';
import { FormBuilderService } from '../form-builder/form-builder.service';

@Component({
  selector: 'app-retailer-profile',
  templateUrl: './retailer-profile.component.html',
  styleUrls: ['./retailer-profile.component.scss']
})
export class RetailerProfileComponent implements OnInit {
  user: any;
  isLoading = true;
  statistics = {
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    totalForms: 0
  };

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private formBuilderService: FormBuilderService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Loading profile...',
      spinner: 'crescent'
    });
    await loading.present();

    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.user = user;
        this.loadStatistics(user.uid);
      } else {
        loading.dismiss();
        this.isLoading = false;
      }
    });
  }

  loadStatistics(userId: string) {
    // Get total orders
    this.orderService.getRetailerOrders(userId).subscribe(orders => {
      this.statistics.totalOrders = orders.length;
      this.statistics.activeOrders = orders.filter(o => 
        o.status !== 'delivered' && o.status !== 'cancelled'
      ).length;
      this.statistics.completedOrders = orders.filter(o => 
        o.status === 'delivered'
      ).length;
      
      // Get forms count
      this.formBuilderService.getRetailerForms(userId).subscribe(forms => {
        this.statistics.totalForms = forms.length;
        this.isLoading = false;
        this.loadingController.dismiss();
      });
    });
  }

  editProfile() {
    this.router.navigate(['/account-management']);
  }

  viewSubscription() {
    this.router.navigate(['/payment/subscription-details']);
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: () => {
            this.authService.logout();
          }
        }
      ]
    });

    await alert.present();
  }
}