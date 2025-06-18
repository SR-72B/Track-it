// src/app/retailer/form-builder/form-builder.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef
import { FormBuilder, FormGroup, FormArray, Validators, FormControl, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';

import { AuthService, User } from '../../auth/auth.service';
import { FormBuilderService, OrderForm, FormField } from './form-builder.service'; // Ensure FormField has all needed props
import { Subscription, firstValueFrom, of } from 'rxjs';
import { first, filter, catchError, finalize, tap } from 'rxjs/operators';

@Component({
  selector: 'app-form-builder',
  templateUrl: './form-builder.component.html',
  styleUrls: ['./form-builder.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class FormBuilderComponent implements OnInit, OnDestroy {
  formBuilderForm!: FormGroup;
  isSubmitting = false;
  isEditing = false;
  formId: string | null = null;
  isLoading = false;
  errorMessage: string | null = null;

  fieldTypes = [
    { value: 'text', label: 'Text Field' },
    { value: 'email', label: 'Email Field' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number Input' },
    { value: 'date', label: 'Date Picker' },
    { value: 'radio', label: 'Multiple Choice (Single Select)' },
    { value: 'checkbox', label: 'Checkbox Group (Multiple Select)' },
    { value: 'upload', label: 'File Upload' }
  ];

  availableFileTypesForSelection = [
    { value: 'image/png', label: 'PNG Images (.png)' },
    { value: 'image/jpeg', label: 'JPEG Images (.jpg, .jpeg)' },
    { value: 'application/pdf', label: 'PDF Documents (.pdf)' },
    { value: 'image/heic', label: 'HEIC Images (.heic)' },
    { value: 'text/csv', label: 'CSV Files (.csv)' },
    { value: 'application/msword', label: 'Word Documents (.doc)' },
    { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word Documents (.docx)' },
    { value: 'application/vnd.ms-excel', label: 'Excel Spreadsheets (.xls)' },
    { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel Spreadsheets (.xlsx)' },
  ];

  private routeSubscription: Subscription | undefined;
  private loadFormSubscription: Subscription | undefined;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private formBuilderService: FormBuilderService,
    private route: ActivatedRoute,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef // Injected ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initForm();
    this.routeSubscription = this.route.params.subscribe(params => {
      if (params['id']) {
        this.formId = params['id'];
        this.isEditing = true;
        this.loadFormToEdit(this.formId);
      }
    });
  }

  initForm(initialData?: Partial<OrderForm>) {
    this.formBuilderForm = this.fb.group({
      title: [initialData?.title || '', Validators.required],
      description: [initialData?.description || ''],
      fields: this.fb.array([]),
      allowFileUpload: [initialData?.allowFileUpload || false],
      allowedFileTypes: this.fb.array(initialData?.allowedFileTypes?.map(type => this.fb.control(type)) || []),
      maxFilesAllowed: [initialData?.maxFilesAllowed || 1, [Validators.required, Validators.min(1), Validators.max(10)]],
      cancellationPolicy: [initialData?.cancellationPolicy || 'Orders can be cancelled within 24 hours of submission.'],
      submissionInstructions: [initialData?.submissionInstructions || 'Please review your order carefully before submitting.'],
      active: [initialData?.active !== undefined ? initialData.active : true]
    });

    const fieldsArray = this.formBuilderForm.get('fields') as FormArray;
    while (fieldsArray.length) { // Clear existing fields before populating for edit mode
        fieldsArray.removeAt(0);
    }
    if (initialData && initialData.fields) {
        initialData.fields.forEach(field => this.addField(field));
    }
    this.cdr.detectChanges(); // Ensure form updates reflect in the view
  }

  async loadFormToEdit(formId: string) {
    this.isLoading = true;
    this.errorMessage = null;
    const loading = await this.loadingController.create({ message: 'Loading form...', spinner: 'crescent' });
    await loading.present();

    if (this.loadFormSubscription) {
        this.loadFormSubscription.unsubscribe();
    }

    this.loadFormSubscription = this.formBuilderService.getOrderForm(formId).pipe(
      first(form => form !== undefined),
      catchError(error => {
        console.error('Error loading form for editing:', error);
        this.errorMessage = `Failed to load form data: ${error.message || 'Unknown error'}`;
        this.router.navigate(['/retailer/forms']);
        return of(null);
      }),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
        this.cdr.detectChanges();
      })
    ).subscribe(form => {
      if (form) {
        this.initForm(form);
      } else if (!this.errorMessage) {
        this.errorMessage = 'Form not found or could not be loaded.';
        this.showToast(this.errorMessage, 'danger');
        this.router.navigate(['/retailer/forms']);
      }
    });
  }

  get fields(): FormArray {
    return this.formBuilderForm.get('fields') as FormArray;
  }

  get formAllowedFileTypes(): FormArray {
    return this.formBuilderForm.get('allowedFileTypes') as FormArray;
  }

  createFieldGroup(existingField?: FormField): FormGroup {
    return this.fb.group({
      id: [existingField?.id || this.generateId()],
      type: [existingField?.type || 'text', Validators.required],
      label: [existingField?.label || '', Validators.required],
      required: [existingField?.required || false],
      description: [existingField?.description || ''],
      placeholder: [existingField?.placeholder || ''],
      defaultValue: [existingField?.defaultValue || ''],
      options: this.fb.array(existingField?.options?.map(option => this.fb.control(option, Validators.required)) || []),
      maxFileSizeMB: [existingField?.maxFileSizeMB || 5, [Validators.min(1), Validators.max(50)]]
    });
  }

  addField(existingField?: FormField) {
    this.fields.push(this.createFieldGroup(existingField));
  }

  removeField(index: number) {
    this.fields.removeAt(index);
  }

  getOptions(fieldIndex: number): FormArray {
    return (this.fields.at(fieldIndex).get('options') as FormArray);
  }

  addOption(fieldIndex: number, value: string = '') {
    this.getOptions(fieldIndex).push(this.fb.control(value, Validators.required));
  }

  removeOption(fieldIndex: number, optionIndex: number) {
    this.getOptions(fieldIndex).removeAt(optionIndex);
  }

  toggleFileType(event: any, typeValue: string) {
    const fileTypesFormArray = this.formAllowedFileTypes;
    if (event.detail.checked) {
      fileTypesFormArray.push(this.fb.control(typeValue));
    } else {
      let i = 0;
      while (i < fileTypesFormArray.length) {
        if (fileTypesFormArray.at(i).value === typeValue) {
          fileTypesFormArray.removeAt(i);
        } else {
          i++;
        }
      }
    }
    this.formBuilderForm.get('allowedFileTypes')?.markAsDirty();
    this.formBuilderForm.get('allowedFileTypes')?.updateValueAndValidity();
  }

  isFileTypeSelected(typeValue: string): boolean {
    return this.formAllowedFileTypes.value.includes(typeValue);
  }

  isFieldTypeWithOptions(fieldIndex: number): boolean {
    const fieldType = this.fields.at(fieldIndex)?.get('type')?.value;
    return fieldType === 'radio' || fieldType === 'checkbox';
  }

  generateId(): string {
    return `field_${Math.random().toString(36).substring(2, 9)}`;
  }

  async saveForm() {
    if (this.formBuilderForm.invalid) {
      this.markFormGroupTouched(this.formBuilderForm);
      this.showToast('Please ensure all required fields are filled correctly.', 'warning');
      return;
    }
    if (this.formBuilderForm.get('allowFileUpload')?.value && this.formAllowedFileTypes.length === 0) {
        this.showToast('If file uploads are allowed, please select at least one allowed file type.', 'warning');
        this.formBuilderForm.get('allowedFileTypes')?.markAsTouched();
        return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: this.isEditing ? 'Updating form...' : 'Creating form...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const formValue = this.formBuilderForm.getRawValue();
      
      const fieldsToSave: FormField[] = formValue.fields
        .filter((field: any) => field.label && field.label.trim() !== '')
        .map((field: any) => {
          const newField: FormField = {
            id: field.id || this.generateId(),
            type: field.type,
            label: field.label.trim(),
            required: field.required || false,
            description: field.description?.trim() || '',
            placeholder: field.placeholder?.trim() || '',
            defaultValue: field.defaultValue || '',
            options: (field.options || []).filter((opt: string) => opt && opt.trim() !== ''),
            maxFileSizeMB: field.type === 'upload' ? (field.maxFileSizeMB || 5) : undefined
          };
          if ((field.type === 'radio' || field.type === 'checkbox') && (!newField.options || newField.options.length === 0)) {
            newField.options = ['Option 1'];
          }
          return newField;
        });

      const currentUser = await firstValueFrom(this.authService.currentUser$.pipe(
        filter((u): u is User => u !== null && u.uid !== undefined),
        first()
      ));
      
      if (!currentUser) {
        throw new Error("User not authenticated. Cannot save form.");
      }

      const formDataForService: Omit<OrderForm, 'id' | 'createdAt' | 'updatedAt'> = {
        retailerId: currentUser.uid,
        title: formValue.title.trim(),
        description: formValue.description?.trim() || '',
        fields: fieldsToSave,
        active: formValue.active,
        allowFileUpload: formValue.allowFileUpload,
        allowedFileTypes: formValue.allowFileUpload ? (formValue.allowedFileTypes || []) : [],
        maxFilesAllowed: formValue.allowFileUpload ? formValue.maxFilesAllowed : 0,
        cancellationPolicy: formValue.cancellationPolicy?.trim() || '',
        submissionInstructions: formValue.submissionInstructions?.trim() || '',
      };

      if (this.isEditing && this.formId) {
        await this.formBuilderService.updateOrderForm(this.formId, formDataForService);
      } else {
        const newForm = await this.formBuilderService.createOrderForm(formDataForService);
        console.log('New form created with ID:', newForm.id);
      }
      
      this.showToast(this.isEditing ? 'Form updated successfully!' : 'Form created successfully!', 'success');
      this.formBuilderForm.reset(); // Reset to pristine state
      this.initForm(); // Re-initialize with defaults for a new form
      this.router.navigate(['/retailer/forms']);

    } catch (error: any) {
      console.error('Error saving form:', error);
      this.showErrorAlert('Save Failed', error.message || 'There was an error saving the form.');
    } finally {
      this.isSubmitting = false;
      await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
    }
  }

  async confirmDelete() {
    if (!this.isEditing || !this.formId) return;

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this form? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          cssClass: 'alert-button-danger',
          handler: async () => {
            const loading = await this.loadingController.create({ message: 'Deleting form...', spinner: 'crescent' });
            await loading.present();
            try {
              if (this.formId) {
                await this.formBuilderService.deleteOrderForm(this.formId);
                this.showToast('Form deleted successfully', 'success');
                this.router.navigate(['/retailer/forms']);
              } else { throw new Error("Form ID is missing for deletion."); }
            } catch (error: any) {
              this.showErrorAlert('Delete Failed', error.message || 'There was an error deleting the form.');
            } finally {
                await loading.dismiss().catch(e => console.warn("Loader dismiss error", e));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({ message, duration, color, position: 'top' });
    toast.present();
  }

  async showErrorAlert(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
    if (this.loadFormSubscription) {
        this.loadFormSubscription.unsubscribe();
    }
  }
}



