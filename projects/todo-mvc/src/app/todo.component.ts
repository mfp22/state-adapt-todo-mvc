import { NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { LetModule } from '@rx-angular/template/let';
import { adapt } from '@state-adapt/angular';
import { createAdapter, getId } from '@state-adapt/core';
import { Source, toSource } from '@state-adapt/rxjs';
import { asyncScheduler, BehaviorSubject, merge, using } from 'rxjs';
import { filter, map, observeOn, tap, withLatestFrom } from 'rxjs/operators';

import { Todo } from './todo-state';

@Component({
  standalone: true,
  selector: 'app-todo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, LetModule],
  template: `
    <article
      class="todo"
      *rxLet="vm$ as vm"
      [class]="{ completed: vm.todo.done, editing: vm.isEditing }"
    >
      <div class="view" *ngIf="!vm.isEditing">
        <input
          #toggle
          class="toggle"
          type="checkbox"
          [checked]="vm.todo.done"
          (input)="doneToggled$.next()"
        />
        <label (dblclick)="store.edit()">{{ vm.todo.text }}</label>
        <button class="destroy" (click)="destroyed$.next()"></button>
      </div>
      <input
        #input
        class="edit"
        *ngIf="vm.isEditing"
        [value]="vm.todo.text"
        (blur)="textUpdate$.next()"
        (keyup.enter)="textUpdate$.next()"
      />
    </article>
  `,
})
export class TodoComponent {
  @ViewChild('input') input: ElementRef<HTMLInputElement>;
  @ViewChild('toggle') toggle: ElementRef<HTMLInputElement>;
  todoInput$ = new BehaviorSubject<Todo>({} as Todo);
  todo$ = this.todoInput$.pipe(toSource('todo$'));

  @Input() set todo(todo: Todo) {
    this.todoInput$.next(todo);
  }

  doneToggled$ = new Source<void>('doneToggled$');
  textUpdate$ = new Source<void>('textUpdate$');
  destroyed$ = new Source<void>('destroyed$');

  initialState = { isEditing: false, todo: {} as Todo };

  adapter = createAdapter<typeof this.initialState>()({
    setTodo: (state, todo: Todo) => ({ ...state, todo }),
    toggleDone: (state) => ({
      ...state,
      todo: {
        ...state.todo,
        done: this.toggle.nativeElement.checked,
      },
    }),
    edit: (state) => ({ ...state, isEditing: true }),
    updateText: (state) => ({
      isEditing: false,
      todo: {
        ...state.todo,
        text: this.input.nativeElement.value,
      },
    }),
    selectors: {
      isEditing: (state) => state.isEditing,
      todo: (state) => state.todo,
    },
  });

  store = adapt(['todo' + getId(), this.initialState, this.adapter], {
    setTodo: this.todo$,
    toggleDone: this.doneToggled$,
    updateText: this.textUpdate$,
  });

  @Output() change = merge(this.doneToggled$, this.textUpdate$).pipe(
    withLatestFrom(this.store.todo$),
    map(([, todo]) => todo)
  );
  @Output() remove = this.destroyed$.pipe(
    withLatestFrom(this.store.todo$),
    map(([, todo]) => todo)
  );

  readonly vm$ = using(
    () =>
      this.store.isEditing$
        .pipe(
          filter(Boolean),
          observeOn(asyncScheduler),
          tap(() => this.input.nativeElement.focus())
        )
        .subscribe(),
    () => this.store.state$
  );
}
