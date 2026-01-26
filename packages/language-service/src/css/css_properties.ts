/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

// Note: We define CSS properties inline rather than importing from csstype
// to avoid a runtime dependency. The csstype package is type-only and provides
// comprehensive CSS property types from MDN data. Our inline list covers
// the most commonly used properties for Angular style bindings.
//
// Reference: https://github.com/frenic/csstype

/**
 * All valid CSS property names in camelCase format (e.g., 'backgroundColor').
 */
export type CSSPropertyName = string;

/**
 * Get the expected value type for a CSS property.
 * Returns a string representation of the expected type.
 */
export type CSSPropertyValue = string;

/**
 * Unit suffixes that can be appended to CSS property bindings.
 * When a unit suffix is present, the binding expects a number instead of a string.
 * For example: [style.width.px]="100" expects a number.
 */
export const CSS_UNIT_SUFFIXES = [
  'px',
  'em',
  'rem',
  '%',
  'vh',
  'vw',
  'vmin',
  'vmax',
  's',
  'ms',
  'deg',
  'rad',
  'turn',
  'grad',
  'fr',
  'ch',
  'ex',
  'cm',
  'mm',
  'in',
  'pt',
  'pc',
  'dpi',
  'dpcm',
  'dppx',
] as const;

export type CSSUnitSuffix = (typeof CSS_UNIT_SUFFIXES)[number];

/**
 * Cache for CSS property data to avoid repeated operations.
 * This is populated lazily on first access.
 */
let cachedPropertyNames: string[] | null = null;
let cachedPropertyNameSet: Set<string> | null = null;
let cachedPropertyNameLookup: Map<string, string> | null = null;

/**
 * Creates an instance of CSS.Properties to extract property names.
 * This is done once and cached for performance.
 *
 * Note: Since csstype is type-only, we need to extract property names
 * using a type-safe approach. We define a comprehensive list based on
 * the most commonly used CSS properties.
 */
