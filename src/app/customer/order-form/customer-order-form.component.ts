typescript// src/app/customer/order-form/customer-order-form.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { CustomerOrderService } from '../order/customer-order.service';
import { OrderForm } from '../../retailer/form-builder/form-builder.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-customer-order-form',
  templateUrl: './customer-order-form.component.html',
  styleUrls: ['./customer-order-form.component.scss']
})
export class CustomerOrderFormComponent implements OnInit {
  formId: string;
  orderForm$: Observable<OrderForm>;
  orderForm: OrderForm;
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
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.formId = params['id'];
      this.loadOrderForm();
    });
  }

  async loadOrderForm() {
    const loading = await this.loadingController.create({
      message: 'Loading form...',
      spinner: 'crescent'
    });
    await loading.present();

    this.orderForm$ = this.customerOrderService.getOrderForm(this.formId);
    
    this.orderForm$.subscribe(
      form => {
        this.orderForm = form;
        this.createDynamicForm(form);
        loading.dismiss();
        this.isLoading = false;
      },
      error => {
        loading.dismiss();
        this.isLoading = false;
        this.showError('Error loading form: ' + error.message);
      }
    );
  }

  createDynamicForm(form: OrderForm) {
    const formControls: {[key: string]: FormControl} = {};
    
    // Add PO field
    formControls['purchaseOrder'] = new FormControl('');
    
    // Add dynamic fields based on form definition
    form.fields.forEach(field => {
      formControls[field.label] = new FormControl(
        '', 
        field.required ? Validators.required : null
      );
    });
    
    this.dynamicForm = this.fb.group(formControls);
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files) {
      // Check file types
      const allowedTypes = this.orderForm.allowedFileTypes.map(type => '.' + type);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (this.orderForm.allowedFileTypes.includes(fileExtension)) {
          this.selectedFiles.push(file);
        } else {
          this.showError(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
        }
      }
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  async submitOrder() {
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

        const alert = await this.alertController.create({
          header: 'Order Submitted',
          message: 'Your order has been submitted successfully!',
          buttons: [
            {
              text: 'View Order',
              handler: () => {
                this.router.navigate(['/customer/orders', orderId]);
              }
            }
          ]
        });
        await alert.present();
      } catch (error) {
        await loading.dismiss();
        this.isSubmitting = false;
        this.showError('Error submitting order: ' + error.message);
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