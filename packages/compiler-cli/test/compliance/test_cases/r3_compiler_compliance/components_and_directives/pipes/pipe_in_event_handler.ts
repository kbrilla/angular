import {Component, Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'myPipe'})
export class MyPipe implements PipeTransform {
  transform(value: any, ...args: any[]) {
    return value;
  }
}

@Component({
  selector: 'my-app',
  template: '<button (click)="handleClick(value | myPipe)">Click</button>',
  imports: [MyPipe],
})
export class MyApp {
  value = 'test';
  handleClick(v: any) {}
}