const CSS_PROPERTIES: readonly string[] = [
  // Layout
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',
  'clear',
  'zIndex',
  'overflow',
  'overflowX',
  'overflowY',
  'visibility',
  'clip',
  'clipPath',

  // Flexbox
  'flex',
  'flexBasis',
  'flexDirection',
  'flexFlow',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'alignContent',
  'alignItems',
  'alignSelf',
  'justifyContent',
  'justifyItems',
  'justifySelf',
  'order',
  'gap',
  'rowGap',
  'columnGap',

  // Grid
  'grid',
  'gridArea',
  'gridAutoColumns',
  'gridAutoFlow',
  'gridAutoRows',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnGap',
  'gridColumnStart',
  'gridGap',
  'gridRow',
  'gridRowEnd',
  'gridRowGap',
  'gridRowStart',
  'gridTemplate',
  'gridTemplateAreas',
  'gridTemplateColumns',
  'gridTemplateRows',

  // Box Model
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginBlock',
  'marginBlockStart',
  'marginBlockEnd',
  'marginInline',
  'marginInlineStart',
  'marginInlineEnd',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingBlock',
  'paddingBlockStart',
  'paddingBlockEnd',
  'paddingInline',
  'paddingInlineStart',
  'paddingInlineEnd',
  'boxSizing',

  // Background
  'background',
  'backgroundColor',
  'backgroundImage',
  'backgroundPosition',
  'backgroundPositionX',
  'backgroundPositionY',
  'backgroundRepeat',
  'backgroundSize',
  'backgroundAttachment',
  'backgroundClip',
  'backgroundOrigin',
  'backgroundBlendMode',

  // Border
  'border',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderImage',
  'borderImageOutset',
  'borderImageRepeat',
  'borderImageSlice',
  'borderImageSource',
  'borderImageWidth',
  'borderCollapse',
  'borderSpacing',
  'borderBlock',
  'borderBlockColor',
  'borderBlockEnd',
  'borderBlockEndColor',
  'borderBlockEndStyle',
  'borderBlockEndWidth',
  'borderBlockStart',
  'borderBlockStartColor',
  'borderBlockStartStyle',
  'borderBlockStartWidth',
  'borderBlockStyle',
  'borderBlockWidth',
  'borderInline',
  'borderInlineColor',
  'borderInlineEnd',
  'borderInlineEndColor',
  'borderInlineEndStyle',
  'borderInlineEndWidth',
  'borderInlineStart',
  'borderInlineStartColor',
  'borderInlineStartStyle',
  'borderInlineStartWidth',
  'borderInlineStyle',
  'borderInlineWidth',

  // Typography
  'color',
  'font',
  'fontFamily',
  'fontSize',
  'fontSizeAdjust',
  'fontStretch',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textAlign',
  'textAlignLast',
  'textDecoration',
  'textDecorationColor',
  'textDecorationLine',
  'textDecorationStyle',
  'textIndent',
  'textJustify',
  'textOverflow',
  'textShadow',
  'textTransform',
  'whiteSpace',
  'wordBreak',
  'wordWrap',
  'overflowWrap',
  'verticalAlign',
  'direction',
  'unicodeBidi',
  'writingMode',
  'hangingPunctuation',
  'hyphens',
  'tabSize',

  // Visual Effects
  'opacity',
  'boxShadow',
  'filter',
  'backdropFilter',
  'mixBlendMode',
  'isolation',

  // Transform
  'transform',
  'transformOrigin',
  'transformStyle',
  'perspective',
  'perspectiveOrigin',
  'backfaceVisibility',

  // Transition & Animation
  'transition',
  'transitionDelay',
  'transitionDuration',
  'transitionProperty',
  'transitionTimingFunction',
  'animation',
  'animationDelay',
  'animationDirection',
  'animationDuration',
  'animationFillMode',
  'animationIterationCount',
  'animationName',
  'animationPlayState',
  'animationTimingFunction',

  // List
  'listStyle',
  'listStyleImage',
  'listStylePosition',
  'listStyleType',

  // Table
  'tableLayout',
  'captionSide',
  'emptyCells',

  // Outline
  'outline',
  'outlineColor',
  'outlineOffset',
  'outlineStyle',
  'outlineWidth',

  // Cursor & Interaction
  'cursor',
  'pointerEvents',
  'touchAction',
  'userSelect',
  'resize',

  // Content
  'content',
  'quotes',
  'counterIncrement',
  'counterReset',
  'counterSet',

  // Column
  'columns',
  'columnCount',
  'columnFill',
  'columnGap',
  'columnRule',
  'columnRuleColor',
  'columnRuleStyle',
  'columnRuleWidth',
  'columnSpan',
  'columnWidth',

  // Page
  'pageBreakAfter',
  'pageBreakBefore',
  'pageBreakInside',
  'breakAfter',
  'breakBefore',
  'breakInside',
  'orphans',
  'widows',

  // Object
  'objectFit',
  'objectPosition',

  // Scroll
  'scrollBehavior',
  'scrollMargin',
  'scrollMarginBlock',
  'scrollMarginBlockEnd',
  'scrollMarginBlockStart',
  'scrollMarginBottom',
  'scrollMarginInline',
  'scrollMarginInlineEnd',
  'scrollMarginInlineStart',
  'scrollMarginLeft',
  'scrollMarginRight',
  'scrollMarginTop',
  'scrollPadding',
  'scrollPaddingBlock',
  'scrollPaddingBlockEnd',
  'scrollPaddingBlockStart',
  'scrollPaddingBottom',
  'scrollPaddingInline',
  'scrollPaddingInlineEnd',
  'scrollPaddingInlineStart',
  'scrollPaddingLeft',
  'scrollPaddingRight',
  'scrollPaddingTop',
  'scrollSnapAlign',
  'scrollSnapStop',
  'scrollSnapType',
  'overscrollBehavior',
  'overscrollBehaviorBlock',
  'overscrollBehaviorInline',
  'overscrollBehaviorX',
  'overscrollBehaviorY',

  // Will-change
  'willChange',

  // Contain
  'contain',
  'containIntrinsicSize',
  'contentVisibility',

  // Appearance
  'appearance',
  'accentColor',
  'colorScheme',
  'caretColor',

  // Mask
  'mask',
  'maskBorder',
  'maskBorderMode',
  'maskBorderOutset',
  'maskBorderRepeat',
  'maskBorderSlice',
  'maskBorderSource',
  'maskBorderWidth',
  'maskClip',
  'maskComposite',
  'maskImage',
  'maskMode',
  'maskOrigin',
  'maskPosition',
  'maskRepeat',
  'maskSize',
  'maskType',

  // Shape
  'shapeImageThreshold',
  'shapeMargin',
  'shapeOutside',

  // Image
  'imageOrientation',
  'imageRendering',

  // Inset
  'inset',
  'insetBlock',
  'insetBlockEnd',
  'insetBlockStart',
  'insetInline',
  'insetInlineEnd',
  'insetInlineStart',

  // Size
  'blockSize',
  'inlineSize',
  'minBlockSize',
  'maxBlockSize',
  'minInlineSize',
  'maxInlineSize',

  // Aspect Ratio
  'aspectRatio',

  // Place
  'placeContent',
  'placeItems',
  'placeSelf',

  // All
  'all',

  // SVG-related
  'fill',
  'fillOpacity',
  'fillRule',
  'stroke',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
  'dominantBaseline',
  'textAnchor',
  'alignmentBaseline',
  'baselineShift',
  'clipRule',
  'colorInterpolation',
  'colorInterpolationFilters',
  'floodColor',
  'floodOpacity',
  'lightingColor',
  'stopColor',
  'stopOpacity',
  'markerEnd',
  'markerMid',
  'markerStart',
  'paintOrder',
  'shapeRendering',
  'vectorEffect',

  // Print
  'printColorAdjust',
  'colorAdjust',
];

