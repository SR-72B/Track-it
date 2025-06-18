// src/app/customer/place-order/place-order.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { OrderForm, FormField } from '../../retailer/form-builder/form-builder.service';
import { CustomerOrderService } from '../order/customer-order.service';

@Component({
  selector: 'app-place-order',
  templateUrl: './place-order.component.html',
  styleUrls: ['./place-order.component.scss']
})
export class PlaceOrderComponent implements OnInit {
  formId: string;
  orderForm$: Observable<OrderForm>;
  dynamicForm: FormGroup;
  selectedFiles: File[] = [];
  isSubmitting = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private customerOrderService: CustomerOrderService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.formId = params['id'];
      this.loadOrderForm();
    });
  }

  loadOrderForm() {
    this.orderForm$ = this.customerOrderService.getOrderForm(this.formId);
    
    this.orderForm$.subscribe(form => {
      this.createDynamicForm(form);
    });
  }

  createDynamicForm(form: OrderForm) {
    const formControls: any = {};
    
    // Add PO field
    formControls['purchaseOrder'] = [''];
    
    // Add dynamic fields based on form definition
    form.fields.forEach(field => {
      formControls[field.label] = [
        '', 
        field.required ? Validators.required : null
      ];
    });
    
    this.dynamicForm = this.fb.group(formControls);
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      this.selectedFiles = Array.from(files);
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
              text: 'OK',
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
        
        const alert = await this.alertController.create({
          header: 'Submission Failed',
          message: error.message || 'There was an error submitting your order. Please try again.',
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }
}
