import { Injectable } from '@angular/core';
import { adapt } from '@state-adapt/angular';
import { createAdapter, joinAdapters } from '@state-adapt/core';
import { combineLatest } from 'rxjs';
import { tap } from 'rxjs/operators';

import { INITIAL_STATE, Todo, TodoFilter, TodoState } from './todo-state';

@Injectable()
export class TodoService {
  todosAdapter = createAdapter<Todo[]>()({
    create: (todos, text: Todo['text']) => [
      ...todos,
      {
        id: Math.round(Math.random() * 100000),
        text,
        done: false,
      },
    ],
    remove: (todos, { id }: Todo) => todos.filter((todo) => todo.id !== id),
    update: (todos, { id, text, done }: Todo) =>
      todos.map((todo) => (todo.id !== id ? todo : { id, text, done })),
    toggleAll: (todos, done: Todo['done']) =>
      todos.map((todo) => ({ ...todo, done })),
    clearCompleted: (todos) => todos.filter(({ done }) => !done),
    selectors: {
      completed: (todos) => todos.filter(({ done }) => done),
      active: (todos) => todos.filter(({ done }) => !done),
    },
  });

  adapter = joinAdapters<TodoState>()({
    filter: createAdapter<TodoFilter>()({ selectors: {} }),
    todos: this.todosAdapter,
  })({
    /**
     * Derived state
     */
    filteredTodos: (s) =>
      s.todos.filter(({ done }) => {
        if (s.filter === 'all') return true;
        if (s.filter === 'active') return !done;
        if (s.filter === 'completed') return done;
      }),
  })();

  storedState = window.localStorage.getItem('__state');
  initialState = this.storedState
    ? (JSON.parse(this.storedState) as TodoState)
    : INITIAL_STATE;

  store = adapt(['todos', this.initialState], this.adapter);

  /**
   * Exposed view model
   */
  readonly vm$ = combineLatest({
    state: this.store.state$.pipe(
      tap((state) => {
        window.localStorage.setItem('__state', JSON.stringify(state));
      })
    ),
    filter: this.store.filter$,
    allTodos: this.store.todos$,
    activeTodos: this.store.todosActive$,
    completedTodos: this.store.todosCompleted$,
    filteredTodos: this.store.filteredTodos$,
  });

  setFilter = this.store.setFilter;
  create = this.store.createTodos;
  remove = this.store.removeTodos;
  update = this.store.updateTodos;
  toggleAll = this.store.toggleTodosAll;
  clearCompleted = this.store.clearTodosCompleted;
}
