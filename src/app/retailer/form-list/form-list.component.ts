// src/app/retailer/form-list/form-list.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, IonicModule, ToastController } from '@ionic/angular';
import { Observable, Subscription, of } from 'rxjs'; // Removed unused firstValueFrom
import { map, catchError, finalize } from 'rxjs/operators'; // Refined operator imports

import { AuthService, User } from '../../auth/auth.service';
import { FormBuilderService, OrderForm } from '../form-builder/form-builder.service';

@Component({
  selector: 'app-form-list',
  templateUrl: './form-list.component.html',
  styleUrls: ['./form-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule
  ]
})
export class FormListComponent implements OnInit, OnDestroy {
  forms$: Observable<OrderForm[]> = of([]);
  isLoading = true;
  errorMessage: string | null = null;
  currentUser: User | null = null;

  private userSubscription: Subscription | undefined;
  private formsSubscription: Subscription | undefined; // Kept for potential manual subscription needs

  constructor(
    private authService: AuthService,
    private formBuilderService: FormBuilderService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.uid) {
        this.loadFormsForUser(user.uid);
      } else {
        this.isLoading = false;
        this.forms$ = of([]);
        this.errorMessage = "Please log in to view forms.";
        this.cdr.detectChanges();
      }
    });
  }

  async loadFormsForUser(userId: string, refresherEvent?: any) {
    this.isLoading = true;
    this.errorMessage = null;
    let loader: HTMLIonLoadingElement | undefined;

    if (!refresherEvent) {
      // Optional: Show loader for initial load
      // loader = await this.loadingController.create({ message: 'Loading forms...' });
      // await loader.present();
    }

    if (this.formsSubscription) {
        this.formsSubscription.unsubscribe();
    }

    this.forms$ = this.formBuilderService.getRetailerForms(userId).pipe(
      map(forms => {
        return forms.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      }),
      finalize(async () => {
        this.isLoading = false;
        // if (loader) await loader.dismiss().catch(e => console.warn("Loader dismiss error", e));
        if (refresherEvent) refresherEvent.target.complete();
        this.cdr.detectChanges();
      }),
      catchError(error => {
        console.error('Error loading forms:', error);
        this.errorMessage = 'Could not load forms. Please try again.';
        this.cdr.detectChanges(); // Ensure error message is displayed
        return of([]);
      })
    );
    // Example of manual subscription if needed for side-effects not handled by async pipe:
    // this.formsSubscription = this.forms$.subscribe(
    //   () => { /* Handle data if needed */ },
    //   () => { /* Handle error if needed, though catchError above handles it for the stream */ }
    // );
  }

  // Method for the "Try Again" button
  public retryLoadForms() {
    if (this.currentUser && this.currentUser.uid) {
      this.loadFormsForUser(this.currentUser.uid);
    } else {
      this.showToast('User data not available. Please try logging in again.', 'warning');
    }
  }

  createForm() {
    this.router.navigate(['/retailer/forms/create']);
  }

  editForm(formId: string | undefined) {
    if (formId) {
      this.router.navigate(['/retailer/forms/edit', formId]);
    } else {
      console.warn('Edit form called with undefined formId');
      this.showToast('Cannot edit form: Form ID is missing.', 'danger');
    }
  }

  async toggleFormStatus(form: OrderForm) {
    if (!form || typeof form.id === 'undefined') {
      this.showToast('Form details are missing. Cannot toggle status.', 'danger');
      return;
    }
    if (!this.currentUser || !this.currentUser.uid) {
        this.showToast('User not authenticated. Please log in.', 'danger');
        return;
    }

    const newStatus = !form.active;
    const actionMessage = newStatus ? 'Activating form...' : 'Deactivating form...';
    const loading = await this.loadingController.create({ message: actionMessage, spinner: 'crescent' });
    await loading.present();

    try {
      await this.formBuilderService.updateOrderForm(form.id, { active: newStatus });
      this.showToast(`Form "${form.title}" ${newStatus ? 'activated' : 'deactivated'}.`, 'success');
      // Assuming getRetailerForms is a hot observable, the list will update.
      // If not, or to ensure immediate UI consistency with local filtering/sorting:
      this.loadFormsForUser(this.currentUser.uid);
    } catch (error: any) {
      this.showErrorAlert('Update Failed', error.message || 'There was an error updating the form status.');
    } finally {
      await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
    }
  }

  async deleteForm(form: OrderForm) {
    if (!form || typeof form.id === 'undefined') {
      this.showToast('Form details are missing. Cannot delete.', 'danger');
      return;
    }
    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete the form "${form.title}"? This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          cssClass: 'alert-button-danger',
          handler: async () => {
            const loading = await this.loadingController.create({ message: 'Deleting form...', spinner: 'crescent' });
            await loading.present();
            try {
              await this.formBuilderService.deleteOrderForm(form.id!);
              this.showToast('Form deleted successfully.', 'success');
              // List should auto-update if getRetailerForms is a hot observable.
              // If not, explicitly reload:
              if (this.currentUser && this.currentUser.uid) {
                this.loadFormsForUser(this.currentUser.uid);
              }
            } catch (error: any) {
              this.showErrorAlert('Delete Failed', error.message || 'There was an error deleting the form.');
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
    if (this.currentUser && this.currentUser.uid) {
      this.loadFormsForUser(this.currentUser.uid, event);
    } else {
      this.showToast('Please log in to refresh forms.', 'warning');
      if (event) event.target.complete();
      this.cdr.detectChanges();
    }
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.formsSubscription) {
        this.formsSubscription.unsubscribe();
    }
  }
}
