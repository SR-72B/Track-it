// src/app/customer/place-order/place-order.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { CustomerOrderService } from '../order/customer-order.service';
import { OrderForm, FormField } from '../../retailer/form-builder/form-builder.service'; // Ensure FormField is exported
import { Observable, Subscription, firstValueFrom, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-place-order', // Or 'app-customer-order-form'
  templateUrl: './place-order.component.html', // Or './customer-order-form.component.html'
  styleUrls: ['./place-order.component.scss'],   // Or './customer-order-form.component.scss'
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class PlaceOrderComponent implements OnInit, OnDestroy {
  formId: string | null = null;
  orderForm: OrderForm | undefined;
  // orderForm$ is not used if we subscribe directly, so it can be removed if not used with async pipe
  // orderForm$: Observable<OrderForm | undefined>; 
  dynamicForm: FormGroup;
  selectedFiles: File[] = [];
  isLoading = true;
  isSubmitting = false;
  errorMessage: string | null = null;

  private routeSubscription: Subscription | undefined;
  // No need for orderFormSubscription if using firstValueFrom

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private customerOrderService: CustomerOrderService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    this.dynamicForm = this.fb.group({}); // Initialize
  }

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.formId = id;
        this.loadOrderFormDefinition();
      } else {
        this.isLoading = false;
        this.errorMessage = 'Form ID is missing. Cannot display form.';
        this.showToast(this.errorMessage, 'danger');
        // Consider navigating away, e.g., this.router.navigate(['/customer/forms']);
      }
    });
  }

  async loadOrderFormDefinition() {
    if (!this.formId) {
      this.isLoading = false;
      this.errorMessage = 'Cannot load form: Form ID is not available.';
      console.error(this.errorMessage);
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    const loading = await this.loadingController.create({
      message: 'Loading form...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const formDefinition = await firstValueFrom(
        this.customerOrderService.getOrderForm(this.formId).pipe(
          catchError(err => {
            console.error('Error fetching order form definition:', err);
            this.errorMessage = `Error loading form: ${err.message || 'Unknown error'}`;
            return of(undefined); // Propagate undefined
          })
        )
      );

      if (formDefinition) {
        this.orderForm = formDefinition;
        this.createDynamicForm(formDefinition);
      } else {
        this.orderForm = undefined;
        if (!this.errorMessage) {
          this.errorMessage = 'Form not found or could not be loaded.';
        }
        this.showToast(this.errorMessage, 'danger');
        this.dynamicForm = this.fb.group({}); // Reset form
      }
    } catch (error: any) {
      console.error('Unexpected error in loadOrderFormDefinition:', error);
      this.errorMessage = `Failed to load form data: ${error.message || 'Unknown error'}`;
      this.showToast(this.errorMessage, 'danger');
    } finally {
      this.isLoading = false;
      await loading.dismiss().catch(e => console.warn('Error dismissing loading:', e));
    }
  }

  createDynamicForm(form: OrderForm) {
    const formControls: { [key: string]: any } = {}; // Using 'any' for form control config array

    // Add a Purchase Order field by default, make it optional
    formControls['purchaseOrder'] = ['', []]; // Value and validators array

    if (form && form.fields) {
      form.fields.forEach((field: FormField) => {
        // Use field.id if available and unique, otherwise sanitize label
        const controlName = field.id || field.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const validators = [];
        if (field.required) {
          validators.push(Validators.required);
        }
        // Add other validators based on field.type if needed (e.g., Validators.email for 'email' type)
        if (field.type === 'email') {
            validators.push(Validators.email);
        }
        // Add more specific validators like minLength, maxLength, pattern based on field properties

        formControls[controlName] = [field.defaultValue || '', validators];
      });
    }
    this.dynamicForm = this.fb.group(formControls);
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && this.orderForm) {
      const allowedTypesExtensions = this.orderForm.allowedFileTypes || [];
      const maxFiles = this.orderForm.allowFileUpload ? 5 : 0; // Example: Max 5 files if uploads allowed
      const maxFileSizeMB = 10; // Example: Max 10MB per file

      if (!this.orderForm.allowFileUpload) {
        this.showToast('File uploads are not allowed for this form.', 'warning');
        if (event.target) event.target.value = null;
        return;
      }

      if (this.selectedFiles.length + files.length > maxFiles) {
        this.showToast(`You can upload a maximum of ${maxFiles} files.`, 'warning');
        if (event.target) event.target.value = null;
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (file.size > maxFileSizeMB * 1024 * 1024) {
          this.showToast(`File "${file.name}" is too large (max ${maxFileSizeMB}MB).`, 'warning');
          continue;
        }

        if (fileExtension && allowedTypesExtensions.includes(fileExtension)) {
          if (this.selectedFiles.length < maxFiles) {
            this.selectedFiles.push(file);
          } else {
            this.showToast(`Maximum ${maxFiles} files reached. "${file.name}" was not added.`, 'warning');
            break;
          }
        } else {
          this.showToast(`File type .${fileExtension || 'unknown'} is not allowed for "${file.name}". Allowed: ${allowedTypesExtensions.map(ext => '.' + ext).join(', ')}`, 'warning');
        }
      }
    }
    if (event.target) {
      event.target.value = null; // Reset file input
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  async submitOrder() {
    if (!this.orderForm) {
      this.showToast('Form definition is not loaded. Cannot submit order.', 'danger');
      return;
    }

    if (this.dynamicForm.invalid) {
      this.markFormGroupTouched(this.dynamicForm);
      this.showToast('Please fill in all required fields correctly.', 'warning');
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Submitting order...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const formData = this.dynamicForm.value;
      if (!this.formId) { // Should be set in ngOnInit
        throw new Error("Form ID is missing. Cannot submit order.");
      }

      const orderId = await this.customerOrderService.submitOrder(
        this.formId,
        formData,
        this.selectedFiles
      );

      this.isSubmitting = false;
      this.selectedFiles = [];
      this.dynamicForm.reset(); // Reset form after successful submission
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Order Submitted!',
        message: `Your order (ID: ${orderId}) has been submitted successfully.`,
        backdropDismiss: false,
        buttons: [
          {
            text: 'View My Orders',
            handler: () => {
              this.router.navigate(['/customer/orders']); // Navigate to the order list
            }
          },
          {
            text: 'Place Another Order',
            handler: () => {
              this.router.navigate(['/customer/forms']); // Navigate to forms list
            }
          }
        ]
      });
      await alert.present();

    } catch (error: any) {
      this.isSubmitting = false;
      await loading.dismiss().catch(e => console.warn('Error dismissing submit loader:', e));
      this.showErrorAlert('Order Submission Failed', error.message || 'An unexpected error occurred.');
    }
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      color: color,
      position: 'top'
    });
    toast.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }
}
