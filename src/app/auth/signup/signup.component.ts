// src/app/auth/signup/signup.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html', // Ensure this file exists
  styleUrls: ['./signup.component.scss'],   // Ensure this file exists
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule // For routerLink if used in template (e.g., for "Go to Login")
  ]
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  isSubmitting = false;
  accountTypes = [
    { value: 'customer', label: 'Customer' },
    { value: 'retailer', label: 'Retailer' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    this.signupForm = this.fb.group({
      displayName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      accountType: ['customer', Validators.required] // Default to customer
    }, { validators: this.checkPasswords });
  }

  ngOnInit() {}

  // Custom validator for password match
  checkPasswords(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { notSame: true };
  }

  async signup() {
    if (this.signupForm.invalid) {
      this.markFormGroupTouched(this.signupForm);
      this.showToast('Please fill in all required fields correctly.', 'warning');
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Creating your account...',
      spinner: 'crescent',
      backdropDismiss: false
    });
    await loading.present();

    try {
      const { displayName, email, password, accountType } = this.signupForm.value;
      // Ensure your AuthService.signup method accepts displayName and accountType
      await this.authService.signup(email, password, displayName, accountType);
      
      await loading.dismiss();
      this.isSubmitting = false;

      const alert = await this.alertController.create({
        header: 'Account Created Successfully!',
        message: 'A verification email has been sent to your email address. Please verify your email before logging in.',
        backdropDismiss: false,
        buttons: [{
          text: 'OK, Go to Login',
          handler: () => {
            this.router.navigate(['/auth/login']); // Navigate to login page
          }
        }]
      });
      await alert.present();
      this.signupForm.reset(); // Reset form after successful signup

    } catch (error: any) {
      await loading.dismiss();
      this.isSubmitting = false;
      console.error('Signup error:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code) { // Firebase auth errors often have a 'code' property
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already in use by another account.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak. Please choose a stronger password.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      this.showErrorAlert('Signup Failed', errorMessage);
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login']); // Ensure this route is defined
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
}

