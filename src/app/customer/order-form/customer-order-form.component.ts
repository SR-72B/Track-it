// src/app/customer/order-form/customer-order-form.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { CustomerOrderService } from '../order/customer-order.service';
import { OrderForm } from '../../retailer/form-builder/form-builder.service'; // Ensure this path is correct
import { Observable } from 'rxjs';
// It's good practice to also import 'firstValueFrom' or 'take' if you intend to only get one value from an observable
// import { firstValueFrom } from 'rxjs';
// Or for specific error handling:
// import { catchError } from 'rxjs/operators';
// import { of } from 'rxjs';


@Component({
  selector: 'app-customer-order-form',
  templateUrl: './customer-order-form.component.html',
  styleUrls: ['./customer-order-form.component.scss']
})
export class CustomerOrderFormComponent implements OnInit {
  formId: string;
  // Consider if orderForm$ is truly needed if you're immediately subscribing and storing in this.orderForm
  orderForm$: Observable<OrderForm | undefined>; // It's good practice to allow undefined if the form might not exist
  orderForm: OrderForm | undefined; // And type this accordingly
  dynamicForm: FormGroup;
  selectedFiles: File[] = [];
  isLoading = true;
  isSubmitting = false;

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
    this.route.params.subscribe(params => {
      this.formId = params['id'];
      if (this.formId) {
        this.loadOrderForm();
      } else {
        this.isLoading = false;
        this.showError('Form ID is missing.');
        // Optionally, navigate away or show a more permanent error state
      }
    });
  }

  async loadOrderForm() {
    this.isLoading = true; // Ensure isLoading is true at the start
    const loading = await this.loadingController.create({
      message: 'Loading form...',
      spinner: 'crescent'
    });
    await loading.present();

    // Using a local variable for the subscription can be cleaner
    this.customerOrderService.getOrderForm(this.formId).subscribe(
      (form: OrderForm | undefined) => {
        if (form) {
          this.orderForm = form;
          this.createDynamicForm(form);
        } else {
          // Handle case where form is not found
          this.orderForm = undefined;
          this.showError('Form not found.');
          // Potentially navigate back or disable the form
          this.dynamicForm = this.fb.group({}); // Reset or disable form
        }
        loading.dismiss();
        this.isLoading = false;
      },
      (error: any) => { // It's good to type 'error' if you know its structure, otherwise 'any'
        loading.dismiss();
        this.isLoading = false;
        this.showError('Error loading form: ' + (error.message || 'Unknown error'));
        // Potentially navigate back
      }
    );
  }

  createDynamicForm(form: OrderForm) {
    const formControls: {[key: string]: FormControl} = {};
    
    // Add PO field (consider if this should always be present or based on form config)
    formControls['purchaseOrder'] = new FormControl('');
    
    // Add dynamic fields based on form definition
    if (form && form.fields) {
      form.fields.forEach(field => {
        // Use field.id or a unique key if field.label can have duplicates or special characters
        formControls[field.id || field.label] = new FormControl(
          field.defaultValue || '', 
          field.required ? Validators.required : null
        );
      });
    }
    
    this.dynamicForm = this.fb.group(formControls);
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files && this.orderForm) { // Ensure orderForm is defined
      // Check file types
      const allowedTypesExtensions = this.orderForm.allowedFileTypes || []; // Default to empty array if undefined
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop()?.toLowerCase(); // Use optional chaining
        
        if (fileExtension && allowedTypesExtensions.includes(fileExtension)) {
          this.selectedFiles.push(file);
        } else {
          this.showError(`File type .${fileExtension || 'unknown'} is not allowed. Allowed types: ${allowedTypesExtensions.map(ext => '.' + ext).join(', ')}`);
        }
      }
    }
    // Reset the file input so the same file can be selected again if removed
    if (event.target) {
        event.target.value = null;
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  async submitOrder() {
    if (!this.orderForm) {
      this.showError('Form data is not loaded. Cannot submit.');
      return;
    }

    if (this.dynamicForm.valid) {
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
        
        await loading.dismiss();
        this.isSubmitting = false;
        this.selectedFiles = []; // Clear selected files after successful submission

        const alert = await this.alertController.create({
          header: 'Order Submitted',
          message: `Your order (ID: ${orderId}) has been submitted successfully!`,
          buttons: [
            {
              text: 'View Order',
              handler: () => {
                this.router.navigate(['/customer/orders', orderId]); // Ensure this route exists
              }
            },
            {
              text: 'OK',
              role: 'cancel',
              handler: () => {
                this.router.navigate(['/customer/dashboard']); // Or some other appropriate page
              }
            }
          ]
        });
        await alert.present();
        this.dynamicForm.reset(); // Reset form after successful submission

      } catch (error: any) { // Type error if possible
        await loading.dismiss();
        this.isSubmitting = false;
        this.showError('Error submitting order: ' + (error.message || 'Unknown error'));
      }
    } else {
      this.markFormGroupTouched(this.dynamicForm);
      this.showError('Please fill in all required fields.');
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

  async showError(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    });
    toast.present();
  }
}