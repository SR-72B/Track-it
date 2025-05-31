// src/app/retailer/form-builder/form-builder.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { AuthService, User } from '../../auth/auth.service';
import { FormBuilderService, OrderForm, FormField } from './form-builder.service';
import { first, filter } from 'rxjs/operators';

@Component({
  selector: 'app-form-builder',
  templateUrl: './form-builder.component.html',
  styleUrls: ['./form-builder.component.scss']
})
export class FormBuilderComponent implements OnInit {
  formBuilderForm: FormGroup;
  isSubmitting = false;
  isEditing = false;
  formId: string | null = null;
  fieldTypes = [
    { value: 'text', label: 'Text Field' },
    { value: 'email', label: 'Email Field' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'radio', label: 'Multiple Choice' },
    { value: 'upload', label: 'File Upload' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'checkbox', label: 'Checkbox Group' },
    { value: 'date', label: 'Date Picker' },
    { value: 'number', label: 'Number Input' }
  ];

  availableFileTypesForSelection = [
    { value: 'image/png', label: 'PNG Images (.png)' },
    { value: 'image/jpeg', label: 'JPEG Images (.jpg, .jpeg)' },
    { value: 'application/pdf', label: 'PDF Documents (.pdf)' },
    { value: 'image/heic', label: 'HEIC Images (.heic)' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private formBuilderService: FormBuilderService,
    private route: ActivatedRoute,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.initForm();
    
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.formId = params['id'];
        this.isEditing = true;
        this.loadForm(this.formId);
      }
    });
  }

  initForm() {
    this.formBuilderForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      fields: this.fb.array([]),
      allowFileUpload: [false],
      allowedFileTypes: this.fb.array([]), // Will store selected file type strings (MIME types)
      maxFilesAllowed: [1, [Validators.min(1)]],
      cancellationPolicy: ['Orders can be cancelled within 24 hours of submission.'],
      submissionInstructions: ['Please review your order carefully before submitting.']
    });
  }

  async loadForm(formId: string) {
    const loading = await this.loadingController.create({ message: 'Loading form...', spinner: 'crescent' });
    await loading.present();

    try {
      this.formBuilderService.getOrderForm(formId).pipe(first(form => form !== undefined)).subscribe(form => { // Ensure form is not undefined
        if (form) { 
            this.formBuilderForm.patchValue({
                title: form.title,
                description: form.description || '',
                allowFileUpload: form.allowFileUpload || false, 
                cancellationPolicy: form.cancellationPolicy || 'Orders can be cancelled within 24 hours of submission.',
                submissionInstructions: form.submissionInstructions || 'Please review your order carefully before submitting.',
                maxFilesAllowed: form.maxFilesAllowed || 1,
                active: form.active !== undefined ? form.active : true // Assuming you might add an 'active' field to the form
            });

            const fieldsArray = this.formBuilderForm.get('fields') as FormArray;
            while (fieldsArray.length) { fieldsArray.removeAt(0); }
            form.fields?.forEach(field => { this.addField(field); });

            const fileTypesArray = this.formBuilderForm.get('allowedFileTypes') as FormArray;
            while (fileTypesArray.length) { fileTypesArray.removeAt(0); }
            form.allowedFileTypes?.forEach(type => { fileTypesArray.push(this.fb.control(type)); });
        } else {
            this.toastController.create({ message: 'Form not found.', duration: 3000, color: 'danger' }).then(t => t.present());
            this.router.navigate(['/retailer/forms']);
        }
        loading.dismiss();
      }, async error => { 
        await loading.dismiss();
        this.toastController.create({ message: 'Failed to load form data: ' + (error.message || 'Unknown error'), duration: 3000, color: 'danger' }).then(t => t.present());
        this.router.navigate(['/retailer/forms']);
      });
    } catch (error: any) { 
      await loading.dismiss();
      const toast = await this.toastController.create({
        message: 'Failed to initiate form loading: ' + (error.message || 'Unknown error'),
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      this.router.navigate(['/retailer/forms']);
    }
  }

  get fields(): FormArray {
    return this.formBuilderForm.get('fields') as FormArray;
  }

  get formAllowedFileTypes(): FormArray {
    return this.formBuilderForm.get('allowedFileTypes') as FormArray;
  }

  addField(existingField?: FormField) {
    const fieldGroup = this.fb.group({
      id: [existingField?.id || this.generateId()],
      type: [existingField?.type || 'text', Validators.required],
      label: [existingField?.label || '', Validators.required],
      required: [existingField?.required || false],
      description: [existingField?.description || ''],
      placeholder: [existingField?.placeholder || ''],
      defaultValue: [existingField?.defaultValue || ''],
      options: this.fb.array(existingField?.options?.map(option => this.fb.control(option)) || []),
      validationPatterns: this.fb.array(existingField?.validationPatterns?.map(vp => this.fb.group(vp)) || []),
      maxFileSizeMB: [existingField?.maxFileSizeMB || 5]
    });
    this.fields.push(fieldGroup);
  }

  removeField(index: number) {
    this.fields.removeAt(index);
  }

  getOptions(fieldIndex: number): FormArray { 
    return (this.fields.at(fieldIndex).get('options') as FormArray);
  }

  addOption(fieldIndex: number, value: string = '') {
    this.getOptions(fieldIndex).push(this.fb.control(value));
  }

  removeOption(fieldIndex: number, optionIndex: number) {
    this.getOptions(fieldIndex).removeAt(optionIndex);
  }

  toggleFileType(event: any, typeValue: string) { 
    const isChecked = event.detail.checked;
    const fileTypesFormArray = this.formAllowedFileTypes; 
    
    if (isChecked) {
      fileTypesFormArray.push(this.fb.control(typeValue));
    } else {
      let indexToRemove = -1;
      fileTypesFormArray.controls.forEach((control: FormControl, index: number) => {
        if (control.value === typeValue) {
          indexToRemove = index;
        }
      });
      if (indexToRemove >= 0) {
        fileTypesFormArray.removeAt(indexToRemove);
      }
    }
  }

  isFileTypeSelected(typeValue: string): boolean {
    return this.formAllowedFileTypes.controls.some((control: FormControl) => control.value === typeValue);
  }

  generateId() {
    // Using AngularFirestore's ID generation for consistency if you prefer,
    // but this requires injecting AngularFirestore into this component or calling a service method.
    // For simplicity, keeping a client-side unique enough ID for fields within the form.
    return Math.random().toString(36).substring(2, 15);
  }

  async saveForm() {
    if (this.formBuilderForm.invalid) { 
        this.formBuilderForm.markAllAsTouched(); // Mark all fields as touched to show validation errors
        const toast = await this.toastController.create({
            message: 'Please ensure all required fields are filled correctly.',
            duration: 3000,
            color: 'warning'
        });
        toast.present();
        return; 
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: this.isEditing ? 'Updating form...' : 'Creating form...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const formValue = this.formBuilderForm.value;
      
      const fieldsToSave: FormField[] = formValue.fields
        .filter((field: any) => field.label && field.label.trim() !== '')
        .map((field: any) => {
          const newField: FormField = {
            id: field.id || this.generateId(),
            type: field.type,
            label: field.label,
            required: field.required || false,
            description: field.description || '',
            placeholder: field.placeholder || '',
            defaultValue: field.defaultValue || '',
            options: field.options || [],
            validationPatterns: field.validationPatterns || [],
            maxFileSizeMB: field.maxFileSizeMB || 5
          };
          if (field.type === 'radio' && (!newField.options || newField.options.length === 0)) {
            newField.options = ['Option 1']; 
          }
          return newField;
        });

      const user = await this.authService.currentUser$.pipe(
        filter((u): u is User => u !== null), 
        first()
      ).toPromise();
      
      if (!user) {
        throw new Error("User not authenticated.");
      }

      const formDataForService: Omit<OrderForm, 'id' | 'createdAt' | 'updatedAt'> = {
        retailerId: user.uid, 
        title: formValue.title,
        description: formValue.description,
        fields: fieldsToSave,
        allowFileUpload: formValue.allowFileUpload,
        allowedFileTypes: formValue.allowedFileTypes, 
        maxFilesAllowed: formValue.maxFilesAllowed,
        cancellationPolicy: formValue.cancellationPolicy,
        submissionInstructions: formValue.submissionInstructions,
        active: true, // Default for new/updated forms, adjust as needed
      };

      if (this.isEditing && this.formId) {
        await this.formBuilderService.updateOrderForm(this.formId, formDataForService);
      } else {
        const newForm: OrderForm = await this.formBuilderService.createOrderForm(formDataForService);
        console.log('New form created with ID:', newForm.id); // Access newForm.id
      }
      
      await loading.dismiss();
      this.isSubmitting = false;

      const toast = await this.toastController.create({
        message: this.isEditing ? 'Form updated successfully' : 'Form created successfully',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      
      this.router.navigate(['/retailer/forms']);
    } catch (error: any) {
      await loading.dismiss();
      this.isSubmitting = false;
      
      const alert = await this.alertController.create({
        header: 'Error',
        message: error.message || 'There was an error saving the form.',
        buttons: ['OK']
      });
      await alert.present();
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
          handler: async () => {
            const loading = await this.loadingController.create({ message: 'Deleting form...', spinner: 'crescent' });
            await loading.present();
            try {
              if (this.formId) { 
                await this.formBuilderService.deleteOrderForm(this.formId);
                await loading.dismiss();
                const toast = await this.toastController.create({ message: 'Form deleted successfully', duration: 2000, color: 'success' });
                toast.present();
                this.router.navigate(['/retailer/forms']);
              } else { throw new Error("Form ID is missing for deletion."); }
            } catch (error: any) {
              await loading.dismiss();
              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: error.message || 'There was an error deleting the form.',
                buttons: ['OK']
              });
              await errorAlert.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
