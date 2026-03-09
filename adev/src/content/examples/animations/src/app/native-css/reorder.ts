// #docplaster
import {Component, signal} from '@angular/core';

@Component({
  selector: 'app-reorder',
  templateUrl: './reorder.html',
  styleUrls: ['reorder.css'],
})
export class Reorder {
  show = signal(true);
  items = ['stuff', 'things', 'cheese', 'paper', 'scissors', 'rock'];

  randomize() {
    let randItems = this.items;
    const newItems = [];
    for (let i of this.items) {
      const max: number = this.items.length - newItems.length;
      const randNum = Math.floor(Math.random() * max);
      newItems.push(randItems[randNum]);
      randItems = (randItems as any).toSpliced(randNum, 1);
    }

    this.items = newItems;
  }
}
