// src/app/auth/login/login.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../auth.service';
import { firstValueFrom } from 'rxjs'; // Import for RxJS 7+

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {}

  async login() {
    if (!this.loginForm.valid) {
      return; // Exit if form is invalid
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Logging in...',
      spinner: 'crescent',
      backdropDismiss: false // Good practice for critical operations
    });
    await loading.present();

    try {
      const { email, password } = this.loginForm.value;
      const result = await this.authService.login(email, password);
      
      if (result.user.emailVerified) {
        try {
          // Ensure loading persists until user data is fetched
          const userData = await firstValueFrom(this.authService.getUserData(result.user.uid));

          await loading.dismiss();
          this.isSubmitting = false;

          if (userData && userData.accountType === 'retailer') {
            this.router.navigate(['/retailer/dashboard']);
          } else if (userData) {
            this.router.navigate(['/customer/orders']);
          } else {
            // Handle case where userData might be unexpectedly null/undefined
            console.error('User data not found after login.');
            await this.authService.logout();
            const alert = await this.alertController.create({
              header: 'Login Error',
              message: 'Could not retrieve your account details. Please log in again.',
              buttons: ['OK']
            });
            await alert.present();
          }
        } catch (userDataError) {
          await loading.dismiss();
          this.isSubmitting = false;
          console.error('Error fetching user data:', userDataError);
          const alert = await this.alertController.create({
            header: 'Login Issue',
            message: 'Logged in, but failed to retrieve account details. Please try again.',
            buttons: ['OK']
          });
          await alert.present();
            await this.authService.logout(); // Log out if crucial data is missing
        }
      } else {
        await loading.dismiss();
        this.isSubmitting = false;
        await this.authService.logout(); // Important: log out if email not verified

        const alert = await this.alertController.create({
          header: 'Email Verification Required',
          message: 'Please verify your email before logging in.',
          buttons: [
            {
              text: 'Resend Verification',
              handler: async () => { // Consider making handler async for feedback
                try {
                    await this.authService.sendVerificationEmail();
                    // Optionally: show toast "Verification email sent"
                  } catch (resendError) {
                    // Optionally: show toast "Failed to resend email"
                    console.error('Failed to resend verification email', resendError);
                  }
              }
            },
            { text: 'OK', role: 'cancel' }
          ]
        });
        await alert.present();
      }
    } catch (error) {
      await loading.dismiss();
      this.isSubmitting = false;
      
      // Enhanced error messaging
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      const alert = await this.alertController.create({
        header: 'Login Failed',
        message: errorMessage,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Reset Password',
      backdropDismiss: false,
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Enter your email',
          attributes: {
            required: true // Add basic HTML5 validation if desired
          }
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reset',
          handler: async (data) => {
            if (data.email && data.email.trim() !== '') { // Basic check for non-empty email
              const loading = await this.loadingController.create({ message: 'Sending reset email...' });
              await loading.present();
              try {
                await this.authService.resetPassword(data.email);
                  await loading.dismiss();
                const successAlert = await this.alertController.create({
                  header: 'Success',
                  message: 'Password reset email sent. Check your inbox.',
                  buttons: ['OK']
                });
                await successAlert.present();
              } catch (error) {
                  await loading.dismiss();
                  let errorMessage = 'Could not send reset email. Please try again.';
                  if (error.code === 'auth/user-not-found') {
                    errorMessage = 'No account found with this email address.';
                  } else if (error.message) {
                    errorMessage = error.message;
                  }
                const errorAlert = await this.alertController.create({
                  header: 'Error',
                  message: errorMessage,
                  buttons: ['OK']
                });
                await errorAlert.present();
              }
            } else {
              // Optionally provide feedback if email is empty, though the button might be disabled
              // or AlertController handles empty required fields.
              const noEmailAlert = await this.alertController.create({
                header: 'Input Required',
                message: 'Please enter your email address.',
                buttons: ['OK']
              });
              await noEmailAlert.present();
              return false; // Prevent alert from dismissing automatically on invalid input if needed
            }
          }
        }
      ]
    });
    await alert.present();
  }
}