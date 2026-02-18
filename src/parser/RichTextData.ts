import type { ParsedChar, TextAlignment } from '../core/types';

/** The style state maintained during parsing. Push/pop stacks track nesting. */
export interface StyleState {
    color: number;
    alpha: number;
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    markColor: number;
    markPadding: number[];
    cspace: number;
    mspace: number;
    voffset: number;
    underlineColor: number;
    strikethroughColor: number;
    italicAngle: number;
    isNoBreak: boolean;
    isLink: boolean;
    linkId: string;

    // Phase 2 additions
    align: TextAlignment | '';
    indent: number;
    marginLeft: number;
    marginRight: number;
    lineHeightOverride: number;
    isAllCaps: boolean;
    isLowercase: boolean;
    isSmallCaps: boolean;
    isSuperscript: boolean;
    isSubscript: boolean;
    charScale: number;
    rotation: number;
    gradientColors: number[];
    widthConstraint: number;
    fontWeight: string;
    lineIndent: number;
    /** Current material preset name. */
    material: string;
}

/** Create a default style state from base properties. */
export function createDefaultStyleState(
    fontSize: number,
    color: number,
    fontFamily: string,
): StyleState {
    return {
        color,
        alpha: 1,
        fontSize,
        fontFamily,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        markColor: 0,
        markPadding: [],
        cspace: 0,
        mspace: 0,
        voffset: 0,
        underlineColor: -1,
        strikethroughColor: -1,
        italicAngle: 0,
        isNoBreak: false,
        isLink: false,
        linkId: '',
        align: '',
        indent: 0,
        marginLeft: 0,
        marginRight: 0,
        lineHeightOverride: 0,
        isAllCaps: false,
        isLowercase: false,
        isSmallCaps: false,
        isSuperscript: false,
        isSubscript: false,
        charScale: 1,
        rotation: 0,
        gradientColors: [],
        widthConstraint: 0,
        fontWeight: '',
        lineIndent: 0,
        material: '',
    };
}

/** Create a ParsedChar from the current style state. */
export function createParsedChar(
    char: string,
    originalIndex: number,
    state: StyleState,
): ParsedChar {
    return {
        char,
        charCode: char.codePointAt(0) ?? 0,
        originalIndex,
        color: state.color,
        alpha: state.alpha,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        bold: state.bold,
        italic: state.italic,
        underline: state.underline,
        strikethrough: state.strikethrough,
        markColor: state.markColor,
        markPadding: state.markPadding.length > 0 ? [...state.markPadding] : [],
        cspace: state.cspace,
        mspace: state.mspace,
        voffset: state.voffset,
        underlineColor: state.underlineColor,
        strikethroughColor: state.strikethroughColor,
        italicAngle: state.italicAngle,
        align: state.align,
        indent: state.indent,
        marginLeft: state.marginLeft,
        marginRight: state.marginRight,
        lineHeightOverride: state.lineHeightOverride,
        isAllCaps: state.isAllCaps,
        isLowercase: state.isLowercase,
        isSmallCaps: state.isSmallCaps,
        isSuperscript: state.isSuperscript,
        isSubscript: state.isSubscript,
        charScale: state.charScale,
        rotation: state.rotation,
        gradientColors: state.gradientColors.length > 0 ? [...state.gradientColors] : [],
        widthConstraint: state.widthConstraint,
        fontWeight: state.fontWeight,
        lineIndent: state.lineIndent,
        isSprite: false,
        spriteAsset: '',
        spriteName: '',
        spriteIndex: -1,
        spriteTint: -1,
        isLink: state.isLink,
        linkId: state.linkId,
        isNoBreak: state.isNoBreak,
        isLineBreak: char === '\n',
        extraSpace: 0,
        fixedPosition: NaN,
        material: state.material,
    };
}
