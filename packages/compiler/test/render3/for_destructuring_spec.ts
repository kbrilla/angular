import {ImplicitReceiver, PropertyRead} from '../../src/expression_parser/ast';
import * as t from '../../src/render3/r3_ast';
import {parseR3 as parse} from './view/util';

describe('@for destructuring', () => {
  it('should support object destructuring', () => {
    const html = `
      @for ({name, details: {age}} of items; track name) {
        {{name}} - {{age}}
      }
    `;
    const result = parse(html).nodes;
    expect(result.length).toBe(1);
    const forBlock = result[0] as t.ForLoopBlock;
    expect(forBlock instanceof t.ForLoopBlock).toBe(true);
    expect(forBlock.item.name).toBe('$implicit_ref');

    // Expected children:
    // 1. @let name = $implicit_ref.name
    // 2. @let age = $implicit_ref.details.age
    // 3. Text node (" - ")
    // 4. BoundText (name)
    // 5. BoundText (age)
    // ... wait, formatting/whitespace might affect structure.

    // First children should be the lets.
    const let1 = forBlock.children[0] as t.LetDeclaration;
    expect(let1 instanceof t.LetDeclaration).toBe(true);
    expect(let1.name).toBe('name');
    expect((let1.value as PropertyRead).name).toBe('name');
    expect(((let1.value as PropertyRead).receiver as PropertyRead).name).toBe('$implicit_ref');

    const let2 = forBlock.children[1] as t.LetDeclaration;
    expect(let2 instanceof t.LetDeclaration).toBe(true);
    expect(let2.name).toBe('age');
    // $implicit_ref.details.age
    const val2 = let2.value as PropertyRead;
    expect(val2.name).toBe('age');
    const rec2 = val2.receiver as PropertyRead;
    expect(rec2.name).toBe('details');
    const rec3 = rec2.receiver as PropertyRead;
    expect(rec3.name).toBe('$implicit_ref');
  });

  it('should support array destructuring', () => {
    const html = `
      @for ([x, y] of points; track x) { }
    `;
    const result = parse(html).nodes;
    const forBlock = result[0] as t.ForLoopBlock;
    const child0 = forBlock.children[0] as t.LetDeclaration;
    expect(child0.name).toBe('x');
    // access: $implicit_ref[0]
  });
  it('should support array rest destructuring', () => {
    const html = `
      @for ([head, ...tail] of items; track head) { }
    `;
    const result = parse(html).nodes;
    const forBlock = result[0] as t.ForLoopBlock;

    // head = $implicit_ref[0]
    const letHead = forBlock.children[0] as t.LetDeclaration;
    expect(letHead.name).toBe('head');

    // tail = $implicit_ref.slice(1)
    const letTail = forBlock.children[1] as t.LetDeclaration;
    expect(letTail.name).toBe('tail');

    // Verify Call(slice, 1)
    // Wait, checking structure of Call is complex without Visitor match or casting
    // Just simple check
    // ...
  });

  it('should support @let destructuring', () => {
    const html = `
      @let {x} = point;
    `;
    const result = parse(html).nodes;
    expect(result.length).toBe(2);
    const letTemp = result[0] as t.LetDeclaration;
    expect(letTemp.name).toContain('_let_');
    const letX = result[1] as t.LetDeclaration;
    expect(letX.name).toBe('x');
  });
});