/**
 * Values for properties with enumerated options.
 * Used for providing value completions.
 */

/**
 * Common CSS named colors for color property completions.
 */
const CSS_NAMED_COLORS: readonly string[] = [
  // Basic colors
  'transparent',
  'currentColor',
  'inherit',
  'initial',
  'unset',
  // Standard named colors (most common)
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'brown',
  'cyan',
  'magenta',
  // Extended named colors (commonly used)
  'aqua',
  'coral',
  'crimson',
  'darkblue',
  'darkgreen',
  'darkgray',
  'darkgrey',
  'darkred',
  'deeppink',
  'dodgerblue',
  'gold',
  'hotpink',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lightblue',
  'lightgray',
  'lightgrey',
  'lightgreen',
  'lime',
  'maroon',
  'navy',
  'olive',
  'orchid',
  'plum',
  'salmon',
  'silver',
  'skyblue',
  'steelblue',
  'tan',
  'teal',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
];

export const CSS_PROPERTY_VALUES: Readonly<Record<string, readonly string[]>> = {
  display: [
    'none',
    'block',
    'inline',
    'inline-block',
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
    'flow-root',
    'contents',
    'table',
    'table-row',
    'table-cell',
    'list-item',
  ],
  position: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  visibility: ['visible', 'hidden', 'collapse'],
  overflow: ['visible', 'hidden', 'scroll', 'auto', 'clip'],
  overflowX: ['visible', 'hidden', 'scroll', 'auto', 'clip'],
  overflowY: ['visible', 'hidden', 'scroll', 'auto', 'clip'],
  float: ['none', 'left', 'right', 'inline-start', 'inline-end'],
  clear: ['none', 'left', 'right', 'both', 'inline-start', 'inline-end'],
  textAlign: ['left', 'right', 'center', 'justify', 'start', 'end'],
  textDecoration: ['none', 'underline', 'overline', 'line-through'],
  textTransform: ['none', 'capitalize', 'uppercase', 'lowercase', 'full-width'],
  whiteSpace: ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'],
  wordBreak: ['normal', 'break-all', 'keep-all', 'break-word'],
  wordWrap: ['normal', 'break-word', 'anywhere'],
  overflowWrap: ['normal', 'break-word', 'anywhere'],
  verticalAlign: ['baseline', 'sub', 'super', 'text-top', 'text-bottom', 'middle', 'top', 'bottom'],
  fontStyle: ['normal', 'italic', 'oblique'],
  fontWeight: [
    'normal',
    'bold',
    'bolder',
    'lighter',
    '100',
    '200',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    '900',
  ],
  flexDirection: ['row', 'row-reverse', 'column', 'column-reverse'],
  flexWrap: ['nowrap', 'wrap', 'wrap-reverse'],
  justifyContent: [
    'flex-start',
    'flex-end',
    'center',
    'space-between',
    'space-around',
    'space-evenly',
    'start',
    'end',
  ],
  alignItems: ['stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end'],
  alignContent: [
    'stretch',
    'flex-start',
    'flex-end',
    'center',
    'space-between',
    'space-around',
    'start',
    'end',
  ],
  alignSelf: ['auto', 'stretch', 'flex-start', 'flex-end', 'center', 'baseline', 'start', 'end'],
  boxSizing: ['content-box', 'border-box'],
  cursor: [
    'auto',
    'default',
    'none',
    'pointer',
    'progress',
    'wait',
    'text',
    'crosshair',
    'move',
    'grab',
    'grabbing',
    'not-allowed',
    'zoom-in',
    'zoom-out',
    'help',
    'context-menu',
    'cell',
    'vertical-text',
    'alias',
    'copy',
    'no-drop',
    'col-resize',
    'row-resize',
    'n-resize',
    'e-resize',
    's-resize',
    'w-resize',
    'ne-resize',
    'nw-resize',
    'se-resize',
    'sw-resize',
    'ew-resize',
    'ns-resize',
    'nesw-resize',
    'nwse-resize',
    'all-scroll',
  ],
  pointerEvents: [
    'auto',
    'none',
    'visiblePainted',
    'visibleFill',
    'visibleStroke',
    'visible',
    'painted',
    'fill',
    'stroke',
    'all',
  ],
  resize: ['none', 'both', 'horizontal', 'vertical', 'block', 'inline'],
  userSelect: ['auto', 'none', 'text', 'all', 'contain'],
  objectFit: ['fill', 'contain', 'cover', 'none', 'scale-down'],
  backgroundRepeat: ['repeat', 'repeat-x', 'repeat-y', 'no-repeat', 'space', 'round'],
  backgroundSize: ['auto', 'cover', 'contain'],
  backgroundAttachment: ['scroll', 'fixed', 'local'],
  backgroundClip: ['border-box', 'padding-box', 'content-box', 'text'],
  backgroundOrigin: ['border-box', 'padding-box', 'content-box'],
  borderStyle: [
    'none',
    'hidden',
    'dotted',
    'dashed',
    'solid',
    'double',
    'groove',
    'ridge',
    'inset',
    'outset',
  ],
  borderCollapse: ['collapse', 'separate'],
  listStyleType: [
    'none',
    'disc',
    'circle',
    'square',
    'decimal',
    'decimal-leading-zero',
    'lower-roman',
    'upper-roman',
    'lower-alpha',
    'upper-alpha',
    'lower-latin',
    'upper-latin',
  ],
  listStylePosition: ['inside', 'outside'],
  tableLayout: ['auto', 'fixed'],
  captionSide: ['top', 'bottom'],
  emptyCells: ['show', 'hide'],
  direction: ['ltr', 'rtl'],
  writingMode: ['horizontal-tb', 'vertical-rl', 'vertical-lr'],
  textOverflow: ['clip', 'ellipsis'],
  outlineStyle: [
    'none',
    'hidden',
    'dotted',
    'dashed',
    'solid',
    'double',
    'groove',
    'ridge',
    'inset',
    'outset',
  ],
  appearance: ['none', 'auto', 'button', 'textfield', 'menulist-button'],
  backfaceVisibility: ['visible', 'hidden'],
  transformStyle: ['flat', 'preserve-3d'],
  mixBlendMode: [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
  ],
  isolation: ['auto', 'isolate'],
  scrollBehavior: ['auto', 'smooth'],
  scrollSnapType: ['none', 'x', 'y', 'block', 'inline', 'both'],
  scrollSnapAlign: ['none', 'start', 'end', 'center'],
  scrollSnapStop: ['normal', 'always'],
  overscrollBehavior: ['auto', 'contain', 'none'],
  contain: ['none', 'strict', 'content', 'size', 'layout', 'style', 'paint'],
  contentVisibility: ['visible', 'auto', 'hidden'],
  aspectRatio: ['auto'],
  gridAutoFlow: ['row', 'column', 'dense', 'row dense', 'column dense'],
  placeContent: [
    'start',
    'end',
    'center',
    'stretch',
    'space-between',
    'space-around',
    'space-evenly',
  ],
  placeItems: ['start', 'end', 'center', 'stretch'],
  placeSelf: ['auto', 'start', 'end', 'center', 'stretch'],
  animationDirection: ['normal', 'reverse', 'alternate', 'alternate-reverse'],
  animationFillMode: ['none', 'forwards', 'backwards', 'both'],
  animationPlayState: ['running', 'paused'],
  touchAction: [
    'auto',
    'none',
    'pan-x',
    'pan-y',
    'pan-left',
    'pan-right',
    'pan-up',
    'pan-down',
    'pinch-zoom',
    'manipulation',
  ],
  willChange: ['auto', 'scroll-position', 'contents', 'transform', 'opacity'],
  colorScheme: ['normal', 'light', 'dark', 'light dark', 'only light', 'only dark'],
  // Color properties
  color: CSS_NAMED_COLORS,
  backgroundColor: CSS_NAMED_COLORS,
  borderColor: CSS_NAMED_COLORS,
  borderTopColor: CSS_NAMED_COLORS,
  borderRightColor: CSS_NAMED_COLORS,
  borderBottomColor: CSS_NAMED_COLORS,
  borderLeftColor: CSS_NAMED_COLORS,
  outlineColor: CSS_NAMED_COLORS,
  textDecorationColor: CSS_NAMED_COLORS,
  caretColor: CSS_NAMED_COLORS,
  accentColor: CSS_NAMED_COLORS,
};

