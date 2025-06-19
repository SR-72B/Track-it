// src/app/customer/order-form/customer-order-form.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { LoadingController, AlertController, ToastController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

import { CustomerOrderService } from '../order/customer-order.service';
import { OrderForm, FormField } from '../../retailer/form-builder/form-builder.service';
import { Observable, Subscription, firstValueFrom, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-customer-order-form',
  templateUrl: './customer-order-form.component.html',
  styleUrls: ['./customer-order-form.component.scss'],
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
  fields: FormArray; // Added missing fields property
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
    private cdr: ChangeDetectorRef
  ) {
    this.dynamicForm = this.fb.group({});
    this.fields = this.fb.array([]); // Initialize fields FormArray
  }

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.formId = id;
        this.loadOrderFormDefinition();
      } else {
        this.isLoading = false;
        this.errorMessage = 'Form ID is missing. Cannot load form.';
        this.showToast(this.errorMessage, 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  async loadOrderFormDefinition() {
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
      this.cdr.detectChanges();
    }
  }

  createDynamicForm(form: OrderForm) {
    const formControls: { [key: string]: FormControl } = {};
    const fieldsArray: FormGroup[] = [];
    
    // Add PO field
    formControls['purchaseOrder'] = new FormControl('');
    
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
        
        formControls[controlName] = new FormControl(field.defaultValue || '', validators);
        
        // Add to fields array for template iteration
        const fieldGroup = this.fb.group({
          [controlName]: formControls[controlName]
        });
        fieldsArray.push(fieldGroup);
      });
    }
    
    this.dynamicForm = this.fb.group(formControls);
    this.fields = this.fb.array(fieldsArray);
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
      const allowedMimeTypes = this.orderForm.allowedFileTypes || [];
      const maxFiles = this.orderForm.maxFilesAllowed || 1;
      const maxFileSizeMB = 10;

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
    this.cdr.detectChanges();
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
      this.isSubmitting = false;
      await loading.dismiss();

      const alert = await this.alertController.create({
        header: 'Order Submitted!',
        message: `Your order (ID: ${orderId}) has been submitted successfully.`,
        backdropDismiss: false,
        buttons: [
          {
            text: 'View My Orders',
            handler: () => {
              this.router.navigate(['/customer/orders']);
            }
          },
          {
            text: 'Place Another Order',
            role: 'cancel',
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
      this.isSubmitting = false;
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
