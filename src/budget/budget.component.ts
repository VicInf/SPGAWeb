import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Output,
  signal,
  WritableSignal,
} from '@angular/core';
import { ContactanosComponent } from '../app/contactanos.component';

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
  @Output() navigateHome = new EventEmitter<string | null>();

  readonly questions: BudgetQuestion[] = [
    {
      id: 'projectType',
      order: '01',
      prompt: '¿Qué tipo de proyecto deseas desarrollar?',
      options: [
        { label: 'Residencial', value: 'residencial' },
        { label: 'Comercial', value: 'comercial' },
        { label: 'Hospitality', value: 'hospitality' },
        { label: 'Otro', value: 'otro' },
      ],
      type: 'options',
    },
    {
      id: 'projectStage',
      order: '02',
      prompt: '¿En qué etapa se encuentra tu proyecto?',
      options: [
        { label: 'Idea inicial', value: 'idea' },
        { label: 'Anteproyecto', value: 'anteproyecto' },
        { label: 'Proyecto ejecutivo', value: 'ejecutivo' },
        { label: 'Construcción', value: 'construccion' },
      ],
      type: 'options',
    },
    {
      id: 'services',
      order: '03',
      prompt: '¿Qué servicios necesitas?',
      helper: 'Selecciona todas las opciones que apliquen.',
      options: [
        { label: 'Diseño arquitectónico', value: 'arquitectura' },
        { label: 'Interiorismo', value: 'interiorismo' },
        { label: 'Renderización 3D', value: 'renders' },
        { label: 'Gestión de obra', value: 'gestion' },
      ],
      multiple: true,
      type: 'options',
    },
    {
      id: 'surface',
      order: '04',
      prompt: '¿Cuál es el rango de superficie aproximado?',
      options: [
        { label: 'Hasta 100 m²', value: 'lt100' },
        { label: '100 - 250 m²', value: '100_250' },
        { label: '250 - 500 m²', value: '250_500' },
        { label: 'Más de 500 m²', value: 'gt500' },
      ],
      type: 'options',
    },
    {
      id: 'budgetRange',
      order: '05',
      prompt: '¿Cuál es tu presupuesto estimado?',
      options: [
        { label: 'Menos de $25K', value: 'lt25' },
        { label: '$25K - $75K', value: '25_75' },
        { label: '$75K - $150K', value: '75_150' },
        { label: 'Más de $150K', value: 'gt150' },
      ],
      type: 'options',
    },
    {
      id: 'timeline',
      order: '06',
      prompt: '¿Cuál es tu horizonte de ejecución?',
      options: [
        { label: 'Menos de 3 meses', value: 'lt3' },
        { label: '3 a 6 meses', value: '3_6' },
        { label: '6 a 12 meses', value: '6_12' },
        { label: 'Más de 12 meses', value: 'gt12' },
      ],
      type: 'options',
    },
    {
      id: 'contactInfo',
      order: '07',
      prompt: 'Déjanos tus datos de contacto',
      helper: 'Necesitamos poder comunicarnos contigo.',
      inputs: [
        {
          id: 'fullName',
          label: 'Nombre y apellido',
          placeholder: 'Tu nombre completo',
        },
        {
          id: 'email',
          label: 'Correo electrónico',
          placeholder: 'nombre@empresa.com',
          type: 'email',
        },
        {
          id: 'phone',
          label: 'Teléfono',
          placeholder: 'Código de país + número',
          type: 'tel',
        },
      ],
      type: 'inputs',
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
    // Placeholder for future integration (API, email, etc.)
    console.table({ selections: this.selections(), inputs: this.inputs() });
    this.resetForm();
  }

  handleNav(section: string | null, event?: Event) {
    event?.preventDefault();
    this.navigateHome.emit(section);
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
}
