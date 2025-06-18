// src/app/retailer/form-list/form-list.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { FormBuilderService, OrderForm } from '../form-builder/form-builder.service';

@Component({
  selector: 'app-form-list',
  templateUrl: './form-list.component.html',
  styleUrls: ['./form-list.component.scss']
})
export class FormListComponent implements OnInit {
  forms$: Observable<OrderForm[]>;
  isLoading = true;

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
    this.authService.currentUser$.pipe(
      first()
    ).subscribe(user => {
      if (user) {
        this.forms$ = this.formBuilderService.getRetailerForms(user.uid).pipe(
          map(forms => {
            this.isLoading = false;
            return forms;
          })
        );
      } else {
        this.isLoading = false;
      }
    });
  }

  createForm() {
    this.router.navigate(['/retailer/forms/create']);
  }

  editForm(formId: string) {
    this.router.navigate(['/retailer/forms/edit', formId]);
  }

  async toggleFormStatus(form: OrderForm) {
    const newStatus = !form.active;
    const loading = await this.loadingController.create({
      message: newStatus ? 'Activating form...' : 'Deactivating form...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.formBuilderService.updateOrderForm(form.id, { active: newStatus });
      await loading.dismiss();
    } catch (error) {
      await loading.dismiss();
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'There was an error updating the form status.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async deleteForm(form: OrderForm) {
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
            } catch (error) {
              await loading.dismiss();
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'There was an error deleting the form.',
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
}
