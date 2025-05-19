// src/app/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, of } from 'rxjs'; // Added 'from' for reauthenticateWithCredential and 'of' for error handling
import { map, switchMap, catchError } from 'rxjs/operators'; // Added switchMap and catchError
import firebase from 'firebase/compat/app'; // Import firebase for EmailAuthProvider

export interface User {
  uid: string;
  email: string;
  accountType: 'retailer' | 'customer';
  displayName?: string;
  phoneNumber?: string;
  emailVerified: boolean;
  hasActiveSubscription?: boolean;
  subscriptionEndDate?: any; // Changed to 'any' for flexibility with Firestore Timestamps or Date objects
  subscriptionStatus?: 'active' | 'cancelled' | 'trial' | 'expired' | 'pending_payment' | string; // Added this line
  // Add any other user-specific fields here
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router
  ) {
    this.afAuth.authState.pipe(
      switchMap(firebaseUser => {
        if (firebaseUser) {
          return this.getUserData(firebaseUser.uid).pipe(
            map(userData => {
              if (userData) {
                // Ensure subscriptionEndDate is a Date object if it's a Firestore Timestamp
                let subEndDate = userData.subscriptionEndDate;
                if (subEndDate && typeof subEndDate.seconds === 'number') {
                  subEndDate = new Date(subEndDate.seconds * 1000);
                }

                const user: User = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  emailVerified: firebaseUser.emailVerified,
                  ...userData,
                  subscriptionEndDate: subEndDate // Assign potentially converted date
                };
                return user;
              }
              return null;
            }),
            catchError(error => {
              console.error("Error fetching user data:", error);
              return of(null); // Return null observable on error
            })
          );
        } else {
          return of(null); // No Firebase user, emit null
        }
      })
    ).subscribe(user => {
      this.currentUserSubject.next(user);
    });
  }

  getUserData(uid: string): Observable<User | null> { // Changed 'any' to 'User | null' for better typing
    return this.firestore.doc<User>(`users/${uid}`).valueChanges()
      .pipe(
        map(userData => userData || null) // Ensure it returns null if userData is undefined
      );
  }

  async signup(email: string, password: string, accountType: 'retailer' | 'customer'): Promise<firebase.auth.UserCredential> { // Explicit return type
    try {
      const result = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (result.user) {
        await result.user.sendEmailVerification();
        // Prepare user data for Firestore
        const userData: Partial<User> = { // Use Partial<User> for initial setup
          email,
          accountType,
          emailVerified: false,
          hasActiveSubscription: accountType === 'customer', // Customers might not have subscription immediately
          // createdAt: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp
        };
        await this.firestore.doc(`users/${result.user.uid}`).set(userData);
        return result;
      } else {
        throw new Error('User creation failed: No user object returned.');
      }
    } catch (error) {
      console.error("Signup error:", error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  async login(email: string, password: string): Promise<firebase.auth.UserCredential> { // Explicit return type
    try {
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
      // User data will be fetched by the authState subscription
      return result;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.afAuth.signOut();
      this.currentUserSubject.next(null); // Clear current user on logout
      this.router.navigate(['/login']); // Navigate to login page
    } catch (error) {
      console.error("Logout error:", error);
      // Optionally show a user-friendly message
    }
  }

  async sendVerificationEmail(): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (user) {
      return user.sendEmailVerification();
    }
    // throw new Error('No authenticated user to send verification email.'); // More specific error
    console.warn('Attempted to send verification email, but no user is currently authenticated.');
    return Promise.resolve(); // Or reject, depending on desired behavior
  }

  async resetPassword(email: string): Promise<void> {
    try {
      return await this.afAuth.sendPasswordResetEmail(email);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  }

  async updateProfile(uid: string, data: Partial<User>): Promise<void> {
    if (!uid) {
      console.error('UID is required to update profile.');
      throw new Error('UID is required to update profile.');
    }
    try {
      // If updating subscriptionEndDate and it's a Date object,
      // Firestore will convert it to a Timestamp automatically.
      return await this.firestore.doc(`users/${uid}`).update(data);
    } catch (error) {
      console.error('Error updating user profile:', error)
      throw error;
    }
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user or user email is missing for password update.');
      }

      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
    } catch (error) {
      console.error("Password update error:", error);
      throw error;
    }
  }

  isRetailer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user && user.accountType === 'retailer') // Added null check for user
    );
  }

  isCustomer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user && user.accountType === 'customer') // Added null check for user
    );
  }

  hasActiveSubscription(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user?.hasActiveSubscription)
    );
  }
}
