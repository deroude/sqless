import { NgModule } from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTreeModule} from '@angular/material/tree';

import { FlexLayoutModule } from '@angular/flex-layout';

import { ScrollingModule } from '@angular/cdk/scrolling';

const material = [
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatTableModule,
    MatToolbarModule,
    MatCardModule,
    MatTabsModule,
    MatBadgeModule,
    MatPaginatorModule,
    MatIconModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatMomentDateModule,
    MatListModule,
    MatDialogModule,
    MatChipsModule,
    ScrollingModule,
    MatSnackBarModule,
    MatStepperModule,
    MatTooltipModule,
    MatTreeModule,
    FlexLayoutModule
];

@NgModule({
    exports: material,
    imports: material
})
export class AppMaterialModule { }
