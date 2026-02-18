import { describe, it, expect } from 'vitest';
import { RichTextParser } from '../../src/parser/RichTextParser';
import { parseSpriteTag } from '../../src/parser/tags/SpriteTags';

describe('Phase 5c Parser Tags', () => {
    const parser = new RichTextParser();
    const BASE_SIZE = 32;
    const BASE_COLOR = 0xffffff;
    const BASE_FONT = 'TestFont';

    function parse(text: string) {
        return parser.parse(text, BASE_SIZE, BASE_COLOR, BASE_FONT);
    }

    // --- Group 1: Unicode Character Tags ---

    describe('<zwsp> tag', () => {
        it('should insert zero-width space character', () => {
            const result = parse('A<zwsp>B');
            expect(result).toHaveLength(3);
            expect(result[1].char).toBe('\u200B');
            expect(result[1].charCode).toBe(0x200B);
        });
    });

    describe('<softhyphen> tag', () => {
        it('should insert soft hyphen character', () => {
            const result = parse('A<softhyphen>B');
            expect(result).toHaveLength(3);
            expect(result[1].char).toBe('\u00AD');
            expect(result[1].charCode).toBe(0x00AD);
        });
    });

    describe('<shy> tag', () => {
        it('should insert soft hyphen character (alias)', () => {
            const result = parse('A<shy>B');
            expect(result).toHaveLength(3);
            expect(result[1].char).toBe('\u00AD');
            expect(result[1].charCode).toBe(0x00AD);
        });
    });

    describe('<en-space> tag', () => {
        it('should insert en space character', () => {
            const result = parse('A<en-space>B');
            expect(result).toHaveLength(3);
            expect(result[1].char).toBe('\u2002');
            expect(result[1].charCode).toBe(0x2002);
        });
    });

    describe('<em-space> tag', () => {
        it('should insert em space character', () => {
            const result = parse('A<em-space>B');
            expect(result).toHaveLength(3);
            expect(result[1].char).toBe('\u2003');
            expect(result[1].charCode).toBe(0x2003);
        });
    });

    // --- Group 2: Mark Alpha ---

    describe('<mark> with 8-digit hex', () => {
        it('should parse RRGGBBAA and pack alpha into high byte', () => {
            const result = parse('<mark=#ffff0080>A</mark>');
            // alpha=0x80, rgb=0xffff00 → (0x80 << 24) | 0xffff00
            const expected = ((0x80 << 24) | 0xffff00) >>> 0;
            expect(result[0].markColor).toBe(expected);
        });

        it('should still work with 6-digit hex', () => {
            const result = parse('<mark=#ff0000>A</mark>');
            expect(result[0].markColor).toBe(0xff0000);
        });

        it('should default to yellow when no value', () => {
            const result = parse('<mark>A</mark>');
            expect(result[0].markColor).toBe(0xffff00);
        });

        it('should extract alpha byte correctly', () => {
            const result = parse('<mark=#00ff00cc>A</mark>');
            const color = result[0].markColor;
            const alpha = (color >> 24) & 0xff;
            const rgb = color & 0xffffff;
            expect(alpha).toBe(0xcc);
            expect(rgb).toBe(0x00ff00);
        });
    });

    // --- Group 3: Sprite Extensions ---

    describe('parseSpriteTag with index= and tint=', () => {
        it('should parse index attribute', () => {
            const result = parseSpriteTag('"icons" index=3');
            expect(result.index).toBe(3);
            expect(result.atlasName).toBe('');
            expect(result.spriteName).toBe('icons');
        });

        it('should parse tint attribute', () => {
            const result = parseSpriteTag('"icons" name="coin" tint=#ff0000');
            expect(result.tint).toBe(0xff0000);
            expect(result.spriteName).toBe('coin');
        });

        it('should parse both index and tint', () => {
            const result = parseSpriteTag('"atlas" index=5 tint=#00ff00');
            expect(result.index).toBe(5);
            expect(result.tint).toBe(0x00ff00);
        });

        it('should default index and tint to -1', () => {
            const result = parseSpriteTag('"atlas" name="coin"');
            expect(result.index).toBe(-1);
            expect(result.tint).toBe(-1);
        });
    });

    describe('<sprite> tag with index/tint in parser', () => {
        it('should store spriteIndex on ParsedChar', () => {
            const result = parse('<sprite="icons" index=2>');
            expect(result).toHaveLength(1);
            expect(result[0].isSprite).toBe(true);
            expect(result[0].spriteIndex).toBe(2);
        });

        it('should store spriteTint on ParsedChar', () => {
            const result = parse('<sprite name="coin" tint=#ff0000>');
            expect(result).toHaveLength(1);
            expect(result[0].isSprite).toBe(true);
            expect(result[0].spriteTint).toBe(0xff0000);
        });

        it('should default spriteIndex and spriteTint to -1', () => {
            const result = parse('<sprite name="coin">');
            expect(result[0].spriteIndex).toBe(-1);
            expect(result[0].spriteTint).toBe(-1);
        });
    });

    // --- Group 4: Padding Tag ---

    describe('<padding> tag', () => {
        it('should work as alias for <margin>', () => {
            const result = parse('<padding=20>A</padding>B');
            expect(result[0].marginLeft).toBe(20);
            expect(result[0].marginRight).toBe(20);
            expect(result[1].marginLeft).toBe(0);
            expect(result[1].marginRight).toBe(0);
        });
    });

    // --- Group 5a: font-weight ---

    describe('<font-weight> tag', () => {
        it('should set fontWeight on characters', () => {
            const result = parse('<font-weight=700>A</font-weight>B');
            expect(result[0].fontWeight).toBe('700');
            expect(result[1].fontWeight).toBe('');
        });

        it('should support string values', () => {
            const result = parse('<font-weight=bold>A</font-weight>');
            expect(result[0].fontWeight).toBe('bold');
        });
    });

    // --- Group 5b: duospace ---

    describe('<duospace> tag', () => {
        it('should set mspace like <mspace>', () => {
            const result = parse('<duospace=20>AB</duospace>C');
            expect(result[0].mspace).toBe(20);
            expect(result[1].mspace).toBe(20);
            expect(result[2].mspace).toBe(0);
        });
    });

    // --- Group 5c: line-indent ---

    describe('<line-indent> tag', () => {
        it('should set lineIndent on characters', () => {
            const result = parse('<line-indent=30>A</line-indent>B');
            expect(result[0].lineIndent).toBe(30);
            expect(result[1].lineIndent).toBe(0);
        });
    });
});
