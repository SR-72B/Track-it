// src/app/retailer/form-list/form-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Observable, Subscription, of } from 'rxjs'; // Added Subscription and of
import { map, first, filter, catchError } from 'rxjs/operators'; // Added first, filter, catchError
import { AuthService, User } from '../../auth/auth.service'; // Ensure User is exported from auth.service
import { FormBuilderService, OrderForm } from '../form-builder/form-builder.service';

@Component({
  selector: 'app-form-list',
  templateUrl: './form-list.component.html',
  styleUrls: ['./form-list.component.scss']
})
export class FormListComponent implements OnInit, OnDestroy {
  forms$: Observable<OrderForm[]>;
  isLoading = true;
  private userSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private formBuilderService: FormBuilderService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadForms();
  }

  loadForms() {
    this.isLoading = true;
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    this.userSubscription = this.authService.currentUser$.pipe(
      filter((user): user is User => !!user), // Ensure user is not null and type guard to User
      first() // Take the first emitted non-null user and complete
    ).subscribe(
      user => {
        // user is now guaranteed to be of type User
        this.forms$ = this.formBuilderService.getRetailerForms(user.uid).pipe(
          map(forms => {
            this.isLoading = false;
            return forms;
          }),
          catchError(error => {
            console.error('Error loading forms:', error);
            this.isLoading = false;
            // Optionally show an error to the user
            this.alertController.create({
              header: 'Error',
              message: 'Could not load forms.',
              buttons: ['OK']
            }).then(alert => alert.present());
            return of([]); // Return an empty array on error
          })
        );
      },
      error => { // Handle cases where currentUser$ might error or complete without a valid user
        console.error('Error getting current user:', error);
        this.isLoading = false;
        this.forms$ = of([]); // Initialize forms$ to an empty observable
        this.alertController.create({
            header: 'Authentication Error',
            message: 'Could not retrieve user information. Please try logging in again.',
            buttons: ['OK']
        }).then(alert => alert.present());
      }
    );
  }

  createForm() {
    this.router.navigate(['/retailer/forms/create']);
  }

  editForm(formId: string) {
    this.router.navigate(['/retailer/forms/edit', formId]);
  }

  async toggleFormStatus(form: OrderForm) {
    if (!form || typeof form.id === 'undefined') { // Added check for form.id
      console.error('Form or Form ID is undefined, cannot toggle status.');
      return;
    }

    const newStatus = !form.active;
    const loading = await this.loadingController.create({
      message: newStatus ? 'Activating form...' : 'Deactivating form...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.formBuilderService.updateOrderForm(form.id, { active: newStatus });
      // Optionally, refresh the list or update the local form object's status
      // For simplicity, the list will refresh if getRetailerForms emits due to data change
      // Or you could manually update the specific form in a local array if you were not using forms$ directly
      await loading.dismiss();
    } catch (error: any) {
      await loading.dismiss();
      const alert = await this.alertController.create({
        header: 'Error',
        message: error.message || 'There was an error updating the form status.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async deleteForm(form: OrderForm) {
    if (!form || typeof form.id === 'undefined') { // Added check for form.id
        console.error('Form or Form ID is undefined, cannot delete.');
        return;
    }
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${form.title}"? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting form...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.formBuilderService.deleteOrderForm(form.id);
              await loading.dismiss();
              // The list will automatically update because getRetailerForms is an observable
              // listening to Firestore changes.
            } catch (error: any) {
              await loading.dismiss();
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: error.message || 'There was an error deleting the form.',
                buttons: ['OK']
              });
              await errorAlert.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}
