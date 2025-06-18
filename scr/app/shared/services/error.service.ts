// src/app/shared/services/error.service.ts
import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  constructor(private toastController: ToastController) {}

  /**
   * Display an error message as a toast notification
   * @param message The error message to display
   * @param duration How long to show the toast (in ms)
   */
  async showError(message: string, duration: number = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message: message,
      duration: duration,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }

  /**
   * Parse and format Firebase authentication errors
   * @param error The error object from Firebase
   * @returns A user-friendly error message
   */
  parseAuthError(error: any): string {
    const errorCode = error.code || '';
    
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email address is already in use. Please use a different email or log in.';
      case 'auth/invalid-email':
        return 'Invalid email address. Please check and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please check or create a new account.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again or reset your password.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use a stronger password.';
      case 'auth/requires-recent-login':
        return 'This action requires recent authentication. Please log in again.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful login attempts. Please try again later or reset your password.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Parse and format Firestore database errors
   * @param error The error object from Firestore
   * @returns A user-friendly error message
   */
  parseFirestoreError(error: any): string {
    const errorCode = error.code || '';
    
    switch (errorCode) {
      case 'permission-denied':
        return 'You do not have permission to perform this action.';
      case 'not-found':
        return 'The requested document was not found.';
      case 'already-exists':
        return 'The document already exists.';
      case 'resource-exhausted':
        return 'Quota exceeded. Please try again later.';
      case 'failed-precondition':
        return 'Operation could not be executed in the current system state.';
      case 'unavailable':
        return 'The service is currently unavailable. Please try again later.';
      default:
        return error.message || 'A database error occurred. Please try again.';
    }
  }
}