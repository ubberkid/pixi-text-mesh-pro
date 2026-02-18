import { describe, it, expect } from 'vitest';
import { RichTextParser } from '../../src/parser/RichTextParser';

describe('RichTextParser', () => {
    const parser = new RichTextParser();
    const BASE_SIZE = 32;
    const BASE_COLOR = 0xffffff;
    const BASE_FONT = 'TestFont';

    function parse(text: string) {
        return parser.parse(text, BASE_SIZE, BASE_COLOR, BASE_FONT);
    }

    describe('plain text', () => {
        it('should parse plain text without tags', () => {
            const result = parse('Hello World');
            expect(result).toHaveLength(11);
            expect(result.map(c => c.char).join('')).toBe('Hello World');
        });

        it('should preserve newlines', () => {
            const result = parse('Line1\nLine2');
            expect(result).toHaveLength(11);
            expect(result[5].char).toBe('\n');
            expect(result[5].isLineBreak).toBe(true);
        });

        it('should strip carriage returns', () => {
            const result = parse('A\r\nB');
            expect(result.map(c => c.char).join('')).toBe('A\nB');
        });

        it('should handle empty string', () => {
            const result = parse('');
            expect(result).toHaveLength(0);
        });
    });

    describe('<color> tag', () => {
        it('should parse hex color', () => {
            const result = parse('<color=#ff0000>Red</color>');
            expect(result).toHaveLength(3);
            expect(result[0].color).toBe(0xff0000);
            expect(result[1].color).toBe(0xff0000);
            expect(result[2].color).toBe(0xff0000);
        });

        it('should restore color after closing tag', () => {
            const result = parse('A<color=#ff0000>B</color>C');
            expect(result[0].color).toBe(BASE_COLOR);
            expect(result[1].color).toBe(0xff0000);
            expect(result[2].color).toBe(BASE_COLOR);
        });

        it('should handle nested colors', () => {
            const result = parse('<color=#ff0000>R<color=#00ff00>G</color>R</color>');
            expect(result[0].color).toBe(0xff0000); // R
            expect(result[1].color).toBe(0x00ff00); // G
            expect(result[2].color).toBe(0xff0000); // R (restored)
        });

        it('should parse named colors', () => {
            const result = parse('<color=red>R</color>');
            expect(result[0].color).toBe(0xff0000);
        });

        it('should handle quoted color values', () => {
            const result = parse('<color="#ff00ff">M</color>');
            expect(result[0].color).toBe(0xff00ff);
        });
    });

    describe('<alpha> tag', () => {
        it('should parse hex alpha', () => {
            const result = parse('<alpha=#80>A</alpha>');
            expect(result[0].alpha).toBeCloseTo(128 / 255);
        });

        it('should restore alpha after close', () => {
            const result = parse('A<alpha=#80>B</alpha>C');
            expect(result[0].alpha).toBe(1);
            expect(result[1].alpha).toBeCloseTo(128 / 255);
            expect(result[2].alpha).toBe(1);
        });
    });

    describe('<b> and <i> tags', () => {
        it('should set bold', () => {
            const result = parse('A<b>B</b>C');
            expect(result[0].bold).toBe(false);
            expect(result[1].bold).toBe(true);
            expect(result[2].bold).toBe(false);
        });

        it('should set italic', () => {
            const result = parse('A<i>B</i>C');
            expect(result[0].italic).toBe(false);
            expect(result[1].italic).toBe(true);
            expect(result[2].italic).toBe(false);
        });

        it('should handle nested bold and italic', () => {
            const result = parse('<b><i>BI</i>B</b>');
            expect(result[0].bold).toBe(true);
            expect(result[0].italic).toBe(true);
            expect(result[1].bold).toBe(true);
            expect(result[1].italic).toBe(true);
            expect(result[2].bold).toBe(true);
            expect(result[2].italic).toBe(false);
        });
    });

    describe('<size> tag', () => {
        it('should change font size', () => {
            const result = parse('A<size=48>B</size>C');
            expect(result[0].fontSize).toBe(BASE_SIZE);
            expect(result[1].fontSize).toBe(48);
            expect(result[2].fontSize).toBe(BASE_SIZE);
        });

        it('should support percentage', () => {
            const result = parse('<size=200%>B</size>');
            expect(result[0].fontSize).toBe(BASE_SIZE * 2);
        });

        it('should support em units', () => {
            const result = parse('<size=1.5em>B</size>');
            expect(result[0].fontSize).toBe(BASE_SIZE * 1.5);
        });
    });

    describe('<br> tag', () => {
        it('should insert line break', () => {
            const result = parse('A<br>B');
            expect(result).toHaveLength(3);
            expect(result[1].char).toBe('\n');
            expect(result[1].isLineBreak).toBe(true);
        });
    });

    describe('<noparse> tag', () => {
        it('should treat content as literal text', () => {
            const result = parse('<noparse><b>not bold</b></noparse>');
            const text = result.map(c => c.char).join('');
            expect(text).toBe('<b>not bold</b>');
            expect(result[0].bold).toBe(false);
        });
    });

    describe('malformed tags', () => {
        it('should treat unclosed < as literal', () => {
            const result = parse('A < B');
            expect(result.map(c => c.char).join('')).toBe('A < B');
        });

        it('should treat unknown tags as literal text', () => {
            const result = parse('A<unknown>B</unknown>C');
            // Unknown tags are emitted as literal characters (not stripped)
            expect(result.map(c => c.char).join('')).toBe('A<unknown>B</unknown>C');
        });

        it('should handle empty tags', () => {
            const result = parse('A<>B');
            expect(result.map(c => c.char).join('')).toBe('A<>B');
        });
    });

    describe('complex nesting', () => {
        it('should handle deeply nested tags', () => {
            const result = parse('<color=#ff0000><b><size=48><i>X</i></size></b></color>');
            expect(result[0].color).toBe(0xff0000);
            expect(result[0].bold).toBe(true);
            expect(result[0].fontSize).toBe(48);
            expect(result[0].italic).toBe(true);
        });

        it('should handle multiple same-level tags', () => {
            const result = parse('<b>A</b> <i>B</i> <color=#ff0000>C</color>');
            expect(result[0].bold).toBe(true);
            expect(result[2].italic).toBe(true);
            expect(result[4].color).toBe(0xff0000);
        });
    });
});
