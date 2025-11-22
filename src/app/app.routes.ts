import { Routes } from '@angular/router';
import { HomeComponent } from '../home/home.component';
import { BudgetComponent } from '../budget/budget.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'budget', component: BudgetComponent }
];
