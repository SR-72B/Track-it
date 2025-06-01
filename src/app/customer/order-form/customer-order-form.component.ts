// src/app/customer/order-form/customer-order-form.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { LoadingController, AlertController, ToastController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { CustomerOrderService } from '../order/customer-order.service';
import { OrderForm, FormField } from '../../retailer/form-builder/form-builder.service'; // Ensure FormField is exported
import { Observable, Subscription, firstValueFrom, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators'; // Removed unused 'tap', 'filter'

@Component({
  selector: 'app-customer-order-form', // Or 'app-place-order' if that's the intended selector
  templateUrl: './customer-order-form.component.html', // Or './place-order.component.html'
  styleUrls: ['./customer-order-form.component.scss'],   // Or './place-order.component.scss'
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class CustomerOrderFormComponent implements OnInit, OnDestroy {
  formId: string | null = null;
  orderForm: OrderForm | undefined;
  dynamicForm: FormGroup;
  selectedFiles: File[] = [];
  isLoading = true;
  isSubmitting = false;
  errorMessage: string | null = null;

  private routeSubscription: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private customerOrderService: CustomerOrderService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef // Injected ChangeDetectorRef
  ) {
    this.dynamicForm = this.fb.group({});
  }

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.formId = id;
        this.loadOrderFormDefinition(); // Renamed for clarity
      } else {
        this.isLoading = false;
        this.errorMessage = 'Form ID is missing. Cannot load form.';
        this.showToast(this.errorMessage, 'danger');
        this.cdr.detectChanges();
        // Optionally, navigate away: this.router.navigate(['/customer/forms']);
      }
    });
  }

  async loadOrderFormDefinition() { // Renamed for clarity
    if (!this.formId) {
      this.isLoading = false;
      this.errorMessage = 'Cannot load form: Form ID is not available.';
      console.error(this.errorMessage);
      this.cdr.detectChanges();
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
            return of(undefined);
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
        this.dynamicForm = this.fb.group({});
      }
    } catch (error: any) {
      console.error('Unexpected error in loadOrderFormDefinition:', error);
      this.errorMessage = `Failed to load form data: ${error.message || 'Unknown error'}`;
      this.showToast(this.errorMessage, 'danger');
    } finally {
      this.isLoading = false;
      await loading.dismiss().catch(e => console.warn('Error dismissing loading:', e));
      this.cdr.detectChanges(); // Ensure UI updates
    }
  }

  createDynamicForm(form: OrderForm) {
    const formControls: { [key: string]: FormControl } = {};
    
    // Add PO field (Make this conditional based on form settings if needed)
    formControls['purchaseOrder'] = new FormControl(''); // Default value, no validators unless specified by form
    
    if (form && form.fields) {
      form.fields.forEach((field: FormField) => {
        const controlName = field.id || field.label.replace(/\s+/g, '-').toLowerCase();
        const validators = [];
        if (field.required) {
          validators.push(Validators.required);
        }
        if (field.type === 'email') {
            validators.push(Validators.email);
        }
        // Add other validators based on field properties (e.g., minLength, pattern)
        formControls[controlName] = new FormControl(field.defaultValue || '', validators);
      });
    }
    this.dynamicForm = this.fb.group(formControls);
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (!this.orderForm) {
        this.showToast('Form definition not loaded, cannot process files.', 'warning');
        if (event.target) event.target.value = null;
        return;
    }
    if (!this.orderForm.allowFileUpload) {
        this.showToast('File uploads are not permitted for this form.', 'warning');
        if (event.target) event.target.value = null;
        return;
    }

    if (files) {
      // Assuming orderForm.allowedFileTypes stores MIME types (e.g., "image/png", "application/pdf")
      const allowedMimeTypes = this.orderForm.allowedFileTypes || [];
      const maxFiles = this.orderForm.maxFilesAllowed || 1; // Use from form definition or default
      const maxFileSizeMB = 10; // Example: Max 10MB per file - make this configurable if needed

      if (this.selectedFiles.length >= maxFiles) {
        this.showToast(`You have already selected the maximum of ${maxFiles} file(s).`, 'warning');
        if (event.target) event.target.value = null;
        return;
      }

      for (let i = 0; i < files.length; i++) {
        if (this.selectedFiles.length >= maxFiles) {
          this.showToast(`Maximum ${maxFiles} files reached. Some files were not added.`, 'warning');
          break;
        }
        const file = files[i];

        if (file.size > maxFileSizeMB * 1024 * 1024) {
            this.showToast(`File "${file.name}" is too large (max ${maxFileSizeMB}MB).`, 'warning');
            continue;
        }
        
        // Validate against MIME types
        if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
          this.showToast(`File type "${file.type || 'unknown'}" for "${file.name}" is not allowed. Allowed: ${allowedMimeTypes.join(', ')}`, 'warning');
          continue;
        }
        this.selectedFiles.push(file);
      }
    }
    if (event.target) {
      event.target.value = null;
    }
    this.cdr.detectChanges(); // Update view for selected files list
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.cdr.detectChanges();
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
    if (!this.formId) {
        this.showErrorAlert('Submission Error', 'Form ID is missing. Cannot submit order.');
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
      const orderId = await this.customerOrderService.submitOrder(
        this.formId, 
        formData, 
        this.selectedFiles
      );
      
      this.selectedFiles = [];
      this.dynamicForm.reset();
      // Re-initialize form with default values if needed, or clear it.
      // this.createDynamicForm(this.orderForm); // To reset with defaults
      this.isSubmitting = false; // Set before dismissing loader
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Order Submitted!',
        message: `Your order (ID: ${orderId}) has been submitted successfully.`,
        backdropDismiss: false,
        buttons: [
          {
            text: 'View My Orders',
            handler: () => {
              this.router.navigate(['/customer/orders']); // Navigate to order list
            }
          },
          {
            text: 'Place Another Order',
            role: 'cancel', // Or a handler to navigate to forms list
            handler: () => {
              this.router.navigate(['/customer/forms']);
            }
          }
        ]
      });
      await alert.present();

    } catch (error: any) {
      this.isSubmitting = false;
      await loading.dismiss().catch(e => console.warn('Error dismissing submit loader:', e));
      this.showErrorAlert('Order Submission Failed', error.message || 'An unknown error occurred.');
    } finally {
        this.isSubmitting = false; // Ensure it's always reset
        this.cdr.detectChanges();
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
    await toast.present();
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