/**
 * Information about an obsolete CSS property.
 */
export interface ObsoleteCSSProperty {
  /** The obsolete property name (camelCase). */
  name: string;
  /** The MDN documentation URL. */
  mdnUrl: string;
  /** Brief deprecation message. */
  message: string;
  /** The modern replacement property, if any. */
  replacement?: string;
  /** Whether this is an obsolete vendor-prefixed property. */
  isVendorPrefixed?: boolean;
}

/**
 * Map of obsolete CSS properties with their MDN links and replacements.
 * Based on csstype's ObsoleteProperties interface.
 *
 * @see https://github.com/frenic/csstype
 */
const OBSOLETE_CSS_PROPERTIES: ReadonlyMap<string, ObsoleteCSSProperty> = new Map([
  // Old Flexbox (display: box)
  [
    'boxAlign',
    {
      name: 'boxAlign',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-align',
      message: 'Use Flexbox `align-items` instead',
      replacement: 'alignItems',
    },
  ],
  [
    'boxDirection',
    {
      name: 'boxDirection',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-direction',
      message: 'Use Flexbox `flex-direction` instead',
      replacement: 'flexDirection',
    },
  ],
  [
    'boxFlex',
    {
      name: 'boxFlex',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-flex',
      message: 'Use Flexbox `flex` instead',
      replacement: 'flex',
    },
  ],
  [
    'boxFlexGroup',
    {
      name: 'boxFlexGroup',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-flex-group',
      message: 'Use Flexbox instead',
    },
  ],
  [
    'boxLines',
    {
      name: 'boxLines',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-lines',
      message: 'Use Flexbox `flex-wrap` instead',
      replacement: 'flexWrap',
    },
  ],
  [
    'boxOrdinalGroup',
    {
      name: 'boxOrdinalGroup',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-ordinal-group',
      message: 'Use Flexbox `order` instead',
      replacement: 'order',
    },
  ],
  [
    'boxOrient',
    {
      name: 'boxOrient',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-orient',
      message: 'Use Flexbox `flex-direction` instead',
      replacement: 'flexDirection',
    },
  ],
  [
    'boxPack',
    {
      name: 'boxPack',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/box-pack',
      message: 'Use Flexbox `justify-content` instead',
      replacement: 'justifyContent',
    },
  ],

  // Grid gap properties (replaced by gap, row-gap, column-gap)
  [
    'gridColumnGap',
    {
      name: 'gridColumnGap',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/column-gap',
      message: 'Use `column-gap` instead',
      replacement: 'columnGap',
    },
  ],
  [
    'gridRowGap',
    {
      name: 'gridRowGap',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/row-gap',
      message: 'Use `row-gap` instead',
      replacement: 'rowGap',
    },
  ],
  [
    'gridGap',
    {
      name: 'gridGap',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/gap',
      message: 'Use `gap` instead',
      replacement: 'gap',
    },
  ],

  // Page break properties (replaced by break-*)
  [
    'pageBreakAfter',
    {
      name: 'pageBreakAfter',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/page-break-after',
      message: 'Use `break-after` instead',
      replacement: 'breakAfter',
    },
  ],
  [
    'pageBreakBefore',
    {
      name: 'pageBreakBefore',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/page-break-before',
      message: 'Use `break-before` instead',
      replacement: 'breakBefore',
    },
  ],
  [
    'pageBreakInside',
    {
      name: 'pageBreakInside',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/page-break-inside',
      message: 'Use `break-inside` instead',
      replacement: 'breakInside',
    },
  ],

  // Old scroll snap properties
  [
    'scrollSnapCoordinate',
    {
      name: 'scrollSnapCoordinate',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/scroll-snap-coordinate',
      message: 'Use `scroll-snap-align` instead',
      replacement: 'scrollSnapAlign',
    },
  ],
  [
    'scrollSnapDestination',
    {
      name: 'scrollSnapDestination',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/scroll-snap-destination',
      message: 'Use CSS Scroll Snap Module Level 1 properties instead',
    },
  ],
  [
    'scrollSnapPointsX',
    {
      name: 'scrollSnapPointsX',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/scroll-snap-points-x',
      message: 'Use `scroll-snap-type` and `scroll-snap-align` instead',
      replacement: 'scrollSnapType',
    },
  ],
  [
    'scrollSnapPointsY',
    {
      name: 'scrollSnapPointsY',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/scroll-snap-points-y',
      message: 'Use `scroll-snap-type` and `scroll-snap-align` instead',
      replacement: 'scrollSnapType',
    },
  ],
  [
    'scrollSnapTypeX',
    {
      name: 'scrollSnapTypeX',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/scroll-snap-type-x',
      message: 'Use `scroll-snap-type` instead',
      replacement: 'scrollSnapType',
    },
  ],
  [
    'scrollSnapTypeY',
    {
      name: 'scrollSnapTypeY',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/scroll-snap-type-y',
      message: 'Use `scroll-snap-type` instead',
      replacement: 'scrollSnapType',
    },
  ],

  // IME mode (deprecated)
  [
    'imeMode',
    {
      name: 'imeMode',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/ime-mode',
      message: 'Deprecated. No replacement available.',
    },
  ],

  // Old inset properties (CSS Logical Properties transition)
  [
    'offsetBlock',
    {
      name: 'offsetBlock',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/inset-block',
      message: 'Use `inset-block` instead',
      replacement: 'insetBlock',
    },
  ],
  [
    'offsetBlockEnd',
    {
      name: 'offsetBlockEnd',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/inset-block-end',
      message: 'Use `inset-block-end` instead',
      replacement: 'insetBlockEnd',
    },
  ],
  [
    'offsetBlockStart',
    {
      name: 'offsetBlockStart',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/inset-block-start',
      message: 'Use `inset-block-start` instead',
      replacement: 'insetBlockStart',
    },
  ],
  [
    'offsetInline',
    {
      name: 'offsetInline',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/inset-inline',
      message: 'Use `inset-inline` instead',
      replacement: 'insetInline',
    },
  ],
  [
    'offsetInlineEnd',
    {
      name: 'offsetInlineEnd',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/inset-inline-end',
      message: 'Use `inset-inline-end` instead',
      replacement: 'insetInlineEnd',
    },
  ],
  [
    'offsetInlineStart',
    {
      name: 'offsetInlineStart',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/inset-inline-start',
      message: 'Use `inset-inline-start` instead',
      replacement: 'insetInlineStart',
    },
  ],

  // CSS Anchor Positioning transition
  [
    'insetArea',
    {
      name: 'insetArea',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/position-area',
      message: 'Renamed to `position-area`',
      replacement: 'positionArea',
    },
  ],
  [
    'positionTryOptions',
    {
      name: 'positionTryOptions',
      mdnUrl: 'https://developer.mozilla.org/docs/Web/CSS/position-try-fallbacks',
      message: 'Renamed to `position-try-fallbacks`',
      replacement: 'positionTryFallbacks',
    },
  ],
]);

