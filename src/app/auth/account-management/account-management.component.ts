// src/app/auth/account-management/account-management.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { AuthService, User } from '../auth.service';
import { Subscription, firstValueFrom, of } from 'rxjs'; // Added 'of' here
import { catchError, finalize, take } from 'rxjs/operators';

@Component({
  selector: 'app-account-management',
  templateUrl: './account-management.component.html',
  styleUrls: ['./account-management.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class AccountManagementComponent implements OnInit, OnDestroy {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  user: User | null = null;
  isLoading = true;
  isSavingProfile = false;
  isSavingPassword = false;
  errorMessage: string | null = null;

  private userSubscription: Subscription | undefined;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    this.profileForm = this.fb.group({
      displayName: ['', Validators.required],
      phoneNumber: [''],
      email: [{ value: '', disabled: true }]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.checkPasswords });
  }

  ngOnInit() {
    this.loadUserProfile();
  }

  async loadUserProfile() {
    this.isLoading = true;
    this.errorMessage = null;
    const loading = await this.loadingController.create({
      message: 'Loading profile...',
      spinner: 'crescent'
    });
    await loading.present();

    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }

    this.userSubscription = this.authService.currentUser$.pipe(
      take(1),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
      }),
      catchError(err => {
        console.error('Error loading user profile:', err);
        this.errorMessage = 'Failed to load profile. Please try again.';
        this.user = null;
        return of(null); // 'of' is used here
      })
    ).subscribe(user => {
      if (user) {
        this.user = user as User;
        this.profileForm.patchValue({
          displayName: this.user.displayName || '',
          phoneNumber: this.user.phoneNumber || '',
          email: this.user.email
        });
      } else if (!this.errorMessage) {
        this.errorMessage = 'No user data found.';
      }
    });
  }

  checkPasswords(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('newPassword')?.value;
    const confirmPass = group.get('confirmPassword')?.value;
    return pass === confirmPass ? null : { notSame: true };
  }

  async updateProfile() {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      this.showToast('Please correct the errors in the profile form.', 'warning');
      return;
    }
    if (!this.user || !this.user.uid) {
      this.showToast('User information is missing. Cannot update profile.', 'danger');
      return;
    }

    this.isSavingProfile = true;
    const loading = await this.loadingController.create({
      message: 'Updating profile...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const { displayName, phoneNumber } = this.profileForm.value;
      await this.authService.updateProfile(this.user.uid, {
        displayName,
        phoneNumber
      });
      await loading.dismiss();
      this.showToast('Profile updated successfully!', 'success');
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error updating profile:', error);
      this.showErrorAlert('Profile Update Failed', error.message || 'An unexpected error occurred.');
    } finally {
      this.isSavingProfile = false;
    }
  }

  async updatePassword() {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      this.showToast('Please correct the errors in the password form.', 'warning');
      return;
    }

    this.isSavingPassword = true;
    const loading = await this.loadingController.create({
      message: 'Updating password...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const { currentPassword, newPassword } = this.passwordForm.value;
      await this.authService.updatePassword(currentPassword, newPassword);
      await loading.dismiss();
      this.showToast('Password updated successfully! Please log in again if prompted.', 'success');
      this.passwordForm.reset();
    } catch (error: any) {
      await loading.dismiss();
      console.error('Error updating password:', error);
      this.showErrorAlert('Password Update Failed', error.message || 'An unexpected error occurred. Common issues include incorrect current password.');
    } finally {
      this.isSavingPassword = false;
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
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}

