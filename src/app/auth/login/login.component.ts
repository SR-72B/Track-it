// src/app/auth/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { AuthService, User } from '../auth.service'; // Assuming User interface is exported from AuthService
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html', // Ensure this file exists
  styleUrls: ['./login.component.scss'],   // Ensure this file exists
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule // For routerLink used in goToSignup() or forgotPassword() in template
  ]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {}

  async login() {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      this.showToast('Please fill in all required fields correctly.', 'warning');
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Logging in...',
      spinner: 'crescent',
      backdropDismiss: false
    });
    await loading.present();

    try {
      const { email, password } = this.loginForm.value;
      const result = await this.authService.login(email, password);

      if (result && result.user) {
        if (result.user.emailVerified) {
          try {
            // Assuming AuthService.getUserData returns Observable<User | undefined>
            // and User interface includes accountType.
            const userData = await firstValueFrom(this.authService.getUserData(result.user.uid));

            await loading.dismiss();
            this.isSubmitting = false;

            if (userData && userData.accountType === 'retailer') {
              this.router.navigate(['/retailer/dashboard']);
            } else if (userData) { // For customer or any other authenticated user
              this.router.navigate(['/customer/dashboard']); // Or your preferred default customer route
            } else {
              console.error('User data not found in Firestore after login for UID:', result.user.uid);
              await this.authService.logout();
              this.showErrorAlert('Login Error', 'Could not retrieve your account details. Please log in again.');
            }
          } catch (userDataError: any) {
            await loading.dismiss();
            this.isSubmitting = false;
            console.error('Error fetching user data from Firestore:', userDataError);
            this.showErrorAlert('Login Issue', 'Logged in, but failed to retrieve account details. Please try again.');
            await this.authService.logout(); // Log out if crucial data is missing
          }
        } else {
          await loading.dismiss();
          this.isSubmitting = false;
          await this.authService.logout(); // Log out user if email is not verified

          const alert = await this.alertController.create({
            header: 'Email Verification Required',
            message: 'Please verify your email address before logging in. A new verification email can be sent.',
            backdropDismiss: false,
            buttons: [
              {
                text: 'Resend Verification Email',
                handler: async () => {
                  try {
                    await this.authService.sendVerificationEmail();
                    this.showToast('Verification email sent. Please check your inbox (and spam folder).', 'success', 5000);
                  } catch (resendError: any) {
                    this.showToast(`Failed to resend verification email: ${resendError.message || 'Unknown error'}.`, 'danger', 5000);
                    console.error('Failed to resend verification email', resendError);
                  }
                }
              },
              { text: 'OK', role: 'cancel' }
            ]
          });
          await alert.present();
        }
      } else {
        // This case implies authService.login resolved without a user, which is unusual.
        // Typically, login errors are thrown and caught by the outer catch block.
        await loading.dismiss();
        this.isSubmitting = false;
        throw new Error('Login failed: No user object returned from authentication service.');
      }
    } catch (error: any) {
      await loading.dismiss();
      this.isSubmitting = false;
      console.error('Login error caught in component:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code) { // Firebase auth errors often have a 'code' property
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password. Please check your credentials.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This user account has been disabled.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      this.showErrorAlert('Login Failed', errorMessage);
    }
  }

  goToSignup() {
    this.router.navigate(['/auth/signup']); // Ensure this route is defined in your auth.routes.ts or app.routes.ts
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Reset Password',
      backdropDismiss: false,
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Enter your email address',
          attributes: { required: true }
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send Reset Email',
          handler: async (data) => {
            if (data.email && data.email.trim() !== '' && /\S+@\S+\.\S+/.test(data.email)) {
              const loading = await this.loadingController.create({ message: 'Sending reset email...' });
              await loading.present();
              try {
                await this.authService.resetPassword(data.email);
                await loading.dismiss();
                this.showToast('Password reset email sent. Check your inbox (and spam folder).', 'success', 5000);
              } catch (error: any) {
                await loading.dismiss();
                let resetErrorMessage = 'Could not send reset email. Please try again.';
                if (error.code === 'auth/user-not-found') {
                  resetErrorMessage = 'No account found with this email address.';
                } else if (error.message) {
                  resetErrorMessage = error.message;
                }
                this.showErrorAlert('Password Reset Error', resetErrorMessage);
              }
            } else {
              this.showToast('Please enter a valid email address.', 'warning');
              return false; // Prevent alert from dismissing
            }
          }
        }
      ]
    });
    await alert.present();
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