/**
 * Cache for obsolete property lookup.
 */
let cachedObsoletePropertySet: Set<string> | null = null;

/**
 * Gets the set of obsolete CSS property names.
 */
export function getObsoleteCSSPropertySet(): Set<string> {
  if (cachedObsoletePropertySet === null) {
    cachedObsoletePropertySet = new Set(OBSOLETE_CSS_PROPERTIES.keys());
  }
  return cachedObsoletePropertySet;
}

/**
 * Checks if a CSS property is obsolete/deprecated.
 * @param propertyName The property name in camelCase.
 * @returns True if the property is obsolete.
 */
export function isObsoleteCSSProperty(propertyName: string): boolean {
  return OBSOLETE_CSS_PROPERTIES.has(propertyName);
}

/**
 * Gets information about an obsolete CSS property.
 * @param propertyName The property name in camelCase.
 * @returns ObsoleteCSSProperty info if obsolete, undefined otherwise.
 */
export function getObsoleteCSSPropertyInfo(propertyName: string): ObsoleteCSSProperty | undefined {
  return OBSOLETE_CSS_PROPERTIES.get(propertyName);
}

/**
 * Gets a cached list of all CSS property names.
 */
export function getCSSPropertyNames(): readonly string[] {
  if (cachedPropertyNames === null) {
    cachedPropertyNames = [...CSS_PROPERTIES].sort();
  }
  return cachedPropertyNames;
}

