// src/app/retailer/form-builder/form-builder.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../auth/auth.service';
import { FormBuilderService, OrderForm, FormField } from './form-builder.service';

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
    { value: 'upload', label: 'File Upload' }
  ];
  allowedFileTypes = [
    { value: 'png', label: 'PNG Images' },
    { value: 'heic', label: 'HEIC Images' }
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
      allowedFileTypes: this.fb.array([]),
      cancellationPolicy: ['Orders can be cancelled within 24 hours of submission.']
    });
  }

  async loadForm(formId: string) {
    const loading = await this.loadingController.create({
      message: 'Loading form...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      this.formBuilderService.getOrderForm(formId).subscribe(form => {
        this.formBuilderForm.patchValue({
          title: form.title,
          description: form.description || '',
          allowFileUpload: form.allowFileUpload,
          cancellationPolicy: form.cancellationPolicy || 'Orders can be cancelled within 24 hours of submission.'
        });

        // Clear and rebuild the fields array
        const fieldsArray = this.formBuilderForm.get('fields') as FormArray;
        while (fieldsArray.length) {
          fieldsArray.removeAt(0);
        }

        // Add each field
        form.fields.forEach(field => {
          this.addField(field);
        });

        // Set allowed file types
        const fileTypesArray = this.formBuilderForm.get('allowedFileTypes') as FormArray;
        while (fileTypesArray.length) {
          fileTypesArray.removeAt(0);
        }

        form.allowedFileTypes.forEach(type => {
          fileTypesArray.push(this.fb.control(type));
        });

        loading.dismiss();
      });
    } catch (error) {
      await loading.dismiss();
      const toast = await this.toastController.create({
        message: 'Failed to load form: ' + error.message,
        duration: 3000,
        color: 'danger'
      });
      toast.present();
      this.router.navigate(['/retailer/forms']);
    }
  }

  get fields() {
    return this.formBuilderForm.get('fields') as FormArray;
  }

  get allowedFileTypes() {
    return this.formBuilderForm.get('allowedFileTypes') as FormArray;
  }

  addField(existingField?: FormField) {
    const fieldGroup = this.fb.group({
      id: [existingField?.id || this.generateId()],
      type: [existingField?.type || 'text', Validators.required],
      label: [existingField?.label || '', Validators.required],
      required: [existingField?.required || false],
      description: [existingField?.description || ''],
      options: this.fb.array(existingField?.options?.map(option => this.fb.control(option)) || [])
    });

    this.fields.push(fieldGroup);
  }

  removeField(index: number) {
    this.fields.removeAt(index);
  }

  getOptions(fieldIndex: number) {
    return (this.fields.at(fieldIndex).get('options') as FormArray);
  }

  addOption(fieldIndex: number, value: string = '') {
    const options = this.getOptions(fieldIndex);
    options.push(this.fb.control(value));
  }

  removeOption(fieldIndex: number, optionIndex: number) {
    const options = this.getOptions(fieldIndex);
    options.removeAt(optionIndex);
  }

  toggleFileType(event: any, type: string) {
    const isChecked = event.detail.checked;
    const fileTypesArray = this.allowedFileTypes;
    
    if (isChecked) {
      fileTypesArray.push(this.fb.control(type));
    } else {
      const index = fileTypesArray.controls.findIndex(control => control.value === type);
      if (index >= 0) {
        fileTypesArray.removeAt(index);
      }
    }
  }

  isFileTypeSelected(type: string): boolean {
    return this.allowedFileTypes.controls.some(control => control.value === type);
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  async saveForm() {
    if (this.formBuilderForm.valid) {
      this.isSubmitting = true;
      const loading = await this.loadingController.create({
        message: this.isEditing ? 'Updating form...' : 'Creating form...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const formValue = this.formBuilderForm.value;
        
        // Only include fields that have at least a label
        const fields = formValue.fields.filter((field: any) => field.label.trim() !== '');
        
        // For radio fields, ensure they have at least one option
        fields.forEach((field: any) => {
          if (field.type === 'radio' && (!field.options || field.options.length === 0)) {
            field.options = ['Option 1'];
          }
        });

        const user = await this.authService.currentUser$.pipe(first()).toPromise();
        
        const orderForm: Partial<OrderForm> = {
          retailerId: user.uid,
          title: formValue.title,
          description: formValue.description,
          fields,
          allowFileUpload: formValue.allowFileUpload,
          allowedFileTypes: formValue.allowedFileTypes,
          cancellationPolicy: formValue.cancellationPolicy
        };

        if (this.isEditing && this.formId) {
          await this.formBuilderService.updateOrderForm(this.formId, orderForm);
        } else {
          await this.formBuilderService.createOrderForm(orderForm);
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
      } catch (error) {
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
  }

  async confirmDelete() {
    if (!this.isEditing || !this.formId) return;

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this form? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting form...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.formBuilderService.deleteOrderForm(this.formId);
              
              await loading.dismiss();
              
              const toast = await this.toastController.create({
                message: 'Form deleted successfully',
                duration: 2000,
                color: 'success'
              });
              toast.present();
              
              this.router.navigate(['/retailer/forms']);
            } catch (error) {
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
