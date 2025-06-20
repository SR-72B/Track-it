// src/app/customer/profile/customer-profile.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../auth/auth.service';
import { FileService } from '../../shared/services/file.service';
import { ErrorService } from '../../shared/services/error.service';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-customer-profile',
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class CustomerProfileComponent implements OnInit, OnDestroy {
  profileForm: FormGroup;
  passwordForm: FormGroup;
  currentUser: User | null = null;
  isLoading = false;
  isEditMode = false;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private fileService: FileService,
    private errorService: ErrorService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    this.profileForm = this.createProfileForm();
    this.passwordForm = this.createPasswordForm();
  }

  ngOnInit() {
    this.loadUserProfile();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createProfileForm(): FormGroup {
    return this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.pattern(/^\+?[\d\s\-\(\)]+$/)]],
      profileImageUrl: ['']
    });
  }

  private createPasswordForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(group: FormGroup) {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  private loadUserProfile() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          if (user) {
            this.populateForm(user);
          }
        },
        error: (error) => {
          this.errorService.handleError(error, 'Loading user profile');
        }
      });
  }

  private populateForm(user: User) {
    this.profileForm.patchValue({
      displayName: user.displayName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      profileImageUrl: user.profileImageUrl || ''
    });
    this.previewUrl = user.profileImageUrl || null;
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      // Reset form when canceling edit
      if (this.currentUser) {
        this.populateForm(this.currentUser);
      }
      this.selectedFile = null;
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validate file
      const validation = this.fileService.validateFile(file, ['jpg', 'jpeg', 'png'], 5);
      if (!validation.isValid) {
        this.errorService.showError(validation.errors.join(', '));
        return;
      }

      this.selectedFile = file;
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async saveProfile() {
    if (this.profileForm.invalid || !this.currentUser) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Updating profile...'
    });
    await loading.present();

    try {
      let profileImageUrl = this.currentUser.profileImageUrl;

      // Upload new profile image if selected
      if (this.selectedFile) {
        const imagePath = this.fileService.generateUniqueFilePath(
          'profile-images',
          this.selectedFile.name,
          this.currentUser.uid
        );
        profileImageUrl = await firstValueFrom(
          this.fileService.uploadFile(this.selectedFile, imagePath)
        );
      }

      // Update profile
      const updateData = {
        ...this.profileForm.value,
        profileImageUrl
      };

      await this.authService.updateProfile(this.currentUser.uid, updateData);
      
      this.isEditMode = false;
      this.selectedFile = null;
      this.errorService.showSuccess('Profile updated successfully!');
      
    } catch (error) {
      this.errorService.handleError(error, 'Updating profile');
    } finally {
      await loading.dismiss();
    }
  }

  async changePassword() {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Changing password...'
    });
    await loading.present();

    try {
      const { currentPassword, newPassword } = this.passwordForm.value;
      await this.authService.updatePassword(currentPassword, newPassword);
      
      this.passwordForm.reset();
      this.errorService.showSuccess('Password changed successfully!');
      
    } catch (error) {
      this.errorService.handleError(error, 'Changing password');
    } finally {
      await loading.dismiss();
    }
  }

  async resendVerificationEmail() {
    if (!this.currentUser?.email) return;

    const loading = await this.loadingController.create({
      message: 'Sending verification email...'
    });
    await loading.present();

    try {
      await this.authService.sendVerificationEmail();
      this.errorService.showSuccess('Verification email sent! Please check your inbox.');
    } catch (error) {
      this.errorService.handleError(error, 'Sending verification email');
    } finally {
      await loading.dismiss();
    }
  }

  async confirmDeleteAccount() {
    const alert = await this.alertController.create({
      header: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteAccount()
        }
      ]
    });
    await alert.present();
  }

  private async deleteAccount() {
    const loading = await this.loadingController.create({
      message: 'Deleting account...'
    });
    await loading.present();

    try {
      await this.authService.deleteAccount();
      this.errorService.showSuccess('Account deleted successfully');
    } catch (error) {
      this.errorService.handleError(error, 'Deleting account');
    } finally {
      await loading.dismiss();
    }
  }

  getFieldError(fieldName: string, formGroup: FormGroup = this.profileForm): string {
    const field = formGroup.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Invalid email format';
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['pattern']) return 'Invalid phone number format';
      if (field.errors['passwordMismatch']) return 'Passwords do not match';
    }
    return '';
  }
}