/**
 * Gets a cached Set of CSS property names for fast lookup.
 */
export function getCSSPropertyNameSet(): Set<string> {
  if (cachedPropertyNameSet === null) {
    cachedPropertyNameSet = new Set(CSS_PROPERTIES);
  }
  return cachedPropertyNameSet;
}

/**
 * Gets a map from lowercase property names to their correct casing.
 * Used for fuzzy matching and suggestions.
 */
export function getCSSPropertyNameLookup(): Map<string, string> {
  if (cachedPropertyNameLookup === null) {
    cachedPropertyNameLookup = new Map();
    for (const name of CSS_PROPERTIES) {
      cachedPropertyNameLookup.set(name.toLowerCase(), name);
    }
  }
  return cachedPropertyNameLookup;
}

/**
 * Checks if a property name is a valid CSS property.
 * @param propertyName The property name to check (in camelCase).
 * @returns True if the property is valid.
 */
export function isValidCSSProperty(propertyName: string): boolean {
  // CSS custom properties (variables) are always valid
  if (propertyName.startsWith('--')) {
    return true;
  }

  // Vendor-prefixed properties are always valid
  // kebab-case: -webkit-, -moz-, -ms-, -o-
  // camelCase: Webkit, Moz, ms (lowercase), O
  if (isVendorPrefixedProperty(propertyName)) {
    return true;
  }

  return getCSSPropertyNameSet().has(propertyName);
}

/**
 * Checks if a property name is a vendor-prefixed CSS property.
 * Supports both kebab-case (-webkit-transform) and camelCase (WebkitTransform) formats.
 * @param propertyName The property name to check.
 * @returns True if the property has a vendor prefix.
 */
function isVendorPrefixedProperty(propertyName: string): boolean {
  // Kebab-case vendor prefixes
  if (
    propertyName.startsWith('-webkit-') ||
    propertyName.startsWith('-moz-') ||
    propertyName.startsWith('-ms-') ||
    propertyName.startsWith('-o-')
  ) {
    return true;
  }

  // CamelCase vendor prefixes
  // Note: ms prefix is typically lowercase in camelCase (msTransform, not MsTransform)
  // but when converting from kebab-case, -ms-flex becomes MsFlex (capital M)
  if (
    propertyName.startsWith('Webkit') ||
    propertyName.startsWith('Moz') ||
    propertyName.startsWith('ms') ||
    propertyName.startsWith('Ms') || // Handle MsFlex from kebab-case conversion
    propertyName.startsWith('O')
  ) {
    // Check that it's not just a property starting with these letters
    // Vendor-prefixed properties have a capital letter after the prefix (except ms)
    // e.g., WebkitTransform, MozAppearance, msFlexAlign, OTransition
    if (propertyName.startsWith('ms')) {
      // ms prefix: msTransform, msFlexAlign (next char should be uppercase)
      return propertyName.length > 2 && propertyName[2] === propertyName[2].toUpperCase();
    } else if (propertyName.startsWith('Ms')) {
      // Ms prefix (from kebab-case conversion): MsFlex, MsTransform
      return propertyName.length > 2 && /^Ms[A-Z]/.test(propertyName);
    } else if (propertyName.startsWith('O')) {
      // O prefix: OTransition (next char should be uppercase)
      return propertyName.length > 1 && propertyName[1] === propertyName[1].toUpperCase();
    } else {
      // Webkit, Moz: WebkitTransform, MozAppearance
      // The prefix itself starts with uppercase and continues with a standard property name
      return propertyName.length > propertyName.match(/^(Webkit|Moz)/)?.[0].length!;
    }
  }

  return false;
}

