// src/app/customer/available-forms/available-forms.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController } from '@ionic/angular';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { OrderForm } from '../../retailer/form-builder/form-builder.service';
import { CustomerOrderService } from '../order/customer-order.service';

@Component({
  selector: 'app-available-forms',
  templateUrl: './available-forms.component.html',
  styleUrls: ['./available-forms.component.scss']
})
export class AvailableFormsComponent implements OnInit {
  forms$: Observable<OrderForm[]>;
  isLoading = true;

  constructor(
    private customerOrderService: CustomerOrderService,
    private router: Router,
    private loadingController: LoadingController
  ) { }

  ngOnInit() {
    this.loadForms();
  }

  async loadForms() {
    const loading = await this.loadingController.create({
      message: 'Loading available forms...',
      spinner: 'crescent'
    });
    await loading.present();

    this.forms$ = this.customerOrderService.getActiveForms().pipe(
      finalize(() => {
        this.isLoading = false;
        loading.dismiss();
      })
    );
  }

  openForm(formId: string) {
    this.router.navigate(['/customer/place-order', formId]);
  }
}

