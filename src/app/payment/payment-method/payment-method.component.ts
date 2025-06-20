// src/app/payment/payment-methods/payment-methods.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, LoadingController, ModalController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { PaymentService, CardDetails } from '../payment.service';
import { AuthService, User } from '../../auth/auth.service';
import { ErrorService } from '../../shared/services/error.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'paypal';
  last4: string;
  brand: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault: boolean;
  name: string;
  createdAt: any;
}

@Component({
  selector: 'app-payment-methods',
  templateUrl: './payment-method.component.html',
  styleUrls: ['./payment-method.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class PaymentMethodsComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  paymentMethods: PaymentMethod[] = [];
  cardForm: FormGroup;
  isAddingCard = false;
  isLoading = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private authService: AuthService,
    private errorService: ErrorService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private modalController: ModalController
  ) {
    this.cardForm = this.createCardForm();
  }

  ngOnInit() {
    this.loadUserData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createCardForm(): FormGroup {
    return this.fb.group({
      cardNumber: ['', [Validators.required, this.cardNumberValidator.bind(this)]],
      expiryMonth: ['', [Validators.required]],
      expiryYear: ['', [Validators.required]],
      cvc: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(4)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      isDefault: [false]
    }, { validators: this.expiryValidator.bind(this) });
  }

  private cardNumberValidator(control: any) {
    if (!control.value) return null;
    return this.paymentService.validateCreditCard(control.value) ? null : { invalidCard: true };
  }

  private expiryValidator(group: FormGroup) {
    const month = group.get('expiryMonth')?.value;
    const year = group.get('expiryYear')?.value;
    if (!month || !year) return null;
    return this.paymentService.validateExpiry(month, year) ? null : { invalidExpiry: true };
  }

  private loadUserData() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          if (user) {
            this.loadPaymentMethods();
          }
        },
        error: (error) => {
          this.errorService.handleError(error, 'Loading user data');
        }
      });
  }

  private loadPaymentMethods() {
    // Mock payment methods - replace with actual service call
    this.paymentMethods = [
      {
        id: '1',
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: '12',
        expiryYear: '2025',
        isDefault: true,
        name: 'John Doe',
        createdAt: new Date('2024-01-15')
      },
      {
        id: '2',
        type: 'card',
        last4: '1234',
        brand: 'mastercard',
        expiryMonth: '06',
        expiryYear: '2026',
        isDefault: false,
        name: 'John Doe',
        createdAt: new Date('2024-03-20')
      }
    ];
  }

  toggleAddCard() {
    this.isAddingCard = !this.isAddingCard;
    if (!this.isAddingCard) {
      this.cardForm.reset();
    }
  }

  formatCardNumber(event: any) {
    let value = event.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = value.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      event.target.value = parts.join(' ');
    } else {
      event.target.value = value;
    }
  }

  async addPaymentMethod() {
    if (this.cardForm.invalid) {
      this.cardForm.markAllAsTouched();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Adding payment method...'
    });
    await loading.present();

    try {
      const cardData: CardDetails = {
        ...this.cardForm.value,
        cardNumber: this.cardForm.value.cardNumber.replace(/\s+/g, '')
      };

      // Mock adding payment method - replace with actual service call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newMethod: PaymentMethod = {
        id: Date.now().toString(),
        type: 'card',
        last4: cardData.cardNumber.slice(-4),
        brand: this.paymentService.getCardType(cardData.cardNumber),
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        isDefault: cardData.isDefault || this.paymentMethods.length === 0,
        name: cardData.name,
        createdAt: new Date()
      };

      if (newMethod.isDefault) {
        this.paymentMethods.forEach(method => method.isDefault = false);
      }

      this.paymentMethods.unshift(newMethod);
      this.cardForm.reset();
      this.isAddingCard = false;
      this.errorService.showSuccess('Payment method added successfully!');

    } catch (error) {
      this.errorService.handleError(error, 'Adding payment method');
    } finally {
      await loading.dismiss();
    }
  }

  async setDefaultPaymentMethod(method: PaymentMethod) {
    if (method.isDefault) return;

    const loading = await this.loadingController.create({
      message: 'Setting default payment method...'
    });
    await loading.present();

    try {
      // Mock setting default - replace with actual service call
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.paymentMethods.forEach(pm => pm.isDefault = false);
      method.isDefault = true;
      this.errorService.showSuccess('Default payment method updated!');

    } catch (error) {
      this.errorService.handleError(error, 'Setting default payment method');
    } finally {
      await loading.dismiss();
    }
  }

  async deletePaymentMethod(method: PaymentMethod) {
    if (method.isDefault && this.paymentMethods.length > 1) {
      this.errorService.showWarning('Cannot delete the default payment method. Please set another method as default first.');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Delete Payment Method',
      message: `Are you sure you want to delete the ${method.brand} card ending in ${method.last4}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.confirmDeletePaymentMethod(method)
        }
      ]
    });
    await alert.present();
  }

  private async confirmDeletePaymentMethod(method: PaymentMethod) {
    const loading = await this.loadingController.create({
      message: 'Deleting payment method...'
    });
    await loading.present();

    try {
      // Mock deletion - replace with actual service call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const index = this.paymentMethods.findIndex(pm => pm.id === method.id);
      if (index > -1) {
        this.paymentMethods.splice(index, 1);
      }

      // If we deleted the last method, make the first one default
      if (this.paymentMethods.length > 0 && !this.paymentMethods.some(pm => pm.isDefault)) {
        this.paymentMethods[0].isDefault = true;
      }

      this.errorService.showSuccess('Payment method deleted successfully!');

    } catch (error) {
      this.errorService.handleError(error, 'Deleting payment method');
    } finally {
      await loading.dismiss();
    }
  }

  getCardIcon(brand: string): string {
    switch (brand.toLowerCase()) {
      case 'visa': return 'card';
      case 'mastercard': return 'card';
      case 'amex': return 'card';
      case 'discover': return 'card';
      default: return 'card-outline';
    }
  }

  getFieldError(fieldName: string): string {
    const field = this.cardForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['invalidCard']) return 'Invalid card number';
      if (field.errors['invalidExpiry']) return 'Invalid expiry date';
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
    }
    return '';
  }

  get months() {
    return Array.from({ length: 12 }, (_, i) => {
      const month = (i + 1).toString().padStart(2, '0');
      return { value: month, label: month };
    });
  }

  get years() {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 20 }, (_, i) => {
      const year = currentYear + i;
      return { value: year.toString(), label: year.toString() };
    });
  }
}