/**
 * Converts a kebab-case CSS property name to camelCase.
 * @param kebabCase The kebab-case property name (e.g., 'background-color').
 * @returns The camelCase property name (e.g., 'backgroundColor').
 */
export function kebabToCamelCase(kebabCase: string): string {
  return kebabCase.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts a camelCase CSS property name to kebab-case.
 * @param camelCase The camelCase property name (e.g., 'backgroundColor').
 * @returns The kebab-case property name (e.g., 'background-color').
 */
export function camelToKebabCase(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Finds similar CSS property names for a given misspelled property.
 * Uses Levenshtein distance for fuzzy matching.
 * @param typo The misspelled property name.
 * @param maxSuggestions Maximum number of suggestions to return.
 * @returns Array of similar property names, sorted by similarity.
 */
export function findSimilarCSSProperties(typo: string, maxSuggestions: number = 3): string[] {
  const properties = getCSSPropertyNames();
  const typoLower = typo.toLowerCase();

  // Calculate Levenshtein distance for each property
  const distances: Array<{name: string; distance: number}> = properties.map((name) => ({
    name,
    distance: levenshteinDistance(typoLower, name.toLowerCase()),
  }));

  // Filter to properties with reasonable distance and sort by distance
  return distances
    .filter((d) => d.distance <= Math.max(3, Math.floor(typo.length / 2)))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions)
    .map((d) => d.name);
}

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy matching property names.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Gets value completions for a CSS property.
 * @param propertyName The CSS property name (camelCase).
 * @returns Array of valid values, or empty array if the property takes arbitrary values.
 */
export function getCSSPropertyValues(propertyName: string): readonly string[] {
  return CSS_PROPERTY_VALUES[propertyName] ?? [];
}

/**
 * Mapping of CSS shorthand properties to their longhand properties.
 * When a shorthand is set, it will override any previously set longhand values.
 *
 * All property names are in camelCase.
 *
 * @see https://developer.mozilla.org/docs/Web/CSS/Shorthand_properties
 */
export const CSS_SHORTHAND_LONGHANDS: Readonly<Record<string, readonly string[]>> = {
  // Background
  background: [
    'backgroundColor',
    'backgroundImage',
    'backgroundPosition',
    'backgroundPositionX',
    'backgroundPositionY',
    'backgroundSize',
    'backgroundRepeat',
    'backgroundOrigin',
    'backgroundClip',
    'backgroundAttachment',
  ],

  // Border
  border: [
    'borderWidth',
    'borderStyle',
    'borderColor',
    'borderTop',
    'borderRight',
    'borderBottom',
    'borderLeft',
    'borderTopWidth',
    'borderTopStyle',
    'borderTopColor',
    'borderRightWidth',
    'borderRightStyle',
    'borderRightColor',
    'borderBottomWidth',
    'borderBottomStyle',
    'borderBottomColor',
    'borderLeftWidth',
    'borderLeftStyle',
    'borderLeftColor',
  ],
  borderTop: ['borderTopWidth', 'borderTopStyle', 'borderTopColor'],
  borderRight: ['borderRightWidth', 'borderRightStyle', 'borderRightColor'],
  borderBottom: ['borderBottomWidth', 'borderBottomStyle', 'borderBottomColor'],
  borderLeft: ['borderLeftWidth', 'borderLeftStyle', 'borderLeftColor'],
  borderWidth: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
  borderStyle: ['borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle'],
  borderColor: ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'],
  borderRadius: [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ],

  // Margin & Padding
  margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],

  // Font
  font: [
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'lineHeight',
    'fontFamily',
  ],

  // Flexbox
  flex: ['flexGrow', 'flexShrink', 'flexBasis'],
  flexFlow: ['flexDirection', 'flexWrap'],

  // Grid
  grid: [
    'gridTemplateRows',
    'gridTemplateColumns',
    'gridTemplateAreas',
    'gridAutoRows',
    'gridAutoColumns',
    'gridAutoFlow',
  ],
  gridTemplate: ['gridTemplateRows', 'gridTemplateColumns', 'gridTemplateAreas'],
  gridArea: ['gridRowStart', 'gridColumnStart', 'gridRowEnd', 'gridColumnEnd'],
  gridRow: ['gridRowStart', 'gridRowEnd'],
  gridColumn: ['gridColumnStart', 'gridColumnEnd'],
  gap: ['rowGap', 'columnGap'],
  placeContent: ['alignContent', 'justifyContent'],
  placeItems: ['alignItems', 'justifyItems'],
  placeSelf: ['alignSelf', 'justifySelf'],

  // Animation & Transition
  animation: [
    'animationName',
    'animationDuration',
    'animationTimingFunction',
    'animationDelay',
    'animationIterationCount',
    'animationDirection',
    'animationFillMode',
    'animationPlayState',
  ],
  transition: [
    'transitionProperty',
    'transitionDuration',
    'transitionTimingFunction',
    'transitionDelay',
  ],

  // Text
  textDecoration: [
    'textDecorationLine',
    'textDecorationStyle',
    'textDecorationColor',
    'textDecorationThickness',
  ],

  // Outline
  outline: ['outlineWidth', 'outlineStyle', 'outlineColor'],

  // List
  listStyle: ['listStyleType', 'listStylePosition', 'listStyleImage'],

  // Overflow
  overflow: ['overflowX', 'overflowY'],

  // Inset (logical properties)
  inset: ['top', 'right', 'bottom', 'left'],
  insetBlock: ['insetBlockStart', 'insetBlockEnd'],
  insetInline: ['insetInlineStart', 'insetInlineEnd'],

  // Columns
  columns: ['columnWidth', 'columnCount'],
  columnRule: ['columnRuleWidth', 'columnRuleStyle', 'columnRuleColor'],
};

