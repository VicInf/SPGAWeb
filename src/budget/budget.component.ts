import { CommonModule } from '@angular/common';
import { Component, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { ContactanosComponent } from '../app/contactanos.component';
import emailjs from '@emailjs/browser';

interface BudgetOption {
  label: string;
  value: string;
}

interface BudgetQuestionBase {
  id: string;
  order: string;
  prompt: string;
  helper?: string;
}

interface BudgetQuestion extends BudgetQuestionBase {
  type: 'options' | 'inputs';
  options?: BudgetOption[];
  multiple?: boolean;
  inputs?: Array<{
    id: string;
    label: string;
    placeholder: string;
    type?: string;
    required?: boolean;
  }>;
}

@Component({
  selector: 'budget-page',
  standalone: true,
  imports: [CommonModule, ContactanosComponent],
  templateUrl: './budget.component.html',
  styleUrls: ['./budget.component.css'],
})
export class BudgetComponent {
  constructor(private router: Router) {}

  readonly mobileMenuOpen = signal(false);
  readonly showSuccess = signal(false);

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
    if (this.mobileMenuOpen()) {
      this.lockBodyScroll();
    } else {
      this.unlockBodyScroll();
    }
  }

  private lockBodyScroll() {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockBodyScroll() {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  readonly questions: BudgetQuestion[] = [
    {
      id: 'projectType',
      order: '01',
      prompt: '¿Qué deseas diseñar o construir?',
      options: [
        { label: 'Vivienda nueva', value: 'vivienda_nueva' },
        { label: 'Remodelación', value: 'remodelacion' },
        { label: 'Local Comercial', value: 'local_comercial' },
        { label: 'Oficina', value: 'oficina' },
      ],
      type: 'options',
    },
    {
      id: 'projectStage',
      order: '02',
      prompt: '¿Qué servicios necesitas?',
      options: [
        { label: 'Consultoría y asesoramiento', value: 'consultoria' },
        { label: 'Diseño arquitectónico', value: 'diseno_arquitectonico' },
        { label: 'Diseño de interiores', value: 'diseno_interiores' },
        { label: 'Planificación de proyectos', value: 'planificacion' },
        { label: 'Modelado y visualización 3D', value: 'modelado_3d' },
        { label: 'Supervisión de obras', value: 'supervision' },
        { label: 'Capacitación y talleres', value: 'capacitacion' },
        { label: 'Quiero orientación', value: 'orientacion' },
      ],
      multiple: true,
      type: 'options',
    },
    {
      id: 'surface',
      order: '03',
      prompt: '¿Cuál es el área aproximada del proyecto?',
      options: [
        { label: 'Menos de 50 m²', value: 'lt50' },
        { label: 'Entre 50 y 100 m²', value: '50_100' },
        { label: 'Más de 100 m²', value: 'gt100' },
        { label: 'No lo sé con certeza', value: 'no_se' },
      ],
      type: 'options',
    },
    {
      id: 'budgetRange',
      order: '04',
      prompt: '¿Tienes un presupuesto estimado?',
      options: [
        { label: 'No, quiero que me orienten', value: 'orientacion' },
      ],
      type: 'options',
    },
    {
      id: 'timeline',
      order: '05',
      prompt: '¿Tienes una fecha límite o plazo ideal?',
      options: [
        { label: 'Urgente (1 mes)', value: 'urgente' },
        { label: 'En 2 a 3 meses', value: '2_3_meses' },
        { label: 'Más adelante', value: 'mas_adelante' },
        { label: 'No tengo apuro', value: 'sin_apuro' },
      ],
      type: 'options',
    },
    {
      id: 'contactInfo',
      order: '06',
      prompt: 'Tus datos de contacto',
      inputs: [
        {
          id: 'fullName',
          label: 'Nombre completo',
          placeholder: '',
          required: true,
        },
        {
          id: 'email',
          label: 'Email',
          placeholder: '',
          type: 'email',
          required: true,
        },
        {
          id: 'phone',
          label: 'Teléfono',
          placeholder: '',
          type: 'tel',
          required: true,
        },
      ],
      type: 'inputs',
    },
    {
      id: 'discoveryMethod',
      order: '07',
      prompt: '¿Cómo nos conociste?',
      options: [
        { label: 'Recomendación', value: 'recommendation' },
        { label: 'Instagram', value: 'instagram' },
        { label: 'Google', value: 'google' },
      ],
      type: 'options',
    },
    {
      id: 'contactPreference',
      order: '08',
      prompt: '¿Cómo prefieres que te contactemos?',
      options: [
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Correo electrónico', value: 'email' },
        { label: 'Llamada telefónica', value: 'telefono' },
      ],
      type: 'options',
    },
  ];

  private readonly defaultSelections = this.questions.reduce((acc, q) => {
    if (q.type === 'options') {
      acc[q.id] = [];
    }
    return acc;
  }, {} as Record<string, string[]>);

  private readonly defaultInputs = this.questions.reduce((acc, q) => {
    if (q.type === 'inputs') {
      const inputsArr = q.inputs ?? [];
      acc[q.id] = inputsArr.reduce((inputAcc, input) => {
        inputAcc[input.id] = '';
        return inputAcc;
      }, {} as Record<string, string>);
    }
    return acc;
  }, {} as Record<string, Record<string, string>>);

  readonly selections: WritableSignal<Record<string, string[]>> = signal(
    structuredClone(this.defaultSelections)
  );
  readonly inputs: WritableSignal<Record<string, Record<string, string>>> =
    signal(structuredClone(this.defaultInputs));

  selectOption(question: BudgetQuestion, option: BudgetOption) {
    this.selections.update((current) => {
      const selection = [...(current[question.id] ?? [])];
      const index = selection.indexOf(option.value);

      if (question.multiple) {
        if (index >= 0) {
          selection.splice(index, 1);
        } else {
          selection.push(option.value);
        }
      } else {
        selection.splice(0, selection.length, option.value);
      }

      return { ...current, [question.id]: selection };
    });
  }

  isSelected(questionId: string, optionValue: string): boolean {
    return this.selections()[questionId]?.includes(optionValue) ?? false;
  }

  updateInput(questionId: string, inputId: string, value: string) {
    this.inputs.update((current) => {
      const questionInputs = { ...(current[questionId] ?? {}) };
      questionInputs[inputId] = value;
      return { ...current, [questionId]: questionInputs };
    });
  }

  resetForm() {
    this.selections.set(structuredClone(this.defaultSelections));
    this.inputs.set(structuredClone(this.defaultInputs));
  }

  handleSubmit(event: Event) {
    event.preventDefault();
    
    // Validate form
    const validationError = this.validateForm();
    if (validationError) {
      this.showToast(validationError, 'error');
      return;
    }
    
    // Collect all form data
    const formData = this.collectFormData();
    
    // Format the email message
    const emailMessage = this.formatEmailMessage(formData);
    
    // EmailJS configuration
    const serviceID = 'service_tqqedyl';
    const publicKey = 'hQlNCuG7N4s5xQUHt';
    
    // Prepare email data for direct API call
    const emailData = {
      service_id: serviceID,
      template_id: 'template_zyrgwp8',
      user_id: publicKey,
      template_params: {
        to_email: 'vicentedev00@gmail.com',
        to_name: 'SPGA Group',
        from_name: formData.contactInfo['fullName'] || 'Cliente Potencial',
        from_email: formData.contactInfo['email'] || 'no-reply@spga.com',
        reply_to: 'no-reply@spga.com',
        subject: `Nueva Solicitud de Presupuesto - ${formData.contactInfo['fullName'] || 'Cliente'}`,
        message: emailMessage,
      }
    };
    
    // Show loading state
    this.showToast('Enviando solicitud...', 'info');
    
    // Send email using direct HTTP POST to EmailJS API
    fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })
      .then((response) => {
        if (response.ok) {
          console.log('Email sent successfully!');
          this.removeToast();
          this.showSuccess.set(true);
          this.resetForm();
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return Promise.resolve();
        } else {
          return response.text().then(text => {
            throw new Error(`Error ${response.status}: ${text}`);
          });
        }
      })
      .catch((error) => {
        console.error('Failed to send email:', error);
        this.showToast('Hubo un error al enviar tu solicitud. Por favor, contáctanos directamente a vicentedev00@gmail.com', 'error');
      });
  }
  
  private validateForm(): string | null {
    const selections = this.selections();
    const inputs = this.inputs();
    
    // Check Question 1: Project Type (must select option or fill "Otro")
    if (!selections['projectType']?.length && !inputs['additionalInfo']?.['projectTypeOther']) {
      return 'Por favor, selecciona qué deseas diseñar o construir';
    }
    
    // Check Question 2: Services (must select at least one)
    if (!selections['projectStage']?.length) {
      return 'Por favor, selecciona al menos un servicio';
    }
    
    // Check Question 3: Surface Area
    if (!selections['surface']?.length) {
      return 'Por favor, selecciona el área aproximada del proyecto';
    }
    
    // Check Question 4: Budget (must have budget input or select "No, quiero que me orienten")
    if (!inputs['additionalInfo']?.['budget'] && !selections['budgetRange']?.length) {
      return 'Por favor, indica tu presupuesto o selecciona "No, quiero que me orienten"';
    }
    
    // Check Question 5: Timeline
    if (!selections['timeline']?.length) {
      return 'Por favor, selecciona una fecha límite o plazo ideal';
    }
    
    // Check Question 6: Comments
    if (!inputs['additionalInfo']?.['comments']) {
      return 'Por favor, cuéntanos brevemente tu idea o necesidad';
    }
    
    // Check Question 7: Contact Info
    if (!inputs['contactInfo']?.['fullName']) {
      return 'Por favor, ingresa tu nombre completo';
    }
    if (!inputs['contactInfo']?.['email']) {
      return 'Por favor, ingresa tu email';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inputs['contactInfo']['email'])) {
      return 'Por favor, ingresa un email válido';
    }
    if (!inputs['contactInfo']?.['phone']) {
      return 'Por favor, ingresa tu teléfono';
    }
    
    // Check Question 8: Discovery Method (must select option or fill "Otro")
    if (!selections['discoveryMethod']?.length && !inputs['additionalInfo']?.['discoveryOther']) {
      return 'Por favor, indícanos cómo nos conociste';
    }
    
    // Check Question 9: Contact Preference
    if (!selections['contactPreference']?.length) {
      return 'Por favor, selecciona cómo prefieres que te contactemos';
    }
    
    return null;
  }
  
  clearSelection(questionId: string) {
    this.selections.update((current) => {
      const updated = { ...current };
      updated[questionId] = [];
      return updated;
    });
  }
  
  private showToast(message: string, type: 'success' | 'error' | 'info') {
    if (typeof document === 'undefined') return;
    
    // Remove existing toasts
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.textContent = message;
    
    // Set color based on type
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6'
    };
    
    toast.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      font-size: 14px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  private removeToast() {
    if (typeof document === 'undefined') return;
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) {
      existingToast.remove();
    }
  }
  
  private collectFormData() {
    const selections = this.selections();
    const inputs = this.inputs();
    
    return {
      projectType: this.getSelectedLabels('projectType'),
      services: this.getSelectedLabels('projectStage'), // Fixed: using correct question ID
      surface: this.getSelectedLabels('surface'),
      timeline: this.getSelectedLabels('timeline'),
      contactPreference: this.getSelectedLabels('contactPreference'),
      discoveryMethod: this.getSelectedLabels('discoveryMethod'),
      contactInfo: inputs['contactInfo'] || {},
      additionalInfo: inputs['additionalInfo'] || {},
    };
  }
  
  private getSelectedLabels(questionId: string): string {
    const question = this.questions.find(q => q.id === questionId);
    if (!question || question.type !== 'options') return '';
    
    const selectedValues = this.selections()[questionId] || [];
    const selectedOptions = question.options?.filter(opt => 
      selectedValues.includes(opt.value)
    ) || [];
    
    return selectedOptions.map(opt => opt.label).join(', ');
  }
  
  private formatEmailMessage(data: any): string {
    const projectTypeOther = data.additionalInfo?.projectTypeOther ? `\n      Otro: ${data.additionalInfo.projectTypeOther}` : '';
    const discoveryOther = data.additionalInfo?.discoveryOther ? `\n      Otro: ${data.additionalInfo.discoveryOther}` : '';
    
    return `
═══════════════════════════════════════════════════════
    NUEVA SOLICITUD DE PRESUPUESTO
═══════════════════════════════════════════════════════


1. ¿Qué deseas diseñar o construir?
   
   → ${data.projectType || 'No especificado'}${projectTypeOther}


2. ¿Qué servicios necesitas?
   
   → ${data.services || 'No especificado'}


3. ¿Cuál es el área aproximada del proyecto?
   
   → ${data.surface || 'No especificado'}


4. ¿Tienes un presupuesto estimado?
   
   → ${data.additionalInfo?.budget || 'No especificado'}


5. ¿Tienes una fecha límite o plazo ideal?
   
   → ${data.timeline || 'No especificado'}


6. Cuéntanos brevemente tu idea o necesidad:
   
   → ${data.additionalInfo?.comments || 'No especificado'}


═══════════════════════════════════════════════════════
    DATOS DE CONTACTO
═══════════════════════════════════════════════════════

   Nombre completo: ${data.contactInfo?.fullName || 'No especificado'}
   Email: ${data.contactInfo?.email || 'No especificado'}
   Teléfono: ${data.contactInfo?.phone || 'No especificado'}


7. ¿Cómo nos conociste?
   
   → ${data.discoveryMethod || 'No especificado'}${discoveryOther}


8. ¿Cómo prefieres que te contactemos?
   
   → ${data.contactPreference || 'No especificado'}


═══════════════════════════════════════════════════════
Enviado desde: SPGA Web - Formulario de Presupuesto
═══════════════════════════════════════════════════════
    `.trim();
  }

  handleNav(section: string | null, event?: Event) {
    event?.preventDefault();
    if (section) {
      this.router.navigate(['/'], { fragment: section });
    } else {
      this.router.navigate(['/']);
    }
  }

  scrollToContact() {
    if (typeof document === 'undefined') return;
    const section = document.getElementById('budget-contact');
    section?.scrollIntoView({ behavior: 'smooth' });
  }

  handleOption(question: BudgetQuestion, option: BudgetOption) {
    if (question.type !== 'options') {
      return;
    }
    this.selectOption(question, option);
  }

  optionIsSelected(question: BudgetQuestion, option: BudgetOption): boolean {
    if (question.type !== 'options') {
      return false;
    }
    return this.isSelected(question.id, option.value);
  }

  questionInputs(question: BudgetQuestion) {
    return question.type === 'inputs' ? question.inputs : [];
  }

  onInputChange(questionId: string, inputId: string, event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    this.updateInput(questionId, inputId, target.value);
  }

  closeSuccess() {
    this.showSuccess.set(false);
    this.router.navigate(['/']);
  }

}
