// src/app/customer/order-form/customer-order-form.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
import { ActivatedRoute, Router, RouterModule } from '@angular/router'; // Added RouterModule
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms'; // Added ReactiveFormsModule
import { LoadingController, AlertController, ToastController, IonicModule } from '@ionic/angular'; // Added IonicModule
import { CommonModule } from '@angular/common'; // Added CommonModule

import { CustomerOrderService } from '../order/customer-order.service';
import { OrderForm, FormField } from '../../retailer/form-builder/form-builder.service'; // Ensure path and FormField export are correct
import { Observable, Subscription, firstValueFrom, of } from 'rxjs'; // Added Subscription, firstValueFrom, of
import { catchError, finalize } from 'rxjs/operators'; // Added catchError, finalize

@Component({
  selector: 'app-customer-order-form',
  templateUrl: './customer-order-form.component.html', // Ensure this file exists
  styleUrls: ['./customer-order-form.component.scss'],   // Ensure this file exists
  standalone: true, // Mark component as standalone
  imports: [
    CommonModule,          // For *ngIf, *ngFor, etc.
    IonicModule,           // For Ionic components and services
    ReactiveFormsModule,   // For FormGroup, FormControl, FormBuilder
    RouterModule           // For routerLink (if used in the template)
  ]
})
export class CustomerOrderFormComponent implements OnInit, OnDestroy {
  formId: string | null = null; // Initialize to null
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
    private toastController: ToastController
  ) {
    this.dynamicForm = this.fb.group({}); // Initialize with an empty group
  }

  ngOnInit() {
    this.routeSubscription = this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.formId = id;
        this.loadOrderForm();
      } else {
        this.isLoading = false;
        this.errorMessage = 'Form ID is missing. Cannot load form.';
        this.showToast(this.errorMessage, 'danger');
        // Optionally, navigate away
        // this.router.navigate(['/customer/forms']);
      }
    });
  }

  async loadOrderForm() {
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
      const form = await firstValueFrom(
        this.customerOrderService.getOrderForm(this.formId).pipe(
          catchError(err => {
            console.error('Error fetching order form:', err);
            this.errorMessage = `Error loading form: ${err.message || 'Unknown error'}`;
            return of(undefined); // Propagate undefined to handle in the success path
          })
        )
      );

      if (form) {
        this.orderForm = form;
        this.createDynamicForm(form);
      } else {
        this.orderForm = undefined;
        if (!this.errorMessage) { // If catchError didn't set a specific message
            this.errorMessage = 'Form not found or could not be loaded.';
        }
        this.showToast(this.errorMessage, 'danger');
        this.dynamicForm = this.fb.group({}); // Reset form
      }
    } catch (error: any) { // Catch errors from firstValueFrom if observable errors without emitting
      console.error('Unexpected error in loadOrderForm:', error);
      this.errorMessage = `Failed to load form data: ${error.message || 'Unknown error'}`;
      this.showToast(this.errorMessage, 'danger');
    } finally {
      this.isLoading = false;
      await loading.dismiss().catch(e => console.warn('Error dismissing loading:', e));
    }
  }

  createDynamicForm(form: OrderForm) {
    const formControls: {[key: string]: FormControl} = {};
    
    // Add PO field (Make this conditional based on form settings if needed)
    formControls['purchaseOrder'] = new FormControl('');
    
    if (form && form.fields) {
      form.fields.forEach((field: FormField) => { // Assuming FormField is imported or defined
        const controlName = field.id || field.label.replace(/\s+/g, '-').toLowerCase(); // Create a more robust control name
        formControls[controlName] = new FormControl(
          field.defaultValue || '', 
          field.required ? Validators.required : null
        );
      });
    }
    
    this.dynamicForm = this.fb.group(formControls);
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && this.orderForm) {
      const allowedTypesExtensions = this.orderForm.allowedFileTypes || [];
      const maxFiles = 5; // Example: Set a maximum number of files
      const maxFileSizeMB = 10; // Example: Max 10MB per file

      if (this.selectedFiles.length + files.length > maxFiles) {
        this.showToast(`You can upload a maximum of ${maxFiles} files.`, 'warning');
        if (event.target) event.target.value = null; // Reset file input
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        if (file.size > maxFileSizeMB * 1024 * 1024) {
            this.showToast(`File "${file.name}" is too large (max ${maxFileSizeMB}MB).`, 'warning');
            continue; // Skip this file
        }
        
        if (fileExtension && allowedTypesExtensions.includes(fileExtension)) {
          if (this.selectedFiles.length < maxFiles) {
            this.selectedFiles.push(file);
          } else {
            this.showToast(`Maximum ${maxFiles} files reached. "${file.name}" was not added.`, 'warning');
            break; // Stop processing further files if max is reached
          }
        } else {
          this.showToast(`File type .${fileExtension || 'unknown'} is not allowed for "${file.name}". Allowed: ${allowedTypesExtensions.map(ext => '.' + ext).join(', ')}`, 'warning');
        }
      }
    }
    if (event.target) {
      event.target.value = null; // Reset file input to allow selecting the same file again if removed
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  async submitOrder() {
    if (!this.orderForm) {
      this.showToast('Form data is not loaded. Cannot submit.', 'danger');
      return;
    }

    if (this.dynamicForm.invalid) { // Check for invalid instead of valid for early exit
      this.markFormGroupTouched(this.dynamicForm);
      this.showToast('Please fill in all required fields.', 'warning');
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
      
      // Ensure formId is not null before submitting
      if (!this.formId) {
          throw new Error("Form ID is missing, cannot submit order.");
      }

      const orderId = await this.customerOrderService.submitOrder(
        this.formId, 
        formData, 
        this.selectedFiles
      );
      
      this.isSubmitting = false;
      this.selectedFiles = [];
      this.dynamicForm.reset();
      await loading.dismiss();


      const alert = await this.alertController.create({
        header: 'Order Submitted',
        message: `Your order (ID: ${orderId}) has been submitted successfully!`,
        backdropDismiss: false,
        buttons: [
          {
            text: 'View Order',
            handler: () => {
              this.router.navigate(['/customer/orders', orderId]);
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
      this.showErrorAlert('Order Submission Failed', error.message || 'An unknown error occurred while submitting your order.');
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
      position: 'top' // Changed to top for better visibility with keyboard
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