/**
 * Gets the longhand properties for a given shorthand property.
 * @param shorthandProperty The shorthand property name (camelCase).
 * @returns Array of longhand property names, or empty array if not a shorthand.
 */
export function getShorthandLonghands(shorthandProperty: string): readonly string[] {
  return CSS_SHORTHAND_LONGHANDS[shorthandProperty] ?? [];
}

/**
 * Checks if a property is a CSS shorthand property.
 * @param propertyName The property name (camelCase).
 * @returns True if the property is a shorthand.
 */
export function isShorthandProperty(propertyName: string): boolean {
  return propertyName in CSS_SHORTHAND_LONGHANDS;
}

/**
 * Gets the shorthand property that includes a given longhand property.
 * @param longhandProperty The longhand property name (camelCase).
 * @returns The shorthand property name, or null if not a longhand.
 */
export function getShorthandForLonghand(longhandProperty: string): string | null {
  for (const [shorthand, longhands] of Object.entries(CSS_SHORTHAND_LONGHANDS)) {
    if ((longhands as string[]).includes(longhandProperty)) {
      return shorthand;
    }
  }
  return null;
}

/**
 * Checks if a unit suffix is valid.
 * @param unit The unit suffix (e.g., 'px', 'em').
 * @returns True if the unit is valid.
 */
export function isValidCSSUnit(unit: string): boolean {
  return CSS_UNIT_SUFFIXES.includes(unit as CSSUnitSuffix);
}

/**
 * Gets all valid CSS unit suffixes.
 */
export function getCSSUnitSuffixes(): readonly string[] {
  return CSS_UNIT_SUFFIXES;
}

/**
 * Analysis result for a style binding.
 */
export interface StyleBindingAnalysis {
  /** The CSS property name (in camelCase). */
  propertyName: string;
  /** The unit suffix, if present (e.g., 'px'). */
  unit: string | null;
  /** The expected type for the binding expression. */
  expectedType: 'string' | 'number' | 'string | number';
  /** Whether the property name is valid. */
  isValidProperty: boolean;
  /** Whether the unit suffix is valid (if present). */
  isValidUnit: boolean;
  /** Suggested corrections if the property name is invalid. */
  suggestions: string[];
}

/**
 * Analyzes a style binding expression to determine validity and expected types.
 * @param bindingName The full binding name (e.g., 'width', 'width.px', 'backgroundColor').
 * @returns Analysis of the binding.
 */
export function analyzeStyleBinding(bindingName: string): StyleBindingAnalysis {
  const parts = bindingName.split('.');
  const propertyName = parts[0];
  const unit = parts.length > 1 ? parts[1] : null;

  const isValidProperty = isValidCSSProperty(propertyName);
  const isValidUnit = unit === null || isValidCSSUnit(unit);

  // Determine expected type
  let expectedType: 'string' | 'number' | 'string | number';
  if (unit !== null) {
    // With unit suffix, expect number (e.g., [style.width.px]="100")
    expectedType = 'number';
  } else if (
    ['opacity', 'zIndex', 'order', 'flexGrow', 'flexShrink', 'lineHeight'].includes(propertyName)
  ) {
    // Unitless numeric properties
    expectedType = 'string | number';
  } else {
    // Standard style binding expects string
    expectedType = 'string';
  }

  return {
    propertyName,
    unit,
    expectedType,
    isValidProperty,
    isValidUnit,
    suggestions: isValidProperty ? [] : findSimilarCSSProperties(propertyName),
  };
}
