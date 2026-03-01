import {Directive, signal} from '@angular/core';

@Directive({
  selector: '[hostBindingMatrix]',
  host: {
    style: 'border: 1px 2px 3px var(--help)',
    'style': 'border: 1px 2px 3px var(--help)',
    class: 'static-a static-b',
    '[class]': 'classList()',
    '[class.active]': 'isActive()',
    '[class.foo-bar]': 'isFooBar()',
    '[attr.data-test]': '"test"',
    '[attr.aria-label]': '"host aria"',
    '[tabIndex]': 'disabled ? -1 : 0',
    '[id]': 'hostId()',
    '[style.padding]': '"5px"',
    '[style.padding.px]': '"5"',
    '[style.--help]': '"#fff"',
    '[style]': '"width: 200px; height: 50px;"',
    '(click)': 'onClick()',
    '(keyup.enter)': 'onKeyup($event)',
    '(window:keydown)': 'onWindowKeydown($event)',
  },
  standalone: false,
})
export class HostBindingsComponent {
  readonly disabled = signal(false);

  classList() {
    return 'dynamic-a dynamic-b';
  }

  isActive() {
    return true;
  }

  isFooBar() {
    return false;
  }

  hostId() {
    return 'host-id';
  }

  onClick() {}

  onKeyup(_event: KeyboardEvent) {}

  onWindowKeydown(_event: KeyboardEvent) {}
}
