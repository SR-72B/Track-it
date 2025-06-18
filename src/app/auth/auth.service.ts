// src/app/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, of, firstValueFrom } from 'rxjs'; // Ensure firstValueFrom is imported
import { map, switchMap, catchError } from 'rxjs/operators';
import firebase from 'firebase/compat/app'; // For firebase.firestore.FieldValue

// User interface defining the structure of your user objects
export interface User {
  uid: string;
  email: string | null; // Email can be null from Firebase user object
  accountType: 'retailer' | 'customer';
  displayName?: string | null; // displayName can be null
  phoneNumber?: string | null;
  emailVerified: boolean;
  hasActiveSubscription?: boolean; // Managed by payment/subscription flow
  subscriptionEndDate?: any; // Firestore Timestamp or Date object
  subscriptionStatus?: 'active' | 'cancelled' | 'trialing' | 'expired' | 'pending_payment' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'ended' | string;
  createdAt?: any; // Firestore Timestamp or Date object
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
    // Subscribe to Firebase's authState to get the current Firebase user
    // Then, fetch corresponding user data from Firestore to create a combined User object
    this.afAuth.authState.pipe(
      switchMap(firebaseUser => {
        if (firebaseUser) {
          // If a Firebase user exists, get their custom data from Firestore
          return this.getUserData(firebaseUser.uid).pipe(
            map(userDataFromDb => {
              if (userDataFromDb) {
                // Convert Firestore Timestamps to JS Date objects if they exist
                let subEndDate = userDataFromDb.subscriptionEndDate;
                if (subEndDate && typeof subEndDate.seconds === 'number') {
                  subEndDate = new Date(subEndDate.seconds * 1000);
                }
                let creationDate = userDataFromDb.createdAt;
                 if (creationDate && typeof creationDate.seconds === 'number') {
                  creationDate = new Date(creationDate.seconds * 1000);
                }

                // Combine Firebase Auth data with Firestore data
                const user: User = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  emailVerified: firebaseUser.emailVerified,
                  displayName: firebaseUser.displayName || userDataFromDb.displayName, // Prioritize Firebase Auth displayName
                  phoneNumber: firebaseUser.phoneNumber || userDataFromDb.phoneNumber, // Prioritize Firebase Auth phoneNumber
                  // Custom fields from Firestore document
                  accountType: userDataFromDb.accountType,
                  hasActiveSubscription: userDataFromDb.hasActiveSubscription,
                  subscriptionStatus: userDataFromDb.subscriptionStatus,
                  subscriptionEndDate: subEndDate,
                  createdAt: creationDate,
                };
                return user;
              }
              // This case means a Firebase user exists, but their document in 'users' collection is missing.
              // This might happen if signup didn't complete fully or data was manually deleted.
              // It's a potentially problematic state.
              console.warn(`No Firestore data found for user ${firebaseUser.uid}. User profile is incomplete.`);
              // Fallback to a minimal User object based on Firebase Auth data.
              // Critical application logic should handle users in this state (e.g., force profile completion).
              return {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  emailVerified: firebaseUser.emailVerified,
                  displayName: firebaseUser.displayName,
                  phoneNumber: firebaseUser.phoneNumber,
                  accountType: 'customer', // Defaulting accountType is risky, handle this state carefully in app
                  hasActiveSubscription: false, // Default
              } as User; // Cast as User, acknowledge this is a fallback
            }),
            catchError(error => {
              console.error("Error fetching user data from Firestore:", error);
              this.currentUserSubject.next(null); // Clear current user on error
              return of(null); // Propagate null to indicate an error state
            })
          );
        } else {
          // No Firebase user is authenticated
          return of(null);
        }
      })
    ).subscribe(user => {
      this.currentUserSubject.next(user); // Update the BehaviorSubject with the new user state
    });
  }

  /**
   * Retrieves user data document from Firestore.
   * @param uid User ID
   * @returns Observable of User data or undefined if not found.
   */
  getUserData(uid: string): Observable<User | undefined> {
    return this.firestore.doc<User>(`users/${uid}`).valueChanges()
      .pipe(
        map(userData => userData) // Simply pass through the data or undefined
      );
  }

  /**
   * Signs up a new user with email, password, display name, and account type.
   * Creates a Firebase Auth user, updates their profile, sends a verification email,
   * and creates a corresponding user document in Firestore.
   */
  async signup(email: string, password: string, displayName: string, accountType: 'retailer' | 'customer'): Promise<firebase.auth.UserCredential> {
    try {
      const result = await this.afAuth.createUserWithEmailAndPassword(email, password);
      if (!result.user) {
        throw new Error('User creation failed: No user object returned from Firebase Auth.');
      }

      // Update the Firebase Auth user's profile with the display name
      await result.user.updateProfile({ displayName: displayName });

      // Send email verification to the new user
      await result.user.sendEmailVerification();

      // Prepare user data for Firestore document
      const userData: User = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: displayName,
        accountType: accountType,
        emailVerified: false, // Email is not verified initially
        hasActiveSubscription: false, // Customers are free; retailers subscribe separately
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Use server-side timestamp
      };
      // Create the user document in Firestore
      await this.firestore.doc(`users/${result.user.uid}`).set(userData);

      return result;
    } catch (error) {
      console.error("Signup error in AuthService:", error);
      throw error; // Re-throw the error to be handled by the calling component
    }
  }

  /**
   * Logs in an existing user with email and password.
   */
  async login(email: string, password: string): Promise<firebase.auth.UserCredential> {
    try {
      const result = await this.afAuth.signInWithEmailAndPassword(email, password);
      // The authState observer in the constructor will handle fetching full user data
      // and updating the currentUserSubject.
      return result;
    } catch (error) {
      console.error("Login error in AuthService:", error);
      throw error;
    }
  }

  /**
   * Logs out the current user.
   */
  async logout(): Promise<void> {
    try {
      await this.afAuth.signOut();
      // currentUserSubject will be updated to null by the authState observer.
      this.router.navigate(['/auth/login']); // Redirect to login page
    } catch (error) {
      console.error("Logout error:", error);
      // Optionally, show a user-friendly message if logout fails for some reason
    }
  }

  /**
   * Sends a verification email to the currently authenticated user.
   */
  async sendVerificationEmail(): Promise<void> {
    const user = await firstValueFrom(this.afAuth.authState); // Get current Firebase user
    if (user) {
      return user.sendEmailVerification();
    }
    console.warn('Attempted to send verification email, but no user is currently authenticated.');
    // Optionally throw an error or return a rejected promise if no user
    // throw new Error('No authenticated user to send verification email.');
  }

  /**
   * Sends a password reset email to the given email address.
   */
  async resetPassword(email: string): Promise<void> {
    try {
      return await this.afAuth.sendPasswordResetEmail(email);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  }

  /**
   * Updates the user's profile in both Firebase Auth (for displayName/photoURL)
   * and Firestore (for custom data).
   */
  async updateProfile(uid: string, data: Partial<User>): Promise<void> {
    if (!uid) {
      throw new Error('UID is required to update profile.');
    }
    try {
      // Prepare updates for Firebase Auth profile (displayName, photoURL)
      const authProfileUpdates: { displayName?: string | null; photoURL?: string | null } = {};
      if (data.displayName !== undefined) {
        authProfileUpdates.displayName = data.displayName;
      }
      // if (data.photoURL !== undefined) { // Example if you add photoURL
      //   authProfileUpdates.photoURL = data.photoURL;
      // }

      // If there are changes for Firebase Auth profile, update it
      if (Object.keys(authProfileUpdates).length > 0) {
        const user = await firstValueFrom(this.afAuth.authState);
        // Ensure we are updating the profile of the currently logged-in user
        if (user && user.uid === uid) {
          await user.updateProfile(authProfileUpdates);
        }
      }

      // Update the Firestore document with all provided data
      return await this.firestore.doc(`users/${uid}`).update(data);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Updates the authenticated user's password.
   * Requires re-authentication with the current password.
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await firstValueFrom(this.afAuth.authState);
      if (!user || !user.email) { // User must be authenticated and have an email for this method
        throw new Error('No authenticated user or user email is missing for password update.');
      }
      // Get credential for re-authentication
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
      // Re-authenticate the user
      await user.reauthenticateWithCredential(credential);
      // Update the password
      await user.updatePassword(newPassword);
    } catch (error) {
      console.error("Password update error:", error);
      throw error;
    }
  }

  /**
   * Checks if the current user is a retailer.
   * @returns Observable<boolean>
   */
  isRetailer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user && user.accountType === 'retailer')
    );
  }

  /**
   * Checks if the current user is a customer.
   * @returns Observable<boolean>
   */
  isCustomer(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user && user.accountType === 'customer')
    );
  }

  /**
   * Checks if the current user has an active subscription.
   * Relies on the hasActiveSubscription field from the Firestore user document.
   * @returns Observable<boolean>
   */
  hasActiveSubscription(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user?.hasActiveSubscription) // Optional chaining for safety
    );
  }
}
